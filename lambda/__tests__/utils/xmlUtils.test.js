const xmlUtils = require('../../src/utils/xmlUtils');

describe('xmlUtils', () => {
  describe('escapeXml', () => {
    it('should escape less than symbol', () => {
      expect(xmlUtils.escapeXml('value < 10')).toBe('value < 10');
    });

    it('should escape greater than symbol', () => {
      expect(xmlUtils.escapeXml('value > 10')).toBe('value > 10');
    });

    it('should escape ampersand', () => {
      expect(xmlUtils.escapeXml('Tom & Jerry')).toBe('Tom & Jerry');
    });

    it('should escape single quotes', () => {
      expect(xmlUtils.escapeXml("It's working")).toBe('It&apos;s working');
    });

    it('should escape double quotes', () => {
      expect(xmlUtils.escapeXml('He said "Hello"')).toBe('He said "Hello"');
    });

    it('should escape multiple special characters', () => {
      const input = 'Error: value < 10 & status = "failed"';
      const expected = 'Error: value < 10 & status = "failed"';
      expect(xmlUtils.escapeXml(input)).toBe(expected);
    });

    it('should handle empty string', () => {
      expect(xmlUtils.escapeXml('')).toBe('');
    });

    it('should handle string with no special characters', () => {
      const input = 'Normal text without special characters';
      expect(xmlUtils.escapeXml(input)).toBe(input);
    });

    it('should handle complex XML-like content', () => {
      const input = '<message>Error & "warning" in \'system\'</message>';
      const expected = '<message>Error & "warning" in &apos;system&apos;</message>';
      expect(xmlUtils.escapeXml(input)).toBe(expected);
    });
  });
});