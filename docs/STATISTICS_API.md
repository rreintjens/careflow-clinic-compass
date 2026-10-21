# Tenant statistics API

`GET /api/public/stats?days=30` returns aggregate statistics for the tenant resolved from the connection key. Supply the key in the `x-api-key` request header. Never put it in a URL: requests containing a `key` query parameter are rejected, even with a valid header.

The connection key is shown once on rotation; only its hash is stored. Responses are not cached. Successful and failed requests associated with a valid tenant key are recorded in `stats_requests`. The response contains totals, not patient identity or individual medical answers. Invalid keys receive the same generic 403 response.

Patient pages do not load external analytics scripts. This remains a binding security-package requirement, including after cookie consent.