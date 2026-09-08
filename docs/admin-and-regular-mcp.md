# Regular and administrator MCP servers

Tracking: DEN-1248. This document separates implemented behavior from a planned administrator surface. Parent governance: https://github.com/ORESoftware/my-ai/blob/main/AGENTS.md.

## What this template implements today

The pinned `ore-mcp-org-server` runtime in Cargo.toml exposes six closed, no-argument stdio tools. There is **no administrator tool set or role elevation mode** in this template. An administrator launching this regular binary gets the same six tools as any other caller able to launch/connect to that process. The OS launch boundary is not per-user MCP authentication; do not expose a shared credentialed process to untrusted users and call it authenticated.

| Implemented tool | Non-admin caller admitted to the process | Admin caller admitted to the same process | What it does not do |
| --- | --- | --- | --- |
| `org_identity` | Read compiled organization/repository/service/version identity | Identical | Authenticate a user or grant a role |
| `zed_dependency_graph` | Read declared dependency graph and materialization policy | Identical | Install packages or prove all dependants work |
| `telemetry_status` | Read non-sensitive telemetry initialization flags | Identical | Read customer logs, collector credentials or live system health |
| `shared_auth_policy` | Read policy guidance and authority-URL presence flag | Identical | Validate a bearer token, prove the authority is reachable, or authorize a product action |
| `environment_policy` | Read the SOPS/age/Just/Nix policy | Identical | Decrypt files, disclose secrets or audit a deployed environment |
| `security_baseline` | Read the declared baseline contract | Identical | Certify arbitrary downstream extensions or deployment security |

`role`, `is_admin`, `tenant_id` and other unexpected identity-tool fields must be rejected, not interpreted as authority. Unknown administrator tool names must fail. These negative probes protect the closed template surface; they are **not** JWT, session, revocation or cross-tenant authorization tests.

## Preserve richer downstream servers

Some organization servers use newer shared bootstrap libraries and expose more than these six tools, resources and prompts. Borrowing this template does not mean replacing them with the old six-tool entry point. Record exact catalogs over the wire, preserve legitimate domain behavior, and test a complete explicit expected catalog. A template URL in a README is provenance documentation, not runtime dependency reuse.

Read-only annotations are metadata, not access control. Cargo check/test, Flutter analysis and other subprocess tools can execute repository code and write artifacts. Sensitive log/ledger/infrastructure reads also need tenant/resource authorization even when they do not mutate data. Do not describe these as safe for every ordinary user merely because the process is an MCP server.

## Planned separate `*-admin-mcp-server.rs` family

Status: **plan only; no admin endpoint is enabled by this change**.

Both regular and admin families must reuse this repository's reviewed transport/testing/environment conventions and the shared `ORESoftware/mcp-rust-libs` crates. Record the exact template commit and shared-crate revisions in a provenance file and the Cargo/Zed dependency graph. Adopt subsequent changes through reviewed dependency PRs, not a moving branch or blind copying. Keep `*-interfaces` contracts (independent TypeSpec and JSON Schema), `*-lib-core` domain/config logic and `*-orm-core` Diesel/SeaORM operations shared across servers.

The administrator server belongs in a separate repository with separate read/write membership, binary, deployment/service account, secret scope, workload identity, network/VPC boundary, OAuth audience and release approvals. Regular-server credentials must be unable to call administrator backends. Do not implement this separation as just an `admin=true` flag or an extra public route on the regular deployment.

| Planned capability | Regular surface | Admin surface acceptance requirement |
| --- | --- | --- |
| Tenant-scoped diagnostics | Explicit resource grant and redaction | Same checks; organization role is not cross-tenant permission |
| Membership, role and policy changes | Denied | Verified admin scope plus current tenant membership; independent realm; audited typed actions |
| Financial adjustments/refunds | Denied | Step-up human approval, money invariants/formal checks, transactional/idempotent execution |
| Deployment, retention and destructive lifecycle operations | Denied | Resource allowlist, explicit confirmation, environment policy, replay protection and audit |
| Build/test execution | Not available by default | Disposable sandbox and build identity, never production credentials |
| Secret export, arbitrary SQL/shell, credential passthrough | Denied | Denied by default; not an implied administrator power |

Authenticate and authorize every tools/call and resource read with shared-auth and owning-product policy. Validate issuer, audience, expiry, scopes and tenant/resource membership using verified claims; client-supplied fields never establish authority. Filter tools/list/resources/list too, but hiding discovery is not enforcement. Keep independent customer/admin realms and redacted ores-otel audit events. HTTP deployments must implement the applicable MCP authorization specification; a session ID is not authentication.

Before enabling an admin action, paired-test-org evidence must cover legitimate same-tenant success and anonymous, non-admin, forged-role, wrong-audience, expired/revoked, cross-tenant, replay and regular-to-admin credential denial. Financial/state-machine operations need their domain invariants and race/fencing tests. Publishing a plan or a passing regular-template probe does not satisfy those gates.

## Reusable real-process probe

Build the server from an immutable locked graph. Invoke `.github/actions/access-boundary` from this repository at a **reviewed 40-character commit SHA**, passing `binary`, `organization`, `repository` and the full `expected-tools-json` list. The action uses environment inputs rather than interpolating them into shell code, executes no shell from tool parameters, starts the child with a minimal environment and disposable HOME, enforces bounded output/timeouts, and exercises initialization, exact discovery, identity, spoof rejection, unknown-action rejection and clean EOF.

Locally, with an already-built template:

```sh
node --test test/access-boundary.test.mjs
cargo build --locked --bin org-mcp-server
node scripts/access-boundary.mjs
```

For a richer consumer set `MCP_BINARY`, `MCP_EXPECT_ORGANIZATION`, `MCP_EXPECT_REPOSITORY` and `MCP_EXPECT_TOOLS` in the environment. Do not use the six-tool default to flatten a richer catalog. This profile expects a closed `org_identity` tool; incompatible identity contracts require an explicitly reviewed probe profile rather than weakening checks. The probe's `authorizationCertified: false` is intentional. It is one regression layer, not a substitute for the consumer's full resource/prompt, auth and deployment tests.

References: MCP tools https://modelcontextprotocol.io/specification/2025-11-25/server/tools and authorization https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization.
