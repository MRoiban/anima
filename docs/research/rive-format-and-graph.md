# Rive runtime: file format, object model, component graph, renderer

Research notes for the design of **Anima** (`.ani`). Everything here is a description, in my own words, of how Rive's C++ runtime works. No Rive code is copied. Identifiers and `file:line` citations point into the clone.

- **Repo:** https://github.com/rive-app/rive-runtime
- **Commit:** `1c8f5d3fe8d1c6bca1cfd7e40367b23aff9dba3f` (shallow clone, `--depth 1`)
- **License:** MIT, "Copyright (c) 2020 Rive" (`LICENSE`). I checked the file.
- **Clone path:** `a local shallow clone of rive-app/rive-runtime`. I read it only. Nothing in it was built or run.
- **Runtime file version at this commit:** major 7, minor 5 (`include/rive/file.hpp:94,110`).

> **Caveat about `dev/defs`.** At this commit the JSON type definitions are **not in this repo**. `dev/core_generator/lib/src/configuration.dart` points the generator at `../../../dev/defs/`, which is the root of a larger monorepo. A comment there says the defs now live next to the editor source and were removed from this runtime repo. So everything I say about the def schema comes from the generator code (`definition.dart`, `property.dart`, `key.dart`) and from its output (`include/rive/generated/**`, 364 `*_base.hpp` files). I did not read any actual JSON def.

---

## 1. Binary `.riv` file format

### 1.1 Primitive encodings (`src/core/binary_reader.cpp`, `include/rive/core/reader.h`)

- **varuint** is LEB128: 7 bits per byte, high bit means "more", little-end first. `decode_uint_leb` (`reader.h:20-47`) is hardened. It fails (returns 0 bytes consumed) when:
  - the buffer ends first;
  - the shift would reach 64;
  - the tenth group carries bits past bit 63.

  A 32-bit variant exists (`reader.h:54-80`).
- `readVarUintAs<T>()` (`binary_reader.hpp:49-58`) reads a 64-bit varuint and range-checks it against `T`. If it does not fit, it sets a sticky `intRangeError` and moves the cursor to the end.
- **Errors are sticky and silent.** `overflow()` / `intRangeError()` set a flag and jump the cursor to the end of the buffer (`binary_reader.cpp:27-37`). From then on every read returns 0 or empty, and `reachedEnd()` is true. Callers check `didOverflow()` / `hasError()` at checkpoints instead of after every read. This style is simple and safe.
- **Strings and bytes** are a varuint length followed by raw bytes. The length is checked against the remaining bytes *before* anything is allocated (`binary_reader.cpp:52-98`). The tests note that before this check, a crafted 2^40 length aborted the process and a UINT64_MAX length wrapped around.
- **"double" is float32 on the wire.** It is read as 4 little-endian bytes (`core_double_type.cpp`). Only the editor/tools wire may carry float64.
- **color** is a fixed 4-byte uint32 ARGB (`core_color_type.cpp`).
- **bool** is one byte, where 1 means true (`core_bool_type.cpp`).
- **int** (signed) is a zigzag-encoded varuint. It deliberately shares the uint "field id" so that a runtime that does not know the property can still skip it (`core_int_type.hpp:11-35`).
- **Id** (references such as `parentId`) is a single varuint on the runtime wire. It is an index into the artboard's flat object list. In the editor's collaboration wire format it is a `(client, object)` pair of varuints (`core_id_type.hpp:9-50`, `core_id_type.cpp`). Rive keeps stable authoring identity and runtime index identity apart, and the export step flattens one into the other.

### 1.2 Header (`include/rive/runtime_header.hpp:47-106`)

The header is laid out in this order:

1. The 4-byte fingerprint `"RIVE"`.
2. varuint **major** version, then varuint **minor** version.
3. varuint64 **fileId**, which may be 0.
4. The **property-type table of contents (ToC)**:
   - First, a list of varuint property keys, ended by a 0.
   - Then, for each listed key in order, a **2-bit field-type class**. The reader reads a fresh little-endian uint32 whenever its bit counter reaches 8, and takes 2 bits per key from it. So it uses only the low 8 bits of each uint32: **4 keys per 4 bytes**, and 24 bits are wasted. That is an odd but harmless legacy layout (`runtime_header.hpp:87-103`).

The four possible classes are:

| Class | Meaning | Field types |
|---|---|---|
| 0 | uint / varuint | uint, int, id, enum, fractional index |
| 1 | length-prefixed | string, bytes |
| 2 | 4-byte float | double |
| 3 | 4-byte color | color |

`CoreBoolType::id` is 4, which does not fit in 2 bits. The writer side is not in this repo, so I am inferring here: a bool's single 0/1 byte is also a valid one-byte varuint, so the exporter presumably records bools as class 0.

**Version policy** (`src/file.cpp:456-470`):

- A **major** mismatch fails the import with `unsupportedVersion`.
- A **minor** version never rejects a file. Instead it is pushed onto the `ImportStack` (`import_stack.hpp:108-116`), and individual objects read it inside `import()` to switch behaviour. The comments on `File::minorVersion` list examples: 7.2 changed image fit, 7.3 changed layout rotation, 7.4 changed fitted font size, 7.5 made images hit-testable. Each minor bump marks a *semantic* change for one feature, and the old behaviour is kept for older files.

### 1.3 Object stream (`src/file.cpp:254-336`, `readRuntimeObject`)

After the header the file is **one flat list of objects** that runs to EOF. There is no nesting on the wire and no length prefix per object. Each object is written as:

