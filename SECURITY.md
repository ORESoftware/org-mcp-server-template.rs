# Security policy

This MCP server is a read-only diagnostics surface. It has no tool for file,
Git, cloud, database, identity, package, or deployment mutation. Any future
mutation is an architecture change requiring a threat model, explicit runtime
gate, per-operation confirmation, idempotency, audit evidence, and product-owner
approval.

Stdout is reserved exclusively for MCP JSON-RPC. Structured application logs go
to stderr through `ores-otel`. Telemetry attributes are closed, bounded, and
low-cardinality; arguments, results, credentials, identity data, URLs containing
secrets, arbitrary errors, and payload bodies are excluded.

Secrets must be injected from SOPS+age ciphertext under `env/enc/*.env.enc` or
the approved runtime secret manager. Never commit plaintext, private age keys,
tokens, cookies, passwords, database URLs, signing material, OTPs, provider
subjects, email addresses, or service credentials. Never pass secrets through
CLI flags, URLs, logs, traces, metrics, prompts, fixtures, screenshots, or image
layers.

Shared Auth proves identity, realm, provider provenance, session, and assurance;
it does not own product memberships, roles, billing, subscriptions, or resource
permissions. Keep admin and customer realms independent. Fail closed for
privileged work when an authority cannot decide, and preserve `anonymous`,
`unauthenticated`, and `degraded` as distinct outcomes.

Dependency changes must update Cargo.lock and `.zpkg.toml`, use reviewed
immutable Git revisions, and pass `just check`. Report vulnerabilities privately
through the repository Security tab; do not open a public issue containing
exploit details or credentials.
