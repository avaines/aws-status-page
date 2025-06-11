// Global test setup
global.console = {
  ...console,
  // Suppress console.log during tests unless explicitly needed
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Mock AWS SDK globally
jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => ({
    putObject: jest.fn(() => ({
      promise: jest.fn()
    }))
  })),
  CloudWatch: jest.fn(() => ({
    describeAlarms: jest.fn(() => ({
      promise: jest.fn()
    }))
  })),
  DynamoDB: {
    DocumentClient: jest.fn(() => ({
      scan: jest.fn(() => ({
        promise: jest.fn()
      })),
      query: jest.fn(() => ({
        promise: jest.fn()
      })),
      put: jest.fn(() => ({
        promise: jest.fn()
      }))
    }))
  },
  SNS: jest.fn(() => ({
    publish: jest.fn(() => ({
      promise: jest.fn()
    }))
  })),
  CloudFront: jest.fn(() => ({
    createInvalidation: jest.fn(() => ({
      promise: jest.fn()
    }))
  }))
}));

// Mock environment variables
process.env.STATUS_BUCKET = 'test-bucket';
process.env.STATUS_TABLE = 'test-table';
process.env.SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789012:test-topic';
process.env.CLOUDFRONT_DISTRIBUTION_ID = 'E1234567890123';
process.env.SERVICE_NAME = 'Test Service';
process.env.SERVICE_URL = 'https://test.example.com';
process.env.DATA_RETENTION_DAYS = '30';
process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-status-generator';
process.env.AWS_REGION = 'us-east-1';