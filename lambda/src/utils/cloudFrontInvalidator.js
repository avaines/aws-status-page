const { CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');

async function invalidate(cloudFrontClient, distributionId) {
  if (!distributionId) {
    console.log('No CloudFront distribution ID provided, skipping invalidation');
    return;
  }

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

module.exports = {
  invalidate
};