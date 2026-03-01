// Copyright (C) 2026 CVAT Relation Tool Contributors
// SPDX-License-Identifier: MIT

import { useState, useCallback } from 'react';
import { AnnotationObject, ExistingRelation } from '../types';

export function useAnnotations(jobInstance: any, safeFrameNum: number) {
    const [availableObjects, setAvailableObjects] = useState<AnnotationObject[]>([]);
    const [existingRelations, setExistingRelations] = useState<ExistingRelation[]>([]);
    const [predicateOptions, setPredicateOptions] = useState<string[]>([]);
    const [debugInfo, setDebugInfo] = useState<string>('');
    const [selectedSubjectClientID, setSelectedSubjectClientID] = useState<number | null>(null);

    const loadAnnotations = useCallback(async () => {
        if (!jobInstance) return;
        try {
            const states = await jobInstance.annotations.get(safeFrameNum);
            let logs = [`Frame: ${safeFrameNum}`, `Total states: ${states.length}`];

            const relationLabelDef = jobInstance.labels.find((l: any) => l.name.toLowerCase() === 'relation');
            if (relationLabelDef) {
                const predicateAttr = relationLabelDef.attributes.find((a: any) => a.name === 'predicate');
                if (predicateAttr && predicateAttr.values && predicateAttr.values.length > 0) {
                    setPredicateOptions([...predicateAttr.values]);
                    logs.push(`Loaded predicate config: ${predicateAttr.values.length} options`);
                } else {
                    logs.push('Warning: predicate attribute not found or empty, using built-in fallback list');
                    setPredicateOptions(['near', 'holding', 'riding', 'wearing', 'next_to', 'behind', 'in_front_of', 'above', 'below', 'parked on']);
                }
            } else {
                logs.push('Warning: Relation label not defined in project, using built-in fallback list');
                setPredicateOptions(['near', 'holding', 'riding', 'wearing', 'next_to', 'behind', 'in_front_of', 'above', 'below', 'parked on']);
            }

            const objects: AnnotationObject[] = states
                .filter((state: any) => {
                    const labelName = state.label?.name || '';
                    return labelName.toLowerCase() !== 'relation' && !state.outside && !state.hidden && !state.removed;
                })
                .map((state: any) => ({
                    clientID: state.clientID,
                    serverID: state.serverID !== undefined ? state.serverID : null,
                    trackID: state.clientID - 1,
                    label: state.label,
                    objectType: state.objectType,
                    color: state.label.color,
                }));

            objects.sort((a, b) => a.clientID - b.clientID);

            const lookupMap = new Map<string, AnnotationObject>();
            objects.forEach(obj => {
                lookupMap.set(String(obj.clientID), obj);
                lookupMap.set(String(obj.trackID), obj);
                if (obj.serverID !== null) {
                    lookupMap.set(String(obj.serverID), obj);
                }
            });

            setAvailableObjects(objects);
            logs.push(`Valid entity objects: ${objects.length}`);

            setSelectedSubjectClientID((prevSelected) => {
                if (objects.length > 0) {
                    const stillExists = objects.find(o => o.clientID === prevSelected);
                    return stillExists ? prevSelected : objects[0].clientID;
                }
                return null;
            });

            setExistingRelations([]);
            if (relationLabelDef) {
                const existingList = states
                    .filter((state: any) => state.label.id === relationLabelDef.id && !state.removed)
                    .map((state: any) => {
                        const getAttr = (name: string) => {
                            const attrDef = state.label.attributes.find((a: any) => a.name.toLowerCase() === name.toLowerCase());
                            return attrDef ? String(state.attributes[attrDef.id]) : '';
                        };

                        const rawSubj = getAttr('subject_id');
                        const rawObj = getAttr('object_id');
                        const predicate = getAttr('predicate');

                        const subjObj = lookupMap.get(rawSubj);
                        const objObj = lookupMap.get(rawObj);

                        const formatName = (obj: AnnotationObject | undefined, rawId: string) => {
                            if (!obj) return `ID:${rawId} (not visible)`;
                            return `#${obj.clientID} ${obj.label.name}`;
                        };

                        return {
                            clientID: state.clientID,
                            serverID: state.serverID,
                            subject_id: rawSubj,
                            object_id: rawObj,
                            predicate: predicate,
                            displaySubjectLabel: formatName(subjObj, rawSubj),
                            displayObjectLabel: formatName(objObj, rawObj),
                            annotationObject: state,
                        };
                    });

                setExistingRelations(existingList);
                logs.push(`Parsed relations: ${existingList.length}`);
            }

            setDebugInfo(logs.join('\n'));

        } catch (error: any) {
            console.error(error);
            setDebugInfo(`Error: ${error.message}`);
        }
    }, [jobInstance, safeFrameNum]);

    return {
        availableObjects,
        existingRelations,
        setExistingRelations,
        predicateOptions,
        debugInfo,
        setDebugInfo,
        selectedSubjectClientID,
        setSelectedSubjectClientID,
        loadAnnotations,
    };
}
