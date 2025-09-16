import { NextResponse } from 'next/server';
import { samlService } from '../../../../../lib/saml.js';
import { db } from '../../../../../lib/dynamodb.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ status: 'ACS endpoint ready', method: 'GET' });
}

export async function POST(request) {
  try {
    console.log('=== SAML ACS POST received ===');
    const formData = await request.formData();
    const samlResponse = formData.get('SAMLResponse');
    const relayState = formData.get('RelayState') || '/';
    
    console.log('RelayState:', relayState);
    console.log('SAMLResponse length:', samlResponse?.length || 0);
    console.log('Form data keys:', Array.from(formData.keys()));
    
    if (!samlResponse) {
      console.error('Missing SAML response');
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login?error=missing_saml_response&message=SAML response missing. Please try logging in again.`);
    }
    
    return new Promise((resolve) => {
      samlService.validateAssertion(samlResponse, async (err, response) => {
        if (err) {
          console.error('SAML validation error:', err);
          console.error('Error details:', JSON.stringify(err, null, 2));
          const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
          resolve(NextResponse.redirect(`${baseUrl}/login?error=saml_validation_failed&message=SAML authentication failed. Please try again or contact your administrator.`));
          return;
        }
        
        console.log('SAML validation successful');
        console.log('User attributes:', JSON.stringify(response.user, null, 2));
        
        try {
          const email = response.user.name_id || response.user.attributes?.email?.[0];
          const name = response.user.attributes?.displayName?.[0] || 
                      response.user.attributes?.name?.[0] || 
                      email;
          
          console.log('Extracted email from SAML:', email);
          console.log('Extracted name from SAML:', name);
          
          if (!email) {
            console.error('No email found in SAML response');
            console.error('Available attributes:', Object.keys(response.user.attributes || {}));
            const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
            resolve(NextResponse.redirect(`${baseUrl}/login?error=no_email_in_saml&message=No email address found in SAML response. Please contact your administrator.`));
            return;
          }
          
          console.log('Validating SAML user against database:', { email, name });
          
          // Check if user exists in database
          const dbUser = await db.getUser(email);
          
          if (!dbUser) {
            console.error('SAML user not found in database:', email);
            const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
            resolve(NextResponse.redirect(`${baseUrl}/login?error=access_denied&message=Your account is not authorized to access this application. Please contact your administrator.`));
            return;
          }
          
          console.log('SAML user found in database:', { email: dbUser.email, role: dbUser.role, isAdmin: dbUser.isAdmin, is_admin: dbUser.is_admin });
          
          // Create user object with database role and permissions
          const user = {
            email: dbUser.email,
            name: dbUser.name || name,
            role: dbUser.role,
            auth_method: 'sso',
            isAdmin: dbUser.isAdmin || dbUser.is_admin || false,
            practices: dbUser.practices || [],
            created_at: dbUser.created_at,
            last_login: new Date().toISOString()
          };
          
          console.log('SSO user session created with DB permissions:', { email: user.email, name: user.name, role: user.role, isAdmin: user.isAdmin });
          console.log('Raw dbUser object:', JSON.stringify(dbUser, null, 2));
          
          const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
          // Always redirect to root page after successful SAML authentication
          const redirectUrl = `${baseUrl.replace(/\/$/, '')}/`;
          console.log('SAML authentication successful, setting cookie and redirecting to:', redirectUrl);
          const redirectResponse = NextResponse.redirect(redirectUrl);
          
          console.log('Setting user-session cookie with data:', JSON.stringify(user));
          redirectResponse.cookies.set('user-session', JSON.stringify(user), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
            path: '/'
          });
          
          console.log('Resolving redirect response to:', redirectUrl);
          resolve(redirectResponse);
        } catch (error) {
          console.error('User validation error:', error);
          const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
          resolve(NextResponse.redirect(`${baseUrl}/login?error=user_validation_failed&message=Unable to validate user account. Please contact your administrator.`));
        }
      });
    });
  } catch (error) {
    console.error('SAML ACS error:', error);
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${baseUrl}/login?error=saml_processing_failed&message=SAML processing failed. Please try again or contact your administrator.`);
  }
}