const express = require('express');
const {Op} = require('sequelize');
const {getProfile} = require('../middleware/getProfile');

const router = express.Router();

/**
 * @swagger
 * /contracts/{id}:
 *   get:
 *     summary: Retrieve a specific contract by ID
 *     description: Retrieves a specific contract by its ID, ensuring that the user is either the client or contractor associated with the contract.
 *     tags:
 *       - Contracts
 *     security:
 *       - ProfileAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the contract to retrieve
 *     responses:
 *       200:
 *         description: The contract details if found and accessible by the user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Contract'
 *       404:
 *         description: Contract not found or user does not have access to it
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Contract not found or you do not have access to it."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', getProfile, async (req, res) => {
    try {
        const {Contract} = req.app.get('models');
        const profileId = req.profile.id;
        const {id} = req.params;
        
        const contract = await Contract.findOne({
            where: {
                id,
                [Op.or]: [
                    {ClientId: profileId},
                    {ContractorId: profileId}
                ]
            }
        });
        
        if (!contract) {
            return res.status(404).json({error: 'Contract not found or you do not have access to it.'});
        }
        
        res.json(contract);
    } catch (error) {
        console.error('Error fetching contract:', error);
        return res.status(500).json({error: 'Internal server error please try again.'});
    }
});

/**
 * @swagger
 * /contracts:
 *   get:
 *     summary: Retrieve all non-terminated contracts for the authenticated user
 *     description: Returns all non-terminated contracts associated with the authenticated user, either as a client or a contractor.
 *     tags:
 *       - Contracts
 *     security:
 *       - ProfileAuth: []
 *     responses:
 *       200:
 *         description: List of contracts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Contract'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', getProfile, async (req, res) => {
    try {
        const {Contract} = req.app.get('models');
        const profileId = req.profile.id;

        const contracts = await Contract.findAll({
            where: {
                status: {
                    [Op.ne]: 'terminated'
                },
                [Op.or]: [
                    {ClientId: profileId},
                    {ContractorId: profileId}
                ]
            },
        });
        
        res.status(200).json(contracts);
    } catch (error) {
        console.error('Error fetching contracts:', error);
        res.status(500).json({error: 'Internal server error please try again.'});
    }
});

module.exports = router;