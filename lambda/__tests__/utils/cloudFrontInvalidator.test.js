const AWS = require('aws-sdk');
const cloudFrontInvalidator = require('../../src/utils/cloudFrontInvalidator');

// Mock AWS SDK
jest.mock('aws-sdk');

describe('cloudFrontInvalidator', () => {
  let mockCloudFront;
  let mockCreateInvalidation;

  beforeEach(() => {
    mockCreateInvalidation = jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({})
    });
    
    mockCloudFront = {
      createInvalidation: mockCreateInvalidation
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('invalidate', () => {
    it('should create invalidation with correct parameters', async () => {
      const distributionId = 'E1234567890123';
      const mockTimestamp = 1640995200000;
      
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      await cloudFrontInvalidator.invalidate(mockCloudFront, distributionId);

      expect(mockCreateInvalidation).toHaveBeenCalledWith({
        DistributionId: distributionId,
        InvalidationBatch: {
          Paths: {
            Quantity: 2,
            Items: ['/index.html', '/rss.xml']
          },
          CallerReference: mockTimestamp.toString()
        }
      });

      expect(mockCreateInvalidation().promise).toHaveBeenCalled();
      
      jest.restoreAllMocks();
    });

    it('should skip invalidation when no distribution ID provided', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await cloudFrontInvalidator.invalidate(mockCloudFront, null);
      
      expect(mockCreateInvalidation).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('No CloudFront distribution ID provided, skipping invalidation');
      
      consoleSpy.mockRestore();
    });

    it('should skip invalidation when empty distribution ID provided', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await cloudFrontInvalidator.invalidate(mockCloudFront, '');
      
      expect(mockCreateInvalidation).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('No CloudFront distribution ID provided, skipping invalidation');
      
      consoleSpy.mockRestore();
    });

    it('should handle CloudFront invalidation errors gracefully', async () => {
      const error = new Error('CloudFront invalidation failed');
      mockCreateInvalidation.mockReturnValue({
        promise: jest.fn().mockRejectedValue(error)
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Should not throw, but handle error gracefully
      await cloudFrontInvalidator.invalidate(mockCloudFront, 'E1234567890123');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error invalidating CloudFront cache:', error);
      
      consoleErrorSpy.mockRestore();
    });

    it('should log successful invalidation', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await cloudFrontInvalidator.invalidate(mockCloudFront, 'E1234567890123');
      
      expect(consoleSpy).toHaveBeenCalledWith('CloudFront cache invalidated for both HTML and RSS');
      
      consoleSpy.mockRestore();
    });
  });
});