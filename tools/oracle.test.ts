import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import {
  cases,
  measure,
  pendingCases,
  skippedCases,
  compareEvents,
  findingCases,
} from './oracle.ts';

it.each(skippedCases)('documented oracle skip: $name', (c) => {
  expect(c.status).toBe('skip');
  expect(c.reason.length).toBeGreaterThan(40);
  expect(c.tests.length).toBeGreaterThan(0);
  for (const test of c.tests) expect(existsSync(new URL(`../${test}`, import.meta.url))).toBe(true);
  for (const evidence of c.captureEvidence ?? [])
    expect(existsSync(new URL(`../${evidence}`, import.meta.url))).toBe(true);
  expect(cases.some((v) => v.name === c.name)).toBe(false);
  expect(pendingCases.some((v) => v.name === c.name)).toBe(false);
});

for (const c of cases)
  it(`Rive oracle: ${c.name}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'anima-oracle-'));
    try {
      const metrics = await measure(c, pathToFileURL(dir + '/'));
      for (const m of metrics) {
        expect(m.maxDiff, `${c.name} at ${m.time}s: max channel delta`).toBeLessThanOrEqual(
          c.values?.tolerance ?? c.maxDiff,
        );
        expect(
          m.overPercent,
          `${c.name} at ${m.time}s: pixels over ${c.threshold}`,
        ).toBeLessThanOrEqual(c.maxOverPercent);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

for (const c of pendingCases) it.todo(`Rive oracle: ${c.name} (pending: ${c.reason})`);

it('compares event order, frame, typed payload and URL exactly', () => {
  const reports = [
    { frame: 13, name: 'ping', payload: { n: 7, flag: true, label: 'hello' } },
    { frame: 28, url: 'https://example.org/probe' },
  ];
  expect(compareEvents(reports, structuredClone(reports)).pass).toBe(true);
  const changes = [
    [...reports].reverse(),
    reports.slice(1),
    [...reports, reports[0]],
    [{ ...reports[0], frame: 14 }, reports[1]],
    [{ ...reports[0], payload: { n: 7, flag: 1, label: 'hello' } }, reports[1]],
    [{ frame: 13, name: 'ping' }, reports[1]],
    [{ ...reports[0], payload: { n: 7.000000001, flag: true, label: 'hello' } }, reports[1]],
    [reports[0], { frame: 28, url: 'https://example.org/other' }],
  ];
  for (const changed of changes) expect(compareEvents(changed, reports).pass).toBe(false);
});

it('compares post-click counts, empty intervals and reports without numeric tolerance', () => {
  const observations = [
    { click: 0, values: { count: 0 }, events: [] },
    { click: 1, values: { count: 1 }, events: [{ name: 'shared', payload: { count: 1 } }] },
  ];
  expect(compareEvents(observations, structuredClone(observations)).pass).toBe(true);
  for (const changed of [
    observations.slice(1),
    [observations[1], observations[0]],
    [observations[0], { ...observations[1], values: { count: 1.000000001 } }],
    [observations[0], { ...observations[1], events: [] }],
    [observations[0], { ...observations[1], events: [{ name: 'shared', payload: { count: 0 } }] }],
  ])
    expect(compareEvents(observations, changed).pass).toBe(false);
});

for (const finding of findingCases)
  it(`known Rive disagreement (not verified parity): ${finding.case.name}`, async () => {
    expect(cases.some((c) => c.name === finding.case.name)).toBe(false);
    expect(skippedCases.some((c) => c.name === finding.case.name)).toBe(false);
    const dir = mkdtempSync(join(tmpdir(), 'anima-finding-'));
    try {
      const [metric] = await measure(finding.case, pathToFileURL(dir + '/'));
      const recorded = JSON.parse(
        readFileSync(new URL('../tests/oracle/findings-metrics.json', import.meta.url), 'utf8'),
      );
      const previous = recorded.find((c: { name: string }) => c.name === finding.case.name)
        .frames[0];
      expect(metric).toEqual(previous);
      expect(metric!.pass).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
