import { NextResponse } from 'next/server';
import { getEnvironment, getTableName } from '../../../../lib/dynamodb';
import { GetItemCommand, PutItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { db } from '../../../../lib/dynamodb';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const practiceId = searchParams.get('practiceId');

    if (!practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 });
    }

    const tableName = getTableName('Settings');
    const environment = getEnvironment();
    
    console.log('🔍 [DEBUG] Getting templates for practiceId:', practiceId);
    console.log('🔍 [DEBUG] Environment:', environment);
    console.log('🔍 [DEBUG] Table name:', tableName);
    
    // Get templates
    const templatesCommand = new GetItemCommand({
      TableName: tableName,
      Key: {
        setting_key: { S: `${environment}_checklist-templates-${practiceId}` }
      }
    });

    const templatesResult = await db.client.send(templatesCommand);
    const templates = templatesResult.Item?.setting_value?.S ? JSON.parse(templatesResult.Item.setting_value.S) : [];
    
    console.log('🔍 [DEBUG] Found templates:', templates.length);
    templates.forEach((template, index) => {
      console.log(`🔍 [DEBUG] Template ${index}:`, { id: template.id, name: template.name, items: template.items });
    });
    
    // Count template usage across all topics
    const templateUsage = {};
    templates.forEach(template => {
      templateUsage[template.id] = 0;
    });

    // Get all board data for this practice (all topics) - DSR compliant with environment prefix
    const { ScanCommand } = await import('@aws-sdk/client-dynamodb');
    const scanCommand = new ScanCommand({
      TableName: tableName,
      FilterExpression: 'begins_with(setting_key, :prefix)',
      ExpressionAttributeValues: {
        ':prefix': { S: `${environment}_practice_board_${practiceId}` }
      }
    });
    
    console.log('🔍 [DEBUG] Scanning with DSR compliant prefix:', `${environment}_practice_board_${practiceId}`);

    const scanResult = await db.client.send(scanCommand);
    
    console.log('🔍 [DEBUG] Scan found items:', scanResult.Items?.length || 0);
    scanResult.Items?.forEach(item => {
      console.log('🔍 [DEBUG] Board key:', item.setting_key?.S);
    });
    
    // Check all board data for template usage
    scanResult.Items?.forEach(item => {
      if (item.setting_value?.S) {
        try {
          const boardData = JSON.parse(item.setting_value.S);
          console.log('🔍 [DEBUG] Board data structure:', {
            hasColumns: !!boardData.columns,
            columnsCount: boardData.columns?.length || 0
          });
          
          if (boardData.columns) {
            boardData.columns.forEach((column, colIndex) => {
              console.log(`🔍 [DEBUG] Column ${colIndex}:`, {
                title: column.title,
                cardsCount: column.cards?.length || 0
              });
              
              if (column.cards) {
                column.cards.forEach((card, cardIndex) => {
                  if (card.checklists) {
                    console.log(`🔍 [DEBUG] Card ${cardIndex} (${card.title}) has ${card.checklists.length} checklists`);
                    
                    card.checklists.forEach((checklist, checklistIndex) => {
                      console.log(`🔍 [DEBUG] Checklist ${checklistIndex}:`, {
                        name: checklist.name,
                        itemsCount: checklist.items?.length || 0,
                        items: checklist.items?.map(item => item.text || item)
                      });
                      
                      // Find matching template by comparing name and items
                      const matchingTemplate = templates.find(template => {
                        const nameMatch = template.name === checklist.name;
                        const lengthMatch = template.items.length === checklist.items.length;
                        const itemsMatch = template.items.every((item, index) => 
                          checklist.items[index] && checklist.items[index].text === item
                        );
                        
                        console.log(`🔍 [DEBUG] Template match check for "${template.name}":`, {
                          nameMatch,
                          lengthMatch,
                          itemsMatch,
                          templateItems: template.items,
                          checklistItems: checklist.items?.map(item => item.text || item)
                        });
                        
                        return nameMatch && lengthMatch && itemsMatch;
                      });
                      
                      if (matchingTemplate) {
                        console.log(`🔍 [DEBUG] Found match! Template "${matchingTemplate.name}" used in card "${card.title}"`);
                        templateUsage[matchingTemplate.id]++;
                      }
                    });
                  }
                });
              }
            });
          }
        } catch (parseError) {
          console.error('Error parsing board data:', parseError);
        }
      }
    });
    
    console.log('🔍 [DEBUG] Final template usage counts:', templateUsage);

    // Add usage count to templates
    const templatesWithUsage = templates.map(template => ({
      ...template,
      usageCount: templateUsage[template.id] || 0
    }));
    
    return NextResponse.json({
      templates: templatesWithUsage
    });

  } catch (error) {
    console.error('Error loading checklist templates:', error);
    return NextResponse.json({ templates: [] });
  }
}

