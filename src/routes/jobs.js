const express = require('express');
const {Op} = require('sequelize');
const {getProfile} = require('../middleware/getProfile');

const router = express.Router();

/**
 * @swagger
 * /jobs/unpaid:
 *   get:
 *     summary: Retrieve all unpaid jobs for the authenticated user
 *     description: Returns all jobs that have not been paid yet, filtering them based on the user's contracts.
 *     tags:
 *       - Jobs
 *     security:
 *       - ProfileAuth: []
 *     responses:
 *       200:
 *         description: List of unpaid jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/Job'
 *                   - type: object
 *                     properties:
 *                       Contract:
 *                         $ref: '#/components/schemas/Contract'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/unpaid', getProfile, async (req, res) => {
    try {
        const {Job, Contract} = req.app.get('models');
        const profileId = req.profile.id;
                
        const jobs = await Job.findAll({
            where: {
                paid: {
                    [Op.not]: true
                },
            },
            include: [{
                model: Contract,
                where: {
                    status: {
                        [Op.ne]: 'terminated',
                    },
                    [Op.or]: [
                        {ClientId: profileId},
                        {ContractorId: profileId}
                    ]
                }
            }]
        });
        
        res.status(200).json(jobs);
    } catch (error) {
        console.error('Error fetching unpaid jobs:', error);
        res.status(500).json({error: 'Internal server error please try again.'});
    }
});

/**
 * @swagger
 * /jobs/{job_id}/pay:
 *   post:
 *     summary: Pay for a specific job
 *     description: Allows a client to pay for a job, ensuring that the job is unpaid and the client has sufficient balance. Updates job status to paid and adjusts balances.
 *     tags:
 *       - Jobs
 *     security:
 *       - ProfileAuth: []
 *     parameters:
 *       - in: path
 *         name: job_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the job to be paid
 *     responses:
 *       200:
 *         description: Job payment processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Job payment processed successfully."
 *                 jobId:
 *                   type: integer
 *                   example: 1
 *                 jobPrice:
 *                   type: number
 *                   example: 1000
 *                 clientBalance:
 *                   type: number
 *                   example: 500
 *                 contractorBalance:
 *                   type: number
 *                   example: 1500
 *       400:
 *         description: Insufficient balance
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Only clients can pay for jobs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Job not found, already paid, or inactive
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:job_id/pay', getProfile, async (req, res) => {
    const transaction = await req.app.get('sequelize').transaction();

    try {
        const {Job, Contract, Profile} = req.app.get('models');
        const profileId = req.profile.id;
        const {job_id} = req.params;

        // Get profile first to make sure the user type is client
        const profile = await Profile.findByPk(profileId);
        if (!profile) {
            await transaction.rollback();
            return res.status(404).json({error: 'Profile not found.'});
        }
        if (profile.type !== 'client') {
            await transaction.rollback();
            return res.status(403).json({error: 'Only clients can pay for jobs.'});
        }

        // Find the job by ID and ensure it is unpaid
        const job = await Job.findOne({
            where: {
                id: job_id,
                paid: {
                    [Op.not]: true
                }
            },
            include: {
                model: Contract,
                where: {
                    status: {
                        [Op.ne]: 'terminated',
                    },          
                    ClientId: profile.id
                },
                include: [
                    {model: Profile, as: 'Contractor'},
                    {model: Profile, as: 'Client'}
                ]
            },
            transaction,
            lock: true
        });
        
        if (!job) {
            await transaction.rollback();
            return res.status(404).json({error: 'Job not found or already paid or inactive.'});
        }

        const jobPrice = job.price;
        const clientProfile = job.Contract.Client;
        const contractorProfile = job.Contract.Contractor;
        
        if (!clientProfile || !contractorProfile) {
            await transaction.rollback();
            return res.status(404).json({error: 'Client or Contractor profile not found.'});
        }
        
        // Check if client has enough balance
        if (clientProfile.balance < jobPrice) {
            await transaction.rollback();
            return res.status(400).json({error: 'You do not have enough money to pay for this job. Please top up.'});
        }

        // Update balances
        clientProfile.balance -= jobPrice;
        contractorProfile.balance += jobPrice;
        await clientProfile.save({transaction});
        await contractorProfile.save({transaction});

        // Update job as paid
        job.paid = true;
        job.paymentDate = new Date();
        await job.save({transaction});
        
        await transaction.commit();

        res.status(200).json({
            message: 'Job payment processed successfully.',
            jobId: job.id,
            jobPrice: job.price,
            clientBalance: clientProfile.balance,
            contractorBalance: contractorProfile.balance
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error processing job payment:', error);
        res.status(500).json({error: 'Internal server error please try again.'});
    }
});

module.exports = router;