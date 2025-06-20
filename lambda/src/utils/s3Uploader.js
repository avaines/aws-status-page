const { PutObjectCommand } = require('@aws-sdk/client-s3');

async function upload(s3Client, bucket, key, content, contentType) {
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

module.exports = {
  upload
};