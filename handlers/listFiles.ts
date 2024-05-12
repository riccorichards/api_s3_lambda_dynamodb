import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const dynamoDBClient = new DynamoDBClient({});
const s3Client = new S3Client({});

export const handler = async ({
  body,
}: {
  body: string;
}): Promise<{ statusCode: number; body: string; headers: unknown }> => {
  const tableName = process.env.TABLE_NAME;
  const bucketName = process.env.BUCKET_NAME;

  if (tableName === undefined || bucketName === undefined) {
    throw new Error('Missing environment variable');
  }

  const { userId } = JSON.parse(body) as { userId?: string };

  if (userId === undefined) {
    return Promise.resolve({
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing userId' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const { Items: files = [] } = await dynamoDBClient.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': { S: userId },
      },
    }),
  );

  const filesWithPresignedUrls = await Promise.all(
    files.map(async ({ SK }) => {
      const fileName = SK?.S ?? '';

      const downloadUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: bucketName,
          Key: `${userId}/${fileName}`,
        }),
        { expiresIn: 60 },
      );

      return { fileName, downloadUrl };
    }),
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ files: filesWithPresignedUrls }),
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  };
};