const xmlUtils = require('../utils/xmlUtils');

function generate(recentIncidents, config) {
  const { SERVICE_NAME, DATA_RETENTION_DAYS, CLOUDFRONT_DISTRIBUTION_ID } = config;
  const now = new Date().toUTCString();
  const statusPageUrl = `https://${CLOUDFRONT_DISTRIBUTION_ID ? `${CLOUDFRONT_DISTRIBUTION_ID}.cloudfront.net` : 'your-status-page.com'}`;

  const rssItems = recentIncidents.map(item => {
    const date = new Date(item.timestamp).toUTCString();
    const title = getStatusTitle(item);
    const description = getStatusDescription(item);

    return `
    <item>
      <title>${xmlUtils.escapeXml(title)}</title>
      <description>${xmlUtils.escapeXml(description)}</description>
      <pubDate>${date}</pubDate>
      <link>${statusPageUrl}</link>
      <guid isPermaLink="false">${item.serviceId}-${item.timestamp}</guid>
    </item>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xmlUtils.escapeXml(SERVICE_NAME)} - Status Updates</title>
    <description>Real-time status updates for ${xmlUtils.escapeXml(SERVICE_NAME)} (Data retained for ${DATA_RETENTION_DAYS} days)</description>
    <link>${statusPageUrl}</link>
    <lastBuildDate>${now}</lastBuildDate>
    <language>en-us</language>
    <generator>AWS Lambda Status Page</generator>
    <ttl>5</ttl>
    ${rssItems}
  </channel>
</rss>`;
}

function generateInitial(config) {
  const { SERVICE_NAME, CLOUDFRONT_DISTRIBUTION_ID } = config;
  const now = new Date().toUTCString();
  const statusPageUrl = `https://${CLOUDFRONT_DISTRIBUTION_ID ? `${CLOUDFRONT_DISTRIBUTION_ID}.cloudfront.net` : 'your-status-page.com'}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xmlUtils.escapeXml(SERVICE_NAME)} - Status Updates</title>
    <description>Real-time status updates for ${xmlUtils.escapeXml(SERVICE_NAME)}</description>
    <link>${statusPageUrl}</link>
    <lastBuildDate>${now}</lastBuildDate>
    <language>en-us</language>
    <generator>AWS Lambda Status Page</generator>
    <ttl>5</ttl>
    
    <item>
      <title>Status Page Deployed</title>
      <description>Your AWS status page has been successfully deployed and is ready to monitor your services. Configure CloudWatch alarms to start monitoring.</description>
      <pubDate>${now}</pubDate>
      <link>${statusPageUrl}</link>
      <guid isPermaLink="false">initial-deployment-${Date.now()}</guid>
    </item>
  </channel>
</rss>`;
}

function getStatusTitle(item) {
  const statusLabels = {
    operational: 'Operational',
    degraded: 'Degraded Performance',
    partial_outage: 'Partial Outage',
    major_outage: 'Major Outage',
    maintenance: 'Scheduled Maintenance'
  };

  const statusLabel = statusLabels[item.status] || item.status;

  if (item.serviceId === 'overall') {
    return `System Status: ${statusLabel}`;
  } else {
    return `${item.serviceId}: ${statusLabel}`;
  }
}

function getStatusDescription(item) {
  let description = item.message || '';

  if (item.description) {
    description += description ? ` - ${item.description}` : item.description;
  }

  if (!description) {
    if (item.serviceId === 'overall') {
      description = `Overall system status changed to ${item.status}`;
    } else {
      description = `Service ${item.serviceId} status changed to ${item.status}`;
    }
  }

  // Add TTL information if available
  if (item.ttl) {
    const expiryDate = new Date(item.ttl * 1000);
    description += ` (Data expires: ${expiryDate.toISOString()})`;
  }

  return description;
}

module.exports = {
  generate,
  generateInitial
};