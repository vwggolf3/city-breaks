import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as path from "path";
import * as fs from "fs";
import { Construct } from "constructs";

export interface LambdaStackProps extends cdk.StackProps {
  environment: string;
}

export class LambdaStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly apiGatewayDomain: string;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);
    const { environment } = props;
    const isProd = environment === "prod";

    const appSecrets = secretsmanager.Secret.fromSecretNameV2(
      this, "AppSecrets", `CityBreaks/${environment}/secrets`
    );

    const lambdaRole = new iam.Role(this, "LambdaExecutionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      description: "Execution role for CityBreaks edge functions",
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
      ],
    });

    appSecrets.grantRead(lambdaRole);

    const logGroup = new logs.LogGroup(this, "ApiLogGroup", {
      logGroupName: `/aws/apigateway/${id}`,
      retention: isProd ? logs.RetentionDays.TEN_YEARS : logs.RetentionDays.ONE_WEEK,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const api = new apigateway.RestApi(this, "Api", {
      restApiName: id,
      description: `API for ${id}`,
      deployOptions: {
        stageName: "api",
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
        metricsEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
      },
    });

    const lambdaDir = path.join(__dirname, "../../../lambda");
    if (fs.existsSync(lambdaDir)) {
      const functionDirs = fs.readdirSync(lambdaDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name !== "shared")
        .map((d) => d.name);

      functionDirs.forEach((functionName) => {
        const fnLogGroup = new logs.LogGroup(this, `${functionName}LogGroup`, {
          logGroupName: `/aws/lambda/${id}-${functionName}`,
          retention: isProd ? logs.RetentionDays.TEN_YEARS : logs.RetentionDays.ONE_WEEK,
          removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });

        const fn = new NodejsFunction(this, functionName, {
          functionName: `${id}-${functionName}`,
          entry: path.join(lambdaDir, functionName, "index.ts"),
          handler: "handler",
          runtime: lambda.Runtime.NODEJS_LATEST,
          role: lambdaRole,
          timeout: cdk.Duration.seconds(30),
          memorySize: 512,
          environment: {
            SECRETS_ARN: appSecrets.secretArn,
            ENVIRONMENT: environment,
            API_GATEWAY_URL: `https://${api.restApiId}.execute-api.${this.region}.amazonaws.com/api`,
          },
          logGroup: fnLogGroup,
          bundling: {
            minify: true,
            sourceMap: true,
            externalModules: ["@aws-sdk/*"],
          },
        });

        const resource = api.root.addResource(functionName);
        const lambdaIntegration = new apigateway.LambdaIntegration(fn);
        resource.addMethod("POST", lambdaIntegration);
        resource.addMethod("GET", lambdaIntegration);

        new cdk.CfnOutput(this, `${functionName}Arn`, {
          value: fn.functionArn,
          description: `ARN for ${functionName} Lambda`,
        });
      });
    }

    this.api = api;
    this.apiGatewayDomain = `${this.api.restApiId}.execute-api.${this.region}.amazonaws.com`;

    new cdk.CfnOutput(this, "APIEndpoint", { value: api.url });
    new cdk.CfnOutput(this, "ApiId", { value: api.restApiId });
    new cdk.CfnOutput(this, "SecretsArn", { value: appSecrets.secretArn });

    cdk.Tags.of(this).add("Stack", "Lambda");
    cdk.Tags.of(this).add("aws-mcp:deploy:sop", "deploy-supabase-app");
  }
}
