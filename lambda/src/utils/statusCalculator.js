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

module.exports = {
  calculateOverallStatus
};