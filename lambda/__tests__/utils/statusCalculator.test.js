const statusCalculator = require('../../src/utils/statusCalculator');

describe('statusCalculator', () => {
  describe('calculateOverallStatus', () => {
    it('should return operational when no services are provided', () => {
      const result = statusCalculator.calculateOverallStatus([]);
      
      expect(result).toEqual({
        status: 'operational',
        message: 'No services are currently being monitored'
      });
    });

    it('should return operational when all services are operational', () => {
      const services = [
        { status: 'operational' },
        { status: 'operational' },
        { status: 'operational' }
      ];
      
      const result = statusCalculator.calculateOverallStatus(services);
      
      expect(result).toEqual({
        status: 'operational',
        message: 'All 3 monitored services are operating normally'
      });
    });

    it('should return major_outage when any service has major outage', () => {
      const services = [
        { status: 'operational' },
        { status: 'major_outage' },
        { status: 'degraded' }
      ];
      
      const result = statusCalculator.calculateOverallStatus(services);
      
      expect(result).toEqual({
        status: 'major_outage',
        message: '1 service is experiencing major outages'
      });
    });

    it('should return major_outage with plural message for multiple outages', () => {
      const services = [
        { status: 'major_outage' },
        { status: 'major_outage' },
        { status: 'operational' }
      ];
      
      const result = statusCalculator.calculateOverallStatus(services);
      
      expect(result).toEqual({
        status: 'major_outage',
        message: '2 services are experiencing major outages'
      });
    });

    it('should return partial_outage when no major outages but partial outages exist', () => {
      const services = [
        { status: 'operational' },
        { status: 'partial_outage' },
        { status: 'degraded' }
      ];
      
      const result = statusCalculator.calculateOverallStatus(services);
      
      expect(result).toEqual({
        status: 'partial_outage',
        message: '1 service is experiencing partial outages'
      });
    });

    it('should return degraded when no outages but degraded services exist', () => {
      const services = [
        { status: 'operational' },
        { status: 'degraded' },
        { status: 'operational' }
      ];
      
      const result = statusCalculator.calculateOverallStatus(services);
      
      expect(result).toEqual({
        status: 'degraded',
        message: '1 service is experiencing degraded performance'
      });
    });

    it('should return maintenance when only maintenance and operational services exist', () => {
      const services = [
        { status: 'operational' },
        { status: 'maintenance' },
        { status: 'operational' }
      ];
      
      const result = statusCalculator.calculateOverallStatus(services);
      
      expect(result).toEqual({
        status: 'maintenance',
        message: '1 service is under scheduled maintenance'
      });
    });

    it('should prioritize worse statuses correctly', () => {
      const services = [
        { status: 'maintenance' },
        { status: 'degraded' },
        { status: 'operational' }
      ];
      
      const result = statusCalculator.calculateOverallStatus(services);
      
      expect(result).toEqual({
        status: 'degraded',
        message: '1 service is experiencing degraded performance'
      });
    });
  });
});