#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { LambdaStack } from "../lib/stacks/lambda-stack";
import { FrontendStack } from "../lib/stacks/frontend-stack";
import { execSync } from "child_process";
import * as path from "path";

const app = new cdk.App();

const environment = app.node.tryGetContext("environment") ||
  `preview-${execSync("whoami").toString().trim()}`;

const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || "us-east-1";
const env = { account, region };

const buildOutputPath = path.join(__dirname, "../../dist");

const lambdaStack = new LambdaStack(app, `CityBreaksLambda-${environment}`, {
  env,
  environment,
  terminationProtection: environment === "prod",
});

const frontendStack = new FrontendStack(app, `CityBreaksFrontend-${environment}`, {
  env,
  environment,
  buildOutputPath,
  apiGatewayDomain: lambdaStack.apiGatewayDomain,
  terminationProtection: environment === "prod",
});

frontendStack.addDependency(lambdaStack);

cdk.Tags.of(app).add("Project", "CityBreaks");
cdk.Tags.of(app).add("ManagedBy", "CDK");
cdk.Tags.of(app).add("Environment", environment);
