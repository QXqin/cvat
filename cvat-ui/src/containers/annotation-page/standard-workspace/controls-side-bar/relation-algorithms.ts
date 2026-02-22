// relation-algorithms.ts

interface Point {
    x: number;
    y: number;
}

interface Box {
    xtl: number;
    ytl: number;
    xbr: number;
    ybr: number;
    width: number;
    height: number;
}

/**
 * 职责: 管理每帧已占用的关系点坐标，防止新生成的关系点重叠。
 */
export class PositionManager {
    // 维护字典: {frame_id: string -> Point[]}
    // key 是 frame number, value 是该帧所有已占用的点列表
    private occupiedPositions: Map<number, Point[]> = new Map();

    constructor() {
        // 前端初始化时为空，后续在生成过程中动态添加，或者预先扫描当前帧的已有标注
    }

    /**
     * 注册一个已占用的点
     */
    addPosition(frame: number, x: number, y: number) {
        if (!this.occupiedPositions.has(frame)) {
            this.occupiedPositions.set(frame, []);
        }
        this.occupiedPositions.get(frame)?.push({ x, y });
    }

    /**
     * 检查新坐标是否有效（碰撞检测）
     */
    isPositionValid(frame: number, x: number, y: number, minDistance: number): boolean {
        const existingPoints = this.occupiedPositions.get(frame);
        if (!existingPoints || existingPoints.length === 0) {
            return true;
        }

        for (const p of existingPoints) {
            // 计算欧几里得距离
            const distance = Math.sqrt(Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2));
            if (distance < minDistance) {
                return false; // 冲突
            }
        }
        return true;
    }
}

/**
 * 计算 9 个候选坐标 (优先级递减)
 * 1. 中心点
 * 2. 四角（左上、右上、左下、右下）
 * 3. 四边中点（上、下、左、右）
 */
export function calculatePriorityPositions(box: Box, offset: number = 5): Point[] {
    const { xtl, ytl, xbr, ybr, width, height } = box;
    const cx = xtl + width / 2;
    const cy = ytl + height / 2;

    return [
        // 1. 中心点
        { x: cx, y: cy },
        // 2. 四角 (带 offset 防止贴边)
        { x: xtl + offset, y: ytl + offset }, // 左上
        { x: xbr - offset, y: ytl + offset }, // 右上
        { x: xtl + offset, y: ybr - offset }, // 左下
        { x: xbr - offset, y: ybr - offset }, // 右下
        // 3. 四边中点
        { x: cx, y: ytl + offset },           // 上中
        { x: cx, y: ybr - offset },           // 下中
        { x: xtl + offset, y: cy },           // 左中
        { x: xbr - offset, y: cy },           // 右中
    ];
}

/**
 * 辅助：从 CVAT ObjectState 提取 Box（支持所有形状类型）
 *
 * - Rectangle: 直接使用 [xtl, ytl, xbr, ybr]
 * - 其他形状: 从 points [x1,y1,x2,y2,...] 计算包围盒
 */
export function getBoxFromState(state: any): Box | null {
    if (!state || !state.points || state.points.length < 2) return null;

    const points: number[] = state.points;

    // 提取所有 x 坐标和 y 坐标
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < points.length - 1; i += 2) {
        xs.push(points[i]);
        ys.push(points[i + 1]);
    }

    if (xs.length === 0 || ys.length === 0) return null;

    const xtl = Math.min(...xs);
    const ytl = Math.min(...ys);
    const xbr = Math.max(...xs);
    const ybr = Math.max(...ys);

    return {
        xtl, ytl, xbr, ybr,
        width: xbr - xtl,
        height: ybr - ytl,
    };
}
