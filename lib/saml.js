import saml2 from 'saml2-js';
import { createSAMLConfig } from './saml-config.js';

export class SAMLService {
  constructor() {
    this.sp = null;
    this.idp = null;
    this.configPromise = null;
  }

  async ensureInitialized() {
    if (!this.configPromise) {
      this.configPromise = this.initializeConfig();
    }
    return this.configPromise;
  }

  async initializeConfig() {
    const config = await createSAMLConfig();
    this.sp = new saml2.ServiceProvider(config.sp);
    this.idp = new saml2.IdentityProvider(config.idp);
    return config;
  }

  async getLoginUrl(relayState = '/') {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      console.log('Creating SAML login request with relay state:', relayState);
      this.sp.create_login_request_url(this.idp, { relay_state: relayState }, (err, login_url) => {
        if (err) {
          console.error('SAML login URL creation error:', err);
          reject(err);
        } else {
          console.log('SAML login URL created successfully');
          resolve(login_url);
        }
      });
    });
  }

  async validateAssertion(samlResponse, callback) {
    await this.ensureInitialized();
    this.sp.post_assert(this.idp, { request_body: { SAMLResponse: samlResponse } }, callback);
  }

  async getMetadata() {
    await this.ensureInitialized();
    return this.sp.create_metadata();
  }
}

export const samlService = new SAMLService();