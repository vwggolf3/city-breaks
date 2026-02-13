# Deployment Summary

Your app is deployed to AWS with a 'preview' URL that doesn't change when you update GitHub. Share this link with others.

To connect deployments to GitHub changes, ask your coding agent to `setup a AWS CodePipeline`.

Services used: CloudFront, S3, Lambda, API Gateway, Secrets Manager, CloudFormation, IAM

Questions? Ask your Coding Agent:
 - What resources were deployed to AWS?
 - How do I update my deployment?
 - Clear the cache on my website

## Endpoints

- Frontend: https://d15kwzkstetaby.cloudfront.net
- API: https://p12ynvffm0.execute-api.us-east-1.amazonaws.com/api/
- Supabase: https://rzvkcsuluelkkcovvaqz.supabase.co

## Stacks

- Lambda: `CityBreaksLambda-preview-gabbypop`
- Frontend: `CityBreaksFrontend-preview-gabbypop`
- Environment: `preview-gabbypop`
- Region: `us-east-1`

## Monitoring & Metrics

```bash
# Total site visitors (last 24h)
aws cloudwatch get-metric-statistics --namespace AWS/CloudFront --metric-name Requests \
  --dimensions Name=DistributionId,Value=E2P5S7YPQL7YF5 Name=Region,Value=Global \
  --start-time $(date -u -v-24H +%Y-%m-%dT%H:%M:%SZ) --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) --period 86400 --statistics Sum

# Lambda invocations (last 24h)
aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Invocations \
  --dimensions Name=FunctionName,Value=CityBreaksLambda-preview-gabbypop-search-flights \
  --start-time $(date -u -v-24H +%Y-%m-%dT%H:%M:%SZ) --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) --period 86400 --statistics Sum
```

## Production Readiness

For production deployments, consider:
- WAF Protection: Add AWS WAF with managed rules (Core Rule Set, Known Bad Inputs) and rate limiting
- Custom Domain: Set up Route 53 and ACM certificate
- Monitoring: CloudWatch alarms for 4xx/5xx errors and CloudFront metrics
- Auth Redirect URLs: Add your CloudFront URL to Supabase allowed redirect URLs

## Recovery Guide

```bash
# Rollback
cd infra && cdk destroy --all

# Redeploy
./scripts/deploy.sh
```

## Deployment Details

- 21 Lambda functions migrated from Supabase Edge Functions
- Secrets stored in AWS Secrets Manager: `CityBreaks/preview-gabbypop/secrets`
- Supabase project: `rzvkcsuluelkkcovvaqz` (city-breaks-aws)
- CloudFront redirect URLs configured in Supabase auth
