import { S3Client, PutBucketNotificationConfigurationCommand, GetBucketNotificationConfigurationCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: 'us-east-1' });
const BUCKET_NAME = 'netsync-practicetools-bucket';

async function configureS3Events() {
  try {
    console.log('Configuring S3 event notifications...');
    
    // Get existing notification configuration
    let existingConfig;
    try {
      const getResult = await s3Client.send(new GetBucketNotificationConfigurationCommand({
        Bucket: BUCKET_NAME
      }));
      existingConfig = getResult;
    } catch (error) {
      existingConfig = {};
    }

    // Add Lambda configuration for document processing
    const notificationConfig = {
      ...existingConfig,
      LambdaConfigurations: [
        ...(existingConfig.LambdaConfigurations || []),
        {
          Id: 'DocumentProcessorTrigger',
          LambdaFunctionArn: 'arn:aws:lambda:us-east-1:501399536130:function:PracticeTools-DocumentProcessor',
          Events: ['s3:ObjectCreated:*'],
          Filter: {
            Key: {
              FilterRules: [
                {
                  Name: 'prefix',
                  Value: 'documentation/'
                },
                {
                  Name: 'suffix',
                  Value: ''
                }
              ]
            }
          }
        }
      ]
    };

    await s3Client.send(new PutBucketNotificationConfigurationCommand({
      Bucket: BUCKET_NAME,
      NotificationConfiguration: notificationConfig
    }));

    console.log('S3 event notifications configured successfully!');
    console.log('Lambda will be triggered for uploads to documentation/ prefix');
    
  } catch (error) {
    console.error('Error configuring S3 events:', error);
    console.log('\nManual steps required:');
    console.log('1. Go to AWS S3 Console');
    console.log('2. Select bucket: netsync-practicetools-bucket');
    console.log('3. Go to Properties > Event notifications');
    console.log('4. Create notification for ObjectCreated events');
    console.log('5. Set destination to Lambda: PracticeTools-DocumentProcessor');
    console.log('6. Set prefix filter: documentation/');
  }
}

configureS3Events();