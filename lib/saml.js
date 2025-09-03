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
    console.log('=== SAML Service Initialization ===');
    const config = await createSAMLConfig();
    console.log('Creating ServiceProvider with config:', JSON.stringify(config.sp, null, 2));
    this.sp = new saml2.ServiceProvider(config.sp);
    console.log('Creating IdentityProvider with config:', JSON.stringify(config.idp, null, 2));
    this.idp = new saml2.IdentityProvider(config.idp);
    console.log('SAML Service initialized successfully');
    return config;
  }

  async getLoginUrl(relayState = '/') {
    console.log('=== SAML Login URL Generation ===');
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      console.log('Creating SAML login request with relay state:', relayState);
      console.log('SP Entity ID:', this.sp?.entity_id);
      console.log('IDP SSO URL:', this.idp?.sso_login_url);
      this.sp.create_login_request_url(this.idp, { relay_state: relayState }, (err, login_url) => {
        if (err) {
          console.error('SAML login URL creation error:', err);
          console.error('Error details:', JSON.stringify(err, null, 2));
          reject(err);
        } else {
          console.log('SAML login URL created successfully');
          console.log('Login URL length:', login_url?.length);
          console.log('Login URL preview:', login_url?.substring(0, 200));
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