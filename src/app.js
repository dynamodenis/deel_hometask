const express = require('express');
const bodyParser = require('body-parser');
const {sequelize} = require('./model')
const {getProfile} = require('./middleware/getProfile');
const {Op, where} = require('sequelize');

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

/**
 * @route POST /jobs/:job_id/pay
 * @middleware getProfile - Middleware to ensure the user is authenticated and profile is loaded.
 * @param {string} job_id - The ID of the job to be paid.
 * @returns {Object} 200 - Confirmation message if the payment is processed successfully.
 * @returns {Error} 404 - Job not found, already paid, or inactive.
 * @returns {Error} 403 - If the user is not a client trying to pay for a job.
 * @returns {Error} 400 - If the client does not have enough balance to pay for the job.
 * @returns {Error} 500 - Internal server error if something goes wrong while processing the payment.
 *
 * This endpoint allows a client to pay for a job, ensuring that the job is unpaid and the client has sufficient balance.
 * It updates the job status to paid, deducts the job price from the client's balance, and adds it to the contractor's balance.
 * Requires profile information to be present on the request.
 */
app.post('/jobs/:job_id/pay', getProfile, async (req, res) => {
    const transaction = await sequelize.transaction()

    try {
        const {Job, Contract, Profile} = req.app.get('models')
        const profileId = req.profile.id
        const {job_id} = req.params

        // Get profile first to make sure the user type is client
        const profile = await Profile.findByPk(profileId)
        if (!profile) {
            return res.status(404).json({error: 'Profile not found.'})
        }
        if (profile.type !== 'client') {
            return res.status(403).json({error: 'Only clients can pay for jobs.'})
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
                        [Op.ne]: 'terminated', // Optional to ensure the contract is active
                    },          
                    ClientId: profile.id // Ensure the client is the one paying,
                },
                include:[
                    {model: Profile, as: 'Contractor'},
                    {model: Profile, as: 'Client'}
                ]
            },
            transaction,
            lock: true
        })
        
        if (!job) {
            await transaction.rollback()
            return res.status(404).json({error: 'Job not found or already paid or inactive.'})
        }

        const jobPrice = job.price
        const clientProfile = job.Contract.Client
        const contractorProfile = job.Contract.Contractor
        if (!clientProfile || !contractorProfile) {
            await transaction.rollback()
            return res.status(404).json({error: 'Client or Contractor profile not found.'})
        }
        // Check if client has enough balance
        if(clientProfile.balance < jobPrice) {
            await transaction.rollback()
            return res.status(400).json({error: 'You do not have enough money to pay for this job. Please to up.'})
        }

        // Deduct the job price from the client's balance
        clientProfile.balance -= jobPrice
        // Add the job price to the contractor's balance
        contractorProfile.balance += jobPrice
        await clientProfile.save({transaction})
        await contractorProfile.save({transaction})

        // Now update the job as paid
        job.paid = true
        job.paymentDate = new Date()

        await job.save({transaction})
        await transaction.commit()

        res.status(200).json({
            message: 'Job payment processed successfully.',
            jobId: job.id,
            jobPrice: job.price,
            clientBalance: clientProfile.balance,
            contractorBalance: contractorProfile.balance
        })
    } catch (error) {
        console.error('Error processing job payment:', error)
        res.status(500).json({error: 'Internal server error please try again.'})
    }
})

/**
 * @route POST /balances/deposit/:userId
 * @middleware getProfile - Middleware to ensure the user is authenticated and profile is loaded.
 * @param {string} userId - The ID of the user to deposit money to.
 * @body {number} amount - The amount to deposit.
 * @returns {Object} 200 - Confirmation message with the new balance after deposit.
 * @returns {Error} 403 - If the user is not a client trying to deposit money.
 * @returns {Error} 400 - If the deposit amount exceeds the allowed limit (25% of total unpaid jobs).
 * @returns {Error} 500 - Internal server error if something goes wrong while processing the deposit.
 *
 * This endpoint allows a client to deposit money into their balance, ensuring that the deposit amount does not exceed 25% of their total unpaid jobs.
 * It calculates the total unpaid amount from jobs associated with the client's contracts and checks if the deposit amount is within the allowed limit.
 * Requires profile information to be present on the request.
 */
