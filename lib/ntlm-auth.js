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

  async getEmailCount() {
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2016" />
  </soap:Header>
  <soap:Body>
    <GetFolder xmlns="http://schemas.microsoft.com/exchange/services/2006/messages">
      <FolderShape>
        <t:BaseShape>Default</t:BaseShape>
        <t:AdditionalProperties>
          <t:FieldURI FieldURI="folder:TotalCount" />
          <t:FieldURI FieldURI="folder:UnreadCount" />
        </t:AdditionalProperties>
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
        // Parse XML response to extract email counts
        const totalMatch = result.body.match(/<t:TotalCount>(\d+)<\/t:TotalCount>/);
        const unreadMatch = result.body.match(/<t:UnreadCount>(\d+)<\/t:UnreadCount>/);
        
        const totalCount = totalMatch ? parseInt(totalMatch[1]) : 0;
        const unreadCount = unreadMatch ? parseInt(unreadMatch[1]) : 0;
        
        logger.info('NTLM: Email count retrieved', { totalCount, unreadCount });
        
        return {
          success: true,
          totalEmails: totalCount,
          unreadEmails: unreadCount,
          message: `Found ${totalCount} total emails (${unreadCount} unread)`
        };
      } else {
        logger.error('NTLM: Email count failed', { statusCode: result.statusCode });
        return {
          success: false,
          error: `Failed to get email count with status ${result.statusCode}`
        };
      }
    } catch (error) {
      logger.error('NTLM: Email count request failed', { error: error.message });
      return {
        success: false,
        error: `Email count request failed: ${error.message}`
      };
    }
  }

  async getNewEmails(since) {
    // First, find unread emails
    const findSoapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types" xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2016" />
  </soap:Header>
  <soap:Body>
    <m:FindItem Traversal="Shallow">
      <m:ItemShape>
        <t:BaseShape>IdOnly</t:BaseShape>
      </m:ItemShape>
      <m:Restriction>
        <t:IsEqualTo>
          <t:FieldURI FieldURI="message:IsRead" />
          <t:FieldURIOrConstant>
            <t:Constant Value="false" />
          </t:FieldURIOrConstant>
        </t:IsEqualTo>
      </m:Restriction>
      <m:ParentFolderIds>
        <t:DistinguishedFolderId Id="inbox" />
      </m:ParentFolderIds>
    </m:FindItem>
  </soap:Body>
</soap:Envelope>`;

    try {
      const findResult = await this.makeAuthenticatedRequest('/EWS/Exchange.asmx', findSoapBody);
      
      if (findResult.statusCode !== 200) {
        logger.error('NTLM: Find emails failed', { statusCode: findResult.statusCode });
        return [];
      }

      // Extract email IDs
      const emailIds = this.extractEmailIds(findResult.body);
      logger.info('NTLM: Found email IDs', { count: emailIds.length });
      
      if (emailIds.length === 0) {
        return [];
      }

      // Get full email details including body
      const itemIds = emailIds.map(id => `<t:ItemId Id="${id}" />`).join('');
      const getSoapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types" xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2016" />
  </soap:Header>
  <soap:Body>
    <m:GetItem>
      <m:ItemShape>
        <t:BaseShape>Default</t:BaseShape>
        <t:BodyType>Text</t:BodyType>
      </m:ItemShape>
      <m:ItemIds>
        ${itemIds}
      </m:ItemIds>
    </m:GetItem>
  </soap:Body>
</soap:Envelope>`;

      const getResult = await this.makeAuthenticatedRequest('/EWS/Exchange.asmx', getSoapBody);
      
      if (getResult.statusCode === 200) {
        const emails = this.parseEmailsFromXML(getResult.body);
        logger.info('NTLM: Retrieved emails with body', { count: emails.length });
        return emails;
      } else {
        logger.error('NTLM: Get email details failed', { statusCode: getResult.statusCode });
        return [];
      }
    } catch (error) {
      logger.error('NTLM: Get emails request failed', { error: error.message });
      return [];
    }
  }

  extractEmailIds(xmlBody) {
    const ids = [];
    const idMatches = xmlBody.match(/ItemId Id="([^"]+)"/g) || [];
    
    for (const match of idMatches) {
      const idMatch = match.match(/Id="([^"]+)"/);
      if (idMatch) {
        ids.push(idMatch[1]);
      }
    }
    
    return ids;
  }

  parseEmailsFromXML(xmlBody) {
    const emails = [];
    
    // Handle different namespace prefixes and look for Message elements
    const itemMatches = xmlBody.match(/<[^:]*:Message[^>]*>.*?<\/[^:]*:Message>/gs) || 
                       xmlBody.match(/<Message[^>]*>.*?<\/Message>/gs) || [];
    
    for (const itemMatch of itemMatches) {
      const idMatch = itemMatch.match(/ItemId[^>]*Id="([^"]+)"/);  
      const subjectMatch = itemMatch.match(/<[^:]*:?Subject[^>]*>([^<]*)<\/[^:]*:?Subject>/);
      const fromMatch = itemMatch.match(/<[^:]*:?From[^>]*>[\s\S]*?<[^:]*:?EmailAddress[^>]*>([^<]*)<\/[^:]*:?EmailAddress>[\s\S]*?<\/[^:]*:?From>/);
      const dateMatch = itemMatch.match(/<[^:]*:?DateTimeReceived[^>]*>([^<]*)<\/[^:]*:?DateTimeReceived>/);
      const bodyMatch = itemMatch.match(/<[^:]*:?Body[^>]*>([\s\S]*?)<\/[^:]*:?Body>/);
      
      if (idMatch && subjectMatch) {
        let emailBody = '';
        if (bodyMatch) {
          emailBody = bodyMatch[1]
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
        }
        
        const isReadMatch = itemMatch.match(/<[^:]*:?IsRead[^>]*>([^<]*)<\/[^:]*:?IsRead>/);
        const isRead = isReadMatch ? isReadMatch[1].toLowerCase() === 'true' : false;
        
        // Only include unread emails
        if (!isRead) {
          emails.push({
            id: idMatch[1],
            subject: subjectMatch[1] || '',
            from: fromMatch ? fromMatch[1] : 'Unknown',
            dateReceived: dateMatch ? new Date(dateMatch[1]) : new Date(),
            body: emailBody,
            isRead: isRead
          });
        }
      }
    }
    
    return emails;
  }

  async markEmailAsRead(emailId) {
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types" xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2016" />
  </soap:Header>
  <soap:Body>
    <m:UpdateItem ConflictResolution="AutoResolve">
      <m:ItemChanges>
        <t:ItemChange>
          <t:ItemId Id="${emailId}" />
          <t:Updates>
            <t:SetItemField>
              <t:FieldURI FieldURI="message:IsRead" />
              <t:Message>
                <t:IsRead>true</t:IsRead>
              </t:Message>
            </t:SetItemField>
          </t:Updates>
        </t:ItemChange>
      </m:ItemChanges>
    </m:UpdateItem>
  </soap:Body>
</soap:Envelope>`;

    try {
      const result = await this.makeAuthenticatedRequest('/EWS/Exchange.asmx', soapBody);
      
      if (result.statusCode === 200) {
        logger.info('NTLM: Email marked as read', { emailId });
        return true;
      } else {
        logger.error('NTLM: Mark as read failed', { statusCode: result.statusCode, emailId });
        return false;
      }
    } catch (error) {
      logger.error('NTLM: Mark as read request failed', { error: error.message, emailId });
      return false;
    }
  }
}