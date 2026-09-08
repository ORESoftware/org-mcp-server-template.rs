import test from 'node:test';
import assert from 'node:assert/strict';
import { BASELINE, expectedTools, checkCatalog, isRejected, readIdentity } from '../scripts/access-boundary.mjs';
const catalog = () => BASELINE.map(name => ({ name, inputSchema: { type: 'object', additionalProperties: false } }));
test('complete catalog is sorted and duplicates/invalid names rejected', () => {
  assert.deepEqual(expectedTools(), BASELINE);
  assert.throws(() => expectedTools('[]'));
  assert.throws(() => expectedTools('["org_identity","org_identity"]'));
  assert.throws(() => expectedTools('["org_identity","../x"]'));
  assert.throws(() => expectedTools('["other"]'));
});
test('domain additions and omissions require explicit review', () => {
  checkCatalog(catalog(), BASELINE);
  assert.throws(() => checkCatalog(catalog().slice(1), BASELINE));
  assert.throws(() => checkCatalog([...catalog(), { name: 'admin_write' }], BASELINE));
});
test('open identity schema cannot pass', () => {
  const tools = catalog(); tools.find(t => t.name === 'org_identity').inputSchema.additionalProperties = true;
  assert.throws(() => checkCatalog(tools, BASELINE));
});
test('only protocol/tool errors are denials', () => {
  assert.ok(isRejected({ error: { code: -32602 } }));
  assert.ok(isRejected({ result: { isError: true } }));
  assert.ok(!isRejected({ result: { content: [{ text: 'permission denied' }] } }));
  assert.ok(!isRejected({ result: {} }));
});
test('identity is parsed from structured or text results but never errors', () => {
  const id = { organization: 'org', repository: 'org/repo' };
  assert.deepEqual(readIdentity({ result: { structuredContent: id } }), id);
  assert.deepEqual(readIdentity({ result: { content: [{ type: 'text', text: JSON.stringify(id) }] } }), id);
  assert.throws(() => readIdentity({ result: { isError: true, structuredContent: id } }));
});

import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { probe } from '../scripts/access-boundary.mjs';
async function mockServer(mode, run) {
  const root = await mkdtemp(join(tmpdir(), 'mcp-probe-fixture-'));
  const binary = join(root, 'server');
  const source = `#!/usr/bin/env node
const readline = require('node:readline');
const tools = ${JSON.stringify(catalog())};
const mode = ${JSON.stringify(mode)};
const id = {organization:'org',repository:'org/app-mcp-server.rs',service:'mañana'};
readline.createInterface({input:process.stdin}).on('line',line=>{
 const q = JSON.parse(line); if(!Object.hasOwn(q,'id')) return;
 let result, error;
 if(q.method==='initialize') result={protocolVersion:'2025-03-26',capabilities:{tools:{}}};
 else if(q.method==='tools/list') result={tools:mode==='extra'?[...tools,{name:'admin_write'}]:tools};
 else if(q.params.name!=='org_identity') error={code:-32601,message:'unknown'};
 else if(Object.keys(q.params.arguments).length && mode!=='spoof') error={code:-32602,message:'closed arguments'};
 else result={content:[{type:'text',text:JSON.stringify(id)}]};
 const frame=Buffer.from(JSON.stringify({jsonrpc:'2.0',id:q.id,...(error?{error}:{result})})+'\\n');
 const split=frame.indexOf(Buffer.from('ñ'))+1;
 process.stdout.write(frame.subarray(0,split));process.stdout.write(frame.subarray(split));
});
`;
  await writeFile(binary, source, { mode: 0o700 });
  try { await run(binary); } finally { await rm(root, { recursive: true, force: true }); }
}
test('real child-process session validates catalog, denials, UTF-8 framing and EOF', async () => {
  await mockServer('valid', async binary => {
    const result = await probe(binary, BASELINE, 'org', 'org/app-mcp-server.rs');
    assert.equal(result.tools, 6);
    assert.equal(result.authorizationCertified, false);
    assert.equal(result.checks.length, 9);
  });
});
test('real child-process probe rejects undeclared admin exposure', async () => {
  await mockServer('extra', async binary => {
    await assert.rejects(probe(binary, BASELINE, 'org', 'org/app-mcp-server.rs'));
  });
});
test('real child-process probe rejects silently accepted role spoofing', async () => {
  await mockServer('spoof', async binary => {
    await assert.rejects(probe(binary, BASELINE, 'org', 'org/app-mcp-server.rs'));
  });
});
