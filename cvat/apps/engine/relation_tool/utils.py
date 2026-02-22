# Copyright (C) 2026 CVAT Relation Tool Contributors
# SPDX-License-Identifier: MIT

"""
Utility functions for the Relation Annotation Tool.
"""

from typing import Optional, Dict, Any


def get_relation_label_id(job) -> Optional[int]:
    """
    Retrieve the label ID for the 'Relation' label within a job.

    Args:
        job: A CVAT Job object.

    Returns:
        The label ID (int) if found, otherwise None.
    """
    try:
        task = job.segment.task
        for label in task.labels.all():
            if label.name.lower() == 'relation':
                return label.id
        return None
    except Exception:
        return None


def validate_relation_label_attributes(job) -> Dict[str, Any]:
    """
    Validate that the 'Relation' label contains the required attributes:
    'predicate', 'subject_id', and 'object_id'.

    Args:
        job: A CVAT Job object.

    Returns:
        A dict with keys:
            'valid' (bool): Whether all required attributes are present.
            'missing_attributes' (list[str]): Names of missing attributes.
            'label_id' (int | None): The Relation label ID if found.
    """
    required_attributes = ['predicate', 'subject_id', 'object_id']

    try:
        task = job.segment.task
        relation_label = None

        for label in task.labels.all():
            if label.name.lower() == 'relation':
                relation_label = label
                break

        if not relation_label:
            return {
                'valid': False,
                'missing_attributes': ['Relation label not found'],
                'label_id': None,
            }

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
            'label_id': relation_label.id,
        }

    except Exception as e:
        return {
            'valid': False,
            'missing_attributes': [f'Validation failed: {str(e)}'],
            'label_id': None,
        }


def calculate_adaptive_min_distance(bbox: Dict[str, float]) -> float:
    """
    Calculate an adaptive minimum distance threshold based on bounding box dimensions.

    Uses 30% of the smaller dimension (width or height), clamped to [5, 50] pixels.

    Args:
        bbox: Bounding box dict with keys 'xtl', 'ytl', 'xbr', 'ybr'.

    Returns:
        Recommended minimum distance in pixels.
    """
    width = bbox['xbr'] - bbox['xtl']
    height = bbox['ybr'] - bbox['ytl']

    min_dimension = min(width, height)
    adaptive_distance = min_dimension * 0.3

    return max(5.0, min(50.0, adaptive_distance))
