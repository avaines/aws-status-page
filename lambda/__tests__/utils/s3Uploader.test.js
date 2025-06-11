const AWS = require('aws-sdk');
const s3Uploader = require('../../src/utils/s3Uploader');

// Mock AWS SDK
jest.mock('aws-sdk');

describe('s3Uploader', () => {
  let mockS3;
  let mockPutObject;

  beforeEach(() => {
    mockPutObject = jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({})
    });
    
    mockS3 = {
      putObject: mockPutObject
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('upload', () => {
    it('should upload HTML content with correct parameters', async () => {
      const bucket = 'test-bucket';
      const key = 'index.html';
      const content = '<html><body>Test</body></html>';
      const contentType = 'text/html';

      await s3Uploader.upload(mockS3, bucket, key, content, contentType);

      expect(mockPutObject).toHaveBeenCalledWith({
        Bucket: bucket,
        Key: key,
        Body: content,
        ContentType: contentType,
        CacheControl: 'max-age=300'
      });

      expect(mockPutObject().promise).toHaveBeenCalled();
    });

    it('should upload RSS content with longer cache control', async () => {
      const bucket = 'test-bucket';
      const key = 'rss.xml';
      const content = '<?xml version="1.0"?><rss></rss>';
      const contentType = 'application/rss+xml';

      await s3Uploader.upload(mockS3, bucket, key, content, contentType);

      expect(mockPutObject).toHaveBeenCalledWith({
        Bucket: bucket,
        Key: key,
        Body: content,
        ContentType: contentType,
        CacheControl: 'max-age=3600'
      });
    });

    it('should use longer cache control for non-HTML content', async () => {
      const bucket = 'test-bucket';
      const key = 'data.json';
      const content = '{"test": true}';
      const contentType = 'application/json';

      await s3Uploader.upload(mockS3, bucket, key, content, contentType);

      expect(mockPutObject).toHaveBeenCalledWith({
        Bucket: bucket,
        Key: key,
        Body: content,
        ContentType: contentType,
        CacheControl: 'max-age=3600'
      });
    });

    it('should handle S3 upload errors', async () => {
      const error = new Error('S3 upload failed');
      mockPutObject.mockReturnValue({
        promise: jest.fn().mockRejectedValue(error)
      });

      await expect(
        s3Uploader.upload(mockS3, 'bucket', 'key', 'content', 'text/plain')
      ).rejects.toThrow('S3 upload failed');
    });

    it('should log successful upload', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await s3Uploader.upload(mockS3, 'bucket', 'test.html', 'content', 'text/html');
      
      expect(consoleSpy).toHaveBeenCalledWith('test.html uploaded to S3');
      
      consoleSpy.mockRestore();
    });
  });
});