export async function POST(request) {
  try {
    const { practiceId, name, items } = await request.json();

    if (!practiceId || !name || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Practice ID, name, and items are required' }, { status: 400 });
    }

    const tableName = getTableName('Settings');
    const environment = getEnvironment();
    
    // Get existing templates
    const getCommand = new GetItemCommand({
      TableName: tableName,
      Key: {
        setting_key: { S: `${environment}_checklist-templates-${practiceId}` }
      }
    });

    const existing = await db.client.send(getCommand);
    const currentTemplates = existing.Item?.setting_value?.S ? JSON.parse(existing.Item.setting_value.S) : [];

    // Add new template
    const newTemplate = {
      id: `template-${Date.now()}`,
      name,
      items,
      createdAt: new Date().toISOString()
    };

    const updatedTemplates = [...currentTemplates, newTemplate];

    // Save updated templates
    const putCommand = new PutItemCommand({
      TableName: tableName,
      Item: {
        setting_key: { S: `${environment}_checklist-templates-${practiceId}` },
        setting_value: { S: JSON.stringify(updatedTemplates) },
        updated_at: { S: new Date().toISOString() }
      }
    });

    await db.client.send(putCommand);

    return NextResponse.json({
      success: true,
      template: newTemplate
    });

  } catch (error) {
    console.error('Error saving checklist template:', error);
    return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { practiceId, templateId, name, items } = await request.json();

    if (!practiceId || !templateId || !name || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Practice ID, template ID, name, and items are required' }, { status: 400 });
    }

    const tableName = getTableName('Settings');
    const environment = getEnvironment();
    
    // Get existing templates
    const getCommand = new GetItemCommand({
      TableName: tableName,
      Key: {
        setting_key: { S: `${environment}_checklist-templates-${practiceId}` }
      }
    });

    const existing = await db.client.send(getCommand);
    const currentTemplates = existing.Item?.setting_value?.S ? JSON.parse(existing.Item.setting_value.S) : [];

    // Update template
    const updatedTemplates = currentTemplates.map(template => 
      template.id === templateId 
        ? { ...template, name, items, updatedAt: new Date().toISOString() }
        : template
    );

    // Save updated templates
    const putCommand = new PutItemCommand({
      TableName: tableName,
      Item: {
        setting_key: { S: `${environment}_checklist-templates-${practiceId}` },
        setting_value: { S: JSON.stringify(updatedTemplates) },
        updated_at: { S: new Date().toISOString() }
      }
    });

    await db.client.send(putCommand);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating checklist template:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const practiceId = searchParams.get('practiceId');
    const templateId = searchParams.get('templateId');

    if (!practiceId || !templateId) {
      return NextResponse.json({ error: 'Practice ID and template ID are required' }, { status: 400 });
    }

    const tableName = getTableName('Settings');
    const environment = getEnvironment();
    
    // Get existing templates
    const getCommand = new GetItemCommand({
      TableName: tableName,
      Key: {
        setting_key: { S: `${environment}_checklist-templates-${practiceId}` }
      }
    });

    const existing = await db.client.send(getCommand);
    const currentTemplates = existing.Item?.setting_value?.S ? JSON.parse(existing.Item.setting_value.S) : [];

    // Remove template
    const updatedTemplates = currentTemplates.filter(template => template.id !== templateId);

    // Save updated templates
    const putCommand = new PutItemCommand({
      TableName: tableName,
      Item: {
        setting_key: { S: `${environment}_checklist-templates-${practiceId}` },
        setting_value: { S: JSON.stringify(updatedTemplates) },
        updated_at: { S: new Date().toISOString() }
      }
    });

    await db.client.send(putCommand);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting checklist template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}