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

app.use(auth(config));

app.all('/*', (req, res) => {
  res.type('text/plain').send('Hello, world');
});

app.listen(PORT, () => {
  console.log(`app listening on port ${PORT}`);
});
