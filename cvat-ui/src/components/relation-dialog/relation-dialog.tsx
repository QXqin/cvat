import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Select, Button, message, Table, List, Tag, Badge, Collapse, Input, Slider, InputNumber, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, LeftOutlined, RightOutlined, AimOutlined, BugOutlined, SyncOutlined, SearchOutlined, FastBackwardOutlined, StepBackwardOutlined, CaretRightOutlined, PauseOutlined, StepForwardOutlined, FastForwardOutlined } from '@ant-design/icons';
import './styles.scss';
import { getCore } from 'cvat-core-wrapper';
import { NavigationType, Workspace } from 'reducers';
import { Row, Col } from 'antd/lib/grid';

// ================= 类型定义 =================

interface AnnotationObject {
    clientID: number;
    serverID: number | null;
    trackID: number;        // XML track id (0-based) = clientID - 1
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

    // 数据源
    const [availableObjects, setAvailableObjects] = useState<AnnotationObject[]>([]);
    // 搜索词状态
    const [searchTerm, setSearchTerm] = useState<string>('');
    // 选中的主体 clientID
    const [selectedSubjectClientID, setSelectedSubjectClientID] = useState<number | null>(null);
    // 调试信息
    const [debugInfo, setDebugInfo] = useState<string>('');
    // 动态谓词列表
    const [predicateOptions, setPredicateOptions] = useState<string[]>([]);

    const safeFrameNum = typeof currentFrame === 'object' && currentFrame !== null
        ? currentFrame.number
        : currentFrame;

    // ==== 键盘快捷键拦截 ====
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
            setSearchTerm(''); // 打开时重置搜索
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
            let logs = [`当前帧: ${safeFrameNum}`, `总状态数: ${states.length}`];

            // 1. 动态读取谓词配置
            const relationLabelDef = jobInstance.labels.find((l: any) => l.name.toLowerCase() === 'relation');
            if (relationLabelDef) {
                const predicateAttr = relationLabelDef.attributes.find((a: any) => a.name === 'predicate');
                if (predicateAttr && predicateAttr.values && predicateAttr.values.length > 0) {
                    setPredicateOptions([...predicateAttr.values]);
                    logs.push(`已加载谓词配置: ${predicateAttr.values.length} 个`);
                } else {
                    logs.push('警告: 未找到 predicate 属性或其 values 为空，使用内置备选列表');
                    setPredicateOptions(['near', 'holding', 'riding', 'wearing', 'next_to', 'behind', 'in_front_of', 'above', 'below', 'parked on']);
                }
            } else {
                logs.push('警告: 项目中未定义 Relation 标签，使用内置备选列表');
                setPredicateOptions(['near', 'holding', 'riding', 'wearing', 'next_to', 'behind', 'in_front_of', 'above', 'below', 'parked on']);
            }

            // 2. 提取实体对象
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

            // 建立查找表
            const lookupMap = new Map<string, AnnotationObject>();
            objects.forEach(obj => {
                lookupMap.set(String(obj.clientID), obj);
                lookupMap.set(String(obj.trackID), obj);
                if (obj.serverID !== null) {
                    lookupMap.set(String(obj.serverID), obj);
                }
            });

            setAvailableObjects(objects);
            logs.push(`有效实体对象: ${objects.length}`);

            // 自动选中：若之前选中的主体在当前帧不存在，则重置为第一个
            if (objects.length > 0) {
                const stillExists = objects.find(o => o.clientID === selectedSubjectClientID);
                if (!stillExists) {
                    setSelectedSubjectClientID(objects[0].clientID);
                }
            } else {
                setSelectedSubjectClientID(null);
            }

