import assert from 'node:assert/strict';
import test from 'node:test';
import { admitInitialization, admitToolResult, assertReadOnlyAnnotations, bindSessionIdentity, CATALOG_LIMITS, collectToolCatalog } from './mcp-wire-session.mjs';

const reply = (result) => ({ jsonrpc: '2.0', id: 1, result });
const initialized = () => reply({ protocolVersion: '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'example-mcp', version: '1.0.0' } });
const tool = (name) => ({ name, inputSchema: { type: 'object', properties: {}, additionalProperties: false } });
const annotations = () => ({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });

test('initialization admits the exact profile and returns immutable identity', () => {
  const session = admitInitialization(initialized(), '2025-11-25');
  assert(Object.isFrozen(session));
  assert.equal(session.name, 'example-mcp');
  const legacy = initialized();
  legacy.result.protocolVersion = '2025-03-26';
  assert.equal(admitInitialization(legacy, '2025-03-26').protocolVersion, '2025-03-26');
});
for (const version of [undefined, null, '', '2024-11-05', '2025-03-26', 20251125]) {
  test(`refuse incompatible negotiated version ${String(version)}`, () => {
    const frame = initialized();
    frame.result.protocolVersion = version;
    assert.throws(() => admitInitialization(frame, '2025-11-25'));
  });
}
for (const capabilities of [undefined, null, [], true, {}, { tools: true }, { tools: [] }, { tools: null }, { tools: { listChanged: 'false' } }]) {
  test(`refuse malformed capability ${JSON.stringify(capabilities)}`, () => {
    const frame = initialized();
    frame.result.capabilities = capabilities;
    assert.throws(() => admitInitialization(frame, '2025-11-25'));
  });
}
for (const name of ['', 5, 'bad\nname', 'x'.repeat(257)]) {
  test(`refuse invalid handshake identity ${JSON.stringify(name).slice(0, 40)}`, () => {
    const frame = initialized();
    frame.result.serverInfo.name = name;
    assert.throws(() => admitInitialization(frame, '2025-11-25'));
  });
}
test('refuse error/result ambiguity and unsupported test policy', () => {
  assert.throws(() => admitInitialization({ ...initialized(), error: { code: -32602 } }, '2025-11-25'));
  assert.throws(() => admitInitialization(initialized(), 'next'));
});
test('handshake binds service/version/protocol to the real tool identity', () => {
  const session = admitInitialization(initialized(), '2025-11-25');
  const identity = { service: 'example-mcp', version: '1.0.0', protocol: '2025-11-25' };
  bindSessionIdentity(session, identity);
  for (const key of Object.keys(identity)) assert.throws(() => bindSessionIdentity(session, { ...identity, [key]: 'other' }));
});
test('inherited annotations remain closed-world, read-only and idempotent', () => {
  assertReadOnlyAnnotations({ annotations: annotations() });
  for (const [key, value] of Object.entries(annotations())) {
    for (const replacement of [!value, String(value), undefined]) assert.throws(() => assertReadOnlyAnnotations({ annotations: { ...annotations(), [key]: replacement } }));
  }
});
test('malformed tool error flags cannot masquerade as success', () => {
  admitToolResult({});
  admitToolResult({ isError: false });
  for (const result of [null, [], true, { isError: 'false' }, { isError: 0 }, { isError: null }, { isError: true }]) assert.throws(() => admitToolResult(result));
});
test('catalog follows every page and preserves an opaque cursor exactly', async () => {
  const calls = [];
  const cursor = 'opaque token +/=\u2603';
  const catalog = await collectToolCatalog(async (method, params) => {
    calls.push({ method, params });
    return calls.length === 1 ? reply({ tools: [tool('first')], nextCursor: cursor }) : reply({ tools: [tool('second')] });
  });
  assert.deepEqual([...catalog.tools.keys()], ['first', 'second']);
  assert.equal(catalog.pages, 2);
  assert.deepEqual(calls, [{ method: 'tools/list', params: {} }, { method: 'tools/list', params: { cursor } }]);
});
test('empty opaque cursor is not confused with absent cursor', async () => {
  let calls = 0;
  const catalog = await collectToolCatalog(async (_method, params) => {
    if (++calls === 1) return reply({ tools: [], nextCursor: '' });
    assert.deepEqual(params, { cursor: '' });
    return reply({ tools: [tool('last')] });
  });
  assert.equal(catalog.pages, 2);
});
test('duplicate names across pages fail rather than overwrite descriptors', async () => {
  let count = 0;
  await assert.rejects(collectToolCatalog(async () => reply({ tools: [tool('same')], ...(++count === 1 ? { nextCursor: 'next' } : {}) })), /duplicate tool/u);
});
test('catalog cycles and endless unique cursors terminate at fixed bounds', async () => {
  await assert.rejects(collectToolCatalog(async () => reply({ tools: [], nextCursor: 'same' })), /cursor cycle/u);
  let count = 0;
  await assert.rejects(collectToolCatalog(async () => reply({ tools: [], nextCursor: String(++count) })), /page count/u);
  assert.equal(count, CATALOG_LIMITS.pages);
});
test('catalog enforces a cumulative count across pages', async () => {
  let count = 0;
  await assert.rejects(collectToolCatalog(async () => reply({ tools: Array.from({ length: 129 }, (_, i) => tool(`${count}-${i}`)), nextCursor: String(++count) })), /tool count/u);
  assert.equal(count, 2);
});
for (const result of [null, [], {}, { tools: null }, { tools: [null] }, { tools: [tool('')] }, { tools: [tool('bad\nname')] }, { tools: [{ name: 'no-schema' }] }, { tools: [], nextCursor: null }, { tools: [], nextCursor: 1 }, { tools: [], nextCursor: '\u2603'.repeat(342) }]) {
  test(`refuse malformed catalog ${JSON.stringify(result).slice(0, 65)}`, async () => {
    await assert.rejects(collectToolCatalog(async () => reply(result)));
  });
}
test('later-page errors and transport rejection cannot yield partial success', async () => {
  let count = 0;
  await assert.rejects(collectToolCatalog(async () => ++count === 1 ? reply({ tools: [tool('first')], nextCursor: 'next' }) : { jsonrpc: '2.0', id: 2, error: { code: -32603 } }));
  await assert.rejects(collectToolCatalog(async () => { throw new Error('deadline'); }), /deadline/u);
});
