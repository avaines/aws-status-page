const { S3Client } = require('@aws-sdk/client-s3');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3Uploader = require('../../src/utils/s3Uploader');

// Mock the S3Client
jest.mock('@aws-sdk/client-s3');

describe('s3Uploader', () => {
  let mockS3Client;

  beforeEach(() => {
    mockS3Client = {
      send: jest.fn()
    };
  });

  describe('upload', () => {
    it('should upload content to S3 with correct parameters', async () => {
      mockS3Client.send.mockResolvedValue({});

      await s3Uploader.upload(
        mockS3Client,
        'test-bucket',
        'test-key.html',
        '<html>Test Content</html>',
        'text/html'
      );

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(PutObjectCommand)
      );

      const command = mockS3Client.send.mock.calls[0][0];
      expect(command.input).toEqual({
        Bucket: 'test-bucket',
        Key: 'test-key.html',
        Body: '<html>Test Content</html>',
        ContentType: 'text/html',
        CacheControl: 'max-age=300'
      });
    });

    it('should set different cache control for non-HTML files', async () => {
      mockS3Client.send.mockResolvedValue({});

      await s3Uploader.upload(
        mockS3Client,
        'test-bucket',
        'feed.xml',
        '<rss>Test RSS</rss>',
        'application/rss+xml'
      );

      const command = mockS3Client.send.mock.calls[0][0];
      expect(command.input.CacheControl).toBe('max-age=3600');
    });

    it('should handle S3 upload errors', async () => {
      const error = new Error('S3 upload failed');
      mockS3Client.send.mockRejectedValue(error);

      await expect(
        s3Uploader.upload(
          mockS3Client,
          'test-bucket',
          'test-key.html',
          '<html>Test</html>',
          'text/html'
        )
      ).rejects.toThrow('S3 upload failed');
    });
  });
});