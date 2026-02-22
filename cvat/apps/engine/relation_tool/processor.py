# Copyright (C) 2026 CVAT Relation Tool Contributors
# SPDX-License-Identifier: MIT

"""
关系标注处理器核心模块
负责关系点的创建、位置计算、冲突检测和批量操作
"""

import logging
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class RelationSpec:
    """关系规格定义"""
    subject_id: int  # 主体标注的 clientID
    object_id: int  # 客体标注的 clientID
    predicate: str  # 谓词（关系类型）
    frame: int  # 帧号


@dataclass
class Position:
    """二维坐标"""
    x: float
    y: float


class RelationProcessor:
    """
    关系标注处理器

    核心功能：
    1. 验证主体/客体标注的有效性
    2. 计算关系点的最佳位置（避免重叠）
    3. 批量创建关系标注
    4. 清理无效关系
    """

    def __init__(self, job_data: Dict[str, Any]):
        """
        初始化处理器

        Args:
            job_data: CVAT Job 的标注数据（通过 job.get_annotations() 获取）
                     格式：{'shapes': [...], 'tracks': [...], 'tags': [...]}
        """
        self.job_data = job_data
        self.shapes = job_data.get('shapes', [])
        self.tracks = job_data.get('tracks', [])

        # 构建快速查找表：clientID -> shape/track
        self._build_annotation_index()

    def _build_annotation_index(self):
        """构建标注索引以加速查找"""
        self.annotation_map = {}

        # 索引静态 shapes
        for shape in self.shapes:
            client_id = shape.get('id')  # CVAT 中的 clientID
            if client_id:
                self.annotation_map[client_id] = {
                    'type': 'shape',
                    'data': shape
                }

        # 索引 tracks（动态对象）
        for track in self.tracks:
            client_id = track.get('id')
            if client_id:
                self.annotation_map[client_id] = {
                    'type': 'track',
                    'data': track
                }

    def validate_relation(self, spec: RelationSpec) -> Tuple[bool, Optional[str]]:
        """
        验证关系规格的有效性

        Args:
            spec: 关系规格

        Returns:
            (is_valid, error_message)
        """
        # 检查主体是否存在
        if spec.subject_id not in self.annotation_map:
            return False, f"主体标注 ID {spec.subject_id} 不存在"

        # 检查客体是否存在
        if spec.object_id not in self.annotation_map:
            return False, f"客体标注 ID {spec.object_id} 不存在"

        # 检查主体和客体不能相同
        if spec.subject_id == spec.object_id:
            return False, "主体和客体不能是同一个对象"

        # 检查谓词是否为空
        if not spec.predicate or not spec.predicate.strip():
            return False, "谓词不能为空"

        # 检查主体和客体在指定帧是否存在
        subject_valid = self._check_annotation_in_frame(
            spec.subject_id, spec.frame
        )
        object_valid = self._check_annotation_in_frame(
            spec.object_id, spec.frame
        )

        if not subject_valid:
            return False, f"主体在帧 {spec.frame} 不存在或已标记为 outside"

        if not object_valid:
            return False, f"客体在帧 {spec.frame} 不存在或已标记为 outside"

        return True, None

    def _check_annotation_in_frame(self, client_id: int, frame: int) -> bool:
        """
        检查标注在指定帧是否有效

        Args:
            client_id: 标注 ID
            frame: 帧号

        Returns:
            是否有效
        """
        annotation_info = self.annotation_map.get(client_id)
        if not annotation_info:
            return False

        data = annotation_info['data']

        if annotation_info['type'] == 'shape':
            # 静态 shape：检查帧号是否匹配
            shape_frame = data.get('frame')
            return shape_frame == frame

        elif annotation_info['type'] == 'track':
            # 动态 track：检查帧是否在范围内且未标记为 outside
            track_shapes = data.get('shapes', [])
            for shape in track_shapes:
                if shape.get('frame') == frame:
                    # 检查是否标记为 outside（不可见）
                    return not shape.get('outside', False)
            return False

        return False

    def get_annotation_bbox(self, client_id: int, frame: int) -> Optional[Dict[str, float]]:
        """
        获取标注在指定帧的边界框

        Args:
            client_id: 标注 ID
            frame: 帧号

        Returns:
            {'xtl': x1, 'ytl': y1, 'xbr': x2, 'ybr': y2} 或 None
        """
        annotation_info = self.annotation_map.get(client_id)
        if not annotation_info:
            return None

        data = annotation_info['data']

        if annotation_info['type'] == 'shape':
            # 静态 shape
            if data.get('frame') != frame:
                return None

            shape_type = data.get('type')
            points = data.get('points', [])

            if shape_type == 'rectangle' and len(points) >= 4:
                return {
                    'xtl': points[0],
                    'ytl': points[1],
                    'xbr': points[2],
                    'ybr': points[3]
                }
            elif shape_type == 'polygon' and len(points) >= 2:
                # 多边形：计算外接矩形
                xs = [points[i] for i in range(0, len(points), 2)]
                ys = [points[i] for i in range(1, len(points), 2)]
                return {
                    'xtl': min(xs),
                    'ytl': min(ys),
                    'xbr': max(xs),
                    'ybr': max(ys)
                }

        elif annotation_info['type'] == 'track':
            # 动态 track
            track_shapes = data.get('shapes', [])
            for shape in track_shapes:
                if shape.get('frame') == frame and not shape.get('outside', False):
                    points = shape.get('points', [])
                    shape_type = data.get('type')  # track 的 type 在顶层

                    if shape_type == 'rectangle' and len(points) >= 4:
                        return {
                            'xtl': points[0],
                            'ytl': points[1],
                            'xbr': points[2],
                            'ybr': points[3]
                        }
                    elif shape_type == 'polygon' and len(points) >= 2:
                        xs = [points[i] for i in range(0, len(points), 2)]
                        ys = [points[i] for i in range(1, len(points), 2)]
                        return {
                            'xtl': min(xs),
                            'ytl': min(ys),
                            'xbr': max(xs),
                            'ybr': max(ys)
                        }

        return None

    def calculate_candidate_positions(
        self,
        bbox: Dict[str, float],
        offset: float = 5.0
    ) -> List[Dict[str, Any]]:
        """
        计算边界框内的候选位置（优先级递减）

        Args:
            bbox: 边界框 {'xtl': x1, 'ytl': y1, 'xbr': x2, 'ybr': y2}
            offset: 边缘偏移量（像素）

        Returns:
            候选位置列表 [{'x': float, 'y': float, 'priority': int}, ...]
        """
        xtl, ytl = bbox['xtl'], bbox['ytl']
        xbr, ybr = bbox['xbr'], bbox['ybr']

        width = xbr - xtl
        height = ybr - ytl

        # 9 个候选位置（优先级 1-3）
        candidates = [
            # 优先级 1: 中心点
            {'x': xtl + width / 2, 'y': ytl + height / 2, 'priority': 1},

            # 优先级 2: 四个角
            {'x': xtl + offset, 'y': ytl + offset, 'priority': 2},
            {'x': xbr - offset, 'y': ytl + offset, 'priority': 2},
            {'x': xtl + offset, 'y': ybr - offset, 'priority': 2},
            {'x': xbr - offset, 'y': ybr - offset, 'priority': 2},

            # 优先级 3: 四条边的中点
            {'x': xtl + width / 2, 'y': ytl + offset, 'priority': 3},
            {'x': xtl + width / 2, 'y': ybr - offset, 'priority': 3},
            {'x': xtl + offset, 'y': ytl + height / 2, 'priority': 3},
            {'x': xbr - offset, 'y': ytl + height / 2, 'priority': 3}
        ]

        # 按优先级排序
        candidates.sort(key=lambda c: c['priority'])

        return candidates

    def get_existing_relation_points(self, frame: int) -> List[Position]:
        """
        获取指定帧已存在的关系点位置

        Args:
            frame: 帧号

        Returns:
            关系点位置列表
        """
        relation_points = []

        # 遍历所有 shapes，找到类型为 'points' 且标签为 'Relation' 的标注
        for shape in self.shapes:
            if (shape.get('type') == 'points' and
                shape.get('frame') == frame):

                # 检查标签名称
                label_id = shape.get('label_id')
                # 注意：这里需要结合 job 的 labels 信息来判断
                # 简化处理：假设有 attributes 中包含 predicate 的就是关系点
                attributes = shape.get('attributes', [])
                is_relation = any(
                    attr.get('spec_id') == 'predicate' or attr.get('name') == 'predicate'
                    for attr in attributes
                )

                if is_relation:
                    points = shape.get('points', [])
                    if len(points) >= 2:
                        relation_points.append(Position(x=points[0], y=points[1]))

        return relation_points

    def is_position_valid(
        self,
        position: Position,
        existing_points: List[Position],
        min_distance: float
    ) -> bool:
        """
        检查位置是否有效（不与已有点冲突）

        Args:
            position: 待检查的位置
            existing_points: 已存在的关系点
            min_distance: 最小距离阈值

        Returns:
            是否有效
        """
        for point in existing_points:
            distance = ((position.x - point.x) ** 2 +
                        (position.y - point.y) ** 2) ** 0.5
            if distance < min_distance:
                return False
        return True

    def find_best_position(
        self,
        spec: RelationSpec,
        min_distance: float
    ) -> Optional[Position]:
        """
        为关系找到最佳位置

        Args:
            spec: 关系规格
            min_distance: 最小距离阈值

        Returns:
            最佳位置或 None（无可用位置）
        """
        # 获取主体边界框
        bbox = self.get_annotation_bbox(spec.subject_id, spec.frame)
        if not bbox:
            return None

        # 计算候选位置
        candidates = self.calculate_candidate_positions(bbox)

        # 获取已存在的关系点
        existing_points = self.get_existing_relation_points(spec.frame)

        # 遍历候选位置，找到第一个有效的
        for candidate in candidates:
            position = Position(x=candidate['x'], y=candidate['y'])
            if self.is_position_valid(position, existing_points, min_distance):
                return position

        return None

    def create_relation_annotation(
        self,
        spec: RelationSpec,
        position: Position,
        relation_label_id: int
    ) -> Dict[str, Any]:
        """
        创建关系标注的数据结构

        Args:
            spec: 关系规格
            position: 关系点位置
            relation_label_id: Relation 标签的 ID

        Returns:
            CVAT 标注数据格式
        """
        return {
            'type': 'points',
            'frame': spec.frame,
            'label_id': relation_label_id,
            'points': [position.x, position.y],
            'occluded': False,
            'z_order': 0,
            'group': 0,
            'source': 'manual',
            'attributes': [
                {
                    'spec_id': 'predicate',  # 需要确保标签中有此属性
                    'value': spec.predicate
                },
                {
                    'spec_id': 'subject_id',
                    'value': str(spec.subject_id)
                },
                {
                    'spec_id': 'object_id',
                    'value': str(spec.object_id)
                }
            ]
        }

    def batch_create_relations(
        self,
        relation_specs: List[Dict[str, Any]],
        relation_label_id: int,
        min_distance: float = 10.0
    ) -> Dict[str, Any]:
        """
        批量创建关系标注

        Args:
            relation_specs: 关系规格列表
            relation_label_id: Relation 标签的 ID
            min_distance: 最小距离阈值

        Returns:
            {
                'created_annotations': [...],  # 新创建的标注列表
                'created_count': int,
                'errors': [{'relation': {...}, 'error': str}, ...]
            }
        """
        created_annotations = []
        errors = []

        for spec_dict in relation_specs:
            try:
                # 构建 RelationSpec
                spec = RelationSpec(
                    subject_id=spec_dict['subject_id'],
                    object_id=spec_dict['object_id'],
                    predicate=spec_dict['predicate'],
                    frame=spec_dict['frame']
                )

                # 验证关系
                is_valid, error_msg = self.validate_relation(spec)
                if not is_valid:
                    errors.append({
                        'relation': spec_dict,
                        'error': error_msg
                    })
                    continue

                # 计算位置
                position = self.find_best_position(spec, min_distance)
                if not position:
                    errors.append({
                        'relation': spec_dict,
                        'error': '无可用位置（所有候选位置均被占用）'
                    })
                    continue

                # 创建标注
                annotation = self.create_relation_annotation(
                    spec, position, relation_label_id
                )
                created_annotations.append(annotation)

            except Exception as e:
                logger.exception(f"处理关系时出错: {spec_dict}")
                errors.append({
                    'relation': spec_dict,
                    'error': str(e)
                })

        return {
            'created_annotations': created_annotations,
            'created_count': len(created_annotations),
            'errors': errors
        }
