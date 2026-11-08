import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lint, outputs, readInventory } from './parity.ts';

describe('docs/parity', () => {
  const rows = readInventory();

  it('the inventory is well-formed (ids, sources, statuses, reasons, phases)', () => {
    expect(lint(rows)).toEqual([]);
    expect(rows.length).toBeGreaterThan(1000);
  });

  it('allows done rows in the phase in progress only, and requires done in finished phases', () => {
    const row = structuredClone(rows.find((row) => row.id === 'text.wrap')!);
    row.anima.phase = 'P8';
    row.anima.status = 'done';
    expect(lint([row])).toEqual([]);
    row.anima.status = 'planned';
    expect(lint([row])).toEqual([]);
    row.anima.phase = 'P7';
    expect(lint([row])).not.toEqual([]);
    row.anima.phase = 'P0';
    expect(lint([row])).not.toEqual([]);
    row.anima.status = 'done';
    row.anima.phase = 'P10';
    expect(lint([row])).not.toEqual([]);
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
