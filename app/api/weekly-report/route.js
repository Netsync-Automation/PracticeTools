import { NextResponse } from 'next/server';
import { WeeklyAnalytics } from '../../../lib/weekly-analytics';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    console.log('📊 Weekly report triggered');
    
    const success = await WeeklyAnalytics.sendWeeklyReport();
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Weekly report sent successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to send weekly report' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Weekly report API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Generate analytics preview without sending
    const analytics = await WeeklyAnalytics.generateWeeklyReport();
    const card = WeeklyAnalytics.createWeeklyReportCard(analytics);
    
    return NextResponse.json({
      analytics,
      card,
      preview: true
    });
  } catch (error) {
    console.error('❌ Weekly report preview error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate preview' 
    }, { status: 500 });
  }
}