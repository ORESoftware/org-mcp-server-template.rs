import assert from 'node:assert/strict';

// Bounded conformance policy, not application authorization or a second CLI.
export const SESSION_POLICY = 'ores.mcp-session-admission/v1';
export const CATALOG_LIMITS = Object.freeze({ pages: 16, tools: 256, cursorBytes: 1024 });

function object(value, label) {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function text(value, label, maxBytes) {
  assert(typeof value === 'string' && value.length > 0, `${label} must be nonempty text`);
  assert(Buffer.byteLength(value) <= maxBytes && !/[\u0000-\u001f\u007f]/u.test(value), `${label} is unbounded or contains controls`);
}

export function admitInitialization(frame, expectedVersion) {
  assert(['2025-03-26', '2025-11-25'].includes(expectedVersion), 'unsupported conformance profile version');
  object(frame, 'initialize response');
  assert.equal(frame.jsonrpc, '2.0', 'initialize response must use JSON-RPC 2.0');
  assert(Object.hasOwn(frame, 'result') && !Object.hasOwn(frame, 'error'), 'initialization failed');
  const result = frame.result;
  object(result, 'initialize result');
  assert.equal(result.protocolVersion, expectedVersion, 'negotiated protocol differs from the explicit profile');
  object(result.capabilities, 'capabilities');
  object(result.capabilities.tools, 'tools capability');
  if (Object.hasOwn(result.capabilities.tools, 'listChanged')) {
    assert.equal(typeof result.capabilities.tools.listChanged, 'boolean', 'listChanged must be boolean');
  }
  object(result.serverInfo, 'serverInfo');
  text(result.serverInfo.name, 'serverInfo.name', 256);
  text(result.serverInfo.version, 'serverInfo.version', 256);
  return Object.freeze({ protocolVersion: result.protocolVersion, name: result.serverInfo.name, version: result.serverInfo.version });
}

export function bindSessionIdentity(session, identity) {
  object(identity, 'organization identity');
  assert.equal(identity.service, session.name, 'handshake and tool service identities disagree');
  assert.equal(identity.version, session.version, 'handshake and tool versions disagree');
  if (Object.hasOwn(identity, 'protocol')) {
    assert.equal(identity.protocol, session.protocolVersion, 'handshake and tool protocol versions disagree');
  }
}

export function assertReadOnlyAnnotations(tool) {
  object(tool.annotations, 'inherited tool annotations');
  for (const [key, expected] of Object.entries({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false })) {
    assert.equal(tool.annotations[key], expected, `inherited tool ${key} drifted`);
  }
}

export function admitToolResult(result) {
  object(result, 'tool result');
  if (Object.hasOwn(result, 'isError')) {
    assert.equal(typeof result.isError, 'boolean', 'tool isError must be boolean');
    assert.equal(result.isError, false, 'valid tool call returned an execution error');
  }
}

export async function collectToolCatalog(request) {
  assert.equal(typeof request, 'function', 'request function is required');
  const tools = new Map();
  const cursors = new Set();
  let params = {};
  for (let page = 1; page <= CATALOG_LIMITS.pages; page++) {
    const frame = await request('tools/list', params);
    object(frame, 'catalog response');
    assert.equal(frame.jsonrpc, '2.0', 'catalog response must use JSON-RPC 2.0');
    assert(Object.hasOwn(frame, 'result') && !Object.hasOwn(frame, 'error'), 'catalog request failed');
    object(frame.result, 'catalog result');
    assert(Array.isArray(frame.result.tools), 'tool catalog missing');
    assert(tools.size + frame.result.tools.length <= CATALOG_LIMITS.tools, 'catalog tool count exceeds policy');
    for (const tool of frame.result.tools) {
      object(tool, 'tool descriptor');
      text(tool.name, 'tool name', 128);
      object(tool.inputSchema, 'tool input schema');
      assert(!tools.has(tool.name), 'duplicate tool name across catalog pages');
      tools.set(tool.name, tool);
    }
    if (!Object.hasOwn(frame.result, 'nextCursor')) return { tools, pages: page };
    const cursor = frame.result.nextCursor;
    assert(typeof cursor === 'string' && Buffer.byteLength(cursor) <= CATALOG_LIMITS.cursorBytes, 'catalog cursor is invalid or unbounded');
    assert(!cursors.has(cursor), 'catalog cursor cycle');
    cursors.add(cursor);
    // Cursor content is opaque: forward it exactly, never interpret or log it.
    params = { cursor };
  }
  assert.fail('catalog page count exceeds policy');
}