1. varuint **typeKey**;
2. zero or more pairs of varuint **propertyKey** followed by a **value** encoded by that property's field type;
3. varuint **0** as the terminator. Property keys below 3 are reserved (`definition.dart:1490`), and 0 means "end of object".

Reading works like this:

- `CoreRegistry::makeCoreInstance(typeKey)` builds the object. It returns `nullptr` if this runtime does not know the type.
- For each property, the object's generated `deserialize(key, reader)` tries to consume it, walking up the `Super` chain.
- If the object is unknown, or the key is unknown to the object, the runtime works out how to **skip** the value:
  - first it asks `CoreRegistry::propertyFieldId(key)`, which covers keys this runtime knows but this object type does not;
  - then it asks the header ToC, which covers keys newer than this runtime.

  It then reads and discards one value of that class.
- **If neither source knows the key, the file is now unreadable**, because there is no length to skip by. The import fails with `malformed` (`file.cpp:286-296`). Tests in `tests/unit_tests/runtime/unknown_property_import_test.cpp` document two bugs that used to happen here:
  - The skip switch once had no bool case. The value byte was then read as the next key, the rest of the file was silently misparsed, and the import still "succeeded".
  - Dropping an object with an untyped key and carrying on read garbage as later objects.

  Both are what a fragile skip-by-type scheme risks.
- **Unknown typeKey (a whole object):** all its properties are skipped through the ToC, and the object becomes `nullptr`. `importStack.readNullObject()` then gives the open ArtboardImporter an **empty slot** (`artboard_importer.cpp:49-53`), so every later index still lines up. This is the forward-compatibility path: an old runtime can load a file that has new object types and simply leaves them out.

**Lesson:** forward compatibility depends on the ToC being complete and on every value being skippable from a 2-bit class. Any value whose size cannot be found from its class breaks the stream. The newer "manifest" sections (`include/rive/manifest_sections.hpp`) use a different scheme, `sectionId, sectionSize, payload`, with a per-section version. A newer exporter's sections are skipped by length rather than by type. Length prefixes are the sturdier design.

### 1.4 Hierarchy: parent/child by index

- Every `Component` has `parentId`, property key 5, of type Id (`generated/component_base.hpp:33,114`). Its value is the **index of the parent in the current artboard's object list**. The default value is 0, which is the artboard itself, at slot 0 (`component_base.hpp:39`). So any top-level child can leave the property out.
- **Slots and indices** (`file.cpp:583-597`):
  - Objects that "claim an artboard slot" (`Core::claimsArtboardSlot`, `core.hpp:149`, overridden for Component and a few others) get the next index **before** `import()` runs.
  - If `import()` then fails, the slot is emptied but **kept** (`releaseSlot`), so later ids still point at the right objects.
  - Unknown objects also keep their slot (see 1.3).
  - **The exporter numbers objects in stream order, and the importer has to reproduce exactly that numbering.**
- Indices start over at each Artboard object. Ids are artboard-local.
- Other references use the same idea: `DrawTarget.drawableId`, `TargetEffect.targetId`, and keyed animation object ids (another agent covers animation).
- **File-level** references are indices into separate file-global lists:
  - `FileAsset.assetId` indexes the backboard's asset list (`backboard_importer.cpp:283-292`).
  - Nested-artboard references index the artboards.
  - Converters and interpolators index their own lists.
- **Vertex order is child order.** A path's vertices are separate objects (`StraightVertex`, `CubicMirroredVertex`, …). Each has `parentId` pointing at its path and adds itself to the path's vertex list in file order (`src/shapes/path_vertex.cpp`). A 4-point path is therefore 5 objects, and each vertex carries its own typeKey, parentId and x/y keys. That is very verbose next to an SVG `d` string.

### 1.5 ImportStack and importers (`include/rive/importers/*`, `file.cpp:695-1015`)

- `ImportStack` (`import_stack.hpp:20-123`) maps a **typeKey to the "latest" open importer of that type**, and keeps the order in which importers were added.
  - When a new importer of the same type arrives, the old one is **resolved and replaced** (`makeLatest`, lines 33-72).
  - At EOF, everything still open is resolved in reverse order (`resolve`, lines 74-94).
- There is no explicit nesting on the wire. **Context is implied by stream order.** For example:
  - A `KeyedProperty` attaches to the latest `LinearAnimationImporter`.
  - A `FileAssetContents` (the raw bytes) attaches to the latest `FileAssetImporter`.
  - A `Component` requires a latest `ArtboardImporter` (`component.cpp:137-156`).

  A missing required importer gives `MissingObject`, or `malformed` for structural cases such as `KeyedProperty` or `StateMachineLayer` (`file.cpp:722-746`).
- Importers include Backboard, Artboard, LinearAnimation, KeyedObject, KeyedProperty, StateMachine, Layer, LayerState, StateTransition, Listener, FileAsset, ViewModel, Enum, DataBindPath and others (`file.cpp:695-950`). Some typeKeys are folded together: all state kinds register as `LayerState::typeKey`, so "latest state" works whatever the subtype.
- `ArtboardImporter::resolve()` runs `Artboard::validateObjects()` and then `Artboard::initialize()` (`artboard_importer.cpp:40-47`). The whole graph is wired at that point, once the artboard's objects have all been read.
- Odd special case: a `DataBind` binds to the **object just before it** in the stream (`lastBindableObject`, `file.cpp:572-580`). So position in the stream carries meaning.

