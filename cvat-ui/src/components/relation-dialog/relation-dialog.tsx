import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Select, Button, message, Table, List, Tag, Badge, Collapse, Input, Slider, InputNumber, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, LeftOutlined, RightOutlined, AimOutlined, BugOutlined, SyncOutlined, SearchOutlined, FastBackwardOutlined, StepBackwardOutlined, CaretRightOutlined, PauseOutlined, StepForwardOutlined, FastForwardOutlined } from '@ant-design/icons';
import './styles.scss';
import { getCore } from 'cvat-core-wrapper';
import { NavigationType, Workspace } from 'reducers';
import { Row, Col } from 'antd/lib/grid';

// ================= I18N Dictionary =================
const I18N = {
    en: {
        title: 'Relation Annotation Tool',
        wipeAndSync: 'Wipe & Sync',
        close: 'Close',
        firstFrame: 'First Frame',
        prevFrame: 'Previous Frame (D)',
        playPause: 'Play/Pause (Space)',
        nextFrame: 'Next Frame (F)',
        lastFrame: 'Last Frame',
        searchPlaceholder: 'Search ID / Label / ServerID',
        objects: 'Objects',
        noMatches: 'No matches found',
        selectSubject: 'Please select a subject from the left panel',
        createRelation: 'Create Relation',
        subject: 'Subject',
        predicate: 'Predicate',
        object: 'Object',
        selectPredicate: 'Select Predicate',
        selectObject: 'Select Object',
        add: 'Add',
        genQueue: 'Generation Queue',
        generate: 'Generate',
        savedRelations: 'Saved Relations for this object',
        none: 'None',
        action: 'Action',
        delete: 'Delete',
        debugLog: 'Debug Log',
        warningSameValue: 'Subject and object cannot be the same',
        errorNotSaved: 'Objects not saved. Please save first (Ctrl+S)',
        warningExists: 'This relation already exists in the queue',
        addedToQueue: 'Added to queue',
        markedDeletion: 'Marked for deletion',
        deletionFailed: 'Deletion failed',
        genCommandSent: 'Generation command sent',
        genFailed: 'Generation failed:',
        confirmWipeTitle: 'Confirm Wipe & Sync?',
        confirmWipeContent: 'This will collect all annotations in the current job, flatten them into a continuous ID space, re-sort them (shapes first, relations last), and forcibly re-import to flush CVAT\'s backend sequential IDs. Note: old serverIDs will be invalidated.',
        confirmWipeOk: 'Confirm Wipe & Sync',
        cancel: 'Cancel',
        wipeFailed: 'Wipe Failed'
    },
    zh: {
        title: '关系标注工具',
        wipeAndSync: ' 一键重排清洗(Wipe & Sync)',
        close: '关闭',
        firstFrame: '第一帧',
        prevFrame: '上一帧 (D)',
        playPause: '播放/暂停 (Space)',
        nextFrame: '下一帧 (F)',
        lastFrame: '最后一帧',
        searchPlaceholder: '搜索 ID / 标签 / ServerID',
        objects: '可用对象',
        noMatches: '未找到匹配项',
        selectSubject: '请从左侧面板选择一个主体',
        createRelation: '创建关系',
        subject: '主体 (Subject)',
        predicate: '谓词 (Predicate)',
        object: '客体 (Object)',
        selectPredicate: '选择谓词',
        selectObject: '选择客体',
        add: '添加',
        genQueue: '生成队列',
        generate: '生成',
        savedRelations: '该对象的已存关系',
        none: '无',
        action: '操作',
        delete: '删除',
        debugLog: '调试日志',
        warningSameValue: '主体和客体不能是同一个对象',
        errorNotSaved: '对象尚未保存。请先保存(Ctrl+S)',
        warningExists: '该关系已存在于队列中',
        addedToQueue: '已添加到队列',
        markedDeletion: '已标记为删除',
        deletionFailed: '删除失败',
        genCommandSent: '生成命令已发送',
        genFailed: '生成失败:',
        confirmWipeTitle: '确认执行 Wipe & Sync？',
        confirmWipeContent: '此操作将收集当前任务的所有标注，将其 ID 映射到连续空间，并重新导入 CVAT 以消除 ID 碎片。注意：这会导致旧的 Server ID 失效。',
        confirmWipeOk: '确认清洗',
        cancel: '取消',
        wipeFailed: '清洗失败'
    }
};

// ================= Type Definitions =================

interface AnnotationObject {
    clientID: number;
    serverID: number | null;
    trackID: number;        // XML track ID (0-based) = clientID - 1
    label: any;
    objectType: 'shape' | 'track';
    color: string;
}

