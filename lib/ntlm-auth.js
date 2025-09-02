import httpntlm from 'httpntlm';
import { logger } from './safe-logger.js';

export class NTLMAuthenticator {
  constructor(username, password, domain, host) {
    this.username = username;
    this.password = password;
    this.domain = domain;
    this.host = host;
    
    logger.info('NTLM: Authenticator initialized', {
      username: username,
      domain: domain,
      host: host
    });
  }

  async makeAuthenticatedRequest(path, soapBody) {
    return new Promise((resolve, reject) => {
      const options = {
        url: `https://${this.host}${path}`,
        username: this.username,
        password: this.password,
        domain: this.domain,
        workstation: '',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': '"http://schemas.microsoft.com/exchange/services/2006/messages/GetFolder"',
          'User-Agent': 'PracticeTools-EWS-Client/1.0'
        },
        body: soapBody,
        rejectUnauthorized: false
      };

      logger.info('NTLM: Making authenticated request', {
        url: options.url,
        username: this.username,
        domain: this.domain
      });

      httpntlm.post(options, (err, res) => {
        if (err) {
          logger.error('NTLM: Request failed', { error: err.message });
          reject(err);
          return;
        }

        logger.info('NTLM: Request completed', {
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          responseLength: res.body?.length || 0
        });

        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          body: res.body,
          headers: res.headers
        });
      });
    });
  }

  async testConnection() {
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

    try {
      const result = await this.makeAuthenticatedRequest('/EWS/Exchange.asmx', soapBody);
      
      if (result.statusCode === 200) {
        logger.info('NTLM: Authentication successful');
        return {
          success: true,
          message: 'NTLM authentication successful',
          statusCode: result.statusCode
        };
      } else {
        logger.error('NTLM: Authentication failed', { statusCode: result.statusCode });
        return {
          success: false,
          error: `NTLM authentication failed with status ${result.statusCode}`,
          statusCode: result.statusCode
        };
      }
    } catch (error) {
      logger.error('NTLM: Connection test failed', { error: error.message });
      return {
        success: false,
        error: `NTLM connection failed: ${error.message}`
      };
    }
  }
}