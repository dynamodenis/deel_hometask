const request = require('supertest');
const {Op} = require('sequelize');
const { sequelize } = require('../../src/model');
const app = require('../../src/app');

// Here we mock the structure the database models
jest.mock('../../src/model', () => ({
  sequelize: {
    transaction: jest.fn(),
    fn: jest.fn(),
    col: jest.fn(),
    models: {
      Contract: {
        findOne: jest.fn(),
        findAll: jest.fn()
      },
      Job: {
        findOne: jest.fn(),
        findAll: jest.fn()
      },
      Profile: {
        findByPk: jest.fn()
      }
    }
  }
}));

// Mock the getProfile middleware
jest.mock('../../src/middleware/getProfile', () => ({
  getProfile: (req, res, next) => {
    req.profile = { id: 1, type: 'client', balance: 1000 };
    next();
  }
}));

describe('Contracts API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /contracts/:id', () => {
    it('should return a contract when user has access', async () => {
      const mockContract = {
        id: 1,
        ClientId: 1,
        ContractorId: 2,
        status: 'in_progress'
      };

      sequelize.models.Contract.findOne.mockResolvedValue(mockContract);

      const response = await request(app)
        .get('/contracts/1')
        .expect(200);

      expect(response.body).toEqual(mockContract);
      expect(sequelize.models.Contract.findOne).toHaveBeenCalledWith({
        where: {
          id: '1',
          [Op.or]: [
            { ClientId: 1 },
            { ContractorId: 1 }
          ]
        }
      });
    });

    it('should return 404 when contract not found', async () => {
      sequelize.models.Contract.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/contracts/999')
        .expect(404);

      expect(response.body.error).toBe('Contract not found or you do not have access to it.');
    });

    it('should return 500 on database error', async () => {
      sequelize.models.Contract.findOne.mockRejectedValue(new Error('DB Error'));

      const response = await request(app)
        .get('/contracts/1')
        .expect(500);

      expect(response.body.error).toBe('Internal server error please try again.');
    });
  });

  describe('GET /contracts', () => {
    it('should return non-terminated contracts for user', async () => {
      const mockContracts = [
        { id: 1, status: 'in_progress', ClientId: 1 },
        { id: 2, status: 'new', ContractorId: 1 }
      ];

      sequelize.models.Contract.findAll.mockResolvedValue(mockContracts);

      const response = await request(app)
        .get('/contracts')
        .expect(200);

      expect(response.body).toEqual(mockContracts);
      expect(sequelize.models.Contract.findAll).toHaveBeenCalledWith({
        where: {
          status: { [Op.ne]: 'terminated' },
          [Op.or]: [
            { ClientId: 1 },
            { ContractorId: 1 }
          ]
        }
      });
    });
  });
});

