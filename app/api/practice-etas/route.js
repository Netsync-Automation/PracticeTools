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
    
    // Calculate ETAs in real-time from 21-day rolling window
    const etas = await db.getPracticeETAs(practiceList);
    
    return NextResponse.json({
      success: true,
      etas: etas || [],
      calculatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error calculating practice ETAs:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to calculate practice ETAs'
    }, { status: 500 });
  }
}

