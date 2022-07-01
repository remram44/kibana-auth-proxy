# What is this?

This is an HTTP proxy that sits in front of Kibana and logs users in. The users themselves are authenticated via OpenID Connect (OIDC).

A regexp is current used to map the user's OIDC identity to a Kubana username/password (using HMAC to derive a secret password). However it is easy to use a different method if needed (e.g. database).
