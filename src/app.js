const express = require('express');
const bodyParser = require('body-parser');
const {sequelize} = require('./model')
const {getProfile} = require('./middleware/getProfile');
const {Op} = require('sequelize');

const app = express();

app.use(bodyParser.json());

app.set('sequelize', sequelize)
app.set('models', sequelize.models)

/**
* @route GET /contracts/:id
* @middleware getProfile - Middleware to ensure the user is authenticated and profile is loaded.
* @param {string} id - The ID of the contract to retrieve.
* @returns {Object} 200 - The contract details if found and accessible by the user.
* @returns {Error} 404 - Contract not found or user does not have access to it.
* @returns {Error} 500 - Internal server error if something goes wrong while fetching the contract.
*
* This endpoint retrieves a specific contract by its ID, ensuring that the user is either the client or contractor associated with the contract.
* Requires profile information to be present on the request.
 */
app.get('/contracts/:id',getProfile ,async (req, res) =>{
    try {
        const {Contract} = req.app.get('models')
        const profileId = req.profile.id
        const {id} = req.params
        const contract = await Contract.findOne({
            where: {
                id,
                [Op.or]: [
                    {ClientId: profileId},
                    {ContractorId: profileId}
                ]
            }
        })
        if(!contract) return res.status(404).json({error: 'Contract not found or you do not have access to it.'})
        res.json(contract)
    } catch (error) {
        console.error('Error in getProfile middleware:', error)
        return res.status(500).json({error: 'Internal server error please try again.'})
    }
})

/**
 * @route GET /contracts
 * @middleware getProfile - Middleware to ensure the user is authenticated and profile is loaded.
 * @returns {Object[]} 200 - List of active (non-terminated) contracts where the profile is either the client or contractor using the loggedin user's profile.
 * @returns {Error} 500 - Internal server error if something goes wrong while fetching the contracts
 *
 * This endpoint returns all non-terminated contracts associated with the authenticated user,
 * either as a client or a contractor. Requires profile information to be present on the request.
 */

app.get('/contracts', getProfile, async (req, res) => {
    try {
        const {Contract} = req.app.get('models')
        const profileId = req.profile.id

        const contracts = await Contract.findAll(
            {
                where: {
                    status: {
                        [Op.ne]: 'terminated'
                    },
                    [Op.or]: [
                        {ClientId: profileId},
                        {ContractorId: profileId}
                    ]
                },
            }
        )
        res.status(200).json(contracts)
    }
    catch (error) {
        console.error('Error fetching contracts:', error)
        res.status(500).json({error: 'Internal server error please try again.'})
    }
})

/**
 * @route GET /jobs/unpaid
 * @middleware getProfile - Middleware to ensure the user is authenticated and profile is loaded.
 * @returns {Object[]} 200 - List of unpaid jobs associated with the user's contracts.
 * @returns {Error} 500 - Internal server error if something goes wrong while fetching the jobs.
 *
 * This endpoint retrieves all jobs that have not been paid yet, filtering them based on the user's contracts.
 * Requires profile information to be present on the request.
 */
app.get('/jobs/unpaid', getProfile, async (req, res) => {
    try {
        const {Job, Contract} = req.app.get('models')
        const profileId = req.profile.id
        console.log('Fetching unpaid jobs for profile ID:', profileId)
        const jobs = await Job.findAll({
            where: {
                paid: {
                    [Op.not]: true
                },
            },
            include:[{
                model:Contract,
                where:{
                    status:{
                        [Op.ne]: 'terminated',
                    },
                    [Op.or]: [
                        {ClientId: profileId},
                        {ContractorId: profileId}
                    ]
                }
            }]
        })
        res.status(200).json(jobs)
    } catch (error) {
        console.error('Error fetching unpaid jobs:', error)
        res.status(500).json({error: 'Internal server error please try again.'})
    }
})

module.exports = app;
