<div align="center">
  <img src="https://raw.githubusercontent.com/cvat-ai/cvat/develop/site/content/en/images/cvat-readme-gif.gif" alt="CVAT Platform" width="100%" max-width="800px">

  <h1>🔗 CVAT Relation Annotation Tool</h1>
  <p><b>An advanced extension for deep relationship annotation, ID wipe-and-sync, and seamless in-browser track manipulation.</b></p>

  [🇨🇳 简体中文](README_zh.md) | [🇺🇸 English](README.md)
</div>

<br/>

## 🌟 What makes this Fork special?

While the official CVAT excels at bounding box and polygon tracking, annotating **complex relationships between objects across multiple frames** has always been extremely difficult. Long-term relationship tracks easily suffer from "Frame Collisions" (ID overlaps) and synchronization issues.

This fork introduces a **custom, lightweight Relation Annotation Tool** with a built-in "Wipe & Re-sync" engine. It allows you to:
1. Fast-link objects across frames.
2. Navigate seamlessly using a dedicated mini-player.
3. Fix shattered Track IDs via a one-click backend JSON sync—entirely within the browser!

---

## 🔥 Core Features

### 1. In-Dialog Native Player
No more closing the modal to check the next frame! We replaced the heavy, global Redux-bound generic CVAT player with a highly customized `Ant Design` mini-player securely embedded within the Relation dialog.
- 📺 **Zero CSS Pollution:** 100% isolated layout. It won't break the main CVAT UI.
- ⌨️ **Native Hotkeys:** Bypass CVAT's complex shortcut trees. Hand-coded DOM listeners for instant `[D]` (Prev), `[F]` (Next), `[C]` (Back 10), `[V]` (Forward 10) and `[Space]` responses.

### 2. Auto ID Wipe & Sync
Fix broken tracks instantly! Clicking the red "Wipe and Sync" button exports the entire frame job as raw CVAT JSON, resolves all shattered clientIDs in memory, natively sorts boxes and points, then seamlessly clears and re-imports the fixed tracks.
- 🛡️ **Prevents Track Degradation:** Solves the core CVAT issue where merging/splitting interpolated tracks causes the `.get()` / `.put()` API to forcibly overwrite keyframes.

### 3. Queue-based Triplet Annotation
Select Subject -> Choose Predicate -> Select Object -> Push to Queue -> Generate. A clean pipeline for building vast Scene Graphs on videos.

---

## 🚀 Quick Setup (CVAT Raw Project Setup)

To use the tool, you **must** configure your original CVAT project labels correctly. The tool dynamically reads from a label strictly named `"Relation"`.

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
        "values": [
          "near",
          "holding",
          "riding",
          "wearing",
          "next_to",
          "behind"
        ]
      },
      { "name": "subject_id", "mutable": true, "input_type": "text", "default_value": "", "values": [] },
      { "name": "object_id", "mutable": true, "input_type": "text", "default_value": "", "values": [] }
    ]
  }
]
```

### Usage Steps:
1. Annotate normal objects (e.g., Car, Pedestrian) via standard bounding boxes / polygons.
2. Click the shiny new **Graph Icon** on the left Sidebar (Shortcut: `R`).
3. Click an object in the left sidebar list to set it as **Subject**, click another as **Object**.
4. Choose a relationship (e.g., `riding`) from the top dropdown, click "Insert".
5. Generate the relationship. Use `[F]` and `[D]` to verify the connection is bound tightly in the following frames!

---

## 🏗️ Installation & Build Instructions

### Option A: Use it as a Standalone Repository
If you are starting fresh, simply clone this repository, switch to the `relation-auto-tool` branch, and build.

```bash
git clone -b relation-auto-tool https://github.com/QXqin/cvat.git
cd cvat/cvat-ui
yarn install
yarn run build
```

### Option B: Apply the Patch to your existing CVAT
If you already have your own customized CVAT project and just want to add this Relation Tool feature, you don't need to merge the whole branch.
Simply download the `cvat-relation-annotation-tool.patch` file from the root of this repository and apply it to your project.

```bash
git apply cvat-relation-annotation-tool.patch
cd cvat-ui
yarn run build
```

---

## 📜 Original CVAT License & Upstream

This is a customized fork focusing on high-efficiency Scene Graph / Event relation pipelines.
All core Computer Vision Annotation Tool (CVAT) engine rights belong to the CVAT.ai Corporation.
Code stays under the **[MIT License](https://opensource.org/licenses/MIT)**.

> **Original README:** For the official enterprise CVAT instructions, APIs, and Docker deployments, please refer to the upstream repository at [cvat-ai/cvat](https://github.com/cvat-ai/cvat).
