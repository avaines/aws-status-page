const htmlProcessor = require('../../src/processors/htmlProcessor');

// Mock dependencies
jest.mock('../../src/utils/templateEngine');
jest.mock('../../src/config/statusConfig');
jest.mock('../../src/utils/iconUtils');

const TemplateEngine = require('../../src/utils/templateEngine');
const statusConfig = require('../../src/config/statusConfig');
const iconUtils = require('../../src/utils/iconUtils');

describe('htmlProcessor', () => {
  let mockTemplateEngine;

  beforeEach(() => {
    mockTemplateEngine = {
      render: jest.fn()
    };
    TemplateEngine.mockImplementation(() => mockTemplateEngine);

    statusConfig.STATUS_CONFIG = {
      operational: {
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        label: 'Operational'
      },
      degraded: {
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        label: 'Degraded Performance'
      }
    };

    iconUtils.getStatusIcon = jest.fn().mockReturnValue('<svg>status-icon</svg>');
    iconUtils.getServiceIcon = jest.fn().mockReturnValue('<svg>service-icon</svg>');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generate', () => {
    it('should generate HTML with services', () => {
      const services = [
        {
          id: 'test-service',
          name: 'Test Service',
          description: 'Test description',
          status: 'operational',
          lastUpdated: '2 minutes ago',
          alarms: [
            {
              name: 'TestAlarm',
              state: 'OK',
              reason: 'Test reason',
              timestamp: '2024-01-01T00:00:00Z'
            }
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

      const result = htmlProcessor.generate(services, overallStatus, [], config);

      expect(mockTemplateEngine.render).toHaveBeenCalledWith('status-page', expect.objectContaining({
        serviceName: 'Test Service',
        serviceUrl: 'https://test.com',
        dataRetentionDays: 30,
        hasServices: true,
        serviceCount: 1,
        overallStatusLabel: 'Operational',
        overallStatusMessage: 'All systems operational'
      }));

      expect(result).toBe('<html>Generated HTML</html>');
    });

    it('should generate HTML without services', () => {
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

      const result = htmlProcessor.generate(services, overallStatus, [], config);

      expect(mockTemplateEngine.render).toHaveBeenCalledWith('status-page', expect.objectContaining({
        hasServices: false,
        serviceCount: 0,
        isInitialDeploy: false
      }));

      expect(result).toBe('<html>No Services HTML</html>');
    });
  });

  describe('generateInitial', () => {
    it('should generate initial deployment HTML', () => {
      mockTemplateEngine.render.mockReturnValue('<html>Initial HTML</html>');

      const result = htmlProcessor.generateInitial(
        'Test Service',
        'https://test.com',
        30,
        'test-distribution'
      );

      expect(mockTemplateEngine.render).toHaveBeenCalledWith('status-page', expect.objectContaining({
        serviceName: 'Test Service',
        serviceUrl: 'https://test.com',
        dataRetentionDays: 30,
        hasServices: false,
        isInitialDeploy: true,
        overallStatusLabel: 'All Systems Operational',
        overallStatusMessage: 'Status page has been successfully deployed and is ready to monitor your services.'
      }));

      expect(result).toBe('<html>Initial HTML</html>');
    });
  });
});