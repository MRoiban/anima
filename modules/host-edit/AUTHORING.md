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
`.set()` remains a replacement. Helpers and ordinary host `.set()` writes apply in call order in the same step.

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

Global models expose their named slots through `icon.data.globals()`. Replace one with
`icon.data.setGlobal('settings', icon.data.create('Settings', { volume: 0.5 }))`; the following
step updates existing root/child handles and bindings together. The target must be an authored
instance of a model declared `global="true"`; a replacement must come from this player's API.

With host-edit loaded, icons using the same absolute src, resolver function, asset policy and
component selection share successful source parsing; matching resolver/policy also shares initial
image decoding. Set assets and
assetPolicy before src. Resolvers shared by identity should resolve the same resource for each
consumer. Writes and replacement images remain per-icon. `icon.loadModel(model)` (or host-edit's `icon.load(model)`) accepts an
already compiled Model and creates fresh player state; asset-bearing documents keep local models
and asset records while using cached parsed data and initial decodes. Configure the receiving
host's `assets`, `assetPolicy` and source base before `loadModel`; a shared model does not carry
another host's resolver or URL context.
