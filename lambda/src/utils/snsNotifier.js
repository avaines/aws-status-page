const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { PublishCommand } = require('@aws-sdk/client-sns');
const statusConfig = require('../config/statusConfig');

async function checkAndNotifyStatusChange(dynamoDbDocClient, snsClient, statusTable, snsTopicArn, currentStatus, serviceName, dataRetentionDays, cloudFrontDistributionId) {
  try {
    const command = new QueryCommand({
      TableName: statusTable,
      KeyConditionExpression: 'serviceId = :serviceId',
      ExpressionAttributeValues: {
        ':serviceId': 'overall'
      },
      ScanIndexForward: false,
      Limit: 2
    });

    const result = await dynamoDbDocClient.send(command);

    if (result.Items && result.Items.length >= 2) {
      const lastStatus = result.Items[1].status;

      if (lastStatus !== currentStatus.status) {
        await sendStatusChangeNotification(snsClient, snsTopicArn, lastStatus, currentStatus, serviceName, dataRetentionDays, cloudFrontDistributionId);
      }
    }
  } catch (error) {
    console.error('Error checking status change:', error);
  }
}

async function sendStatusChangeNotification(snsClient, snsTopicArn, oldStatus, newStatus, serviceName, dataRetentionDays, cloudFrontDistributionId) {
  const message = `${serviceName} Status Change Alert

Previous Status: ${statusConfig.STATUS_CONFIG[oldStatus]?.label || oldStatus}
Current Status: ${statusConfig.STATUS_CONFIG[newStatus.status]?.label || newStatus.status}

Message: ${newStatus.message}

Time: ${new Date().toISOString()}
Data Retention: ${dataRetentionDays} days

View status page: https://${cloudFrontDistributionId ? `${cloudFrontDistributionId}.cloudfront.net` : 'example-status-page.com'}`;

  const command = new PublishCommand({
    TopicArn: snsTopicArn,
    Subject: `${serviceName} - Status Changed to ${statusConfig.STATUS_CONFIG[newStatus.status]?.label || newStatus.status}`,
    Message: message
  });

  try {
    await snsClient.send(command);
    console.log('Status change notification sent');
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

module.exports = {
  checkAndNotifyStatusChange
};