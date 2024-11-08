// Credits: https://github.com/sindresorhus/ip-regex/blob/main/index.js

const v4 = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}';

export const isIPV4 = (ip: string): boolean => {
  const regex = new RegExp(`^${v4}$`);
  return regex.test(ip);
};