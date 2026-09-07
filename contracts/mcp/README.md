# Inherited MCP contracts (DEN-3828)

`main.tsp` and `authored.schema.json` are independently authored peer authorities.
Neither is generated from the other. The official TypeSpec emitter produces a
comparison-only witness in a fresh temporary directory; it never writes either
source. Recorded positive/negative fixtures are independent acceptance evidence.

The shared `.github/actions/mcp-contracts` action builds the consumer's real,
lockfile-pinned Rust binary. It runs the pinned TypeSpec/JSON Schema validator,
exports Contract IR, verifies its exact source closure and receipt binding, and
proves that changed authorities and tampered IR are rejected before testing any
server output. Missing compilers, unsupported features, missing tools, stale
receipts, schema drift, and runtime mismatches are failures, not skipped passes.

The Node wire harness performs sequential MCP initialization and tool calls. It
checks six inherited tools, closed advertised input schemas, both response-schema
lanes, organization/repository identity, malformed and unexpected arguments,
unknown-tool rejection, oversized-frame recovery, output limits, JSON-only stdout
and structured stderr. Test child processes receive no inherited credentials or
collector/auth configuration. It does not call additional product-specific tools.

Consumers pin the action to a reviewed immutable template commit. Existing Rust,
environment, audit, and product tests remain mandatory and are not replaced by this
gate. Additional product tools need their own peer contracts and runtime suites.
The evidence is bounded conformance, not universal schema equivalence, production
authorization certification, or completion of the multi-target compiler tracked
in ORESoftware/typespec-json-schema-validator#20.

Harness unit tests (no compiler required):

```sh
node --test tooling/mcp-wire.test.mjs
```

The workflow uploads the deterministic parity receipt, verified Contract IR and
runtime evidence with the tested Git revision. Every execution gets a fresh
subdirectory, so a failed rerun cannot reuse an old successful runtime artifact.
Generated evidence is not editable contract authority and must not be copied into
an authored source to make a test pass.
