import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

export const sharedMcpRevision = '487df19ec2542616924041bc244c5660c1ed0bf4';
export const sharedJsonSha256 = 'e9722ce0428593f1d8829a907bac2b94cfca46d52c8cf923538b4e98d10929ce';
const root = process.env.MCP_SHARED_TOOLS_ROOT;
if (!root || !isAbsolute(root)) throw new Error('MCP shared JSON: pinned checkout is required');
let bytes;
try { bytes = await readFile(join(root, 'tooling/org-mcp-contract/json.mjs')); }
catch { throw new Error('MCP shared JSON: pinned module is unavailable'); }
if (createHash('sha256').update(bytes).digest('hex') !== sharedJsonSha256) {
  throw new Error('MCP shared JSON: pinned module digest mismatch');
}
// Import the exact verified bytes; do not reopen a mutable path after checking it.
// This reviewed module has only node: built-in imports, no relative dependencies.
const api = await import(`data:text/javascript;base64,${bytes.toString('base64')}`);
if (api.STRICT_JSON_POLICY !== 'ores.mcp-strict-json/v1' || typeof api.parseStrictJson !== 'function') {
  throw new Error('MCP shared JSON: unsupported policy');
}
export const parseStrictJson = api.parseStrictJson;
export const wireJsonPolicy = api.STRICT_JSON_POLICY;
