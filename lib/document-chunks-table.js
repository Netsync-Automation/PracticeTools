const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb');
const { getEnvironment } = require('./dynamodb');

const dynamodb = new DynamoDBClient({ region: 'us-east-1' });

const createDocumentChunksTable = async () => {
  const env = getEnvironment();
  const tableName = `PracticeTools-${env}-DocumentChunks`;
  
  const params = {
    TableName: tableName,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      {
        AttributeName: 'pk',
        AttributeType: 'S'
      },
      {
        AttributeName: 'sk',
        AttributeType: 'S'
      },
      {
        AttributeName: 'tenantId',
        AttributeType: 'S'
      }
    ],
    KeySchema: [
      {
        AttributeName: 'pk',
        KeyType: 'HASH'
      },
      {
        AttributeName: 'sk',
        KeyType: 'RANGE'
      }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'TenantIndex',
        KeySchema: [
          {
            AttributeName: 'tenantId',
            KeyType: 'HASH'
          }
        ],
        Projection: {
          ProjectionType: 'ALL'
        }
      }
    ]
  };
  
  try {
    const result = await dynamodb.send(new CreateTableCommand(params));
    console.log('DocumentChunks table created:', result.TableDescription.TableName);
    return result;
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log('DocumentChunks table already exists');
    } else {
      throw error;
    }
  }
};

module.exports = { createDocumentChunksTable };