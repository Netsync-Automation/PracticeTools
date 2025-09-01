import { NextResponse } from 'next/server';
import { VersioningSystem } from '../../../lib/versioning.js';

export async function GET() {
  try {
    const version = await VersioningSystem.getCurrentVersion();
    return NextResponse.json({ version });
  } catch (error) {
    console.error('Version API error:', error);
    return NextResponse.json({ version: '1.0.0' });
  }
}