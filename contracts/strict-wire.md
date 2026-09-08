# Strict wire admission in both MCP conformance paths

DEN-3828; upstream ORESoftware/typespec-json-schema-validator#20 and
ORESoftware/mcp-rust-libs#40.

Both existing conformance paths now consume the reviewed shared MCP representation
gate. Neither TypeSpec nor authored JSON Schema is changed. The singular
`mcp-contract.yml` workflow pins the complete shared runner and keeps its fresh
parity, negative controls, Contract IR verification, actual binary calls and failed
result tombstone. The reusable `.github/actions/mcp-contracts` action pins the same
shared commit for the six inherited read-only tools and both existing profiles.

## Fixed shared dependency

Shared source: `ORESoftware/mcp-rust-libs@487df19ec2542616924041bc244c5660c1ed0bf4`.
`tooling/mcp-shared-json.mjs` requires the absolute `MCP_SHARED_TOOLS_ROOT` supplied
by the action, verifies the SHA-256 of `tooling/org-mcp-contract/json.mjs`, and
imports those exact verified bytes. It never falls back to local JSON.parse or
loads an unverified file. The module uses only Node built-ins. No implementation
is copied into this repository; changing the pin/digest needs a reviewed change.

`ores.mcp-strict-json/v1` rejects duplicate decoded member names, malformed UTF-8,
non-finite numeric overflow, lone surrogate strings and excessive nesting before
schema validation. Limits are 1 MiB and 64 containers, with the inherited tool
JSON-text limit remaining stricter at 64 KiB. Arrays and prototype-shaped member
names remain literal data. These are conservative test interoperability bounds,
not universal JSON compliance or arbitrary-precision arithmetic.

The reusable wire harness also rejects blank/non-JSON output, response/method
hybrids and unrelated internal errors masquerading as negative-call coverage.
Existing byte bounds, clean shutdown, environment sanitization, exact-source IR
verification and actual compiled Rust binary tests remain required. The runtime
evidence includes the strict wire policy, shared revision and parser digest.
The profile's named tools, outputs, protocol, and read-only scope are unchanged.

## Local runner checks

With the pinned shared checkout available:

```sh
MCP_SHARED_TOOLS_ROOT=/absolute/path/to/mcp-rust-libs \
  node --test tooling/mcp-wire*.test.mjs
```

The action runs the complete shared runner suite as well as template tests.
The additional template regressions prove duplicate/escaped members, UTF-8/depth
handling, actual subprocess rejection, missing-checkout failure, and rejection of
tampered parser bytes before execution. Unit tests are not substitutes for the
native compiler and locked Rust build/conformance jobs in each consumer.

Adopt through immutable action pins in consumer PRs; record their exact-head CI.
This does not certify remote OAuth, business tools, production authorization,
all MCP servers, or the broader compiler/emitter scope of issue 20.
