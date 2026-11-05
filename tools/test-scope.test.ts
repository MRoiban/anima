import { describe, expect, it } from 'vitest';
import {
  conformanceRunner,
  moduleFiles,
  selectScope,
  targetsForChanges,
  testFiles,
} from './test-scope-map.ts';

describe('scoped test selection', () => {
  it('discovers paint tests across packages and conformance documents', () => {
    const { files, cases } = moduleFiles('paint');
    expect(files).toEqual(
      expect.arrayContaining([
        'modules/paint/test/core/paint.test.ts',
        'modules/paint/test/markup/paint.test.ts',
        'packages/markup/test/names.test.ts',
        'packages/markup/test/corpus.test.ts',
        'modules/paint/test/web/paint-geometry.test.ts',
      ]),
    );
    expect(cases).toContain('paint-gradient');
    expect(cases).not.toContain('bind-number');
    expect(moduleFiles('bind').files).toContain(
      'modules/components/test/markup/components.test.ts',
    );
    expect(
      new RegExp(selectScope(['paint']).casePattern!).test('conformance > paint-gradient'),
    ).toBe(true);
  });
  it('uses requires to find composite cases despite their paint prefix', () => {
    expect(moduleFiles('composite').cases).toContain('paint-blend');
  });
  it('keeps all conformance cases for core, and separates browser engine filters', () => {
    const scope = selectScope(['core', 'paint'], false, 'firefox');
    expect(scope.conformance).toEqual([conformanceRunner]);
    expect(scope.casePattern).toBeUndefined();
    expect(scope.browserPattern).toBe('firefox');
    expect(scope.unit).toContain('modules/paint/test/core/paint.test.ts');
    expect(scope.browser).toContain('modules/paint/test/web/paint-geometry.test.ts');
  });
  it('excludes browser files only on request, and supports unions and oracle', () => {
    const scope = selectScope(['web', 'oracle'], true);
    expect(scope.browser).toEqual([]);
    expect(scope.unit).toContain('tools/oracle.test.ts');
    expect(selectScope(['web']).browser.length).toBeGreaterThan(0);
  });
  it('package scopes together preserve every package test file', () => {
    const scope = selectScope(['core', 'markup', 'web', 'cli', 'playground']);
    expect([...scope.unit, ...scope.browser, ...scope.conformance].sort()).toEqual(
      testFiles()
        .filter((f) => f.startsWith('packages/') || f.startsWith('modules/'))
        .sort(),
    );
  });
  it('maps shared files to packages and module files to module scopes', () => {
    expect(targetsForChanges(['packages/core/src/player.ts'])).toEqual(['core']);
    expect(targetsForChanges(['packages/web/src/index.ts'])).toEqual(['web']);
    expect(targetsForChanges(['modules/paint/core/index.ts'])).toEqual(['paint']);
    expect(targetsForChanges(['spec/conformance/bind-number/script.txt'])).toEqual(['conformance']);
    expect(targetsForChanges(['tests/oracle/README.md'])).toEqual(['oracle']);
    expect(targetsForChanges(['vitest.config.ts'])).toEqual(
      expect.arrayContaining(['core', 'tools']),
    );
    expect(selectScope(['tools']).unit).toContain('tools/test-scope.test.ts');
    expect(targetsForChanges(['docs/PLAN.md'])).toEqual([]);
  });
  it('rejects misspelled targets instead of silently running no tests', () => {
    expect(() => selectScope(['piant'])).toThrow('Unknown target');
  });
});
