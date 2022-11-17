# What is this?

This is an HTTP proxy that sits in front of Kibana and logs users in. The users themselves are authenticated via OpenID Connect (OIDC).

A regexp is currently used to map the user's OIDC identity (`sub` field) to a Kibana username, and HMAC is used to derive a password. However it is easy to use a different method if needed (e.g. database) by replacing `getCredentialsForUser()`.
