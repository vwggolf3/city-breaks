#!/bin/bash
set -e

ENVIRONMENT="${1:-preview-$(whoami)}"

if [[ "$ENVIRONMENT" != "prod" ]]; then
    export overrideWarningsEnabled=false
fi

echo "Starting AWS CDK deployment to environment: $ENVIRONMENT"

if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "AWS CLI not configured. Run 'aws configure' first."
    exit 1
fi

echo "Building frontend..."
npm run build

echo "Installing CDK dependencies..."
cd infra
npm install --no-progress
npm run build

echo "Bootstrapping CDK..."
npx -y cdk bootstrap --progress events

echo "Deploying CDK stacks for environment: $ENVIRONMENT..."

DEPLOY_CMD=(npx -y cdk deploy --all --context "environment=$ENVIRONMENT" --require-approval never --progress events)

if [[ "$ENVIRONMENT" == "preview-"* ]]; then
    echo "Using hotswap deployment for faster development feedback..."
    DEPLOY_CMD+=(--hotswap-fallback)
else
    echo "Using standard deployment for shared environment..."
fi

"${DEPLOY_CMD[@]}"

API_URL=$(aws cloudformation describe-stacks \
    --stack-name "CityBreaksLambda-${ENVIRONMENT}" \
    --query 'Stacks[0].Outputs[?OutputKey==`APIEndpoint`].OutputValue' \
    --output text 2>/dev/null || echo "N/A")

FRONTEND_URL=$(aws cloudformation describe-stacks \
    --stack-name "CityBreaksFrontend-${ENVIRONMENT}" \
    --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' \
    --output text)

echo ""
echo "Deployment complete for environment: $ENVIRONMENT!"
echo "Frontend URL: $FRONTEND_URL"
if [ "$API_URL" != "N/A" ]; then
    echo "API URL: $API_URL"
fi
echo ""
echo "Usage examples:"
echo "  ./scripts/deploy.sh                   # Deploy to preview-\$(whoami)"
echo "  ./scripts/deploy.sh dev               # Deploy to dev"
echo "  ./scripts/deploy.sh prod              # Deploy to production"
