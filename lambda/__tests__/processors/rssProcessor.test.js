const rssProcessor = require('../../src/processors/rssProcessor');

// Mock dependencies
jest.mock('../../src/utils/xmlUtils');

const xmlUtils = require('../../src/utils/xmlUtils');

describe('rssProcessor', () => {
  beforeEach(() => {
    xmlUtils.escapeXml = jest.fn().mockImplementation(str => str);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generate', () => {
    it('should generate RSS feed with incidents', () => {
      const recentIncidents = [
        {
          serviceId: 'test-service',
          timestamp: 1640995200000, // 2022-01-01T00:00:00Z
          status: 'degraded',
          message: 'Service experiencing issues',
          ttl: 1672531200 // 2023-01-01T00:00:00Z
        }
      ];

      const config = {
        SERVICE_NAME: 'Test Service',
        DATA_RETENTION_DAYS: 30,
        CLOUDFRONT_DISTRIBUTION_ID: 'test-distribution'
      };

      const result = rssProcessor.generate(recentIncidents, config);

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<title>Test Service - Status Updates</title>');
      expect(result).toContain('<description>Real-time status updates for Test Service (Data retained for 30 days)</description>');
      expect(result).toContain('<link>https://test-distribution.cloudfront.net</link>');
      expect(result).toContain('<item>');
      expect(result).toContain('<title>test-service: Degraded Performance</title>');
      expect(result).toContain('<guid isPermaLink="false">test-service-1640995200000</guid>');
    });

    it('should generate empty RSS feed without incidents', () => {
      const recentIncidents = [];
      const config = {
        SERVICE_NAME: 'Test Service',
        DATA_RETENTION_DAYS: 30,
        CLOUDFRONT_DISTRIBUTION_ID: 'test-distribution'
      };

      const result = rssProcessor.generate(recentIncidents, config);

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<title>Test Service - Status Updates</title>');
      expect(result).not.toContain('<item>');
    });
  });

  describe('generateInitial', () => {
    it('should generate initial RSS feed', () => {
      const config = {
        SERVICE_NAME: 'Test Service',
        CLOUDFRONT_DISTRIBUTION_ID: 'test-distribution'
      };

      const result = rssProcessor.generateInitial(config);

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<title>Test Service - Status Updates</title>');
      expect(result).toContain('<title>Status Page Deployed</title>');
      expect(result).toContain('<description>Your AWS status page has been successfully deployed');
      expect(result).toContain('<guid isPermaLink="false">initial-deployment-');
    });
  });
});