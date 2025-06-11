const AWS = require('aws-sdk');
const https = require('https');

const s3 = new AWS.S3();
const cloudfront = new AWS.CloudFront();

exports.handler = async (event, context) => {
  console.log('Initial deployment triggered:', JSON.stringify(event, null, 2));

  try {
    const { BucketName, DistributionId } = event.ResourceProperties;

    if (event.RequestType === 'Create' || event.RequestType === 'Update') {
      // Create initial status page
      const html = generateInitialStatusPage();

      // Upload to S3
      await uploadToS3(BucketName, html);

      // Invalidate CloudFront cache if distribution exists
      if (DistributionId) {
        await invalidateCloudFront(DistributionId);
      }

      await sendResponse(event, context, 'SUCCESS', {
        Message: 'Initial status page deployed successfully'
      });

    } else if (event.RequestType === 'Delete') {
      // Clean up if needed
      await sendResponse(event, context, 'SUCCESS', {
        Message: 'Cleanup completed'
      });
    }

  } catch (error) {
    console.error('Error in initial deployment:', error);
    await sendResponse(event, context, 'FAILED', {
      Message: error.message
    });
  }
};

function generateInitialStatusPage() {
  const timestamp = new Date().toLocaleString();
  const serviceName = process.env.SERVICE_NAME || 'My Service';
  const serviceUrl = process.env.SERVICE_URL || 'https://example.com';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${serviceName} - Service Status</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16">
                <div class="flex items-center space-x-3">
                    <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                    </svg>
                    <h1 class="text-xl font-bold text-gray-900">${serviceName} Status</h1>
                </div>

                <nav class="flex items-center space-x-6">
                    <a href="/rss" class="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6.503 20.752c0 1.794-1.456 3.248-3.251 3.248-1.796 0-3.252-1.454-3.252-3.248 0-1.794 1.456-3.248 3.252-3.248 1.795.001 3.251 1.454 3.251 3.248zm-6.503-12.572v4.811c6.05.062 10.96 4.966 11.022 11.009h4.817c-.062-8.71-7.118-15.758-15.839-15.82zm0-3.368c10.58.046 19.152 8.594 19.183 19.188h4.817c-.03-13.231-10.755-23.954-24-24v4.812z"/>
                        </svg>
                        <span class="text-sm font-medium">RSS Feed</span>
                    </a>
                    <a href="/help" class="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span class="text-sm font-medium">Help</span>
                    </a>
                    <a href="${serviceUrl}" class="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors duration-200">
                        <span class="text-sm font-medium">Visit Service</span>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                        </svg>
                    </a>
                </nav>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Overall Status -->
        <div class="rounded-lg border border-green-200 bg-green-50 p-6 mb-8">
            <div class="flex items-center space-x-3">
                <svg class="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <div>
                    <h2 class="text-lg font-semibold text-green-600">
                        All Systems Operational
                    </h2>
                    <p class="text-gray-700 mt-1">Status page has been successfully deployed and is ready to monitor your services.</p>
                </div>
            </div>
        </div>

        <!-- Services Grid -->
        <div class="space-y-6">
            <h3 class="text-2xl font-bold text-gray-900">Service Status</h3>

            <div class="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
                <h4 class="text-lg font-semibold text-gray-900 mb-2">Waiting for Service Data</h4>
                <p class="text-gray-600 mb-4">
                    Your status page is ready! Services will appear here automatically when CloudWatch alarms are detected or when you send status updates via the webhook API.
                </p>
                <div class="text-sm text-gray-500">
                    <p>To manually update status, send a POST request to:</p>
                    <code class="bg-gray-100 px-2 py-1 rounded mt-1 inline-block">/webhook</code>
                </div>
            </div>
        </div>
    </main>

    <!-- Footer -->
    <footer class="bg-white border-t border-gray-200 mt-16">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div class="flex items-center justify-between">
                <p class="text-sm text-gray-600">
                    Last updated: ${timestamp}
                </p>
                <div class="flex items-center space-x-4">
                    <a href="/privacy" class="text-sm text-gray-600 hover:text-gray-900">
                        Privacy Policy
                    </a>
                    <a href="/terms" class="text-sm text-gray-600 hover:text-gray-900">
                        Terms of Service
                    </a>
                </div>
            </div>
        </div>
    </footer>
</body>
</html>`;
}

async function uploadToS3(bucketName, html) {
  const params = {
    Bucket: bucketName,
    Key: 'index.html',
    Body: html,
    ContentType: 'text/html',
    CacheControl: 'max-age=300'
  };

  await s3.putObject(params).promise();
  console.log('Initial status page uploaded to S3');
}

async function invalidateCloudFront(distributionId) {
  const params = {
    DistributionId: distributionId,
    InvalidationBatch: {
      Paths: {
        Quantity: 1,
        Items: ['/*']
      },
      CallerReference: Date.now().toString()
    }
  };

  try {
    await cloudfront.createInvalidation(params).promise();
    console.log('CloudFront cache invalidated');
  } catch (error) {
    console.error('Error invalidating CloudFront cache:', error);
  }
}

async function sendResponse(event, context, responseStatus, responseData) {
  const responseBody = JSON.stringify({
    Status: responseStatus,
    Reason: `See the details in CloudWatch Log Stream: ${context.logStreamName}`,
    PhysicalResourceId: context.logStreamName,
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
      console.log(`Status message: ${response.statusMessage}`);
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