### 1.6 Assets: embedded vs referenced/CDN (`src/assets/*`, `src/importers/file_asset_importer.cpp`)

- `FileAsset` (typeKey 103) has subtypes Image (105), Font (141), Audio (406), Blob (649), Script, Shader and others. Its properties are `name`, `assetId` (204), `cdnUuid` (359, 16 bytes, shown in a byte-swapped GUID order by `cdnUuidStr`) and `cdnBaseUrl` (362).
- **Embedded:** a `FileAssetContents` object (106) holding a `bytes` blob (212), plus an optional `signature` (911), comes right after its asset in the stream.
- **Resolve order** (`file_asset_importer.cpp`):
  1. If the host supplied a `FileAssetLoader`, it gets the first chance (`loadContents(asset, inBandBytes, factory)`). It may load from a CDN, swap the asset, or load asynchronously.
  2. Otherwise, any in-band bytes are decoded through the Factory (`decodeImage`).
  3. An asset that resolves to nothing is **not an error**.
- So the runtime never fetches anything itself; CDN, local or custom loading is the host's job (`include/rive/file_asset_loader.hpp`, `relative_local_asset_loader.hpp`). `uniqueFilename()` gives a stable `name-<assetId>.ext` key for out-of-band assets.
- `factory->reserveForImport(bytes.size())` lets a backend pre-size for embedded asset bytes.
- Scripts and shaders use a signed-content envelope: a flags byte holding a version and an isSigned bit, then an optional 64-byte signature, then the content (`include/rive/signed_content_header.hpp`). A file can be imported with `requireSignedScripts`, which drops unsigned scripts.

---

## 2. Code-generated core object model

### 2.1 Pipeline

`dev/generate_core.sh` compiles and runs a Dart program (`dev/core_generator/lib/main.dart`). It walks the defs directory recursively, makes a `Definition` per JSON file, and then emits:

- `include/rive/generated/**/<name>_base.hpp` and `src/generated/**` for runtime types. These are regenerated every time; old output is deleted first (`definition.dart:1551-1575`).
- A hand-written concrete subclass stub (`include/rive/<name>.hpp`), but **only if it does not exist yet**. Hand logic lives there and survives regeneration. This is the classic "generated base plus hand-written leaf" split.
- `include/rive/generated/core_registry.hpp` (about 7,000 lines), which holds:
  - `makeCoreInstance(typeKey)`;
  - typed setters and getters by key: `setDouble`, `setUint`, `setColor`, `setString`, `setBool`, `setId`, `setCallback`, `getX…`;
  - `propertyFieldId(key)`, used to skip values;
  - `isInterpolatableUint`, `isSignedInt`, `isCallback`;
  - `propertyOwnerTypeKey(key)`;
  - `objectSupportsProperty(obj, key)`.

  Animation and data binding drive *any* property through these generic setters, by propertyKey alone.
- A typeKey-to-parent-typeKey table behind `Core::hasAncestor`, which makes `is<T>()` a table walk with no C++ RTTI (`core.hpp`, `definition.dart:1634-1660`).
- Editor-only types and properties (`"runtime": false`) are emitted under `#ifdef WITH_RIVE_EDITOR` into a separate tree, so the shipped runtime does not carry them.

### 2.2 Def schema, inferred from the generator

Per type:

- `name`
- `key: {int, string}`
- `extends: "<other def path>"` (single inheritance)
- `abstract`
- `runtime`
- `editorOnly`
- `mixin` / `mixins`
- `properties: { <name>: {...} }`

Per property:

- `type`, `typeRuntime` (for example an `Enum<X>` stored as `uint`)
- `key: {int, string, alternates: [{int,string}]}`
- `initialValue`, `initialValueRuntime`
- `animates`, `interpolates`, `bindable`
- `nullable`, `virtual`, `pureVirtual`
- `overrideGet` / `overrideSet`
- `encoded` (bytes decoded by a hand-written `decodeX(Span)`)
- `group`, `description`, `editorOnly`, `runtime`, `coop`
- `passthrough` / bitmask passthrough (several bools packed into one stored flags field)
- `sidecar` (rarely used fields moved into a lazily allocated struct to save memory)

(`property.dart:60-232`, `definition.dart:174-260`)

### 2.3 Keys

- **typeKeys are unique across all types.** **propertyKeys are unique across the *whole schema*, not per type.** The generator rejects duplicates of either (`definition.dart:1491-1528`). Examples:
  - `Component.name` = 4, `parentId` = 5
  - `Node.x` = 13, `y` = 14
  - `TransformComponent.rotation` = 15, `scaleX` = 16, `scaleY` = 17
  - `WorldTransformComponent.opacity` = 18
  - `Fill.fillRule` = 40, `Stroke.thickness` = 47
  - `TrimPath.start` = 114, `end` = 115

  Because keys are global, the ToC and the skipping logic need no type context. A single `propertyFieldId(key)` table is enough, and a key on its own identifies its owning type (`propertyOwnerTypeKey`).
- Keys are written as integers into the JSON. The generator finds the current maximum ids, so a new type or property can take the next free number. The JSON is the source of truth, and **a key is never reused**.
- **Alternates:** an old key can stay an alias of a property. For example `Node.xArtboard` = 9 and `yArtboard` = 10 lead to the same `x()`/`y()` setters in the registry (`core_registry.hpp:2660-2666`). This keeps old animation keys working after a property moves up the class tree.
- At this commit the highest typeKey is about 1101 and the highest propertyKey about 1107, over 681 runtime properties. Keys are 16-bit in practice (`uint16_t`).

