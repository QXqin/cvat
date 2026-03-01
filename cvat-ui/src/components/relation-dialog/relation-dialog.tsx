// Copyright (C) 2026 CVAT Relation Tool Contributors
// SPDX-License-Identifier: MIT

import React, { useState, useEffect } from 'react';
import { Modal, Button, Collapse, message } from 'antd';
import { SyncOutlined, BugOutlined, AimOutlined } from '@ant-design/icons';
import './styles.scss';

import { RelationDialogProps, RelationSpec, Language } from './types';
import { useI18n } from './i18n';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import { useAnnotations } from './hooks/use-annotations';
import { useWipeAndSync } from './hooks/use-wipe-and-sync';

import { PlayerControls } from './components/player-controls';
import { ObjectList } from './components/object-list';
import { RelationForm } from './components/relation-form';

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
    const safeFrameNum = typeof currentFrame === 'object' && currentFrame !== null
        ? currentFrame.number
        : currentFrame;

    const [lang, setLang] = useState<Language>('zh');
    const t = useI18n(lang);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [newRelations, setNewRelations] = useState<RelationSpec[]>([]);

    const {
        availableObjects,
        existingRelations,
        setExistingRelations,
        predicateOptions,
        debugInfo,
        setDebugInfo,
        selectedSubjectClientID,
        setSelectedSubjectClientID,
        loadAnnotations,
    } = useAnnotations(jobInstance, safeFrameNum);

    const { wipeLoading, handleWipeAndSync } = useWipeAndSync(jobInstance, lang, setDebugInfo);

    // Keyboard Shortcuts hook
    useKeyboardShortcuts({
        visible,
        jobInstance,
        safeFrameNum,
        playing,
        onChangeFrame,
        onSwitchPlay,
    });

    useEffect(() => {
        if (visible && jobInstance) {
            loadAnnotations();
            setSearchTerm(''); // Reset search on open
        }
    }, [visible, jobInstance, safeFrameNum, loadAnnotations]);

    const handleGenerateWrapper = async () => {
        if (newRelations.length === 0) return;
        setLoading(true);
        try {
            const minDistance = 10.0; // Assume 10.0 or from form ref, simplified here as min_distance is hardcoded in original
            await onGenerate(newRelations, minDistance);
            message.success(t('genCommandSent'));
            setNewRelations([]);
            setTimeout(loadAnnotations, 800);
        } catch (error: any) {
            message.error(`${t('genFailed')} ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const isGlobalLoading = loading || wipeLoading;

    return (
        <Modal
            title={null}
            open={visible}
            onCancel={onClose}
            width={1000}
            footer={null}
            bodyStyle={{ padding: 0, height: '700px', display: 'flex', flexDirection: 'column' }}
        >
            <div className="cvat-relation-dialog-header">
                <div className="cvat-relation-dialog-title">
                    <SyncOutlined spin={isGlobalLoading} style={{ marginRight: 4 }} />
                    {t('title')}
                </div>
                <div className="cvat-relation-dialog-actions">
                    <Button size="small" onClick={() => setLang(lang === 'en' ? 'zh' : 'en')} style={{ fontWeight: 'bold', color: lang === 'zh' ? '#1890ff' : '#666' }}>
                        中 / EN
                    </Button>
                    <Button type="primary" danger onClick={handleWipeAndSync}>
                        {t('wipeAndSync')}
                    </Button>
                    <Button onClick={onClose}>{t('close')}</Button>
                </div>
            </div>

            <PlayerControls
                jobInstance={jobInstance}
                safeFrameNum={safeFrameNum}
                playing={playing}
                lang={lang}
                onChangeFrame={onChangeFrame}
                onSwitchPlay={onSwitchPlay}
            />

            <div className="cvat-relation-dialog-body">
                <ObjectList
                    availableObjects={availableObjects}
                    existingRelations={existingRelations}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    selectedSubjectClientID={selectedSubjectClientID}
                    setSelectedSubjectClientID={setSelectedSubjectClientID}
                    lang={lang}
                />

                {!selectedSubjectClientID ? (
                    <div className="cvat-relation-dialog-action-area">
                        <div className="cvat-relation-dialog-empty">
                            <AimOutlined className="anticon" />
                            <span>{t('selectSubject')}</span>
                        </div>
                    </div>
                ) : (
                    <RelationForm
                        availableObjects={availableObjects}
                        predicateOptions={predicateOptions}
                        selectedSubjectClientID={selectedSubjectClientID}
                        existingRelations={existingRelations}
                        setExistingRelations={setExistingRelations}
                        newRelations={newRelations}
                        setNewRelations={setNewRelations}
                        safeFrameNum={safeFrameNum}
                        loading={loading}
                        handleGenerate={handleGenerateWrapper}
                        lang={lang}
                    />
                )}
            </div>

            <Collapse ghost className="cvat-relation-dialog-debug-panel">
                <Collapse.Panel header={<span className="cvat-relation-dialog-debug-header"><BugOutlined /> {t('debugLog')}</span>} key="1">
                    <pre className="cvat-relation-dialog-debug-content">{debugInfo}</pre>
                </Collapse.Panel>
            </Collapse>
        </Modal>
    );
};

export default RelationDialog;
