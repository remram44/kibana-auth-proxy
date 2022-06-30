const express = require('express');
const { auth, requiresAuth } = require('express-openid-connect');
const http = require('http');
const https = require('https');
const { createCipheriv, createDecipheriv } = require('crypto');

const PORT = 3000;

const app = express();

const config = {
  authRequired: true,
  auth0Logout: true,
  baseURL: process.env.BASE_URL,
  secret: process.env.SECRET,
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
  routes: {
    callback: '/oauth2/callback',
    login: '/oauth2/login',
    logout: '/oauth2/logout',
    postLogoutRedirect: '/',
  },
  authorizationParams: {
    scope: 'openid profile email',
    response_type: 'code',
  },
};

if(!process.env.PASSWORD_SECRET) {
  console.error('Missing PASSWORD_SECRET: should be a 16-byte key base64-encoded');
  process.exit(1);
}
const PASSWORD_SECRET = Buffer.from(process.env.PASSWORD_SECRET, 'base64');
if(PASSWORD_SECRET.length !== 16) {
  console.error('Invalid PASSWORD_SECRET: should be a 16-byte key base64-encoded');
  process.exit(1);
}

const upstream_url = new URL(process.env.UPSTREAM);
let UPSTREAM_PROTO, UPSTREAM_PORT;
if(upstream_url.protocol === 'http:') {
  UPSTREAM_PROTO = http;
  UPSTREAM_PORT = 80;
} else if(upstream_url.protocol === 'https:') {
  UPSTREAM_PROTO = https;
  UPSTREAM_PORT = 443;
} else {
  console.error('Invalid UPSTREAM: protocol should be http or https');
  process.exit(1);
}
if(
  (upstream_url.pathname !== '/' && upstream_url.pathname !== '')
  || upstream_url.search
  || upstream_url.hash
  || upstream_url.username
  || upstream_url.password
) {
  console.error('Invalid UPSTREAM: path is set');
  process.exit(1);
}
const UPSTREAM_HOST = upstream_url.host;
if(upstream_url.port) {
  UPSTREAM_PORT = parseInt(upstream_url.port);
}
console.log(`Using upstream ${UPSTREAM_HOST}:${UPSTREAM_PORT}`);

app.use(auth(config));

function proxy(req, res) {
  const headers = {};
  for(let [key, value] of Object.entries(req.headers)) {
    const lowerKey = key.toLowerCase();
    if(lowerKey !== 'host' && lowerKey !== 'connection') {
      headers[key] = value;
    }
  }
  const proxyReq = UPSTREAM_PROTO.request(
    {
      hostname: UPSTREAM_HOST,
      port: UPSTREAM_PORT,
      path: req.url,
      method: req.method,
      headers: headers,
    },
    (proxyRes) => {
      console.log(proxyRes.statusCode, req.url);
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.on('data', (chunk) => {
        res.write(chunk, 'binary');
      });
      proxyRes.on('end', () => {
        res.end()
      });
    },
  );

  req.on('data', (chunk) => {
    proxyReq.write(chunk, 'binary');
  });
  req.on('end', () => {
    proxyReq.end();
  });
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

function doLogin(req, res) {
  // Send login request
  const path = '/internal/security/login';
  console.log('Sending login request');
  const loginReq = UPSTREAM_PROTO.request(
    {
      hostname: UPSTREAM_HOST,
      port: UPSTREAM_PORT,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'kbn-version': '7.10.2',
        'Origin': `http://${req.headers.host}`,
        'Referer': `http://${req.headers.host}/login?next=%2F`,
      },
    },
    (loginRes) => {
      debugger;
      console.log('(login)', loginRes.statusCode, path);
      if(loginRes.statusCode === 200) {
        // Send cookie and redirect
        res.writeHead(
          303,
          {
            'Set-Cookie': loginRes.headers['set-cookie'],
            'Location': '/',
          },
        );
        res.end();
        console.log('(login complete)', 303, req.url);
      } else {
        console.log(loginRes.headers);
        res.writeHead(loginRes.statusCode, loginRes.headers);
        loginRes.on('data', (chunk) => {
          res.write(chunk, 'binary');
        });
        loginRes.on('end', () => res.end());
      }
    },
  );
  loginReq.write(JSON.stringify({
    providerType: 'basic',
    providerName: 'basic',
    currentURL: `http://${req.headers.host}/login?next=%2F`,
    params: getCredentialsForUser(req.oidc.user.sub),
  }));
  loginReq.end();
}

app.all('/*', (req, res) => {
  // If we are not authenticated with OIDC, we will be redirected to do the auth
  // (because authRequired is set)
  if(req.url.startsWith('/login')) {
    // If we are hitting the Kibana login page, send the login request
    doLogin(req, res);
  } else {
    // Otherwise just proxy
    proxy(req, res);
  }
});

app.listen(PORT, () => {
  console.log(`app listening on port ${PORT}`);
});
