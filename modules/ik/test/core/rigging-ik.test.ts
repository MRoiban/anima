import '@anima-format/core/all';
import { describe, expect, it } from 'vitest';
import { load } from '@anima-format/core';

const document = (nodes: object[]) => ({
  anima: '0.1',
  name: 'ik-invalid',
  grid: 20,
  requires: ['rig', 'ik'],
  nodes,
});
const ik = (bones = 1) => ({ kind: 'ik', target: 'target', bones });
const target = { id: 'target', type: 'group' };

describe('ik diagnostics', () => {
  it('rig-ik-host reports code, pointer, message and hint', () => {
    const r = load(document([{ id: 'host', type: 'group', constraints: [ik()] }, target]));
    expect(r.model).toBeUndefined();
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'rig-ik-host',
        pointer: '/nodes/0/constraints/0',
        severity: 'error',
        message: expect.stringContaining('hosted by a bone'),
        hint: expect.stringContaining('chain tip bone'),
      }),
    );
  });

  it('rig-ik-chain reports the bones field when the requested chain is too long', () => {
    const r = load(
      document([{ id: 'arm', type: 'bone', length: 4, constraints: [ik(2)] }, target]),
    );
    expect(r.model).toBeUndefined();
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'rig-ik-chain',
        pointer: '/nodes/0/constraints/0/bones',
        severity: 'error',
        message: expect.stringContaining('available bone chain'),
        hint: expect.stringContaining('reduce bones'),
      }),
    );
  });

  it('requires the ik feature when an ik constraint is authored', () => {
    const raw = document([{ id: 'arm', type: 'bone', length: 4, constraints: [ik()] }, target]);
    raw.requires = ['rig'];
    expect(load(raw).diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'undeclared-feature',
        pointer: '/nodes/0/constraints/0/target',
      }),
    );
  });
});
