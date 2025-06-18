const TemplateEngine = require('../utils/templateEngine');
const rssTemplate = require('../templates/rssTemplate');
const s3Uploader = require('../utils/s3Uploader');
const cloudFrontInvalidator = require('../utils/cloudFrontInvalidator');

const templateEngine = new TemplateEngine();

async function handle(event, dependencies) {
  const { s3, cloudfront, STATUS_BUCKET, CLOUDFRONT_DISTRIBUTION_ID, SERVICE_NAME, SERVICE_URL, DATA_RETENTION_DAYS } = dependencies;
  
  console.log('Handling CloudFormation custom resource event');
  
  if (event.RequestType === 'Create' || event.RequestType === 'Update') {
    // Create initial status page using template
    const timestamp = new Date().toLocaleString();
    const rssUrl = `https://${CLOUDFRONT_DISTRIBUTION_ID ? `${CLOUDFRONT_DISTRIBUTION_ID}.cloudfront.net` : 'your-status-page.com'}/rss.xml`;

    const templateVariables = {
      serviceName: SERVICE_NAME,
      serviceUrl: SERVICE_URL,
      rssUrl: rssUrl,
      timestamp: timestamp,
      dataRetentionDays: DATA_RETENTION_DAYS,
      lambdaFunctionArn: process.env.AWS_LAMBDA_FUNCTION_NAME ? 
        `arn:aws:lambda:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID || 'YOUR_ACCOUNT'}:function:${process.env.AWS_LAMBDA_FUNCTION_NAME}` : 
        'Function ARN will appear here after deployment'
    };

    const html = templateEngine.render('initial-status-page', templateVariables);
    const rssXml = rssTemplate.generateInitial({
      SERVICE_NAME,
      CLOUDFRONT_DISTRIBUTION_ID
    });

    // Upload both HTML and RSS to S3
    await Promise.all([
      s3Uploader.upload(s3, STATUS_BUCKET, 'index.html', html, 'text/html'),
      s3Uploader.upload(s3, STATUS_BUCKET, 'rss.xml', rssXml, 'application/rss+xml')
    ]);

    // Invalidate CloudFront cache if distribution exists
    if (CLOUDFRONT_DISTRIBUTION_ID) {
      await cloudFrontInvalidator.invalidate(cloudfront, CLOUDFRONT_DISTRIBUTION_ID);
    }

    await sendCustomResourceResponse(event, 'SUCCESS', {
      Message: 'Initial status page and RSS feed deployed successfully'
    });
  } else if (event.RequestType === 'Delete') {
    // Clean up if needed
    await sendCustomResourceResponse(event, 'SUCCESS', {
      Message: 'Cleanup completed'
    });
  }

  return { statusCode: 200 };
}

async function sendCustomResourceResponse(event, responseStatus, responseData) {
  const https = require('https');
  
  const responseBody = JSON.stringify({
    Status: responseStatus,
    Reason: `See the details in CloudWatch Log Stream`,
    PhysicalResourceId: `status-page-${Date.now()}`,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: responseData
  });

  const parsedUrl = new URL(event.ResponseURL);
  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'PUT',
    headers: {
      'content-type': '',
      'content-length': responseBody.length
    }
  };

  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      console.log(`Status code: ${response.statusCode}`);
      resolve();
    });

    request.on('error', (error) => {
      console.log(`sendResponse Error: ${error}`);
      reject(error);
    });

    request.write(responseBody);
    request.end();
  });
}

module.exports = {
  handle
};