### 2.4 What a generated base looks like (`include/rive/generated/node_base.hpp`)

- `static const uint16_t typeKey`, and `coreType()` returns it.
- A `<name>PropertyKey` constant for each property.
- Protected storage that holds the initial value.
- A getter, and a setter that:
  1. returns early if the value is unchanged;
  2. calls editor hooks (compiled out of the runtime);
  3. stores the value;
  4. calls the virtual `<name>Changed()`;
  5. calls `notifyPropertyChanged(key)`, which pushes to data-bind observers through an intrusive list (`core.hpp`).
- `copy(const XBase&)`, used for cloning instances.
- `deserialize(key, reader)`: a switch over the type's own keys that falls back to `Super::deserialize`.
- Empty virtual `xChanged()` hooks. The hand-written subclass overrides them to **add dirt**. For example `Node::xChanged()` calls `markTransformDirty()` (`src/node.cpp:9`).

The `Core` base (`include/rive/core.hpp`) provides `coreType`, `isTypeOf`/`is<T>`/`as<T>`, `deserialize`, `clone`, and these lifecycle hooks:

- `validate(CoreContext*)`
- `onAddedDirty(ctx)`, where references may be looked up but not assumed resolved
- `onAddedClean(ctx)`, where the whole graph is linked
- `import(ImportStack&)`
- `claimsArtboardSlot`

`CoreContext` (the Artboard) provides `resolve(Id) -> Core*`.

### 2.5 Why this helps compatibility and tooling

- **One schema drives everything:** Dart editor classes, C++ runtime classes, the registry, the ToC, the animation setters and the data-binding setters. Adding a property is a schema edit plus an optional `Changed()` override.
- **Old runtime, new file:** unknown types and keys are skipped through the ToC, and indices stay aligned through null slots.
- **New runtime, old file:** missing properties keep their schema defaults, and minor-version checks guard semantic changes. Defaults are not written, which keeps files small. I infer this from the defaults, since the writer is not in this repo.
- Generic access by key (`CoreRegistry::setDouble(obj, key, v)`) means keyframes, data binds, scripting and tools need no per-type code.
- Separate editor-only and runtime-only builds keep the shipped runtime lean, while the editor can share the same C++ core.

---

## 3. Component graph and update cycle

### 3.1 Class layers (simplified)

| Class | Adds | Notes |
|---|---|---|
| `Core` | | |
| `Component` (10) | name, parentId, `m_Dirt`, graph order, dependents | |
| `ContainerComponent` (11) | `m_children` | |
| `WorldTransformComponent` (91) | opacity, worldTransform | |
| `TransformComponent` (38) | rotation, scaleX/Y, local transform, constraints | |
| `Node` (2) | x, y | |
| `Drawable` (13) | blendMode, drawableFlags, `prev`/`next` draw links | |
| `Shape` (3) | | also a `ShapePaintContainer`; owns a `PathComposer` |
| `Path` (12) | pathFlags, isHole | children are vertices; a Node subtype, so it has its own transform |
| `PointsPath` (16) | isClosed | |
| `ParametricPath` | width, height, originX/Y | concrete: `Rectangle` (7), `Ellipse` (4), `Triangle` (8), `Polygon` (51), `Star` (52) |

Parametric paths synthesise their vertices as member objects that are not serialized (`src/shapes/ellipse.cpp`).

Paint objects:

- `ShapePaint`: `Fill` (20) and `Stroke` (24). It is a child of a ShapePaintContainer (Shape, Artboard, LayoutComponent, text styles…; `shape_paint_container.cpp`).
- A ShapePaint has exactly one **mutator** child: `SolidColor` (18), `LinearGradient`, `RadialGradient` or `AngularGradient`. Gradients have `GradientStop` children. If no compatible mutator exists, the paint is quietly not added (`shape_paint.cpp:13-49`).
- **Stroke effects** are children of a Stroke or Fill: `TrimPath` (47), `DashPath` (506) with `Dash` (507) children, `Feather` (533), `GroupEffect`/`TargetEffect`.

### 3.2 Loading and wiring sequence (`Artboard::initialize`, `src/artboard.cpp:396-706`)

1. **`validateObjects()`** (`artboard.cpp:315-370`). It calls `validate()` on every object, **repeating until nothing changes (at most 100 rounds)**. Invalid objects are taken out of `m_Objects` (the slot becomes null). They are kept alive until the artboard is destroyed, in case something still points at them. Because the loop repeats, an object whose parent was just removed is removed in the next round. `Component::validate` only requires that `parentId` resolves to a `ContainerComponent` (`component.cpp:31-35`). `DrawTarget::validate` also requires its `drawableId` to resolve to a `Drawable` (`draw_target.cpp`).
2. **`onAddedDirty` for every object.** In runtime builds each component sets `m_Artboard` to the context, resolves its parent, and calls `parent->addChild(this)` (`component.cpp:100-110`). This step **dereferences the parent without a check**; it depends entirely on step 1. Type-specific steps also run here, for example a vertex registers with its parent path.
3. Animations and state machines run `onAddedDirty`. If the artboard has none, a state machine is generated automatically.
4. **`onAddedClean` for every object**, now that multi-level lookups are possible:
   - a Path walks up to find its Shape and calls `shape->addPath` (`path.cpp:80-101`);
   - a TrimPath registers with its effects container;
   - a ShapePaint registers with its container.

   Lists are also built here: nested artboards, joysticks, `DrawRules`, and the `AdvancingComponent`s.
