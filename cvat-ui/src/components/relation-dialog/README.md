# CVAT Relation Annotation Tool（关系标注工具）

> 一套集成于 CVAT 标注平台的**对象间关系标注**扩展工具，支持在弹窗中完成关系创建、ID 重排清洗、帧导航与快捷键操作，无需离开标注界面。

---

## 🚀 快速入门：如何在 CVAT 中配置使用？

本工具强依赖于 CVAT 的 **标签系统 (Labels)**。要让工具正确识别并使用“关系标注”，**你必须在 Project 或 Task 的 RAW 配置（Raw 模式配置标签）中加入严格格式的 `Relation` 标签及其属性。**

### 第 1 步：配置 RAW 标签 (Labels)
在创建 Project 或 Task 时，进入 `Raw` JSON 标签编辑模式，将以下配置片段加入到你的 labels 数组中：

```json
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
        "behind",
        "in_front_of",
        "above",
        "below",
        "parked on"
      ]
    },
    {
      "name": "subject_id",
      "mutable": true,
      "input_type": "text",
      "default_value": "",
      "values": []
    },
    {
      "name": "object_id",
      "mutable": true,
      "input_type": "text",
      "default_value": "",
      "values": []
    }
  ]
}
```

> **⚠️ 核心要求**：
> 1. 标签的名称**必须**拼写为 `Relation` (不区分大小写，内部统一匹配)。
> 2. **必须**包含名为 `predicate` (谓词)、`subject_id` (主体) 和 `object_id` (客体) 的属性。
> 3. `predicate` 的 `values` 数组就是你在弹窗界面中可选的**关系动作列表**。你可以随意增加或修改这个列表以适合你的标注任务（例如加入 "driving", "carrying" 等）。工具在启动时会**自动动态读取**这个 `values` 数组作为下拉框选项。

### 第 2 步：如何使用工具？
1. **启动工具**：在标注界面的左侧边栏，点击网络节点状的图标（关系标注工具，快捷键 `R`），会弹出关系标注面板。
2. **选择主体/客体**：在画面中先通过常规多边形/矩形框出两个实体（例如一辆车，一个人）。然后在左侧列表点击人设为“主体”，点击车设为“客体”。
3. **选择动作并插入**：在顶部表单选择谓词（如 `riding`），点击“插入队列”。
4. **生成关系**：检查右侧排队列表，确认无误后点击“执行生成”。系统会在两点之间生成一条带方向和属性的专属 `Relation` Track。
5. **内嵌播放器探索**：按 `F` 播放下一帧，按 `D` 回收上一帧，检查长时序中实体的关系是否持续稳定。

### 第 3 步：何时使用“一键重排清洗”？
当你跨越数十帧甚至数百帧进行标注后，如果遇到了：
- 导出数据集时发现 Track ID 有跳号（如 `1, 2, 5, 8`）。
- 试图进行复杂关系替换时发现某些点在某些帧中发生了“相互缠绕”或位置重置（所谓帧冲突 bug）。

**解决方法**：在右上方点击红色的【一键重排清洗】按钮。引擎会在后台导出完整的 JSON 缓存，重新从小到大将所有连续的对象的 ID 进行内存级梳洗并导回，整个过程安全且无感知。

---

## 🛠 功能概览与架构

| 功能 | 说明 |
|------|------|
| **关系创建** | 在弹窗内选择主体 → 谓词 → 客体，一键添加关系三元组 |
| **批量生成** | 支持将多条关系放入"待生成队列"后一次性提交 |
| **ID重排引擎** | 基于 `annotations.export()` / `import()` 的端到端 ID 重排，彻底根绝差值 Track 对象的覆盖冲突 |
| **定制化播放器** | 纯净的 `antd` 内嵌播放器，绝不污染外层 CVAT 样式 |
| **原生快捷键** | 底层穿透监听：`D`(上一), `F`(下一), `C`(退10), `V`(进10), `Space`(播放) |
| **实时搜索** | 高性能左侧边栏：秒速过滤画面中的百级别实体 |

---

## 📂 核心代码分布与定制指南

如果你想二次开发，核心代码分布如下：

```
cvat-ui/src/
├── components/
│   ├── annotation-page/standard-workspace/controls-side-bar/
│   │   └── relation-control.tsx          # 工具栏图标：修改外观请编辑此文件 (纯 SVG 模式)
│   └── relation-dialog/
│       ├── relation-dialog.tsx           # UI 中枢：弹窗界面、表单、播放栏、快捷键挂载点
│       └── styles.scss                   # 仅限于本弹窗的独立无污染样式
├── containers/
│   └── annotation-page/standard-workspace/controls-side-bar/
│       └── relation-control.tsx          # 业务大脑：Redux 数据获取 / JSON export 洗帧逻辑 / 关系坐标差值算法
```

### 深入了解设计决策

#### 1. 关于内嵌播放器与快捷键
因为 CVAT 原生的长宽高和按键热图绑定了整个屏幕视图的 Redux 树。嵌入弹窗必然引发事件冒泡雪崩。所以我使用 `window.addEventListener('keydown', e, true)` 在 JS 的**事件捕获第一阶段强行拦截**，并在触发有效快捷键后执行 `e.stopPropagation()`，成功绕过了原生冲突。

#### 2. 关于生成的 `Relation` 实体去向
生成的其实是一个类型为 `ObjectType.TRACK`，形状为 `ShapeType.POINTS` 的虚拟中心轨迹。因为绑定了连续的 `keyframe=true`，只要主体客体任意一个消亡（`outside=true`），这根连接线也会在下一帧彻底切断并消失。

---

> 通过 `yarn run build` 进行前端热构建并刷新页面食用。
