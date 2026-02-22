# Copyright (C) 2026 CVAT Relation Tool Contributors
# SPDX-License-Identifier: MIT

"""
辅助工具函数模块
"""

from typing import Optional, Dict, Any


def get_relation_label_id(job) -> Optional[int]:
    """
    获取 'Relation' 标签的 ID

    Args:
        job: CVAT Job 对象

    Returns:
        标签 ID 或 None
    """
    try:
        # 获取 job 所属的 task
        task = job.segment.task

        # 遍历 task 的所有标签
        for label in task.labels.all():
            if label.name.lower() == 'relation':
                return label.id

        return None
    except Exception:
        return None


def validate_relation_label_attributes(job) -> Dict[str, Any]:
    """
    验证 Relation 标签是否包含必需的属性

    Args:
        job: CVAT Job 对象

    Returns:
        {
            'valid': bool,
            'missing_attributes': List[str],
            'label_id': Optional[int]
        }
    """
    required_attributes = ['predicate', 'subject_id', 'object_id']

    try:
        task = job.segment.task
        relation_label = None

        # 查找 Relation 标签
        for label in task.labels.all():
            if label.name.lower() == 'relation':
                relation_label = label
                break

        if not relation_label:
            return {
                'valid': False,
                'missing_attributes': ['Relation 标签不存在'],
                'label_id': None
            }

        # 检查标签属性
        existing_attributes = set(
            attr.name for attr in relation_label.attributes.all()
        )

        missing_attributes = [
            attr for attr in required_attributes
            if attr not in existing_attributes
        ]

        return {
            'valid': len(missing_attributes) == 0,
            'missing_attributes': missing_attributes,
            'label_id': relation_label.id
        }

    except Exception as e:
        return {
            'valid': False,
            'missing_attributes': [f'验证失败: {str(e)}'],
            'label_id': None
        }


def calculate_adaptive_min_distance(bbox: Dict[str, float]) -> float:
    """
    根据边界框大小自适应计算最小距离

    Args:
        bbox: 边界框 {'xtl': x1, 'ytl': y1, 'xbr': x2, 'ybr': y2}

    Returns:
        推荐的最小距离（像素）
    """
    width = bbox['xbr'] - bbox['xtl']
    height = bbox['ybr'] - bbox['ytl']

    # 取宽高中的较小值的 30% 作为最小距离
    min_dimension = min(width, height)
    adaptive_distance = min_dimension * 0.3

    # 限制在 5-50 像素之间
    return max(5.0, min(50.0, adaptive_distance))
