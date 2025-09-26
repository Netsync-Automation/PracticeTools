import { NextResponse } from 'next/server';
import { db, getEnvironment } from '../../../../lib/dynamodb.js';
import { validateUserSession } from '../../../../lib/auth-check.js';


export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const practiceId = searchParams.get('practiceId');
    
    if (!practiceId) {
      return NextResponse.json({ error: 'Practice ID required' }, { status: 400 });
    }

    // Get topics for this practice - DSR compliant with environment prefix
    const environment = getEnvironment();
    const topicsKey = `${environment}_practice_topics_${practiceId}`;
    const topicsData = await db.getSetting(topicsKey);
    
    let topics = ['Main Topic'];
    if (topicsData) {
      const parsed = JSON.parse(topicsData);
      topics = parsed.topics || ['Main Topic'];
    } else {
      // Auto-discover topics from existing board data if no topics list exists
      try {
        const allSettings = await db.getAllSettings();
        const discoveredTopics = new Set(['Main Topic']);
        
        // Look for practice board keys that match this practice
        const boardKeyPrefix = `${environment}_practice_board_${practiceId}`;
        
        for (const setting of allSettings) {
          if (setting.setting_key.startsWith(boardKeyPrefix)) {
            try {
              const boardData = JSON.parse(setting.setting_value);
              if (boardData.topic) {
                discoveredTopics.add(boardData.topic);
              }
            } catch (parseError) {
              console.warn('Failed to parse board data for topic discovery:', setting.setting_key);
            }
          }
        }
        
        topics = Array.from(discoveredTopics).sort((a, b) => {
          if (a === 'Main Topic') return -1;
          if (b === 'Main Topic') return 1;
          return a.localeCompare(b);
        });
        
        // Save the discovered topics for future use
        if (topics.length > 1) {
          await db.saveSetting(topicsKey, JSON.stringify({ topics }));
        }
      } catch (error) {
        console.error('Error discovering topics:', error);
      }
    }
    
    return NextResponse.json({ topics });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load topics' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { practiceId, topic } = await request.json();
    
    if (!practiceId || !topic) {
      return NextResponse.json({ error: 'Practice ID and topic required' }, { status: 400 });
    }

    // DSR: Check topic creation permissions
    const user = validation.user;
    const canCreateTopics = user.isAdmin || 
      (user.role === 'practice_manager' || user.role === 'practice_principal');
    
    if (!canCreateTopics) {
      return NextResponse.json({ error: 'Only practice managers and principals can create topics' }, { status: 403 });
    }

    // Get existing topics - DSR compliant with environment prefix
    const environment = getEnvironment();
    const topicsKey = `${environment}_practice_topics_${practiceId}`;
    const topicsData = await db.getSetting(topicsKey);
    
    let topics = ['Main Topic'];
    if (topicsData) {
      const parsed = JSON.parse(topicsData);
      topics = parsed.topics || ['Main Topic'];
    } else {
      // Auto-discover topics from existing board data if no topics list exists
      try {
        const allSettings = await db.getAllSettings();
        const discoveredTopics = new Set(['Main Topic']);
        
        // Look for practice board keys that match this practice
        const boardKeyPrefix = `${environment}_practice_board_${practiceId}`;
        
        for (const setting of allSettings) {
          if (setting.setting_key.startsWith(boardKeyPrefix)) {
            try {
              const boardData = JSON.parse(setting.setting_value);
              if (boardData.topic) {
                discoveredTopics.add(boardData.topic);
              }
            } catch (parseError) {
              console.warn('Failed to parse board data for topic discovery:', setting.setting_key);
            }
          }
        }
        
        topics = Array.from(discoveredTopics).sort((a, b) => {
          if (a === 'Main Topic') return -1;
          if (b === 'Main Topic') return 1;
          return a.localeCompare(b);
        });
      } catch (error) {
        console.error('Error discovering topics:', error);
      }
    }
    
    // Add new topic if it doesn't exist
    if (!topics.includes(topic)) {
      topics.push(topic);
      await db.saveSetting(topicsKey, JSON.stringify({ topics }));
      
      // Create initial board data for the new topic - DSR compliant with environment prefix
      const topicBoardKey = `${environment}_practice_board_${practiceId}_${topic.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const boardColumns = await db.getBoardColumns(practiceId);
      const defaultColumns = boardColumns.map(col => ({
        id: col.id,
        title: col.title,
        cards: [],
        createdBy: 'system',
        createdAt: new Date().toISOString()
      }));
      
      await db.saveSetting(topicBoardKey, JSON.stringify({
        columns: defaultColumns,
        topic,
        practiceId,
        createdAt: new Date().toISOString(),
        createdBy: user.email
      }));
      
      // Send SSE notification for topic added
      try {
        const { notifyClients } = await import('../../events/route.js');
        notifyClients(`practice-board-${practiceId}`, {
          type: 'topic_added',
          topics: topics,
          newTopic: topic,
          timestamp: Date.now()
        });
      } catch (sseError) {
        console.error('SSE notification failed:', sseError);
      }
    }
    
    return NextResponse.json({ success: true, topics });
  } catch (error) {
    console.error('Error adding topic:', error);
    return NextResponse.json({ error: 'Failed to add topic' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { practiceId, oldTopic, newTopic } = await request.json();
    
    if (!practiceId || !oldTopic || !newTopic) {
      return NextResponse.json({ error: 'Practice ID, old topic, and new topic required' }, { status: 400 });
    }

    // Check permissions - simplified approach
    const user = validation.user;
    const canEdit = user.isAdmin || 
      (user.role === 'practice_manager' || user.role === 'practice_principal');
    
    if (!canEdit) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Prevent renaming Main Topic
    if (oldTopic === 'Main Topic') {
      return NextResponse.json({ error: 'Cannot rename Main Topic' }, { status: 400 });
    }
    
    // Update topics list - DSR compliant with environment prefix
    const environment = getEnvironment();
    const topicsKey = `${environment}_practice_topics_${practiceId}`;
    const topicsData = await db.getSetting(topicsKey);
    
    let topics = ['Main Topic'];
    if (topicsData) {
      const parsed = JSON.parse(topicsData);
      topics = parsed.topics || ['Main Topic'];
    }
    
    const topicIndex = topics.indexOf(oldTopic);
    if (topicIndex !== -1) {
      topics[topicIndex] = newTopic;
      await db.saveSetting(topicsKey, JSON.stringify({ topics }));
      
      // Handle board data key rename for non-main topics only - DSR compliant with environment prefix
      const oldKey = `${environment}_practice_board_${practiceId}_${oldTopic.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const newKey = `${environment}_practice_board_${practiceId}_${newTopic.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      const oldBoardData = await db.getSetting(oldKey);
      if (oldBoardData) {
        const boardContent = JSON.parse(oldBoardData);
        boardContent.topic = newTopic;
        await db.saveSetting(newKey, JSON.stringify(boardContent));
        await db.deleteSetting(oldKey);
      }
      
      // Send SSE notification for topic renamed
      try {
        const { notifyClients } = await import('../../events/route.js');
        notifyClients(`practice-board-${practiceId}`, {
          type: 'topic_renamed',
          topics: topics,
          oldTopic: oldTopic,
          newTopic: newTopic,
          timestamp: Date.now()
        });
      } catch (sseError) {
        console.error('SSE notification failed:', sseError);
      }
    }
    
    return NextResponse.json({ success: true, topics });
  } catch (error) {
    console.error('Error updating topic:', error);
    return NextResponse.json({ error: 'Failed to update topic' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { practiceId, topic } = await request.json();
    
    if (!practiceId || !topic) {
      return NextResponse.json({ error: 'Practice ID and topic required' }, { status: 400 });
    }

    if (topic === 'Main Topic') {
      return NextResponse.json({ error: 'Cannot delete Main Topic' }, { status: 400 });
    }

    // Check permissions - simplified approach
    const user = validation.user;
    const canEdit = user.isAdmin || 
      (user.role === 'practice_manager' || user.role === 'practice_principal');
    
    if (!canEdit) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Remove topic from topics list - DSR compliant with environment prefix
    const environment = getEnvironment();
    const topicsKey = `${environment}_practice_topics_${practiceId}`;
    const topicsData = await db.getSetting(topicsKey);
    
    let topics = ['Main Topic'];
    if (topicsData) {
      const parsed = JSON.parse(topicsData);
      topics = parsed.topics || ['Main Topic'];
    }
    
    const updatedTopics = topics.filter(t => t !== topic);
    await db.saveSetting(topicsKey, JSON.stringify({ topics: updatedTopics }));
    
    // Delete topic board data - DSR compliant with environment prefix
    const topicBoardKey = `${environment}_practice_board_${practiceId}_${topic.replace(/[^a-zA-Z0-9]/g, '_')}`;
    await db.deleteSetting(topicBoardKey);
    
    // Send SSE notification for topic deleted
    try {
      const { notifyClients } = await import('../../events/route.js');
      notifyClients(`practice-board-${practiceId}`, {
        type: 'topic_deleted',
        topics: updatedTopics,
        deletedTopic: topic,
        timestamp: Date.now()
      });
    } catch (sseError) {
      console.error('SSE notification failed:', sseError);
    }
    
    return NextResponse.json({ success: true, topics: updatedTopics });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete topic' }, { status: 500 });
  }
}