5. **`buildDependencies()` for every Component.** Each one says which other components it depends on:
   - a TransformComponent depends on its parent (`transform_component.cpp:46-52`);
   - a PointsPath also depends on its skin;
   - the PathComposer depends on the Shape and on each of its Paths (`path_composer.cpp:19-27`);
   - a Stroke, or a Fill that has effects, depends on the container's path builder.

   During the same loop, every Drawable is appended to `m_Drawables` **in file order**, and each takes its nearest ancestor's `DrawRules`. Clipping shapes and layer masks are collected too.
6. **`sortDependencies()`** (`artboard.cpp:1486-1507`). `DependencySorter` does a DFS topological sort from the Artboard root over the *dependents* edges (`src/dependency_sorter.cpp`). It appends nodes in finish order and reverses once at the end, avoiding O(n²) inserts. On a cycle it prints "Dependency cycle!" and **stops**, leaving a partial order. Each component gets `m_GraphOrder` set to its index in the order. Instances replay their source artboard's order instead of sorting again.
7. Draw-target ordering is sorted in a second pass (described in 3.5).

### 3.3 Dirt flags (`include/rive/component_dirt.hpp`)

`ComponentDirt` is a 16-bit mask:

| Flag | Meaning |
|---|---|
| `Collapsed` | subtree skipped, used by Solo |
| `Dependents` | |
| `Components` | "an update is needed", set on the artboard whenever anything is dirty |
| `DrawOrder` | |
| `Path` | shares its bit with `TextShape` and `Skin` |
| `Vertices` | |
| `Transform` | local transform |
| `WorldTransform` | |
| `RenderOpacity` | |
| `Paint` | |
| `Stops` | |
| `LayoutStyle` | |
| `Bindings` | |
| `NSlicer` | |
| `ScriptUpdate` | |
| `Clipping` | |
| `Filthy` | every flag except Collapsed |

Several bits are **reused** by component kinds that never meet, to fit in 16 bits.

`Component::addDirt(value, recurse)` (`component.cpp:113-135`):

1. If the flags are already set, it returns at once. This dedupe is what keeps cascades cheap.
2. Otherwise it ORs the flags in and calls `onDirty`.
3. It calls `artboard->onComponentDirty(this)`, which sets `Components` on the artboard and **lowers `m_DirtDepth` to this component's graph order** (`artboard.cpp:1750-1771`).
4. With `recurse` set, it pushes the same dirt to every dependent.

### 3.4 Update and advance

- **`Artboard::advance(dt)`** (`artboard.cpp:2796-2810`):
  1. polls async work;
  2. calls `advanceComponent(dt)` on every `AdvancingComponent` (nested artboards, scripted objects…), then advances data binds;
  3. calls `updatePass()`.
- **`updatePass`** (`2725-2772`) updates data binds, syncs layout styles, applies joysticks, and calls `updateComponents()`, possibly more than once.
- **`updateComponents()`** (`2355-2419`):
  - While the artboard still has `Components` dirt, and for at most 100 steps, it walks `m_DependencyOrder` in order.
  - Collapsed runs are skipped in jumps of precomputed length.
  - For each dirty component it copies the dirt, **clears it, then calls `update(dirt)`**.
  - If an update dirtied something *earlier* in the order (`m_DirtDepth < i`), it breaks out and starts the walk again.

  This gives a single pass in topological order, plus recovery when constraints or layout push dirt back upstream.

**How transforms flow** (`transform_component.cpp`, `world_transform_component.cpp`):

- A setter on `x`, `y`, `rotation` or `scale` leads to `markTransformDirty()`. That adds `Transform` without recursing, then calls `markWorldTransformDirty()`, which adds `WorldTransform` **recursively to dependents** (the children).
- `update(dirt)`:
  - on Transform, it rebuilds the local matrix as rotation, then translate, then scale (`updateTransform`, lines 63-69);
  - on WorldTransform, it sets world = parentWorld × local and then applies constraints;
  - on RenderOpacity, it sets opacity × parent's `childOpacity()`.

  Opacity changes add `RenderOpacity` recursively.

**How paths flow** (`path.cpp:448-510`, `shape.cpp:112-127`, `path_composer.cpp`):

- A vertex x/y change, a parametric width/height/origin change, a corner radius change, or `isHole` calls `Path::markPathDirty()`. That adds `Path` dirt and tells the Shape once per cycle (`shapePathChanged`).
- `Shape::pathChanged()` adds `Path` dirt (recursively) to the **PathComposer**. It also invalidates cached length and bounds, constraints, and the **stroke effects** (trim and dash caches are cleared).
- A Path's `WorldTransform` dirt also tells the shape. This matters because the composed path is built from each sub-path's transform relative to the shape.
- `Path::update` rebuilds its `RawPath` (`buildPath`) when it has Path, NSlicer, or deformer-plus-world dirt, and bumps `geometryVersion`.
- **Lazy optimisation:** if the shape cannot be seen (render opacity 0, not a clip, no skin), the rebuild is **deferred** with a `m_deferredPathDirt` flag (`Path::canDeferPathUpdate`, `Shape::canDeferPathUpdate`). It happens once the shape becomes visible again.
- **PathComposer::update** builds up to three composed paths:
  - a **local path**, the sub-paths in shape space, used by fills and by strokes with `transformAffectsStroke`;
  - a **world path**, used by strokes whose width should not scale;
  - a **local clockwise path**, for `FillRule::clockwise`.

  Which ones are needed comes from `pathFlags` gathered from the paints. The composer compares each sub-path's (relative transform, geometryVersion, hidden) inputs against the previous frame within a float tolerance, and **skips the rebuild if nothing really changed** (`localInputsChanged`, lines 34-93).
