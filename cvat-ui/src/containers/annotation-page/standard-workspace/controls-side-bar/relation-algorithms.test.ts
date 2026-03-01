// Copyright (C) 2026 CVAT Relation Tool Contributors
// SPDX-License-Identifier: MIT

import { PositionManager, calculatePriorityPositions, getBoxFromState } from './relation-algorithms';

describe('relation-algorithms', () => {
    describe('PositionManager', () => {
        let pm: PositionManager;

        beforeEach(() => {
            pm = new PositionManager();
        });

        it('should allow placement if no positions exist', () => {
            expect(pm.isPositionValid(1, 100, 100, 10)).toBe(true);
        });

        it('should detect collisions and reject invalid positions', () => {
            pm.addPosition(1, 100, 100);
            pm.addPosition(1, 200, 200);

            // Too close to (100, 100), dist = 5 < 10
            expect(pm.isPositionValid(1, 105, 100, 10)).toBe(false);

            // Too close to (200, 200), dist = Math.sqrt(8) < 10
            expect(pm.isPositionValid(1, 198, 198, 10)).toBe(false);

            // Far away
            expect(pm.isPositionValid(1, 300, 300, 10)).toBe(true);
        });

        it('should isolate frames properly', () => {
            pm.addPosition(1, 100, 100);

            expect(pm.isPositionValid(1, 100, 100, 10)).toBe(false);
            expect(pm.isPositionValid(2, 100, 100, 10)).toBe(true); // isolated frame
        });
    });

    describe('calculatePriorityPositions', () => {
        it('should calculate exactly 9 positions', () => {
            const box = { xtl: 0, ytl: 0, xbr: 100, ybr: 100, width: 100, height: 100 };
            const positions = calculatePriorityPositions(box, 5);

            expect(positions).toHaveLength(9);

            // Center
            expect(positions[0]).toEqual({ x: 50, y: 50 });
            // Top-Left with offset
            expect(positions[1]).toEqual({ x: 5, y: 5 });
            // Bottom-Right with offset
            expect(positions[4]).toEqual({ x: 95, y: 95 });
        });
    });

    describe('getBoxFromState', () => {
        it('should handle missing points', () => {
            expect(getBoxFromState(null)).toBeNull();
            expect(getBoxFromState({ points: [] })).toBeNull();
            expect(getBoxFromState({ points: [100] })).toBeNull(); // Less than 2 (x, y) coordinates
        });

        it('should extract correct bounding box for a standard rectangle', () => {
            const state = { points: [10, 20, 110, 120] }; // x1, y1, x2, y2
            const box = getBoxFromState(state);

            expect(box).toEqual({
                xtl: 10,
                ytl: 20,
                xbr: 110,
                ybr: 120,
                width: 100,
                height: 100,
            });
        });

        it('should encapsulate complex polygons', () => {
            const state = { points: [50, 0, 100, 50, 50, 100, 0, 50] }; // Diamond shape
            const box = getBoxFromState(state);

            expect(box).toEqual({
                xtl: 0,
                ytl: 0,
                xbr: 100,
                ybr: 100,
                width: 100,
                height: 100,
            });
        });
    });
});
