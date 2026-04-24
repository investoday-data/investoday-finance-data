import importlib.util
from pathlib import Path
import tempfile
import unittest


MODULE_PATH = Path(__file__).resolve().parents[1] / "create" / "generate_references.py"
SPEC = importlib.util.spec_from_file_location("generate_references", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class GenerateReferencesTests(unittest.TestCase):
    def test_build_group_tree_groups_by_leaf_path(self):
        flat_apis = [
            {
                "group_path": ["沪深京数据", "公司行为", "基本信息"],
                "group_path_en": ["A-share", "Corporate Actions", "Basic Info"],
                "api_name": "上市公司违规处罚",
                "tool_name": "list_stock_violation_penalt",
                "tool_id": "list_stock_violation_penalt",
                "api_path": "stock/violation-penalties",
                "apiMethod": "POST",
            },
            {
                "group_path": ["沪深京数据", "公司行为", "并购重组"],
                "group_path_en": ["A-share", "Corporate Actions", "M&A"],
                "api_name": "公司吸收合并",
                "tool_name": "list_stock_absorption_mergers",
                "tool_id": "list_stock_absorption_mergers",
                "api_path": "stock/absorp-mergers",
                "apiMethod": "POST",
            },
        ]

        group_tree = MODULE.build_group_tree(flat_apis)

        self.assertIn(("沪深京数据", "公司行为", "基本信息"), group_tree)
        self.assertIn(("沪深京数据", "公司行为", "并购重组"), group_tree)
        self.assertEqual(len(group_tree[("沪深京数据", "公司行为", "基本信息")]), 1)
        self.assertEqual(len(group_tree[("沪深京数据", "公司行为", "并购重组")]), 1)

    def test_write_references_writes_nested_leaf_paths(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            output_dir = Path(tmp_dir) / "skills" / "references"
            group_tree = {
                ("沪深京数据", "公司行为", "基本信息"): [
                    {
                        "group_path": ["沪深京数据", "公司行为", "基本信息"],
                        "group_path_en": ["A-share", "Corporate Actions", "Basic Info"],
                        "api_name": "上市公司违规处罚",
                        "tool_name": "list_stock_violation_penalt",
                        "tool_id": "list_stock_violation_penalt",
                        "api_path": "stock/violation-penalties",
                        "apiMethod": "POST",
                    }
                ]
            }
            path_map = {
                "list_stock_violation_penalt": {
                    "path": "stock/violation-penalties",
                    "method": "POST",
                    "summary": "上市公司违规处罚",
                    "description": "查询上市公司违规处罚",
                    "parameters": [],
                    "response_fields": [],
                }
            }

            records = MODULE.write_references(group_tree, path_map, output_dir)

            target = output_dir / "沪深京数据" / "公司行为" / "基本信息.md"
            self.assertTrue(target.exists())
            self.assertEqual(records[0]["rel_path"], "references/沪深京数据/公司行为/基本信息.md")

    def test_generate_references_index_md_uses_hierarchical_headings(self):
        records = [
            {
                "group_path": ("沪深京数据", "公司行为", "基本信息"),
                "group_path_en": ("A-share", "Corporate Actions", "Basic Info"),
                "count": 12,
                "rel_path": "references/沪深京数据/公司行为/基本信息.md",
            },
            {
                "group_path": ("沪深京数据", "公司行为", "股本股东"),
                "group_path_en": ("A-share", "Corporate Actions", "Capital & Shareholders"),
                "count": 12,
                "rel_path": "references/沪深京数据/公司行为/股本股东.md",
            },
        ]

        content = MODULE.generate_references_index_md(records)

        self.assertIn("## 沪深京数据", content)
        self.assertIn("### 公司行为", content)
        self.assertIn("- [基本信息](../references/沪深京数据/公司行为/基本信息.md)", content)
        self.assertIn("- [股本股东](../references/沪深京数据/公司行为/股本股东.md)", content)

    def test_sync_package_metadata_copies_openapi_and_tree_into_package_data_dir(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            openapi_file = tmp_path / "openapi.json"
            tree_file = tmp_path / "tree.json"
            package_data_dir = tmp_path / "package" / "investoday-api" / "data"

            openapi_file.write_text('{"openapi":"3.0.0"}', encoding="utf-8")
            tree_file.write_text('{"data":[]}', encoding="utf-8")

            MODULE.sync_package_metadata(
                package_data_dir=package_data_dir,
                openapi_file=openapi_file,
                tree_file=tree_file,
            )

            self.assertEqual(
                (package_data_dir / "openapi.json").read_text(encoding="utf-8"),
                '{"openapi":"3.0.0"}',
            )
            self.assertEqual(
                (package_data_dir / "tree.json").read_text(encoding="utf-8"),
                '{"data":[]}',
            )

    def test_parse_openapi_paths_prefers_post_when_operation_id_is_duplicated(self):
        openapi = {
            "paths": {
                "/stock/unadjusted-quotes": {
                    "get": {
                        "operationId": "stock_unadjusted_quotes",
                        "summary": "GET version",
                        "description": "单标的查询",
                        "parameters": [
                            {
                                "name": "stockCode",
                                "required": True,
                                "description": "股票代码",
                                "schema": {"type": "string", "example": "600519"},
                            }
                        ],
                        "responses": {
                            "200": {
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "type": "object",
                                            "properties": {
                                                "data": {
                                                    "type": "object",
                                                    "properties": {
                                                        "close": {"description": "收盘价", "example": 123.45}
                                                    },
                                                }
                                            },
                                        }
                                    }
                                }
                            }
                        },
                    }
                },
                "/stock/unadjusted-quotes-batch": {
                    "post": {
                        "operationId": "stock_unadjusted_quotes",
                        "summary": "POST version",
                        "description": "批量查询",
                        "requestBody": {
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "required": ["stockCodes"],
                                        "properties": {
                                            "stockCodes": {"type": "array", "example": ["600519", "000001"]},
                                        },
                                    }
                                }
                            }
                        },
                        "responses": {
                            "200": {
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "type": "object",
                                            "properties": {
                                                "data": {
                                                    "type": "array",
                                                    "items": {
                                                        "properties": {
                                                            "close": {"description": "收盘价", "example": 123.45}
                                                        }
                                                    },
                                                }
                                            },
                                        }
                                    }
                                }
                            }
                        },
                    }
                },
            }
        }

        path_map = MODULE.parse_openapi_paths(openapi)
        detail = path_map["stock_unadjusted_quotes"]

        self.assertEqual(detail["method"], "POST")
        self.assertEqual(detail["path"], "stock/unadjusted-quotes-batch")
        self.assertEqual(detail["description"], "批量查询")
        self.assertEqual(detail["parameters"][0]["name"], "stockCodes")

    def test_extract_response_fields_supports_top_level_properties(self):
        operation = {
            "responses": {
                "200": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "code": {"description": "响应状态码", "example": 0},
                                    "message": {"description": "响应消息", "example": "success"},
                                    "announcementId": {"description": "公告ID", "example": 9128035},
                                    "title": {"description": "公告标题", "example": "董事会决议公告"},
                                },
                            }
                        }
                    }
                }
            }
        }

        fields = MODULE._extract_response_fields(operation)

        self.assertEqual(
            fields,
            [
                {"name": "announcementId", "desc": "公告ID", "example": 9128035},
                {"name": "title", "desc": "公告标题", "example": "董事会决议公告"},
            ],
        )

    def test_render_api_block_uses_consistent_labels(self):
        api = {
            "api_name": "上市公司的公告",
            "api_path": "announcements",
            "apiMethod": "GET",
            "tool_id": "list_announcements",
            "tool_name": "list_announcements",
        }
        detail = {
            "path": "announcements",
            "method": "GET",
            "description": "查询上市公司公告",
            "parameters": [{"name": "stockCode", "required": True, "type": "string", "desc": "股票代码", "example": "000001"}],
            "response_fields": [{"name": "announcementId", "desc": "公告ID", "example": 9128035}],
        }

        lines = MODULE._render_api_block(api, detail)
        text = "\n".join(lines)

        self.assertIn("接口路径：`announcements`", text)
        self.assertIn("请求方式：`GET`", text)
        self.assertIn("tool_id：`list_announcements`", text)
        self.assertIn("接口说明：查询上市公司公告", text)
        self.assertIn("**输出参数**", text)


if __name__ == "__main__":
    unittest.main()