app.post('/balances/deposit/:userId', getProfile, async(req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const {Profile, Job, Contract} = req.app.get('models')
        const profileId = req.profile.id
        const {userId} = req.params
        const {amount} = req.body

        // Ensure the user is a client
        const profile = await Profile.findByPk(profileId)
        if (!profile || profile.type !== 'client') {
            await transaction.rollback()
            return res.status(403).json({error: 'Only clients can deposit money.'})
        }

        // First we need to calculate the total amount to pay for unpaid jobs
        const unpaidJobs = await Job.findAll({
            where:{
                paid: {
                    [Op.not]: true
                }
            },
            include: {
                model: Contract,
                where: {
                    ClientId: profile.id,    
                }
            },
            transaction,
        })

        const totalUnpaidAmount = unpaidJobs.reduce((sum, job) => sum + job.price, 0)
        const maximumDeposit = totalUnpaidAmount * 0.25
        // Check if the deposit amount is within the allowed limit
        if (amount > maximumDeposit){
            await transaction.rollback()
            return res.status(400).json({
                error: `You can only deposit up to ${maximumDeposit} at a time, which is 25% of your total unpaid jobs.`
            })
        }

        profile.balance += amount
        await profile.save({transaction})
        await transaction.commit()

        res.status(200).json({
            message: `Successfully deposited ${amount} to your balance.`,
            newBalance: profile.balance
        })
    } catch (error) {
        console.error('Error processing deposit:', error)
        res.status(500).json({error: 'Internal server error please try again.'})
    }
})

/**
 * @route GET /admin/best-profession
 * @middleware getProfile - Middleware to ensure the user is authenticated and profile is loaded.
 * @query {string} start - Start date for the date range (YYYY-MM-DD).
 * @query {string} end - End date for the date range (YYYY-MM-DD).
 * @returns {Object} 200 - The best profession and total earnings within the specified date range.
 * @returns {Error} 400 - If the date range is not provided or invalid.
 * @returns {Error} 404 - If no jobs are found in the specified date range.
 * @returns {Error} 500 - Internal server error if something goes wrong while fetching the best profession.
 *
 * This endpoint retrieves the best profession based on total earnings from jobs within a specified date range.
 * It calculates the total earnings for each profession and returns the one with the highest earnings.
 */
app.get('/admin/best-profession', getProfile, async (req, res) => {
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
})


/**
 * @route GET /admin/best-clients
 * @middleware getProfile - Middleware to ensure the user is authenticated and profile is loaded.
 * @query {string} start - Start date for the date range (YYYY-MM-DD).
 * @query {string} end - End date for the date range (YYYY-MM-DD).      
 * @query {number} limit - The maximum number of best clients to return (default is 2).
 * @returns {Object[]} 200 - List of best clients with their total earnings within the specified date range.
 * @returns {Error} 400 - If the date range is not provided or invalid.
 * @returns {Error} 404 - If no jobs are found in the specified date range.
 * @returns {Error} 500 - Internal server error if something goes wrong while fetching the best clients.
 *
 * This endpoint retrieves the best clients based on total earnings from jobs within a specified date range.
 * It calculates the total earnings for each client and returns the top clients based on the specified limit.
 */

app.get('/admin/best-clients', getProfile, async (req, res) => {
    try {
        const {Profile, Job, Contract} = req.app.get('models')
        const {start, end, limit = 2} = req.query // Set a default limit of 2 if not provided

        // TO-DO: Ensure the user is an admin if we had admin roles 

        // Validate date range
        if (!start || !end) {
            return res.status(400).json({error: 'Please provide both start and end dates.'})
        }

        const startDate = new Date(start)
        const endDate = new Date(end)

        endDate.setUTCHours(23, 59, 59, 999) // Ensure the end date includes the entire day
        // Validate date format and limit
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({error: 'Invalid date format. Please use a valid date format YYYY-MM-DD.'})
        }

        if (isNaN(limit) || limit <= 0) {
            return res.status(400).json({error: 'Invalid limit. Please provide a positive number or.'})
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

module.exports = app;
