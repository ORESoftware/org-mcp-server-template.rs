# Organization MCP server

This repository is generated from the hardened Rust MCP fleet template. The
organization and repository identity are compile-time constants in
`src/main.rs`; generated repositories replace the template values before their
first release.

The server is deliberately read-only and exposes six no-argument tools:

- `org_identity` — canonical organization, repository, package, version, and
  access mode;
- `zed_dependency_graph` — Zed-owned dependency intent and `.vendor/.zed`
  materialization policy;
- `telemetry_status` — non-sensitive `ores-otel` traces, metrics, logs, and
  structured-stderr initialization status;
- `shared_auth_policy` — the fail-closed identity/realm boundary and whether a
  public Shared Auth authority is configured, without accepting credentials;
- `environment_policy` — SOPS+age ciphertext and ignored-plaintext rules;
- `security_baseline` — mutation, output-bound, logging, auth, dependency, and
  secret-handling guarantees.

`ORESoftware/mcp-rust-libs` is pinned to immutable revision
`42cd61aae6908a7c587ababd954bcd8a05520d92`. Its organization-server crate pins
`ores-otel/ores-mcp-server-core-libs.rs` to reviewed revision
`e559a76f869c2c2d9bf939b510d358a3924abd81` for JSON logs on stderr plus OTLP
traces, metrics, and logs. MCP protocol frames own stdout.

## Run

Enter the pinned Nix shell and run with a SOPS-encrypted environment profile:

```sh
nix develop
just run dev
```

Only `env/enc/*.env.enc` ciphertext is committed. `just decrypt dev` writes a
mode-0600 ignored file to `env/dec/dev.env`; `just encrypt dev` updates the
ciphertext. Private age identities never belong in this repository.

`SHARED_AUTH_BASE_URL` is optional for this public policy-only baseline. A
product-specific server that protects an HTTP or mutation boundary must use the
official Shared Auth interfaces, guard, and clients; verify ES256/JWKS locally
for ordinary traffic; pin exact issuer/audience/client/realm; and keep product
authorization in the product authority. This baseline never accepts tokens,
cookies, service credentials, or identity data.

Dependency intent lives in `.zpkg.toml`. Zed owns package identity, lock
provenance, and `.vendor/.zed` materialization; Cargo still builds the Rust
binary from exact Git and crate lock revisions.

## Validate

```sh
just check
```

The gate runs formatting, warning-denied Clippy, tests, dependency audit, and
the encrypted-environment policy. CI additionally smoke-tests the real MCP
stdio lifecycle and checks that stdout contains only JSON-RPC frames.
