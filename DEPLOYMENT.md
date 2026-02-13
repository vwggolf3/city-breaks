# Deployment Summary

Your app has a CodePipeline pipeline. Changes pushed to the `deploy-to-aws` branch on GitHub will be deployed automatically. This is managed by CloudFormation stack `CityBreaksPipelineStack`.

Pipeline console: https://us-east-1.console.aws.amazon.com/codesuite/codepipeline/pipelines/CityBreaksPipeline/view

Services used: CodePipeline, CodeBuild, CodeConnections, CloudFront, S3, Lambda, API Gateway, Secrets Manager, CloudFormation, IAM

Questions? Ask your Coding Agent:
 - How can I change the source branch?
 - What's the difference between preview and prod URLs?
 - What resources were deployed to AWS?
 - Clear the cache on my website

## Quick Commands

```bash
# View pipeline status
aws codepipeline get-pipeline-state --name "CityBreaksPipeline" --query 'stageStates[*].[stageName,latestExecution.status]' --output table

# View build logs
aws logs tail "/aws/codebuild/CityBreaksPipelineStack-Synth" --follow

# Trigger pipeline manually
aws codepipeline start-pipeline-execution --name "CityBreaksPipeline"
```

---

## Pipeline

- Stack: `CityBreaksPipelineStack`
- Pipeline: `CityBreaksPipeline`
- Source: `vwggolf3/city-breaks` branch `deploy-to-aws`
- CodeConnection ARN: `arn:aws:codeconnections:us-east-2:017247443276:connection/9178e508-69fc-4c19-896a-99d3ef9d5f55`
- Prod Secrets: `CityBreaks/prod/secrets`

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
