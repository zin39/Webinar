// Test setup file
require('dotenv').config({ path: '.env.test' });

// Increase timeout for database operations
jest.setTimeout(10000);

// Global test utilities
global.testUtils = {
  // Generate random email for testing
  randomEmail: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@test.com`,

  // Generate random string
  randomString: (length = 10) => Math.random().toString(36).substr(2, length),

  // Wait helper
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

// Suppress console during tests (optional)
if (process.env.SUPPRESS_LOGS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}
