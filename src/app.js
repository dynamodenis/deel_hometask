const express = require('express');
const bodyParser = require('body-parser');
const {Op} = require('sequelize');
const swaggerJSDoc = require('swagger-jsdoc');
const {sequelize} = require('./model')
const {getProfile} = require('./middleware/getProfile');
const swaggerUI = require('swagger-ui-express');

const contractRoutes = require('./routes/contracts');
const jobRoutes = require('./routes/jobs');
const balanceRoutes = require('./routes/balances');
const adminRoutes = require('./routes/admin');

// Debug: Try a more specific swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Deel API',
      version: '1.0.0',
      description: 'API for managing contracts between clients and contractors',
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
    ],
    components: {
      schemas: {
        Contract: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            terms: { type: 'string', example: 'Website development contract' },
            status: { type: 'string', enum: ['new', 'in_progress', 'terminated'] },
            ClientId: { type: 'integer', example: 1 },
            ContractorId: { type: 'integer', example: 2 },
          },
        },
        Job: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            description: { type: 'string', example: 'Build a website' },
            price: { type: 'number', example: 1000 },
            paid: { type: 'boolean', example: false },
            paymentDate: { type: 'string', format: 'date-time', nullable: true },
            ContractId: { type: 'integer', example: 1 },
          },
        },
        Profile: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            profession: { type: 'string', example: 'Developer' },
            balance: { type: 'number', example: 500 },
            type: { type: 'string', enum: ['client', 'contractor'] },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        SuccessMessage: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
      securitySchemes: {
        ProfileAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'profile_id',
        },
      },
    },
    security: [{ ProfileAuth: [] }],
    tags: [
      { name: 'Contracts', description: 'Contract management operations' },
      { name: 'Jobs', description: 'Job management operations' },
      { name: 'Balances', description: 'Balance and payment operations' },
      { name: 'Admin', description: 'Administrative operations' },
    ],
  },
  apis: [
    './src/routes/*.js', // This will scan all route files for Swagger documentation
  ],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions)

const app = express();

app.use(bodyParser.json());
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerSpec))

app.set('sequelize', sequelize)
app.set('models', sequelize.models)

app.use('/contracts', contractRoutes);
app.use('/jobs', jobRoutes);
app.use('/balances', balanceRoutes);
app.use('/admin', adminRoutes);

module.exports = app;
