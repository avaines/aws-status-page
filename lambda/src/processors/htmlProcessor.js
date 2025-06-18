const TemplateEngine = require('../utils/templateEngine');
const statusConfig = require('../config/statusConfig');
const iconUtils = require('../utils/iconUtils');

const templateEngine = new TemplateEngine();

function generate(services, overallStatus, recentIncidents, config) {
  const { SERVICE_NAME, SERVICE_URL, DATA_RETENTION_DAYS, CLOUDFRONT_DISTRIBUTION_ID } = config;
  const timestamp = new Date().toLocaleString();
  const rssUrl = `https://${CLOUDFRONT_DISTRIBUTION_ID ? `${CLOUDFRONT_DISTRIBUTION_ID}.cloudfront.net` : 'your-status-page.com'}/rss.xml`;

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

  const templateVariables = {
    serviceName: SERVICE_NAME,
    serviceUrl: SERVICE_URL,
    rssUrl: rssUrl,
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
    
    // Lambda function ARN for setup instructions
    lambdaFunctionArn: process.env.AWS_LAMBDA_FUNCTION_NAME ? 
      `arn:aws:lambda:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID || 'YOUR_ACCOUNT'}:function:${process.env.AWS_LAMBDA_FUNCTION_NAME}` : 
      'Function ARN will appear here after deployment'
  };

  return templateEngine.render('status-page', templateVariables);
}

function generateInitial(serviceName, serviceUrl, dataRetentionDays, cloudFrontDistributionId) {
  const timestamp = new Date().toLocaleString();
  const rssUrl = `https://${cloudFrontDistributionId ? `${cloudFrontDistributionId}.cloudfront.net` : 'your-status-page.com'}/rss.xml`;

  const templateVariables = {
    serviceName: serviceName,
    serviceUrl: serviceUrl,
    rssUrl: rssUrl,
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

module.exports = {
  generate,
  generateInitial
};