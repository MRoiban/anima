/* eslint-disable -- one-off P3c-1 survey script (measurement scratch, not shipped or imported). */
// Measurement-only probes. Run from repo root: node design/p3c/survey/measure.ts <mode>.
// Scratch copy must be a clean git archive of HEAD with node_modules symlinked.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import ts from 'typescript';
import { bundle } from '../../../tools/browser-build.ts';
import { moduleBudgets, webOwners } from '../../../tools/modules.generated.ts';
const scratch = process.env.SURVEY_SCRATCH ?? '/tmp/p3c-survey-scratch';
const out = 'design/p3c/survey';
const files = execFileSync(
  'git',
  ['ls-files', 'modules', 'packages/core/src', 'packages/web/src'],
  { encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .filter(
    (f) =>
      f.endsWith('.ts') &&
      !f.includes('/test/') &&
      !f.includes('/markup/') &&
      !f.includes('/oracle'),
  )
  .concat(['modules/markup/web/index.ts']);
const original = new Map(files.map((f) => [f, readFileSync(`${scratch}/${f}`, 'utf8')]));
const parsed = (f: string, s: string) => ts.createSourceFile(f, s, ts.ScriptTarget.Latest, true);
const gz = (s: string) => gzipSync(s, { level: 9 }).length;
const entries = moduleBudgets.filter((m) => !m.authoring);
const runtimeFile = (f: string) =>
  entries.some((m) => f.startsWith(`modules/${webOwners[m.name]}/`));
const sizeReport = (name: string) => {
  let status = 0,
    stdout = '',
    stderr = '';
  try {
    stdout = execFileSync('node', ['tools/size.ts'], {
      cwd: scratch,
      encoding: 'utf8',
      maxBuffer: 1000000,
    });
  } catch (e: any) {
    status = e.status;
    stdout = e.stdout ?? '';
    stderr = e.stderr ?? '';
  }
  writeFileSync(`${out}/${name}.txt`, stdout + stderr);
  writeFileSync(`${out}/${name}-status.json`, JSON.stringify({ status, stderr }, null, 2) + '\n');
};
const totalEntry = `${scratch}/tools/.survey-entry.ts`;
writeFileSync(
  totalEntry,
  entries
    .filter((m) => !m.heavy)
    .map((m) => `import '../packages/web/src/${m.name}.ts';`)
    .join('\n') + "\nimport '../packages/web/src/index.ts';",
);
const measure = async () => gz(await bundle(totalEntry));
const base = await measure();
const results: any[] = [];
let guardedTrial = process.env.SURVEY_GUARDED === '1';
const reset = () => {
  for (const [f, s] of original)
    writeFileSync(`${scratch}/${f}`, guardedTrial && runtimeFile(f) ? diagnostic(f, s) : s);
};
const edits = (s: string, changes: { start: number; end: number; text: string }[]) => {
  for (const c of changes.sort((a, b) => b.start - a.start))
    s = s.slice(0, c.start) + c.text + s.slice(c.end);
  return s;
};
function diagnostic(f: string, s: string) {
  const ast = parsed(f, s),
    changes: { start: number; end: number; text: string }[] = [];
  const sig = new Map<string, number[]>();
  const scan = (n: ts.Node) => {
    if (ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
      const name = ts.isFunctionDeclaration(n)
        ? n.name?.text
        : ts.isVariableDeclaration(n.parent)
          ? n.parent.name.getText(ast)
          : undefined;
      if (name && /^(err|error|bad|mismatch)$/.test(name))
        sig.set(
          name,
          n.parameters.flatMap((p, i) =>
            /^(message|hint|m|h|expected)$/.test(p.name.getText(ast)) ? [i] : [],
          ),
        );
    }
    ts.forEachChild(n, scan);
  };
  scan(ast);
  const walk = (n: ts.Node) => {
    if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
      const name = n.expression.getText(ast),
        args = n.arguments ?? [];
      let indexes: number[] = [];
      if (/\.(err|warn)$/.test(name)) indexes = [2, 3];
      else if (sig.has(name)) indexes = sig.get(name)!;
      else if (name === 'error' && /import[^;]*\berror\b/s.test(s)) indexes = [3, 4];
      else if (name === 'bad' || name === 'mismatch') indexes = [0];
      else if (name === 'ConverterError') indexes = [1];
      for (const i of indexes) {
        const a = args[i];
        if (a && !/^(V|VERBOSE) &&/.test(a.getText(ast)))
          changes.push({
            start: a.getStart(ast),
            end: a.end,
            text: `SURVEY_VERBOSE && (${a.getText(ast)})`,
          });
      }
    }
    ts.forEachChild(n, walk);
  };
  walk(ast);
  if (!changes.length) return s;
  const relative = '../'.repeat(f.split('/').length - 1) + 'packages/core/src/flags.ts';
  return `import { VERBOSE as SURVEY_VERBOSE } from '${relative}';\n` + edits(s, changes);
}
try {
  if (process.argv[2] === 'hooks') {
    const groups = [
      'paint',
      'surface',
      'components',
      'bind',
      'convert',
      'events',
      'focus',
      'motion',
      'data',
    ];
    for (const owner of process.env.SURVEY_RELOCATE === '1'
      ? ['combined']
      : [...groups, 'combined']) {
      reset();
      const changed: string[] = [];
      for (const [f, s] of original)
        if (
          f.includes('/web/') &&
          (owner === 'combined' ? groups : [owner]).some((o) => f === `modules/${o}/web/index.ts`)
        ) {
          let next = s
            .replace(/^import '\.\/markup\.ts';\n/gm, '')
            .replace(/^import \{ \w+Markup \} from '[^']*markup[^']*';\n/gm, '');
          next = next.replace(/^.*\.registerMarkup\([^;]*;\n/gm, '');
          if (next !== s) {
            writeFileSync(`${scratch}/${f}`, next);
            changed.push(f);
          }
        }
      if (owner === 'combined' && process.env.SURVEY_RELOCATE === '1') {
        const author = 'modules/markup/web/index.ts';
        let extra = ['paint', 'surface', 'components', 'bind', 'convert']
          .map((o) => `import '../../${o}/web/markup.ts';`)
          .join('\n');
        for (const o of ['events', 'focus', 'motion', 'data'])
          extra += `\nimport { ${o}Markup } from '../../${o}/markup/index.ts';\nIcon.registerMarkup('${o === 'focus' ? 'paint' : o}',${o}Markup);`;
        writeFileSync(`${scratch}/${author}`, original.get(author)! + '\n' + extra + '\n');
        sizeReport('relocated-gates');
      }
      const bytes = await measure();
      results.push({ owner, files: changed, bytes, saving: base - bytes });
      console.log(owner, base - bytes);
    }
  } else if (['diagnostics', 'tickets'].includes(process.argv[2])) {
    const tickets: Record<string, string[]> = {
      T1: ['convert', 'bind'],
      T2: ['events', 'machine', 'data', 'data-host', 'motion', 'input', 'focus', 'derive'],
      T3: ['paint', 'composite', 'surface', 'contour', 'mix', 'componentpaint'],
      T4: ['components', 'lists', 'nested'],
    };
    const owners =
      process.argv[2] === 'tickets'
        ? Object.keys(tickets)
        : [...new Set(entries.map((m) => webOwners[m.name]))];
    for (const owner of owners) {
      reset();
      let changed: string[] = [];
      for (const [f, s] of original)
        if ((tickets[owner] ?? [owner]).some((o) => f.startsWith(`modules/${o}/`))) {
          const next = diagnostic(f, s);
          if (next !== s) {
            writeFileSync(`${scratch}/${f}`, next);
            changed.push(f);
          }
        }
      if (changed.length) {
        const bytes = await measure();
        results.push({ owner, files: changed, bytes, saving: base - bytes });
        console.log(owner, base - bytes);
      }
    }
    reset();
    for (const [f, s] of original)
      writeFileSync(`${scratch}/${f}`, runtimeFile(f) ? diagnostic(f, s) : s);
    results.push({ owner: 'combined', bytes: await measure() });
  } else if (process.argv[2] === 'duplicates') {
    const run = async (name: string, apply: () => void) => {
      reset();
      apply();
      const bytes = await measure();
      results.push({ name, bytes, saving: base - bytes });
      console.log(name, base - bytes);
    };
    const shared = 'modules/survey-shared.ts';
    const helper = (f: string, name: string, source: string) => {
      const s = readFileSync(`${scratch}/${f}`, 'utf8'),
        ast = parsed(f, s);
      let target: ts.Node | undefined;
      for (const n of ast.statements)
        if (ts.isFunctionDeclaration(n) && n.name?.text === name) target = n;
      if (!target) throw new Error(f + ': missing ' + name);
      writeFileSync(
        `${scratch}/${f}`,
        `import { pointer as ${name} } from '../../survey-shared.ts';\n` +
          edits(s, [{ start: target.getStart(ast), end: target.end, text: '' }]),
      );
      writeFileSync(`${scratch}/${shared}`, source);
    };
    const pointers = () => {
      const source = `export function pointer(m:any,i:number):string { const n=m.nodes[i], siblings=n.parent<0?m.nodes.filter((n:any)=>n.parent<0):m.nodes[n.parent].children.map((i:number)=>m.nodes[i]);return(n.parent<0?'/nodes':pointer(m,n.parent)+'/children')+'/'+siblings.indexOf(n);}`;
      for (const [f, name] of [
        ['modules/lists/core/index.ts', 'pointer'],
        ['modules/nested/core/index.ts', 'pointer'],
        ['modules/components/core/index.ts', 'nodePointer'],
      ])
        helper(f, name, source);
    };
    await run('node-pointers', pointers);
    const clones = () => {
      writeFileSync(
        `${scratch}/modules/survey-clone.ts`,
        `export const clone=(e:any):any=>({...e,kids:e.kids.map(clone)});`,
      );
      for (const [f, name] of [
        ['modules/surface/core/svg.ts', 'copy'],
        ['modules/composite/core/svg.ts', 'cp'],
      ]) {
        const s = original.get(f)!,
          ast = parsed(f, s);
        let target: ts.Node | undefined;
        for (const n of ast.statements)
          if (
            ts.isVariableStatement(n) &&
            n.declarationList.declarations.some((d) => d.name.getText(ast) === name)
          )
            target = n;
        writeFileSync(
          `${scratch}/${f}`,
          `import { clone as ${name} } from '../../survey-clone.ts';\n` +
            edits(s, [{ start: target!.getStart(ast), end: target!.end, text: '' }]),
        );
      }
    };
    await run('svg-clones', clones);
    const drawing = () => {
      const f1 = 'modules/lists/core/index.ts',
        f2 = 'modules/nested/core/render.ts';
      const s1 = original.get(f1)!,
        s2 = original.get(f2)!;
      const start1 = s1.indexOf('    child.tree.nodes.forEach((n, i) => {'),
        end1 = s1.indexOf('\n  }\n}', start1);
      const start2 = s2.indexOf('    child.tree.nodes.forEach((n, i) => {'),
        end2 = s2.indexOf('\n  }\n}', start2);
      let common = s2
        .slice(start2, end2)
        .replace(
          '(frame.order ??= [])[shift(i)] = child.order?.[i] ?? i;',
          'if (fallbackOrder || child.order) (frame.order ??= [])[shift(i)] = child.order?.[i] ?? i;',
        );
      writeFileSync(
        `${scratch}/modules/survey-drawing.ts`,
        `import {mul} from '../packages/core/src/geom.ts';\nexport function append(tree:any,frame:any,child:any,entry:any,shift:any,group:any,world:any,fallbackOrder:boolean){\n${common}\n}`,
      );
      for (const [f, s, start, end, flag] of [
        [f1, s1, start1, end1, 'false'],
        [f2, s2, start2, end2, 'true'],
      ] as const)
        writeFileSync(
          `${scratch}/${f}`,
          `import {append} from '../../survey-drawing.ts';\n` +
            s.slice(0, start) +
            `append(tree,frame,child,entry,shift,group,world,${flag});` +
            s.slice(end),
        );
    };
    await run('draw-node-resource-remap', drawing);
    await run('all-duplicates', () => {
      pointers();
      clones();
      drawing();
    });
    await run('positive-duplicates', () => {
      pointers();
      clones();
    });
    if (process.env.SURVEY_GUARDED === '1') sizeReport('proposed-gates');
  } else if (process.argv[2] === 'shapes') {
    const groups = new Map<string, any[]>();
    const literal = (n: ts.Node): boolean =>
      ts.isStringLiteral(n) ||
      ts.isNumericLiteral(n) ||
      [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(
        n.kind,
      ) ||
      (ts.isPrefixUnaryExpression(n) && literal(n.operand)) ||
      (ts.isArrayLiteralExpression(n) && n.elements.every(literal)) ||
      (ts.isObjectLiteralExpression(n) &&
        n.properties.every((p) => ts.isPropertyAssignment(p) && literal(p.initializer)));
    for (const [f, s] of original)
      if (f.startsWith('modules/')) {
        const ast = parsed(f, s);
        const walk = (n: ts.Node) => {
          if (
            ts.isObjectLiteralExpression(n) &&
            n.properties.some((p) => ts.isPropertyAssignment(p) && p.name.getText(ast) === 'k') &&
            literal(n)
          ) {
            const key = n.getText(ast).replace(/\s+/g, '');
            const list = groups.get(key) ?? [];
            list.push({ f, start: n.getStart(ast), end: n.end, text: n.getText(ast) });
            groups.set(key, list);
          }
          ts.forEachChild(n, walk);
        };
        walk(ast);
      }
    const selected = [...groups.values()]
      .filter((g) => new Set(g.map((x) => x.f.split('/')[1])).size > 1)
      .sort((a, b) => b[0].text.length * b.length - a[0].text.length * a.length);
    const apply = (groups: any[][]) => {
      const changes = new Map<string, any[]>(),
        defs: string[] = [];
      groups.forEach((g, i) => {
        defs.push(`export const shape${i}=()=>(${g[0].text});`);
        for (const c of g) {
          const list = changes.get(c.f) ?? [];
          list.push({ ...c, text: `shape${i}()` });
          changes.set(c.f, list);
        }
      });
      writeFileSync(`${scratch}/modules/survey-shapes.ts`, defs.join('\n'));
      for (const [f, list] of changes) {
        const filtered = list.filter(
          (c) => !list.some((other) => other !== c && other.start <= c.start && other.end >= c.end),
        );
        const names = [...new Set(filtered.map((c) => c.text.replace('()', '')))];
        writeFileSync(
          `${scratch}/${f}`,
          `import {${names.join(',')}} from '${'../'.repeat(f.split('/').length - 2)}survey-shapes.ts';\n` +
            edits(original.get(f)!, filtered),
        );
      }
    };
    for (const g of selected.slice(0, 12)) {
      reset();
      apply([g]);
      const bytes = await measure();
      results.push({
        shape: g[0].text,
        occurrences: g.map((x) => x.f),
        bytes,
        saving: base - bytes,
      });
      console.log(g[0].text, base - bytes);
    }
    reset();
    apply(selected);
    results.push({ name: 'combined', count: selected.length, bytes: await measure() });
  } else if (['attribution', 'tables'].includes(process.argv[2])) {
    for (const m of entries) {
      const owner = webOwners[m.name],
        candidates: any[] = [];
      for (const [f, s] of original)
        if (f.startsWith(`modules/${owner}/`)) {
          const ast = parsed(f, s);
          const walk = (n: ts.Node) => {
            if (process.argv[2] === 'tables') {
              if (
                (ts.isObjectLiteralExpression(n) || ts.isArrayLiteralExpression(n)) &&
                (ts.isVariableDeclaration(n.parent) || ts.isPropertyAssignment(n.parent)) &&
                !/^(base|.*SVG|.*Module)$/.test(n.parent.name.getText(ast)) &&
                n.end - n.getStart(ast) > 150
              ) {
                candidates.push({
                  f,
                  start: n.getStart(ast),
                  end: n.end,
                  name: n.parent.name.getText(ast),
                  line: ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1,
                  length: n.end - n.getStart(ast),
                  replacement: ts.isObjectLiteralExpression(n) ? '{}' : '[]',
                });
              }
              ts.forEachChild(n, walk);
              return;
            }
            if (
              (ts.isFunctionDeclaration(n) ||
                ts.isMethodDeclaration(n) ||
                ts.isArrowFunction(n) ||
                ts.isFunctionExpression(n)) &&
              n.body &&
              n.body.end - n.body.getStart(ast) > 300
            ) {
              const name =
                (n as any).name?.getText(ast) ??
                (ts.isVariableDeclaration(n.parent) || ts.isPropertyAssignment(n.parent)
                  ? n.parent.name.getText(ast)
                  : 'callback');
              candidates.push({
                f,
                start: n.body.getStart(ast),
                end: n.body.end,
                name,
                line: ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1,
                length: n.body.end - n.body.getStart(ast),
                replacement: ts.isBlock(n.body) ? '{}' : 'undefined',
              });
              return;
            }
            ts.forEachChild(n, walk);
          };
          walk(ast);
        }
      const entry = `${scratch}/packages/web/src/${m.name}.ts`,
        entryBase = gz(await bundle(entry));
      const probes = [];
      for (const c of candidates
        .sort((a, b) => b.length - a.length)
        .slice(0, process.argv[2] === 'tables' ? 2 : 4)) {
        const s = original.get(c.f)!;
        writeFileSync(`${scratch}/${c.f}`, edits(s, [{ ...c, text: c.replacement }]));
        try {
          const bytes = gz(await bundle(entry));
          probes.push({ ...c, bytes, saving: entryBase - bytes });
        } finally {
          writeFileSync(`${scratch}/${c.f}`, s);
        }
      }
      results.push({ module: m.name, entryBase, probes });
      console.log(m.name, probes.map((p) => `${p.name}:${p.saving}`).join(','));
    }
  }
} finally {
  guardedTrial = false;
  reset();
}
mkdirSync(out, { recursive: true });
writeFileSync(
  `${out}/${process.argv[2]}${process.env.SURVEY_GUARDED === '1' ? '-guarded' : process.env.SURVEY_RELOCATE === '1' ? '-relocated' : ''}.json`,
  JSON.stringify({ base, results }, null, 2) + '\n',
);
