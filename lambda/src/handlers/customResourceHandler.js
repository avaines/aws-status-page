const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
const htmlProcessor = require('../processors/htmlProcessor');
const rssProcessor = require('../processors/rssProcessor');

async function handle(event, dependencies) {
  const { s3Client, cloudFrontClient, STATUS_BUCKET, CLOUDFRONT_DISTRIBUTION_ID, SERVICE_NAME, SERVICE_URL, DATA_RETENTION_DAYS } = dependencies;
  
  console.log('Handling CloudFormation custom resource event');
  
  if (event.RequestType === 'Create' || event.RequestType === 'Update') {
    // Create initial status page using template
    const html = htmlProcessor.generateInitial(SERVICE_NAME, SERVICE_URL, DATA_RETENTION_DAYS, CLOUDFRONT_DISTRIBUTION_ID);
    const rssXml = rssProcessor.generateInitial({
      SERVICE_NAME,
      CLOUDFRONT_DISTRIBUTION_ID
    });

    // Upload both HTML and RSS to S3
    await Promise.all([
      uploadToS3(s3Client, STATUS_BUCKET, 'index.html', html, 'text/html'),
      uploadToS3(s3Client, STATUS_BUCKET, 'rss.xml', rssXml, 'application/rss+xml')
    ]);

    // Invalidate CloudFront cache if distribution exists
    if (CLOUDFRONT_DISTRIBUTION_ID) {
      await invalidateCloudFront(cloudFrontClient, CLOUDFRONT_DISTRIBUTION_ID);
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

async function uploadToS3(s3Client, bucket, key, content, contentType) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: content,
    ContentType: contentType,
    CacheControl: contentType === 'text/html' ? 'max-age=300' : 'max-age=3600'
  });

  await s3Client.send(command);
  console.log(`${key} uploaded to S3`);
}

async function invalidateCloudFront(cloudFrontClient, distributionId) {
  const command = new CreateInvalidationCommand({
    DistributionId: distributionId,
    InvalidationBatch: {
      Paths: {
        Quantity: 2,
        Items: ['/index.html', '/rss.xml']
      },
      CallerReference: Date.now().toString()
    }
  });

  try {
    await cloudFrontClient.send(command);
    console.log('CloudFront cache invalidated for both HTML and RSS');
  } catch (error) {
    console.error('Error invalidating CloudFront cache:', error);
  }
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