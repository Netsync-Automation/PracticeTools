import { NextResponse } from 'next/server';
import { samlService } from '../../../../../lib/saml.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    console.log('=== SAML Login Request Started ===');
    const { searchParams } = new URL(request.url);
    const relayState = searchParams.get('RelayState') || '/';
    console.log('Relay State:', relayState);
    
    console.log('Creating SAML login request with relay state:', relayState);
    const loginUrl = await samlService.getLoginUrl(relayState);
    console.log('SAML login URL created successfully');
    
    // Validate URL is absolute
    if (!loginUrl || loginUrl.startsWith('?') || !loginUrl.includes('://')) {
      console.error('Invalid SAML login URL:', loginUrl);
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      return NextResponse.redirect(`${baseUrl}/login?error=saml_config_invalid&message=SAML configuration is incomplete. Please check SSO settings.`);
    }
    
    console.log('Redirecting to SAML IDP:', loginUrl.substring(0, 100) + '...');
    return NextResponse.redirect(loginUrl);
  } catch (error) {
    console.error('SAML login error:', error);
    console.error('Error stack:', error.stack);
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${baseUrl}/login?error=saml_login_failed&message=SAML login failed. Please contact your administrator.`);
  }
}