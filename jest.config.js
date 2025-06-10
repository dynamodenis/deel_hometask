module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  moduleFileExtensions: ['js', 'json'],
  testMatch: ['**/tests/**/*.js', '**/tests/**/*.test.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.js', '!src/models.js', '!src/config/*.js'],
  globals: {
    'babel-jest': {
      babelConfig: true,
    },
  },
};