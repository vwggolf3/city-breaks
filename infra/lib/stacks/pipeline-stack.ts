import * as cdk from "aws-cdk-lib";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as pipelines from "aws-cdk-lib/pipelines";
import { Construct } from "constructs";
import { FrontendStack } from "./frontend-stack";
import { LambdaStack } from "./lambda-stack";

export interface PipelineStackProps extends cdk.StackProps {
  codeConnectionArn: string;
  repositoryName: string;
  branchName: string;
}

export class PipelineStack extends cdk.Stack {
  public readonly pipeline: pipelines.CodePipeline;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const source = pipelines.CodePipelineSource.connection(
      props.repositoryName,
      props.branchName,
      {
        connectionArn: props.codeConnectionArn,
        triggerOnPush: true,
      }
    );

    const synth = new pipelines.ShellStep("Synth", {
      input: source,
      commands: [
        "npm install",
        "(cd infra && npm install)",
        "npm run lint",
        "npx -y @secretlint/quick-start '**/*'",
        'for dir in lambda/*/; do if [ -f "$dir/package.json" ]; then (cd "$dir" && npm install); fi; done',
        "npm run build",
        "cd infra",
        "npm run build",
        `npx -y cdk synth --context codeConnectionArn="${props.codeConnectionArn}" --context repositoryName="${props.repositoryName}" --context branchName="${props.branchName}"`,
      ],
      primaryOutputDirectory: "infra/cdk.out",
    });

    this.pipeline = new pipelines.CodePipeline(this, "Pipeline", {
      pipelineName: "CityBreaksPipeline",
      selfMutation: true,
      pipelineType: codepipeline.PipelineType.V2,
      synth,
      synthCodeBuildDefaults: {
        buildEnvironment: {
          computeType: codebuild.ComputeType.MEDIUM,
          buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        },
        partialBuildSpec: codebuild.BuildSpec.fromObject({
          version: "0.2",
          phases: {
            install: {
              "runtime-versions": {
                nodejs: "latest",
              },
            },
          },
        }),
      },
    });

    const deployStage = new cdk.Stage(this, "Deploy", {
      env: { account: this.account, region: this.region },
    });

    const lambdaStack = new LambdaStack(deployStage, "CityBreaksLambda-prod", {
      stackName: "CityBreaksLambda-prod",
      environment: "prod",
    });

    new FrontendStack(deployStage, "CityBreaksFrontend-prod", {
      stackName: "CityBreaksFrontend-prod",
      environment: "prod",
      buildOutputPath: "../dist",
      apiGatewayDomain: lambdaStack.apiGatewayDomain,
    });

    this.pipeline.addStage(deployStage);

    this.pipeline.buildPipeline();

    cdk.Tags.of(this).add("Stack", "Pipeline");
    cdk.Tags.of(this).add("aws-mcp:deploy:sop", "setup-pipeline");

    new cdk.CfnOutput(this, "PipelineName", {
      value: "CityBreaksPipeline",
      description: "CodePipeline Name",
    });

    new cdk.CfnOutput(this, "PipelineArn", {
      value: this.pipeline.pipeline.pipelineArn,
      description: "CodePipeline ARN",
    });
  }
}
