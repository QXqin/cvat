// Copyright (C) 2026 CVAT Relation Tool Contributors
// SPDX-License-Identifier: MIT

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
 * Responsibility: Manage occupied relation point coordinates per frame
 * to prevent overlapping of newly generated relation points.
 */
export class PositionManager {
    // Dictionary mapping: {frame_id: number -> Point[]}
    // key is frame number, value is the list of all occupied points in that frame
    private occupiedPositions: Map<number, Point[]> = new Map();

    constructor() {
        // Initialized empty on the frontend, dynamically added during generation,
        // or pre-scanned from existing annotations in the current frame.
    }

    /**
     * Register an occupied point.
     * @param frame The frame number
     * @param x The X coordinate
     * @param y The Y coordinate
     */
    addPosition(frame: number, x: number, y: number) {
        if (!this.occupiedPositions.has(frame)) {
            this.occupiedPositions.set(frame, []);
        }
        this.occupiedPositions.get(frame)?.push({ x, y });
    }

    /**
     * Check if new coordinates are valid (collision detection).
     * @param frame The frame number
     * @param x The X coordinate to check
     * @param y The Y coordinate to check
     * @param minDistance The minimum required distance from existing points
     * @returns True if valid (no collision), false otherwise
     */
    isPositionValid(frame: number, x: number, y: number, minDistance: number): boolean {
        const existingPoints = this.occupiedPositions.get(frame);
        if (!existingPoints || existingPoints.length === 0) {
            return true;
        }

        for (const p of existingPoints) {
            // Calculate Euclidean distance
            const distance = Math.sqrt(Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2));
            if (distance < minDistance) {
                return false; // Collision detected
            }
        }
        return true;
    }
}

/**
 * Calculate 9 candidate coordinates (in decreasing priority order).
 * 1. Center point
 * 2. Four corners (Top-Left, Top-Right, Bottom-Left, Bottom-Right)
 * 3. Four edge midpoints (Top, Bottom, Left, Right)
 *
 * @param box The bounding box geometry
 * @param offset The inset offset from the edges to prevent sticking to the boundary
 * @returns Array of candidate Points
 */
export function calculatePriorityPositions(box: Box, offset: number = 5): Point[] {
    const { xtl, ytl, xbr, ybr, width, height } = box;
    const cx = xtl + width / 2;
    const cy = ytl + height / 2;

    return [
        // 1. Center point
        { x: cx, y: cy },
        // 2. Four corners (with offset to prevent sticking to edges)
        { x: xtl + offset, y: ytl + offset }, // Top-Left
        { x: xbr - offset, y: ytl + offset }, // Top-Right
        { x: xtl + offset, y: ybr - offset }, // Bottom-Left
        { x: xbr - offset, y: ybr - offset }, // Bottom-Right
        // 3. Four edge midpoints
        { x: cx, y: ytl + offset },           // Top-Middle
        { x: cx, y: ybr - offset },           // Bottom-Middle
        { x: xtl + offset, y: cy },           // Left-Middle
        { x: xbr - offset, y: cy },           // Right-Middle
    ];
}

/**
 * Helper: Extract an oriented Box from CVAT's ObjectState (supports all shape types).
 *
 * - Rectangle: Directly uses [xtl, ytl, xbr, ybr]
 * - Other shapes: Calculates the bounding box from points [x1, y1, x2, y2, ...]
 *
 * @param state CVAT ObjectState instance
 * @returns The bounding Box object, or null if invalid
 */
export function getBoxFromState(state: any): Box | null {
    if (!state || !state.points || state.points.length < 2) return null;

    const points: number[] = state.points;

    // Extract all x and y coordinates
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
