import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check';
import { getSSMParameter } from '../../../../lib/ssm.js';
import https from 'https';

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get credentials from SSM
    const [smtpHost, smtpUsername, smtpPassword] = await Promise.all([
      getSSMParameter('SMTP_HOST'),
      getSSMParameter('SMTP_USERNAME'),
      getSSMParameter('SMTP_PW')
    ]);

    if (!smtpHost || !smtpUsername || !smtpPassword) {
      return NextResponse.json({ error: 'Missing SMTP configuration' }, { status: 400 });
    }

    // Test different username formats
    const authFormats = [
      smtpUsername,
      `netsync\\${smtpUsername.split('@')[0]}`,
      `${smtpUsername.split('@')[0]}@netsync.com`,
      `${smtpUsername.split('@')[0]}@netsyncnetwork.com`
    ];

    const results = [];

    console.log('Raw EWS Test: Starting authentication tests', {
      host: smtpHost,
      formatsToTest: authFormats.length
    });

    for (const username of authFormats) {
      console.log('Raw EWS Test: Testing format', { username });
      try {
        const result = await testRawEWSAuth(username, smtpPassword, smtpHost);
        console.log('Raw EWS Test: Result', {
          username,
          statusCode: result.statusCode,
          statusMessage: result.statusMessage,
          responseLength: result.responseLength,
          success: result.statusCode !== 401
        });
        
        results.push({
          username: username,
          statusCode: result.statusCode,
          success: result.statusCode !== 401,
          error: result.error
        });
      } catch (error) {
        console.error('Raw EWS Test: Error', { username, error: error.message });
        results.push({
          username: username,
          statusCode: 'ERROR',
          success: false,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      host: smtpHost,
      results: results
    });

  } catch (error) {
    console.error('Raw EWS test error:', error);
    return NextResponse.json(
      { success: false, error: 'Raw EWS test failed: ' + error.message },
      { status: 500 }
    );
  }
}

function testRawEWSAuth(username, password, host) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    
    console.log('Raw EWS Test: Making HTTPS request', {
      hostname: host,
      path: '/EWS/Exchange.asmx',
      username: username,
      authHeaderLength: auth.length
    });
    
    const options = {
      hostname: host,
      port: 443,
      path: '/EWS/Exchange.asmx',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'text/xml; charset=utf-8',
        'User-Agent': 'EwsEditor/1.0',
        'SOAPAction': '"http://schemas.microsoft.com/exchange/services/2006/messages/GetFolder"'
      },
      rejectUnauthorized: false
    };
    
    const req = https.request(options, (res) => {
      console.log('Raw EWS Test: Response received', {
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        headers: Object.keys(res.headers),
        wwwAuthenticate: res.headers['www-authenticate'],
        server: res.headers['server'],
        xOwaVersion: res.headers['x-owa-version']
      });
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Raw EWS Test: Response complete', {
          statusCode: res.statusCode,
          responseLength: data.length,
          contentType: res.headers['content-type']
        });
        
        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          responseLength: data.length,
          headers: res.headers
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    // Simple EWS GetFolder request
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2016" />
  </soap:Header>
  <soap:Body>
    <GetFolder xmlns="http://schemas.microsoft.com/exchange/services/2006/messages">
      <FolderShape>
        <t:BaseShape>Default</t:BaseShape>
      </FolderShape>
      <FolderIds>
        <t:DistinguishedFolderId Id="inbox" />
      </FolderIds>
    </GetFolder>
  </soap:Body>
</soap:Envelope>`;
    
    req.write(soapBody);
    req.end();
  });
}