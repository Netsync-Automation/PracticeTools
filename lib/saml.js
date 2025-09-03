import saml2 from 'saml2-js';
import { createSAMLConfig } from './saml-config.js';

export class SAMLService {
  constructor() {
    this.sp = null;
    this.idp = null;
    this.configPromise = null;
    this.initialized = false;
  }

  async ensureInitialized() {
    if (!this.configPromise) {
      this.configPromise = this.initializeConfig();
    }
    await this.configPromise;
    return this.configPromise;
  }

  async initializeConfig() {
    const config = await createSAMLConfig();
    this.sp = new saml2.ServiceProvider(config.sp);
    this.idp = new saml2.IdentityProvider(config.idp);
    this.initialized = true;
    return config;
  }

  async getLoginUrl(relayState = '/') {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      this.sp.create_login_request_url(this.idp, { relay_state: relayState }, (err, login_url) => {
        if (err) {
          reject(err);
        } else {
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