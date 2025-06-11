async function invalidate(cloudfront, distributionId) {
  if (!distributionId) {
    console.log('No CloudFront distribution ID provided, skipping invalidation');
    return;
  }

  const params = {
    DistributionId: distributionId,
    InvalidationBatch: {
      Paths: {
        Quantity: 2,
        Items: ['/index.html', '/rss.xml']
      },
      CallerReference: Date.now().toString()
    }
  };

  try {
    await cloudfront.createInvalidation(params).promise();
    console.log('CloudFront cache invalidated for both HTML and RSS');
  } catch (error) {
    console.error('Error invalidating CloudFront cache:', error);
  }
}

module.exports = {
  invalidate
};