const { CloudFrontClient } = require('@aws-sdk/client-cloudfront');
const { CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
const cloudFrontInvalidator = require('../../src/utils/cloudFrontInvalidator');

// Mock the CloudFrontClient
jest.mock('@aws-sdk/client-cloudfront');

describe('cloudFrontInvalidator', () => {
  let mockCloudFrontClient;

  beforeEach(() => {
    mockCloudFrontClient = {
      send: jest.fn()
    };
  });

  describe('invalidate', () => {
    it('should create invalidation with correct parameters', async () => {
      mockCloudFrontClient.send.mockResolvedValue({
        Invalidation: { Id: 'test-invalidation-id' }
      });

      await cloudFrontInvalidator.invalidate(mockCloudFrontClient, 'test-distribution-id');

      expect(mockCloudFrontClient.send).toHaveBeenCalledWith(
        expect.any(CreateInvalidationCommand)
      );

      const command = mockCloudFrontClient.send.mock.calls[0][0];
      expect(command.input).toEqual({
        DistributionId: 'test-distribution-id',
        InvalidationBatch: {
          Paths: {
            Quantity: 2,
            Items: ['/index.html', '/rss.xml']
          },
          CallerReference: expect.any(String)
        }
      });
    });

    it('should skip invalidation when no distribution ID provided', async () => {
      await cloudFrontInvalidator.invalidate(mockCloudFrontClient, null);

      expect(mockCloudFrontClient.send).not.toHaveBeenCalled();
    });

    it('should handle CloudFront errors gracefully', async () => {
      const error = new Error('CloudFront error');
      mockCloudFrontClient.send.mockRejectedValue(error);

      // Should not throw, just log error
      await expect(
        cloudFrontInvalidator.invalidate(mockCloudFrontClient, 'test-distribution-id')
      ).resolves.toBeUndefined();

      expect(mockCloudFrontClient.send).toHaveBeenCalled();
    });
  });
});