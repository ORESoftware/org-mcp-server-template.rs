# MCP peer contracts and implementation checks

Tracks DEN-3828 and [validator issue 20](https://github.com/ORESoftware/typespec-json-schema-validator/issues/20).

`main.tsp` and `authored.schema.json` are independently authored peer data
contracts. Neither is generated from or overwritten by the other. The TypeSpec
JSON Schema emitter produces a disposable comparison witness only. The explicit
`additionalProperties: false` policy is authored in both lanes; the runner turns
off the emitter's implicit object-sealing option, not either authority's closure.

The initial scope is `org_identity`, with `NoArguments` and `OrgIdentity` data
models. The operation manifest names the tool, exact protocol, legacy JSON-text
encoding, positive/negative calls and expected template identity. It is operation
metadata plus test evidence, not another data-schema authority. Recorded fixtures
under `instances/*/{valid,invalid}` must have the stated verdict in BOTH lanes.
Three additional negative controls alter disposable schema copies: opening the
object, dropping a required field and changing the access-mode constant. Each
must stop parity. The authored repository files stay untouched.

## What CI executes

The workflow pins the shared runner and validator to immutable Git commits and
installs the validator's locked TypeSpec/compiler dependencies. It builds this
repository's real Rust binary using the existing Cargo.lock/runtime pin. Then it
runs fresh structural/differential parity, builds and verifies exact-input Contract
IR, checks the binary's advertised input schema, and exercises real stdio calls.
Both original schema lanes validate the returned JSON. Unknown fields, an injected
organization and a credential-shaped argument must be rejected. No real secret
is provided; the server receives an empty environment.

The fixed task is `node scripts/check-mcp-contract.mjs` after the two pinned
checkouts and toolchain setup in `.github/workflows/mcp-contract.yml`. It takes no
arguments and does not introduce a second CLI parser. The test runner is imported
from `ORESoftware/mcp-rust-libs/tooling/org-mcp-contract`; do not copy/fork it into
consumer servers. There is no local replacement validator.

Every task invocation first invalidates `artifacts/mcp-contract/conformance.json`
with failed/incomplete evidence. Each invocation has its own witness/receipt/IR
directory. A passed result is written only after the actual binary, manifest and
source/IR checks finish, and binds their SHA-256/IR/run identities plus source,
runner, validator, Node and Rust revisions. CI archives evidence even on failure;
archive presence is NOT approval. Saved hashes are not signatures or permission
to skip a fresh check. Existing Rust, dependency/security and encrypted-environment
checks remain required and are not replaced by this workflow.

## Deliberate compatibility boundary

The runtime remains pinned to `cf4523ec14fcca969ce2570f6a659c53e049773d`, whose
identity response has `transport: "stdio"`. The newer shared runtime uses a
different identity shape; do not silently relax the schema to pass both. A runtime
upgrade requires reviewing both authored contracts and the fixture/operation
expectations together. This change does not add advertised structured output,
provider tools, HTTP/OAuth, mutation capabilities or production admission middleware.

Coverage is explicitly `declared-tools-only`, not all six tools or the whole fleet.
The shared runner's Node fixture tests are distinct from this compiler-backed Rust
integration. Neither finite fixture set proves universal schema equivalence. Add
further tool contracts and consumer-server PRs with their actual runtime revisions
and identities; require their own CI before merging or deploying.
