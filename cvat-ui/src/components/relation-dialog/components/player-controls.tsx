// Copyright (C) 2026 CVAT Relation Tool Contributors
// SPDX-License-Identifier: MIT

import React from 'react';
import { Button, Slider, InputNumber, Tooltip } from 'antd';
import { FastBackwardOutlined, StepBackwardOutlined, CaretRightOutlined, PauseOutlined, StepForwardOutlined, FastForwardOutlined } from '@ant-design/icons';
import { useI18n, Language } from '../i18n';

interface PlayerControlsProps {
    jobInstance: any;
    safeFrameNum: number;
    playing: boolean;
    lang: Language;
    onChangeFrame?: (toFrame: number) => void;
    onSwitchPlay?: (playing: boolean) => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
    jobInstance,
    safeFrameNum,
    playing,
    lang,
    onChangeFrame,
    onSwitchPlay,
}) => {
    const t = useI18n(lang);

    return (
        <div className="cvat-relation-dialog-player-section">
            <div className="cvat-relation-dialog-player-container">
                <div className="cvat-relation-dialog-player-buttons">
                    <Tooltip title={t('firstFrame')}>
                        <Button type="text" size="small" icon={<FastBackwardOutlined />} onClick={() => onChangeFrame && onChangeFrame(jobInstance.startFrame)} className="cvat-relation-dialog-player-btn" />
                    </Tooltip>
                    <Tooltip title={t('prevFrame')}>
                        <Button type="text" size="small" icon={<StepBackwardOutlined />} onClick={() => onChangeFrame && onChangeFrame(Math.max(jobInstance.startFrame, safeFrameNum - 1))} className="cvat-relation-dialog-player-btn" />
                    </Tooltip>
                    <Tooltip title={t('playPause')}>
                        <Button type="text" size="small" icon={playing ? <PauseOutlined /> : <CaretRightOutlined />} onClick={() => onSwitchPlay && onSwitchPlay(!playing)} className="cvat-relation-dialog-player-btn" />
                    </Tooltip>
                    <Tooltip title={t('nextFrame')}>
                        <Button type="text" size="small" icon={<StepForwardOutlined />} onClick={() => onChangeFrame && onChangeFrame(Math.min(jobInstance.stopFrame, safeFrameNum + 1))} className="cvat-relation-dialog-player-btn" />
                    </Tooltip>
                    <Tooltip title={t('lastFrame')}>
                        <Button type="text" size="small" icon={<FastForwardOutlined />} onClick={() => onChangeFrame && onChangeFrame(jobInstance.stopFrame)} className="cvat-relation-dialog-player-btn" />
                    </Tooltip>
                </div>

                <div className="cvat-relation-dialog-player-slider">
                    <Slider
                        min={jobInstance?.startFrame ?? 0}
                        max={jobInstance?.stopFrame ?? 0}
                        value={safeFrameNum}
                        onChange={(val) => onChangeFrame && onChangeFrame(val)}
                        tooltip={{ open: false }}
                    />
                </div>

                <div className="cvat-relation-dialog-player-input">
                    <InputNumber
                        size="small"
                        min={jobInstance?.startFrame ?? 0}
                        max={jobInstance?.stopFrame ?? 0}
                        value={safeFrameNum}
                        onChange={(val) => onChangeFrame && onChangeFrame(Number(val) || 0)}
                    />
                </div>
            </div>
        </div>
    );
};
