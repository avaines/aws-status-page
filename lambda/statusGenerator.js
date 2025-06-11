const AWS = require('aws-sdk');

const s3 = new AWS.S3();
const cloudwatch = new AWS.CloudWatch();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();
const cloudfront = new AWS.CloudFront();

const STATUS_BUCKET = process.env.STATUS_BUCKET;
const STATUS_TABLE = process.env.STATUS_TABLE;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const CLOUDFRONT_DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID;
const SERVICE_NAME = process.env.SERVICE_NAME || 'My Service';
const SERVICE_URL = process.env.SERVICE_URL || 'https://example.com';
const DATA_RETENTION_DAYS = parseInt(process.env.DATA_RETENTION_DAYS) || 30;

// Status mapping from CloudWatch alarm states
const STATUS_MAPPING = {
  'OK': 'operational',
  'ALARM': 'major_outage',
  'INSUFFICIENT_DATA': 'degraded'
};

const STATUS_CONFIG = {
  operational: {
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    label: 'Operational'
  },
  degraded: {
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    label: 'Degraded Performance'
  },
  partial_outage: {
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    label: 'Partial Outage'
  },
  major_outage: {
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'Major Outage'
  },
  maintenance: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    label: 'Scheduled Maintenance'
  }
};

exports.handler = async (event) => {
  console.log('Event received:', JSON.stringify(event, null, 2));

  try {
    // Get all CloudWatch alarms that have actions pointing to our Lambda function
    const alarms = await getAllRelevantAlarms();
    console.log(`Found ${alarms.length} relevant CloudWatch alarms`);

    // Process alarms and create service status
    const services = await processAlarmsIntoServices(alarms);
    console.log(`Processed into ${services.length} services`);

    // Calculate overall status
    const overallStatus = calculateOverallStatus(services);

    // Get recent incidents from DynamoDB
    const recentIncidents = await getRecentIncidents();

    // Generate HTML page
    const html = generateStatusPage(services, overallStatus, recentIncidents);

    // Upload to S3
    await uploadToS3(html);

    // Invalidate CloudFront cache
    await invalidateCloudFront();

    // Store status in DynamoDB with TTL
    await storeStatusHistory(services, overallStatus);

    // Send notifications if status changed
    await checkAndNotifyStatusChange(overallStatus);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Status page updated successfully',
        services: services.length,
        overallStatus: overallStatus.status,
        alarmsProcessed: alarms.length,
        dataRetentionDays: DATA_RETENTION_DAYS
      })
    };

  } catch (error) {
    console.error('Error updating status page:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error updating status page',
        error: error.message
      })
    };
  }
};

