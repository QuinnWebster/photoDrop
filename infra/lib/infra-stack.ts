import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. S3 bucket for storing images
    const photoBucket = new s3.Bucket(this, "PhotoBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedOrigins: ["*"], //Allow all
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
        },
      ],
    });

    // 2. Lambda to generate signed upload URLs
    const uploadLambda = new lambda.Function(this, "UploadLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/upload"), // <--- points to the folder
      environment: {
        BUCKET: photoBucket.bucketName,
      },
    });

    // Grant Lambda permission to put objects into the bucket
    photoBucket.grantPut(uploadLambda);

    // 3. API Gateway to expose Lambda
    const api = new apigateway.RestApi(this, "PhotoDropApi", {
      restApiName: "PhotoDrop Service",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      },
    });

    const uploadResource = api.root.addResource("get-upload-url");
    uploadResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(uploadLambda)
    );

    const photosTable = new dynamodb.Table(this, "PhotosTable", {
      partitionKey: { name: "photoId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const taggingLambda = new lambdaNodejs.NodejsFunction(
      this,
      "TaggingLambda",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: "lambda/tagging/index.js",
        handler: "handler",
        bundling: {
          forceDockerBundling: false, // <--- try local esbuild first
        },
        environment: {
          BUCKET: photoBucket.bucketName,
          TABLE_NAME: photosTable.tableName,
        },
      }
    );

    photoBucket.grantRead(taggingLambda);

    photoBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3n.LambdaDestination(taggingLambda)
    );

    taggingLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["rekognition:DetectLabels"],
        resources: ["*"],
      })
    );

    photosTable.grantWriteData(taggingLambda);

    const searchLambda = new lambdaNodejs.NodejsFunction(this, "SearchLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: "lambda/search/index.js",
      handler: "handler",
      environment: {
        TABLE_NAME: photosTable.tableName,
      },
    });

    photosTable.grantReadData(searchLambda);
    photoBucket.grantRead(searchLambda);

    const searchResource = api.root.addResource("search");
    searchResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(searchLambda),
      {
        authorizationType: apigateway.AuthorizationType.NONE,
        // 👇 This adds CORS preflight and proper headers
        methodResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": true,
            },
          },
        ],
      }
    );
    // Output the API URL after deploy
    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url ?? "Something went wrong",
    });
  }
}
