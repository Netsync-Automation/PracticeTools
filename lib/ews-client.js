import { ExchangeService, ExchangeVersion, Uri, WebCredentials, Folder, WellKnownFolderName, ItemView, SearchFilter, PropertySet, BasePropertySet, ConfigurationApi } from 'ews-javascript-api';
import { getSSMParameter } from './ssm-helper.js';
import { logger } from './safe-logger.js';
import { NTLMAuthenticator } from './ntlm-auth.js';

// Enable EWS debugging and configure SSL handling
ConfigurationApi.EnableScpLookup = true;
if (process.env.NODE_ENV === 'development') {
  ConfigurationApi.ConfigureHttpDebugTrace = true;
}

// Configure Node.js to accept self-signed certificates in development
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

class EWSClient {
  constructor() {
    this.service = null;
    this.isConnected = false;
    this.lastCheck = null;
  }

  async initialize() {
    try {
      // Get SMTP settings from SSM
      const smtpHost = await getSSMParameter('SMTP_HOST');
      const smtpUsername = await getSSMParameter('SMTP_USERNAME');
      const smtpPassword = await getSSMParameter('SMTP_PW');

      if (!smtpHost || !smtpUsername || !smtpPassword) {
        throw new Error('Missing SMTP configuration in SSM parameters');
      }

      // Try different Exchange versions that might work better
      const exchangeVersions = [
        ExchangeVersion.Exchange2016,
        ExchangeVersion.Exchange2013_SP1,
        ExchangeVersion.Exchange2013,
        ExchangeVersion.Exchange2010_SP2,
        ExchangeVersion.Exchange2010_SP1
      ];
      
      // Start with Exchange2016 as it's more compatible
      this.service = new ExchangeService(ExchangeVersion.Exchange2016);
      
      logger.info('EWS: Using Exchange version', { 
        version: 'Exchange2016',
        versionNumber: ExchangeVersion.Exchange2016
      });
      
      // Enable tracing for debugging
      if (process.env.NODE_ENV === 'development') {
        this.service.TraceEnabled = true;
        this.service.TraceFlags = 'All';
      }
      
      // Configure SSL/TLS settings for self-signed certificates
      this.service.AcceptGzipEncoding = true;
      this.service.PreAuthenticate = true;
      this.service.KeepAlive = false;
      this.service.UserAgent = 'PracticeTools-EWS-Client/1.0';
      this.service.Timeout = 30000;
      
      logger.info('EWS: Service configured', {
        timeout: this.service.Timeout,
        preAuth: this.service.PreAuthenticate,
        userAgent: this.service.UserAgent
      });
      
      // Set credentials with domain handling
      let username = smtpUsername;
      let domain = null;
      
      // Extract domain from username if present
      if (smtpUsername.includes('@')) {
        const parts = smtpUsername.split('@');
        username = parts[0];
        domain = parts[1];
        logger.info('EWS: Extracted domain from email', { username: username, domain });
      } else if (smtpUsername.includes('\\')) {
        const parts = smtpUsername.split('\\');
        domain = parts[0];
        username = parts[1];
        logger.info('EWS: Extracted domain from DOMAIN\\user format', { username: username, domain });
      }
      
      // Try different credential formats - use the exact format that works in EwsEditor
      if (domain) {
        // Try domain\user format first (most common for on-prem)
        this.service.Credentials = new WebCredentials(`${domain}\\${username}`, smtpPassword);
        logger.info('EWS: Using domain\\user credentials (Basic Auth)', { 
          format: `${domain}\\${username}`, 
          authType: 'Basic' 
        });
      } else {
        this.service.Credentials = new WebCredentials(smtpUsername, smtpPassword);
        logger.info('EWS: Using basic credentials (Basic Auth)', { authType: 'Basic' });
      }
      
      logger.info('EWS: Initializing connection', { 
        host: smtpHost, 
        username: smtpUsername 
      });
      
      // Auto-discover or set URL based on SMTP host
      const ewsUrl = this.getEWSUrl(smtpHost);
      if (ewsUrl) {
        logger.info('EWS: Using predefined URL', { url: ewsUrl });
        this.service.Url = new Uri(ewsUrl);
      } else {
        logger.info('EWS: Starting autodiscovery', { email: smtpUsername });
        try {
          // Try autodiscover
          await this.service.AutodiscoverUrl(smtpUsername, (redirectionUrl) => {
            logger.info('EWS: Autodiscover redirect', { url: redirectionUrl });
            return redirectionUrl.toLowerCase().startsWith('https://');
          });
          logger.info('EWS: Autodiscovery completed', { finalUrl: this.service.Url?.toString() });
        } catch (autodiscoverError) {
          logger.error('EWS: Autodiscovery failed', { error: autodiscoverError.message });
          // Fall back to common EWS URL pattern
          const fallbackUrl = `https://${smtpHost}/EWS/Exchange.asmx`;
          logger.info('EWS: Using fallback URL', { url: fallbackUrl });
          this.service.Url = new Uri(fallbackUrl);
        }
      }

      this.isConnected = true;
      logger.info('EWS Client initialized successfully');
      return true;
    } catch (error) {
      logger.error('EWS Client initialization failed', { error: error.message });
      this.isConnected = false;
      return false;
    }
  }

