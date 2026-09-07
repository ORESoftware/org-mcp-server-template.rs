import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { exerciseServer } from './mcp-wire.mjs';

// Fixed CI entrypoint, not a second option parser. The action owns these inputs.
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const validatorRoot = process.env.MCP_VALIDATOR_ROOT;
const binary = process.env.MCP_BINARY;
const expectedRepository = process.env.MCP_EXPECTED_REPOSITORY;
const outputBase = process.env.MCP_CONTRACT_OUTPUT;
assert(validatorRoot && binary && expectedRepository && outputBase, 'action configuration is incomplete');
const api = await import(pathToFileURL(join(resolve(validatorRoot), 'src/index.mjs')).href);
const typespec = join(root, 'contracts/mcp/main.tsp');
const authoredSchema = join(root, 'contracts/mcp/authored.schema.json');
await mkdir(outputBase, { recursive: true });
const outputDir = await mkdtemp(join(resolve(outputBase), 'run-'));
const generatedSchema = join(outputDir, 'witness/typespec.generated.schema.json');
const report = await api.runCheck({
  typespec, authoredSchema, outputDir: join(outputDir, 'witness'),
  instances: join(root, 'contracts/mcp/instances'),
  probes: true, maxProbes: 64, sealObjectSchemas: true,
});
await api.writeReport(join(outputDir, 'parity-report.json'), report);
assert.equal(report.status, 'passed', `peer parity failed: ${JSON.stringify(report.findings)}`);
assert.equal(report.zeroUnexplainedFindings, true);
const ir = await api.buildContractIr({ report, typespec, generatedSchema, authoredSchema });
await api.writeContractIr(join(outputDir, 'contract-ir.json'), ir);
const verified = await api.verifyContractIr({ contractIr: ir, report, typespec, generatedSchema, authoredSchema });
assert.equal(verified.status, 'passed', verified.error ?? 'IR admission failed');
assert.equal(verified.admissible, true);

// A copied pass marker or changed declaration must not substitute for verification.
for (const contractIr of [{ ...ir, irId: '0'.repeat(64) }, { ...ir, declarations: [] }]) {
  const rejected = await api.verifyContractIr({ contractIr, report, typespec, generatedSchema, authoredSchema });
  assert.equal(rejected.admissible, false, 'tampered IR was admitted');
}
const mutatedPath = join(outputDir, 'mutated-authority.schema.json');
const mutated = JSON.parse(await readFile(authoredSchema, 'utf8'));
mutated.$defs.OrgIdentity.properties.accessMode.const = 'read_write';
await writeFile(mutatedPath, JSON.stringify(mutated));
const stale = await api.verifyContractIr({ contractIr: ir, report, typespec, generatedSchema, authoredSchema: mutatedPath });
assert.equal(stale.admissible, false, 'receipt admitted a changed authority');

const lanes = [];
for (const path of [authoredSchema, generatedSchema]) {
  const document = JSON.parse(await readFile(path, 'utf8'));
  const resolver = new api.SchemaResolver();
  const registered = resolver.addDocument(document, path);
  lanes.push({ document, resolver, base: registered.base });
}
function verdict(model, instance) {
  return lanes.map(({ document, resolver, base }) => {
    assert(Object.hasOwn(document.$defs, model), `missing declaration ${model}`);
    return api.validateInstance({ schema: document.$defs[model], instance, resolver, base }).valid;
  });
}
function validate(model, instance) {
  assert.deepEqual(verdict(model, instance), [true, true], `${model} runtime response violated peer contracts`);
  assert.deepEqual(verdict(model, { ...instance, __unexpected_contract_field__: true }), [false, false], `${model} is not closed`);
}
assert.deepEqual(verdict('NoArguments', { unexpected: true }), [false, false]);
assert.deepEqual(verdict('NoArguments', []), [false, false]);
function validateInputSchema(schema) {
  const resolver = new api.SchemaResolver();
  const { base } = resolver.addDocument(schema, join(outputDir, 'runtime-input.schema.json'));
  for (const [instance, expected] of [[{}, true], [{ unexpected: true }, false], [[], false], ['invalid', false]]) {
    assert.equal(api.validateInstance({ schema, instance, resolver, base }).valid, expected, 'advertised input schema is not closed/no-argument');
  }
}
const runtime = await exerciseServer({ binary: resolve(binary), expectedRepository, validate, validateInputSchema });
await writeFile(join(outputDir, 'runtime-evidence.json'), JSON.stringify({
  schema: 'ores.mcp-baseline-conformance/v1',
  repository: expectedRepository,
  commit: process.env.MCP_TESTED_COMMIT,
  scope: 'six inherited read-only stdio tools; not product authorization or full compiler certification',
  receiptRunId: report.runId, contractIrId: ir.irId,
  status: 'passed', ...runtime,
}, null, 2) + '\n');
console.log(`Passed peer parity, exact-source IR verification, tamper/staleness rejection, and ${runtime.calls} real stdio calls.`);
