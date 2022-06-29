# What is this?

This is an HTTP proxy that sits in front of Kibana and logs users in. The users themselves are authenticated via OpenID Connect (OIDC).

A database is used to map the user's OIDC identity to a Kibana username/password.
