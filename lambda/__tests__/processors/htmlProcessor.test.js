const htmlProcessor = require('../../src/processors/htmlProcessor');

// Mock dependencies
jest.mock('../../src/utils/templateEngine');
jest.mock('../../src/config/statusConfig');
jest.mock('../../src/utils/iconUtils');
jest.mock('../../src/utils/timeUtils');

const TemplateEngine = require('../../src/utils/templateEngine');
const statusConfig = require('../../src/config/statusConfig');
const iconUtils = require('../../src/utils/iconUtils');
const timeUtils = require('../../src/utils/timeUtils');

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
    timeUtils.formatTimestamp = jest.fn().mockReturnValue('5 minutes ago');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generate', () => {
    it('should generate HTML with services and recent incidents', () => {
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

      const recentIncidents = [
        {
          serviceId: 'overall',
          timestamp: 1640995200000,
          status: 'operational',
          message: 'System restored to normal operation',
          services: services
        }
      ];

      const config = {
        SERVICE_NAME: 'Test Service',
        SERVICE_URL: 'https://test.com',
        DATA_RETENTION_DAYS: 30,
        CLOUDFRONT_DISTRIBUTION_ID: 'test-distribution'
      };

      mockTemplateEngine.render.mockReturnValue('<html>Generated HTML</html>');

      const result = htmlProcessor.generate(services, overallStatus, recentIncidents, config);

      expect(mockTemplateEngine.render).toHaveBeenCalledWith('status-page', expect.objectContaining({
        serviceName: 'Test Service',
        serviceUrl: 'https://test.com',
        dataRetentionDays: 30,
        hasServices: true,
        serviceCount: 1,
        hasRecentIncidents: true,
        recentIncidents: expect.arrayContaining([
          expect.objectContaining({
            title: 'System Status: Operational',
            description: expect.any(String),
            statusDotColor: 'bg-green-400',
            formattedTimestamp: expect.any(String)
          })
        ]),
        overallStatusLabel: 'Operational',
        overallStatusMessage: 'All systems operational'
      }));

      expect(result).toBe('<html>Generated HTML</html>');
    });

    it('should generate HTML without services or incidents', () => {
      const services = [];
      const overallStatus = {
        status: 'operational',
        message: 'No services monitored'
      };
      const recentIncidents = [];

      const config = {
        SERVICE_NAME: 'Test Service',
        SERVICE_URL: 'https://test.com',
        DATA_RETENTION_DAYS: 30,
        CLOUDFRONT_DISTRIBUTION_ID: 'test-distribution'
      };

      mockTemplateEngine.render.mockReturnValue('<html>No Services HTML</html>');

      const result = htmlProcessor.generate(services, overallStatus, recentIncidents, config);

      expect(mockTemplateEngine.render).toHaveBeenCalledWith('status-page', expect.objectContaining({
        hasServices: false,
        serviceCount: 0,
        hasRecentIncidents: false,
        recentIncidents: [],
        isInitialDeploy: false
      }));

      expect(result).toBe('<html>No Services HTML</html>');
    });

    it('should limit recent incidents to 10 items', () => {
      const services = [];
      const overallStatus = { status: 'operational', message: 'Test' };
      
      // Create 15 incidents
      const recentIncidents = Array.from({ length: 15 }, (_, i) => ({
        serviceId: 'overall',
        timestamp: 1640995200000 + i * 1000,
        status: 'operational',
        message: `Incident ${i + 1}`
      }));

      const config = {
        SERVICE_NAME: 'Test Service',
        SERVICE_URL: 'https://test.com',
        DATA_RETENTION_DAYS: 30,
        CLOUDFRONT_DISTRIBUTION_ID: 'test-distribution'
      };

      mockTemplateEngine.render.mockReturnValue('<html>Limited Incidents</html>');

      htmlProcessor.generate(services, overallStatus, recentIncidents, config);

      const templateCall = mockTemplateEngine.render.mock.calls[0][1];
      expect(templateCall.recentIncidents).toHaveLength(10);
    });

    it('should format incident titles correctly for different service types', () => {
      const services = [
        { id: 'test-service', name: 'Test Service', status: 'degraded' }
      ];
      
      const overallStatus = { status: 'operational', message: 'Test' };
      
      const recentIncidents = [
        {
          serviceId: 'overall',
          timestamp: 1640995200000,
          status: 'degraded',
          message: 'System degraded',
          services: services
        },
        {
          serviceId: 'test-service',
          timestamp: 1640995200000,
          status: 'major_outage',
          message: 'Service down',
          services: services
        }
      ];

      const config = {
        SERVICE_NAME: 'Test Service',
        SERVICE_URL: 'https://test.com',
        DATA_RETENTION_DAYS: 30,
        CLOUDFRONT_DISTRIBUTION_ID: 'test-distribution'
      };

      mockTemplateEngine.render.mockReturnValue('<html>Formatted Incidents</html>');

      htmlProcessor.generate(services, overallStatus, recentIncidents, config);

      const templateCall = mockTemplateEngine.render.mock.calls[0][1];
      expect(templateCall.recentIncidents[0].title).toBe('System Status: Degraded Performance');
      expect(templateCall.recentIncidents[1].title).toBe('Test Service: Major Outage');
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
        hasRecentIncidents: false,
        isInitialDeploy: true,
        overallStatusLabel: 'All Systems Operational',
        overallStatusMessage: 'Status page has been successfully deployed and is ready to monitor your services.'
      }));

      expect(result).toBe('<html>Initial HTML</html>');
    });
  });
});