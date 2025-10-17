import { DynamoDBClient, ListTablesCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const region = 'us-east-1';
const dynamodb = new DynamoDBClient({ region });

async function listAllTables() {
    console.log('=== LISTING ALL DYNAMODB TABLES ===');
    
    try {
        const command = new ListTablesCommand({});
        const response = await dynamodb.send(command);
        
        if (response.TableNames && response.TableNames.length > 0) {
            console.log('Available tables:');
            response.TableNames.forEach(tableName => {
                console.log(`- ${tableName}`);
            });
            
            // Check PracticeTools tables specifically
            const practiceToolsTables = response.TableNames.filter(name => 
                name.includes('PracticeTools')
            );
            
            if (practiceToolsTables.length > 0) {
                console.log('\nPracticeTools tables:');
                for (const tableName of practiceToolsTables) {
                    await checkTableContents(tableName);
                }
            }
        } else {
            console.log('No tables found');
        }
    } catch (error) {
        console.error('Error listing tables:', error.message);
    }
}

async function checkTableContents(tableName) {
    console.log(`\n--- Checking ${tableName} ---`);
    
    try {
        const scanCommand = new ScanCommand({
            TableName: tableName,
            Limit: 5
        });
        
        const response = await dynamodb.send(scanCommand);
        
        if (response.Items && response.Items.length > 0) {
            console.log(`Found ${response.Items.length} items (showing first 5):`);
            response.Items.forEach((item, index) => {
                const unmarshalled = unmarshall(item);
                console.log(`${index + 1}. ${JSON.stringify(unmarshalled, null, 2)}`);
            });
        } else {
            console.log('Table is empty');
        }
    } catch (error) {
        console.error(`Error scanning ${tableName}:`, error.message);
    }
}

listAllTables().catch(console.error);