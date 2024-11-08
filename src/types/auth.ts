export type AuthHeaders = {
  Authorization?: string;
  'X-Enterprise-Access-Token'?: string;
};

export type AuthenticationData = {
  issuedAt: Date | null;
  expiresAt: Date | null;
};

export type ClientAuthentication = AuthenticationData & {
  token: string;
};

export type ClientAuthenticationData = {
  userAgent?: string;
  applicationId: string;
  applicationSecret: string;
  serverApiId?: string;
  enterpriseToken?: string;
};