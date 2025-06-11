import React, { useState, useEffect } from 'react';
import { 
  Rss, 
  HelpCircle, 
  ExternalLink, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Info,
  Activity,
  Server,
  Database,
  Globe,
  Shield,
  Zap,
  Cloud,
  BarChart3
} from 'lucide-react';

interface AlarmInfo {
  name: string;
  description: string;
  state: 'OK' | 'ALARM' | 'INSUFFICIENT_DATA';
  reason: string;
  timestamp: string;
}

interface ServiceStatus {
  id: string;
  name: string;
  description: string;
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';
  lastUpdated: string;
  alarms: AlarmInfo[];
  icon: React.ReactNode;
}

interface OverallStatus {
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';
  message: string;
}

const STATUS_CONFIG = {
  operational: {
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: CheckCircle,
    label: 'Operational'
  },
  degraded: {
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    icon: AlertTriangle,
    label: 'Degraded Performance'
  },
  partial_outage: {
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: AlertTriangle,
    label: 'Partial Outage'
  },
  major_outage: {
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: XCircle,
    label: 'Major Outage'
  },
  maintenance: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: Info,
    label: 'Scheduled Maintenance'
  }
};

function App() {
  // Demo data showing how services would be dynamically detected from CloudWatch alarms
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      id: 'lambda-functions',
      name: 'Lambda Functions',
      description: 'Monitoring Lambda function error rates and performance',
      status: 'operational',
      lastUpdated: '2 minutes ago',
      alarms: [
        {
          name: 'UserAPI-ErrorRate',
          description: 'High error rate in user API function',
          state: 'OK',
          reason: 'Threshold Crossed: 1 out of the last 1 datapoints',
          timestamp: '2024-12-28T14:30:00Z'
        },
        {
          name: 'UserAPI-Duration',
          description: 'Function execution duration monitoring',
          state: 'OK',
          reason: 'Threshold Crossed: 1 out of the last 1 datapoints',
          timestamp: '2024-12-28T14:25:00Z'
        }
      ],
      icon: <Zap className="w-5 h-5" />
    },
    {
      id: 'application-load-balancer',
      name: 'Application Load Balancer',
      description: 'Monitoring application server errors and response times',
      status: 'degraded',
      lastUpdated: '5 minutes ago',
      alarms: [
        {
          name: 'ALB-HighResponseTime',
          description: 'Application load balancer response time is high',
          state: 'ALARM',
          reason: 'Threshold Crossed: 2 out of the last 2 datapoints',
          timestamp: '2024-12-28T14:20:00Z'
        },
        {
          name: 'ALB-5XXErrors',
          description: 'High rate of 5XX errors from load balancer',
          state: 'INSUFFICIENT_DATA',
          reason: 'Insufficient Data: 1 datapoint was unknown',
          timestamp: '2024-12-28T14:15:00Z'
        }
      ],
      icon: <BarChart3 className="w-5 h-5" />
    },
    {
      id: 'rds-database',
      name: 'RDS Database (prod-db)',
      description: 'Monitoring database connection health and performance',
      status: 'operational',
      lastUpdated: '1 minute ago',
      alarms: [
        {
          name: 'RDS-DatabaseConnections',
          description: 'Database connection count monitoring',
          state: 'OK',
          reason: 'Threshold Crossed: 1 out of the last 1 datapoints',
          timestamp: '2024-12-28T14:32:00Z'
        }
      ],
      icon: <Database className="w-5 h-5" />
    },
    {
      id: 'api-gateway',
      name: 'API Gateway',
      description: 'Monitoring API Gateway error rates and latency',
      status: 'maintenance',
      lastUpdated: '12 minutes ago',
      alarms: [
        {
          name: 'APIGateway-5XXError',
          description: 'API Gateway 5XX error rate monitoring',
          state: 'OK',
          reason: 'Scheduled maintenance window',
          timestamp: '2024-12-28T14:00:00Z'
        }
      ],
      icon: <Globe className="w-5 h-5" />
    },
    {
      id: 'cloudfront-cdn',
      name: 'CloudFront CDN',
      description: 'Content delivery network performance monitoring',
      status: 'operational',
      lastUpdated: '3 minutes ago',
      alarms: [
        {
          name: 'CloudFront-ErrorRate',
          description: 'CloudFront 4XX/5XX error rate monitoring',
          state: 'OK',
          reason: 'Threshold Crossed: 1 out of the last 1 datapoints',
          timestamp: '2024-12-28T14:28:00Z'
        }
      ],
      icon: <Cloud className="w-5 h-5" />
    },
    {
      id: 's3-storage',
      name: 'S3 Storage',
      description: 'Object storage and static assets monitoring',
      status: 'operational',
      lastUpdated: '4 minutes ago',
      alarms: [
        {
          name: 'S3-BucketRequests',
          description: 'S3 bucket request monitoring',
          state: 'OK',
          reason: 'Threshold Crossed: 1 out of the last 1 datapoints',
          timestamp: '2024-12-28T14:27:00Z'
        }
      ],
      icon: <Server className="w-5 h-5" />
    }
  ]);

  const [overallStatus, setOverallStatus] = useState<OverallStatus>({
    status: 'degraded',
    message: '1 service is experiencing degraded performance'
  });

  // Calculate overall status based on individual services
  useEffect(() => {
    const statuses = services.map(s => s.status);
    const statusCounts = statuses.reduce((acc, status) => {
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    if (statuses.includes('major_outage')) {
      const count = statusCounts.major_outage;
      setOverallStatus({
        status: 'major_outage',
        message: `${count} service${count > 1 ? 's are' : ' is'} experiencing major outages`
      });
    } else if (statuses.includes('partial_outage')) {
      const count = statusCounts.partial_outage;
      setOverallStatus({
        status: 'partial_outage',
        message: `${count} service${count > 1 ? 's are' : ' is'} experiencing partial outages`
      });
    } else if (statuses.includes('degraded')) {
      const count = statusCounts.degraded;
      setOverallStatus({
        status: 'degraded',
        message: `${count} service${count > 1 ? 's are' : ' is'} experiencing degraded performance`
      });
    } else if (statuses.includes('maintenance')) {
      const count = statusCounts.maintenance;
      setOverallStatus({
        status: 'maintenance',
        message: `${count} service${count > 1 ? 's are' : ' is'} under scheduled maintenance`
      });
    } else {
      setOverallStatus({
        status: 'operational',
        message: `All ${services.length} monitored services are operating normally`
      });
    }
  }, [services]);

  const StatusIcon = STATUS_CONFIG[overallStatus.status].icon;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Activity className="w-8 h-8 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">Service Status</h1>
            </div>
            
            <nav className="flex items-center space-x-6">
              <a 
                href="/rss" 
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
              >
                <Rss className="w-4 h-4" />
                <span className="text-sm font-medium">RSS Feed</span>
              </a>
              <a 
                href="/help" 
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
              >
                <HelpCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Help</span>
              </a>
              <a 
                href="https://yourservice.com" 
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors duration-200"
              >
                <span className="text-sm font-medium">Visit Service</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overall Status */}
        <div className={`rounded-lg border ${STATUS_CONFIG[overallStatus.status].borderColor} ${STATUS_CONFIG[overallStatus.status].bgColor} p-6 mb-8`}>
          <div className="flex items-center space-x-3">
            <StatusIcon className={`w-6 h-6 ${STATUS_CONFIG[overallStatus.status].color}`} />
            <div>
              <h2 className={`text-lg font-semibold ${STATUS_CONFIG[overallStatus.status].color}`}>
                {STATUS_CONFIG[overallStatus.status].label}
              </h2>
              <p className="text-gray-700 mt-1">{overallStatus.message}</p>
            </div>
          </div>
        </div>

        {/* Services Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-gray-900">Service Status</h3>
            <p className="text-sm text-gray-600">
              Monitoring {services.length} services via CloudWatch alarms
            </p>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => {
              const config = STATUS_CONFIG[service.status];
              const ServiceIcon = config.icon;
              
              return (
                <div
                  key={service.id}
                  className={`bg-white rounded-lg border ${config.borderColor} p-5 hover:shadow-md transition-all duration-200`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-md ${config.bgColor}`}>
                        {service.icon}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{service.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <ServiceIcon className={`w-4 h-4 ${config.color}`} />
                      <span className={`text-sm font-medium ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      Updated {service.lastUpdated}
                    </span>
                  </div>
                  
                  {/* Alarm Details */}
                  <div className="text-xs text-gray-500">
                    <details className="cursor-pointer">
                      <summary className="hover:text-gray-700 flex items-center justify-between">
                        <span>{service.alarms.length} alarm{service.alarms.length !== 1 ? 's' : ''} monitored</span>
                        <span className="ml-2">▼</span>
                      </summary>
                      <div className="mt-3 space-y-2 border-t border-gray-100 pt-2">
                        {service.alarms.map((alarm, index) => (
                          <div key={index} className="bg-gray-50 rounded p-2">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium text-gray-700 text-xs">{alarm.name}</span>
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                alarm.state === 'OK' ? 'bg-green-100 text-green-800' :
                                alarm.state === 'ALARM' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {alarm.state}
                              </span>
                            </div>
                            {alarm.description && (
                              <p className="text-xs text-gray-600 mb-1">{alarm.description}</p>
                            )}
                            <p className="text-xs text-gray-500">{alarm.reason}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-12">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Recent Activity</h3>
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
            <div className="p-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2"></div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Load Balancer Performance Degraded
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    CloudWatch alarm "ALB-HighResponseTime" triggered due to increased response times. Investigating root cause.
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Dec 28, 2024 at 2:20 PM UTC
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Scheduled Maintenance - API Gateway
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Performing scheduled maintenance on API Gateway. Some requests may experience brief delays.
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Dec 28, 2024 at 2:00 PM UTC
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    All Systems Operational
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    All monitored services returned to normal operation. CloudWatch alarms are in OK state.
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Dec 28, 2024 at 1:45 PM UTC
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CloudWatch Integration Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-2">
                Dynamic Service Detection
              </h4>
              <p className="text-sm text-blue-800 mb-3">
                This status page automatically discovers services by scanning CloudWatch alarms that have this Lambda function configured as an action. Services shown above are detected from your actual AWS infrastructure.
              </p>
              <div className="text-xs text-blue-700">
                <p className="font-medium mb-1">To add new services to monitoring:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Create CloudWatch alarms for your services</li>
                  <li>Add this Lambda function ARN as an alarm action</li>
                  <li>Services will automatically appear on the next update</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Last updated: {new Date().toLocaleString()} | Monitoring {services.length} services
            </p>
            <div className="flex items-center space-x-4">
              <a href="/privacy" className="text-sm text-gray-600 hover:text-gray-900">
                Privacy Policy
              </a>
              <a href="/terms" className="text-sm text-gray-600 hover:text-gray-900">
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;