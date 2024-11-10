import pkg from '../../package.json';

/**
 * The user agent to use for requests
 */
export const minimalUserAgent = `${pkg.name}/${pkg.version}`;
export const userAgent = `${minimalUserAgent} (${pkg.repository.url})`;

/**
 * The default log tag to use for logging
 */
export const defaultLogTag = minimalUserAgent;