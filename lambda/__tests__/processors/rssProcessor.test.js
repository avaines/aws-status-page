const rssProcessor = require('../../src/processors/rssProcessor');

// Mock dependencies
jest.mock('../../src/utils/templateEngine');
jest.mock('../../src/utils/xmlUtils');

const TemplateEngine = require('../../src/utils/templateEngine');
const xmlUtils = require('../../src/utils/xmlUtils');

describe('rssProcessor', () => {
  let mockTemplateEngine;

  beforeEach(() => {
    mockTemplateEngine = {
      render: jest.fn()
    };
    TemplateEngine.mockImplementation(() => mockTemplateEngine);
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

      mockTemplateEngine.render.mockReturnValue('<rss>Generated RSS</rss>');

      const result = rssProcessor.generate(recentIncidents, config);

      expect(mockTemplateEngine.render).toHaveBeenCalledWith('rss-feed', expect.objectContaining({
        serviceName: 'Test Service',
        dataRetentionDays: 30,
        statusPageUrl: 'https://test-distribution.cloudfront.net',
        isInitialDeploy: false,
        incidents: expect.arrayContaining([
          expect.objectContaining({
            title: 'test-service: Degraded Performance',
            guid: 'test-service-1640995200000'
          })
        ])
      }));

      expect(result).toBe('<rss>Generated RSS</rss>');
    });

    it('should generate empty RSS feed without incidents', () => {
      const recentIncidents = [];
      const config = {
        SERVICE_NAME: 'Test Service',
        DATA_RETENTION_DAYS: 30,
        CLOUDFRONT_DISTRIBUTION_ID: 'test-distribution'
      };

      mockTemplateEngine.render.mockReturnValue('<rss>Empty RSS</rss>');

      const result = rssProcessor.generate(recentIncidents, config);

      expect(mockTemplateEngine.render).toHaveBeenCalledWith('rss-feed', expect.objectContaining({
        serviceName: 'Test Service',
        isInitialDeploy: false,
        incidents: []
      }));

      expect(result).toBe('<rss>Empty RSS</rss>');
    });
  });

  describe('generateInitial', () => {
    it('should generate initial RSS feed', () => {
      const config = {
        SERVICE_NAME: 'Test Service',
        CLOUDFRONT_DISTRIBUTION_ID: 'test-distribution'
      };

      mockTemplateEngine.render.mockReturnValue('<rss>Initial RSS</rss>');

      const result = rssProcessor.generateInitial(config);

      expect(mockTemplateEngine.render).toHaveBeenCalledWith('rss-feed', expect.objectContaining({
        serviceName: 'Test Service',
        statusPageUrl: 'https://test-distribution.cloudfront.net',
        isInitialDeploy: true,
        deploymentTimestamp: expect.any(Number),
        incidents: []
      }));

      expect(result).toBe('<rss>Initial RSS</rss>');
    });
  });
});