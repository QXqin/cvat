// Copyright (C) 2026 CVAT Relation Tool Contributors
// SPDX-License-Identifier: MIT

import { useEffect } from 'react';

interface UseKeyboardShortcutsProps {
    visible: boolean;
    jobInstance: any;
    safeFrameNum: number;
    playing: boolean;
    onChangeFrame?: (toFrame: number) => void;
    onSwitchPlay?: (playing: boolean) => void;
}

export function useKeyboardShortcuts({
    visible,
    jobInstance,
    safeFrameNum,
    playing,
    onChangeFrame,
    onSwitchPlay,
}: UseKeyboardShortcutsProps) {
    useEffect(() => {
        if (!visible) return undefined;
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            if (e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                e.stopPropagation();
                onChangeFrame && onChangeFrame(Math.max(jobInstance.startFrame, safeFrameNum - 1));
            } else if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                e.stopPropagation();
                onChangeFrame && onChangeFrame(Math.min(jobInstance.stopFrame, safeFrameNum + 1));
            } else if (e.key === 'v' || e.key === 'V') {
                e.preventDefault();
                e.stopPropagation();
                onChangeFrame && onChangeFrame(Math.min(jobInstance.stopFrame, safeFrameNum + 10));
            } else if (e.key === 'c' || e.key === 'C') {
                e.preventDefault();
                e.stopPropagation();
                onChangeFrame && onChangeFrame(Math.max(jobInstance.startFrame, safeFrameNum - 10));
            } else if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onSwitchPlay && onSwitchPlay(!playing);
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [visible, safeFrameNum, playing, jobInstance, onChangeFrame, onSwitchPlay]);
}
