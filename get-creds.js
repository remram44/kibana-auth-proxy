const { getCredentialsForUser } = require('./lib/creds');

if(process.argv.length !== 3) {
  console.error('Usage: get-creds.js <oidc-sub>');
  process.exit(1);
}

const { username, password } = getCredentialsForUser(process.argv[2]);
process.stdout.write(username + '\n');
process.stdout.write(password + '\n');
