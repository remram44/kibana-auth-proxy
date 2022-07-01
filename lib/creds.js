const { createHmac } = require('crypto');

if(!process.env.PASSWORD_SECRET) {
  console.error('Missing PASSWORD_SECRET');
  process.exit(1);
}
const PASSWORD_SECRET = process.env.PASSWORD_SECRET;
if(PASSWORD_SECRET.length < 16) {
  console.error('Invalid PASSWORD_SECRET: should be at least 16 characters');
  process.exit(1);
}

function getCredentialsForUser(oidcSub) {
  // Extract ID from CILogon sub
  const match = new RegExp('http://cilogon\\.org/(server[^/]+)/users/([0-9]+)$').exec(oidcSub);
  if(!match) {
    throw new Error('Invalid OIDC sub');
  }
  const username = 'oidc-' + match[1] + '-' + match[2];

  // Build password with HMAC
  const hmac = createHmac('sha256', PASSWORD_SECRET);
  hmac.update(Buffer.from(username, 'utf-8'));
  const password = hmac.digest('base64').substring(0, 20);

  console.log('mapping', oidcSub, 'to', username);
  return { username, password };
}

module.exports = { getCredentialsForUser };
