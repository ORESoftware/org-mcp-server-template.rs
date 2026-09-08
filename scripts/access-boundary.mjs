import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const BASELINE = ['environment_policy', 'org_identity', 'security_baseline', 'shared_auth_policy', 'telemetry_status', 'zed_dependency_graph'];
export function expectedTools(value) {
  const tools = value ? JSON.parse(value) : BASELINE;
  assert.ok(Array.isArray(tools) && tools.length > 0 && tools.length <= 500, 'Declare the complete tool catalog');
  assert.ok(tools.every(t => typeof t === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(t)), 'Invalid tool name');
  assert.equal(new Set(tools).size, tools.length, 'Duplicate expected tool');
  assert.ok(tools.includes('org_identity'), 'Identity tool is required by this profile');
  return [...tools].sort();
}
export function checkCatalog(tools, expected) {
  assert.ok(Array.isArray(tools), 'Missing tools list');
  assert.deepEqual(tools.map(t => t.name).sort(), expected, 'Catalog drift requires review; never flatten domain tools');
  const identity = tools.find(t => t.name === 'org_identity');
  assert.equal(identity.inputSchema?.type, 'object');
  assert.equal(identity.inputSchema?.additionalProperties, false, 'Identity schema must reject forged role/tenant input');
}
export function isRejected(frame) {
  return (frame.error && typeof frame.error.code === 'number') || frame.result?.isError === true;
}
export function readIdentity(frame) {
  assert.ok(!frame.error && frame.result && frame.result.isError !== true, 'Identity call failed');
  if (frame.result.structuredContent?.organization) return frame.result.structuredContent;
  const text = frame.result.content?.find(c => c.type === 'text')?.text;
  assert.equal(typeof text, 'string', 'Missing identity result');
  return JSON.parse(text);
}

export async function probe(binary, expected, organization, repository) {
  assert.ok(organization && repository, 'Expected immutable organization and repository required');
  const home = await mkdtemp(resolve(tmpdir(), 'mcp-access-'));
  const child = spawn(resolve(binary), [], {
    shell: false,
    env: { PATH: process.env.PATH ?? '', HOME: home, TMPDIR: home, RUST_LOG: 'warn' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let nextId = 0, stdout = '', bytes = 0, stderrBytes = 0, fatal = null, exited = false;
  const pending = new Map();
  const decoder = new StringDecoder('utf8');
  const fail = error => {
    fatal ??= error;
    for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(error); }
    pending.clear();
  };
  child.on('error', fail);
  child.stdin.on('error', fail);
  const closed = new Promise(done => child.on('close', (code, signal) => {
    exited = true;
    if (pending.size || code !== 0) fail(new Error(`Server exited before successful completion (${code ?? signal})`));
    done();
  }));
  child.stderr.on('data', chunk => {
    stderrBytes += chunk.length;
    if (stderrBytes > 1048576) { fail(new Error('Unbounded stderr')); child.kill('SIGKILL'); }
  });
  child.stdout.on('data', chunk => {
    bytes += chunk.length;
    if (bytes > 2097152) { fail(new Error('Unbounded protocol stdout')); child.kill('SIGKILL'); return; }
    stdout += decoder.write(chunk);
    for (;;) {
      const end = stdout.indexOf('\n');
      if (end < 0) break;
      const line = stdout.slice(0, end); stdout = stdout.slice(end + 1);
      try {
        assert.ok(line.trim(), 'Blank/non-protocol stdout');
        const frame = JSON.parse(line);
        assert.equal(frame.jsonrpc, '2.0', 'Non-MCP stdout');
        if (!Object.hasOwn(frame, 'id')) { assert.equal(typeof frame.method, 'string'); continue; }
        assert.ok(pending.has(frame.id), 'Unexpected or duplicate response ID');
        assert.notEqual(Object.hasOwn(frame, 'result'), Object.hasOwn(frame, 'error'), 'Response needs exactly one outcome');
        const p = pending.get(frame.id); pending.delete(frame.id); clearTimeout(p.timer); p.resolve(frame);
      } catch (e) { fail(e); child.kill('SIGKILL'); }
    }
  });
  const send = message => child.stdin.write(JSON.stringify(message) + '\n');
  const request = (method, params = {}) => new Promise((resolveRequest, reject) => {
    if (fatal || exited) { reject(fatal ?? new Error('Server already exited')); return; }
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`MCP request timed out: ${method}`)); }, 10000);
    pending.set(id, { resolve: resolveRequest, reject, timer });
    send({ jsonrpc: '2.0', id, method, params });
  });
  try {
    const init = await request('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'access-boundary-test', version: '1.0.0' } });
    assert.ok(init.result?.capabilities?.tools && !init.error, 'Initialization must advertise tools');
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    const tools = [], cursors = new Set();
    let cursor;
    do {
      const page = await request('tools/list', cursor ? { cursor } : {});
      assert.ok(!page.error && Array.isArray(page.result?.tools), 'Tool discovery failed');
      tools.push(...page.result.tools);
      cursor = page.result.nextCursor;
      if (cursor !== undefined) {
        assert.ok(typeof cursor === 'string' && cursor.length > 0 && !cursors.has(cursor) && cursors.size < 10, 'Invalid/repeated pagination cursor');
        cursors.add(cursor);
      }
    } while (cursor !== undefined);
    checkCatalog(tools, expected);
    const identity = readIdentity(await request('tools/call', { name: 'org_identity', arguments: {} }));
    assert.equal(identity.organization, organization);
    assert.equal(identity.repository, repository);
    for (const arguments_ of [{ role: 'admin' }, { is_admin: true }, { tenant_id: 'another-tenant' }]) {
      assert.ok(isRejected(await request('tools/call', { name: 'org_identity', arguments: arguments_ })), 'Forged privilege input must fail closed');
    }
    const unknown = '__access_probe_unregistered_admin_action__';
    assert.ok(!expected.includes(unknown));
    assert.ok(isRejected(await request('tools/call', { name: unknown, arguments: {} })), 'Unregistered admin action accepted');
    const after = readIdentity(await request('tools/call', { name: 'org_identity', arguments: {} }));
    assert.deepEqual(after, identity, 'Failed spoofing must not change identity');
    child.stdin.end();
    await Promise.race([closed, new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error('Server did not exit after EOF')), 3000); timer.unref();
    })]);
    assert.ok(!fatal, fatal?.message);
    assert.equal(stdout.trim(), '', 'Unterminated protocol output');
    return { organization, repository, tools: tools.length, checks: ['initialize', 'exact_catalog', 'identity', 'forged_role_denied', 'forged_admin_denied', 'forged_tenant_denied', 'unknown_admin_action_denied', 'identity_unchanged', 'clean_eof'], authorizationCertified: false };
  } finally {
    for (const p of pending.values()) clearTimeout(p.timer);
    pending.clear();
    if (!exited) { child.kill('SIGKILL'); await closed; }
    await rm(home, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  probe(process.env.MCP_BINARY ?? 'target/debug/org-mcp-server', expectedTools(process.env.MCP_EXPECT_TOOLS), process.env.MCP_EXPECT_ORGANIZATION ?? 'ORESoftware', process.env.MCP_EXPECT_REPOSITORY ?? 'ORESoftware/org-mcp-server-template.rs')
    .then(result => console.log(JSON.stringify(result)))
    .catch(() => { console.error('MCP access probe failed: protocol/catalog/identity/denial invariant; provider output suppressed'); process.exitCode = 1; });
}
