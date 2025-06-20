// Jest setup file for AWS SDK v3 mocking

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-cloudwatch');
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-sns');
jest.mock('@aws-sdk/client-cloudfront');

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

global.mockAWSCommand = (mockImplementation) => {
  return {
    send: jest.fn().mockImplementation(mockImplementation)
  };
};

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeEach(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;

  jest.clearAllMocks();
});