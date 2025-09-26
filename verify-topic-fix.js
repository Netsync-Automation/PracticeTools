#!/usr/bin/env node

/**
 * Verification script for practice board topic fix
 * This script checks the production database to show topic activity levels
 */

const { execSync } = require('child_process');

const PRACTICE_ID = 'audiovisual-collaboration-contactcenter-iot-physicalsecurity';
const REGION = 'us-east-1';

console.log('🔍 Practice Board Topic Analysis');
console.log('================================\n');

try {
  // Get all practice board settings for this practice
  const command = `aws dynamodb scan --table-name PracticeTools-prod-Settings --filter-expression "contains(setting_key, :board) AND contains(setting_key, :practice)" --expression-attribute-values "{\\":board\\":{\\"S\\":\\"practice_board\\"},\\":practice\\":{\\"S\\":\\"${PRACTICE_ID}\\"}}" --region ${REGION}`;
  
  const result = execSync(command, { encoding: 'utf8' });
  const data = JSON.parse(result);
  
  console.log(`Found ${data.Items.length} topics for practice board:\n`);
  
  const topics = [];
  
  data.Items.forEach(item => {
    const key = item.setting_key.S;
    const value = JSON.parse(item.setting_value.S);
    
    // Extract topic name from key
    let topicName = 'Main Topic';
    if (key.includes('_Pre_Sales')) {
      topicName = 'Pre-Sales';
    } else if (key.includes('_')) {
      const parts = key.split('_');
      if (parts.length > 3) {
        topicName = parts.slice(3).join('_').replace(/_/g, ' ');
      }
    }
    
    // Calculate activity level
    let latestActivity = 0;
    let cardCount = 0;
    
    if (value.columns) {
      value.columns.forEach(column => {
        if (column.cards) {
          cardCount += column.cards.length;
          column.cards.forEach(card => {
            const cardTime = new Date(card.lastEditedAt || card.createdAt).getTime();
            if (cardTime > latestActivity) {
              latestActivity = cardTime;
            }
          });
        }
      });
    }
    
    topics.push({
      name: topicName,
      key: key,
      cardCount: cardCount,
      latestActivity: latestActivity,
      lastUpdated: item.updated_at.S
    });
  });
  
  // Sort by latest activity
  topics.sort((a, b) => b.latestActivity - a.latestActivity);
  
  topics.forEach((topic, index) => {
    const isDefault = index === 0 ? ' ← WILL BE DEFAULT' : '';
    const activityDate = topic.latestActivity ? new Date(topic.latestActivity).toLocaleString() : 'No activity';
    
    console.log(`${index + 1}. "${topic.name}"${isDefault}`);
    console.log(`   Cards: ${topic.cardCount}`);
    console.log(`   Latest Activity: ${activityDate}`);
    console.log(`   Last Updated: ${new Date(topic.lastUpdated).toLocaleString()}`);
    console.log(`   Database Key: ${topic.key}`);
    console.log('');
  });
  
  console.log('📋 Summary:');
  console.log(`- Total topics: ${topics.length}`);
  console.log(`- Most active topic: "${topics[0]?.name}" (will be shown by default to new users)`);
  console.log(`- Users with saved preferences will still see their preferred topic`);
  
  if (topics.length > 1) {
    console.log('\n⚠️  ISSUE EXPLANATION:');
    console.log('Users are seeing different content because they have different topic preferences saved.');
    console.log('The fix will now show the most active topic by default for users without saved preferences.');
  }
  
} catch (error) {
  console.error('Error:', error.message);
  console.log('\nMake sure you have AWS CLI configured with the correct credentials.');
}