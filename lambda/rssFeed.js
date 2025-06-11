const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient();

const STATUS_TABLE = process.env.STATUS_TABLE;
const SERVICE_NAME = process.env.SERVICE_NAME || 'My Service';
const SERVICE_URL = process.env.SERVICE_URL || 'https://example.com';
const DATA_RETENTION_DAYS = parseInt(process.env.DATA_RETENTION_DAYS) || 30;

exports.handler = async (event) => {
  console.log('RSS feed request received');
  
  try {
    // Get recent status updates from DynamoDB
    const params = {
      TableName: STATUS_TABLE,
      ScanIndexForward: false,
      Limit: 50
    };
    
    const result = await dynamodb.scan(params).promise();
    const items = result.Items || [];
    
    // Sort by timestamp descending and filter out expired items
    const now = Math.floor(Date.now() / 1000);
    const validItems = items
      .filter(item => !item.ttl || item.ttl > now)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    // Generate RSS XML
    const rssXml = generateRSSFeed(validItems);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/rss+xml',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'max-age=300'
      },
      body: rssXml
    };
    
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Error generating RSS feed',
        message: error.message
      })
    };
  }
};

function generateRSSFeed(items) {
  const now = new Date().toUTCString();
  
  const rssItems = items.map(item => {
    const date = new Date(item.timestamp).toUTCString();
    const title = getStatusTitle(item);
    const description = getStatusDescription(item);
    
    return `
    <item>
      <title>${escapeXml(title)}</title>
      <description>${escapeXml(description)}</description>
      <pubDate>${date}</pubDate>
      <guid isPermaLink="false">${item.serviceId}-${item.timestamp}</guid>
    </item>`;
  }).join('');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(SERVICE_NAME)} - Status Updates</title>
    <description>Real-time status updates for ${escapeXml(SERVICE_NAME)} (Data retained for ${DATA_RETENTION_DAYS} days)</description>
    <link>${escapeXml(SERVICE_URL)}</link>
    <lastBuildDate>${now}</lastBuildDate>
    <language>en-us</language>
    <generator>AWS Lambda Status Page</generator>
    <ttl>5</ttl>
    ${rssItems}
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

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}