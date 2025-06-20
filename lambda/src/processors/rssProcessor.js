const TemplateEngine = require('../utils/templateEngine');
const xmlUtils = require('../utils/xmlUtils');

const templateEngine = new TemplateEngine();

function generate(recentIncidents, config) {
  const { SERVICE_NAME, DATA_RETENTION_DAYS, CLOUDFRONT_DISTRIBUTION_ID } = config;
  const now = new Date().toUTCString();
  const statusPageUrl = `https://${CLOUDFRONT_DISTRIBUTION_ID ? `${CLOUDFRONT_DISTRIBUTION_ID}.cloudfront.net` : 'example-status-page.com'}`;

  // Prepare incidents data for template
  const incidents = recentIncidents.map(item => {
    const date = new Date(item.timestamp).toUTCString();
    const title = getStatusTitle(item);
    const description = getStatusDescription(item);

    return {
      title: xmlUtils.escapeXml(title),
      description: xmlUtils.escapeXml(description),
      pubDate: date,
      guid: `${item.serviceId}-${item.timestamp}`
    };
  });

  const templateVariables = {
    serviceName: xmlUtils.escapeXml(SERVICE_NAME),
    dataRetentionDays: DATA_RETENTION_DAYS,
    statusPageUrl: statusPageUrl,
    lastBuildDate: now,
    isInitialDeploy: false,
    incidents: incidents
  };

  return templateEngine.render('rss-feed', templateVariables);
}

function generateInitial(config) {
  const { SERVICE_NAME, CLOUDFRONT_DISTRIBUTION_ID } = config;
  const now = new Date().toUTCString();
  const statusPageUrl = `https://${CLOUDFRONT_DISTRIBUTION_ID ? `${CLOUDFRONT_DISTRIBUTION_ID}.cloudfront.net` : 'example-status-page.com'}`;

  const templateVariables = {
    serviceName: xmlUtils.escapeXml(SERVICE_NAME),
    statusPageUrl: statusPageUrl,
    lastBuildDate: now,
    isInitialDeploy: true,
    deploymentTimestamp: Date.now(),
    incidents: []
  };

  return templateEngine.render('rss-feed', templateVariables);
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