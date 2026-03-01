# Copyright (C) 2026 CVAT Relation Tool Contributors
# SPDX-License-Identifier: MIT

"""
Core module for the Relation Annotation Processor.
Handles relation point creation, position calculation, collision detection,
and batch operations.
"""

import logging
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class RelationSpec:
    """Specification for a single relationship annotation."""
    subject_id: int    # Client ID of the subject annotation
    object_id: int     # Client ID of the object annotation
    predicate: str     # Predicate (relationship type)
    frame: int         # Frame number


@dataclass
class Position:
    """2D coordinate."""
    x: float
    y: float


class RelationProcessor:
    """
    Relation Annotation Processor.

    Core responsibilities:
    1. Validate subject/object annotation existence and visibility.
    2. Calculate optimal relation point positions (with collision avoidance).
    3. Batch-create relation annotations.
    4. Clean up invalid relations.
    """

    def __init__(self, job_data: Dict[str, Any]):
        """
        Initialize the processor.

        Args:
            job_data: CVAT Job annotation data (from job.get_annotations()).
                      Format: {'shapes': [...], 'tracks': [...], 'tags': [...]}
        """
        self.job_data = job_data
        self.shapes = job_data.get('shapes', [])
        self.tracks = job_data.get('tracks', [])

        self._build_annotation_index()

    def _build_annotation_index(self):
        """Build an annotation lookup index for fast ID-based retrieval."""
        self.annotation_map = {}

        for shape in self.shapes:
            client_id = shape.get('id')
            if client_id:
                self.annotation_map[client_id] = {
                    'type': 'shape',
                    'data': shape,
                }

        for track in self.tracks:
            client_id = track.get('id')
            if client_id:
                self.annotation_map[client_id] = {
                    'type': 'track',
                    'data': track,
                }

    def validate_relation(self, spec: RelationSpec) -> Tuple[bool, Optional[str]]:
        """
        Validate a relation specification.

        Args:
            spec: The relation specification to validate.

        Returns:
            A tuple of (is_valid, error_message).
        """
        if spec.subject_id not in self.annotation_map:
            return False, f"Subject annotation ID {spec.subject_id} not found"

        if spec.object_id not in self.annotation_map:
            return False, f"Object annotation ID {spec.object_id} not found"

        if spec.subject_id == spec.object_id:
            return False, "Subject and object cannot be the same annotation"

        if not spec.predicate or not spec.predicate.strip():
            return False, "Predicate cannot be empty"

        subject_valid = self._check_annotation_in_frame(
            spec.subject_id, spec.frame
        )
        object_valid = self._check_annotation_in_frame(
            spec.object_id, spec.frame
        )

        if not subject_valid:
            return False, f"Subject not visible at frame {spec.frame}"

        if not object_valid:
            return False, f"Object not visible at frame {spec.frame}"

        return True, None

    def _check_annotation_in_frame(self, client_id: int, frame: int) -> bool:
        """
        Check whether an annotation is visible at the specified frame.

        Args:
            client_id: Annotation client ID.
            frame: Frame number.

        Returns:
            True if the annotation is visible; False otherwise.
        """
        annotation_info = self.annotation_map.get(client_id)
        if not annotation_info:
            return False

        data = annotation_info['data']

        if annotation_info['type'] == 'shape':
            return data.get('frame') == frame

        elif annotation_info['type'] == 'track':
            track_shapes = data.get('shapes', [])
            for shape in track_shapes:
                if shape.get('frame') == frame:
                    return not shape.get('outside', False)
            return False

        return False

    def get_annotation_bbox(self, client_id: int, frame: int) -> Optional[Dict[str, float]]:
        """
        Retrieve the bounding box of an annotation at a given frame.

        Args:
            client_id: Annotation client ID.
            frame: Frame number.

        Returns:
            A dict {'xtl', 'ytl', 'xbr', 'ybr'} or None if unavailable.
        """
        annotation_info = self.annotation_map.get(client_id)
        if not annotation_info:
            return None

        data = annotation_info['data']

        if annotation_info['type'] == 'shape':
            if data.get('frame') != frame:
                return None

            shape_type = data.get('type')
            points = data.get('points', [])

            if shape_type == 'rectangle' and len(points) >= 4:
                return {
                    'xtl': points[0], 'ytl': points[1],
                    'xbr': points[2], 'ybr': points[3],
                }
            elif shape_type == 'polygon' and len(points) >= 2:
                xs = [points[i] for i in range(0, len(points), 2)]
                ys = [points[i] for i in range(1, len(points), 2)]
                return {
                    'xtl': min(xs), 'ytl': min(ys),
                    'xbr': max(xs), 'ybr': max(ys),
                }

        elif annotation_info['type'] == 'track':
            track_shapes = data.get('shapes', [])
            for shape in track_shapes:
                if shape.get('frame') == frame and not shape.get('outside', False):
                    points = shape.get('points', [])
                    shape_type = data.get('type')

                    if shape_type == 'rectangle' and len(points) >= 4:
                        return {
                            'xtl': points[0], 'ytl': points[1],
                            'xbr': points[2], 'ybr': points[3],
                        }
                    elif shape_type == 'polygon' and len(points) >= 2:
                        xs = [points[i] for i in range(0, len(points), 2)]
                        ys = [points[i] for i in range(1, len(points), 2)]
                        return {
                            'xtl': min(xs), 'ytl': min(ys),
                            'xbr': max(xs), 'ybr': max(ys),
                        }

        return None

    def calculate_candidate_positions(
        self,
        bbox: Dict[str, float],
        offset: float = 5.0,
    ) -> List[Dict[str, Any]]:
        """
        Generate candidate positions within a bounding box, ordered by priority.

        Priority 1: Center point.
        Priority 2: Four corners (inset by offset).
        Priority 3: Midpoints of each edge (inset by offset).

        Args:
            bbox: Bounding box {'xtl', 'ytl', 'xbr', 'ybr'}.
            offset: Inset from the edge in pixels.

        Returns:
            List of candidate dicts [{'x', 'y', 'priority'}, ...].
        """
        xtl, ytl = bbox['xtl'], bbox['ytl']
        xbr, ybr = bbox['xbr'], bbox['ybr']
        width = xbr - xtl
        height = ybr - ytl

        candidates = [
            # Priority 1: Center
            {'x': xtl + width / 2, 'y': ytl + height / 2, 'priority': 1},
            # Priority 2: Corners
            {'x': xtl + offset, 'y': ytl + offset, 'priority': 2},
            {'x': xbr - offset, 'y': ytl + offset, 'priority': 2},
            {'x': xtl + offset, 'y': ybr - offset, 'priority': 2},
            {'x': xbr - offset, 'y': ybr - offset, 'priority': 2},
            # Priority 3: Edge midpoints
            {'x': xtl + width / 2, 'y': ytl + offset, 'priority': 3},
            {'x': xtl + width / 2, 'y': ybr - offset, 'priority': 3},
            {'x': xtl + offset, 'y': ytl + height / 2, 'priority': 3},
            {'x': xbr - offset, 'y': ytl + height / 2, 'priority': 3},
        ]

        candidates.sort(key=lambda c: c['priority'])
        return candidates

    def get_existing_relation_points(self, frame: int) -> List[Position]:
        """
        Retrieve positions of existing relation points at a given frame.

        Args:
            frame: Frame number.

        Returns:
            List of Position objects for existing relation points.
        """
        relation_points = []

        for shape in self.shapes:
            if shape.get('type') == 'points' and shape.get('frame') == frame:
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
        min_distance: float,
    ) -> bool:
        """
        Check whether a candidate position is valid (does not collide with existing points).

        Args:
            position: The candidate position.
            existing_points: List of existing relation point positions.
            min_distance: Minimum allowed distance (pixels).

        Returns:
            True if the position is valid; False if it collides.
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
        min_distance: float,
    ) -> Optional[Position]:
        """
        Find the best available position for a relation annotation.

        Tries candidate positions in priority order and returns the first one
        that does not collide with existing relation points.

        Args:
            spec: Relation specification.
            min_distance: Minimum distance threshold (pixels).

        Returns:
            The best Position, or None if all candidates are occupied.
        """
        bbox = self.get_annotation_bbox(spec.subject_id, spec.frame)
        if not bbox:
            return None

        candidates = self.calculate_candidate_positions(bbox)
        existing_points = self.get_existing_relation_points(spec.frame)

        for candidate in candidates:
            position = Position(x=candidate['x'], y=candidate['y'])
            if self.is_position_valid(position, existing_points, min_distance):
                return position

        return None

    def create_relation_annotation(
        self,
        spec: RelationSpec,
        position: Position,
        relation_label_id: int,
    ) -> Dict[str, Any]:
        """
        Build a CVAT-compatible annotation data structure for a relation.

        Args:
            spec: Relation specification.
            position: Computed position for the relation point.
            relation_label_id: The numeric ID of the 'Relation' label.

        Returns:
            A dict in CVAT annotation format.
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
                {'spec_id': 'predicate', 'value': spec.predicate},
                {'spec_id': 'subject_id', 'value': str(spec.subject_id)},
                {'spec_id': 'object_id', 'value': str(spec.object_id)},
            ],
        }

    def batch_create_relations(
        self,
        relation_specs: List[Dict[str, Any]],
        relation_label_id: int,
        min_distance: float = 10.0,
    ) -> Dict[str, Any]:
        """
        Batch-create relation annotations from a list of specifications.

        Args:
            relation_specs: List of relation spec dicts.
            relation_label_id: The numeric ID of the 'Relation' label.
            min_distance: Minimum distance threshold (pixels).

        Returns:
            A dict with:
                'created_annotations': list of created annotation dicts.
                'created_count': number of successfully created annotations.
                'errors': list of {'relation': dict, 'error': str} for failures.
        """
        created_annotations = []
        errors = []

        for spec_dict in relation_specs:
            try:
                spec = RelationSpec(
                    subject_id=spec_dict['subject_id'],
                    object_id=spec_dict['object_id'],
                    predicate=spec_dict['predicate'],
                    frame=spec_dict['frame'],
                )

                is_valid, error_msg = self.validate_relation(spec)
                if not is_valid:
                    errors.append({'relation': spec_dict, 'error': error_msg})
                    continue

                position = self.find_best_position(spec, min_distance)
                if not position:
                    errors.append({
                        'relation': spec_dict,
                        'error': 'No available position (all candidates occupied)',
                    })
                    continue

                annotation = self.create_relation_annotation(
                    spec, position, relation_label_id
                )
                created_annotations.append(annotation)

            except Exception as e:
                logger.exception("Error processing relation: %s", spec_dict)
                errors.append({'relation': spec_dict, 'error': str(e)})

        return {
            'created_annotations': created_annotations,
            'created_count': len(created_annotations),
            'errors': errors,
        }
