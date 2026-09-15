# Runtime lock policy

This MCP server template owns runtime coordination through `.ores-lock.toml`. The contract and Rust runtime projection are owned by `ORESoftware/ores-locks-and-leases`; repository-level admission/audit is owned by `ORESoftware/ores-cli`.

The default `service-composed` profile uses Fiducia as the fenced lease authority and PostgreSQL advisory locking as the inner database lock. The file stores only environment-variable names and metadata. Credential values and database URLs remain environment/secret-store owned.

`.zpkg.toml` remains limited to package coordinates plus build/install/publish/test mechanics. Wait/retry/TTL/renewal thresholds belong only to `.ores-lock.toml`. Fencing semantics, stale-holder refusal, owner-token rules, filesystem identity checks, and recovery safety remain implementation invariants rather than configuration switches.
