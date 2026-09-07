import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { TextDecoder } from 'node:util';

export const TOOL_MODELS = Object.freeze({
  org_identity: 'OrgIdentity',
  zed_dependency_graph: 'ZedDependencyGraph',
  telemetry_status: 'TelemetryStatus',
  shared_auth_policy: 'SharedAuthPolicy',
  environment_policy: 'EnvironmentPolicy',
  security_baseline: 'SecurityBaseline',
});
export const CANARY = 'MCP_CONTRACT_CANARY_NOT_A_SECRET';
const MAX_CAPTURE = 2 * 1024 * 1024;
const MAX_LINE = 1024 * 1024;
const decoder = new TextDecoder('utf-8', { fatal: true });

export function assertFrame(frame) {
  assert(frame && !Array.isArray(frame) && typeof frame === 'object', 'JSON-RPC object required');
  assert.equal(frame.jsonrpc, '2.0', 'stdout must contain JSON-RPC only');
  assert(Object.hasOwn(frame, 'id'), 'unexpected server notification');
  assert.notEqual(Object.hasOwn(frame, 'result'), Object.hasOwn(frame, 'error'), 'exactly one result or error required');
  if (Object.hasOwn(frame, 'error')) {
    assert(Number.isInteger(frame.error?.code), 'error code required');
    assert.equal(typeof frame.error?.message, 'string', 'error message required');
  }
  return frame;
}

export function decodeResult(frame) {
  assertFrame(frame);
  assert(!Object.hasOwn(frame, 'error'), 'valid tool call returned a protocol error');
  const result = frame.result;
  assert(result && result.isError !== true, 'valid tool call returned an execution error');
  assert.equal(result.content?.length, 1, 'one JSON text block required');
  assert.equal(result.content[0].type, 'text');
  assert.equal(typeof result.content[0].text, 'string');
  assert(Buffer.byteLength(result.content[0].text) <= 65536, 'tool output exceeds 64 KiB');
  assert(!result.content[0].text.includes(CANARY), 'input canary was disclosed');
  const value = JSON.parse(result.content[0].text);
  if (Object.hasOwn(result, 'structuredContent')) {
    assert.deepEqual(result.structuredContent, value, 'text/structured output disagreement');
  }
  return value;
}

export function assertRejected(frame) {
  assertFrame(frame);
  assert(Object.hasOwn(frame, 'error') || frame.result?.isError === true, 'invalid call was accepted');
  assert(!JSON.stringify(frame).includes(CANARY), 'rejection disclosed input canary');
}

export function assertIdentity(value, expectedRepository) {
  assert.match(expectedRepository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u);
  assert.equal(value.repository, expectedRepository, 'cross-repository identity');
  assert.equal(value.organization, expectedRepository.split('/')[0], 'cross-organization identity');
}

