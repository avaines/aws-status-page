const iconUtils = require('../../src/utils/iconUtils');

describe('iconUtils', () => {
  describe('getStatusIcon', () => {
    it('should return operational icon for operational status', () => {
      const icon = iconUtils.getStatusIcon('operational');
      expect(icon).toContain('M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z');
    });

    it('should return warning icon for degraded status', () => {
      const icon = iconUtils.getStatusIcon('degraded');
      expect(icon).toContain('M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z');
    });

    it('should return warning icon for partial_outage status', () => {
      const icon = iconUtils.getStatusIcon('partial_outage');
      expect(icon).toContain('M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z');
    });

    it('should return error icon for major_outage status', () => {
      const icon = iconUtils.getStatusIcon('major_outage');
      expect(icon).toContain('M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z');
    });

    it('should return info icon for maintenance status', () => {
      const icon = iconUtils.getStatusIcon('maintenance');
      expect(icon).toContain('M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z');
    });

    it('should return operational icon for unknown status', () => {
      const icon = iconUtils.getStatusIcon('unknown_status');
      expect(icon).toContain('M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z');
    });
  });

  describe('getServiceIcon', () => {
    it('should return API icon for API Gateway service', () => {
      const icon = iconUtils.getServiceIcon('API Gateway');
      expect(icon).toContain('M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9');
    });

    it('should return lightning icon for Lambda Functions', () => {
      const icon = iconUtils.getServiceIcon('Lambda Functions');
      expect(icon).toContain('M13 10V3L4 14h7v7l9-11h-7z');
    });

    it('should return database icon for RDS Database', () => {
      const icon = iconUtils.getServiceIcon('RDS Database');
      expect(icon).toContain('M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4');
    });

    it('should return folder icon for S3 Storage', () => {
      const icon = iconUtils.getServiceIcon('S3 Storage');
      expect(icon).toContain('M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z');
    });

    it('should return bars icon for Load Balancer', () => {
      const icon = iconUtils.getServiceIcon('Application Load Balancer');
      expect(icon).toContain('M4 6h16M4 12h16M4 18h16');
    });

    it('should return cloud icon for CloudFront CDN', () => {
      const icon = iconUtils.getServiceIcon('CloudFront CDN');
      expect(icon).toContain('M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z');
    });

    it('should return table icon for DynamoDB', () => {
      const icon = iconUtils.getServiceIcon('DynamoDB');
      expect(icon).toContain('M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10');
    });

    it('should return default server icon for unknown service', () => {
      const icon = iconUtils.getServiceIcon('Unknown Service');
      expect(icon).toContain('M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2');
    });

    it('should be case insensitive', () => {
      const icon1 = iconUtils.getServiceIcon('api gateway');
      const icon2 = iconUtils.getServiceIcon('API GATEWAY');
      expect(icon1).toBe(icon2);
    });
  });
});