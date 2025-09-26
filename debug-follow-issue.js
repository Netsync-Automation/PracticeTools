import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function debugFollowIssue() {
    const email = 'mbgriffin@netsync.com';
    const cardId = '1758034589074';
    const practiceId = 'audiovisual-collaboration-contactcenter-iot-physicalsecurity';
    const columnId = '1';
    const cardKey = `${practiceId}_${columnId}_${cardId}`;
    
    console.log('=== DEBUGGING FOLLOW ISSUE ===');
    console.log(`Email: ${email}`);
    console.log(`Card ID: ${cardId}`);
    console.log(`Card Key: ${cardKey}`);
    console.log('');

    try {
        // 1. Check followers table for this specific card
        console.log('1. Checking followers table...');
        const followersResult = await dynamodb.scan({
            TableName: 'PracticeTools-dev-followers',
            FilterExpression: 'cardId = :cardId',
            ExpressionAttributeValues: {
                ':cardId': cardKey
            }
        }).promise();
        
        console.log(`Found ${followersResult.Items.length} followers for this card:`);
        followersResult.Items.forEach(item => {
            console.log(`  - ${item.email} (created: ${item.createdAt})`);
        });
        console.log('');

        // 2. Check if specific user is following
        const userFollowResult = await dynamodb.get({
            TableName: 'PracticeTools-dev-followers',
            Key: {
                cardId: cardKey,
                email: email
            }
        }).promise();
        
        console.log('2. Specific user follow status:');
        if (userFollowResult.Item) {
            console.log(`  ✓ ${email} IS following this card`);
            console.log(`  Created: ${userFollowResult.Item.createdAt}`);
        } else {
            console.log(`  ✗ ${email} is NOT following this card`);
        }
        console.log('');

        // 3. Check all followers for this user
        console.log('3. All cards this user is following:');
        const userFollowsResult = await dynamodb.scan({
            TableName: 'PracticeTools-dev-followers',
            FilterExpression: 'email = :email',
            ExpressionAttributeValues: {
                ':email': email
            }
        }).promise();
        
        console.log(`User is following ${userFollowsResult.Items.length} cards total:`);
        userFollowsResult.Items.forEach(item => {
            console.log(`  - Card: ${item.cardId} (created: ${item.createdAt})`);
        });
        console.log('');

        // 4. Test different card key formats
        console.log('4. Testing alternative card key formats...');
        const alternativeKeys = [
            cardId, // Just the card ID
            `${practiceId}_${cardId}`, // Without column
            `practice_${cardKey}`, // With practice prefix
            `card_${cardId}` // With card prefix
        ];

        for (const altKey of alternativeKeys) {
            const altResult = await dynamodb.get({
                TableName: 'PracticeTools-dev-followers',
                Key: {
                    cardId: altKey,
                    email: email
                }
            }).promise();
            
            if (altResult.Item) {
                console.log(`  ✓ Found with key: ${altKey}`);
            }
        }
        console.log('');

        // 5. Check recent entries in followers table
        console.log('5. Recent entries in followers table:');
        const recentResult = await dynamodb.scan({
            TableName: 'PracticeTools-dev-followers',
            Limit: 10
        }).promise();
        
        console.log('Last 10 entries:');
        recentResult.Items
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 10)
            .forEach(item => {
                console.log(`  - ${item.email} -> ${item.cardId} (${item.createdAt})`);
            });

    } catch (error) {
        console.error('Error during debugging:', error);
    }
}

debugFollowIssue();