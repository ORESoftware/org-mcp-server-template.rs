import assert from 'node:assert/strict';
import test from 'node:test';
import { assertFrame, assertIdentity, assertRejected, CANARY, decodeResult, RpcProcess, testEnvironment } from './mcp-wire.mjs';

const frame = (value) => ({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: JSON.stringify(value) }] } });

test('JSON-RPC response requires one result or error and an id', () => {
  assertFrame(frame({ ok: true }));
  for (const bad of [null, [], {}, { jsonrpc: '2.0', id: 1 }, { ...frame({}), error: {} }, { jsonrpc: '2.0', method: 'log' }]) {
    assert.throws(() => assertFrame(bad));
  }
});
test('decode JSON text and require structured-content parity', () => {
  assert.deepEqual(decodeResult(frame({ safe: true })), { safe: true });
  const both = frame({ safe: true });
  both.result.structuredContent = { safe: false };
  assert.throws(() => decodeResult(both));
});
test('reject oversized, malformed, and error results', () => {
  assert.throws(() => decodeResult(frame('x'.repeat(65537))));
  const bad = frame({});
  bad.result.content[0].text = 'not JSON';
  assert.throws(() => decodeResult(bad));
  const error = frame({});
  error.result.isError = true;
  assert.throws(() => decodeResult(error));
});
test('accept protocol or tool-level rejection, never successful invalid calls', () => {
  assertRejected({ jsonrpc: '2.0', id: 1, error: { code: -32602, message: 'invalid arguments' } });
  assertRejected({ jsonrpc: '2.0', id: 1, result: { isError: true } });
  assert.throws(() => assertRejected(frame({})));
  assert.throws(() => assertRejected({ jsonrpc: '2.0', id: 1, error: { code: -32602, message: CANARY } }));
});
test('identity binds both repository and organization', () => {
  assertIdentity({ repository: 'example/server', organization: 'example' }, 'example/server');
  assert.throws(() => assertIdentity({ repository: 'example/server', organization: 'other' }, 'example/server'));
  assert.throws(() => assertIdentity({ repository: 'example/other', organization: 'example' }, 'example/server'));
});
test('test process never inherits credentials, auth, or collector configuration', () => {
  assert.deepEqual(testEnvironment({ PATH: '/bin', GH_TOKEN: 'do-not-copy', SHARED_AUTH_BASE_URL: 'private', OTEL_EXPORTER_OTLP_ENDPOINT: 'private', HOME: '/private' }), { OTEL_SDK_DISABLED: 'true', PATH: '/bin' });
});
test('real subprocess supports request correlation and clean shutdown', async () => {
  const rpc = new RpcProcess(process.execPath, { args: ['-e', `const r=require('node:readline').createInterface({input:process.stdin});r.on('line',l=>{const q=JSON.parse(l);console.log(JSON.stringify({jsonrpc:'2.0',id:q.id,result:{ok:true}}))});`], timeoutMs: 1000 });
  try {
    assert.deepEqual((await rpc.request('ping')).result, { ok: true });
    await rpc.finish();
  } finally { await rpc.stop(); }
});
test('non-JSON stdout is rejected and process is reaped', async () => {
  const rpc = new RpcProcess(process.execPath, { args: ['-e', `process.stdin.on('data',()=>console.log('debug text'))`], timeoutMs: 1000 });
  try { await assert.rejects(rpc.request('ping')); } finally { await rpc.stop(); }
});
test('silent subprocess cannot hang the gate', async () => {
  const rpc = new RpcProcess(process.execPath, { args: ['-e', `process.stdin.resume()`], timeoutMs: 100 });
  try { await assert.rejects(rpc.request('ping'), /deadline exceeded/u); } finally { await rpc.stop(); }
});
test('malformed stderr is rejected', async () => {
  const rpc = new RpcProcess(process.execPath, { args: ['-e', `process.stdin.on('data',()=>console.error('not structured'))`], timeoutMs: 1000 });
  try { await assert.rejects(rpc.request('ping')); } finally { await rpc.stop(); }
});

const { contractProfile } = await import('./mcp-profiles.mjs');
test('profiles do not downgrade newer fleet identity or security', () => {
  assert.equal(contractProfile('stdio-v1').models.org_identity, 'OrgIdentity');
  assert.equal(contractProfile('fleet-v2').models.org_identity, 'OrgIdentityV2');
  assert.equal(contractProfile('fleet-v2').models.security_baseline, 'SecurityBaselineV2');
  assert.equal(contractProfile('fleet-v2').protocolVersion, '2025-11-25');
  assert.throws(() => contractProfile('__proto__'));
  assert.throws(() => contractProfile(undefined));
});
