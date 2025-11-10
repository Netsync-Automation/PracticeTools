import { DynamoDBClient, ListTablesCommand, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });

async function checkAndCreateTables() {
    try {
        console.log('🔍 Checking existing DynamoDB tables...\n');
        
        const listResult = await client.send(new ListTablesCommand({}));
        const existingTables = listResult.TableNames || [];
        
        console.log('📋 Existing tables:');
        const practiceToolsTables = existingTables.filter(name => name.startsWith('PracticeTools'));
        if (practiceToolsTables.length === 0) {
            console.log('❌ No PracticeTools tables found');
        } else {
            practiceToolsTables.forEach(table => console.log(`✅ ${table}`));
        }
        
        // Check specifically for Sites tables
        const devSitesTable = 'PracticeTools-dev-Sites';
        const prodSitesTable = 'PracticeTools-prod-Sites';
        
        console.log('\n🔍 Checking Sites tables:');
        console.log(`Dev Sites table (${devSitesTable}):`, existingTables.includes(devSitesTable) ? '✅ EXISTS' : '❌ MISSING');
        console.log(`Prod Sites table (${prodSitesTable}):`, existingTables.includes(prodSitesTable) ? '✅ EXISTS' : '❌ MISSING');
        
        // If no Sites tables exist, this explains why the save didn't work
        if (!existingTables.includes(devSitesTable) && !existingTables.includes(prodSitesTable)) {
            console.log('\n⚠️  ISSUE IDENTIFIED:');
            console.log('The Sites tables do not exist in DynamoDB.');
            console.log('This explains why saving the site configuration failed.');
            console.log('The tables need to be created before sites can be saved.');
        }
        
    } catch (error) {
        console.error('❌ Error checking tables:', error.message);
    }
}

checkAndCreateTables();