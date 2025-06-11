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

// Status mapping from CloudWatch alarm states
const STATUS_MAPPING = {
  'OK': 'operational',
  'ALARM': 'major_outage',
  'INSUFFICIENT_DATA': 'degraded'
};

module.exports = {
  STATUS_CONFIG,
  STATUS_MAPPING
};