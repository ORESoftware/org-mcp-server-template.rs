import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Fixed repository task: no independent command-line parser or credential options.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const artifacts = join(root, 'artifacts/mcp-contract');
const resultPath = join(artifacts, 'conformance.json');
await mkdir(artifacts, { recursive: true });
await writeFile(resultPath, JSON.stringify({ schema: 'ores.mcp-tool-conformance-result/v1',
  status: 'failed', reason: 'current-run-not-complete' }) + '\n');
let phase = 'toolchain';
try {
  assert.equal(process.argv.length, 2, 'this fixed task does not accept arguments');
  const api = await import('../.contract-validator/src/index.mjs');
  const { admitContract, checkImplementation } = await import('../.contract-tools/tooling/org-mcp-contract/index.mjs');
  const revision = (cwd) => execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  const toolchains = {
    consumer: revision(root),
    validator: revision(join(root, '.contract-validator')),
    runner: revision(join(root, '.contract-tools')),
    node: process.version,
    rustc: execFileSync('rustc', ['--version'], { encoding: 'utf8' }).trim(),
  };
  assert.equal(toolchains.validator, 'e00f586e639e505d83ab1058248c0e15e504c15c');
  assert.equal(toolchains.runner, '3d13363a49a55abb7fbd35f4309c7b954ff84503');
  const work = await mkdtemp(join(artifacts, 'run-'));
  const options = {
    typespec: join(root, 'contracts/main.tsp'),
    authoredSchema: join(root, 'contracts/authored.schema.json'),
    instances: join(root, 'contracts/instances'),
    outputDir: join(work, 'witness'),
    tspBin: join(root, '.contract-validator/node_modules/.bin/tsp'),
    // Object closure is explicitly authored in BOTH lanes via additionalProperties.
    sealObjectSchemas: false,
    probes: true,
    formatAssertion: true,
  };
  phase = 'negative-parity-controls';
  const authored = JSON.parse(await readFile(options.authoredSchema, 'utf8'));
  const mutations = [
    ['open-object', (schema) => { schema.$defs.OrgIdentity.additionalProperties = true; }],
    ['missing-required', (schema) => { schema.$defs.OrgIdentity.required = schema.$defs.OrgIdentity.required.filter((name) => name !== 'version'); }],
    ['wrong-access-mode', (schema) => { schema.$defs.OrgIdentity.properties.accessMode.const = 'read_write'; }],
  ];
  for (const [name, mutate] of mutations) {
    const schema = structuredClone(authored); mutate(schema);
    const path = join(work, `${name}.json`); await writeFile(path, JSON.stringify(schema));
    const report = await api.runCheck({ ...options, authoredSchema: path, outputDir: join(work, name) });
    await api.writeReport(join(work, `${name}-report.json`), report);
    assert.equal(report.status, 'stopped_for_evaluation', `negative parity control ${name} did not detect drift`);
  }
  phase = 'peer-parity-and-ir';
  const archivedApi = { ...api,
    async runCheck(config) {
      const report = await api.runCheck(config);
      await api.writeReport(join(work, 'parity-report.json'), report);
      return report;
    },
    async buildContractIr(config) {
      const ir = await api.buildContractIr(config);
      await api.writeContractIr(join(work, 'contract-ir.json'), ir);
      return ir;
    },
  };
  const admitted = await admitContract(archivedApi, options);
  phase = 'compiled-binary-conformance';
  const evidence = await checkImplementation({ binary: join(root, 'target/debug/org-mcp-server'),
    cwd: root, manifestPath: join(root, 'contracts/operations.json'), admitted });
  await writeFile(resultPath, JSON.stringify({ ...evidence, toolchains,
    negativeParityControls: mutations.map(([name]) => name) }, null, 2) + '\n');
  console.log('MCP org_identity peer parity, IR and compiled-binary conformance passed');
} catch (error) {
  await writeFile(resultPath, JSON.stringify({ schema: 'ores.mcp-tool-conformance-result/v1',
    status: 'failed', phase, reason: error.message?.startsWith('MCP contract:') ? error.message : 'required check failed' }, null, 2) + '\n');
  console.error(`MCP conformance failed in ${phase}; inspect the current-run artifacts`);
  process.exitCode = 1;
}
