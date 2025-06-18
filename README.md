# AWS Service Status Page

A serverless status page application built with AWS SAM that automatically monitors your AWS services and displays their health status in a beautiful, production-ready web interface.

## Architecture Overview

![Infrastructure Diagram](docs/diagram.drawio)

*View the diagram: Open `docs/infrastructure-diagram.drawio` in [Draw.io](https://app.diagrams.net/) or [VS Code with Draw.io extension](https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio)*

### Architecture Components

The status page uses a fully serverless architecture with the following AWS services:

- **CloudWatch Alarms**: Monitor your services and trigger status updates
- **Lambda Function**: Process alarms, generate status pages and RSS feeds
- **DynamoDB**: Store status history with automatic TTL expiration
- **S3**: Host static status page files and RSS feed (private bucket)
- **CloudFront**: Global CDN with security headers and caching
- **SNS**: Email notifications for status changes
- **EventBridge**: Scheduled status page updates every 5 minutes

## Features

- **Automatic Monitoring**: Integrates with CloudWatch alarms to automatically detect service issues
- **Beautiful UI**: Professional status page design similar to GitHub Status, Atlassian Status Page
- **Real-time Updates**: Automatically updates when CloudWatch alarms change state
- **RSS Feed**: Subscribe to status updates via RSS (hosted on S3/CloudFront)
- **Email Notifications**: Get notified when service status changes
- **Responsive Design**: Works perfectly on desktop and mobile devices
- **Serverless**: Built entirely on AWS serverless services for high availability and low cost
- **TTL Data Management**: Automatic data expiration to control costs
- **Security**: CloudFront with security headers, private S3 bucket with OAC
- **Minimal Infrastructure**: Single Lambda function handles everything

## Quick Start

### Prerequisites

- AWS CLI configured with appropriate permissions
- SAM CLI installed
- Node.js 18+ (for local development)

### Deployment

1. **Clone and configure**:
   ```bash
   git clone <your-repo>
   cd aws-status-page
   ```

2. **Deploy using the provided script**:
   ```bash
   ./deploy.sh
   ```

3. **Or deploy manually with SAM**:
   ```bash
   sam build
   sam deploy --guided
   ```

### Configuration Parameters

When deploying, you can customize these parameters:

- `Environment`: Deployment environment (dev, staging, prod)
- `ServiceName`: Name of your service (displayed on the status page)
- `ServiceUrl`: URL of your main service
- `NotificationEmail`: Email address for status change notifications
- `DataRetentionDays`: How long to keep status history (1-365 days, default: 30)
- `EnablePointInTimeRecovery`: Enable DynamoDB PITR (additional cost, default: false)

## Usage

### Automatic CloudWatch Integration

The status page automatically monitors CloudWatch alarms that have this Lambda function configured as an action. When an alarm changes state, the Lambda function:

1. **Discovers Services**: Scans CloudWatch alarms that reference the status generator Lambda
2. **Groups by Service**: Organizes alarms by service name (extracted from alarm names)
3. **Calculates Status**: Determines overall system status based on alarm states
4. **Generates Content**: Creates and uploads both HTML status page and RSS feed
5. **Invalidates Cache**: Clears CloudFront cache for immediate updates
6. **Stores History**: Saves status data in DynamoDB with TTL
7. **Sends Notifications**: Emails alerts if status changed

### Service Detection Logic

Services are automatically detected from CloudWatch alarms using these patterns:

```javascript
// Pattern 1: Alarm name prefix (e.g., "UserAPI-HighErrorRate" → "UserAPI")
// Pattern 2: AWS namespace mapping (e.g., "AWS/Lambda" → "Lambda Functions")
// Pattern 3: Dimension values (e.g., FunctionName: "user-api" → "Lambda Functions (user-api)")
```

### Status Values

- `operational`: Service is working normally
- `degraded`: Service is working but with reduced performance
- `partial_outage`: Some functionality is unavailable
- `major_outage`: Service is completely unavailable
- `maintenance`: Planned maintenance in progress

### RSS Feed

The RSS feed is automatically generated and hosted at: `https://your-cloudfront-domain/rss.xml`

## Data Management & TTL

### Automatic Data Expiration

All status data stored in DynamoDB includes TTL (Time To Live) attributes:

- **Default Retention**: 30 days (configurable 1-365 days)
- **Automatic Cleanup**: DynamoDB automatically deletes expired records
- **Cost Control**: Prevents unlimited data growth
- **Zero Maintenance**: No manual cleanup required

### TTL Configuration Examples

```bash
# Minimal retention (7 days) - lowest cost
sam deploy --parameter-overrides DataRetentionDays=7

# Standard retention (30 days) - default
sam deploy --parameter-overrides DataRetentionDays=30

# Extended retention (90 days) - compliance
sam deploy --parameter-overrides DataRetentionDays=90
```

### Storage Cost Estimation

```
Daily Records: ~288 (every 5 minutes)
30-day Retention: ~8,640 records
Estimated Storage: 1-2 MB (well within free tier)
Monthly Cost: <$0.01 USD
```

## Customization

### Service Icons and Names

The Lambda function automatically assigns icons based on service names and AWS namespaces:

- **API Gateway** → Globe icon
- **Lambda Functions** → Lightning icon
- **RDS Database** → Database icon
- **S3 Storage** → Folder icon
- **Load Balancer** → Bar chart icon
- **CloudFront CDN** → Cloud icon
- **DynamoDB** → Table icon

### Styling

The status page uses Tailwind CSS loaded from CDN. You can customize the styling by modifying the HTML template in `lambda/statusGenerator.js`.

### Adding Custom Services

To monitor custom services:

1. **Create CloudWatch Alarms** for your services with descriptive names
2. **Add Lambda Function ARN** as an alarm action:
   ```bash
   aws cloudwatch put-metric-alarm \
     --alarm-name "MyApp-HighErrorRate" \
     --alarm-actions "arn:aws:lambda:region:account:function:stack-name-status-generator"
   ```
3. **Services Auto-Appear** on the next status page update

### Alarm Naming Conventions

For best service detection, use these naming patterns:

```bash
# Good examples:
"UserAPI-HighErrorRate"        → "UserAPI" service
"PaymentService-DatabaseDown"  → "PaymentService" service
"WebApp-LoadBalancer-5XX"      → "WebApp LoadBalancer" service

# AWS services auto-detected:
"AWS/Lambda" namespace         → "Lambda Functions"
"AWS/ApplicationELB"          → "Application Load Balancer"
"AWS/RDS"                     → "RDS Database"
```

## Monitoring and Alerts

The application includes built-in monitoring:

- **📊 CloudWatch Alarm**: Monitors the status page availability via CloudFront
- **📧 SNS Notifications**: Email alerts for status changes
- **📈 DynamoDB Metrics**: Track storage usage and read/write capacity
- **🔍 Lambda Logs**: Detailed logging for debugging in CloudWatch Logs
- **⚡ Performance**: Function duration and error rate monitoring

## Security

- **🔒 Private S3 Bucket**: No public access, only CloudFront can read
- **🛡️ CloudFront OAC**: Origin Access Control for secure S3 access
- **🔐 Security Headers**: HSTS, CSP, X-Frame-Options via response headers policy
- **🌐 HTTPS Only**: All traffic redirected to HTTPS
- **🔑 IAM Least Privilege**: Lambda functions have minimal required permissions
- **🕒 TTL Cleanup**: Automatic data expiration prevents data accumulation

## Cost Optimization

The serverless architecture keeps costs extremely low:

### Monthly Cost Breakdown (typical usage)
```
Lambda Executions: ~8,640/month    → $0.00
DynamoDB Requests: ~17,280/month    → $0.02
S3 Storage: ~1MB                    → $0.00
CloudFront: ~1,000 requests         → $0.00
SNS: ~10 notifications              → $0.00
CloudWatch: 1 alarm                 → $0.10
Total: ~$0.12/month
```

### Cost Optimization Features

- **💰 Pay-per-Request**: DynamoDB and Lambda only charge for actual usage
- **🆓 Free Tier Friendly**: Designed to stay within AWS free tier limits
- **🕒 TTL Cleanup**: Automatic data expiration prevents storage growth
- **⚡ Efficient Caching**: CloudFront reduces origin requests
- **🚫 No KMS**: SNS uses default encryption to avoid KMS costs
- **🚫 No PITR**: DynamoDB Point-in-Time Recovery disabled by default
- **🚫 No Logging**: CloudFront access logging disabled to save costs
- **📡 Minimal Infrastructure**: Single Lambda function, no API Gateway for RSS

## Troubleshooting

### Status page not updating
1. Check CloudWatch logs for the Lambda function
2. Verify CloudWatch alarms have the Lambda function as an action
3. Check EventBridge scheduled rule is enabled

### No services detected
1. Ensure CloudWatch alarms exist and have the Lambda function ARN as an action
2. Check alarm naming follows recommended patterns
3. Verify Lambda function has CloudWatch permissions
4. Review Lambda logs for alarm processing details

### Email notifications not working
1. Verify the SNS topic subscription is confirmed (check email)
2. Check the email address in the stack parameters
3. Look for SNS delivery failures in CloudWatch
4. Ensure Lambda has SNS publish permissions

### RSS feed not accessible
1. Check that both index.html and rss.xml are uploaded to S3
2. Verify CloudFront invalidation includes both files
3. Test direct S3 access (should be denied - this confirms security)
4. Check CloudFront distribution configuration

### CloudFront not serving latest content
1. The Lambda function automatically invalidates the cache for both HTML and RSS
2. You can manually invalidate using the AWS Console
3. Check the CloudFront distribution configuration
4. Verify S3 bucket policy allows CloudFront access

## Development

### Local Testing

```bash
# Install dependencies
cd lambda
npm install

# Test Lambda functions locally
sam local invoke StatusPageGeneratorFunction --event events/cloudwatch-alarm.json

# Start local development (status page only)
npm run dev
```

### Project Structure

```
├── template.yaml              # SAM template with all AWS resources
├── lambda/                    # Lambda function code
│   ├── statusGenerator.js     # Main status page and RSS generator
│   └── package.json          # Node.js dependencies
├── docs/
│   └── infrastructure-diagram.drawio  # Architecture diagram
├── deploy.sh                 # Deployment script
├── src/                      # React frontend (for development/preview)
└── README.md                 # This file
```

### Infrastructure Diagram

The `docs/infrastructure-diagram.drawio` file contains a comprehensive visual representation of the architecture. You can:

1. **View Online**: Upload to [app.diagrams.net](https://app.diagrams.net/)
2. **VS Code**: Install the [Draw.io extension](https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio)
3. **Desktop**: Download [Draw.io Desktop](https://github.com/jgraph/drawio-desktop/releases)

The diagram shows:
- 🔄 Data flow between all AWS services
- 🎨 Color-coded connections by function
- 📊 TTL and cost optimization features
- 🔒 Security boundaries and access patterns

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with `sam local`
5. Update the infrastructure diagram if needed
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review CloudWatch logs for detailed error information
3. Consult the infrastructure diagram for data flow understanding
4. Open an issue on GitHub with logs and configuration details

---

Built with ❤️ using AWS SAM and serverless technologies.

**Key Features**: Automatic service discovery • TTL data management • Cost-optimized • Production-ready • Fully serverless • Integrated RSS feed • Minimal infrastructure