#!/bin/bash

# AWS Status Page Deployment Script
# This script deploys the status page using AWS SAM

set -e

# Default Values
STACK_NAME="aws-status-page"
SERVICE_NAME="MyService"
REGION="us-east-1"
ENVIRONMENT="dev"

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
sam build

echo -e "${YELLOW}Deploying to AWS...${NC}"
sam deploy \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --capabilities CAPABILITY_IAM \
    --resolve-s3 \
    --parameter-overrides \
        Environment="$ENVIRONMENT" \
        ServiceName="$SERVICE_NAME" \
        ServiceUrl="https://example.com" \
        NotificationEmail="admin@example.com" \
    --confirm-changeset

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

WEBHOOK_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`WebhookUrl`].OutputValue' \
    --output text)

echo ""
echo -e "${GREEN}Your status page is now live at:${NC}"
echo "   $STATUS_PAGE_URL"
echo ""
echo -e "${GREEN}RSS Feed URL:${NC}"
echo "   $RSS_FEED_URL"
echo ""
echo -e "${GREEN}Webhook API URL:${NC}"
echo "   $WEBHOOK_URL"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Visit your status page to verify it's working"
echo "2. Configure CloudWatch alarms to trigger automatic updates"
echo "3. Use the webhook API to manually update service status"
echo "4. Subscribe to the RSS feed for status notifications"
echo ""