const { S3Client } = require('@aws-sdk/client-s3');
const { CloudWatchClient } = require('@aws-sdk/client-cloudwatch');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { SNSClient } = require('@aws-sdk/client-sns');
const { CloudFrontClient } = require('@aws-sdk/client-cloudfront');

const htmlProcessor = require('./processors/htmlProcessor');
const rssProcessor = require('./processors/rssProcessor');
const customResourceHandler = require('./handlers/customResourceHandler');
const alarmProcessor = require('./processors/alarmProcessor');
const statusCalculator = require('./utils/statusCalculator');
const s3Uploader = require('./utils/s3Uploader');
const cloudFrontInvalidator = require('./utils/cloudFrontInvalidator');
const dynamoDbStorage = require('./utils/dynamoDbStorage');
const snsNotifier = require('./utils/snsNotifier');

// Initialize AWS SDK v3 clients
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const cloudWatchClient = new CloudWatchClient({ region: process.env.AWS_REGION });
const dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDbDocClient = DynamoDBDocumentClient.from(dynamoDbClient);
const snsClient = new SNSClient({ region: process.env.AWS_REGION });
const cloudFrontClient = new CloudFrontClient({ region: process.env.AWS_REGION });

const STATUS_BUCKET = process.env.STATUS_BUCKET;
const STATUS_TABLE = process.env.STATUS_TABLE;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const CLOUDFRONT_DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID;
const SERVICE_NAME = process.env.SERVICE_NAME || 'My Service';
const SERVICE_URL = process.env.SERVICE_URL || 'https://example.com';
const DATA_RETENTION_DAYS = parseInt(process.env.DATA_RETENTION_DAYS) || 30;

exports.handler = async (event, context) => {
  console.log('Event received:', JSON.stringify(event, null, 2));

  try {
    // Handle CloudFormation custom resource events
    if (event.RequestType) {
      return await customResourceHandler.handle(event, {
        s3Client,
        cloudFrontClient,
        STATUS_BUCKET,
        CLOUDFRONT_DISTRIBUTION_ID,
        SERVICE_NAME,
        SERVICE_URL,
        DATA_RETENTION_DAYS
      });
    }

    // Get all CloudWatch alarms that have actions pointing to our Lambda function
    const alarms = await alarmProcessor.getAllRelevantAlarms(cloudWatchClient, process.env.AWS_LAMBDA_FUNCTION_NAME, SNS_TOPIC_ARN);
    console.log(`Found ${alarms.length} relevant CloudWatch alarms`);

    // Process alarms and create service status
    const services = await alarmProcessor.processAlarmsIntoServices(alarms);
    console.log(`Processed into ${services.length} services`);

    // Calculate overall status
    const overallStatus = statusCalculator.calculateOverallStatus(services);

    // Get recent incidents from DynamoDB
    const recentIncidents = await dynamoDbStorage.getRecentIncidents(dynamoDbDocClient, STATUS_TABLE);

    // Generate HTML page and RSS feed
    const html = htmlProcessor.generate(services, overallStatus, recentIncidents, {
      SERVICE_NAME,
      SERVICE_URL,
      DATA_RETENTION_DAYS,
      CLOUDFRONT_DISTRIBUTION_ID
    });

    const rssXml = rssProcessor.generate(recentIncidents, {
      SERVICE_NAME,
      DATA_RETENTION_DAYS,
      CLOUDFRONT_DISTRIBUTION_ID
    });

    // Upload both HTML and RSS to S3
    await Promise.all([
      s3Uploader.upload(s3Client, STATUS_BUCKET, 'index.html', html, 'text/html'),
      s3Uploader.upload(s3Client, STATUS_BUCKET, 'rss.xml', rssXml, 'application/rss+xml')
    ]);

    // Invalidate CloudFront cache
    await cloudFrontInvalidator.invalidate(cloudFrontClient, CLOUDFRONT_DISTRIBUTION_ID);

    // Store status in DynamoDB with TTL
    await dynamoDbStorage.storeStatusHistory(dynamoDbDocClient, STATUS_TABLE, services, overallStatus, DATA_RETENTION_DAYS);

    // Send notifications if status changed
    await snsNotifier.checkAndNotifyStatusChange(
      dynamoDbDocClient, 
      snsClient, 
      STATUS_TABLE, 
      SNS_TOPIC_ARN, 
      overallStatus, 
      SERVICE_NAME, 
      DATA_RETENTION_DAYS,
      CLOUDFRONT_DISTRIBUTION_ID
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Status page and RSS feed updated successfully',
        services: services.length,
        overallStatus: overallStatus.status,
        alarmsProcessed: alarms.length,
        dataRetentionDays: DATA_RETENTION_DAYS
      })
    };

  } catch (error) {
    console.error('Error updating status page:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error updating status page',
        error: error.message
      })
    };
  }
};