import assert from 'node:assert/strict';
import { TOOL_MODELS } from './mcp-wire.mjs';

export function contractProfile(name) {
  assert(['stdio-v1', 'fleet-v2'].includes(name), 'unknown contract profile');
  return name === 'stdio-v1'
    ? { models: TOOL_MODELS, protocolVersion: '2025-03-26' }
    : { models: { ...TOOL_MODELS, org_identity: 'OrgIdentityV2', security_baseline: 'SecurityBaselineV2' }, protocolVersion: '2025-11-25' };
}
