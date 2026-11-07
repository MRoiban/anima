# Page authors: data

Load `anima-icon.js`, `anima-data.js` and `anima-host.js` as module scripts, plus
`anima-markup-hooks.js` when using inline AniML. Data and host can arrive in either order.
Add `auto-bind` to select the default model instance, or call `icon.data.bind('main')`.
Wait for `anima:load` before accessing data. A retained API/handle belongs to that load;
reacquire it after reload. Destroying an icon stops its scheduler.

```js
const api = icon.data;
const score = api.number('$score');
const unsubscribe = score.on('change', (value) => {
  output.textContent = String(value);
});
api.batch(() => {
  score.set(10);
  score.set(12);
  api.string('$label').set('Ada');
});
// The next animation step delivers 12 once.
unsubscribe();
const next = api.create('Score', { score: 4, label: 'Grace' });
api.bind(next);
```

Use `models()` to discover properties and enum members, `instances()` for named
instances, `get('$main:score')` for an explicit read. `.boolean`, `.color`, `.enum`,
`.list`, `.image`, `.font` work like `.number`. `.trigger('$pulse').fire()` sends a
signal. Catch `DataError` to inspect `code`, `pointer`, `message`, `hint`.

`examples/page.html` is a self-contained page using the built browser bundles.
This module-owned section is ready to include in docs/AUTHORING.md; the task's file
ownership excludes that shared file.
