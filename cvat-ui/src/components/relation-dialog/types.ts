// Copyright (C) 2026 CVAT Relation Tool Contributors
// SPDX-License-Identifier: MIT

import { NavigationType } from 'reducers';

export interface AnnotationObject {
    clientID: number;
    serverID: number | null;
    trackID: number;        // XML track ID (0-based) = clientID - 1
    label: any;
    objectType: 'shape' | 'track';
    color: string;
}

export interface RelationSpec {
    subject_id: number;
    object_id: number;
    predicate: string;
    frame: number;
    subject_client_id: number;
    object_client_id: number;
    _subject_display_label: string;
    _object_display_label: string;
}

export interface ExistingRelation {
    clientID: number;
    serverID: number | null;
    subject_id: string;
    object_id: string;
    predicate: string;
    displaySubjectLabel: string;
    displayObjectLabel: string;
    annotationObject: any;
}

export interface RelationDialogProps {
    visible: boolean;
    jobInstance: any;
    currentFrame: number | any;
    playing: boolean;
    navigationType: NavigationType;
    frameFilename: string;
    onClose: () => void;
    onGenerate: (relations: RelationSpec[], minDistance: number) => Promise<void>;
    onChangeFrame?: (toFrame: number) => void;
    onSwitchPlay?: (playing: boolean) => void;
    setNavigationType?: (navigationType: NavigationType) => void;
    searchAnnotations?: (sessionInstance: any, frameFrom: number, frameTo: number, generalFilters?: any) => void;
}
