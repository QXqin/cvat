# Copyright (C) 2026 CVAT Relation Tool Contributors
# SPDX-License-Identifier: MIT

import unittest
from unittest.mock import MagicMock
from cvat.apps.engine.relation_tool.processor import RelationProcessor

class TestRelationProcessor(unittest.TestCase):
    def setUp(self):
        self.db_job = MagicMock()
        self.db_job.segment.task.project = None

        self.logger = MagicMock()
        self.processor = RelationProcessor(self.db_job, self.logger)

        relations_data = [
            {
                "subject_id": 1,
                "object_id": 2,
                "predicate": "near",
                "frame": 0
            }
        ]
        self.mock_data = {
            "version": "1.0",
            "relations": relations_data,
            "min_distance": 10.0
        }

    def test_validate_data_format(self):
        # Valid data
        self.assertTrue(self.processor._validate_data_format(self.mock_data))

        # Missing required fields
        invalid_data = {"version": "1.0"}
        self.assertFalse(self.processor._validate_data_format(invalid_data))

    def test_calculate_distance(self):
        # Using simple euclidean distance
        p1 = (0, 0)
        p2 = (3, 4)
        self.assertEqual(self.processor._calculate_distance(p1, p2), 5.0)

    def test_get_box_from_shape(self):
        # Test rectangle extraction
        mock_shape = MagicMock()
        mock_shape.points = [10.0, 20.0, 110.0, 120.0]

        box = self.processor._get_box_from_shape(mock_shape)
        self.assertEqual(box, (10.0, 20.0, 110.0, 120.0))

if __name__ == '__main__':
    unittest.main()
