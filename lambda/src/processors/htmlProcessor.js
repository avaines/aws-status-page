const TemplateEngine = require('../utils/templateEngine');
const statusConfig = require('../config/statusConfig');
const iconUtils = require('../utils/iconUtils');
const timeUtils = require('../utils/timeUtils');

const templateEngine = new TemplateEngine();

function generate(services, overallStatus, recentIncidents, config) {
  const { SERVICE_NAME, SERVICE_URL, DATA_RETENTION_DAYS, CLOUDFRONT_DISTRIBUTION_ID } = config;
  const timestamp = new Date().toLocaleString();

  // Prepare overall status data
  const overallConfig = statusConfig.STATUS_CONFIG[overallStatus.status];

  // Prepare services data with enhanced properties
  const enhancedServices = services.map(service => {
    const config = statusConfig.STATUS_CONFIG[service.status];
    return {
      ...service,
      color: config.color,
      bgColor: config.bgColor,
      borderColor: config.borderColor,
      statusLabel: config.label,
      statusIcon: iconUtils.getStatusIcon(service.status),
      serviceIcon: iconUtils.getServiceIcon(service.name),
      alarmCount: service.alarms.length,
      alarmCountPlural: service.alarms.length !== 1 ? 's' : '',
      alarms: service.alarms.map(alarm => ({
        ...alarm,
        stateClass: getAlarmStateClass(alarm.state)
      }))
    };
  });

  // Prepare recent incidents data with enhanced properties
  const enhancedIncidents = recentIncidents.slice(0, 10).map(incident => {
    const incidentTitle = getIncidentTitle(incident);
    const incidentDescription = getIncidentDescription(incident);
    const statusDotColor = getStatusDotColor(incident.status);
    const formattedTimestamp = formatIncidentTimestamp(incident.timestamp);

    return {
      ...incident,
      title: incidentTitle,
      description: incidentDescription,
      statusDotColor: statusDotColor,
      formattedTimestamp: formattedTimestamp
    };
  });

  const templateVariables = {
    serviceName: SERVICE_NAME,
    serviceUrl: SERVICE_URL,

    timestamp: timestamp,
    dataRetentionDays: DATA_RETENTION_DAYS,

    // Overall status
    overallStatusColor: overallConfig.color,
    overallStatusBgColor: overallConfig.bgColor,
    overallStatusBorderColor: overallConfig.borderColor,
    overallStatusLabel: overallConfig.label,
    overallStatusMessage: overallStatus.message,
    overallStatusIcon: iconUtils.getStatusIcon(overallStatus.status),

    // Services
    hasServices: services.length > 0,
    services: enhancedServices,
    serviceCount: services.length,
    serviceCountPlural: services.length !== 1 ? 's' : '',
    isInitialDeploy: false,

    // Recent incidents
    hasRecentIncidents: recentIncidents.length > 0,
    recentIncidents: enhancedIncidents,

    // Lambda function ARN for setup instructions
    lambdaFunctionArn: process.env.AWS_LAMBDA_FUNCTION_NAME ?
      `arn:aws:lambda:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID || 'YOUR_ACCOUNT'}:function:${process.env.AWS_LAMBDA_FUNCTION_NAME}` :
      'Function ARN will appear here after deployment'
  };

  return templateEngine.render('status-page', templateVariables);
}

function generateInitial(serviceName, serviceUrl, dataRetentionDays, cloudFrontDistributionId) {
  const timestamp = new Date().toLocaleString();

  const templateVariables = {
    serviceName: serviceName,
    serviceUrl: serviceUrl,
    timestamp: timestamp,
    dataRetentionDays: dataRetentionDays,

    // Overall status for initial deploy (always operational)
    overallStatusColor: 'text-green-600',
    overallStatusBgColor: 'bg-green-50',
    overallStatusBorderColor: 'border-green-200',
    overallStatusLabel: 'All Systems Operational',
    overallStatusMessage: 'Status page has been successfully deployed and is ready to monitor your services.',
    overallStatusIcon: iconUtils.getStatusIcon('operational'),

    // No services initially
    hasServices: false,
    services: [],
    serviceCount: 0,
    serviceCountPlural: 's',
    isInitialDeploy: true,

    // No incidents initially
    hasRecentIncidents: false,
    recentIncidents: [],

    lambdaFunctionArn: process.env.AWS_LAMBDA_FUNCTION_NAME ?
      `arn:aws:lambda:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID || 'YOUR_ACCOUNT'}:function:${process.env.AWS_LAMBDA_FUNCTION_NAME}` :
      'Function ARN will appear here after deployment'
  };

  return templateEngine.render('status-page', templateVariables);
}

function getAlarmStateClass(state) {
  switch (state) {
    case 'OK':
      return 'bg-green-100 text-green-800';
    case 'ALARM':
      return 'bg-red-100 text-red-800';
    case 'INSUFFICIENT_DATA':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getIncidentTitle(incident) {
  const statusLabels = {
    operational: 'Operational',
    degraded: 'Degraded Performance',
    partial_outage: 'Partial Outage',
    major_outage: 'Major Outage',
    maintenance: 'Scheduled Maintenance'
  };

  const statusLabel = statusLabels[incident.status] || incident.status;

  if (incident.serviceId === 'overall') {
    return `System Status: ${statusLabel}`;
  } else {
    // Try to find the service name from the services data
    const serviceName = incident.services && incident.services.length > 0
      ? incident.services.find(s => s.id === incident.serviceId)?.name || incident.serviceId
      : incident.serviceId;

    return `${serviceName}: ${statusLabel}`;
  }
}

function getIncidentDescription(incident) {
  let description = incident.message || '';

  // If we have services data, add more context
  if (incident.services && incident.services.length > 0) {
    const affectedServices = incident.services.filter(s => s.status !== 'operational');
    if (affectedServices.length > 0) {
      const serviceNames = affectedServices.map(s => s.name).join(', ');
      if (description && !description.includes(serviceNames)) {
        description += ` Affected services: ${serviceNames}.`;
      }
    }
  }

  if (!description) {
    if (incident.serviceId === 'overall') {
      description = `Overall system status changed to ${incident.status}`;
    } else {
      description = `Service status changed to ${incident.status}`;
    }
  }

  return description;
}

function getStatusDotColor(status) {
  switch (status) {
    case 'operational':
      return 'bg-green-400';
    case 'degraded':
      return 'bg-yellow-400';
    case 'partial_outage':
      return 'bg-orange-400';
    case 'major_outage':
      return 'bg-red-400';
    case 'maintenance':
      return 'bg-blue-400';
    default:
      return 'bg-gray-400';
  }
}

function formatIncidentTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();

  // If it's today, show relative time
  if (date.toDateString() === now.toDateString()) {
    return timeUtils.formatTimestamp(timestamp);
  }

  // Otherwise show full date
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

module.exports = {
  generate,
  generateInitial
};