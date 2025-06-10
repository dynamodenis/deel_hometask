module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  moduleFileExtensions: ['js', 'json'],
  testMatch: ['**/__tests__/**/*.test.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.js', '!src/models.js', '!src/config/*.js'],
  setupFilesAfterEnv: ['./jest.setup.js'],
  globals: {
    'babel-jest': {
      babelConfig: true,
    },
  },
};