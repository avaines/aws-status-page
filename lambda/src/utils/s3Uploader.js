async function upload(s3, bucket, key, content, contentType) {
  const params = {
    Bucket: bucket,
    Key: key,
    Body: content,
    ContentType: contentType,
    CacheControl: contentType === 'text/html' ? 'max-age=300' : 'max-age=3600'
  };

  await s3.putObject(params).promise();
  console.log(`${key} uploaded to S3`);
}

module.exports = {
  upload
};