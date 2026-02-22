<div align="center">
  <img src="https://raw.githubusercontent.com/cvat-ai/cvat/develop/site/content/en/images/cvat-readme-gif.gif" alt="CVAT Platform" width="100%" max-width="800px">

  <h1>🔗 CVAT 关系标注增强版 (Relation Annotation Tool)</h1>
  <p><b>基于官方 CVAT 深度二次开发：彻底解决多帧对象关系追踪难题。</b></p>

  [🇨🇳 简体中文](README_zh.md) | [🇺🇸 English](README.md)
</div>

<br/>

## 🌟 这个分支有什么特别之处？

虽然原生 CVAT 在追踪标注上极度强大，但在处理**跨多帧的对象间复杂关系**时经常捉襟见肘，尤其容易在长期追踪中遇到“差值冲突”与“ID 错位挂靠”等底层系统问题。

本分支专门为此研发了一套独立的**轻量化关系标注拓扑工具**，搭载了独家首创的「端到端 JSON 清洗重排引擎」，让您在浏览器内只需点按一下，即可无痛修复所有断裂或错位的 Track 系统！

---

## 🔥 核心功能

### 1. 独创防污染内嵌播放器
告别必须要关闭弹窗才能翻页看视频的尴尬！我们抽离了容易引起全局样式污染的 CVAT 庞大原生播放器组件，采用原生 Ant Design 重写了一套专属的播放控制栏，无缝嵌入弹窗标题下方。
- 📺 **零样式污染：** 经过上百次重构打磨的对齐与缩放体系。不破坏原生界面。
- ⌨️ **原生级满血快捷键：** 彻底绕过原有的 React HotKeys 注册树，硬编码 `addEventlistener` 过滤表单焦点，完美实现 `D`/`F`/`C`/`V`/`Space` 极致丝滑的跨帧体验。

### 2. 一键端到端差值清洗
不再害怕长标注项目里的 ID 乱跳与覆盖 Bug！一键导出完整的 CVAT JSON 数据生命周期，在内存中完成无破损重排并重新排序分类（先框后点），最后安全导回覆盖系统。彻底拯救强迫症的“ID 断号”与“诡异连线重叠”。

### 3. 队列式三元组生成
点击主体 -> 选择谓词 -> 点击客体，优雅地压入关系待定队列。支持一次性从后台静默连通上百条对象并自动写入下一帧结束生命极限。

---

## 🚀 快速使用指南 (CVAT Raw Project Setup)

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

### 使用步骤：
1. 像往常一样使用多边形/矩形标注普通对象（例如：车、行人）。
2. 点击左侧工具栏中闪亮的**图谱图标**（快捷键：`R`）。
3. 在左侧列表中点击一个对象设为**主体**，再点击另一个对象设为**客体**。
4. 在顶部下拉框中选择关系（例如：`riding`），点击“插入队列”。
5. 点击生成。你可以使用 `[F]` 和 `[D]` 跨帧查看它们的关系线条被紧紧绑定！

---

## 🏗️ 安装与使用指南

### 方案 A: 直接使用本仓库
如果您是全新开始，极力推荐直接 Clone 此仓库的特定分支并编译：

```bash
git clone -b relation-auto-tool https://github.com/QXqin/cvat.git
cd cvat/cvat-ui
yarn install
yarn run build
```

### 方案 B: 补丁安装法
如果您已经有了自己的 CVAT 源码库，并且只想要这个“关系标注”拓展，您不需要合并整个分支。只需下载本项目根目录的 `cvat-relation-annotation-tool.patch` 文件，然后在您自己的 CVAT 根目录下运行：

```bash
git apply cvat-relation-annotation-tool.patch
cd cvat-ui
yarn run build
```

---

## 📜 原始开源协议与声明

这是一个专门针对高效率场景图 / 关系事件标注优化的私人二次开发分支。
所有核心 Computer Vision Annotation Tool (CVAT) 引擎的版权归属于 CVAT.ai Corporation。
本项目代码同样遵循 **[MIT 协议](https://opensource.org/licenses/MIT)**。

> **原始说明文档:** 关于官方企业级 CVAT 的使用指南、API 和 Docker 部署，请参阅上游项目 [cvat-ai/cvat](https://github.com/cvat-ai/cvat)。
