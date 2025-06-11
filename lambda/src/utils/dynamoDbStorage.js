async function getRecentIncidents(dynamodb, statusTable) {
  try {
    const params = {
      TableName: statusTable,
      ScanIndexForward: false,
      Limit: 10
    };

    const result = await dynamodb.scan(params).promise();
    return (result.Items || []).sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error fetching recent incidents:', error);
    return [];
  }
}

async function storeStatusHistory(dynamodb, statusTable, services, overallStatus, dataRetentionDays) {
  const timestamp = Date.now();
  const ttlTimestamp = Math.floor(timestamp / 1000) + (dataRetentionDays * 24 * 60 * 60);

  const params = {
    TableName: statusTable,
    Item: {
      serviceId: 'overall',
      timestamp: timestamp,
      status: overallStatus.status,
      message: overallStatus.message,
      services: services,
      ttl: ttlTimestamp,
      dataRetentionDays: dataRetentionDays
    }
  };

  try {
    await dynamodb.put(params).promise();
    console.log(`Status history stored in DynamoDB with TTL: ${new Date(ttlTimestamp * 1000).toISOString()}`);
  } catch (error) {
    console.error('Error storing status history:', error);
  }
}

module.exports = {
  getRecentIncidents,
  storeStatusHistory
};