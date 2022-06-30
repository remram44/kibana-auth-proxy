const { createCipheriv, createDecipheriv } = require('crypto');

if(!process.env.PASSWORD_SECRET) {
  console.error('Missing PASSWORD_SECRET: should be a 16-byte key base64-encoded');
  process.exit(1);
}
const PASSWORD_SECRET = Buffer.from(process.env.PASSWORD_SECRET, 'base64');
if(PASSWORD_SECRET.length !== 16) {
  console.error('Invalid PASSWORD_SECRET: should be a 16-byte key base64-encoded');
  process.exit(1);
}

function getCredentialsForUser(oidcSub) {
  // Extract ID from CILogon sub
  const match = new RegExp('http://cilogon\\.org/(server[^/]+)/users/([0-9]+)$').exec(oidcSub);
  if(!match) {
    throw new Error('Invalid OIDC sub');
  }
  const username = 'oidc-' + match[1] + '-' + match[2];

  // Build password with AES
  let input = Buffer.from(username, 'utf-8');
  if(input.length > 32) {
    throw new Error('OIDC sub is too long');
  }
  input = Buffer.concat([input], 32);
  const cipher = createCipheriv('aes128', PASSWORD_SECRET, PASSWORD_SECRET);
  cipher.setAutoPadding(false);
  const password = Buffer.from(cipher.update(input)).toString('base64').substring(0, 20);

  console.log('mapping', oidcSub, 'to', username);
  return { username, password };
}

module.exports = { getCredentialsForUser };
