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



module.exports = app;
