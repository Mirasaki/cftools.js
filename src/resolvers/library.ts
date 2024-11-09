import pkg from '../../package.json';

/**
 * The user agent to use for requests
 */
export const userAgent = `${pkg.name}/${pkg.version} (${pkg.repository.url})`;

/**
 * The default log tag to use for logging
 */
export const defaultLogTag = userAgent;