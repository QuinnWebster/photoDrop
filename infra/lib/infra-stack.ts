import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as sagemaker from "aws-cdk-lib/aws-sagemaker";

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // API Gateway
    const api = new apigateway.RestApi(this, "PhotoDropApi", {
      restApiName: "PhotoDrop Service",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      },
    });

    // S3 bucket for storing images
    const photoBucket = new s3.Bucket(this, "PhotoBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // This bucket will be automatically destroyed when stack is deleted
      autoDeleteObjects: true, // Will delete all objects in the bucket when the bucketed is deleted
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

    // Lamda
    const uploadLambda = new lambda.Function(this, "UploadLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/upload"),
      environment: {
        BUCKET: photoBucket.bucketName, // The lambda will have access to this bucket
      },
    });

    // Grant Lambda permission to put objects into the bucket
    photoBucket.grantPut(uploadLambda);

    // API endpoint that returns a presigned URL for uploading images to S3
    // We dont want to upload directly to S3 from the client so we use lambda instead
    const uploadResource = api.root.addResource("get-upload-url");
    uploadResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(uploadLambda)
    );

    // DynamoDB table for storing photo metadata
    const photosTable = new dynamodb.Table(this, "PhotosTable", {
      partitionKey: { name: "photoId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda function for tagging photos
    // Uses NodejsFunction instead of Function since it uses external node modules
    // In future should use docker
    const taggingLambda = new lambdaNodejs.NodejsFunction(
      this,
      "TaggingLambda",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: "lambda/tagging/index.js",
        handler: "handler",
        bundling: {
          forceDockerBundling: false,
          externalModules: ["aws-sdk"],
        },
        environment: {
          BUCKET: photoBucket.bucketName, // So that the lambda can access the bucket
          TABLE_NAME: photosTable.tableName, // So that the lambda can access the table
        },
      }
    );

    photoBucket.grantRead(taggingLambda); // Allows photo tagging lambda to read from photo bucket
    photosTable.grantWriteData(taggingLambda); // Allows photo tagging lambda to write to ddb photos table

    // When a new image is uploaded, trigger the tagging lambda
    photoBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3n.LambdaDestination(taggingLambda)
    );

    // Allows tagging lambda to use Rekognition
    taggingLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["rekognition:DetectLabels"],
        resources: ["*"],
      })
    );

    // Lambda function for searching photos in ddb
    const searchLambda = new lambdaNodejs.NodejsFunction(this, "SearchLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: "lambda/search/index.js",
      handler: "handler",
      bundling: {
        forceDockerBundling: false,
        externalModules: ["aws-sdk"], // 👈 tells esbuild not to bundle aws-sdk
      },
      environment: {
        TABLE_NAME: photosTable.tableName,
        BUCKET: photoBucket.bucketName,
        SM_ENDPOINT_NAME: "your-sagemaker-endpoint", // if you embed here too
      },
    });

    photosTable.grantReadData(searchLambda); // Allows search lambda to read from ddb photos table
    photoBucket.grantRead(searchLambda); // Allows search lambda to read from photo bucket

    // Will hit the search lambda
    const searchResource = api.root.addResource("search");
    searchResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(searchLambda),
      {
        authorizationType: apigateway.AuthorizationType.NONE,
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

    const topTagsLambda = new lambda.Function(this, "TopTagsLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/topTags"),
      environment: {
        TABLE_NAME: photosTable.tableName,
      },
    });

    photosTable.grantReadData(topTagsLambda); // Allows top tags lambda to read to ddb photos table

    const topTagsResource = api.root.addResource("top-tags");
    topTagsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(topTagsLambda),
      {
        authorizationType: apigateway.AuthorizationType.NONE,
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

    const smRole = new iam.Role(this, "SmExecutionRole", {
      assumedBy: new iam.ServicePrincipal("sagemaker.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSageMakerFullAccess"),
      ],
    });

    // us-west-2
    const hfImageUri =
      "763104351884.dkr.ecr.us-west-2.amazonaws.com/huggingface-pytorch-inference:1.13.1-transformers4.26.0-cpu-py39-ubuntu20.04";

    // Declare the SageMaker model
    const model = new sagemaker.CfnModel(this, "EmbeddingsModel", {
      executionRoleArn: smRole.roleArn,
      primaryContainer: {
        image: hfImageUri,
        environment: {
          HF_TASK: "feature-extraction",
          HF_MODEL_ID: "sentence-transformers/all-MiniLM-L6-v2",
        },
      },
      modelName: "photo-embeddings-model",
    });

    const endpointConfig = new sagemaker.CfnEndpointConfig(
      this,
      "EmbeddingsConfig",
      {
        productionVariants: [
          {
            modelName: model.attrModelName,
            variantName: "AllTraffic",
            serverlessConfig: {
              memorySizeInMb: 2048,
              maxConcurrency: 5,
            },
          },
        ],
      }
    );

    const smEndpointName = "photo-embeddings-endpoint";
    const endpoint = new sagemaker.CfnEndpoint(this, "EmbeddingsEndpoint", {
      endpointName: smEndpointName,
      endpointConfigName: endpointConfig.attrEndpointConfigName,
    });
    endpoint.addDependency(endpointConfig);
    endpoint.addDependency(model);

    const invokeSm = new iam.PolicyStatement({
      actions: ["sagemaker:InvokeEndpoint"],
      resources: [
        `arn:aws:sagemaker:${cdk.Stack.of(this).region}:${
          cdk.Stack.of(this).account
        }:endpoint/${smEndpointName}`,
      ],
    });
    taggingLambda.addToRolePolicy(invokeSm);
    searchLambda.addToRolePolicy(invokeSm);

    taggingLambda.addEnvironment("SM_ENDPOINT_NAME", smEndpointName);
    searchLambda.addEnvironment("SM_ENDPOINT_NAME", smEndpointName);

    // We’ll also need BUCKET in search lambda to return signed URLs.
    searchLambda.addEnvironment("BUCKET", photoBucket.bucketName);

    // Output the API URL after deploy, so that it can be used in frontend
    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url ?? "Something went wrong",
    });
  }
}
