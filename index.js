const express = require('express');
const { auth, requiresAuth } = require('express-openid-connect');
const http = require('http');

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
if(upstream_url.protocol !== 'http:') {
  console.error('Invalid UPSTREAM: protocol should be http');
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
const UPSTREAM_PORT = parseInt(upstream_url.port || 80);

app.use(auth(config));

function proxy(req, res) {
  const proxyReq = http.request(
    {
      hostname: UPSTREAM_HOST,
      port: UPSTREAM_PORT,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      console.log('Connection established: ');
      proxyRes.on('data', (chunk) => {
        console.log('Data from upstream');
        res.write(chunk, 'binary');
      });
      proxyRes.on('end', () => {
        console.log('End from upstream');
        res.end()
      });
    },
  );

  req.on('data', (chunk) => {
    console.log('Data from client');
    proxyReq.write(chunk, 'binary');
  });
  req.on('end', () => {
    console.log('End from client');
    proxyReq.end();
  });
}

app.all('/*', (req, res) => {
  proxy(req, res);
});

app.listen(PORT, () => {
  console.log(`app listening on port ${PORT}`);
});
