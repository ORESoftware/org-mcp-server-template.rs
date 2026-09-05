# AGENTS.md — ORESoftware/org-mcp-server-template.rs

## Parent / root agent contract

This file is **this repository's** agent contract. The fleet-wide parent lives at:

- GitHub: https://github.com/oresoftware/my-ai/AGENTS.md
- Disk: `~/codes/oresoftware/my-ai/AGENTS.md`
- Installed by `~/codes/oresoftware/my-ai/setup-final.sh` (not `.md`) as symlinks onto:
  - `~/codes/AGENTS.md`
  - `~/codes/.claude/AGENTS.md` and `~/codes/.claude/CLAUDE.md`
  - `~/codes/.cursor/AGENTS.md` and `~/codes/.cursor/.cursorrules`
  - `~/codes/.chatgpt/AGENTS.md`
  - `~/codes/.openai/AGENTS.md`
  - `~/codes/.anthropic/AGENTS.md`

When this file and the parent disagree: follow **this file** for this MCP
server's tools, safety boundary, and env layout; follow the parent for org-wide
git/Linear/GitHub/k8s/shared-auth/opto-sync/ores-otel/zed-pkg conventions.

The mapping is 1:1:1:1 — GitHub org : Linear project : GitHub org project
(usually `https://github.com/orgs/<org>/projects/1`) : Slack channel in
`oresoftware-workspace.slack.com`. Linear workspace: https://linear.app/denman
Primary GitHub user: `ORESoftware`. Secondary: `the1mills`.


## This repository

- GitHub org: [`ORESoftware`](https://github.com/ORESoftware)
- Repository: [`ORESoftware/org-mcp-server-template.rs`](https://github.com/ORESoftware/org-mcp-server-template.rs)
- Local checkout: `~/codes/ores/org-mcp-server-template.rs`
- Linear project: https://linear.app/denman/project/githubcomoresoftware-1574ce77fadf
- GitHub org project: https://github.com/orgs/ORESoftware/projects/1
- Sibling test org: `github.com/oresoftware-test` (external/e2e coverage and extra GHA minutes)
- Slack workspace: oresoftware-workspace.slack.com
- Kind: read-only organization MCP inherited from `ORESoftware/org-mcp-server-template.rs` / `ore-mcp-org-server`
- Package / service name: `org-mcp-server`

Shared backends this org should lean on (see parent file for detail):

- `github.com/shared-auth` — dual auth
- `github.com/opto-sync` — cross-device sync
- `github.com/ores-otel` — logs, traces, metrics (stderr JSON + OTLP; stdout is MCP JSON-RPC only)
- `github.com/zed-pkg` — dependency intent (`.zpkg.toml`)
- `github.com/oresoftware/k8s-cluster` — deploy (except fiducia-cloud node/brain)

## MCP safety for this server

- Tools on this server: `org_identity`, `zed_dependency_graph`, `telemetry_status`, `shared_auth_policy`, `environment_policy`, `security_baseline`.
- stdout is the MCP wire. Diagnostics and telemetry go to stderr only.
- Never log, return, or serialize secret values. Capability checks report names/presence only.
- Do not add filesystem write, kubectl mutation, credentialed SSRF, or unauthenticated non-loopback HTTP without a dedicated review.
- Git: merge, never rebase/stash/reset unless a human explicitly authorizes. Resolve conflicts semantically.

## Encrypted environment (sops + age + just + nix)

Secrets are committed as ciphertext only:

```
env/enc/dev.env.enc     committed ciphertext (source of truth)
env/enc/prod.env.enc    committed ciphertext (protected-operator recipients)
env/dec/*.env           gitignored plaintext, mode 0600, disposable
.env                    managed symlink into env/dec/ only
```

```sh
nix develop                 # or: direnv allow  (.envrc uses the flake)
just env-keygen             # once per machine
just env-decrypt            # env/enc -> env/dec
just env-use dev            # .env -> env/dec/dev.env
just env-run dev cargo test # no plaintext file
just env-check              # fail-closed; CI runs this
```

Private age keys live only in `~/Library/Application Support/sops/age/keys.txt`
(macOS) or `~/.config/sops/age/keys.txt` (Linux), mode 0600. `.just/env.just`
and `.just/dotenv.py` are the shared ores-sops module — keep them byte-identical
across the fleet; do not fork them in this repo.

## Required validation

```sh
just check          # if defined
just env-check
cargo fmt --all -- --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked --all-targets
```
