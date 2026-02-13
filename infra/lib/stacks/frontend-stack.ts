import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { CloudFrontToS3 } from "@aws-solutions-constructs/aws-cloudfront-s3";
import { Construct } from "constructs";

export interface FrontendStackProps extends cdk.StackProps {
  environment: string;
  buildOutputPath: string;
  apiGatewayDomain: string;
}

export class FrontendStack extends cdk.Stack {
  public readonly distributionDomainName: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);
    const { environment, buildOutputPath, apiGatewayDomain } = props;
    const isProd = environment === "prod";
    const removalPolicy = isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    const apiOrigin = new origins.HttpOrigin(apiGatewayDomain, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      originPath: "",
      customHeaders: { "X-Origin": "CloudFront" },
    });

    const cspFunction = new cloudfront.Function(this, "CspFunction", {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`
        function handler(event) {
          var response = event.response;
          response.headers['content-security-policy'] = {
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:; style-src 'self' 'unsafe-inline' https:; font-src 'self' https: data:; img-src 'self' https: data: blob:; connect-src 'self' https: wss:; frame-src 'self' https:; media-src 'self' https: blob:; worker-src 'self' https: blob:; object-src 'self' https:; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
          };
          return response;
        }
      `),
      comment: "Adds Content-Security-Policy header",
    });

    const cloudfrontToS3 = new CloudFrontToS3(this, "CFToS3", {
      bucketProps: {
        removalPolicy,
        autoDeleteObjects: !isProd,
        versioned: false,
        enforceSSL: true,
      },
      loggingBucketProps: {
        removalPolicy,
        autoDeleteObjects: !isProd,
        lifecycleRules: [{ id: "DeleteOldLogs", enabled: true, expiration: isProd ? cdk.Duration.days(3650) : cdk.Duration.days(7) }],
        enforceSSL: true,
      },
      cloudFrontLoggingBucketProps: {
        removalPolicy,
        autoDeleteObjects: !isProd,
        lifecycleRules: [{ id: "DeleteOldLogs", enabled: true, expiration: isProd ? cdk.Duration.days(3650) : cdk.Duration.days(7) }],
        enforceSSL: true,
      },
      insertHttpSecurityHeaders: false,
      cloudFrontDistributionProps: {
        comment: `${id} - ${environment}`,
        defaultRootObject: "index.html",
        defaultBehavior: {
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
          functionAssociations: [
            { function: cspFunction, eventType: cloudfront.FunctionEventType.VIEWER_RESPONSE },
          ],
        },
        additionalBehaviors: {
          "/api/*": {
            origin: apiOrigin,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
            responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
          },
        },
        errorResponses: [
          { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html", ttl: cdk.Duration.minutes(5) },
          { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html", ttl: cdk.Duration.minutes(5) },
        ],
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        enableIpv6: true,
        httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      },
    });

    const websiteBucket = cloudfrontToS3.s3Bucket!;
    const distribution = cloudfrontToS3.cloudFrontWebDistribution;

    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [s3deploy.Source.asset(buildOutputPath)],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ["/*"],
      prune: true,
      memoryLimit: 512,
    });

    this.distributionDomainName = distribution.distributionDomainName;

    new cdk.CfnOutput(this, "WebsiteURL", { value: `https://${distribution.distributionDomainName}` });
    new cdk.CfnOutput(this, "BucketName", { value: websiteBucket.bucketName });
    new cdk.CfnOutput(this, "DistributionId", { value: distribution.distributionId });
    new cdk.CfnOutput(this, "ApiProxyPath", { value: "/api/*" });

    cdk.Tags.of(this).add("Stack", "Frontend");
    cdk.Tags.of(this).add("aws-mcp:deploy:sop", "deploy-supabase-app");
  }
}
