const { LambdaClient, UpdateFunctionCodeCommand, CreateFunctionCommand, GetFunctionCommand } = require('@aws-sdk/client-lambda');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const archiver = require('archiver');
const path = require('path');

const lambdaClient = new LambdaClient({ region: 'us-east-1' });
const s3Client = new S3Client({ region: 'us-east-1' });

const FUNCTION_NAME = 'PracticeTools-DocumentProcessor';
const S3_BUCKET = 'netsync-practicetools-bucket';
const S3_KEY = 'lambda/document-processor.zip';

async function deployLambda() {
  try {
    console.log('Creating deployment package...');
    
    // Create zip file
    const output = fs.createWriteStream('document-processor.zip');
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', async () => {
      console.log(`Archive created: ${archive.pointer()} bytes`);
      
      try {
        // Upload to S3
        console.log('Uploading to S3...');
        const fileBuffer = fs.readFileSync('document-processor.zip');
        
        await s3Client.send(new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: S3_KEY,
          Body: fileBuffer,
          ContentType: 'application/zip'
        }));
        
        console.log('Uploaded to S3 successfully');
        
        // Check if function exists
        let functionExists = false;
        try {
          await lambdaClient.send(new GetFunctionCommand({ FunctionName: FUNCTION_NAME }));
          functionExists = true;
        } catch (error) {
          if (error.name !== 'ResourceNotFoundException') {
            throw error;
          }
        }
        
        if (functionExists) {
          // Update existing function
          console.log('Updating Lambda function...');
          await lambdaClient.send(new UpdateFunctionCodeCommand({
            FunctionName: FUNCTION_NAME,
            S3Bucket: S3_BUCKET,
            S3Key: S3_KEY
          }));
          console.log('Lambda function updated successfully');
        } else {
          console.log('Function does not exist. Please create it manually in AWS Console first.');
          console.log('Use the following configuration:');
          console.log('- Runtime: Node.js 22.x');
          console.log('- Handler: document-processor.handler');
          console.log('- Timeout: 15 minutes');
          console.log('- Memory: 1024 MB');
        }
        
        // Clean up
        fs.unlinkSync('document-processor.zip');
        
      } catch (error) {
        console.error('Deployment failed:', error);
        process.exit(1);
      }
    });
    
    archive.on('error', (err) => {
      throw err;
    });
    
    archive.pipe(output);
    archive.file('document-processor.js', { name: 'index.js' });
    archive.file('package.json');
    archive.finalize();
    
  } catch (error) {
    console.error('Error creating deployment package:', error);
    process.exit(1);
  }
}

deployLambda();