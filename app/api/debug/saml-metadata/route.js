import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check';

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Debug all environment variables
    const envDebug = {
      ENVIRONMENT: process.env.ENVIRONMENT,
      NODE_ENV: process.env.NODE_ENV,
      SSO_ENABLED: process.env.SSO_ENABLED,
      DUO_METADATA_FILE_EXISTS: !!process.env.DUO_METADATA_FILE,
      DUO_METADATA_FILE_LENGTH: (process.env.DUO_METADATA_FILE || '').length,
      DUO_ENTITY_ID: process.env.DUO_ENTITY_ID,
      DUO_ACS: process.env.DUO_ACS,
      DUO_CERT_FILE_EXISTS: !!process.env.DUO_CERT_FILE,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      all_env_keys: Object.keys(process.env).filter(key => key.includes('DUO') || key.includes('SSO'))
    };

    const metadata = process.env.DUO_METADATA_FILE || '';
    
    if (!metadata) {
      return NextResponse.json({
        error: 'No metadata found',
        metadata_exists: false,
        metadata_length: 0,
        environment_debug: envDebug
      });
    }

    // Test all parsing patterns
    const ssoPatterns = [
      { name: 'sso keyword', pattern: /Location="([^"]*sso[^"]*)"/i },
      { name: 'SingleSignOnService', pattern: /Location="([^"]*SingleSignOnService[^"]*)"/i },
      { name: 'saml2/idp/sso', pattern: /Location="([^"]*saml2\/idp\/sso[^"]*)"/i },
      { name: 'SingleSignOnService tag', pattern: /<SingleSignOnService[^>]*Location="([^"]*)"/i },
      { name: 'HTTP-POST binding', pattern: /<SingleSignOnService[^>]*Binding="[^"]*HTTP-POST[^"]*"[^>]*Location="([^"]*)"/i },
      { name: 'any Location', pattern: /Location="([^"]*)"/gi }
    ];
    
    const sloPatterns = [
      { name: 'slo keyword', pattern: /Location="([^"]*slo[^"]*)"/i },
      { name: 'SingleLogoutService', pattern: /Location="([^"]*SingleLogoutService[^"]*)"/i },
      { name: 'saml2/idp/slo', pattern: /Location="([^"]*saml2\/idp\/slo[^"]*)"/i },
      { name: 'SingleLogoutService tag', pattern: /<SingleLogoutService[^>]*Location="([^"]*)"/i }
    ];

    const results = {
      metadata_exists: true,
      metadata_length: metadata.length,
      metadata_preview: metadata.substring(0, 500) + '...',
      sso_matches: [],
      slo_matches: [],
      certificate_found: false,
      environment_debug: envDebug
    };

    // Test SSO patterns
    for (const { name, pattern } of ssoPatterns) {
      const matches = metadata.match(pattern);
      if (matches) {
        results.sso_matches.push({
          pattern_name: name,
          url: matches[1],
          all_matches: pattern.global ? matches : [matches[1]]
        });
      }
    }

    // Test SLO patterns
    for (const { name, pattern } of sloPatterns) {
      const matches = metadata.match(pattern);
      if (matches) {
        results.slo_matches.push({
          pattern_name: name,
          url: matches[1]
        });
      }
    }

    // Check certificate
    const certMatch = metadata.match(/<X509Certificate>([^<]+)<\/X509Certificate>/i);
    results.certificate_found = !!certMatch;
    if (certMatch) {
      results.certificate_preview = certMatch[1].substring(0, 100) + '...';
    }

    return NextResponse.json(results);
    
  } catch (error) {
    console.error('SAML metadata debug error:', error);
    return NextResponse.json({ 
      error: 'Debug failed', 
      details: error.message 
    }, { status: 500 });
  }
}