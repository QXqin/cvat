<div align="center">
  <img src="https://raw.githubusercontent.com/cvat-ai/cvat/develop/site/content/en/images/cvat-readme-gif.gif" alt="CVAT Platform" width="100%" style="max-width: 800px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">

  <h1>🔗 CVAT Relation Annotation Tool</h1>
  <p><strong>This repository is a deep secondary development fork based on the official CVAT, designed to solve the challenges of Scene Graph and cross-frame object relationship annotation in large-scale video annotation tasks.</strong></p>

  <p>
    <a href="https://github.com/cvat-ai/cvat"><img src="https://img.shields.io/badge/upstream-cvat-blue.svg?logo=github&style=flat-square" alt="Upstream CVAT" /></a>
    <img src="https://img.shields.io/badge/frontend-React%20%7C%20AntD-61DAFB.svg?logo=react&style=flat-square" alt="Frontend: React" />
    <img src="https://img.shields.io/badge/backend-Python%20%7C%20Django-3776AB.svg?logo=python&style=flat-square" alt="Backend: Python" />
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="License: MIT" /></a>
  </p>


  [🇨🇳 简体中文](README_zh.md) | 🇺🇸 English

</div>

<br/>

## 📖 Overview

The official [CVAT](https://github.com/cvat-ai/cvat) provides robust tools for object detection and tracking annotation. However, it lacks native support for annotating **semantic relationships between objects** (e.g., `person — riding — bicycle`) across video frames.

This fork introduces the **Relation Annotation Tool**, an extension that addresses this gap while resolving core engineering challenges associated with the native CVAT APIs.

Key capabilities include:
- **Relationship Triplet Creation:** Define `Subject → Predicate → Object` vectors via a dedicated UI panel.
- **Embedded UI Isolation:** Features a built-in frame player within the annotation dialog, fully isolated from the main CVAT player to prevent event collision.
- **Data Normalization Engine:** Implements a one-click Track ID normalization algorithm resolving ID fragmentation and keyframe collision issues natively caused by the `.get()` and `.put()` API hooks.

---

## ✨ Core Features

### 1. Embedded Frame Player
A lightweight transport control layer built with Ant Design components (`Slider`, `Button`, `InputNumber`) is rendered inside the Relation dialog. It operates asynchronously from the main CVAT video player to guarantee CSS and DOM event isolation.

| Hotkey | Action |
|:---:|---|
| <kbd>D</kbd> | Previous frame |
| <kbd>F</kbd> | Next frame |
| <kbd>C</kbd> | Jump back 10 frames |
| <kbd>V</kbd> | Jump forward 10 frames |
| <kbd>Space</kbd> | Play / Pause |

> **Technical Implementation:** Hotkeys are registered via `window.addEventListener('keydown', handler, true)` at the document capture phase with strict `e.stopPropagation()`. This explicitly bypasses CVAT's global React/Redux shortcut system to prevent conflicting actions. Listeners are automatically muted when standard `<input>` or `<textarea>` elements receive focus.

### 2. Track ID Normalization (Wipe & Sync)
Extended annotation sessions involving merge/split operations inevitably lead to non-sequential, fragmented Track IDs and severe data collision. The "Wipe & Sync" function performs automatic database realignment via the following pipeline:

1. **Serialization:** Exports all annotations via `annotations.export()` (preserving full multi-frame keypoint metadata).
2. **Re-indexing:** Maps all IDs sequentially in memory, guaranteeing collision-free ID allocation (Entities prioritized, Relations appended).
3. **Database Flush:** Clears the active database state via `annotations.clear()`, subsequently injecting the normalized matrix via `annotations.import()`.
4. **Persistence:** Commits the transaction to the backend database via `annotations.save()`.

*This pipeline circumvents the ID corruption issues that can occur when re-importing annotation files.*

### 3. Queue-based Batch Generation
Supports queuing multiple relationship triplets prior to submission. Each validated relation is persisted as a continuous `TRACK` composed of `POINTS`, mathematically projected to the bounding box center of the target Subject. The logical track is automatically terminated (attribute `outside = true` set) when either participating entity exits the spatial frame.

### 4. Technical Architecture
*(Reserved: Insert an architectural diagram illustrating how the `Relation Dialog` mounts onto the native CVAT `StandardWorkspace` React component tree and Redux state interception mechanisms.)*
- **UI Injection:** Custom action buttons are registered within `cvat-ui/src/containers/annotation-page/standard-workspace/controls-side-bar`.
- **State Management:** Maintains isolated component State to prevent polluting the CVAT global Redux store, triggering transactional queries to the core API only upon invoking a "Wipe & Sync".

---

## ⚙️ Configuration: Label Schema

The tool mathematically links to an explicit target label named `Relation`. You must provision this label and its precise attributes in your Project or Task configuration. Paste the following configuration directly into the **Raw JSON** editor during project creation:

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
        "values": ["near", "holding", "riding", "wearing", "next_to", "behind", "in_front_of"]
      },
      { "name": "subject_id", "mutable": true, "input_type": "text", "default_value": "", "values": [] },
      { "name": "object_id", "mutable": true, "input_type": "text", "default_value": "", "values": [] }
    ]
  }
]
```

> **Note:** The `predicate.values` array defines the allowed ontology mapping in the user interface. You are encouraged to modify this array to suit your specific dataset taxonomy.

---

## 🚀 Usage Guide

1. **Base Annotation:** Annotate target objects (e.g., `Car`, `Pedestrian`) using standard CVAT primitives (bounding box, polygon, etc.). For the TransT assisted annotation deployment guide, please refer to: [TransT Tracker Deployment Guide](./serverless/pytorch/dschoerk/transt/nuclio/DEPLOY_TRANST.md).
2. **Open Module:** Click the **Relation Tool icon** in the left sidebar control panel (Shortcut: <kbd>R</kbd>).
3. **Select Entities:** In the dialog window, designate a **Subject** and an **Object** from the detected entity list.
4. **Map Predicate:** Select an active **Predicate** from the ontology dropdown.
5. **Queue Triplet:** Click **Add / Insert** to push the triplet into the local generation queue.
6. **Compile:** Click **Generate** to commit the queue and mathematically construct the relationship tracks in CVAT memory.
7. **Verification:** Utilize <kbd>D</kbd> and <kbd>F</kbd> to step linearly through the timeline to verify algorithmic track assignment.

---

## 📦 Installation Options

> **⚠️ Version Compatibility Warning:**
> This extension was developed against **CVAT v2.56.2**. Due to serialization and deserialization routines interacting directly with the underlying annotation matrix, it is highly recommended to apply this patch to equivalent or compatible versions.

### Option A: Clone the Repository Directly

```bash
git clone -b relation-auto-tool https://github.com/QXqin/cvat.git
cd cvat/cvat-ui
yarn install
yarn run build
```

### Option B: Apply Local Patch to Existing Environment

Download the `cvat-relation-annotation-tool.patch` architecture patch from the repository root and apply it sequentially:

```bash
git apply cvat-relation-annotation-tool.patch
cd cvat-ui
yarn run build
```

---

## 📚 Additional Documentation

- **[TransT Tracker Deployment Guide](serverless/pytorch/dschoerk/transt/nuclio/DEPLOY_TRANST.md)** — Deploy the TransT object tracker as a serverless function to automate frame-by-frame bounding box tracking.

---

## 📜 License

This software architecture represents a localized fork of [cvat-ai/cvat](https://github.com/cvat-ai/cvat). It is published and distributed under the terms of the **[MIT License](https://opensource.org/licenses/MIT)**.

All original CVAT copyright notices, warranties, and liability clauses are retained structurally strictly in accordance with the terms of the applicable MIT License.

## 🛠 Development Notes
The core logic and documentation of this project are developer-led. Part of the code and architectural optimization was assisted by Large Language Models (LLMs) such as **Gemini / Claude**, aiming to improve development efficiency and code robustness.
