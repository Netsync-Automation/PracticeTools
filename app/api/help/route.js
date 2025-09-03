import { NextResponse } from 'next/server';
import { HelpGenerator } from '../../../lib/help-generator.js';
import { db } from '../../../lib/dynamodb.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Try to get cached help content from database
    let helpContent = await db.getSetting('help_content');
    
    if (helpContent) {
      try {
        helpContent = JSON.parse(helpContent);
      } catch (parseError) {
        console.error('Error parsing cached help content:', parseError);
        helpContent = null;
      }
    }
    
    // If no cached content, generate fresh content
    if (!helpContent) {
      console.log('Generating fresh help content...');
      helpContent = HelpGenerator.generateHelpContent();
      
      // Cache the generated content
      try {
        await db.saveSetting('help_content', JSON.stringify(helpContent));
      } catch (saveError) {
        console.error('Error caching help content:', saveError);
      }
    }
    
    return NextResponse.json(helpContent);
  } catch (error) {
    console.error('Error serving help content:', error);
    
    // Fallback to generating content without caching
    try {
      const helpContent = HelpGenerator.generateHelpContent();
      return NextResponse.json(helpContent);
    } catch (fallbackError) {
      console.error('Fallback help generation failed:', fallbackError);
      return NextResponse.json({ error: 'Failed to generate help content' }, { status: 500 });
    }
  }
}

export async function POST() {
  try {
    // Regenerate help content
    const helpContent = await HelpGenerator.updateHelpContent();
    return NextResponse.json({ 
      success: true, 
      message: 'Help content regenerated successfully',
      helpContent 
    });
  } catch (error) {
    console.error('Error regenerating help content:', error);
    return NextResponse.json({ error: 'Failed to regenerate help content' }, { status: 500 });
  }
}