  getEWSUrl(smtpHost) {
    // Common EWS URL patterns for different Exchange servers
    const ewsPatterns = {
      'outlook.office365.com': 'https://outlook.office365.com/EWS/Exchange.asmx',
      'owa.netsyncnetwork.com': [
        'https://owa.netsyncnetwork.com/EWS/Exchange.asmx',
        'https://owa.netsyncnetwork.com/exchange/EWS/Exchange.asmx',
        'https://owa.netsyncnetwork.com/Microsoft-Server-ActiveSync/EWS/Exchange.asmx'
      ]
    };

    // Check for exact match
    if (ewsPatterns[smtpHost]) {
      const urls = Array.isArray(ewsPatterns[smtpHost]) ? ewsPatterns[smtpHost] : [ewsPatterns[smtpHost]];
      return urls[0]; // Return first URL, we'll try others if this fails
    }

    // Try common patterns
    if (smtpHost.includes('office365') || smtpHost.includes('outlook')) {
      return 'https://outlook.office365.com/EWS/Exchange.asmx';
    }

    // Default pattern for on-premises Exchange
    return `https://${smtpHost}/EWS/Exchange.asmx`;
  }

  async tryMultipleUrls(smtpHost, smtpUsername, smtpPassword) {
    const possibleUrls = [
      `https://${smtpHost}/EWS/Exchange.asmx`,
      `https://${smtpHost}/exchange/EWS/Exchange.asmx`,
      `https://${smtpHost}/Microsoft-Server-ActiveSync/EWS/Exchange.asmx`,
      `https://${smtpHost}/ews/exchange.asmx`
    ];

    for (const url of possibleUrls) {
      try {
        logger.info('EWS: Trying URL', { url });
        this.service.Url = new Uri(url);
        
        // Test with a simple operation
        await this.service.ResolveName('test@test.com');
        logger.info('EWS: URL works', { url });
        return true;
      } catch (error) {
        logger.info('EWS: URL failed', { url, error: error.message });
        continue;
      }
    }
    
    return false;
  }

  async checkNewMail(sinceDateTime = null) {
    try {
      logger.info('EWS: Checking for new mail using NTLM', { since: sinceDateTime });
      
      const smtpHost = await getSSMParameter('SMTP_HOST');
      const smtpUsername = await getSSMParameter('SMTP_USERNAME');
      const smtpPassword = await getSSMParameter('SMTP_PW');

      // Extract domain and username for NTLM
      let username = smtpUsername;
      let domain = 'netsync';
      
      if (smtpUsername.includes('@')) {
        const parts = smtpUsername.split('@');
        username = parts[0];
        domain = parts[1].split('.')[0];
      } else if (smtpUsername.includes('\\')) {
        const parts = smtpUsername.split('\\');
        domain = parts[0];
        username = parts[1];
      }

      logger.info('EWS: Using NTLM for email check', { username, domain, host: smtpHost });
      
      const ntlmAuth = new NTLMAuthenticator(username, smtpPassword, domain, smtpHost);
      return await ntlmAuth.getNewEmails(sinceDateTime);
    } catch (error) {
      logger.error('EWS: Error checking new mail', { error: error.message });
      throw error;
    }
  }

