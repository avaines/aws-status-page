#!/bin/bash

# AWS Status Page Deployment Script
#
# This script deploys an AWS-based status page using AWS SAM.
# It performs the following operations:
#   1. Checks if AWS CLI and SAM CLI are installed.
#   2. Verifies that AWS credentials are configured.
#   3. Builds the SAM application from the SAM template.
#   4. Deploys the CloudFormation stack with the specified parameters.
#   5. Retrieves and displays output information including the status page URL,
#      RSS feed URL, and Lambda function ARN.
#
# Usage:
#   ./deploy.sh [--stack-name <name>] [--service-name <name>] [--service-url <url>]
#               [--notification-email <email>] [--region <region>] [--environment <env>]
#
# If no arguments are provided, the following default values are used:
#   STACK_NAME         = "aws-status-page"
#   SERVICE_NAME       = "MyService"
#   SERVICE_URL        = "https://example.com"
#   NOTIFICATION_EMAIL = "admin@example.com"
#   REGION             = "us-east-1"
#   ENVIRONMENT        = "dev"

set -e

# Default Values
STACK_NAME="aws-status-page"
SERVICE_NAME="MyService"
SERVICE_URL="https://example.com"
NOTIFICATION_EMAIL="admin@example.com"
REGION="us-east-1"
ENVIRONMENT="dev"
CI="false"  # New default for CI mode

# Parse command line arguments to override default values
while [ "$#" -gt 0 ]; do
    case "$1" in
        --stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        --service-name)
            SERVICE_NAME="$2"
            shift 2
            ;;
        --service-url)
            SERVICE_URL="$2"
            shift 2
            ;;
        --notification-email)
            NOTIFICATION_EMAIL="$2"
            shift 2
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --ci)
            CI="true"
            shift 1
            ;;
        --help)
            echo "Usage: $0 [--stack-name <name>] [--service-name <name>] [--service-url <url>] [--notification-email <email>] [--region <region>] [--environment <env>]"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Deploying AWS Status Page${NC}"
echo "Stack Name: $STACK_NAME"
echo "Region: $REGION"
echo "Environment: $ENVIRONMENT"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    echo -e "${RED}❌ SAM CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check AWS credentials are set
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${YELLOW}Building SAM application...${NC}"
sam build --template-file ./infra/sam-template.yaml

if [ "$CI" = "true" ]; then
    # In CI mode: Skip confirmation
    sam deploy \
        --template-file ./infra/sam-template.yaml \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --capabilities CAPABILITY_IAM \
        --resolve-s3 \
        --force-upload \
        --parameter-overrides \
            Environment="$ENVIRONMENT" \
            ServiceName="$SERVICE_NAME" \
            ServiceUrl="${SERVICE_URL}" \
            NotificationEmail="${NOTIFICATION_EMAIL}" \
        --no-fail-on-empty-changeset
else
    # Normal mode: Prompt for confirmation
    sam deploy \
        --template-file ./infra/sam-template.yaml \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --capabilities CAPABILITY_IAM \
        --resolve-s3 \
        --force-upload \
        --parameter-overrides \
            Environment="$ENVIRONMENT" \
            ServiceName="$SERVICE_NAME" \
            ServiceUrl="${SERVICE_URL}" \
            NotificationEmail="${NOTIFICATION_EMAIL}" \
        --no-fail-on-empty-changeset \
        --confirm-changeset
fi

echo -e "${YELLOW}📋 Getting deployment information...${NC}"
OUTPUTS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs' \
    --output table)

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "Stack Outputs:"
echo "$OUTPUTS"

STATUS_PAGE_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`StatusPageUrl`].OutputValue' \
    --output text)

RSS_FEED_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`RSSFeedUrl`].OutputValue' \
    --output text)

LAMBDA_FUNCTION_ARN=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`StatusGeneratorFunctionArn`].OutputValue' \
    --output text)

echo ""
echo -e "${GREEN}Your status page is now live at:${NC}"
echo "   $STATUS_PAGE_URL"
echo ""
echo -e "${GREEN}RSS Feed URL:${NC}"
echo "   $RSS_FEED_URL"
echo ""
echo -e "${GREEN}Lambda Function ARN (use this in CloudWatch alarm actions):${NC}"
echo "   $LAMBDA_FUNCTION_ARN"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Visit your status page to verify it's working"
echo "2. Configure CloudWatch alarms to trigger automatic updates:"
echo "   - Add the Lambda Function ARN above as an alarm action"
echo "   - Use descriptive alarm names for better service detection"
echo "3. Subscribe to the RSS feed for status notifications"
echo "4. The status page will automatically update every 5 minutes"
echo ""
