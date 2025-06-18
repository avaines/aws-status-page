const { ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

  // Recursively removes undefined values from the object so that only defined values exit to stored in Dynamo.
  function removeUndefinedValues(obj) {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedValues);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = removeUndefinedValues(value);
      }
      return acc;
    }, {});
  }
  return obj;
}

async function getRecentIncidents(dynamoDbDocClient, statusTable) {
  try {
    const command = new ScanCommand({
      TableName: statusTable,
      Limit: 10
    });

    const result = await dynamoDbDocClient.send(command);
    return (result.Items || []).sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error fetching recent incidents:', error);
    return [];
  }
}

async function storeStatusHistory(dynamoDbDocClient, statusTable, services, overallStatus, dataRetentionDays) {
  const timestamp = Date.now();
  const ttlTimestamp = Math.floor(timestamp / 1000) + (dataRetentionDays * 24 * 60 * 60);

  const item = {
    serviceId: 'overall',
    timestamp: timestamp,
    status: overallStatus.status,
    message: overallStatus.message,
    services: services,
    ttl: ttlTimestamp,
    dataRetentionDays: dataRetentionDays
  };

  const cleanedItem = removeUndefinedValues(item);

  const command = new PutCommand({
    TableName: statusTable,
    Item: cleanedItem
  });

  try {
    await dynamoDbDocClient.send(command);
    console.log(`Status history stored in DynamoDB with TTL: ${new Date(ttlTimestamp * 1000).toISOString()}`);
  } catch (error) {
    console.error('Error storing status history:', error, JSON.stringify(cleanedItem, null, 2));
  }
}

module.exports = {
  getRecentIncidents,
  storeStatusHistory
};
