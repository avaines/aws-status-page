const timeUtils = require('../../src/utils/timeUtils');

describe('timeUtils', () => {
  describe('formatTimestamp', () => {
    beforeEach(() => {
      // Mock Date.now() to return a consistent timestamp
      jest.spyOn(Date, 'now').mockReturnValue(1640995200000); // 2022-01-01 00:00:00 UTC
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return "Unknown" for null timestamp', () => {
      expect(timeUtils.formatTimestamp(null)).toBe('Unknown');
    });

    it('should return "Unknown" for undefined timestamp', () => {
      expect(timeUtils.formatTimestamp(undefined)).toBe('Unknown');
    });

    it('should return "Just now" for timestamps less than 1 minute ago', () => {
      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
      expect(timeUtils.formatTimestamp(thirtySecondsAgo)).toBe('Just now');
    });

    it('should return minutes for timestamps less than 1 hour ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      expect(timeUtils.formatTimestamp(fiveMinutesAgo)).toBe('5 minutes ago');
    });

    it('should return singular minute for 1 minute ago', () => {
      const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
      expect(timeUtils.formatTimestamp(oneMinuteAgo)).toBe('1 minute ago');
    });

    it('should return hours for timestamps less than 24 hours ago', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(timeUtils.formatTimestamp(threeHoursAgo)).toBe('3 hours ago');
    });

    it('should return singular hour for 1 hour ago', () => {
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
      expect(timeUtils.formatTimestamp(oneHourAgo)).toBe('1 hour ago');
    });

    it('should return days for timestamps more than 24 hours ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      expect(timeUtils.formatTimestamp(threeDaysAgo)).toBe('3 days ago');
    });

    it('should return singular day for 1 day ago', () => {
      const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      expect(timeUtils.formatTimestamp(oneDayAgo)).toBe('1 day ago');
    });

    it('should handle string timestamps', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(timeUtils.formatTimestamp(fiveMinutesAgo)).toBe('5 minutes ago');
    });
  });
});