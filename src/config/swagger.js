const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Contracts API',
      version: '1.0.0',
      description: 'API for managing contracts between clients and contractors',
      contact: {
        name: 'API Support',
        email: 'support@contractsapi.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
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
          required: ['terms', 'ClientId', 'ContractorId'],
          properties: {
            id: {
              type: 'integer',
              description: 'Contract ID',
              example: 1,
            },
            terms: {
              type: 'string',
              description: 'Contract terms',
              example: 'Website development contract',
            },
            status: {
              type: 'string',
              enum: ['new', 'in_progress', 'terminated'],
              description: 'Contract status',
              example: 'in_progress',
            },
            ClientId: {
              type: 'integer',
              description: 'Client profile ID',
              example: 1,
            },
            ContractorId: {
              type: 'integer',
              description: 'Contractor profile ID',
              example: 2,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
              example: '2023-01-01T00:00:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2023-01-01T00:00:00.000Z',
            },
          },
        },
        Profile: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Profile ID',
              example: 1,
            },
            firstName: {
              type: 'string',
              description: 'First name',
              example: 'John',
            },
            lastName: {
              type: 'string',
              description: 'Last name',
              example: 'Doe',
            },
            profession: {
              type: 'string',
              description: 'Profession',
              example: 'Developer',
            },
            balance: {
              type: 'number',
              format: 'decimal',
              description: 'Account balance',
              example: 1000.50,
            },
            type: {
              type: 'string',
              enum: ['client', 'contractor'],
              description: 'Profile type',
              example: 'contractor',
            },
          },
        },
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
              example: 'Internal server error please try again.',
            },
          },
        },
        Jobs: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Job ID',
              example: 1,
            },
            description: {
              type: 'string',
              description: 'Job description',
              example: 'Looking for an experienced web developer to build a website.',
            },
            price: {
              type: 'number',
              format: 'decimal',
              description: 'Job price',
              example: 500.00,
            },
            paid: {
              type: 'boolean',
              description: 'Payment status',
              example: false,
            },
            paymentDate: {
              type: 'date-time',
              format: 'date-time',
              description: 'Date when the job was paid',
              example: '2023-01-01T00:00:00.000Z',
            },
            createdAt: {
              type: 'date-time',
              format: 'date-time',
              description: 'Creation timestamp',
              example: '2023-01-01T00:00:00.000Z',
            },
            updatedAt: {
              type: 'date-time',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2023-01-01T00:00:00.000Z',
            },
            ContractId: {
              type: 'integer',
              description: 'Contract ID',
              example: 1,
            }
          },
        },
      },
      securitySchemes: {
        ProfileAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'profile_id',
          description: 'Profile ID for authentication',
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer token authentication',
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication information is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Authentication required',
              },
            },
          },
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Internal server error please try again.',
              },
            },
          },
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ValidationError',
              },
            },
          },
        },
      },
    },
    security: [
      {
        ProfileAuth: [],
      },
    ],
    tags: [
      {
        name: 'Contracts',
        description: 'Contract management operations',
      },
      {
        name: 'Profiles',
        description: 'Profile management operations',
      },
      {
        name: 'Jobs',
        description: 'Job management operations',
      },
    ],
  },
  apis: [
    './routes/*.js',
    './app.js',
    './controllers/*.js',
    './routes/contracts.js',
    './routes/profiles.js',
    './routes/jobs.js',
  ],
};

module.exports = swaggerOptions;