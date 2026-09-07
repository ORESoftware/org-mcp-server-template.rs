import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RpcProcess, decodeResult, assertFrame, assertRejected } from './mcp-wire.mjs';
import { wireJsonPolicy, sharedMcpRevision } from './mcp-shared-json.mjs';

const frame = (text) => ({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text }] } });
const redacted = (e) => !e.message.includes('SECRET_SENTINEL');
test('template imports the pinned shared wire policy', () => {
  assert.equal(wireJsonPolicy, 'ores.mcp-strict-json/v1');
  assert.equal(sharedMcpRevision, '487df19ec2542616924041bc244c5660c1ed0bf4');
});
for (const raw of ['{"x":"SECRET_SENTINEL","x":1}', '{"x":1,"\\u0078":2}',
  '1e999', '['.repeat(65)+'0'+']'.repeat(65), '"\\ud800"']) {
  test('template JSON-text decoder rejects ambiguity ' + raw.slice(0,20), () => {
    assert.throws(() => decodeResult(frame(raw)), redacted);
  });
}
test('valid prototype-shaped output remains literal data', () => {
  const value = decodeResult(frame('{"__proto__":{"x":1},"required":["b","a"]}'));
  assert.ok(Object.hasOwn(value, '__proto__')); assert.equal({}.x, undefined);
  assert.deepEqual(value.required, ['b','a']);
});
test('internal failures cannot count as invalid-argument coverage', () => {
  assert.throws(() => assertRejected({ jsonrpc: '2.0', id:1, error:{ code:-32603, message:'internal' } }));
  assertRejected({ jsonrpc: '2.0', id:1, error:{ code:-32602, message:'invalid' } });
});
test('responses containing a method are rejected', () => {
  assert.throws(() => assertFrame({ jsonrpc:'2.0', id:1, result:{}, method:'not-a-response' }));
});
for (const [label, raw] of [
  ['duplicate id', Buffer.from('{"jsonrpc":"2.0","id":99,"id":1,"result":{}}\n')],
  ['invalid UTF8', Buffer.concat([Buffer.from('{"jsonrpc":"2.0","id":1,"result":"'),Buffer.from([255]),Buffer.from('"}\n')])],
  ['blank stdout', Buffer.from('\n{"jsonrpc":"2.0","id":1,"result":{}}\n')],
  ['duplicate nested member', Buffer.from('{"jsonrpc":"2.0","id":1,"result":{"x":1,"x":2}}\n')],
]) test('actual template RpcProcess rejects ' + label, async () => {
  const rpc = new RpcProcess(process.execPath, { timeoutMs:2000, args:['-e',
    `process.stdin.once('data',()=>process.stdout.write(Buffer.from('${raw.toString('base64')}','base64')));`] });
  try { await assert.rejects(rpc.request('initialize'), redacted); }
  finally { await rpc.stop(); }
});
test('shared loader refuses missing configuration rather than falling back to JSON.parse', () => {
  const result = spawnSync(process.execPath, ['--input-type=module','-e',`await import(${JSON.stringify(new URL('./mcp-shared-json.mjs', import.meta.url).href)})`],
    { env:{}, encoding:'utf8', timeout:2000 });
  assert.equal(result.status,1); assert.match(result.stderr,/pinned checkout is required/);
});
test('shared loader rejects changed module bytes before executing them', async (t) => {
  const root=await mkdtemp(join(tmpdir(),'mcp-pinned-json-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'tooling/org-mcp-contract'),{recursive:true});
  await writeFile(join(root,'tooling/org-mcp-contract/json.mjs'), 'throw new Error("SECRET_SENTINEL");');
  const result=spawnSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(new URL('./mcp-shared-json.mjs', import.meta.url).href)})`],
    {env:{MCP_SHARED_TOOLS_ROOT:root},encoding:'utf8',timeout:2000});
  assert.equal(result.status,1);assert.match(result.stderr,/digest mismatch/);assert.ok(!result.stderr.includes('SECRET_SENTINEL'));
});
