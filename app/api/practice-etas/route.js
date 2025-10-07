import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const practices = searchParams.get('practices');
    
    let practiceList = [];
    if (practices) {
      practiceList = practices.split(',').map(p => p.trim()).filter(p => p);
    }
    
    const etas = await db.getPracticeETAs(practiceList);
    
    return NextResponse.json({
      success: true,
      etas: etas || []
    });
  } catch (error) {
    console.error('Error fetching practice ETAs:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch practice ETAs'
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { practice, saName, statusTransition, durationHours } = await request.json();
    
    if (!practice || !statusTransition || !durationHours) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 });
    }
    
    await db.updatePracticeETA(practice, statusTransition, durationHours);
    
    // Send SSE notification for ETA update
    const sseResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'eta_updated',
        practice,
        statusTransition
      })
    }).catch(() => {});
    
    return NextResponse.json({
      success: true,
      message: 'ETA updated successfully'
    });
  } catch (error) {
    console.error('Error updating practice ETA:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update practice ETA'
    }, { status: 500 });
  }
}