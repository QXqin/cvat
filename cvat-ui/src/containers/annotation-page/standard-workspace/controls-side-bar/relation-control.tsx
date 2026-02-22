// Copyright (C) 2026 CVAT Relation Tool Contributors
// SPDX-License-Identifier: MIT

/**
 * 关系控件容器组件
 *
 * 功能：
 * 1. 连接 Redux store
 * 2. 管理关系对话框状态
 * 3. 在前端生成关系标注
 * 4. 刷新标注数据
 */

import React, { useState } from 'react';
import { connect } from 'react-redux';
import { message } from 'antd';
import RelationControlComponent from 'components/annotation-page/standard-workspace/controls-side-bar/relation-control';
import RelationDialog from 'components/relation-dialog/relation-dialog';
import { PositionManager, getBoxFromState, calculatePriorityPositions } from './relation-algorithms';
import { CombinedState, NavigationType } from 'reducers';
import { Canvas } from 'cvat-canvas-wrapper';
import { getCore } from 'cvat-core-wrapper';
import { fetchAnnotationsAsync, changeFrameAsync, switchPlay, setNavigationType, searchAnnotationsAsync } from 'actions/annotation-actions';

const cvat = getCore();

// ================= 类型定义 =================

interface StateToProps {
    canvasInstance: Canvas;
    activeControl: any;
    jobInstance: any;
    frame: any;
    playing: boolean;
    navigationType: NavigationType;
    frameFilename: string;
}

interface DispatchToProps {
    fetchAnnotations: () => void;
    onChangeFrame: (toFrame: number) => void;
    onSwitchPlay: (playing: boolean) => void;
    setNavigationType: (navigationType: NavigationType) => void;
    searchAnnotations: (sessionInstance: any, frameFrom: number, frameTo: number, generalFilters?: any) => void;
}

// 合并 Props 类型
type Props = StateToProps & DispatchToProps;

interface RelationSpec {
    subject_id: number;  // trackID (0-based), 用于保存到属性
    object_id: number;
    predicate: string;
    frame: number;
    subject_client_id: number;  // clientID, 用于查找对象状态
    object_client_id: number;
}

// ================= Redux 连接 =================

function mapStateToProps(state: CombinedState): StateToProps {
    const {
        annotation: {
            canvas: { instance: canvasInstance, activeControl },
            job: { instance: jobInstance },
            player: {
                frame,
                playing,
                navigationType,
                frame: {
                    filename: frameFilename,
                },
            },
        },
    } = state;

    return {
        canvasInstance,
        activeControl,
        jobInstance,
        frame,
        playing,
        navigationType,
        frameFilename,
    };
}

// ================= 辅助函数 =================

// ============================================

// ================= 容器组件 =================

