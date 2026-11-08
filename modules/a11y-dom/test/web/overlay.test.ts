import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type Page } from 'playwright-core';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { SemanticNode } from '../../../a11y/core/types.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../web/index.ts';
declare global {
  interface Window {
    overlayIcon: AnimaIcon;
    original: Element | null;
    diffs: unknown[];
    overlayTree: SemanticNode[];
  }
}
const root = new URL('../../../../', import.meta.url);
const node = (id: string, a11y: object, children?: object[]) => ({
  id,
  type: children ? 'group' : 'circle',
  ...(children ? { children } : { center: [2, 2], r: 1, fill: { color: '#000' } }),
  a11y: { bounds: [1, 2, 3, 4], ...a11y },
});
const doc = {
  anima: '0.1',
  name: 'overlay',
  grid: 20,
  requires: ['a11y'],
  inputs: {
    on: { type: 'bool', default: false },
    mixed: { type: 'bool', default: true },
    hide: { type: 'bool', default: false },
    level: { type: 'number', default: 40, min: 0, max: 100 },
  },
  nodes: [
    node('settings', { role: 'group', label: 'Settings' }, [
      node('mute', {
        role: 'checkbox',
        label: 'Mute',
        checked: 'on',
        checkedMixed: 'mixed',
        hidden: 'hide',
        hint: 'Quiet mode',
      }),
      node('volume', {
        role: 'slider',
        label: 'Volume',
        value: 'level',
        min: 0,
        max: 100,
        step: 5,
      }),
      node('toggle', { role: 'button', label: 'Toggle', pressed: 'on' }),
    ]),
  ],
};
for (const [name, engine, executablePath] of [
  [
    'Chromium',
    chromium,
    resolve(
      homedir(),
      '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
    ),
  ],
  ['Firefox', firefox, resolve(homedir(), '.cache/ms-playwright/firefox-1555/firefox/firefox')],
] as const)
  describe.skipIf(!existsSync(executablePath))(`overlay ${name}`, () => {
    let browser: Browser,
      page: Page,
      base: string,
      overlay: string,
      focus: string,
      actions: string,
      canvas: string;
    beforeAll(async () => {
      [base, overlay, focus, actions, canvas] = await Promise.all(
        ['index', 'a11y-dom', 'focus', 'a11y-actions', 'canvas'].map((n) =>
          bundle(new URL(`packages/web/src/${n}.ts`, root).pathname),
        ),
      );
      browser = await engine.launch({
        executablePath,
        headless: true,
        args: name === 'Chromium' ? ['--no-sandbox'] : [],
      });
    }, 30000);
    afterAll(async () => {
      await browser?.close();
    });
    beforeEach(async () => {
      page = await browser.newPage();
      await page.setContent(
        '<button id="before">Before</button><anima-icon style="width:100px;height:100px" paused></anima-icon><button id="after">After</button>',
      );
      await page.addScriptTag({ type: 'module', content: base });
      await page.waitForFunction(() => !!customElements.get('anima-icon'));
      await page.addScriptTag({ type: 'module', content: overlay });
      await page.waitForFunction(
        () => !!(customElements.get('anima-icon') as typeof AnimaIcon).prototype.semanticAction,
      );
      const diagnostics = await page.evaluate((d) => {
        window.overlayIcon = document.querySelector('anima-icon')!;
        window.diffs = [];
        window.overlayIcon.addEventListener('anima:semantics', (e) =>
          window.diffs.push((e as CustomEvent).detail),
        );
        return window.overlayIcon.load(d);
      }, doc);
      expect(diagnostics).toEqual([]);
    });
    afterEach(async () => {
      await page.close();
    });
    const target = (id: string) => page.locator(`[data-semantic="${id}"]`);
    const withFocus = async () => {
      await page.addScriptTag({ type: 'module', content: focus });
      await page.waitForFunction(() =>
        document.querySelector('anima-icon')!.hasAttribute('data-focus-ready'),
      );
      await page.evaluate((d) => {
        d.requires.push('focus');
        window.overlayIcon.load(d);
      }, doc);
    };
    const active = () =>
      page.evaluate(() =>
        window.overlayIcon.shadowRoot!.activeElement?.getAttribute('data-semantic'),
      );
    it('maps every role to a real element, with heading levels and state attributes', async () => {
      const roles = [
        'button',
        'switch',
        'checkbox',
        'radio',
        'slider',
        'link',
        'tab',
        'tab-list',
        'list',
        'list-item',
        'group',
        'dialog',
        'alert-dialog',
        'text',
        'img',
      ];
      const expected = [
        'BUTTON',
        'BUTTON',
        'INPUT',
        'INPUT',
        'INPUT',
        'A',
        'BUTTON',
        'DIV',
        'DIV',
        'DIV',
        'DIV',
        'DIV',
        'DIV',
        'DIV',
        'DIV',
      ];
      const nodes = roles.map((role) =>
        node(role, {
          role,
          label: role,
          ...(role === 'slider' ? { value: 'level' } : {}),
          ...(role === 'link' ? { href: '#destination', expanded: true } : {}),
          ...(role === 'switch' ? { checked: true } : {}),
          ...(role === 'tab' ? { selected: true } : {}),
          ...(role === 'text' ? { live: 'polite' } : {}),
        }),
      );
      nodes.push(
        node('radios', { role: 'radio-group' }, [
          node('r1', { role: 'radio', checked: 'on' }),
          node('r2', { role: 'radio', checked: true }),
        ]),
      );
      for (let level = 1; level <= 6; level++)
        nodes.push(node('h' + level, { role: 'heading', level, label: 'Heading ' + level }));
      const diagnostics = await page.evaluate((d) => window.overlayIcon.load(d), { ...doc, nodes });
      expect(diagnostics).toEqual([]);
      for (let i = 0; i < roles.length; i++)
        expect(await target(roles[i]!).evaluate((e) => e.tagName)).toBe(expected[i]);
      expect(await target('switch').getAttribute('aria-checked')).toBe('true');
      expect(await target('link').getAttribute('href')).toBe('#destination');
      expect(await target('link').getAttribute('aria-expanded')).toBe('true');
      expect(await target('tab').getAttribute('aria-selected')).toBe('true');
      expect(await target('text').getAttribute('aria-live')).toBe('polite');
      expect(await target('radios').getAttribute('role')).toBe('radiogroup');
      expect(await target('r1').getAttribute('name')).toBe('radios');
      expect(await target('r2').getAttribute('name')).toBe('radios');
      for (let level = 1; level <= 6; level++)
        expect(await target('h' + level).evaluate((e) => e.tagName)).toBe('H' + level);
    });
    it('uses native radio arrow behaviour', async () => {
      const diagnostics = await page.evaluate((d) => window.overlayIcon.load(d), {
        ...doc,
        nodes: [
          node('radios', { role: 'radio-group' }, [
            node('r1', { role: 'radio', checked: 'on' }),
            node('r2', { role: 'radio', checked: 'mixed' }),
          ]),
        ],
      });
      expect(diagnostics).toEqual([]);
      await target('r2').focus();
      await page.keyboard.press('Space');
      expect(await page.evaluate(() => window.overlayIcon.get('mixed'))).toBe(true);
      await page.keyboard.press('ArrowLeft');
      expect(await active()).toBe('r1');
      expect(await page.evaluate(() => window.overlayIcon.get('on'))).toBe(true);
    });
    it('keeps readonly and disabled native controls aligned to logical states', async () => {
      const diagnostics = await page.evaluate((d) => window.overlayIcon.load(d), {
        ...doc,
        nodes: [
          node('ro', { role: 'checkbox', checked: 'on', readonly: true }),
          node('disabled', { role: 'button', activate: 'on', disabled: true }),
          node('range', { role: 'slider', value: 'level', readonly: true }),
        ],
      });
      expect(diagnostics).toEqual([]);
      expect(await target('disabled').isDisabled()).toBe(true);
      await target('ro').focus();
      await page.keyboard.press('Space');
      expect(await target('ro').isChecked()).toBe(false);
      expect(await target('ro').getAttribute('aria-readonly')).toBe('true');
      await target('range').focus();
      await page.keyboard.press('ArrowRight');
      expect(await target('range').inputValue()).toBe('40');
    });
    it('[P3c-8] maps canvas node boxes under fit, resize and pixel ratio with native actions', async () => {
      await page.addScriptTag({ type: 'module', content: canvas });
      await page.waitForFunction(
        () => !!(customElements.get('anima-icon') as typeof AnimaIcon).renderers.canvas,
      );
      expect(
        await page.evaluate((d) => {
          window.overlayIcon.setAttribute('renderer', 'canvas');
          window.overlayIcon.setAttribute('pixel-ratio', '2');
          return window.overlayIcon.load(d);
        }, doc),
      ).toEqual([]);
      expect(await page.locator('anima-icon canvas').count()).toBe(1);
      expect(await page.locator('anima-icon svg').count()).toBe(0);
      for (const [fit, x, y, w, h] of [
        ['fill', 10, 10, 30, 20],
        ['contain', 55, 10, 15, 20],
        ['cover', 10, -30, 30, 40],
        ['none', 91, 42, 3, 4],
      ] as const) {
        await page.evaluate((f) => {
          window.overlayIcon.style.width = '200px';
          window.overlayIcon.style.height = '100px';
          window.overlayIcon.setAttribute('fit', f);
        }, fit);
        await expect
          .poll(async () => Math.round((await target('mute').boundingBox())!.width))
          .toBe(w);
        const host = (await page.locator('anima-icon').boundingBox())!,
          r = (await target('mute').boundingBox())!;
        expect([r.x - host.x, r.y - host.y, r.width, r.height].map(Math.round), fit).toEqual([
          x,
          y,
          w,
          h,
        ]);
      }
      await target('mute').focus();
      await page.keyboard.press('Space');
      expect(await page.evaluate(() => window.overlayIcon.get('on'))).toBe(true);
      await page.evaluate(() => {
        window.overlayIcon.set('hide', true);
        window.overlayIcon.player!.step(0);
      });
      expect(await target('mute').count()).toBe(0);
      await page.evaluate(() => window.overlayIcon.destroy());
      expect(await target('volume').count()).toBe(0);
    });
    it('positions nested bounds using the live SVG viewBox mapping', async () => {
      await page.evaluate(() => {
        window.overlayIcon.style.width = '200px';
        window.overlayIcon.style.height = '100px';
        window.overlayIcon.setAttribute('fit', 'fill');
      });
      await expect
        .poll(async () => Math.round((await target('mute').boundingBox())!.width))
        .toBe(30);
      const host = (await page.locator('anima-icon').boundingBox())!,
        rect = (await target('mute').boundingBox())!;
      expect(rect.x - host.x).toBeCloseTo(10);
      expect(rect.y - host.y).toBeCloseTo(10);
      expect(rect.height).toBeCloseTo(20);
      await page.evaluate(() => window.overlayIcon.setAttribute('fit', 'none'));
      await expect
        .poll(async () => Math.round((await target('mute').boundingBox())!.width))
        .toBe(3);
    });
    it('supports tab-list roving, Home/End and disabled skipping with and without focus', async () => {
      const d = {
        ...doc,
        requires: [...doc.requires],
        nodes: [
          node('tabs', { role: 'tab-list' }, [
            node('t1', { role: 'tab', label: 'First', selected: 'on' }),
            node('skip', { role: 'tab', disabled: true }),
            node('t2', { role: 'tab', label: 'Second' }),
          ]),
        ],
      };
      for (const useFocus of [false, true]) {
        if (useFocus) {
          await page.addScriptTag({ type: 'module', content: focus });
          await page.waitForFunction(() =>
            document.querySelector('anima-icon')!.hasAttribute('data-focus-ready'),
          );
          d.requires.push('focus');
        }
        expect(await page.evaluate((d) => window.overlayIcon.load(d), d)).toEqual([]);
        expect(await target('t1').getAttribute('tabindex')).toBe('0');
        expect(await target('t2').getAttribute('tabindex')).toBe('-1');
        expect(await target('skip').getAttribute('tabindex')).toBe('-1');
        await target('t1').focus();
        await page.keyboard.press('ArrowRight');
        expect(await active()).toBe('t2');
        expect(await target('t1').getAttribute('tabindex')).toBe('-1');
        await page.keyboard.press('Home');
        expect(await active()).toBe('t1');
        await page.keyboard.press('End');
        expect(await active()).toBe('t2');
        await page.keyboard.press('ArrowRight');
        expect(await active()).toBe('t1');
      }
    });
    it('handles dispatched semantic clicks without duplicate host/root activation', async () => {
      expect(
        await page.evaluate(
          (d) =>
            window.overlayIcon.load({
              ...d,
              a11y: { role: 'button', label: 'Root', activate: 'on' },
            }),
          doc,
        ),
      ).toEqual([]);
      await target('toggle').dispatchEvent('click');
      expect(await page.evaluate(() => window.overlayIcon.get('on'))).toBe(true);
      await target('toggle').focus();
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => window.overlayIcon.get('on'))).toBe(false);
    });
    it('applies state removal, nested offset changes and string values through the tree diff contract', async () => {
      await page.evaluate(() => {
        window.overlayTree = window.overlayIcon.semantics;
        window.overlayIcon.player!.semantics = () => window.overlayTree;
        window.original = window.overlayIcon.shadowRoot!.querySelector('[data-semantic="mute"]');
        window.overlayTree[0]!.bounds = [8, 8, 3, 4];
        const slider = window.overlayTree[0]!.children[1]!;
        slider.valueText = 'Loud';
        slider.states = { disabled: true, readonly: true, required: true, live: 'assertive' };
        window.overlayIcon.player!.step(0);
      });
      expect(await target('volume').getAttribute('aria-valuetext')).toBe('Loud');
      expect(await target('volume').getAttribute('aria-live')).toBe('assertive');
      expect(await target('volume').getAttribute('aria-required')).toBe('true');
      expect(await target('volume').isDisabled()).toBe(true);
      expect(
        await page.evaluate(
          () =>
            window.original ===
            window.overlayIcon.shadowRoot!.querySelector('[data-semantic="mute"]'),
        ),
      ).toBe(true);
      const host = (await page.locator('anima-icon').boundingBox())!,
        r = (await target('mute').boundingBox())!;
      expect(r.x - host.x).toBeCloseTo(5);
      expect(r.y - host.y).toBeCloseTo(10);
      await page.evaluate(() => {
        window.overlayTree = structuredClone(window.overlayTree);
        const slider = window.overlayTree[0]!.children[1]!;
        slider.value = 40;
        delete slider.valueText;
        slider.states = {};
        window.overlayIcon.player!.step(0);
      });
      for (const attr of [
        'aria-valuetext',
        'aria-live',
        'aria-readonly',
        'aria-required',
        'aria-disabled',
      ])
        expect(await target('volume').getAttribute(attr)).toBe(null);
      expect(await target('volume').isDisabled()).toBe(false);
    });
    it('retains the focus module single-stop policy and survives overlay opt-out/restore', async () => {
      await withFocus();
      await page.evaluate((d) => {
        d.requires.push('focus');
        for (const n of (d.nodes[0] as { children: object[] }).children)
          Object.assign(n, { focus: { tabStops: false } });
        window.overlayIcon.load(d);
      }, doc);
      await page.locator('#before').focus();
      await page.keyboard.press('Tab');
      expect(await active()).toBe('mute');
      await page.evaluate(() => window.overlayIcon.player!.focusTarget('volume'));
      await page.keyboard.press('ArrowRight');
      expect(await target('volume').getAttribute('tabindex')).toBe('0');
      expect(await target('mute').getAttribute('tabindex')).toBe('-1');
      await page.keyboard.press('Tab');
      expect(await page.locator('#after').evaluate((e) => e === document.activeElement)).toBe(true);
      await page.evaluate(() => {
        window.overlayIcon.player!.focusTarget('volume');
        window.overlayIcon.setAttribute('a11y', 'off');
      });
      await expect.poll(() => page.locator('[data-semantic]').count()).toBe(0);
      await page.evaluate(() => window.overlayIcon.removeAttribute('a11y'));
      await expect.poll(active).toBe('volume');
      expect(await page.locator('[data-focus="volume"]').count()).toBe(1);
    });
    it('attaches after separately bundled focus/actions and an already loaded model', async () => {
      await page.close();
      page = await browser.newPage();
      await page.setContent('<anima-icon paused></anima-icon>');
      await page.addScriptTag({ type: 'module', content: focus });
      await page.addScriptTag({ type: 'module', content: actions });
      await page.waitForFunction(
        () => !!(customElements.get('anima-icon') as typeof AnimaIcon)?.modules.has('a11yactions'),
      );
      expect(
        await page.evaluate((d) => {
          window.overlayIcon = document.querySelector('anima-icon')!;
          return window.overlayIcon.load({ ...d, requires: ['a11y', 'focus'] });
        }, doc),
      ).toEqual([]);
      expect(await page.locator('[data-focus="mute"]').count()).toBe(1);
      await page.addScriptTag({ type: 'module', content: overlay });
      await expect.poll(() => target('mute').count()).toBe(1);
      expect(await page.locator('[data-focus="mute"]').count()).toBe(1);
      await target('volume').focus();
      expect(await page.evaluate(() => window.overlayIcon.player!.focused)).toBe('volume');
    });
    it('leaves document-only a11y alone and cleans up on reload and destroy', async () => {
      expect(
        await page.evaluate(() =>
          window.overlayIcon.load({
            anima: '0.1',
            name: 'root',
            grid: 20,
            inputs: { on: { type: 'bool', default: false } },
            a11y: { role: 'button', label: 'Root', activate: 'on' },
            nodes: [{ id: 'plain', type: 'circle', center: [2, 2], r: 1, fill: { color: '#000' } }],
          }),
        ),
      ).toEqual([]);
      expect(await page.locator('[data-semantic]').count()).toBe(0);
      await page.locator('anima-icon').focus();
      await page.keyboard.press('Enter');
      await page.evaluate(() => window.overlayIcon.player!.step(0));
      expect(await page.evaluate(() => window.overlayIcon.get('on'))).toBe(true);
      await page.evaluate((d) => window.overlayIcon.load(d), doc);
      expect(await target('mute').count()).toBe(1);
      await page.evaluate(() => window.overlayIcon.destroy());
      expect(await page.locator('[data-semantic]').count()).toBe(0);
      expect(await page.evaluate(() => window.overlayIcon.semanticAction('mute', 'tap'))).toBe(
        false,
      );
      expect(await page.evaluate(() => window.overlayIcon.semantics)).toEqual([]);
    });
    it('does not mutate unchanged semantic elements on a settled step', async () => {
      const mutations = await page.evaluate(async () => {
        let count = 0;
        const observer = new MutationObserver((records) => {
          count += records.length;
        });
        observer.observe(window.overlayIcon.shadowRoot!, {
          attributes: true,
          childList: true,
          subtree: true,
          characterData: true,
        });
        window.overlayIcon.player!.step(0);
        await Promise.resolve();
        observer.disconnect();
        return count;
      });
      expect(mutations).toBe(0);
      await withFocus();
      const focusedMutations = await page.evaluate(async () => {
        let count = 0;
        const observer = new MutationObserver((records) => {
          count += records.length;
        });
        observer.observe(window.overlayIcon.shadowRoot!, {
          attributes: true,
          childList: true,
          subtree: true,
        });
        window.overlayIcon.player!.step(0);
        await Promise.resolve();
        observer.disconnect();
        return count;
      });
      expect(focusedMutations).toBe(0);
    });
    it('activates a native button through its noninteractive semantic child', async () => {
      expect(
        await page.evaluate((d) => window.overlayIcon.load(d), {
          ...doc,
          nodes: [
            node('parent', { role: 'button', label: 'Parent', pressed: 'on' }, [
              node('child', { role: 'img', label: 'Decoration' }),
            ]),
          ],
        }),
      ).toEqual([]);
      await target('child').dispatchEvent('click');
      expect(await page.evaluate(() => window.overlayIcon.get('on'))).toBe(true);
    });
    it('bubbles a child control activation to the page without activating its semantic parent', async () => {
      expect(
        await page.evaluate((d) => window.overlayIcon.load(d), {
          ...doc,
          nodes: [
            node('parent', { role: 'button', label: 'Parent', pressed: 'on' }, [
              node('child', { role: 'button', label: 'Child', pressed: 'mixed' }),
            ]),
          ],
        }),
      ).toEqual([]);
      await page.evaluate(() => {
        document.body.dataset.clicks = '0';
        document.body.addEventListener('click', () => {
          document.body.dataset.clicks = String(Number(document.body.dataset.clicks) + 1);
        });
      });
      await target('child').dispatchEvent('click');
      expect(await page.evaluate(() => window.overlayIcon.get('mixed'))).toBe(false);
      expect(await page.evaluate(() => window.overlayIcon.get('on'))).toBe(false);
      expect(await page.locator('body').getAttribute('data-clicks')).toBe('1');
    });
    it('can activate and remove its own semantic control without a stale-event error', async () => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      for (const role of ['button', 'checkbox']) {
        expect(
          await page.evaluate((d) => window.overlayIcon.load(d), {
            ...doc,
            nodes: [
              node('dismiss', {
                role,
                hidden: 'on',
                ...(role === 'button' ? { pressed: 'on' } : { checked: 'on' }),
              }),
            ],
          }),
        ).toEqual([]);
        await target('dismiss').dispatchEvent('click');
        expect(await target('dismiss').count()).toBe(0);
        expect(await page.evaluate(() => window.overlayIcon.get('on'))).toBe(true);
      }
      expect(errors).toEqual([]);
    });
    it('[P3b-10a] exposes numeric slider value and independent spoken value text', async () => {
      expect(
        await page.evaluate((d) => window.overlayIcon.load(d), {
          ...doc,
          nodes: [
            node('speech', {
              role: 'slider',
              label: 'Volume',
              value: 'level',
              valueText: 'Volume 40 %',
              step: 5,
            }),
          ],
        }),
      ).toEqual([]);
      expect(await target('speech').inputValue()).toBe('40');
      expect(await target('speech').getAttribute('aria-valuetext')).toBe('Volume 40 %');
      // Playwright's native-range AX projection reports its number, even with valuetext.
      expect(await page.locator('anima-icon').ariaSnapshot()).toContain('slider "Volume": "40"');
      expect(await page.evaluate(() => window.overlayIcon.semantics[0])).toMatchObject({
        value: 40,
        valueText: 'Volume 40 %',
      });
    });
    it('native controls and an actual accessibility tree', async () => {
      expect(await target('mute').getAttribute('type')).toBe('checkbox');
      expect(await target('mute').evaluate((e: HTMLInputElement) => e.indeterminate)).toBe(true);
      const snapshot = await page.locator('anima-icon').ariaSnapshot();
      expect(snapshot).toContain('checkbox "Mute" [checked=mixed]');
      expect(snapshot).toContain('slider "Volume": "40"');
      expect(snapshot).toContain('button "Toggle"');
    });
    it('native keyboard activation and range input call semantic actions', async () => {
      await page.evaluate(() => {
        window.overlayIcon.set('mixed', false);
        window.overlayIcon.player!.step(0);
      });
      await target('mute').focus();
      await page.keyboard.press('Space');
      expect(await page.evaluate(() => window.overlayIcon.get('on'))).toBe(true);
      expect(await target('mute').isChecked()).toBe(true);
      await target('toggle').focus();
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => window.overlayIcon.get('on'))).toBe(false);
      await target('volume').focus();
      await page.keyboard.press('ArrowRight');
      expect(await page.evaluate(() => window.overlayIcon.get('level'))).toBe(45);
      await page.keyboard.press('End');
      expect(await page.evaluate(() => window.overlayIcon.get('level'))).toBe(100);
    });
    it('uses diffs, preserves identity, removes hidden nodes and has a read-only host tree', async () => {
      await page.evaluate(() => {
        window.original = window.overlayIcon.shadowRoot!.querySelector('[data-semantic="volume"]');
        window.diffs = [];
        window.overlayIcon.player!.step(0);
      });
      expect(await page.evaluate(() => window.diffs)).toEqual([]);
      await page.evaluate(() => {
        window.overlayIcon.set('level', 60);
        window.overlayIcon.player!.step(0);
      });
      expect(
        await page.evaluate(
          () =>
            window.original ===
            window.overlayIcon.shadowRoot!.querySelector('[data-semantic="volume"]'),
        ),
      ).toBe(true);
      expect(await page.evaluate(() => window.diffs)).toEqual([
        { added: [], removed: [], changed: [{ id: 'volume', keys: ['value'] }] },
      ]);
      await page.evaluate(() => {
        window.overlayIcon.set('hide', true);
        window.overlayIcon.player!.step(0);
      });
      expect(await target('mute').count()).toBe(0);
      expect(
        await page.evaluate(() => {
          window.overlayIcon.semantics[0]!.label = 'Changed';
          return window.overlayIcon.semantics[0]!.label;
        }),
      ).toBe('Settings');
    });
    it('supports overlay opt-out and restore while retaining host APIs', async () => {
      await page.evaluate(() => window.overlayIcon.setAttribute('a11y', 'off'));
      await expect.poll(() => page.locator('[data-semantic]').count()).toBe(0);
      expect(await page.evaluate(() => window.overlayIcon.semanticAction('toggle', 'tap'))).toBe(
        true,
      );
      await page.evaluate(() => window.overlayIcon.removeAttribute('a11y'));
      await expect.poll(() => target('toggle').getAttribute('aria-pressed')).toBe('true');
    });
    it('unifies focus proxies and synchronizes DOM and logical focus', async () => {
      await withFocus();
      expect(await page.locator('[data-focus="mute"]').count()).toBe(1);
      await target('mute').focus();
      expect(await page.evaluate(() => window.overlayIcon.player!.focused)).toBe('mute');
      await page.evaluate(() => window.overlayIcon.player!.focusTarget('volume'));
      expect(await active()).toBe('volume');
      await page.keyboard.press('ArrowRight');
      expect(await active()).toBe('volume');
      expect(await page.evaluate(() => window.overlayIcon.get('level'))).toBe(45);
      await page.evaluate(() => window.overlayIcon.focusNext());
      expect(await active()).toBe('toggle');
      await page.evaluate(() => window.overlayIcon.focusPrevious());
      expect(await active()).toBe('volume');
      await page.locator('#after').focus();
      await expect.poll(() => page.evaluate(() => window.overlayIcon.player!.focused)).toBe(null);
    });
    it('retains native Tab entry and exit with focus loaded', async () => {
      await withFocus();
      await page.locator('#before').focus();
      await page.keyboard.press('Tab');
      expect(await active()).toBe('mute');
      await page.keyboard.press('Tab');
      expect(await active()).toBe('volume');
      await page.keyboard.press('Tab');
      expect(await active()).toBe('toggle');
      await page.keyboard.press('Tab');
      expect(await page.locator('#after').evaluate((e) => e === document.activeElement)).toBe(true);
    });
  });