describe('Jobs API', () => {
  describe('GET /jobs/unpaid', () => {
    it('should return unpaid jobs for user contracts', async () => {
      const mockJobs = [
        {
          id: 1,
          paid: false,
          price: 100,
          Contract: { id: 1, ClientId: 1 }
        }
      ];

      sequelize.models.Job.findAll.mockResolvedValue(mockJobs);

      const response = await request(app)
        .get('/jobs/unpaid')
        .expect(200);

      expect(response.body).toEqual(mockJobs);
    });
  });

  describe('POST /jobs/:job_id/pay', () => {
    let mockTransaction;

    beforeEach(() => {
      mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };
      sequelize.transaction.mockResolvedValue(mockTransaction);
    });

    it('should successfully pay for a job', async () => {
      const mockProfile = { id: 1, type: 'client', balance: 1000 };
      const mockJob = {
        id: 1,
        price: 100,
        paid: false,
        save: jest.fn(),
        Contract: {
          Client: { id: 1, balance: 1000, save: jest.fn() },
          Contractor: { id: 2, balance: 500, save: jest.fn() }
        }
      };

      sequelize.models.Profile.findByPk.mockResolvedValue(mockProfile);
      sequelize.models.Job.findOne.mockResolvedValue(mockJob);

      const response = await request(app)
        .post('/jobs/1/pay')
        .expect(200);

      expect(response.body.message).toBe('Job payment processed successfully.');
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(mockJob.save).toHaveBeenCalled();
    });

    it('should return 403 when user is not a client', async () => {
      const mockProfile = { id: 1, type: 'contractor', balance: 1000 };
      sequelize.models.Profile.findByPk.mockResolvedValue(mockProfile);

      const response = await request(app)
        .post('/jobs/1/pay')
        .expect(403);

      expect(response.body.error).toBe('Only clients can pay for jobs.');
    

    });

    it('should return 400 when client has insufficient balance', async () => {
      const mockProfile = { id: 1, type: 'client', balance: 50 };
      const mockJob = {
        id: 1,
        price: 100,
        Contract: {
          Client: { id: 1, balance: 50 },
          Contractor: { id: 2, balance: 500 }
        }
      };

      sequelize.models.Profile.findByPk.mockResolvedValue(mockProfile);
      sequelize.models.Job.findOne.mockResolvedValue(mockJob);

      const response = await request(app)
        .post('/jobs/1/pay')
        .expect(400);

      expect(response.body.error).toContain('You do not have enough money');
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });
});

describe('Balance API', () => {
  describe('POST /balances/deposit/:userId', () => {
    let mockTransaction;

    beforeEach(() => {
      mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };
      sequelize.transaction.mockResolvedValue(mockTransaction);
    });

    it('should successfully deposit money within limit', async () => {
      const mockProfile = { 
        id: 1, 
        type: 'client', 
        balance: 1000,
        save: jest.fn()
      };
      const mockUnpaidJobs = [
        { price: 100 },
        { price: 200 }
      ];

      sequelize.models.Profile.findByPk.mockResolvedValue(mockProfile);
      sequelize.models.Job.findAll.mockResolvedValue(mockUnpaidJobs);

      const response = await request(app)
        .post('/balances/deposit/1')
        .send({ amount: 75 }) // 25% of 300 total unpaid
        .expect(200);

      expect(response.body.message).toContain('Successfully deposited 75');
      expect(mockProfile.save).toHaveBeenCalled();
      expect(mockTransaction.commit).toHaveBeenCalled();


    });

    it('should reject deposit exceeding 25% limit', async () => {
      const mockProfile = { id: 1, type: 'client', balance: 1000 };
      const mockUnpaidJobs = [{ price: 100 }];
      sequelize.models.Profile.findByPk.mockResolvedValue(mockProfile);
      sequelize.models.Job.findAll.mockResolvedValue(mockUnpaidJobs);

      const response = await request(app)
        .post('/balances/deposit/1')
        .send({ amount: 50 }) // Exceeds 25% of 100
        .expect(400);

      expect(response.body.error).toContain('You can only deposit up to 25');
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });
});

describe('Admin API', () => {
  describe('GET /admin/best-profession', () => {
    it('should return best profession with earnings', async () => {
      const mockJobs = [{
        'Contract.Contractor.profession': 'Developer',
        totalEarnings: '5000'
      }];
      sequelize.models.Job.findAll.mockResolvedValue(mockJobs);
      const response = await request(app)
        .get('/admin/best-profession')
        .query({ start: '2024-01-01', end: '2024-12-31' })
        .expect(200);

      expect(response.body.profession).toBe('Developer');
      expect(response.body.totalEarnings).toBe('5000');
    });

    it('should return 400 for missing date parameters', async () => {
      const response = await request(app)
        .get('/admin/best-profession')
        .expect(400);

      expect(response.body.error).toBe('Please provide both start and end dates.');
    });

    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .get('/admin/best-profession')
        .query({ start: 'invalid-date', end: '2024-12-31' })
        .expect(400);

      expect(response.body.error).toContain('Invalid date format');
    });
  });

  describe('GET /admin/best-clients', () => {
    it('should return best clients with default limit', async () => {
      const mockJobs = [
        {
          'Contract.Client.id': 1,
          'Contract.Client.firstName': 'John',
          'Contract.Client.lastName': 'Doe',
          totalEarnings: '1000'
        }
      ];

      sequelize.models.Job.findAll.mockResolvedValue(mockJobs);

      const response = await request(app)
        .get('/admin/best-clients')
        .query({ start: '2024-01-01', end: '2024-12-31' })
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].fullName).toBe('John Doe');
      expect(response.body[0].paid).toBe('1000');
    });

    it('should respect custom limit parameter', async () => {
      sequelize.models.Job.findAll.mockResolvedValue([]);

      await request(app)
        .get('/admin/best-clients')
        .query({ start: '2024-01-01', end: '2024-12-31', limit: 5 });

      expect(sequelize.models.Job.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: '5' })
      );
    });
  });
});
