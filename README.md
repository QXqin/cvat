<div align="center">
  <h1>🔗 CVAT Relation Annotation Tool</h1>
  <p>A CVAT extension for inter-object relationship annotation with built-in track ID normalization and an embedded frame player.</p>

  [🇨🇳 简体中文](README_zh.md) | 🇺🇸 English
</div>

<br/>

## Overview

The official [CVAT](https://github.com/cvat-ai/cvat) provides robust tools for object detection and tracking annotation. However, it lacks native support for annotating **semantic relationships between objects** (e.g., `person — riding — bicycle`) across video frames.

This fork adds a **Relation Annotation Tool** that addresses this gap. Key capabilities include:

- **Relationship triplet creation** (Subject → Predicate → Object) via a dedicated UI panel.
- **Embedded frame player** within the annotation dialog, fully isolated from the main CVAT player.
- **One-click Track ID normalization engine** that resolves ID fragmentation and keyframe collision issues caused by the native `.get()` / `.put()` annotation API.

---

## Features

### 1. Embedded Frame Player
A lightweight player built with Ant Design components (`Slider`, `Button`, `InputNumber`) is rendered inside the Relation dialog. It operates independently from the main CVAT player to prevent CSS and event conflicts.

| Hotkey | Action |
|--------|--------|
| `D` | Previous frame |
| `F` | Next frame |
| `C` | Back 10 frames |
| `V` | Forward 10 frames |
| `Space` | Play / Pause |

Hotkeys are registered via `window.addEventListener('keydown', handler, true)` at the capture phase, with `stopPropagation()` to avoid interference with CVAT's global Redux shortcut system. Listeners are automatically disabled when an `<input>` or `<textarea>` element is focused.

### 2. Track ID Normalization (Wipe & Sync)
Over extended annotation sessions, Track IDs may become non-sequential or collide due to repeated merge/split operations. The "Wipe & Sync" function resolves this by:

1. Exporting all annotations via `annotations.export()` (preserving full keyframe data).
2. Re-mapping all IDs to a continuous sequence in memory.
3. Clearing existing annotations and re-importing the normalized dataset via `annotations.import()`.
4. Persisting the result to the server via `annotations.save()`.

This approach avoids the frame-flattening side effects of the standard `annotations.get()` / `annotations.put()` cycle.

### 3. Queue-based Batch Generation
Multiple relationship triplets can be queued before committing. Each generated relation is stored as a `TRACK` of type `POINTS`, positioned at the subject's bounding box center. The track automatically terminates (sets `outside = true`) when either the subject or object disappears from the frame.

---

## Prerequisites: CVAT Project Label Configuration

The tool requires a label named `Relation` with three specific attributes. Add the following to your Project or Task label configuration via the **Raw** JSON editor:

```json
[
  {
    "name": "Relation",
    "color": "#ff0000",
    "attributes": [
      {
        "name": "predicate",
        "mutable": true,
        "input_type": "select",
        "default_value": "near",
        "values": ["near", "holding", "riding", "wearing", "next_to", "behind"]
      },
      { "name": "subject_id", "mutable": true, "input_type": "text", "default_value": "", "values": [] },
      { "name": "object_id", "mutable": true, "input_type": "text", "default_value": "", "values": [] }
    ]
  }
]
```

> **Note:** The `predicate.values` array defines the available relationship types in the UI dropdown. Modify this list to match your annotation schema.

---

## Usage

1. Annotate objects (e.g., `Car`, `Pedestrian`) using standard CVAT tools (bounding boxes, polygons, etc.).
2. Click the **Relation Tool icon** in the left sidebar (or press `R`).
3. In the Relation dialog, select a **Subject** and an **Object** from the annotation list.
4. Choose a **Predicate** from the dropdown menu.
5. Click **Insert** to add the triplet to the generation queue.
6. Click **Generate** to create the relationship tracks.
7. Use `[D]` / `[F]` to step through frames and verify the generated tracks.

---

## Installation

### Option A: Clone this repository

```bash
git clone -b relation-auto-tool https://github.com/QXqin/cvat.git
cd cvat/cvat-ui
yarn install
yarn run build
```

### Option B: Apply as a patch to an existing CVAT installation

Download `cvat-relation-annotation-tool.patch` from the repository root and apply it:

```bash
git apply cvat-relation-annotation-tool.patch
cd cvat-ui
yarn run build
```

---

## License

This project is a fork of [cvat-ai/cvat](https://github.com/cvat-ai/cvat) and is distributed under the **[MIT License](https://opensource.org/licenses/MIT)**.

All original CVAT copyright notices are retained per the terms of the license.
