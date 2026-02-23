<div align="center">
  <img src="https://raw.githubusercontent.com/cvat-ai/cvat/develop/site/content/en/images/cvat-readme-gif.gif" alt="CVAT Platform" width="100%" max-width="800px">

  <h1>🔗 CVAT 关系标注工具</h1>
  <p>基于 CVAT 的对象间关系标注扩展，内置 Track ID 归一化引擎与独立帧播放器。</p>

  🇨🇳 简体中文 | [🇺🇸 English](README.md)
</div>

<br/>

## 概述

官方 [CVAT](https://github.com/cvat-ai/cvat) 提供了完善的目标检测与追踪标注能力，但缺少对**对象间语义关系**（如 `行人 — 骑行 — 自行车`）的跨帧标注支持。

本分支新增了一套 **关系标注工具 (Relation Annotation Tool)**，主要功能包括：

- **关系三元组创建**（主体 → 谓词 → 客体），通过独立的 UI 面板完成。
- **内嵌帧播放器**，工作在标注弹窗内部，与主界面播放器完全隔离。
- **一键 Track ID 归一化引擎**，解决原生 `.get()` / `.put()` 标注 API 导致的 ID 碎片化与关键帧覆盖问题。

---

## 功能说明

### 1. 内嵌帧播放器
基于 Ant Design 组件（`Slider`、`Button`、`InputNumber`）构建的轻量级播放器，渲染在关系标注弹窗内部，与主界面播放器无 CSS 和事件耦合。

| 快捷键 | 功能 |
|--------|------|
| `D` | 上一帧 |
| `F` | 下一帧 |
| `C` | 后退 10 帧 |
| `V` | 前进 10 帧 |
| `Space` | 播放 / 暂停 |

快捷键通过 `window.addEventListener('keydown', handler, true)` 在捕获阶段注册，并调用 `stopPropagation()` 阻止事件传递至 CVAT 的全局 Redux 快捷键系统。当焦点位于 `<input>` 或 `<textarea>` 元素时，监听器自动跳过拦截。

### 2. Track ID 归一化（一键重排清洗）
在长时间标注过程中，反复的合并/拆分操作可能导致 Track ID 不连续或产生冲突。"一键重排清洗"功能的处理流程如下：

1. 通过 `annotations.export()` 导出全部标注数据（保留完整关键帧信息）。
2. 在内存中将所有 ID 重新映射为连续序列。
3. 调用 `annotations.clear()` 清除现有标注，再通过 `annotations.import()` 导入归一化后的数据集。
4. 通过 `annotations.save()` 将结果持久化至服务器。

该方案避免了标准 `annotations.get()` / `annotations.put()` 流程中由帧展平引起的关键帧覆盖副作用。

### 3. 队列式批量生成
支持将多条关系三元组加入队列后统一提交。每条生成的关系以 `TRACK` 类型、`POINTS` 形状存储，定位于主体包围框中心。当主体或客体从画面中消失时，该 Track 自动终止（设置 `outside = true`）。

---

## 前提条件：CVAT 项目标签配置

本工具要求项目中存在一个名为 `Relation` 的标签，且包含三个指定属性。请在创建 Project 或 Task 时，通过 **Raw** JSON 编辑器添加以下配置：

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

> **说明：** `predicate.values` 数组定义了 UI 下拉菜单中可选的关系类型。请根据实际标注需求修改此列表。

---

## 使用流程

1. 使用 CVAT 标准工具（矩形框、多边形等）标注目标对象（如 `Car`、`Pedestrian`）。
2. 点击左侧工具栏中的**关系标注图标**（或按 `R` 键）。
3. 在关系标注弹窗中，从标注列表中选择**主体**和**客体**。
4. 从下拉菜单中选择**谓词**。
5. 点击**插入**，将三元组添加到生成队列。
6. 点击**生成**，创建关系 Track。
7. 使用 `[D]` / `[F]` 逐帧检查生成的 Track 是否正确。

---

## 安装方式

### 方案 A：直接克隆本仓库

```bash
git clone -b relation-auto-tool https://github.com/QXqin/cvat.git
cd cvat/cvat-ui
yarn install
yarn run build
```

### 方案 B：以补丁形式应用到已有 CVAT 项目

从仓库根目录下载 `cvat-relation-annotation-tool.patch` 文件并应用：

```bash
git apply cvat-relation-annotation-tool.patch
cd cvat-ui
yarn run build
```
---

## 附加文档

- **[TransT 目标跟踪器部署教程](serverless/pytorch/dschoerk/transt/nuclio/DEPLOY_TRANST_zh.md)** — 将 TransT 目标跟踪器部署为 Serverless 函数，实现跨帧自动包围框追踪。

---

## 许可协议

本项目是 [cvat-ai/cvat](https://github.com/cvat-ai/cvat) 的派生分支，依照 **[MIT 协议](https://opensource.org/licenses/MIT)** 发布。

原始 CVAT 的所有版权声明均按照协议条款予以保留。
