import { NextResponse } from 'next/server';
import { samlService } from '../../../../../lib/saml.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const relayState = searchParams.get('RelayState') || '/';
    
    const loginUrl = await samlService.getLoginUrl(relayState);
    
    // Validate URL is absolute
    if (!loginUrl || loginUrl.startsWith('?') || !loginUrl.includes('://')) {
      console.error('Invalid SAML login URL:', loginUrl);
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      return NextResponse.redirect(`${baseUrl}/login?error=saml_config_invalid&message=SAML configuration is incomplete. Please check SSO settings.`);
    }
    
    return NextResponse.redirect(loginUrl);
  } catch (error) {
    console.error('SAML login error:', error);
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${baseUrl}/login?error=saml_login_failed&message=SAML login failed. Please contact your administrator.`);
  }
}