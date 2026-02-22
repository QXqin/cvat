// Copyright (C) 2026 CVAT Relation Tool Contributors
// SPDX-License-Identifier: MIT

import React from 'react';
import Icon from '@ant-design/icons';
import { Canvas } from 'cvat-canvas-wrapper';
import { ActiveControl } from 'reducers';
import CVATTooltip from 'components/common/cvat-tooltip';

/**
 * Custom SVG icon component for the Relation Tool sidebar button.
 * Follows CVAT's native 40x40 stroke-based icon design for sharp rendering at small sizes.
 */
const RelationIconSvg = (): JSX.Element => (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
        {/* Bottom-left node */}
        <circle cx="10" cy="28" r="4" />
        {/* Top-center node */}
        <circle cx="20" cy="12" r="4" />
        {/* Bottom-right node */}
        <circle cx="30" cy="28" r="4" />
        {/* Connecting edges */}
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
        <CVATTooltip title="Relation Annotation Tool (R)" placement="right">
            <Icon
                component={RelationIconSvg}
                className="cvat-relation-control"
                onClick={onOpenDialog}
            />
        </CVATTooltip>
    );
}

export default React.memo(RelationControl);
