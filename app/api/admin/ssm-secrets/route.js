import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb.js';


export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('env') || 'dev';
    
    // Get WebEx bots from database
    const webexBots = await db.getWebexBots();
    
    // Generate YAML format for App Runner
    const yamlLines = [];
    
    webexBots.forEach(bot => {
      if (bot.ssmPrefix) {
        const prefix = `WEBEX_${bot.ssmPrefix}`;
        const envPath = environment === 'prod' ? 'PracticeTools' : `PracticeTools/${environment}`;
        
        yamlLines.push(`    - name: ${prefix}_ACCESS_TOKEN`);
        yamlLines.push(`      value-from: arn:aws:ssm:us-east-1:501399536130:parameter/${envPath}/${prefix}_ACCESS_TOKEN`);
        yamlLines.push(`    - name: ${prefix}_ROOM_ID_1`);
        yamlLines.push(`      value-from: arn:aws:ssm:us-east-1:501399536130:parameter/${envPath}/${prefix}_ROOM_ID_1`);
        yamlLines.push(`    - name: ${prefix}_ROOM_NAME`);
        yamlLines.push(`      value-from: arn:aws:ssm:us-east-1:501399536130:parameter/${envPath}/${prefix}_ROOM_NAME`);
      }
    });
    
    // Add proper YAML formatting with empty line at end
    if (yamlLines.length > 0) {
      yamlLines.push('');
    }
    
    return NextResponse.json({
      success: true,
      environment,
      yamlFormat: yamlLines.join('\n')
    });
  } catch (error) {
    console.error('Error fetching WebEx bot SSM parameters:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}