  async markAsRead(emailId) {
    try {
      logger.info('EWS: Marking email as read using NTLM', { emailId });
      
      const smtpHost = await getSSMParameter('SMTP_HOST');
      const smtpUsername = await getSSMParameter('SMTP_USERNAME');
      const smtpPassword = await getSSMParameter('SMTP_PW');

      // Extract domain and username for NTLM
      let username = smtpUsername;
      let domain = 'netsync';
      
      if (smtpUsername.includes('@')) {
        const parts = smtpUsername.split('@');
        username = parts[0];
        domain = parts[1].split('.')[0];
      } else if (smtpUsername.includes('\\')) {
        const parts = smtpUsername.split('\\');
        domain = parts[0];
        username = parts[1];
      }

      const ntlmAuth = new NTLMAuthenticator(username, smtpPassword, domain, smtpHost);
      return await ntlmAuth.markEmailAsRead(emailId);
    } catch (error) {
      logger.error('EWS: Error marking email as read', { error: error.message });
      return false;
    }
  }

  async testNTLMAuth() {
    try {
      const smtpHost = await getSSMParameter('SMTP_HOST');
      const smtpUsername = await getSSMParameter('SMTP_USERNAME');
      const smtpPassword = await getSSMParameter('SMTP_PW');

      // Extract domain and username for NTLM
      let username = smtpUsername;
      let domain = 'netsync';
      
      if (smtpUsername.includes('@')) {
        const parts = smtpUsername.split('@');
        username = parts[0];
        domain = parts[1].split('.')[0]; // Get first part of domain
      } else if (smtpUsername.includes('\\')) {
        const parts = smtpUsername.split('\\');
        domain = parts[0];
        username = parts[1];
      }

      logger.info('EWS: Creating NTLM authenticator', { username, domain, host: smtpHost });
      
      const ntlmAuth = new NTLMAuthenticator(username, smtpPassword, domain, smtpHost);
      return await ntlmAuth.testConnection();
    } catch (error) {
      logger.error('EWS: NTLM authentication failed', { error: error.message });
      return { success: false, error: `NTLM authentication failed: ${error.message}` };
    }
  }

  async checkEmailCount() {
    try {
      const smtpHost = await getSSMParameter('SMTP_HOST');
      const smtpUsername = await getSSMParameter('SMTP_USERNAME');
      const smtpPassword = await getSSMParameter('SMTP_PW');

      // Extract domain and username for NTLM
      let username = smtpUsername;
      let domain = 'netsync';
      
      if (smtpUsername.includes('@')) {
        const parts = smtpUsername.split('@');
        username = parts[0];
        domain = parts[1].split('.')[0];
      } else if (smtpUsername.includes('\\')) {
        const parts = smtpUsername.split('\\');
        domain = parts[0];
        username = parts[1];
      }

      logger.info('EWS: Checking email count with NTLM', { username, domain, host: smtpHost });
      
      const ntlmAuth = new NTLMAuthenticator(username, smtpPassword, domain, smtpHost);
      return await ntlmAuth.getEmailCount();
    } catch (error) {
      logger.error('EWS: Email count check failed', { error: error.message });
      return { success: false, error: `Email count check failed: ${error.message}` };
    }
  }

