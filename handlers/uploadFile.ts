import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const dynamoDBClient = new DynamoDBClient({});
const s3Client = new S3Client({});

export const handler = async (event: {
  body: string;
}): Promise<{ statusCode: number; body: string; headers: unknown }> => {
  const tableName = process.env.TABLE_NAME;
  const bucketName = process.env.BUCKET_NAME;

if (tableName === undefined || bucketName === undefined) {
    throw new Error('Missing environment variable');
  }

  const { userId, fileName } = JSON.parse(event.body) as { userId?: string; fileName?: string };

  if (userId === undefined || fileName === undefined) {
    return Promise.resolve({
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing userId or fileName' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  await dynamoDBClient.send(
    new PutItemCommand({
      TableName: tableName,
      Item: {
        PK: { S: userId },
        SK: { S: fileName },
      },
    }),
  );

  const uploadUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: bucketName,
      Key: `${userId}/${fileName}`,
    }),
    { expiresIn: 60 },
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ uploadUrl }),
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  };
};