- Effects: `TrimPath` measures contours (`ContourMeasureIter`), cuts in sequential or synchronized mode, and caches the contours until invalidated (`trim_path.cpp`). `DashPath` is similar. Stroke and fill paint properties (thickness, cap, join, colour) add `Paint` dirt, which updates the `RenderPaint`.

### 3.5 Draw order (`Artboard::sortDrawOrder`, `artboard.cpp:768-1004`; `src/draw_target.cpp`)

- The base order is the drawables in **file order** (step 5 above). They are joined into a doubly linked list through `prev`/`next`, and `m_FirstDrawable` is then set to the **last** one (line 859). Drawing walks `prev` from there (`drawDrawableRange`, `3212+`). So **objects earlier in the file draw on top**, matching the editor's hierarchy panel.
- **Overrides:** a `DrawRules` (49) component on a node contains `DrawTarget` (48) children. Each target names a `drawableId` and a placement (before or after). The active target (an animatable `drawTargetId`) collects every drawable under that rule into a sub-list. That sub-list is spliced before or after the target drawable. The order between targets comes from a second `DependencySorter` pass over a root `DrawTarget` (`artboard.cpp:650-706`).
- Changing placement or the active target adds `DrawOrder` dirt to the artboard. `Artboard::update` then calls `sortDrawOrder()` again (`artboard.cpp:2231-2237`).
- **Clipping and masks** become **proxy drawables** (clip-start and clip-end markers) inserted into the list. While drawing, the renderer stacks pending clip-starts so it can drop a save/clip/restore that has nothing drawable inside (`drawDrawableRange`). It also counts "empty clips" so content clipped by a hidden or collapsed clip shape is skipped.
- `Shape::draw` (`shape.cpp:157-186`) draws each ShapePaint in order, using the path its `pickPath()` chose and the world transform.

---

## 4. Renderer abstraction (`include/rive/factory.hpp`, `include/rive/renderer.hpp`, `include/rive/command_path.hpp`)

The renderer is **immediate mode**: on every frame the artboard issues save, transform, clip and draw calls.

### 4.1 What a backend must implement (the pure-virtual methods)

**Factory** (`factory.hpp:36-100`):

