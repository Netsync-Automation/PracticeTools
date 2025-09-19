import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

// List of project manager names that were deleted from Users table
const deletedPMNames = [
    'Christi Hubbard',
    'LaQisha Marshall', 
    'Keith Arnst',
    'Jason Esry',
    'Brittany Hickman',
    'Brittney Hickman',
    'Kimberly Bowers',
    'Kimberly Bower',
    'Kim Bowers',
    'Kim Bower',
    'Kimberly Bowers-Hicks',
    'Kimberly Bower-Hicks',
    'Kim Bowers-Hicks',
    'Kim Bower-Hicks',
    'Kimberly Hicks',
    'Kim Hicks',
    'Kimberly Bowers Hicks',
    'Kim Bowers Hicks',
    'Kimberly Bower Hicks',
    'Kim Bower Hicks'
];

async function deletePMFromAssignments() {
    const tableName = 'PracticeTools-prod-resource-assignments';
    
    try {
        console.log('Scanning for resource assignments with deleted PMs...');
        
        const scanParams = {
            TableName: tableName
        };
        
        const scanResult = await docClient.send(new ScanCommand(scanParams));
        console.log(`Found ${scanResult.Items.length} total assignments to check`);
        
        let deletedCount = 0;
        
        for (const item of scanResult.Items) {
            const pmField = item.pm || '';
            
            // Check if the PM field contains any of the deleted PM names
            const containsDeletedPM = deletedPMNames.some(pmName => 
                pmField.toLowerCase().includes(pmName.toLowerCase())
            );
            
            if (containsDeletedPM) {
                console.log(`Deleting assignment ${item.assignment_number}: ${item.customerName} - PM: ${pmField}`);
                
                const deleteParams = {
                    TableName: tableName,
                    Key: {
                        id: item.id
                    }
                };
                
                await docClient.send(new DeleteCommand(deleteParams));
                deletedCount++;
            }
        }
        
        console.log(`Successfully deleted ${deletedCount} resource assignments with deleted PMs`);
        
    } catch (error) {
        console.error('Error deleting PM assignments:', error);
    }
}

deletePMFromAssignments();