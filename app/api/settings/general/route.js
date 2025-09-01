import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    const { appName, loginLogo, navbarLogo } = await request.json();
    console.log('Received settings:', { appName: !!appName, loginLogo: !!loginLogo, navbarLogo: !!navbarLogo });
    
    if (!appName) {
      return NextResponse.json({ error: 'App name is required' }, { status: 400 });
    }

    // Save app name
    const appNameSuccess = await db.saveSetting('app_name', appName);
    
    // Save login logo if provided
    if (loginLogo) {
      const loginLogoSuccess = await db.saveSetting('login_logo', loginLogo);
      if (!loginLogoSuccess) {
        return NextResponse.json({ error: 'Failed to save login logo' }, { status: 500 });
      }
    }
    
    // Save navbar logo if provided
    if (navbarLogo) {
      const navbarLogoSuccess = await db.saveSetting('navbar_logo', navbarLogo);
      if (!navbarLogoSuccess) {
        return NextResponse.json({ error: 'Failed to save navbar logo' }, { status: 500 });
      }
    }
    
    if (appNameSuccess) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const appName = await db.getSetting('app_name') || 'Issue Tracker';
    let loginLogo = await db.getSetting('login_logo');
    let navbarLogo = await db.getSetting('navbar_logo');
    
    // Initialize with current logos if not set
    if (!loginLogo) {
      try {
        const logoPath = path.join(process.cwd(), 'public', 'netsync.svg');
        const logoData = fs.readFileSync(logoPath, 'base64');
        loginLogo = `data:image/svg+xml;base64,${logoData}`;
        await db.saveSetting('login_logo', loginLogo);
      } catch (error) {
        console.error('Error reading login logo:', error);
      }
    }
    
    if (!navbarLogo) {
      try {
        const logoPath = path.join(process.cwd(), 'public', 'company-logo.png');
        const logoData = fs.readFileSync(logoPath, 'base64');
        navbarLogo = `data:image/png;base64,${logoData}`;
        await db.saveSetting('navbar_logo', navbarLogo);
      } catch (error) {
        console.error('Error reading navbar logo:', error);
      }
    }
    
    return NextResponse.json({ appName, loginLogo, navbarLogo });
  } catch (error) {
    console.error('Error getting settings:', error);
    return NextResponse.json({ appName: 'Issue Tracker', loginLogo: null, navbarLogo: null });
  }
}