            // 3. 解析已有关系
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
                            if (!obj) return `ID:${rawId} (当前帧不可见)`;
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
                logs.push(`解析出关系: ${existingList.length} 条`);
            } else {
                setExistingRelations([]);
            }

            setDebugInfo(logs.join('\n'));

        } catch (error: any) {
            console.error(error);
            setDebugInfo(`错误: ${error.message}`);
        }
    };

    // ================= 筛选逻辑 =================

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
                    message.warning('主体和客体不能相同');
                    return;
                }

                const subjObj = availableObjects.find(o => o.clientID === subject_client_id);
                const objObj = availableObjects.find(o => o.clientID === object_client_id);

                if (!subjObj || !objObj) return;

                if (subjObj.serverID === null || objObj.serverID === null) {
                    message.error('对象未保存，请先保存 (Ctrl+S)');
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
                    message.warning('列表里已存在该关系');
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
                message.success('已添加到队列');
            });
    };

    const handleDeleteExisting = async (record: ExistingRelation) => {
        try {
            record.annotationObject.delete();
            message.success('已标记删除');
            setExistingRelations(prev => prev.filter(item => item.clientID !== record.clientID));
        } catch (error) {
            message.error('删除失败');
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
            message.success('生成指令已发送');
            setNewRelations([]);
            setTimeout(loadAnnotations, 800);
        } catch (error: any) {
            message.error(`生成失败: ${error.message}`);
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
            title: '确认一键重排清洗？',
            content: '此操作将自动收集当前任务的所有标注，重新排序并统一重分配ID，同时推送到服务器并刷新页面。注意：旧的原生 serverID 将彻底失效。',
            okText: '确认清洗并刷新',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    setLoading(true);
                    setDebugInfo('正在导出原始序列化数据...');

                    // ====== 第一步：使用 export() 获取原始序列化集合 ======
                    // 这会保留 tracks 的完整多帧 keyframes 结构，不会像 get() 那样把所有东西压扁到一帧
                    const collection = await jobInstance.annotations.export();
                    // collection = { shapes: [...], tracks: [...], tags: [...] }

                    const relationLabelDef = jobInstance.labels.find((l: any) => l.name.toLowerCase() === 'relation');
                    const relationLabelId = relationLabelDef ? relationLabelDef.id : null;

                    // ====== 第二步：将 shapes 和 tracks 按 实体/关系 分类 ======
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

                    // ====== 第三步：排序 - 实体在前，关系在后 ======
                    const sortedShapes = [...entityShapes, ...relationShapes];
                    const sortedTracks = [...entityTracks, ...relationTracks];

                    // 构建旧 ID -> 新 Index 的映射 (基于合并后的完整顺序)
                    // 所有实体排在前面，关系排在后面
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

                    setDebugInfo(`实体: ${allEntities.length}, 关系: ${allRelations.length}, 映射: ${lookupMap.size}`);

                    // ====== 第四步：修复关系的 subject_id / object_id 属性 ======
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

                        // 修复 shapes 中的关系
                        relationShapes.forEach((s: any) => fixAttrs(s.attributes));
                        // 修复 tracks 中的关系 (track 级别属性)
                        relationTracks.forEach((t: any) => fixAttrs(t.attributes));
                    }

                    // ====== 第五步：清除旧 id，让 CVAT 重新分配连续 serverID ======
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

                    // ====== 第六步：清空 + 导入 + 保存 + 刷新 ======
                    setDebugInfo('正在清空数据库并注入排序后的新数据...');

                    await jobInstance.annotations.clear({ reload: false });
                    await jobInstance.annotations.import({
                        shapes: sortedShapes,
                        tracks: sortedTracks,
                        tags: sortedTags,
                    });
                    await jobInstance.annotations.save();

                    setDebugInfo('操作完成！准备刷新页面...');
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                } catch (error: any) {
                    console.error(error);
                    Modal.error({ title: '清洗失败', content: error.message });
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
            {/* 原始标题栏与关闭等按钮 */}
            <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                <div style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SyncOutlined spin={loading} style={{ marginRight: 4 }} />
                    关系标注工具
                </div>
                <div>
                    <Button type="primary" danger onClick={handleWipeAndSync} style={{ marginRight: 8 }}>
                        一键重排清洗
                    </Button>
                    <Button onClick={onClose}>关闭</Button>
                </div>
            </div>

            {/* 独立一行：定制简易播放器控件 */}
            <div style={{ padding: '6px 24px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 800 }}>
                    {/* 左侧按键组 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <Tooltip title="跳到首帧">
                            <Button type="text" size="small" icon={<FastBackwardOutlined />} onClick={() => onChangeFrame && onChangeFrame(jobInstance.startFrame)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} />
                        </Tooltip>
                        <Tooltip title="上一帧 (D)">
                            <Button type="text" size="small" icon={<StepBackwardOutlined />} onClick={() => onChangeFrame && onChangeFrame(Math.max(jobInstance.startFrame, safeFrameNum - 1))} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} />
                        </Tooltip>
                        <Tooltip title="播放/暂停 (Space)">
                            <Button type="text" size="small" icon={playing ? <PauseOutlined /> : <CaretRightOutlined />} onClick={() => onSwitchPlay && onSwitchPlay(!playing)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} />
                        </Tooltip>
                        <Tooltip title="下一帧 (F)">
                            <Button type="text" size="small" icon={<StepForwardOutlined />} onClick={() => onChangeFrame && onChangeFrame(Math.min(jobInstance.stopFrame, safeFrameNum + 1))} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} />
                        </Tooltip>
                        <Tooltip title="跳到尾帧">
                            <Button type="text" size="small" icon={<FastForwardOutlined />} onClick={() => onChangeFrame && onChangeFrame(jobInstance.stopFrame)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} />
                        </Tooltip>
                    </div>

                    {/* 居中进度条 */}
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

                    {/* 右侧帧输入 */}
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
                {/* 左侧对象列表 */}
                <div style={{ width: '280px', borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
                    {/* 搜索栏 */}
                    <div style={{ padding: '12px 12px 8px 12px', borderBottom: '1px solid #eee' }}>
                        <Input
                            placeholder="搜索 ID / 标签 / ServerID"
                            prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            allowClear
                            size="small"
                        />
                        <div style={{ marginTop: 8, color: '#888', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Objects</span>
                            <span>{filteredObjects.length} / {availableObjects.length}</span>
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        <List
                            dataSource={filteredObjects}
                            locale={{ emptyText: '无匹配对象' }}
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

                {/* 右侧操作区 */}
                <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    {!selectedSubjectClientID ? (
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#999', flexDirection: 'column' }}>
                            <AimOutlined style={{ fontSize: 40, marginBottom: 16, color: '#d9d9d9' }} />
                            <span>请在左侧选择主体</span>
                        </div>
                    ) : (
                        <>
                            <div style={{ marginBottom: 24, padding: '24px', background: '#fff', border: '1px solid #e8e8e8', borderRadius: '8px' }}>
                                <h4 style={{ marginBottom: 20, fontWeight: 600 }}>新建关系</h4>
                                <Form form={form} layout="vertical" initialValues={{ min_distance: 10.0 }}>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                        <Form.Item label="主体" name="subject_client_id" style={{ flex: 1 }}>
                                            <Select disabled options={getObjectOptions()} />
                                        </Form.Item>
                                        <div style={{ paddingTop: 35, color: '#bfbfbf' }}><RightOutlined /></div>
                                        <Form.Item label="谓词" name="predicate" style={{ width: 140 }} rules={[{ required: true }]}>
                                            <Select
                                                showSearch
                                                placeholder="选择关系"
                                                options={predicateOptions.map(p => ({ label: p, value: p }))}
                                                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                            />
                                        </Form.Item>
                                        <div style={{ paddingTop: 35, color: '#bfbfbf' }}><RightOutlined /></div>
                                        <Form.Item label="客体" name="object_client_id" style={{ flex: 1 }} rules={[{ required: true }]}>
                                            <Select
                                                showSearch
                                                placeholder="选择客体"
                                                options={getObjectOptions().filter(o => o.value !== selectedSubjectClientID)}
                                                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                            />
                                        </Form.Item>
                                        <div style={{ paddingTop: 30 }}>
                                            <Button type="primary" onClick={addRelation} icon={<PlusOutlined />}>添加</Button>
                                        </div>
                                    </div>
                                </Form>
                            </div>

                            {newRelations.length > 0 && (
                                <div style={{ marginBottom: 24, border: '1px dashed #1890ff', padding: 16, borderRadius: 6, background: '#f0f5ff' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>待生成队列 ({newRelations.length})</span>
                                        <Button type="primary" size="small" onClick={handleGenerate} loading={loading}>生成</Button>
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
                                <div style={{ marginBottom: 12, fontWeight: 'bold', color: '#333' }}>该对象已保存的关系 ({currentSubjectExistingRelations.length})</div>
                                <Table
                                    dataSource={currentSubjectExistingRelations}
                                    rowKey="clientID"
                                    size="small"
                                    pagination={false}
                                    locale={{ emptyText: '无' }}
                                    columns={[
                                        { title: '主体', dataIndex: 'displaySubjectLabel', width: '30%' },
                                        { title: '谓词', dataIndex: 'predicate', render: t => <Tag>{t}</Tag> },
                                        { title: '客体', dataIndex: 'displayObjectLabel', width: '30%' },
                                        { title: '操作', render: (_, record) => <Button type="link" danger size="small" onClick={() => handleDeleteExisting(record)}>删除</Button> }
                                    ]}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            <Collapse ghost style={{ borderTop: '1px solid #eee' }}>
                <Collapse.Panel header={<span style={{ fontSize: '11px', color: '#bbb' }}><BugOutlined /> 调试日志</span>} key="1">
                    <pre style={{ fontSize: '10px', maxHeight: '120px', overflowY: 'auto', background: '#f8f8f8', padding: '8px', margin: 0 }}>{debugInfo}</pre>
                </Collapse.Panel>
            </Collapse>
        </Modal>
    );
};

export default RelationDialog;