- `makeRenderPath(RawPath&, FillRule)` (it may take over the RawPath's arrays) and `makeEmptyRenderPath()`
- `makeRenderPaint()`
- `makeLinearGradient(sx,sy,ex,ey, colors[], stops[], n)`
- `makeRadialGradient(cx,cy,r, colors[], stops[], n)`
- `decodeImage(bytes)`
- `makeRenderBuffer(type, flags, size)`, needed only for meshes and images

`makeAngularGradient` has a default that falls back to a solid colour. There are also optional hooks for layer masks, GPU contexts and similar.

**RenderPath** (a `CommandPath`):

- `rewind`, `fillRule`, `moveTo`, `lineTo`, `cubicTo`, `close`
- `addRenderPath(path, transform)`, `addRawPath(rawPath)`

Path verbs are move, line, quad, cubic and close, and match Skia's values (`math/path_types.hpp`). Rive's own geometry is all **cubics**.

**RenderPaint** (`renderer.hpp:182-202`):

- `style` (fill or stroke), `color(ARGB)`, `thickness`, `join`, `cap`
- `blendMode`, `shader(rcp<RenderShader>)`, `shaderTransform`, `invalidateStroke`
- Optional: `strokePosition`, `feather`, `additiveness`, `modulatedImage`

**RenderShader** is an opaque, reference-counted handle with nothing to implement.

**Renderer** (`renderer.hpp:333-460`):

- `save`, `restore`, `transform(Mat2D)`
- `drawPath(path, paint)`, `clipPath(path)`
- `drawImage`, `drawImageMesh`
- `modulateOpacity(float)`

Optional: `clipStroke`, `applyLayerMask`, `modulateColor`, instanced meshes.

**Enums a backend must map:**

- `FillRule`: nonZero, evenOdd, and a non-standard **clockwise**.
- `BlendMode`: srcOver, screen, overlay, multiply, and so on, plus a parameterised **additive** (plus) mode.
- `StrokeCap` and `StrokeJoin`.
- Colours are packed ARGB uint32.

### 4.2 An SVG backend already exists (`utils/svg_factory.cpp`, `utils/svg_renderer.cpp`, `include/utils/*`)

`utils/` contains an SVG renderer, about 900 lines, copyright 2026. It turns the immediate-mode calls into a **flat** SVG document:

- Each `drawPath` writes one `<path>` with its **absolute** matrix, fill or stroke attributes, and opacity.
- `fill-rule="evenodd"` is written only for evenOdd; clockwise is not representable in SVG.
- `clipPath` writes a `<clipPath>` def holding the geometry with the current matrix baked in. Identical clip geometry is shared through a string-keyed map. Content is wrapped in a transform-free `<g clip-path>` so that transforms are not applied twice.
- `save`/`restore` keep a stack holding matrix, opacity and items. Blend modes become `mix-blend-mode` styles, and a run of items with the same blend is grouped.
- Linear and radial gradients become defs.
- Images become data URIs, using an injected size sniffer.
- Draws under a matrix that collapses an axis are dropped, because browsers leave slivers.
- `drawImageMesh` is unsupported, and angular gradients fall back.
- `finalize(w,h)` produces the `<svg>` string.

This shows that Rive's abstraction works for SVG **output**, but only as a "baked" one-frame export. It is **not a retained DOM**: the scene graph's hierarchy, ids and transforms are not kept.

### 4.3 What a minimal Canvas2D or SVG-DOM backend needs

**Canvas2D** matches the interface almost one to one:

- `save`/`restore`/`setTransform` and `Path2D` with `moveTo`/`lineTo`/`bezierCurveTo`/`closePath`;
- `fill(path, 'nonzero'|'evenodd')` and `stroke(path)`;
- `clip(path)`;
- `globalAlpha` for `modulateOpacity`;
- `globalCompositeOperation` for blend modes;
- `createLinearGradient`/`createRadialGradient` (and `createConicGradient` for angular);
- `lineWidth`/`lineCap`/`lineJoin`.

Gaps:

- the clockwise fill rule;
- feather/blur (could use `filter: blur`);
- inside/outside stroke position (could use clip plus double width);
- meshes.

**A retained SVG DOM** (one `<path>` per shape, updated in place) is a different model from Rive's immediate mode. You would want a **retained scene interface** instead:

- create and destroy nodes (group, path), keyed by stable object id;
- set attributes: `d`, `transform`, `fill`, `stroke-*`, `opacity`, `clip-path`, gradient refs;
- reorder children.

The runtime would then push only the dirty attributes. Rive's dirt flags map well onto this:

| Dirt | DOM write |
|---|---|
| `WorldTransform` (or local `Transform`) | `transform` attribute |
| `Path` | `d` attribute |
| `Paint` | `fill`/`stroke` attributes |
| `RenderOpacity` | `opacity` attribute |
| `DrawOrder` | reorder DOM children |

With a DOM it is also better to keep the **hierarchy** as nested `<g transform>` elements than to flatten to world matrices. Strokes then scale the way SVG expects, and CSS and accessibility hooks keep working.

---

## 5. Validation, dangling ids and malformed-file defences

**What Rive does:**

- **Header:** fingerprint check, overflow checks after each varuint, and a major-version gate (`runtime_header.hpp`, `file.cpp:436-470`). The factory must not be null (`file.cpp:430-444`).
- **Sticky reader errors.** Lengths are checked before allocation. LEB128 rejects overlong encodings and stray high bits. There is an integer range check for narrowing (section 1.1).
- **Untyped keys are fatal** (they would cause a desync), while unknown types are harmless (section 1.3).
- **Slot keeping** means one bad object never shifts the indices of the objects after it (`claimsArtboardSlot`, `releaseSlot`, null slots).
- **Bounds-checked `resolve(id)`:** an out-of-range id gives nullptr (`artboard.cpp:1706-1734`). File-level index lists check `index < size` and quietly skip a bad reference (`backboard_importer.cpp:283-292`, converters at 294-341).
- **Fixed-point validation:** objects whose parent or target is missing or of the wrong type are removed repeatedly until nothing changes (`validateObjects`). Removed objects stay alive so that existing pointers do not dangle.
- **Typed checks in lifecycle hooks:** for example, a vertex's parent must be a Path or it gets `MissingObject` (`path_vertex.cpp`); a TrimPath needs an effects container or it gets `InvalidObject`. **Only `InvalidObject` stops loading.** `MissingObject` lets the load continue with the object partly wired (`artboard.cpp:309-313`). Later code has to tolerate null back-pointers; for example `Path::shapePathChanged` checks `m_Shape`.
- **Cycles:**
  - Nested-artboard reference cycles are found with an iterative Tarjan SCC, and the references that close a cycle are dropped. Without that, instancing would recurse forever (`backboard_importer.cpp:1-120, 261-282`).
  - Dependency-graph cycles are detected by the DFS, which stops sorting.
  - Parent-pointer cycles (A's parent is B and B's parent is A) pass `validate` because both are containers. They are just never reached from the artboard root in the dependency sort, so they never update. I inferred this from the code and did not test it.
- **Update loops** are capped at 100 restarts per pass (`updateComponents`), and validation at 100 rounds.
- **Testing:** `tests/unit_tests/runtime/malformed_file_import_test.cpp` imports **every prefix** of a valid file under ASan and checks for a clean failure. It also covers crafted huge lengths and overlong varuints. The tests note that scripts can now load bytes at runtime (`context:decodeFile`), so the importer has to treat any input as hostile.

**Remaining risks I noticed:**

- Correctness rests on the convention that `validate()` runs before `onAddedDirty` dereferences anything. Runtime `Component::onAddedDirty` uses the resolved parent with no check.
- Meaning carried by stream position (latest importer, DataBind binding to the previous object, mutator children) means that reordering objects can silently change meaning.
- A fixed 2-bit ToC class leaves no room for a new value shape. A new kind of value would need a major version, or would have to be expressed as bytes.

---

## 6. Lessons for Anima

Anima is text-first, written by agents, SVG-centred and aimed at small icon animations. These are concrete recommendations.

### Adopt (the ideas, in our own form)

1. **One schema as the single source of truth.** Keep a machine-readable schema (JSON or TS) of node types and properties. Generate the TS runtime types, the JSON Schema used for validation and editor help, the docs, and the "property registry" used by the animation and binding layer. Agents gain a lot from a schema they can read and that the validator enforces.
2. **Generic property access by key.** Animation tracks and bindings address a property by `(nodeId, propertyName)` and go through one typed registry (`setNumber`, `setColor`, `setPath`…). Do not write per-type animation code. Mark each property as `animatable` and `interpolation: tween | hold` in the schema, the way Rive's `animates` and `interpolates` flags work.
3. **Generated base plus hand-written behaviour.** For each type, generated code holds the storage, defaults, a change check and an `onXChanged` hook. Hand-written code only maps a change to dirt.
4. **Dirt flags and a topologically sorted update list.** Use a small bitmask (Transform, WorldTransform, Path, Paint, Opacity, DrawOrder), skip dirt that is already set, sort dependencies once at load, and run one ordered pass per frame with a restart when dirt flows upstream. For icons this is cheap and predictable, and it **maps directly onto minimal SVG-DOM attribute writes** (see 4.3).
5. **The two-phase link plus validation pass:**
   - **resolve:** every reference resolves or the node is marked invalid;
   - **link:** structural requirements, such as "a stroke effect needs a stroke";
   - **fixed-point removal** of invalid nodes, so dependents of a removed node are removed too;
   - **report**, rather than crash.

   Do not dereference anything before validation has run.
6. **Minor versions as semantic switches.** Keep `version: "major.minor"`. Major rejects the file. Minor changes behaviour for one documented feature and keeps the old behaviour for older files. Keep a changelog table like Rive's `minorVersion` comment.
7. **Asset indirection through a host loader.** Assets are declared by id, kind, optional inline data and optional URL or hash. The runtime asks a host hook first and never fetches by itself, and a missing asset is not fatal. Icons rarely need this, but fonts and images could.
8. **Defence-in-depth tests:** load every truncated prefix of each sample file, fuzz the parser, and cap all loops and recursion.

### Simplify (text-first, agents, SVG, icons)

1. **The source format is text: JSON/JSON5, or a small SVG-like XML.** Objects are **nested**, not a flat list with `parentId` indices. Nesting makes parent/child structure clear in the text, removes a whole class of dangling-parent and cycle bugs, and is far easier for agents to write and diff. If a compact binary is ever needed, make it a derived build artifact.
2. **Ids are stable, readable string names** (`"bell-clapper"`), unique per document. They are not positional indices, so reordering or deleting a node never silently re-targets a reference. Cross-references (animation targets, clip refs, gradient refs) are by id, and the validator checks every one. Rive's stable editor ids versus runtime indices split shows that indices are an export-time optimisation, not an authoring model.
3. **Geometry is SVG path data (`d` strings) plus SVG primitives** (`rect`, `circle`, `ellipse`, `line`, `polyline`). Do not make one object per vertex. Path morphing can then animate a `d` string between paths that are compatible: same command structure, checked by the validator. Corner radius and parametric sizes stay as properties on the primitives.
4. **No implied context from position.** Rive uses "latest importer of type X" and "a DataBind binds to the previous object". Anima should make every relationship explicit, through nesting or a named id. Then the order of keys and siblings matters only for **paint order**, and that order should follow SVG: **later draws on top**, which is the opposite of Rive.
5. **Draw order is document order.** Leave out DrawRules/DrawTargets. If z-reordering during an animation is ever needed, use a single animatable `z` or `order` property inside a group.
6. **Paint model matches SVG:** `fill` and `stroke` attributes on a shape (colour or `url(#gradient)`), `stroke-width`, `linecap`, `linejoin`, `opacity`, `fill-rule` limited to nonzero and evenodd. Trim becomes an animatable `trimStart`/`trimEnd`/`trimOffset`, implemented with `pathLength` plus `stroke-dasharray`/`dashoffset`, which SVG supports natively; Rive's trim/dash stroke effects map onto this. Do not support the clockwise fill rule, feather, mesh deformation, bones, layout, or the n-slicer in v1.
7. **Forward compatibility in a text format:**
   - unknown properties and node types are **preserved and ignored** with a warning, rather than causing a skip failure;
   - give the format a `"$schema"` / `"format": "anima/1.0"` and a list of `"requires": ["feature"]`;
   - a runtime that lacks a required feature refuses the file clearly, instead of drawing it wrong.

   Rive learned that skip-by-type breaks when types are missing. Text with explicit structure avoids the problem.
8. **Renderer interface:** offer a **retained scene interface** (create/update/remove node, set attribute, reorder) as the main backend contract, with an SVG-DOM backend first. A Canvas2D backend can be an immediate-mode walker over the same scene. Rive's Factory/Renderer surface (path, paint, gradient, save/restore/transform/clip/draw) is a good checklist of the **minimum capabilities** an immediate backend needs.

### Avoid

1. Positional integer ids and global numeric property keys in the **authoring** format. They are hostile to agents and to diffs. If a binary form is added later, generate numeric keys from the schema at build time, keep them permanent (never reuse, use aliases for renames), and give each value an explicit length so it can always be skipped.
2. Meaning carried by stream order, and silent partial loads. Rive keeps loading after `MissingObject` and leaves objects half-wired. Anima should collect every validation error into a report, with a strict mode that rejects and a lenient mode that drops the bad subtree and says so.
3. A 2-bit type class or any closed set of value shapes that cannot grow.
4. Flattening the hierarchy into absolute-matrix output for the live DOM backend. Keep nested `<g>` so that SVG semantics hold: stroke scaling, CSS hooks, `currentColor` theming, and accessibility titles.
5. Feature creep from Rive: scripting VMs, signed content, data-binding view models, layout engines, nested artboards with cycle detection, state machines beyond what icons need. Each one needs its own validation and security work.
