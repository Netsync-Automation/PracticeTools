import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const bots = await db.getWebexBots();
    return NextResponse.json({ bots });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch WebEx bots' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const botConfig = await request.json();
    
    // Validate required fields
    if (!botConfig.name || !botConfig.practices || botConfig.practices.length === 0) {
      return NextResponse.json({ error: 'Name and practices are required' }, { status: 400 });
    }
    
    // Check if any practice already has a bot assigned
    const existingBots = await db.getWebexBots();
    for (const practice of botConfig.practices) {
      const existingBot = existingBots.find(bot => 
        bot.practices && bot.practices.includes(practice) && bot.id !== botConfig.id
      );
      if (existingBot) {
        return NextResponse.json({ 
          error: `Practice "${practice}" already has a WebEx bot assigned: ${existingBot.name}` 
        }, { status: 400 });
      }
    }
    
    // Use first practice alphabetically for SSM naming
    const practiceKey = botConfig.practices.sort()[0].toUpperCase().replace(/[^A-Z0-9]/g, '_');
    
    // Create SSM parameters for both prod and dev environments
    const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
    
    const ssmParams = [
      { name: `WEBEX_${practiceKey}_ACCESS_TOKEN`, value: botConfig.accessToken || 'PLACEHOLDER_TOKEN' },
      { name: `WEBEX_${practiceKey}_ROOM_ID_1`, value: botConfig.roomId || 'PLACEHOLDER_ROOM_ID' },
      { name: `WEBEX_${practiceKey}_ROOM_NAME`, value: botConfig.roomName || 'PLACEHOLDER_ROOM_NAME' }
    ];
    
    // Create parameters for both environments
    for (const env of ['prod', 'dev']) {
      for (const param of ssmParams) {
        const paramPath = env === 'prod' 
          ? `/PracticeTools/${param.name}`
          : `/PracticeTools/${env}/${param.name}`;
          
        try {
          await ssmClient.send(new PutParameterCommand({
            Name: paramPath,
            Value: param.value,
            Type: 'String',
            Overwrite: true
          }));
        } catch (error) {
          console.error(`Failed to create SSM parameter ${paramPath}:`, error);
        }
      }
    }
    
    // Update AppRunner YAML files with new environment variables
    try {
      const { updateAppRunnerYaml } = await import('../../../lib/apprunner-updater.js');
      await updateAppRunnerYaml(practiceKey, 'dev');
      await updateAppRunnerYaml(practiceKey, 'prod');
    } catch (error) {
      console.error('Failed to update AppRunner YAML files:', error);
      // Don't fail the entire operation if YAML update fails
    }
    
    // Save bot configuration
    const botId = await db.saveWebexBot({
      ...botConfig,
      ssmPrefix: practiceKey,
      createdAt: new Date().toISOString()
    });
    
    if (botId) {
      return NextResponse.json({ 
        success: true, 
        botId, 
        ssmPrefix: practiceKey,
        message: 'WebEx bot created successfully. Please redeploy the application to load new environment variables.'
      });
    } else {
      return NextResponse.json({ error: 'Failed to save bot configuration' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error creating WebEx bot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const botConfig = await request.json();
    
    if (!botConfig.id) {
      return NextResponse.json({ error: 'Bot ID required for update' }, { status: 400 });
    }
    
    // Check if any practice already has a bot assigned (excluding current bot)
    const existingBots = await db.getWebexBots();
    for (const practice of botConfig.practices) {
      const existingBot = existingBots.find(bot => 
        bot.practices && bot.practices.includes(practice) && bot.id !== botConfig.id
      );
      if (existingBot) {
        return NextResponse.json({ 
          error: `Practice "${practice}" already has a WebEx bot assigned: ${existingBot.name}` 
        }, { status: 400 });
      }
    }
    
    // Update SSM parameters with new values
    const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
    const practiceKey = botConfig.practices.sort()[0].toUpperCase().replace(/[^A-Z0-9]/g, '_');
    
    const ssmParams = [
      { name: `WEBEX_${practiceKey}_ACCESS_TOKEN`, value: botConfig.accessToken },
      { name: `WEBEX_${practiceKey}_ROOM_ID_1`, value: botConfig.roomId },
      { name: `WEBEX_${practiceKey}_ROOM_NAME`, value: botConfig.roomName }
    ];
    
    // Update parameters for both environments (only if values are provided)
    for (const env of ['prod', 'dev']) {
      for (const param of ssmParams) {
        if (param.value) {
          const paramPath = env === 'prod' 
            ? `/PracticeTools/${param.name}`
            : `/PracticeTools/${env}/${param.name}`;
            
          try {
            await ssmClient.send(new PutParameterCommand({
              Name: paramPath,
              Value: param.value,
              Type: 'String',
              Overwrite: true
            }));
          } catch (error) {
            console.error(`Failed to update SSM parameter ${paramPath}:`, error);
          }
        }
      }
    }
    
    // Update bot configuration
    const success = await db.saveWebexBot({
      ...botConfig,
      ssmPrefix: practiceKey,
      updatedAt: new Date().toISOString()
    });
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to update bot configuration' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error updating WebEx bot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const botId = searchParams.get('id');
    
    if (!botId) {
      return NextResponse.json({ error: 'Bot ID required' }, { status: 400 });
    }
    
    const success = await db.deleteWebexBot(botId);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to delete bot' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}