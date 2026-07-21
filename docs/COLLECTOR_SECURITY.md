# Collector security

Only administrators with collector permissions can configure, test or run sources. Remote URLs are limited to HTTP(S), resolved before fetch, blocked for private/reserved networks, checked against optional domain allowlists, and fetched without redirects. Requests have time and response-size limits. XML DTD/entities are rejected. Manufacturer scraping is disabled.

Store tokens in deployment environment variables and configure only the variable name. Authorization, API-key and cookie headers are stripped from saved custom headers. Logs use job/request/source IDs and must not contain credentials or raw authorization data. Uploaded CSV/JSON uses existing file limits and formula-injection protections. Never execute source content.
