import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lint, outputs, readInventory } from './parity.ts';

describe('docs/parity', () => {
  const rows = readInventory();

  it('the inventory is well-formed (ids, sources, statuses, reasons, phases)', () => {
    expect(lint(rows)).toEqual([]);
    expect(rows.length).toBeGreaterThan(1000);
  });

  it('the generated views are current (run node tools/parity.ts)', () => {
    for (const [name, text] of Object.entries(outputs(rows)))
      expect(readFileSync(new URL(`../docs/parity/${name}`, import.meta.url), 'utf8'), name).toBe(
        text,
      );
  });

  it('wont-do is used only for guardrail conflicts and owner scope decisions', () => {
    // Owner, 2026-11-07: scope triage adds owner-decided won't-do rows (scripting, editor tooling,
    // layout beyond the minimal subset); each still carries its reason.
    const wont = rows.filter((r) => r.anima.status === 'wont-do');
    for (const r of wont)
      expect(r.anima.reason, r.id).toMatch(/guardrail|\.riv|watermark|account|owner triage/i);
  });
});
