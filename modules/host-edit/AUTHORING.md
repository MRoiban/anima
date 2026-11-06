## Editing page data (host-edit module)

Import `@anima-format/web/data`, `@anima-format/web/host`, and
`@anima-format/web/host-edit` (either host load order). Await the imports, then
`await customElements.get('anima-icon').ready`. This is module registration readiness;
`await icon.ready` waits for that icon's document.

```js
icon.data.bind(icon.data.defaultInstance());
const tracks = icon.data.list('$tracks');
const first = tracks.at(0);
icon.data.batch(() => {
  tracks.add({ title: 'Next' });
  tracks.insert(0, { title: 'Intro' });
});
// Changes appear on the next frame, or player.step(0) for manual playback.
// After that frame:
tracks.swap(0, 1);
tracks.remove(first); // follows the item identity, even after a move
icon.data.color('$accent').set([217, 119, 87, 255]);
console.log(icon.data.color('$accent').rgba, icon.data.color('$accent').hex);
icon.data.enum('$mood').index = 1;
console.log(icon.data.enum('$mood').values);
```

`tracks.length` is read-only; `tracks.at(i).string('title')` is a typed nested handle.
Call the nested accessor again after reordering to obtain its current property path.
To insert a shared or mixed-model item, pass `icon.data.instance('named')` or the record returned
by `icon.data.create('Track', values)`. `defaultInstance()` discovers but does not bind the default.

List helpers preserve stored item objects for the lists module's repeat matching. Whole-list
`.set()` remains a replacement. In a step mixing helpers with ordinary host `.set()` writes,
helpers apply first; use separate steps when the order matters.

With components imported, `icon.instance('badge').data` addresses the existing child's models.
`<anima-icon component="badge" src="icons.ani">` selects a component as root. Set the component
attribute before loading; change it and reload to select another component.

For images, point the property at a declared image asset first, then:

```js
await icon.data.image('$cover').set('/images/cover.png');
await icon.data.image('$cover').set(fileBlob);
```

These promises wait for decode. The next frame applies the decoded replacement to uses of the
current asset in that icon; the data value remains its asset name. Failed decode rejects with a
`DataError`. Use `assetPolicy = 'any'` (assets module) for external URLs. Core-only consumers can
set declared asset names, while URLs and Blobs require the web consumer.

For typed constructor readiness, import `AnimaIcon` from `@anima-format/web/host-edit` and await
`AnimaIcon.ready` after all desired module imports. The base web constructor has no preload cost.
