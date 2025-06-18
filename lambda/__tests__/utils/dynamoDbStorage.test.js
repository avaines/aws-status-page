const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const dynamoDbStorage = require('../../src/utils/dynamoDbStorage');

// Mock the DynamoDB Document Client
jest.mock('@aws-sdk/lib-dynamodb');

describe('dynamoDbStorage', () => {
  let mockDynamoDbDocClient;

  beforeEach(() => {
    mockDynamoDbDocClient = {
      send: jest.fn()
    };
  });

  describe('getRecentIncidents', () => {
    it('should fetch and sort recent incidents', async () => {
      const mockItems = [
        { serviceId: 'service1', timestamp: 1000, status: 'operational' },
        { serviceId: 'service2', timestamp: 2000, status: 'degraded' },
        { serviceId: 'service3', timestamp: 1500, status: 'operational' }
      ];

      mockDynamoDbDocClient.send.mockResolvedValue({
        Items: mockItems
      });

      const result = await dynamoDbStorage.getRecentIncidents(mockDynamoDbDocClient, 'test-table');

      expect(mockDynamoDbDocClient.send).toHaveBeenCalledWith(
        expect.any(ScanCommand)
      );

      const command = mockDynamoDbDocClient.send.mock.calls[0][0];
      expect(command.input).toEqual({
        TableName: 'test-table',
        Limit: 10
      });

      // Should be sorted by timestamp descending
      expect(result).toEqual([
        { serviceId: 'service2', timestamp: 2000, status: 'degraded' },
        { serviceId: 'service3', timestamp: 1500, status: 'operational' },
        { serviceId: 'service1', timestamp: 1000, status: 'operational' }
      ]);
    });

    it('should handle DynamoDB errors', async () => {
      mockDynamoDbDocClient.send.mockRejectedValue(new Error('DynamoDB error'));

      const result = await dynamoDbStorage.getRecentIncidents(mockDynamoDbDocClient, 'test-table');

      expect(result).toEqual([]);
    });
  });

  describe('storeStatusHistory', () => {
    it('should store status history with TTL', async () => {
      mockDynamoDbDocClient.send.mockResolvedValue({});

      const services = [{ id: 'test-service', status: 'operational' }];
      const overallStatus = { status: 'operational', message: 'All good' };
      const dataRetentionDays = 30;

      // Mock Date.now() for consistent testing
      const mockTimestamp = 1640995200000; // 2022-01-01T00:00:00Z
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      await dynamoDbStorage.storeStatusHistory(
        mockDynamoDbDocClient,
        'test-table',
        services,
        overallStatus,
        dataRetentionDays
      );

      expect(mockDynamoDbDocClient.send).toHaveBeenCalledWith(
        expect.any(PutCommand)
      );

      const command = mockDynamoDbDocClient.send.mock.calls[0][0];
      expect(command.input).toEqual({
        TableName: 'test-table',
        Item: {
          serviceId: 'overall',
          timestamp: mockTimestamp,
          status: 'operational',
          message: 'All good',
          services: services,
          ttl: Math.floor(mockTimestamp / 1000) + (30 * 24 * 60 * 60),
          dataRetentionDays: 30
        }
      });

      Date.now.mockRestore();
    });

    it('should handle storage errors gracefully', async () => {
      mockDynamoDbDocClient.send.mockRejectedValue(new Error('Storage error'));

      // Should not throw, just log error
      await expect(
        dynamoDbStorage.storeStatusHistory(
          mockDynamoDbDocClient,
          'test-table',
          [],
          { status: 'operational', message: 'test' },
          30
        )
      ).resolves.toBeUndefined();
    });
  });
});