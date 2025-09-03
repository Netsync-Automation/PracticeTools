import crypto from 'crypto';

export class DuoSSO {
  constructor(config) {
    this.integrationKey = config.integrationKey;
    this.secretKey = config.secretKey;
    this.apiHostname = config.apiHostname;
    this.applicationKey = config.applicationKey || this.generateApplicationKey();
  }

  generateApplicationKey() {
    return crypto.randomBytes(40).toString('hex');
  }

  signRequest(username, ikey, skey, akey, hostname) {
    const duoSig = this.signVals(username, ikey, skey, 'DUO', 60);
    const appSig = this.signVals(username, akey, akey, 'APP', 60);
    return `${duoSig}:${appSig}`;
  }

  signVals(username, key, secret, prefix, expire) {
    const ts = Math.round(Date.now() / 1000);
    const expire_ts = ts + expire;
    const val = `${username}|${key}|${expire_ts}`;
    const b64 = Buffer.from(val).toString('base64');
    const cookie = `${prefix}|${b64}`;
    
    const hmac = crypto.createHmac('sha1', secret);
    hmac.update(cookie);
    const sig = hmac.digest('hex');
    
    return `${cookie}|${sig}`;
  }

  verifyResponse(duoResponse, username, ikey, skey, akey, hostname) {
    try {
      const [authSig, appSig] = duoResponse.split(':');
      
      const authUser = this.parseVals(authSig, skey, 'AUTH', ikey);
      const appUser = this.parseVals(appSig, akey, 'APP', akey);
      
      if (authUser === username && appUser === username) {
        return { success: true, username };
      }
      
      return { success: false, error: 'Invalid response' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  parseVals(val, key, prefix, ikey) {
    const ts = Math.round(Date.now() / 1000);
    const parts = val.split('|');
    
    if (parts.length !== 3) {
      throw new Error('Invalid response format');
    }
    
    const [u_prefix, u_b64, u_sig] = parts;
    
    if (u_prefix !== prefix) {
      throw new Error('Invalid prefix');
    }
    
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(`${u_prefix}|${u_b64}`);
    const sig = hmac.digest('hex');
    
    if (sig !== u_sig) {
      throw new Error('Invalid signature');
    }
    
    const cookie_parts = Buffer.from(u_b64, 'base64').toString().split('|');
    
    if (cookie_parts.length !== 3) {
      throw new Error('Invalid cookie format');
    }
    
    const [username, u_ikey, expire] = cookie_parts;
    
    if (u_ikey !== ikey) {
      throw new Error('Invalid integration key');
    }
    
    if (ts >= parseInt(expire)) {
      throw new Error('Response expired');
    }
    
    return username;
  }
}