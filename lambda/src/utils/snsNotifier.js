const statusConfig = require('../config/statusConfig');

async function checkAndNotifyStatusChange(dynamodb, sns, statusTable, snsTopicArn, currentStatus, serviceName, dataRetentionDays, cloudFrontDistributionId) {
  try {
    const params = {
      TableName: statusTable,
      KeyConditionExpression: 'serviceId = :serviceId',
      ExpressionAttributeValues: {
        ':serviceId': 'overall'
      },
      ScanIndexForward: false,
      Limit: 2
    };

    const result = await dynamodb.query(params).promise();

    if (result.Items && result.Items.length >= 2) {
      const lastStatus = result.Items[1].status;

      if (lastStatus !== currentStatus.status) {
        await sendStatusChangeNotification(sns, snsTopicArn, lastStatus, currentStatus, serviceName, dataRetentionDays, cloudFrontDistributionId);
      }
    }
  } catch (error) {
    console.error('Error checking status change:', error);
  }
}

async function sendStatusChangeNotification(sns, snsTopicArn, oldStatus, newStatus, serviceName, dataRetentionDays, cloudFrontDistributionId) {
  const message = `${serviceName} Status Change Alert

Previous Status: ${statusConfig.STATUS_CONFIG[oldStatus]?.label || oldStatus}
Current Status: ${statusConfig.STATUS_CONFIG[newStatus.status]?.label || newStatus.status}

Message: ${newStatus.message}

Time: ${new Date().toISOString()}
Data Retention: ${dataRetentionDays} days

View status page: https://${cloudFrontDistributionId ? `${cloudFrontDistributionId}.cloudfront.net` : 'your-status-page.com'}`;

  const params = {
    TopicArn: snsTopicArn,
    Subject: `${serviceName} - Status Changed to ${statusConfig.STATUS_CONFIG[newStatus.status]?.label || newStatus.status}`,
    Message: message
  };

  try {
    await sns.publish(params).promise();
    console.log('Status change notification sent');
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

module.exports = {
  checkAndNotifyStatusChange
};