// Jest setup file for AWS SDK v3 mocking

// Mock AWS SDK v3 clients
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-cloudwatch');
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-sns');
jest.mock('@aws-sdk/client-cloudfront');

// Set up environment variables for tests
process.env.AWS_REGION = 'us-east-1';
process.env.STATUS_BUCKET = 'test-status-bucket';
process.env.STATUS_TABLE = 'test-status-table';
process.env.SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789012:test-topic';
process.env.CLOUDFRONT_DISTRIBUTION_ID = 'test-distribution-id';
process.env.SERVICE_NAME = 'Test Service';
process.env.SERVICE_URL = 'https://test.example.com';
process.env.DATA_RETENTION_DAYS = '30';
process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-status-generator';
process.env.AWS_ACCOUNT_ID = '123456789012';

// Global test utilities
global.mockAWSCommand = (mockImplementation) => {
  return {
    send: jest.fn().mockImplementation(mockImplementation)
  };
};

// Console log suppression for cleaner test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeEach(() => {
  // Suppress console.log in tests unless explicitly needed
  console.log = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  
  // Clear all mocks
  jest.clearAllMocks();
});