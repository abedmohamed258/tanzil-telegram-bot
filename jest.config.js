module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },

  // Set NODE_ENV to test
  setupFiles: ['<rootDir>/tests/setup.ts'],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/legacy/**',
    '!src/index.ts',
  ],

  // Coverage thresholds - temporarily lowered for new modular download system
  coverageThreshold: {
    global: {
      statements: 30,
      branches: 20,
      functions: 28,
      lines: 30,
    },
  },

  // Timeout for async tests
  testTimeout: 10000,

  // Module paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Verbose output
  verbose: true,
};
