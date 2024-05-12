import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { join } from 'path';

export class TestFileServerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create an API Gateway REST API
    const api = new cdk.aws_apigateway.RestApi(this, 'Test-Api');

    // Create a DynamoDB table to store files
    const filesTable = new cdk.aws_dynamodb.Table(this, 'Test-Files', {
      partitionKey: { name: 'PK', type: cdk.aws_dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: cdk.aws_dynamodb.AttributeType.STRING },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Create an S3 bucket with CORS enabled
    const bucket = new cdk.aws_s3.Bucket(this, 'Test-Bucket', {
      cors: [
        {
          allowedMethods: [
            cdk.aws_s3.HttpMethods.GET,
            cdk.aws_s3.HttpMethods.PUT,
            cdk.aws_s3.HttpMethods.POST,
            cdk.aws_s3.HttpMethods.DELETE,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    // Create a Lambda function to upload a file
    const uploadFileLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'Test-UploadFile', {
      entry: join(__dirname, '..', 'handlers', 'uploadFile.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: filesTable.tableName,
        BUCKET_NAME: bucket.bucketName,
      },
    });
    filesTable.grantReadWriteData(uploadFileLambda);
    bucket.grantPut(uploadFileLambda);
    bucket.grantPutAcl(uploadFileLambda);

    // Plug the Lambda function into API Gateway, and enable CORS
    const uploadFileResource = api.root.addResource('uploadFile');
    uploadFileResource.addMethod('POST', new cdk.aws_apigateway.LambdaIntegration(uploadFileLambda));
    uploadFileResource.addCorsPreflight({
      allowOrigins: ['*'],
      allowMethods: ['POST'],
    });

    // Create a Lambda function to list files
    const listFilesLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'ListFiles', {
      entry: join(__dirname, "..", "handlers", 'listFiles.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: filesTable.tableName,
        BUCKET_NAME: bucket.bucketName,
      },
    });
    filesTable.grantReadData(listFilesLambda);
    bucket.grantRead(listFilesLambda);

    // Plug the Lambda function into API Gateway, and enable CORSs
    const listFilesResource = api.root.addResource('listFiles');
    listFilesResource.addMethod('POST', new cdk.aws_apigateway.LambdaIntegration(listFilesLambda));
    listFilesResource.addCorsPreflight({
      allowOrigins: ['*'],
      allowMethods: ['POST'],
    });
  }
}