import importlib.util
from pathlib import Path
import unittest


MODULE_PATH = Path(__file__).resolve().parents[1] / "create" / "generate_references.py"
SPEC = importlib.util.spec_from_file_location("generate_references", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class GenerateReferencesTests(unittest.TestCase):
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