  async testConnection() {
    try {
      // Try NTLM authentication first
      logger.info('EWS: Testing NTLM authentication');
      const ntlmResult = await this.testNTLMAuth();
      if (ntlmResult.success) {
        return ntlmResult;
      }
      logger.info('EWS: NTLM failed, trying EWS library fallback');

      const initialized = await this.initialize();
      if (!initialized) {
        return { success: false, error: 'Failed to initialize connection' };
      }

      logger.info('EWS: Testing connection by accessing inbox');
      
      // Log the exact EWS URL and credentials being used
      logger.info('EWS: Connection details', {
        url: this.service.Url?.toString(),
        credentialsType: this.service.Credentials?.constructor?.name,
        exchangeVersion: this.service.RequestedServerVersion
      });
      
      // Try a simple operation - get server info
      logger.info('EWS: Attempting to get server info first');
      try {
        const serverInfo = await this.service.GetServerTimeZones();
        logger.info('EWS: Server info retrieved successfully', { 
          timeZoneCount: serverInfo?.length || 0 
        });
      } catch (serverError) {
        logger.error('EWS: Server info failed', { 
          error: serverError.message,
          statusCode: serverError.statusCode || serverError.status || serverError.code
        });
      }
      
      // Try to access inbox to test connection
      logger.info('EWS: Attempting to bind to inbox folder');
      const inbox = await Folder.Bind(this.service, WellKnownFolderName.Inbox);
      
      logger.info('EWS: Connection test successful', { 
        folderName: inbox.DisplayName, 
        totalItems: inbox.TotalCount 
      });
      
      return {
        success: true,
        message: 'EWS connection successful',
        folderName: inbox.DisplayName,
        totalItems: inbox.TotalCount
      };
    } catch (error) {
      logger.error('EWS: Connection test failed', { 
        error: error.message,
        statusCode: error.statusCode || error.status || error.code,
        responseText: error.responseText || error.response || error.data,
        errorType: error.constructor.name,
        stack: error.stack?.split('\n')[0],
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });
      
      // Try alternative authentication methods if 401
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        logger.info('EWS: Trying alternative authentication methods');
        
        try {
          const altResult = await this.tryAlternativeAuth();
          if (altResult.success) {
            return altResult;
          }
        } catch (altError) {
          logger.error('EWS: Alternative auth also failed', { error: altError.message });
        }
      }
      
      // Provide more specific error messages
      let errorMessage = error.message;
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        errorMessage = 'Authentication failed. Try: 1) DOMAIN\\username format, 2) username@domain.com format, 3) Verify EWS permissions for this account.';
      } else if (error.message.includes('404') || error.message.includes('Not Found')) {
        errorMessage = 'EWS endpoint not found. The Exchange server may not support EWS or the URL is incorrect.';
      } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
        errorMessage = 'Access denied. The account may not have permission to access EWS.';
      }
      
      return {
        success: false,
        error: errorMessage,
        diagnostics: {
          testedFormats: ['original', 'domain\\user', 'user@domain', 'user@fulldomain'],
          suggestions: [
            'Verify the service account has EWS permissions in Exchange',
            'Check if EWS is enabled on the Exchange server',
            'Confirm the account is not locked or disabled',
            'Try testing SMTP authentication first to verify credentials',
            'Contact Exchange administrator to verify EWS access for this account'
          ]
        }
      };
    }
  }

  async tryAlternativeAuth() {
    const smtpUsername = await getSSMParameter('SMTP_USERNAME');
    const smtpPassword = await getSSMParameter('SMTP_PW');
    
    const authFormats = [
      smtpUsername, // Original format
      `netsync\\${smtpUsername.split('@')[0]}`, // DOMAIN\\user
      `${smtpUsername.split('@')[0]}@netsync.com`, // user@domain
      `${smtpUsername.split('@')[0]}@netsyncnetwork.com` // user@fulldomain
    ];
    
    for (const authFormat of authFormats) {
      try {
        logger.info('EWS: Trying auth format', { format: authFormat });
        
        // Create new credentials
        this.service.Credentials = new WebCredentials(authFormat, smtpPassword);
        logger.info('EWS: Using Basic Auth for format test', { authType: 'Basic', format: authFormat });
        
        // Test connection
        const inbox = await Folder.Bind(this.service, WellKnownFolderName.Inbox);
        
        logger.info('EWS: Alternative auth successful', { 
          format: authFormat,
          folderName: inbox.DisplayName 
        });
        
        return {
          success: true,
          message: `EWS connection successful with format: ${authFormat}`,
          folderName: inbox.DisplayName,
          totalItems: inbox.TotalCount
        };
      } catch (error) {
        logger.info('EWS: Auth format failed', { 
          format: authFormat, 
          error: error.message,
          statusCode: error.statusCode || error.status || error.code,
          responseText: error.responseText || error.response || error.data,
          errorDetails: JSON.stringify(error, Object.getOwnPropertyNames(error))
        });
        continue;
      }
    }
    
    throw new Error('All authentication formats failed');
  }

  async testRawHttpAuth(username, password, host) {
    const https = await import('https');
    
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      
      logger.info('EWS: Raw HTTP auth details', {
        username: username,
        host: host,
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
      
      const req = https.default.request(options, (res) => {
        logger.info('EWS: Raw HTTP response', {
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers
        });
        
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            success: res.statusCode !== 401,
            responseLength: data.length
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

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      lastCheck: this.lastCheck,
      service: this.service ? 'Initialized' : 'Not initialized'
    };
  }
}

// Singleton instance
let ewsClientInstance = null;

export function getEWSClient() {
  if (!ewsClientInstance) {
    ewsClientInstance = new EWSClient();
  }
  return ewsClientInstance;
}

export { EWSClient };