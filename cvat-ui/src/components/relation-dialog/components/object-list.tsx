// Copyright (C) 2026 CVAT Relation Tool Contributors
// SPDX-License-Identifier: MIT

import React, { useMemo } from 'react';
import { Input, List, Tag, Badge } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { AnnotationObject, ExistingRelation } from '../types';
import { useI18n, Language } from '../i18n';

interface ObjectListProps {
    availableObjects: AnnotationObject[];
    existingRelations: ExistingRelation[];
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    selectedSubjectClientID: number | null;
    setSelectedSubjectClientID: (id: number) => void;
    lang: Language;
}

export const ObjectList: React.FC<ObjectListProps> = ({
    availableObjects,
    existingRelations,
    searchTerm,
    setSearchTerm,
    selectedSubjectClientID,
    setSelectedSubjectClientID,
    lang,
}) => {
    const t = useI18n(lang);

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

    const getRelationCount = (obj: AnnotationObject) => {
        return existingRelations.filter(rel => rel.subject_id === String(obj.trackID)).length;
    };

    return (
        <div className="cvat-relation-dialog-sidebar">
            <div className="cvat-relation-dialog-sidebar-header">
                <Input
                    placeholder={t('searchPlaceholder')}
                    prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    allowClear
                    size="small"
                />
                <div className="cvat-relation-dialog-sidebar-count">
                    <span>{t('objects')}</span>
                    <span>{filteredObjects.length} / {availableObjects.length}</span>
                </div>
            </div>

            <div className="cvat-relation-dialog-sidebar-list">
                <List
                    dataSource={filteredObjects}
                    locale={{ emptyText: t('noMatches') }}
                    renderItem={item => {
                        const isSelected = item.clientID === selectedSubjectClientID;
                        const relCount = getRelationCount(item);
                        return (
                            <List.Item
                                onClick={() => setSelectedSubjectClientID(item.clientID)}
                                className={`cvat-relation-dialog-sidebar-item ${isSelected ? 'selected' : ''}`}
                            >
                                <div style={{ width: '100%' }}>
                                    <div className="cvat-relation-dialog-item-header">
                                        <span>
                                            <Tag color={item.color} className="cvat-relation-dialog-item-tag">#{item.clientID}</Tag>
                                            {item.serverID && <span className="cvat-relation-dialog-item-serverid">({item.serverID})</span>}
                                        </span>
                                        {relCount > 0 && <Badge count={relCount} style={{ backgroundColor: '#52c41a' }} />}
                                    </div>
                                    <div className="cvat-relation-dialog-item-name">
                                        {item.label.name}
                                    </div>
                                </div>
                            </List.Item>
                        );
                    }}
                />
            </div>
        </div>
    );
};
