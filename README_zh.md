<div align="center">
  <img src="https://raw.githubusercontent.com/cvat-ai/cvat/develop/site/content/en/images/cvat-readme-gif.gif" alt="CVAT Platform" width="100%" style="max-width: 800px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">

  <h1>🔗 CVAT 关系标注工具</h1>
  <p><strong>基于 CVAT 的对象间语义关系标注扩展，内置原生 Track ID 归一化引擎与隔离型帧播放器。</strong></p>

  <p>
    <a href="https://github.com/cvat-ai/cvat"><img src="https://img.shields.io/badge/upstream-cvat-blue.svg?logo=github&style=flat-square" alt="Upstream CVAT" /></a>
    <img src="https://img.shields.io/badge/frontend-React%20%7C%20AntD-61DAFB.svg?logo=react&style=flat-square" alt="Frontend: React" />
    <img src="https://img.shields.io/badge/backend-Python%20%7C%20Django-3776AB.svg?logo=python&style=flat-square" alt="Backend: Python" />
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="License: MIT" /></a>
  </p>

  <p>
    🇨🇳 简体中文 | [🇺🇸 English](README.md)
  </p>
</div>

<br/>

## 📖 概述

官方 [CVAT](https://github.com/cvat-ai/cvat) 提供了完善的目标检测与追踪标注能力，但针对视频序列中**对象间语义关系**（如 `行人 — 骑行 — 自行车`）的跨帧标注支持略显薄弱。

本派生分支新增了一套专业级的 **关系标注工具 (Relation Annotation Tool)**，旨在填补这一空白，并解决原生 CVAT API 在处理多帧复杂对象操作时暴露的工程级缺陷。

核心能力概览：
- **关系三元组构建**：通过解耦的独立 UI 面板创建确定的 `主体 → 谓词 → 客体` 语义表达。
- **隔离型内嵌播放器**：运行在标注弹窗层级的专属帧播放器，与 CVAT 主界面播放器在 DOM 事件和 CSS 样式上完全阻断。
- **归一化引擎 (Wipe & Sync)**：一键式重构底层数据库 ID 序列的引擎，从根本上解决由原生 `.get()` / `.put()` API 更新机制引发的 ID 碎片化与关键帧覆盖灾难。

---

## ✨ 核心特性

### 1. 隔离型内嵌帧播放器
该传输控制层基于 Ant Design 框架组件（`Slider`、`Button`、`InputNumber`）完全二次设计。渲染环境受限于关系标注弹窗的独立上下文中，确保与主模块的异步运行。

| 快捷键 | 功能指令 |
|:---:|---|
| <kbd>D</kbd> | 回溯上一帧 |
| <kbd>F</kbd> | 前进下一帧 |
| <kbd>C</kbd> | 负向步进检索 (10 帧) |
| <kbd>V</kbd> | 正向步进检索 (10 帧) |
| <kbd>Space</kbd> | 播放 / 暂停序列 |

> **底层实现机制：** 通过在 DOM 的 `capture` (捕获) 阶段注册 `window.addEventListener('keydown', handler, true)` 挂载监听，并强制下发 `e.stopPropagation()` 阻断事件冒泡。此特权机制精准绕过了 CVAT 框架内的全局 React/Redux 快捷键派发体系。在此架构下，一旦检测到焦点坠入常规 `<input>` 或 `<textarea>` 节点，系统便自动熔断拦截反馈。

### 2. Track ID 的归一化清洗 (Wipe & Sync 引擎)
极长时间的流水线作业与高频次合并 (merge) 及切分 (split) 操作，最终会导致标注对象在数据库中的 Track ID 编号彻底碎片化、断层甚至碰撞。本引擎基于内存级快排进行数据库拓扑重建：

1. **全量序列化**：挂载 `annotations.export()` 实施热导出（此设计避开常规提取方式导致的多帧关键信息塌陷现象）。
2. **重映射路由**：在运行时分配全新连续索引编号（算法层面保证高优实体的栈底优先级，关系点阵附加其后）。
3. **数据库熔断与注入**：借助 `annotations.clear()` 彻底烧毁当前不洁状态树，转而以 `annotations.import()` 无缝切入清洗后结构集。
4. **状态持久化**：发出指令令 `annotations.save()` 执行双向通信推送。

### 3. 基于队列架构的批处理生成
开发工具支持流水线批处理：将多重三元组数据抛入虚拟生成队列后执行统一的事务提交并渲染。每组生效关系将按照 `TRACK` 原语与 `POINTS` 形态被永久挂载于追踪库内。跟踪特征将被强制锁定约束在主体标注框 (Bounding Box) 刚性中心。当关联主体或客体跨出相机的物理视野界限后，该关系 Track 则立即抛出 `outside = true` 触发中断终止逻辑。

---

## ⚙️ 参数要求：本体标签定义

此分析平台运算逻辑从根本上依赖项目清单内一枚叫作 `Relation` 的指定标签实体。若未依附规范参数建立此标签，算法将拒绝运行。请在创建一个 Project 或任务区间时，手动调出 **Raw JSON 文本编辑器**并硬编码下列标签 JSON：

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

> **扩展说明：** Json 中的 `predicate.values` 字符串数字用来呈现前端下拉选单的节点项。你可以自主更换此列表字符串对齐课题的需求。

---

## 🚀 实战工作流

1. **本体目标锁定：** 请先启动左侧标准描绘模组（边界矩形、多边形等），将待监测物理本体完成静态标准提取（如 `Car` 等）。
2. **呼出功能层：** 单击屏幕左翼控制塔图标启动**关系标注工具窗口**（对应热键：<kbd>R</kbd>）。
3. **确定三元向量集：** 在浮动模态框的候选清单池，精准挑出指定的**主体 (Subject)**与**客体 (Object)**。
4. **加载谓词定义：** 切入谓词池表单抽取匹配动作 **核心谓词 (Predicate)**。
5. **入列压栈：** 点击 **添加 (Insert)** 按键，令其流入执行缓冲区栈。
6. **编译释放：** 单击 **生成 (Generate)** 通知内存调度并写入底层节点树完成轨制创建。
7. **精度验算：** 使用左右手组合 <kbd>D</kbd> 与 <kbd>F</kbd> 控制逐帧偏移验证几何学贴合度。

---

## 📦 工程部署形式

### 方案 A：整包深度克隆

```bash
git clone -b relation-auto-tool https://github.com/QXqin/cvat.git
cd cvat/cvat-ui
yarn install
yarn run build
```

### 方案 B：依赖补丁包无损热插拔合并

在任意已有项目的根目录挂载释放本地库包内的 `cvat-relation-annotation-tool.patch` 并重编客户端核心：

```bash
git apply cvat-relation-annotation-tool.patch
cd cvat-ui
yarn run build
```

---

## 📚 附加进阶文档

- **[TransT 目标跟踪器全能部署教程](serverless/pytorch/dschoerk/transt/nuclio/DEPLOY_TRANST_zh.md)** — 向本地 Serverless 拓扑内搭建 TransT 轻量级目标跟踪无服务器运算功能链，以实现基于 AI 模型自动化的框体推算与跨越跟随定位。

---

## 📜 GNU/开源许可归属声明

此体系基于公有云开发主干 [cvat-ai/cvat](https://github.com/cvat-ai/cvat) 的深层次二次开发，并在其架构之上遵照 **[MIT License](https://opensource.org/licenses/MIT)** 公开此派生架构体系所有的重塑源码。

关于本体系引用的原框架所有关联产权、附加的免责约定、版权标志，根据此底层许可强制保留并不遭破坏修改。
