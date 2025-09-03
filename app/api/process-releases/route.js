import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const releaseFilePath = path.join(process.cwd(), 'pending-release.json');
    
    if (!fs.existsSync(releaseFilePath)) {
      return NextResponse.json({ message: 'No pending releases' });
    }
    
    const releaseData = JSON.parse(fs.readFileSync(releaseFilePath, 'utf8'));
    console.log(`Processing pending release ${releaseData.version}...`);
    
    await db.saveRelease(releaseData);
    console.log(`Release ${releaseData.version} saved to database`);
    
    // Remove pending file
    fs.unlinkSync(releaseFilePath);
    
    return NextResponse.json({ 
      success: true, 
      message: `Release ${releaseData.version} processed successfully`,
      version: releaseData.version
    });
  } catch (error) {
    console.error('Error processing pending release:', error);
    return NextResponse.json({ error: 'Failed to process pending release' }, { status: 500 });
  }
}