// Never inherit developer/CI credentials or collector endpoints into test servers.
export function testEnvironment(source = process.env) {
  const result = { OTEL_SDK_DISABLED: 'true' };
  for (const key of ['PATH', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TMPDIR', 'TEMP', 'TMP']) {
    if (source[key]) result[key] = source[key];
  }
  return result;
}

export class RpcProcess {
  constructor(binary, { args = [], env = testEnvironment(), timeoutMs = 10000 } = {}) {
    this.timeoutMs = timeoutMs;
    this.pending = new Map();
    this.nextId = 1;
    this.buffers = { stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
    this.bytes = { stdout: 0, stderr: 0 };
    this.failure = null;
    this.closed = false;
    this.child = spawn(binary, args, { env, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    this.closePromise = new Promise((resolve) => {
      this.child.once('close', (code, signal) => {
        this.closed = true;
        this.exit = { code, signal };
        if (this.buffers.stdout.length || this.buffers.stderr.length) this.fail(new Error('unterminated output frame'));
        if (this.pending.size) this.fail(new Error('server exited before answering'));
        resolve(this.exit);
      });
    });
    this.child.on('error', (error) => this.fail(error));
    this.child.stdin.on('error', (error) => this.fail(error));
    for (const channel of ['stdout', 'stderr']) {
      this.child[channel].on('data', (data) => {
        try { this.consume(channel, data); } catch (error) { this.fail(error); }
      });
    }
  }
  fail(error) {
    this.failure ??= error;
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(this.failure);
    }
    this.pending.clear();
    if (!this.closed) this.child.kill('SIGKILL');
  }
  consume(channel, data) {
    this.bytes[channel] += data.length;
    assert(this.bytes[channel] <= MAX_CAPTURE, `${channel} capture bound exceeded`);
    this.buffers[channel] = Buffer.concat([this.buffers[channel], data]);
    let offset;
    while ((offset = this.buffers[channel].indexOf(10)) !== -1) {
      assert(offset <= MAX_LINE, `${channel} line bound exceeded`);
      const line = decoder.decode(this.buffers[channel].subarray(0, offset));
      this.buffers[channel] = this.buffers[channel].subarray(offset + 1);
      if (!line.trim()) continue;
      assert(!line.includes(CANARY), `${channel} disclosed input canary`);
      const value = JSON.parse(line);
      if (channel === 'stderr') {
        assert(value && typeof value === 'object' && !Array.isArray(value), 'stderr logs must be JSON objects');
        continue;
      }
      assertFrame(value);
      const pending = this.pending.get(value.id);
      assert(pending, 'unsolicited or duplicate response');
      clearTimeout(pending.timer);
      this.pending.delete(value.id);
      pending.resolve(value);
    }
    assert(this.buffers[channel].length <= MAX_LINE, `${channel} line bound exceeded`);
  }
  request(method, params = {}) {
    if (this.failure) return Promise.reject(this.failure);
    if (this.closed) return Promise.reject(new Error('server already exited'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error(`deadline exceeded for ${method}`)), this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }
  notify(method) {
    if (this.failure) throw this.failure;
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method })}\n`);
  }
  async finish() {
    this.child.stdin.end();
    const timer = setTimeout(() => this.fail(new Error('shutdown deadline exceeded')), this.timeoutMs);
    try {
      const exit = await this.closePromise;
      if (this.failure) throw this.failure;
      assert.equal(exit.code, 0, 'server exited unsuccessfully');
    } finally { clearTimeout(timer); }
  }
  async stop() {
    if (!this.closed) this.child.kill('SIGKILL');
    await this.closePromise;
  }
}

export async function exerciseServer({ binary, expectedRepository, validate, validateInputSchema, processOptions, models = TOOL_MODELS, protocolVersion = '2025-03-26' }) {
  const rpc = new RpcProcess(binary, processOptions);
  let calls = 0;
  try {
    // Reject an oversized frame and recover at the next newline before initialization.
    rpc.child.stdin.write(`${' '.repeat(MAX_LINE + 1)}\n`);
    const initialized = await rpc.request('initialize', {
      protocolVersion, capabilities: {},
      clientInfo: { name: 'peer-contract-conformance', version: '1.0.0' },
    });
    assert(initialized.result?.capabilities?.tools, 'tools capability missing');
    rpc.notify('notifications/initialized');
    const listed = await rpc.request('tools/list');
    assert(Array.isArray(listed.result?.tools), 'tool catalog missing');
    const tools = new Map(listed.result.tools.map((tool) => [tool.name, tool]));
    assert.equal(tools.size, listed.result.tools.length, 'duplicate tool names');
    for (const [name, model] of Object.entries(models)) {
      const tool = tools.get(name);
      assert(tool, `missing inherited tool ${name}`);
      validateInputSchema(tool.inputSchema);
      validate('NoArguments', {});
      const value = decodeResult(await rpc.request('tools/call', { name, arguments: {} }));
      validate(model, value);
      if (name === 'org_identity' || name === 'zed_dependency_graph') assertIdentity(value, expectedRepository);
      if (name === 'zed_dependency_graph') assert.equal(new Set(value.dependencies).size, value.dependencies.length);
      if (name === 'shared_auth_policy') {
        assert.equal(value.configured, false, 'test child inherited auth configuration');
        assert.deepEqual(value.outcomes, ['anonymous', 'unauthenticated', 'degraded', 'authenticated']);
      }
      for (const args of [{ unexpected: CANARY }, [], 'invalid']) {
        assertRejected(await rpc.request('tools/call', { name, arguments: args }));
        calls++;
      }
      calls++;
    }
    assertRejected(await rpc.request('tools/call', { name: '__unknown_contract_tool__', arguments: {} }));
    calls++;
    await rpc.finish();
    return { tools: Object.keys(models).length, calls, stdoutBytes: rpc.bytes.stdout, stderrBytes: rpc.bytes.stderr };
  } finally { await rpc.stop(); }
}
