const express = require('express');
const {Op} = require('sequelize');
const {getProfile} = require('../middleware/getProfile');
const {sequelize} = require('../model')

const router = express.Router();

/**
 * @swagger
 * /admin/best-profession:
 *   get:
 *     summary: Get the best profession by total earnings
 *     description: Retrieves the best profession based on total earnings from jobs within a specified date range.
 *     tags:
 *       - Admin
 *     security:
 *       - ProfileAuth: []
 *     parameters:
 *       - in: query
 *         name: start
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for the date range (YYYY-MM-DD)
 *         example: "2023-01-01"
 *       - in: query
 *         name: end
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for the date range (YYYY-MM-DD)
 *         example: "2023-12-31"
 *     responses:
 *       200:
 *         description: The best profession and total earnings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profession:
 *                   type: string
 *                   example: "Developer"
 *                 totalEarnings:
 *                   type: number
 *                   example: 50000
 *       400:
 *         description: Invalid or missing date range
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missingDates:
 *                 value:
 *                   error: "Please provide both start and end dates."
 *               invalidFormat:
 *                 value:
 *                   error: "Invalid date format. Please use a valid date format YYYY-MM-DD."
 *       404:
 *         description: No jobs found in the specified date range
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
router.get('/best-profession', getProfile, async (req, res) => {
    try {
        const {Profile, Job, Contract} = req.app.get('models')
        const {start, end} = req.query

        // TO-DO: Ensure the user is an admin if we had admin roles 

        // Validate date range
        if (!start || !end) {
            return res.status(400).json({error: 'Please provide both start and end dates.'})
        }

        const startDate = new Date(start)
        const endDate = new Date(end)
        endDate.setUTCHours(23, 59, 59, 999) // Ensure the end date includes the entire day

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({error: 'Invalid date format. Please use a valid date format YYYY-MM-DD.'})
        }

        const jobs = await Job.findAll({
            attributes:[
                [sequelize.fn('SUM', sequelize.col('price')), 'totalEarnings'],
            ],
            where: {
                paymentDate: {
                    [Op.between]: [startDate, endDate]
                },
                paid: true
            },
            include: [{
                model: Contract,
                include: [{
                    model: Profile,
                    as: 'Contractor',
                    attributes: ['id', 'profession'],
                    where: {
                        type: 'contractor' // Ensure we only consider contractors
                    }

                }]
            }],
            group: ['Contract.Contractor.profession'], // Group the results by contractor profession
            order: [[sequelize.fn('SUM', sequelize.col('price')), 'DESC']],
            limit: 1,
            raw: true
        })

        if (jobs.length === 0) {
            return res.status(404).json({error: 'No jobs found in the specified date range.'})
        }
        // Assuming jobs is an array of objects with totalEarnings and Contractor.profession
        const bestProfession = jobs[0]
        res.status(200).json({
            profession: bestProfession['Contract.Contractor.profession'],
            totalEarnings: bestProfession.totalEarnings
        })
        
    } catch (error) {
        console.error('Error fetching best profession:', error)
        res.status(500).json({error: 'Internal server error please try again.'})
    }
});

/**
 * @swagger
 * /admin/best-clients:
 *   get:
 *     summary: Get the best clients by total payments
 *     description: Retrieves the best clients based on total earnings from jobs within a specified date range.
 *     tags:
 *       - Admin
 *     security:
 *       - ProfileAuth: []
 *     parameters:
 *       - in: query
 *         name: start
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for the date range (YYYY-MM-DD)
 *         example: "2023-01-01"
 *       - in: query
 *         name: end
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for the date range (YYYY-MM-DD)
 *         example: "2023-12-31"
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 2
 *         description: The maximum number of best clients to return
 *         example: 5
 *     responses:
 *       200:
 *         description: List of best clients with their total payments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 1
 *                   fullName:
 *                     type: string
 *                     example: "John Doe"
 *                   paid:
 *                     type: number
 *                     example: 25000
 *       400:
 *         description: Invalid or missing parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missingDates:
 *                 value:
 *                   error: "Please provide both start and end dates."
 *               invalidFormat:
 *                 value:
 *                   error: "Invalid date format. Please use a valid date format YYYY-MM-DD."
 *               invalidLimit:
 *                 value:
 *                   error: "Invalid limit. Please provide a positive number."
 *       404:
 *         description: No jobs found in the specified date range
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
router.get('/best-clients', getProfile, async (req, res) => {
    try {
        const {Profile, Job, Contract} = req.app.get('models');
        const sequelize = req.app.get('sequelize');
        const {start, end, limit = 2} = req.query;

        // TO-DO ensure the user is an admin or has the right permissions to access this route if we had roles

        // Validate date range
        if (!start || !end) {
            return res.status(400).json({error: 'Please provide both start and end dates.'});
        }

        const startDate = new Date(start);
        const endDate = new Date(end);
        endDate.setUTCHours(23, 59, 59, 999); // Include the entire end date

        // Validate date format and limit
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({error: 'Invalid date format. Please use a valid date format YYYY-MM-DD.'});
        }

        if (isNaN(limit) || limit <= 0) {
            return res.status(400).json({error: 'Invalid limit. Please provide a positive number.'});
        }

        const jobs = await Job.findAll({
            attributes:[
                [sequelize.fn('SUM', sequelize.col('price')), 'totalEarnings'],
            ],
            where: {
                paymentDate: {
                    [Op.between]: [startDate, endDate]
                },
                paid: true
            },
            include: [{
                model: Contract,
                include: [{
                    model: Profile,
                    as: 'Client',
                    attributes: ['id', 'firstName', 'lastName'],
                    where: {
                        type: 'client' // Ensure we only consider clients
                    }

                }]
            }],
            group: ['Contract.Client.id', 'Contract.Client.firstName', 'Contract.Client.lastName'], // Group the results by contractor profession
            order: [[sequelize.fn('SUM', sequelize.col('price')), 'DESC']],
            limit: limit,
            raw: true
        })

        if (jobs.length === 0) {
            return res.status(404).json({error: 'No jobs found in the specified date range.'})
        }

        const bestClients = jobs.map(job => ({
            id: job['Contract.Client.id'],
            fullName: `${job['Contract.Client.firstName']} ${job['Contract.Client.lastName']}`,
            paid: job.totalEarnings
        }))
        res.status(200).json(bestClients)
    } catch (error) {
        console.error('Error fetching best clients:', error)
        res.status(500).json({error: 'Internal server error please try again.'})
    }
})

module.exports = router;