function RelationControlContainer(props: Props): JSX.Element {
    const {
        canvasInstance,
        activeControl,
        jobInstance,
        frame,
        playing,
        navigationType,
        frameFilename,
        fetchAnnotations,
        onChangeFrame,
        onSwitchPlay,
        setNavigationType,
        searchAnnotations,
    } = props;

    const [dialogVisible, setDialogVisible] = useState(false);

    const handleOpenDialog = () => {
        setDialogVisible(true);
    };

    const handleCloseDialog = () => {
        setDialogVisible(false);
    };

    /**
     * 生成关系标注核心逻辑
     */
    const handleGenerate = async (
        relations: RelationSpec[],
        minDistance: number
    ) => {
        try {
            console.log('[RelationControl] 开始在前端生成关系...', { relations });

            const frameNum = typeof frame === 'object' ? frame.number : frame;

            // 1. 查找标签
            const relationLabel = jobInstance.labels.find((l: any) => l.name === 'Relation');
            if (!relationLabel) throw new Error('未找到 "Relation" 标签');

            // 2. 查找属性 ID
            const getAttrId = (n: string) => relationLabel.attributes.find((a: any) => a.name === n)?.id;
            const predId = getAttrId('predicate');
            const subjId = getAttrId('subject_id');
            const objId = getAttrId('object_id');

            if (!predId || !subjId || !objId) throw new Error('Relation 标签缺少必要属性');

            // 3. 获取当前帧标注
            const states = await jobInstance.annotations.get(frameNum);
            const newStates = [];
            const errors = [];

            // 先找到当前帧以存在的关系点，加入到碰撞检测中
            const posManager = new PositionManager();
            states.filter((s: any) => s.label.name === 'Relation').forEach((s: any) => {
                if (s.points && s.points.length >= 2 && !s.outside) {
                    posManager.addPosition(frameNum, s.points[0], s.points[1]);
                }
            });

            // 4. 构建对象
            for (const relation of relations) {
                try {
                    // 通过 clientID 直接查找对象状态（不再依赖 trackID+1 的脆弱映射）
                    const subjState = states.find((s: any) => s.clientID === relation.subject_client_id && !s.outside);
                    const objState = states.find((s: any) => s.clientID === relation.object_client_id && !s.outside);

                    if (!subjState || !objState) {
                        errors.push({ relation, error: `找不到对象 (clientID: ${relation.subject_client_id}/${relation.object_client_id})` });
                        continue;
                    }

                    // ====== 核心位置算法: 优先位置 & 防碰撞 ======
                    const subjBox = getBoxFromState(subjState);
                    let bestPoint: [number, number] | null = null;

                    if (subjBox) {
                        const candidates = calculatePriorityPositions(subjBox, 5); // offset = 5
                        for (const p of candidates) {
                            if (posManager.isPositionValid(frameNum, p.x, p.y, minDistance)) {
                                bestPoint = [p.x, p.y];
                                break;
                            }
                        }
                        if (!bestPoint) bestPoint = [candidates[0].x, candidates[0].y]; // Fallback to center
                    } else {
                        // 如果 subject 没有有效 bbox (例如其为单个点)
                        bestPoint = [subjState.points[0] || 0, subjState.points[1] || 0];
                    }

                    // 注册点防碰撞
                    posManager.addPosition(frameNum, bestPoint[0], bestPoint[1]);

                    // 防御性验证：确保 bestPoint 包含有效坐标
                    if (!bestPoint || bestPoint.length !== 2 || !Number.isFinite(bestPoint[0]) || !Number.isFinite(bestPoint[1])) {
                        errors.push({ relation, error: `计算位置坐标无效: [${bestPoint}]` });
                        continue;
                    }

                    // ====== 消亡同步逻辑: 寻找 track 结束帧 ======
                    let endFrame = frameNum + 1;
                    const maxSearch = jobInstance.stopFrame;
                    let disappears = false;
                    for (let f = frameNum + 1; f <= maxSearch; f++) {
                        const sts = await jobInstance.annotations.get(f);
                        const s = sts.find((x: any) => x.clientID === subjState.clientID);
                        const o = sts.find((x: any) => x.clientID === objState.clientID);
                        if (!s || s.outside || !o || o.outside) {
                            disappears = true;
                            endFrame = f;
                            break;
                        }
                    }

                    // 如果跑到最后都没消失，说明一直存在
                    if (!disappears) {
                        endFrame = maxSearch + 1;
                    }

                    // 创建 ObjectState: 关系作为 track 存在
                    const { ObjectState } = cvat.classes;
                    const { ObjectType, ShapeType, Source } = cvat.enums;

                    const relationState = new ObjectState({
                        objectType: ObjectType.TRACK,  // 改变为 TRACK
                        label: relationLabel,
                        shapeType: ShapeType.POINTS,
                        points: bestPoint,
                        frame: frameNum,
                        occluded: false,
                        outside: false,
                        zOrder: 0,
                        descriptions: [],
                        attributes: {
                            [predId]: relation.predicate,
                            [subjId]: String(relation.subject_id),
                            [objId]: String(relation.object_id),
                        },
                        source: Source.MANUAL,
                    });

                    newStates.push({ state: relationState, endFrame, relation });

                } catch (e: any) {
                    errors.push({ relation, error: e.message });
                }
            }

            if (newStates.length === 0) {
                if (errors.length > 0) throw new Error(`生成失败: ${errors[0].error}`);
                throw new Error('无有效关系');
            }

            // ================= 核心操作 =================

            // 5. 写入内存
            const clientIDs = await jobInstance.annotations.put(newStates.map((x: any) => x.state));
            console.log('[RelationControl] 关系轨道已写入内存', clientIDs);

            // 6. 为每个轨道逐帧添加关键帧，并添加 ending keyframe (使其消亡)
            for (let i = 0; i < newStates.length; i++) {
                const { endFrame, relation } = newStates[i] as any;
                const clientID = clientIDs[i];

                // 逐帧更新位置
                for (let f = frameNum + 1; f < endFrame; f++) {
                    const sts = await jobInstance.annotations.get(f);
                    const subjState = sts.find((s: any) => s.clientID === relation.subject_client_id && !s.outside);
                    // 客体不需要用来计算位置，只需要确认它还存在（在前面的循环已经保证了它存在才不消亡）
                    const relTrack = sts.find((s: any) => s.clientID === clientID);

                    if (subjState && relTrack) {
                        const subjBox = getBoxFromState(subjState);
                        let bestPoint: [number, number] | null = null;

                        if (subjBox) {
                            const candidates = calculatePriorityPositions(subjBox, 5);
                            for (const p of candidates) {
                                if (posManager.isPositionValid(f, p.x, p.y, minDistance)) {
                                    bestPoint = [p.x, p.y];
                                    break;
                                }
                            }
                            if (!bestPoint) bestPoint = [candidates[0].x, candidates[0].y];
                        } else {
                            bestPoint = [subjState.points[0] || 0, subjState.points[1] || 0];
                        }

                        posManager.addPosition(f, bestPoint[0], bestPoint[1]);

                        relTrack.points = bestPoint;
                        relTrack.keyframe = true;
                        // 注意：对于 track，修改 keyframe=true 会在当前帧创建一个关键帧，
                        await relTrack.save();
                    }
                }

                // 在 endFrame 处设置消亡
                if (endFrame <= jobInstance.stopFrame) {
                    const trackStates = await jobInstance.annotations.get(endFrame);
                    const trackState = trackStates.find((s: any) => s.clientID === clientID);
                    if (trackState) {
                        trackState.outside = true;
                        trackState.keyframe = true;
                        await trackState.save();
                    }
                }
            }
            console.log('[RelationControl] 轨道逐帧跟踪和消亡限制已设置');

            // 7. 保存到服务器 (物理存储)
            await jobInstance.annotations.save();
            console.log('[RelationControl] 已保存到服务器');

            // 8. 刷新画布 (使用 Redux Action)
            fetchAnnotations();

            // ===========================================

            if (errors.length > 0) {
                message.warning(`部分成功: 生成 ${newStates.length} 个, 失败 ${errors.length} 个`);
            } else {
                message.success(`成功生成 ${newStates.length} 个关系`);
            }

            return { created: newStates.length, errors };

        } catch (error: any) {
            console.error(error);
            message.error(error.message);
        }
    };

    return (
        <>
            <RelationControlComponent
                canvasInstance={canvasInstance}
                activeControl={activeControl}
                onOpenDialog={handleOpenDialog}
            />
            <RelationDialog
                visible={dialogVisible}
                jobInstance={jobInstance}
                currentFrame={frame}
                playing={playing}
                navigationType={navigationType}
                frameFilename={frameFilename}
                onClose={handleCloseDialog}
                onGenerate={handleGenerate}
                onChangeFrame={onChangeFrame}
                onSwitchPlay={onSwitchPlay}
                setNavigationType={setNavigationType}
                searchAnnotations={searchAnnotations}
            />
        </>
    );
}

// 定义 dispatch 映射
const mapDispatchToProps = {
    fetchAnnotations: fetchAnnotationsAsync,
    onChangeFrame: changeFrameAsync,
    onSwitchPlay: switchPlay,
    setNavigationType,
    searchAnnotations: searchAnnotationsAsync,
};

// 连接 Redux
export default connect(
    mapStateToProps,
    mapDispatchToProps
)(RelationControlContainer);
