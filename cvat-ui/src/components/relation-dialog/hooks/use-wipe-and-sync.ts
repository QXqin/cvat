// Copyright (C) 2026 CVAT Relation Tool Contributors
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { Modal } from 'antd';
import { Language, useI18n } from '../i18n';

export function useWipeAndSync(jobInstance: any, lang: Language, setDebugInfo: (info: string) => void) {
    const [loading, setLoading] = useState(false);
    const t = useI18n(lang);

    const handleWipeAndSync = async () => {
        Modal.confirm({
            title: t('confirmWipeTitle'),
            content: t('confirmWipeContent'),
            okText: t('confirmWipeOk'),
            okType: 'danger',
            cancelText: t('cancel'),
            onOk: async () => {
                try {
                    setLoading(true);
                    setDebugInfo('Exporting raw serialized collection...');

                    const collection = await jobInstance.annotations.export();
                    const relationLabelDef = jobInstance.labels.find((l: any) => l.name.toLowerCase() === 'relation');
                    const relationLabelId = relationLabelDef ? relationLabelDef.id : null;

                    const entityShapes: any[] = [];
                    const relationShapes: any[] = [];
                    (collection.shapes || []).forEach((s: any) => {
                        if (relationLabelId && s.label_id === relationLabelId) {
                            relationShapes.push(s);
                        } else {
                            entityShapes.push(s);
                        }
                    });

                    const entityTracks: any[] = [];
                    const relationTracks: any[] = [];
                    (collection.tracks || []).forEach((t: any) => {
                        if (relationLabelId && t.label_id === relationLabelId) {
                            relationTracks.push(t);
                        } else {
                            entityTracks.push(t);
                        }
                    });

                    const sortedShapes = [...entityShapes, ...relationShapes];
                    const sortedTracks = [...entityTracks, ...relationTracks];

                    const allEntities = [...entityShapes, ...entityTracks];
                    const allRelations = [...relationShapes, ...relationTracks];
                    const lookupMap = new Map<number, number>();

                    let newIdx = 0;
                    allEntities.forEach((item: any) => {
                        if (item.id !== undefined && item.id !== null) {
                            lookupMap.set(item.id, newIdx);
                        }
                        newIdx++;
                    });
                    allRelations.forEach((item: any) => {
                        if (item.id !== undefined && item.id !== null) {
                            lookupMap.set(item.id, newIdx);
                        }
                        newIdx++;
                    });

                    setDebugInfo(`Entities: ${allEntities.length}, Relations: ${allRelations.length}, Map size: ${lookupMap.size}`);

                    if (relationLabelDef) {
                        const subjAttrDef = relationLabelDef.attributes.find((a: any) => a.name.toLowerCase() === 'subject_id');
                        const objAttrDef = relationLabelDef.attributes.find((a: any) => a.name.toLowerCase() === 'object_id');

                        const fixAttrs = (attrs: any[]) => {
                            if (!attrs) return;
                            attrs.forEach((attr: any) => {
                                if (subjAttrDef && attr.spec_id === subjAttrDef.id) {
                                    const oldVal = parseInt(attr.value, 10);
                                    if (!isNaN(oldVal) && lookupMap.has(oldVal)) {
                                        attr.value = String(lookupMap.get(oldVal));
                                    }
                                }
                                if (objAttrDef && attr.spec_id === objAttrDef.id) {
                                    const oldVal = parseInt(attr.value, 10);
                                    if (!isNaN(oldVal) && lookupMap.has(oldVal)) {
                                        attr.value = String(lookupMap.get(oldVal));
                                    }
                                }
                            });
                        };

                        relationShapes.forEach((s: any) => fixAttrs(s.attributes));
                        relationTracks.forEach((t: any) => fixAttrs(t.attributes));
                    }

                    const stripIds = (item: any) => {
                        delete item.id;
                        delete item.clientID;
                        if (item.shapes) {
                            item.shapes.forEach((s: any) => { delete s.id; });
                        }
                        if (item.elements) {
                            item.elements.forEach((el: any) => stripIds(el));
                        }
                    };

                    sortedShapes.forEach(stripIds);
                    sortedTracks.forEach(stripIds);
                    const sortedTags = (collection.tags || []).map((t: any) => {
                        const copy = { ...t };
                        delete copy.id;
                        delete copy.clientID;
                        return copy;
                    });

                    setDebugInfo('Clearing DB and injecting sorted data...');
                    await jobInstance.annotations.clear({ reload: false });
                    await jobInstance.annotations.import({
                        shapes: sortedShapes,
                        tracks: sortedTracks,
                        tags: sortedTags,
                    });
                    await jobInstance.annotations.save();

                    setDebugInfo('Operation complete! Reloading page...');
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                } catch (error: any) {
                    console.error(error);
                    Modal.error({ title: t('wipeFailed'), content: error.message });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    return { wipeLoading: loading, handleWipeAndSync };
}