interface RelationSpec {
    subject_id: number;
    object_id: number;
    predicate: string;
    frame: number;
    subject_client_id: number;
    object_client_id: number;
    _subject_display_label: string;
    _object_display_label: string;
}

interface ExistingRelation {
    clientID: number;
    serverID: number | null;
    subject_id: string;
    object_id: string;
    predicate: string;
    displaySubjectLabel: string;
    displayObjectLabel: string;
    annotationObject: any;
}

interface RelationDialogProps {
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

const RelationDialog: React.FC<RelationDialogProps> = ({
    visible,
    jobInstance,
    currentFrame,
    playing,
    navigationType,
    frameFilename,
    onClose,
    onGenerate,
    onChangeFrame,
    onSwitchPlay,
    setNavigationType,
    searchAnnotations,
}) => {
    const [form] = Form.useForm();

    const [newRelations, setNewRelations] = useState<RelationSpec[]>([]);
    const [existingRelations, setExistingRelations] = useState<ExistingRelation[]>([]);
    const [loading, setLoading] = useState(false);

    // Data sources
    const [availableObjects, setAvailableObjects] = useState<AnnotationObject[]>([]);
    // Search filter
    const [searchTerm, setSearchTerm] = useState<string>('');
    // Currently selected subject clientID
    const [selectedSubjectClientID, setSelectedSubjectClientID] = useState<number | null>(null);
    // Debug log output
    const [debugInfo, setDebugInfo] = useState<string>('');
    // Dynamically loaded predicate options
    const [predicateOptions, setPredicateOptions] = useState<string[]>([]);
    // I18N State
    const [lang, setLang] = useState<'en' | 'zh'>('zh');
    const t = (key: keyof typeof I18N.en) => I18N[lang][key];

    const safeFrameNum = typeof currentFrame === 'object' && currentFrame !== null
        ? currentFrame.number
        : currentFrame;

    // ==== Keyboard shortcut interception ====
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
    }, [visible, safeFrameNum, playing, jobInstance]);

    useEffect(() => {
        if (visible && jobInstance) {
            loadAnnotations();
            setSearchTerm(''); // Reset search on open
        }
    }, [visible, jobInstance, safeFrameNum]);

    useEffect(() => {
        if (selectedSubjectClientID) {
            form.setFieldsValue({ subject_client_id: selectedSubjectClientID });
        }
    }, [selectedSubjectClientID, form]);

    const loadAnnotations = async () => {
        try {
            const states = await jobInstance.annotations.get(safeFrameNum);
            let logs = [`Frame: ${safeFrameNum}`, `Total states: ${states.length}`];

            // 1. Dynamically load predicate options from label config
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

            // 2. Extract entity objects (exclude Relation labels)
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

            // Build lookup map (clientID / trackID / serverID -> object)
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

            // Auto-select: reset to the first object if the previous subject is no longer visible
            if (objects.length > 0) {
                const stillExists = objects.find(o => o.clientID === selectedSubjectClientID);
                if (!stillExists) {
                    setSelectedSubjectClientID(objects[0].clientID);
                }
            } else {
                setSelectedSubjectClientID(null);
            }

            // 3. Parse existing relations
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
            } else {
                setExistingRelations([]);
            }

            setDebugInfo(logs.join('\n'));

        } catch (error: any) {
            console.error(error);
            setDebugInfo(`Error: ${error.message}`);
        }
    };

    // ================= Filter Logic =================

    const filteredObjects = useMemo(() => {
        if (!searchTerm) return availableObjects;
        const lowerTerm = searchTerm.toLowerCase();
        return availableObjects.filter(obj => {
            const matchID = String(obj.clientID).includes(lowerTerm);
            const matchLabel = obj.label.name.toLowerCase().includes(lowerTerm);
            const matchServerID = obj.serverID ? String(obj.serverID).includes(lowerTerm) : false;
            return matchID || matchLabel || matchServerID;
        });
    }, [searchTerm, availableObjects]);

    const getObjectOptions = () => {
        return availableObjects.map(obj => ({
            label: `#${obj.clientID} ${obj.label.name}${obj.serverID ? ` (${obj.serverID})` : ''}`,
            value: obj.clientID,
        }));
    };

    const addRelation = () => {
        form.validateFields(['subject_client_id', 'object_client_id', 'predicate'])
            .then((values) => {
                const { subject_client_id, object_client_id, predicate } = values;

                if (subject_client_id === object_client_id) {
                    message.warning(t('warningSameValue'));
                    return;
                }

                const subjObj = availableObjects.find(o => o.clientID === subject_client_id);
                const objObj = availableObjects.find(o => o.clientID === object_client_id);

                if (!subjObj || !objObj) return;

                if (subjObj.serverID === null || objObj.serverID === null) {
                    message.error(t('errorNotSaved'));
                    return;
                }

                const saveSubjID = subjObj.trackID;
                const saveObjID = objObj.trackID;

                const exists = newRelations.some(r =>
                    r.subject_id === saveSubjID &&
                    r.object_id === saveObjID &&
                    r.predicate === predicate
                );

                if (exists) {
                    message.warning(t('warningExists'));
                    return;
                }

                const newRel: RelationSpec = {
                    subject_id: saveSubjID,
                    object_id: saveObjID,
                    predicate: predicate,
                    frame: safeFrameNum,
                    subject_client_id: subjObj.clientID,
                    object_client_id: objObj.clientID,
                    _subject_display_label: `#${subjObj.clientID} ${subjObj.label.name}`,
                    _object_display_label: `#${objObj.clientID} ${objObj.label.name}`,
                };

                setNewRelations([...newRelations, newRel]);
                form.resetFields(['object_client_id']);
                message.success(t('addedToQueue'));
            });
    };

    const handleDeleteExisting = async (record: ExistingRelation) => {
        try {
            record.annotationObject.delete();
            message.success(t('markedDeletion'));
            setExistingRelations(prev => prev.filter(item => item.clientID !== record.clientID));
        } catch (error) {
            message.error(t('deletionFailed'));
        }
    };

    const handleGenerate = async () => {
        if (newRelations.length === 0) return;
        setLoading(true);
        try {
            const minDistance = form.getFieldValue('min_distance') || 10.0;
            const payload: RelationSpec[] = newRelations.map((rel) => ({
                subject_id: rel.subject_id,
                object_id: rel.object_id,
                predicate: rel.predicate,
                frame: rel.frame,
                subject_client_id: rel.subject_client_id,
                object_client_id: rel.object_client_id,
                _subject_display_label: rel._subject_display_label,
                _object_display_label: rel._object_display_label,
            }));
            await onGenerate(payload, minDistance);
            message.success(t('genCommandSent'));
            setNewRelations([]);
            setTimeout(loadAnnotations, 800);
        } catch (error: any) {
            message.error(`${t('genFailed')} ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const currentSubjectExistingRelations = useMemo(() => {
        if (!selectedSubjectClientID) return [];
        const currentSubj = availableObjects.find(o => o.clientID === selectedSubjectClientID);
        if (!currentSubj) return [];

        return existingRelations.filter(rel => {
            const rawSubj = rel.subject_id;
            return rawSubj === String(currentSubj.trackID);
        });
    }, [selectedSubjectClientID, existingRelations, availableObjects]);

    const getRelationCount = (obj: AnnotationObject) => {
        return existingRelations.filter(rel => {
            const rawSubj = rel.subject_id;
            return rawSubj === String(obj.trackID);
        }).length;
    };

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

                    // ====== Step 1: Use export() to get raw serialized collection ======
                    // This preserves the full multi-frame keyframes structure for tracks, unlike get()
                    const collection = await jobInstance.annotations.export();
                    // collection = { shapes: [...], tracks: [...], tags: [...] }

                    const relationLabelDef = jobInstance.labels.find((l: any) => l.name.toLowerCase() === 'relation');
                    const relationLabelId = relationLabelDef ? relationLabelDef.id : null;

                    // ====== Step 2: Separate shapes and tracks by Entity / Relation ======
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

                    // ====== Step 3: Sort - Entities first, Relations last ======
                    const sortedShapes = [...entityShapes, ...relationShapes];
                    const sortedTracks = [...entityTracks, ...relationTracks];

                    // Build Old ID -> New Index mapping (based on the merged order)
                    // Entities go first, then Relation annotations
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

                    // ====== Step 4: Fix subject_id / object_id attributes in Relations ======
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

                        // Fix relations in shapes
                        relationShapes.forEach((s: any) => fixAttrs(s.attributes));
                        // Fix relations in tracks (track-level attributes)
                        relationTracks.forEach((t: any) => fixAttrs(t.attributes));
                    }

                    // ====== Step 5: Strip old IDs to force CVAT to assign new sequential serverIDs ======
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

                    // ====== Step 6: Clear + Import + Save + Reload ======
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

    return (
        <Modal
            title={null}
            open={visible}
            onCancel={onClose}
            width={1000}
            footer={null}
            bodyStyle={{ padding: 0, height: '700px', display: 'flex', flexDirection: 'column' }}
        >
            {/* Header and Close buttons */}
            <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                <div style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SyncOutlined spin={loading} style={{ marginRight: 4 }} />
                    {t('title')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Button size="small" onClick={() => setLang(lang === 'en' ? 'zh' : 'en')} style={{ fontWeight: 'bold', color: lang === 'zh' ? '#1890ff' : '#666' }}>中 / EN</Button>
                    <Button type="primary" danger onClick={handleWipeAndSync}>
                        {t('wipeAndSync')}
                    </Button>
                    <Button onClick={onClose}>{t('close')}</Button>
                </div>
            </div>

            {/* Custom Embedded Player Controls */}
            <div style={{ padding: '6px 24px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 800 }}>
                    {/* Left button group */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <Tooltip title={t('firstFrame')}>
                            <Button type="text" size="small" icon={<FastBackwardOutlined />} onClick={() => onChangeFrame && onChangeFrame(jobInstance.startFrame)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} />
                        </Tooltip>
                        <Tooltip title={t('prevFrame')}>
                            <Button type="text" size="small" icon={<StepBackwardOutlined />} onClick={() => onChangeFrame && onChangeFrame(Math.max(jobInstance.startFrame, safeFrameNum - 1))} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} />
                        </Tooltip>
                        <Tooltip title={t('playPause')}>
                            <Button type="text" size="small" icon={playing ? <PauseOutlined /> : <CaretRightOutlined />} onClick={() => onSwitchPlay && onSwitchPlay(!playing)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} />
                        </Tooltip>
                        <Tooltip title={t('nextFrame')}>
                            <Button type="text" size="small" icon={<StepForwardOutlined />} onClick={() => onChangeFrame && onChangeFrame(Math.min(jobInstance.stopFrame, safeFrameNum + 1))} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} />
                        </Tooltip>
                        <Tooltip title={t('lastFrame')}>
                            <Button type="text" size="small" icon={<FastForwardOutlined />} onClick={() => onChangeFrame && onChangeFrame(jobInstance.stopFrame)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} />
                        </Tooltip>
                    </div>

                    {/* Centered Slider */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                        <Slider
                            style={{ width: '100%', margin: '0' }}
                            min={jobInstance?.startFrame ?? 0}
                            max={jobInstance?.stopFrame ?? 0}
                            value={safeFrameNum}
                            onChange={(val) => onChangeFrame && onChangeFrame(val)}
                            tooltip={{ open: false }}
                        />
                    </div>

                    {/* Right Frame Input */}
                    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        <InputNumber
                            size="small"
                            min={jobInstance?.startFrame ?? 0}
                            max={jobInstance?.stopFrame ?? 0}
                            value={safeFrameNum}
                            onChange={(val) => onChangeFrame && onChangeFrame(Number(val) || 0)}
                            style={{ width: 70 }}
                        />
                    </div>
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Left Object List */}
                <div style={{ width: '280px', borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
                    {/* Search Bar */}
                    <div style={{ padding: '12px 12px 8px 12px', borderBottom: '1px solid #eee' }}>
                        <Input
                            placeholder={t('searchPlaceholder')}
                            prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            allowClear
                            size="small"
                        />
                        <div style={{ marginTop: 8, color: '#888', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{t('objects')}</span>
                            <span>{filteredObjects.length} / {availableObjects.length}</span>
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        <List
                            dataSource={filteredObjects}
                            locale={{ emptyText: t('noMatches') }}
                            renderItem={item => {
                                const isSelected = item.clientID === selectedSubjectClientID;
                                const relCount = getRelationCount(item);
                                return (
                                    <List.Item
                                        onClick={() => setSelectedSubjectClientID(item.clientID)}
                                        className={`obj-list-item ${isSelected ? 'selected' : ''}`}
                                        style={{
                                            padding: '10px 16px', cursor: 'pointer',
                                            backgroundColor: isSelected ? '#e6f7ff' : 'transparent',
                                            borderLeft: isSelected ? '4px solid #1890ff' : '4px solid transparent'
                                        }}
                                    >
                                        <div style={{ width: '100%' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>
                                                    <Tag color={item.color} style={{ marginRight: 4, fontWeight: 'bold' }}>#{item.clientID}</Tag>
                                                    {item.serverID && <span style={{ fontSize: '10px', color: '#999' }}>({item.serverID})</span>}
                                                </span>
                                                {relCount > 0 && <Badge count={relCount} style={{ backgroundColor: '#52c41a' }} />}
                                            </div>
                                            <div style={{ marginTop: 4, fontWeight: 500, fontSize: '14px', color: '#333' }}>
                                                {item.label.name}
                                            </div>
                                        </div>
                                    </List.Item>
                                );
                            }}
                        />
                    </div>
                </div>

                {/* Right Action Area */}
                <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    {!selectedSubjectClientID ? (
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#999', flexDirection: 'column' }}>
                            <AimOutlined style={{ fontSize: 40, marginBottom: 16, color: '#d9d9d9' }} />
                            <span>{t('selectSubject')}</span>
                        </div>
                    ) : (
                        <>
                            <div style={{ marginBottom: 24, padding: '24px', background: '#fff', border: '1px solid #e8e8e8', borderRadius: '8px' }}>
                                <h4 style={{ marginBottom: 20, fontWeight: 600 }}>{t('createRelation')}</h4>
                                <Form form={form} layout="vertical" initialValues={{ min_distance: 10.0 }}>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                        <Form.Item label={t('subject')} name="subject_client_id" style={{ flex: 1 }}>
                                            <Select disabled options={getObjectOptions()} />
                                        </Form.Item>
                                        <div style={{ paddingTop: 35, color: '#bfbfbf' }}><RightOutlined /></div>
                                        <Form.Item label={t('predicate')} name="predicate" style={{ width: 140 }} rules={[{ required: true }]}>
                                            <Select
                                                showSearch
                                                placeholder={t('selectPredicate')}
                                                options={predicateOptions.map(p => ({ label: p, value: p }))}
                                                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                            />
                                        </Form.Item>
                                        <div style={{ paddingTop: 35, color: '#bfbfbf' }}><RightOutlined /></div>
                                        <Form.Item label={t('object')} name="object_client_id" style={{ flex: 1 }} rules={[{ required: true }]}>
                                            <Select
                                                showSearch
                                                placeholder={t('selectObject')}
                                                options={getObjectOptions().filter(o => o.value !== selectedSubjectClientID)}
                                                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                            />
                                        </Form.Item>
                                        <div style={{ paddingTop: 30 }}>
                                            <Button type="primary" onClick={addRelation} icon={<PlusOutlined />}>{t('add')}</Button>
                                        </div>
                                    </div>
                                </Form>
                            </div>

                            {newRelations.length > 0 && (
                                <div style={{ marginBottom: 24, border: '1px dashed #1890ff', padding: 16, borderRadius: 6, background: '#f0f5ff' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{t('genQueue')} ({newRelations.length})</span>
                                        <Button type="primary" size="small" onClick={handleGenerate} loading={loading}>{t('generate')}</Button>
                                    </div>
                                    <Table
                                        dataSource={newRelations}
                                        rowKey={(_, i) => String(i)}
                                        size="small"
                                        pagination={false}
                                        showHeader={false}
                                        columns={[
                                            { dataIndex: '_subject_display_label', width: '30%' },
                                            { dataIndex: 'predicate', render: t => <Tag color="blue">{t}</Tag> },
                                            { dataIndex: '_object_display_label', width: '30%' },
                                            {
                                                render: (_, __, idx) => (
                                                    <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => setNewRelations(prev => prev.filter((_, i) => i !== idx))} />
                                                )
                                            }
                                        ]}
                                    />
                                </div>
                            )}

                            <div style={{ flex: 1 }}>
                                <div style={{ marginBottom: 12, fontWeight: 'bold', color: '#333' }}>{t('savedRelations')} ({currentSubjectExistingRelations.length})</div>
                                <Table
                                    dataSource={currentSubjectExistingRelations}
                                    rowKey="clientID"
                                    size="small"
                                    pagination={false}
                                    locale={{ emptyText: t('none') }}
                                    columns={[
                                        { title: t('subject'), dataIndex: 'displaySubjectLabel', width: '30%' },
                                        { title: t('predicate'), dataIndex: 'predicate', render: t => <Tag>{t}</Tag> },
                                        { title: t('object'), dataIndex: 'displayObjectLabel', width: '30%' },
                                        { title: t('action'), render: (_, record) => <Button type="link" danger size="small" onClick={() => handleDeleteExisting(record)}>{t('delete')}</Button> }
                                    ]}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            <Collapse ghost style={{ borderTop: '1px solid #eee' }}>
                <Collapse.Panel header={<span style={{ fontSize: '11px', color: '#bbb' }}><BugOutlined /> {t('debugLog')}</span>} key="1">
                    <pre style={{ fontSize: '10px', maxHeight: '120px', overflowY: 'auto', background: '#f8f8f8', padding: '8px', margin: 0 }}>{debugInfo}</pre>
                </Collapse.Panel>
            </Collapse>
        </Modal>
    );
};

export default RelationDialog;
