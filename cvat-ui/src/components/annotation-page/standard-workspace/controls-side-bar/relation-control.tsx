// Copyright (C) 2026 CVAT Relation Tool Contributors
// SPDX-License-Identifier: MIT

import React from 'react';
import Icon from '@ant-design/icons';
import { Canvas } from 'cvat-canvas-wrapper';
import { ActiveControl } from 'reducers';
import CVATTooltip from 'components/common/cvat-tooltip';

// 自定义 SVG 组件，采用 CVAT 原生 40x40 线条系风格，保持极度锐利
const RelationIconSvg = (): JSX.Element => (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
        {/* 左下节点 */}
        <circle cx="10" cy="28" r="4" />
        {/* 顶部节点 */}
        <circle cx="20" cy="12" r="4" />
        {/* 右下节点 */}
        <circle cx="30" cy="28" r="4" />
        {/* 连接线 */}
        <line x1="12" y1="25" x2="18" y2="15" />
        <line x1="28" y1="25" x2="22" y2="15" />
    </svg>
);

interface Props {
    canvasInstance: Canvas;
    activeControl: ActiveControl;
    onOpenDialog: () => void;
}

function RelationControl(props: Props): JSX.Element {
    const { onOpenDialog } = props;

    return (
        <CVATTooltip title="生成关系标注 (R)" placement="right">
            <Icon
                component={RelationIconSvg}
                className="cvat-relation-control"
                onClick={onOpenDialog}
            />
        </CVATTooltip>
    );
}

export default React.memo(RelationControl);