async function getAllRelevantAlarms() {
  const allAlarms = [];
  let nextToken = null;

  do {
    const params = {
      MaxRecords: 100,
      ...(nextToken && { NextToken: nextToken })
    };

    try {
      const result = await cloudwatch.describeAlarms(params).promise();

      // Filter alarms that have our Lambda function as an action
      const relevantAlarms = result.MetricAlarms.filter(alarm => {
        return alarm.AlarmActions && alarm.AlarmActions.some(action =>
          action.includes(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
          action.includes('status-generator') ||
          // Also include alarms with SNS topics that might trigger our function
          action.includes(SNS_TOPIC_ARN)
        );
      });

      allAlarms.push(...relevantAlarms);
      nextToken = result.NextToken;

    } catch (error) {
      console.error('Error fetching CloudWatch alarms:', error);
      break;
    }
  } while (nextToken);

  // If no alarms found with our function as action, get all alarms for demo purposes
  // In production, you should configure alarms to have your Lambda function as an action
  if (allAlarms.length === 0) {
    console.log('No alarms found with Lambda function as action, fetching all alarms for demo');
    try {
      const result = await cloudwatch.describeAlarms({ MaxRecords: 50 }).promise();
      return result.MetricAlarms || [];
    } catch (error) {
      console.error('Error fetching all alarms:', error);
      return [];
    }
  }

  return allAlarms;
}

async function processAlarmsIntoServices(alarms) {
  const serviceMap = new Map();

  for (const alarm of alarms) {
    const serviceName = extractServiceNameFromAlarm(alarm);
    const serviceId = serviceName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const status = STATUS_MAPPING[alarm.StateValue] || 'degraded';

    if (!serviceMap.has(serviceId)) {
      serviceMap.set(serviceId, {
        id: serviceId,
        name: serviceName,
        description: generateServiceDescription(alarm),
        status: status,
        lastUpdated: formatTimestamp(alarm.StateUpdatedTimestamp),
        alarms: [],
        worstStatus: status
      });
    }

    const service = serviceMap.get(serviceId);
    service.alarms.push({
      name: alarm.AlarmName,
      description: alarm.AlarmDescription,
      state: alarm.StateValue,
      reason: alarm.StateReason,
      timestamp: alarm.StateUpdatedTimestamp
    });

    // Update service status to worst case among all its alarms
    const statusPriority = {
      'major_outage': 4,
      'partial_outage': 3,
      'degraded': 2,
      'maintenance': 1,
      'operational': 0
    };

    if (statusPriority[status] > statusPriority[service.status]) {
      service.status = status;
    }
  }

  return Array.from(serviceMap.values());
}

function extractServiceNameFromAlarm(alarm) {
  // Try to extract service name from alarm name using common patterns
  const alarmName = alarm.AlarmName;

  // Pattern 1: ServiceName-MetricName (e.g., "UserAPI-HighErrorRate")
  if (alarmName.includes('-')) {
    const parts = alarmName.split('-');
    if (parts.length >= 2) {
      return parts[0].replace(/([A-Z])/g, ' $1').trim();
    }
  }

  // Pattern 2: Extract from namespace or dimensions
  if (alarm.Namespace) {
    // AWS/ApplicationELB -> Application Load Balancer
    // AWS/Lambda -> Lambda Functions
    // AWS/RDS -> RDS Database
    const namespaceMap = {
      'AWS/ApplicationELB': 'Load Balancer',
      'AWS/NetworkELB': 'Network Load Balancer',
      'AWS/Lambda': 'Lambda Functions',
      'AWS/RDS': 'RDS Database',
      'AWS/DynamoDB': 'DynamoDB',
      'AWS/S3': 'S3 Storage',
      'AWS/CloudFront': 'CloudFront CDN',
      'AWS/ApiGateway': 'API Gateway',
      'AWS/ECS': 'ECS Services',
      'AWS/EC2': 'EC2 Instances',
      'AWS/ElastiCache': 'ElastiCache',
      'AWS/Elasticsearch': 'Elasticsearch',
      'AWS/SQS': 'SQS Queues',
      'AWS/SNS': 'SNS Topics'
    };

    if (namespaceMap[alarm.Namespace]) {
      // Try to get more specific name from dimensions
      if (alarm.Dimensions && alarm.Dimensions.length > 0) {
        const dimension = alarm.Dimensions[0];
        if (dimension.Name === 'FunctionName' || dimension.Name === 'LoadBalancer' ||
            dimension.Name === 'DBInstanceIdentifier' || dimension.Name === 'TableName') {
          return `${namespaceMap[alarm.Namespace]} (${dimension.Value})`;
        }
      }
      return namespaceMap[alarm.Namespace];
    }
  }

  // Pattern 3: Use alarm name as-is but clean it up
  return alarmName
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function generateServiceDescription(alarm) {
  if (alarm.AlarmDescription) {
    return alarm.AlarmDescription;
  }

  // Generate description based on metric and namespace
  const metric = alarm.MetricName;
  const namespace = alarm.Namespace;

  if (namespace === 'AWS/Lambda' && metric === 'Errors') {
    return 'Monitoring Lambda function error rates';
  } else if (namespace === 'AWS/ApplicationELB' && metric === 'HTTPCode_Target_5XX_Count') {
    return 'Monitoring application server errors';
  } else if (namespace === 'AWS/RDS' && metric === 'DatabaseConnections') {
    return 'Monitoring database connection health';
  } else if (namespace === 'AWS/ApiGateway' && metric === '5XXError') {
    return 'Monitoring API Gateway error rates';
  }

  return `Monitoring ${metric} for ${namespace.replace('AWS/', '')}`;
}

function calculateOverallStatus(services) {
  if (services.length === 0) {
    return {
      status: 'operational',
      message: 'No services are currently being monitored'
    };
  }

  const statuses = services.map(s => s.status);
  const statusCounts = statuses.reduce((acc, status) => {
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  if (statuses.includes('major_outage')) {
    const count = statusCounts.major_outage;
    return {
      status: 'major_outage',
      message: `${count} service${count > 1 ? 's are' : ' is'} experiencing major outages`
    };
  } else if (statuses.includes('partial_outage')) {
    const count = statusCounts.partial_outage;
    return {
      status: 'partial_outage',
      message: `${count} service${count > 1 ? 's are' : ' is'} experiencing partial outages`
    };
  } else if (statuses.includes('degraded')) {
    const count = statusCounts.degraded;
    return {
      status: 'degraded',
      message: `${count} service${count > 1 ? 's are' : ' is'} experiencing degraded performance`
    };
  } else if (statuses.includes('maintenance')) {
    const count = statusCounts.maintenance;
    return {
      status: 'maintenance',
      message: `${count} service${count > 1 ? 's are' : ' is'} under scheduled maintenance`
    };
  } else {
    return {
      status: 'operational',
      message: `All ${services.length} monitored services are operating normally`
    };
  }
}

async function getRecentIncidents() {
  try {
    const params = {
      TableName: STATUS_TABLE,
      ScanIndexForward: false,
      Limit: 10
    };

    const result = await dynamodb.scan(params).promise();
    return (result.Items || []).sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error fetching recent incidents:', error);
    return [];
  }
}

function generateStatusPage(services, overallStatus, recentIncidents) {
  const timestamp = new Date().toLocaleString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${SERVICE_NAME} - Service Status</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <meta name="description" content="Real-time status updates for ${SERVICE_NAME} services">
    <meta name="robots" content="index, follow">
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
                    <h1 class="text-xl font-bold text-gray-900">${SERVICE_NAME} Status</h1>
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
                    <a href="${SERVICE_URL}" class="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors duration-200">
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
        <div class="rounded-lg border ${STATUS_CONFIG[overallStatus.status].borderColor} ${STATUS_CONFIG[overallStatus.status].bgColor} p-6 mb-8">
            <div class="flex items-center space-x-3">
                <div class="w-6 h-6 ${STATUS_CONFIG[overallStatus.status].color}">
                    ${getStatusIcon(overallStatus.status)}
                </div>
                <div>
                    <h2 class="text-lg font-semibold ${STATUS_CONFIG[overallStatus.status].color}">
                        ${STATUS_CONFIG[overallStatus.status].label}
                    </h2>
                    <p class="text-gray-700 mt-1">${overallStatus.message}</p>
                </div>
            </div>
        </div>

        <!-- Services Grid -->
        <div class="space-y-6">
            <div class="flex items-center justify-between">
                <h3 class="text-2xl font-bold text-gray-900">Service Status</h3>
                <p class="text-sm text-gray-600">
                    Data retained for ${DATA_RETENTION_DAYS} days
                </p>
            </div>

            ${services.length > 0 ? `
            <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                ${services.map(service => `
                    <div class="bg-white rounded-lg border ${STATUS_CONFIG[service.status].borderColor} p-5 hover:shadow-md transition-all duration-200">
                        <div class="flex items-start justify-between mb-3">
                            <div class="flex items-center space-x-3">
                                <div class="p-2 rounded-md ${STATUS_CONFIG[service.status].bgColor}">
                                    ${getServiceIcon(service.name)}
                                </div>
                                <div>
                                    <h4 class="font-semibold text-gray-900">${service.name}</h4>
                                    <p class="text-sm text-gray-600 mt-1">${service.description}</p>
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center space-x-2">
                                <div class="w-4 h-4 ${STATUS_CONFIG[service.status].color}">
                                    ${getStatusIcon(service.status)}
                                </div>
                                <span class="text-sm font-medium ${STATUS_CONFIG[service.status].color}">
                                    ${STATUS_CONFIG[service.status].label}
                                </span>
                            </div>
                            <span class="text-xs text-gray-500">
                                Updated ${service.lastUpdated}
                            </span>
                        </div>

                        <!-- Alarm Details -->
                        <div class="text-xs text-gray-500">
                            <details class="cursor-pointer">
                                <summary class="hover:text-gray-700">
                                    ${service.alarms.length} alarm${service.alarms.length !== 1 ? 's' : ''} monitored
                                </summary>
                                <div class="mt-2 space-y-1">
                                    ${service.alarms.map(alarm => `
                                        <div class="flex justify-between items-center">
                                            <span class="truncate">${alarm.name}</span>
                                            <span class="ml-2 px-1 py-0.5 rounded text-xs ${
                                                alarm.state === 'OK' ? 'bg-green-100 text-green-800' :
                                                alarm.state === 'ALARM' ? 'bg-red-100 text-red-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }">${alarm.state}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </details>
                        </div>
                    </div>
                `).join('')}
            </div>
            ` : `
            <div class="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
                <h4 class="text-lg font-semibold text-gray-900 mb-2">No Services Detected</h4>
                <p class="text-gray-600 mb-4">
                    No CloudWatch alarms are currently configured to trigger this status page.
                    Configure your alarms to include this Lambda function as an action to start monitoring services.
                </p>
                <div class="text-sm text-gray-500">
                    <p>To add monitoring:</p>
                    <ol class="list-decimal list-inside mt-2 space-y-1">
                        <li>Create CloudWatch alarms for your services</li>
                        <li>Add this Lambda function ARN as an alarm action</li>
                        <li>The status page will automatically update when alarms trigger</li>
                    </ol>
                </div>
            </div>
            `}
        </div>
    </main>

    <!-- Footer -->
    <footer class="bg-white border-t border-gray-200 mt-16">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div class="flex items-center justify-between">
                <p class="text-sm text-gray-600">
                    Last updated: ${timestamp} | Monitoring ${services.length} service${services.length !== 1 ? 's' : ''} | Data retained for ${DATA_RETENTION_DAYS} days
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

function getStatusIcon(status) {
  const icons = {
    operational: '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    degraded: '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
    partial_outage: '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
    major_outage: '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    maintenance: '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
  };
  return icons[status] || icons.operational;
}

function getServiceIcon(serviceName) {
  const name = serviceName.toLowerCase();
  if (name.includes('api') || name.includes('gateway')) {
    return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"/></svg>';
  } else if (name.includes('lambda') || name.includes('function')) {
    return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>';
  } else if (name.includes('database') || name.includes('rds')) {
    return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/></svg>';
  } else if (name.includes('storage') || name.includes('s3')) {
    return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"/></svg>';
  } else if (name.includes('load') && name.includes('balancer')) {
    return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>';
  } else if (name.includes('cloudfront') || name.includes('cdn')) {
    return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>';
  } else if (name.includes('dynamodb')) {
    return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>';
  }
  return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"/></svg>';
}

async function uploadToS3(html) {
  const params = {
    Bucket: STATUS_BUCKET,
    Key: 'index.html',
    Body: html,
    ContentType: 'text/html',
    CacheControl: 'max-age=300'
  };

  await s3.putObject(params).promise();
  console.log('Status page uploaded to S3');
}

async function invalidateCloudFront() {
  if (!CLOUDFRONT_DISTRIBUTION_ID) {
    console.log('No CloudFront distribution ID provided, skipping invalidation');
    return;
  }

  const params = {
    DistributionId: CLOUDFRONT_DISTRIBUTION_ID,
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

async function storeStatusHistory(services, overallStatus) {
  const timestamp = Date.now();
  const ttlTimestamp = Math.floor(timestamp / 1000) + (DATA_RETENTION_DAYS * 24 * 60 * 60);

  const params = {
    TableName: STATUS_TABLE,
    Item: {
      serviceId: 'overall',
      timestamp: timestamp,
      status: overallStatus.status,
      message: overallStatus.message,
      services: services,
      ttl: ttlTimestamp,
      dataRetentionDays: DATA_RETENTION_DAYS
    }
  };

  try {
    await dynamodb.put(params).promise();
    console.log(`Status history stored in DynamoDB with TTL: ${new Date(ttlTimestamp * 1000).toISOString()}`);
  } catch (error) {
    console.error('Error storing status history:', error);
  }
}

async function checkAndNotifyStatusChange(currentStatus) {
  try {
    const params = {
      TableName: STATUS_TABLE,
      KeyConditionExpression: 'serviceId = :serviceId',
      ExpressionAttributeValues: {
        ':serviceId': 'overall'
      },
      ScanIndexForward: false,
      Limit: 2
    };

    const result = await dynamodb.query(params).promise();

    if (result.Items && result.Items.length >= 2) {
      const lastStatus = result.Items[1].status;

      if (lastStatus !== currentStatus.status) {
        await sendStatusChangeNotification(lastStatus, currentStatus);
      }
    }
  } catch (error) {
    console.error('Error checking status change:', error);
  }
}

async function sendStatusChangeNotification(oldStatus, newStatus) {
  const message = `${SERVICE_NAME} Status Change Alert

Previous Status: ${STATUS_CONFIG[oldStatus]?.label || oldStatus}
Current Status: ${STATUS_CONFIG[newStatus.status]?.label || newStatus.status}

Message: ${newStatus.message}

Time: ${new Date().toISOString()}
Data Retention: ${DATA_RETENTION_DAYS} days

View status page: https://${CLOUDFRONT_DISTRIBUTION_ID ? `${CLOUDFRONT_DISTRIBUTION_ID}.cloudfront.net` : 'your-status-page.com'}`;

  const params = {
    TopicArn: SNS_TOPIC_ARN,
    Subject: `${SERVICE_NAME} - Status Changed to ${STATUS_CONFIG[newStatus.status]?.label || newStatus.status}`,
    Message: message
  };

  try {
    await sns.publish(params).promise();
    console.log('Status change notification sent');
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown';

  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}