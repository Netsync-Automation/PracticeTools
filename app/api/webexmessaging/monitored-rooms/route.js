import { NextResponse } from 'next/server';
import { SSMClient, PutParameterCommand, GetParameterCommand, DeleteParameterCommand } from '@aws-sdk/client-ssm';
import { promises as fs } from 'fs';
import path from 'path';

const ssmClient = new SSMClient({ region: 'us-east-1' });
const env = process.env.ENVIRONMENT || 'dev';

function getSitePrefix(siteUrl) {
  return siteUrl.split('.')[0].toUpperCase();
}

function getParameterName(sitePrefix, type, index) {
  const basePath = env === 'prod' ? 'PracticeTools' : `PracticeTools/${env}`;
  return `/${basePath}/${sitePrefix}_WEBEX_MESSAGING_${type}_${index}`;
}

async function updateYamlFile(filePath, sitePrefix, rooms) {
  let content = await fs.readFile(filePath, 'utf-8');
  const isProd = filePath.includes('prod');
  const paramPath = isProd ? 'PracticeTools' : 'PracticeTools/dev';
  
  const lines = content.split('\n');
  const filtered = lines.filter(line => !line.includes(`${sitePrefix}_WEBEX_MESSAGING_`));
  
  if (!filtered[filtered.length - 1].trim()) {
    filtered.pop();
  }
  
  filtered.push(`    - name: ${sitePrefix}_WEBEX_MESSAGING_BOT_TOKEN_1`);
  filtered.push(`      value-from: arn:aws:ssm:us-east-1:501399536130:parameter/${paramPath}/${sitePrefix}_WEBEX_MESSAGING_BOT_TOKEN_1`);
  
  rooms.forEach((room, index) => {
    const num = index + 1;
    filtered.push(`    - name: ${sitePrefix}_WEBEX_MESSAGING_ROOM_NAME_${num}`);
    filtered.push(`      value-from: arn:aws:ssm:us-east-1:501399536130:parameter/${paramPath}/${sitePrefix}_WEBEX_MESSAGING_ROOM_NAME_${num}`);
    filtered.push(`    - name: ${sitePrefix}_WEBEX_MESSAGING_ROOM_ID_${num}`);
    filtered.push(`      value-from: arn:aws:ssm:us-east-1:501399536130:parameter/${paramPath}/${sitePrefix}_WEBEX_MESSAGING_ROOM_ID_${num}`);
  });
  
  await fs.writeFile(filePath, filtered.join('\n'), 'utf-8');
}

export async function POST(request) {
  try {
    const { siteUrl, botToken, monitoredRooms } = await request.json();
    
    if (!siteUrl || !monitoredRooms) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const sitePrefix = getSitePrefix(siteUrl);
    
    // Store bot token if provided
    if (botToken) {
      await ssmClient.send(new PutParameterCommand({
        Name: getParameterName(sitePrefix, 'BOT_TOKEN', '1'),
        Value: botToken,
        Type: 'String',
        Overwrite: true
      }));
    }
    
    // Get existing rooms to compare
    const existingRooms = [];
    for (let i = 1; i <= 50; i++) {
      try {
        const idParam = await ssmClient.send(new GetParameterCommand({
          Name: getParameterName(sitePrefix, 'ROOM_ID', i)
        }));
        existingRooms.push({ index: i, id: idParam.Parameter.Value });
      } catch (e) {
        break;
      }
    }
    
    // Delete rooms that are no longer in the list
    for (const existing of existingRooms) {
      if (!monitoredRooms.find(r => r.id === existing.id)) {
        try {
          await ssmClient.send(new DeleteParameterCommand({
            Name: getParameterName(sitePrefix, 'ROOM_NAME', existing.index)
          }));
        } catch (e) {}
        try {
          await ssmClient.send(new DeleteParameterCommand({
            Name: getParameterName(sitePrefix, 'ROOM_ID', existing.index)
          }));
        } catch (e) {}
      }
    }
    
    // Create or update monitored rooms
    for (let i = 0; i < monitoredRooms.length; i++) {
      const room = monitoredRooms[i];
      const num = i + 1;
      
      await ssmClient.send(new PutParameterCommand({
        Name: getParameterName(sitePrefix, 'ROOM_NAME', num),
        Value: room.title,
        Type: 'String',
        Overwrite: true
      }));
      
      await ssmClient.send(new PutParameterCommand({
        Name: getParameterName(sitePrefix, 'ROOM_ID', num),
        Value: room.id,
        Type: 'String',
        Overwrite: true
      }));
    }
    
    // Update YAML files
    const projectRoot = process.cwd();
    await updateYamlFile(path.join(projectRoot, 'apprunner-dev.yaml'), sitePrefix, monitoredRooms);
    await updateYamlFile(path.join(projectRoot, 'apprunner-prod.yaml'), sitePrefix, monitoredRooms);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving monitored rooms:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const siteUrl = searchParams.get('siteUrl');
    
    if (!siteUrl) {
      return NextResponse.json({ error: 'siteUrl is required' }, { status: 400 });
    }
    
    const sitePrefix = getSitePrefix(siteUrl);
    const rooms = [];
    let botToken = '';
    
    // Get bot token
    try {
      const botTokenParam = await ssmClient.send(new GetParameterCommand({
        Name: getParameterName(sitePrefix, 'BOT_TOKEN', '1')
      }));
      botToken = botTokenParam.Parameter.Value;
    } catch (e) {}
    
    // Get monitored rooms
    for (let i = 1; i <= 50; i++) {
      try {
        const nameParam = await ssmClient.send(new GetParameterCommand({
          Name: getParameterName(sitePrefix, 'ROOM_NAME', i)
        }));
        const idParam = await ssmClient.send(new GetParameterCommand({
          Name: getParameterName(sitePrefix, 'ROOM_ID', i)
        }));
        
        rooms.push({
          title: nameParam.Parameter.Value,
          id: idParam.Parameter.Value
        });
      } catch (e) {
        break;
      }
    }
    
    return NextResponse.json({ botToken, rooms });
  } catch (error) {
    console.error('Error loading monitored rooms:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
