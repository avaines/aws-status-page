const statusConfig = require('../config/statusConfig');
const timeUtils = require('../utils/timeUtils');

async function getAllRelevantAlarms(cloudwatch, lambdaFunctionName, snsTopicArn) {
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
          action.includes(lambdaFunctionName) ||
          action.includes('status-generator') ||
          // Also include alarms with SNS topics that might trigger our function
          action.includes(snsTopicArn)
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
    const status = statusConfig.STATUS_MAPPING[alarm.StateValue] || 'degraded';

    if (!serviceMap.has(serviceId)) {
      serviceMap.set(serviceId, {
        id: serviceId,
        name: serviceName,
        description: generateServiceDescription(alarm),
        status: status,
        lastUpdated: timeUtils.formatTimestamp(alarm.StateUpdatedTimestamp),
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

module.exports = {
  getAllRelevantAlarms,
  processAlarmsIntoServices
};