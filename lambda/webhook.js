const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();

const STATUS_TABLE = process.env.STATUS_TABLE;
const DATA_RETENTION_DAYS = parseInt(process.env.DATA_RETENTION_DAYS) || 30;

exports.handler = async (event) => {
  console.log('Webhook event received:', JSON.stringify(event, null, 2));
  
  try {
    const body = JSON.parse(event.body || '{}');
    
    // Validate webhook payload
    if (!body.serviceId || !body.status) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Missing required fields: serviceId, status'
        })
      };
    }
    
    // Store the status update with TTL
    const timestamp = Date.now();
    const ttlTimestamp = Math.floor(timestamp / 1000) + (DATA_RETENTION_DAYS * 24 * 60 * 60);
    
    const params = {
      TableName: STATUS_TABLE,
      Item: {
        serviceId: body.serviceId,
        timestamp: timestamp,
        status: body.status,
        message: body.message || '',
        description: body.description || '',
        ttl: ttlTimestamp,
        dataRetentionDays: DATA_RETENTION_DAYS,
        source: 'webhook'
      }
    };
    
    await dynamodb.put(params).promise();
    console.log(`Status update stored with TTL: ${new Date(ttlTimestamp * 1000).toISOString()}`);
    
    // Trigger status page regeneration
    const lambdaParams = {
      FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME.replace('-webhook', '-status-generator'),
      InvocationType: 'Event',
      Payload: JSON.stringify({
        source: 'webhook',
        serviceId: body.serviceId,
        status: body.status
      })
    };
    
    await lambda.invoke(lambdaParams).promise();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Status update received and processed',
        serviceId: body.serviceId,
        status: body.status,
        timestamp: timestamp,
        ttl: new Date(ttlTimestamp * 1000).toISOString(),
        dataRetentionDays: DATA_RETENTION_DAYS
      })
    };
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};