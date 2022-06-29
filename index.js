const express = require('express');
const { auth, requiresAuth } = require('express-openid-connect');
const http = require('http');
const https = require('https');

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

app.all('/*', (req, res) => {
  proxy(req, res);
});

app.listen(PORT, () => {
  console.log(`app listening on port ${PORT}`);
});
