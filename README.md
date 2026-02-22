<div align="center">
  <img src="https://raw.githubusercontent.com/cvat-ai/cvat/develop/site/content/en/images/cvat-readme-gif.gif" alt="CVAT Platform" width="100%" max-width="800px">

  <h1>🔗 CVAT Relation Annotation Tool (CVAT 关系标注增强版)</h1>
  <p><b>An advanced extension for deep relationship annotation, ID wipe-and-sync, and seamless in-browser track manipulation.</b></p>
  <p><b>基于官方 CVAT 深度二次开发：彻底解决多帧对象关系追踪难题。</b></p>
</div>

<br/>

## 🌟 What makes this Fork special? | 这个分支有什么特别之处？

While the official CVAT excels at bounding box and polygon tracking, annotating **complex relationships between objects across multiple frames** has always been extremely difficult. Long-term relationship tracks easily suffer from "Frame Collisions" (ID overlaps) and synchronization issues.

This fork introduces a **custom, lightweight Relation Annotation Tool** with a built-in "Wipe & Re-sync" engine. It allows you to:
1. Fast-link objects across frames.
2. Navigate seamlessly using a dedicated mini-player.
3. Fix shattered Track IDs via a one-click backend JSON sync—entirely within the browser!

虽然原生 CVAT 在追踪标注上极度强大，但在处理**跨多帧的对象间复杂关系**时经常捉襟见肘，尤其容易在长期追踪中遇到“差值冲突”与“ID 错位挂靠”等底层系统问题。

本分支专门为此研发了一套独立的**轻量化关系标注拓扑工具**，搭载了独家首创的「端到端 JSON 清洗重排引擎」，让您在浏览器内只需点按一下，即可无痛修复所有断裂或错位的 Track 系统！

---

## 🔥 Core Features | 核心功能

### 1. In-Dialog Native Player | 独创防污染内嵌播放器
No more closing the modal to check the next frame! We replaced the heavy, global Redux-bound generic CVAT player with a highly customized `Ant Design` mini-player securely embedded within the Relation dialog.
- 📺 **Zero CSS Pollution:** 100% isolated layout. It won't break the main CVAT UI.
- ⌨️ **Native Hotkeys:** Bypass CVAT's complex shortcut trees. Hand-coded DOM listeners for instant `[D]` (Prev), `[F]` (Next), `[C]` (Back 10), `[V]` (Forward 10) and `[Space]` responses.

告别必须要关闭弹窗才能翻页看视频的尴尬！我们抽离了容易引起全局样式污染的 CVAT 庞大原生播放器组件，采用原生 Ant Design 重写了一套专属的播放控制栏，无缝嵌入弹窗标题下方。
- 📺 **零样式污染：** 经过上百次重构打磨的对齐与缩放体系。
- ⌨️ **原生级满血快捷键：** 彻底绕过原有的 React HotKeys 注册树，硬编码 `addEventlistener` 过滤表单焦点，完美实现 `D`/`F`/`C`/`V`/`Space` 极致丝滑的跨帧体验。

### 2. Auto ID Wipe & Sync | 一键端到端差值清洗
Fix broken tracks instantly! Clicking the red "Wipe and Sync (一键重排清洗)" button exports the entire frame job as raw CVAT JSON, resolves all shattered clientIDs in memory, natively sorts boxes and points, then seamlessly clears and re-imports the fixed tracks.
- 🛡️ **Prevents Track Degradation:** Solves the core CVAT issue where merging/splitting interpolated tracks causes the `.get()` / `.put()` API to forcibly overwrite keyframes.

不再害怕长标注项目里的 ID 乱跳与覆盖 Bug！一键导出完整的 CVAT JSON 数据生命周期，在内存中完成无破损重排并重新排序分类（先框后点），最后安全导回覆盖系统。彻底拯救强迫症的“ID 断号”与“诡异连线重叠”。

### 3. Queue-based Triplet Annotation | 队列式三元组生成
Select Subject -> Choose Predicate -> Select Object -> Push to Queue -> Generate. A clean pipeline for building vast Scene Graphs on videos.

点击主体 -> 选择谓词 -> 点击客体，优雅地压入关系待定队列。支持一次性从后台静默连通上百条对象并自动写入下一帧结束生命极限。

---

## 🚀 Quick Setup | 快速使用指南 (CVAT Raw Project Setup)

To use the tool, you **must** configure your original CVAT project labels correctly. The tool dynamically reads from a label strictly named `"Relation"`.

要激活工具，你必须在 CVAT 新建 Project 或 Task 时，去 **Raw** 标签配置选项卡里粘贴以下固定格式的 JSON：

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

## 🏗️ Installation & Build Instructions | 安装与使用指南

### Option A: Use it as a Standalone Repository (直接使用本仓库)
If you are starting fresh, simply clone this repository, switch to the `relation-auto-tool` branch, and build.

```bash
git clone -b relation-auto-tool https://github.com/QXqin/cvat.git
cd cvat/cvat-ui
yarn install
yarn run build
```

### Option B: Apply the Patch to your existing CVAT (补丁安装法)
If you already have your own customized CVAT project and just want to add this Relation Tool feature, you don't need to merge the whole branch.
Simply download the `cvat-relation-annotation-tool.patch` file from the root of this repository and apply it to your project.

如果您已经有了自己的 CVAT 源码库，只需下载本项目根目录的 `cvat-relation-annotation-tool.patch` 文件，然后在您自己的 CVAT 根目录下运行：

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
