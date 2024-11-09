import { CFToolsClient } from './client';
import { AUTHENTICATION_TOKEN_REFRESH_INTERVAL, AUTHENTICATION_TOKEN_VALIDITY_BUFFER } from '../constants';
import { userAgent } from '../resolvers/library';
import { AuthenticationData, AuthHeaders, ClientAuthenticationData, ClientAuthentication } from '../types/auth';
import { AbstractLogger } from '../types/logger';

export class Authentication implements AuthenticationData, ClientAuthenticationData {
  private client: CFToolsClient;
  private logger: AbstractLogger;

  public issuedAt: Date | null = null;
  public expiresAt: Date | null = null;

  public userAgent: string;
  public applicationId: string;
  public applicationSecret: string;
  public serverApiId?: string;
  public enterpriseToken?: string;
  
  private currentlyRefreshing = false;
  public authenticated = false;
  public authenticationToken: string | null = null;
  public refreshTimeout: NodeJS.Timeout | null = null;

  constructor(client: CFToolsClient, clientAuth: ClientAuthenticationData, logger: AbstractLogger) {
    this.client = client;
    this.logger = logger;

    this.userAgent = clientAuth.userAgent ?? userAgent;
    this.applicationId = clientAuth.applicationId;
    this.applicationSecret = clientAuth.applicationSecret;
    this.serverApiId = clientAuth.serverApiId;
    this.enterpriseToken = clientAuth.enterpriseToken;

    this.logger.debug(`Initialized authentication for application ID ${this.applicationId}`);

    this.getAuthenticationBody = this.getAuthenticationBody.bind(this);
    this.getHeaders = this.getHeaders.bind(this);
    this.isExpired = this.isExpired.bind(this);
    this.shouldRefresh = this.shouldRefresh.bind(this);
    this.isRefreshing = this.isRefreshing.bind(this);
    this.setRefreshing = this.setRefreshing.bind(this);
    this.performRefresh = this.performRefresh.bind(this);
    this.throwExpired = this.throwExpired.bind(this);
    this.resolveServerApiId = this.resolveServerApiId.bind(this);
  }

  public getAuthenticationBody() {
    const result = {
      application_id: this.applicationId,
      secret: this.applicationSecret,
    };

    this.logger.debug('Generated authentication body', result);

    return result;
  }

  public getHeaders(isAuthenticating = false): AuthHeaders {
    if (isAuthenticating) {
      if (this.enterpriseToken?.length) {
        return {
          'X-Enterprise-Access-Token': this.enterpriseToken,
        };
      }
      return {};
    }

    if (!this.authenticated) {
      throw new Error('Not authenticated');
    }

    const headers: AuthHeaders = {
      Authorization: `Bearer ${this.authenticationToken}`,
    };

    if (this.enterpriseToken?.length) {
      headers['X-Enterprise-Access-Token'] = this.enterpriseToken;
    }

    return headers;
  }

  public isExpired(): boolean {
    if (!this.expiresAt) {
      return true;
    }
    
    return this.expiresAt.getTime() < Date.now();
  }

  public shouldRefresh(): boolean {
    if (this.isExpired()) {
      this.logger.debug('Token is expired, refreshing');
      return true;
    }

    if (!this.issuedAt || !this.expiresAt) {
      this.logger.debug('Token has not been issued or expired, refreshing');
      return true;
    }

    const now = Date.now();
    const expiresAt = this.expiresAt.getTime();
    const validityBuffer = AUTHENTICATION_TOKEN_VALIDITY_BUFFER;

    this.logger.debug('Checking if token should be refreshed', {
      now,
      expiresAt,
      validityBuffer,
    });

    return expiresAt - now < validityBuffer;
  }

  public isRefreshing(): boolean {
    this.logger.debug('Checking if token is currently refreshing', this.currentlyRefreshing);
    return this.currentlyRefreshing;
  }

  public setRefreshing(refreshing: boolean): void {
    this.logger.debug('Setting token refreshing state', refreshing);
    this.currentlyRefreshing = refreshing;
  }

  public currentToken(): ClientAuthentication {
    if (!this.authenticationToken) {
      throw new Error('No authentication token available');
    }

    this.logger.debug('Returning existing authentication token');

    return {
      issuedAt: this.issuedAt,
      expiresAt: this.expiresAt,
      token: this.authenticationToken,
    };
  }

  public async performRefresh(): Promise<void> {
    if (!this.shouldRefresh()) {
      this.logger.debug('Token does not need to be refreshed');
      return;
    }

    if (this.isRefreshing()) {
      this.logger.debug('Token is already refreshing, waiting for completion');
      await new Promise((resolve) => {
        const interval = setInterval(() => {
          if (!this.isRefreshing()) {
            clearInterval(interval);
            resolve(null);
          }
        }, 100);
      });
      this.logger.debug('Token has finished refreshing');
    }

    this.setRefreshing(true);
    const newAuthentication = await this.client.authenticate();
    this.issuedAt = newAuthentication.issuedAt;
    this.expiresAt = newAuthentication.expiresAt;
    this.authenticationToken = newAuthentication.token;
    this.setRefreshing(false);

    if (this.refreshTimeout) {
      this.logger.debug('Clearing existing refresh timeout');
      clearInterval(this.refreshTimeout);
    }

    this.refreshTimeout = setInterval(() => {
      this.logger.debug('Refreshing token');
      this.performRefresh();
    }, AUTHENTICATION_TOKEN_REFRESH_INTERVAL);

    return;
  }

  public throwExpired(): void {
    if (this.isExpired()) {
      throw new Error('Token is expired');
    }
  }

  public resolveServerApiId(serverApiId?: string, require?: false): string | null;
  public resolveServerApiId(serverApiId?: string, require?: true): string;
  public resolveServerApiId(serverApiId?: string, require = false): string | null {
    if (serverApiId) {
      this.logger.debug('Resolved server API ID', serverApiId);
      return serverApiId;
    }
  
    if (this.serverApiId) {
      this.logger.debug('Resolved server API ID from client authentication data', this.serverApiId);
      return this.serverApiId;
    }
  
    if (require) {
      this.logger.error('Server API ID is missing');
      throw new Error('Server API ID is missing');
    }
  
    this.logger.debug('Server API ID is not required and missing');
    return null;
  }
}
