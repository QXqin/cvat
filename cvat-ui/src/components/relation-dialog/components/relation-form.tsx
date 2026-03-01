// Copyright (C) 2026 CVAT Relation Tool Contributors
// SPDX-License-Identifier: MIT

import React, { useMemo, useEffect } from 'react';
import { Form, Select, Button, message, Table, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, RightOutlined } from '@ant-design/icons';
import { AnnotationObject, RelationSpec, ExistingRelation } from '../types';
import { useI18n, Language } from '../i18n';

interface RelationFormProps {
    availableObjects: AnnotationObject[];
    predicateOptions: string[];
    selectedSubjectClientID: number | null;
    existingRelations: ExistingRelation[];
    setExistingRelations: React.Dispatch<React.SetStateAction<ExistingRelation[]>>;
    newRelations: RelationSpec[];
    setNewRelations: React.Dispatch<React.SetStateAction<RelationSpec[]>>;
    safeFrameNum: number;
    loading: boolean;
    handleGenerate: () => void;
    lang: Language;
}

export const RelationForm: React.FC<RelationFormProps> = ({
    availableObjects,
    predicateOptions,
    selectedSubjectClientID,
    existingRelations,
    setExistingRelations,
    newRelations,
    setNewRelations,
    safeFrameNum,
    loading,
    handleGenerate,
    lang,
}) => {
    const t = useI18n(lang);
    const [form] = Form.useForm();

    useEffect(() => {
        if (selectedSubjectClientID) {
            form.setFieldsValue({ subject_client_id: selectedSubjectClientID });
        }
    }, [selectedSubjectClientID, form]);

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

    const currentSubjectExistingRelations = useMemo(() => {
        if (!selectedSubjectClientID) return [];
        const currentSubj = availableObjects.find(o => o.clientID === selectedSubjectClientID);
        if (!currentSubj) return [];

        return existingRelations.filter(rel => {
            return rel.subject_id === String(currentSubj.trackID);
        });
    }, [selectedSubjectClientID, existingRelations, availableObjects]);

    return (
        <div className="cvat-relation-dialog-action-area">
            <div className="cvat-relation-dialog-form-container">
                <h4 className="cvat-relation-dialog-form-title">{t('createRelation')}</h4>
                <Form form={form} layout="vertical" initialValues={{ min_distance: 10.0 }}>
                    <div className="cvat-relation-dialog-form-inputs">
                        <Form.Item label={t('subject')} name="subject_client_id" style={{ flex: 1 }}>
                            <Select disabled options={getObjectOptions()} />
                        </Form.Item>
                        <div className="cvat-relation-dialog-form-arrow"><RightOutlined /></div>
                        <Form.Item label={t('predicate')} name="predicate" style={{ width: 140 }} rules={[{ required: true }]}>
                            <Select
                                showSearch
                                placeholder={t('selectPredicate')}
                                options={predicateOptions.map(p => ({ label: p, value: p }))}
                                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                            />
                        </Form.Item>
                        <div className="cvat-relation-dialog-form-arrow"><RightOutlined /></div>
                        <Form.Item label={t('object')} name="object_client_id" style={{ flex: 1 }} rules={[{ required: true }]}>
                            <Select
                                showSearch
                                placeholder={t('selectObject')}
                                options={getObjectOptions().filter(o => o.value !== selectedSubjectClientID)}
                                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                            />
                        </Form.Item>
                        <div className="cvat-relation-dialog-form-add">
                            <Button type="primary" onClick={addRelation} icon={<PlusOutlined />}>{t('add')}</Button>
                        </div>
                    </div>
                </Form>
            </div>

            {newRelations.length > 0 && (
                <div className="cvat-relation-dialog-queue-container">
                    <div className="cvat-relation-dialog-queue-header">
                        <span className="cvat-relation-dialog-queue-title">{t('genQueue')} ({newRelations.length})</span>
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
                                    <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => setNewRelations(prev => prev.filter((_i, ind) => ind !== idx))} />
                                )
                            }
                        ]}
                    />
                </div>
            )}

            <div style={{ flex: 1 }}>
                <div className="cvat-relation-dialog-saved-title">{t('savedRelations')} ({currentSubjectExistingRelations.length})</div>
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
        </div>
    );
};
