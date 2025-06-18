const htmlTemplate = require('../../src/templates/htmlTemplate');
const TemplateEngine = require('../../src/utils/templateEngine');

// Mock the template engine
jest.mock('../../src/utils/templateEngine');

describe('htmlTemplate', () => {
  let mockTemplateEngine;

  beforeEach(() => {
    mockTemplateEngine = {
      render: jest.fn()
    };
    TemplateEngine.mockImplementation(() => mockTemplateEngine);
    jest.clearAllMocks();
  });

  describe('generate', () => {
    test('should generate HTML with services', () => {
      const services = [
        {
          id: 'api',
          name: 'API Service',
          description: 'REST API',
          status: 'operational',
          lastUpdated: '2 minutes ago',
          alarms: [
            { name: 'API-ErrorRate', state: 'OK', reason: 'Normal operation' }
          ]
        }
      ];

      const overallStatus = {
        status: 'operational',
        message: 'All systems operational'
      };

      const config = {
        SERVICE_NAME: 'Test Service',
        SERVICE_URL: 'https://test.com',
        DATA_RETENTION_DAYS: 30,
        CLOUDFRONT_DISTRIBUTION_ID: 'test-distribution'
      };

      mockTemplateEngine.render.mockReturnValue('<html>Generated HTML</html>');

      const result = htmlTemplate.generate(services, overallStatus, [], config);

      expect(mockTemplateEngine.render).toHaveBeenCalledWith('status-page', expect.objectContaining({
        serviceName: 'Test Service',
        serviceUrl: 'https://test.com',
        dataRetentionDays: 30,
        hasServices: true,
        serviceCount: 1,
        services: expect.arrayContaining([
          expect.objectContaining({
            id: 'api',
            name: 'API Service',
            alarmCount: 1,
            alarmCountPlural: ''
          })
        ])
      }));

      expect(result).toBe('<html>Generated HTML</html>');
    });

    test('should generate HTML without services', () => {
      const services = [];
      const overallStatus = {
        status: 'operational',
        message: 'No services monitored'
      };

      const config = {
        SERVICE_NAME: 'Test Service',
        SERVICE_URL: 'https://test.com',
        DATA_RETENTION_DAYS: 30,
        CLOUDFRONT_DISTRIBUTION_ID: 'test-distribution'
      };

      mockTemplateEngine.render.mockReturnValue('<html>No Services HTML</html>');

      const result = htmlTemplate.generate(services, overallStatus, [], config);

      expect(mockTemplateEngine.render).toHaveBeenCalledWith('status-page', expect.objectContaining({
        hasServices: false,
        serviceCount: 0,
        serviceCountPlural: 's'
      }));

      expect(result).toBe('<html>No Services HTML</html>');
    });

    test('should handle multiple services with different statuses', () => {
      const services = [
        {
          id: 'api',
          name: 'API Service',
          status: 'operational',
          alarms: [{ name: 'API-1', state: 'OK' }]
        },
        {
          id: 'db',
          name: 'Database',
          status: 'degraded',
          alarms: [
            { name: 'DB-1', state: 'ALARM' },
            { name: 'DB-2', state: 'OK' }
          ]
        }
      ];

      const overallStatus = {
        status: 'degraded',
        message: '1 service degraded'
      };

      const config = {
        SERVICE_NAME: 'Test Service',
        SERVICE_URL: 'https://test.com',
        DATA_RETENTION_DAYS: 30,
        CLOUDFRONT_DISTRIBUTION_ID: 'test-distribution'
      };

      htmlTemplate.generate(services, overallStatus, [], config);

      expect(mockTemplateEngine.render).toHaveBeenCalledWith('status-page', expect.objectContaining({
        serviceCount: 2,
        serviceCountPlural: 's',
        services: expect.arrayContaining([
          expect.objectContaining({
            alarmCount: 1,
            alarmCountPlural: ''
          }),
          expect.objectContaining({
            alarmCount: 2,
            alarmCountPlural: 's'
          })
        ])
      }));
    });
  });

  describe('generateInitial', () => {
    test('should generate initial status page', () => {
      mockTemplateEngine.render.mockReturnValue('<html>Initial HTML</html>');

      const result = htmlTemplate.generateInitial(
        'Test Service',
        'https://test.com',
        30,
        'test-distribution'
      );

      expect(mockTemplateEngine.render).toHaveBeenCalledWith('initial-status-page', expect.objectContaining({
        serviceName: 'Test Service',
        serviceUrl: 'https://test.com',
        dataRetentionDays: 30,
        rssUrl: 'https://test-distribution.cloudfront.net/rss.xml'
      }));

      expect(result).toBe('<html>Initial HTML</html>');
    });

    test('should handle missing CloudFront distribution', () => {
      mockTemplateEngine.render.mockReturnValue('<html>Initial HTML</html>');

      htmlTemplate.generateInitial('Test Service', 'https://test.com', 30, null);

      expect(mockTemplateEngine.render).toHaveBeenCalledWith('initial-status-page', expect.objectContaining({
        rssUrl: 'https://your-status-page.com/rss.xml'
      }));
    });
  });
});