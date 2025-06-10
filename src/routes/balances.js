const express = require('express');
const {Op} = require('sequelize');
const {getProfile} = require('../middleware/getProfile');

const router = express.Router();

/**
 * @swagger
 * /balances/deposit/{userId}:
 *   post:
 *     summary: Deposit money to user balance
 *     description: Allows a client to deposit money into their balance, ensuring that the deposit amount does not exceed 25% of their total unpaid jobs.
 *     tags:
 *       - Balances
 *     security:
 *       - ProfileAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to deposit money to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 description: The amount to deposit
 *                 example: 100
 *     responses:
 *       200:
 *         description: Deposit processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Successfully deposited 100 to your balance."
 *                 newBalance:
 *                   type: number
 *                   example: 600
 *       400:
 *         description: Deposit amount exceeds allowed limit or invalid amount
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               exceedsLimit:
 *                 value:
 *                   error: "You can only deposit up to 250 at a time, which is 25% of your total unpaid jobs."
 *               invalidAmount:
 *                 value:
 *                   error: "Invalid deposit amount."
 *       403:
 *         description: Only clients can deposit money
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Only clients can deposit money."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/deposit/:userId', getProfile, async (req, res) => {
    const transaction = await req.app.get('sequelize').transaction();

    try {
        const {Profile, Job, Contract} = req.app.get('models');
        const profileId = req.profile.id;
        const {userId} = req.params;
        const {amount} = req.body;

        // Validate amount
        if (!amount || isNaN(amount) || amount <= 0) {
            await transaction.rollback();
            return res.status(400).json({error: 'Invalid deposit amount. Amount must be a positive number.'});
        }

        // Ensure the loggedin user is a client
        const profile = await Profile.findByPk(profileId);
        if (!profile || profile.type !== 'client') {
            await transaction.rollback();
            return res.status(403).json({error: 'Only clients can deposit money.'});
        }

        // Get the user profile to ensure they are the one depositing
        const userProfile = await Profile.findByPk(userId);

        // Calculate the total amount to pay for unpaid jobs
        const unpaidJobs = await Job.findAll({
            where: {
                paid: {
                    [Op.not]: true
                }
            },
            include: {
                model: Contract,
                where: {
                    ClientId: userId,    
                }
            },
            transaction,
        });

        const totalUnpaidAmount = unpaidJobs.reduce((sum, job) => sum + job.price, 0);
        const maximumDeposit = totalUnpaidAmount * 0.25;
        
        // Check if the deposit amount is within the allowed limit
        if (amount > maximumDeposit) {
            await transaction.rollback();
            return res.status(400).json({
                error: `You can only deposit up to ${maximumDeposit} at a time, which is 25% of your total unpaid jobs.`
            });
        }

        userProfile.balance += amount;
        await userProfile.save({transaction});
        await transaction.commit();

        res.status(200).json({
            message: `Successfully deposited ${amount} to your balance.`,
            newBalance: userProfile.balance
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error processing deposit:', error);
        res.status(500).json({error: 'Internal server error please try again.'});
    }
});

module.exports = router;