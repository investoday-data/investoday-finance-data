"""
生成 investoday API 参考文档 (skills/references/)

【维护者工具】用于从 OpenAPI 规范和菜单分组树自动生成 skills/references/ 下的文档。
技能使用者无需关注此脚本，直接使用 skills/ 目录即可。

输出结构（按子分组拆分）：
  skills/references/
    基础数据.md           ← 无子分组时直接输出为顶级文件
    沪深京数据/
      基础信息.md
      股票行情.md
      ...
    基金/
      基金行情.md
      ...

数据来源：
  - OpenAPI 规范: OPENAPI_URL  (公开接口，无需 API Key)
  - 菜单分组树:   TREE_URL     (公开接口，无需 API Key)

API Key 用途（可选）：
  - 用于 --validate 验证密钥可用性
  - 仅从环境变量 INVESTODAY_API_KEY 中读取

本地缓存文件（与本脚本同目录）：
  openapi.json   OpenAPI 规范（优先读取，避免每次请求网络）
  tree.json      菜单分组树

用法（从项目根目录执行）：
  python create/generate_references.py             # 读本地缓存生成文档
  python create/generate_references.py --remote    # 拉远程最新数据并更新缓存
  python create/generate_references.py --validate  # 生成文档并验证 API Key
"""

import json
import argparse
import sys
import os
from pathlib import Path
from typing import Any
from urllib import request, error

# ─── 配置 ──────────────────────────────────────────────────────────────────────

OPENAPI_URL = "https://data-api.investoday.net/data/cloud/sys/api/export/api"
TREE_URL    = "https://data-api.investoday.net/data/cloud/sys/common/tree?apiId=-1"
BASE_URL    = "https://data-api.investoday.net/data"

VALIDATE_ENDPOINT = "/trade-calender/special-date"

DEFAULT_OUTPUT_DIR  = Path(__file__).parent.parent / "skills" / "references"
LOCAL_OPENAPI_FILE  = Path(__file__).parent / "openapi.json"
LOCAL_TREE_FILE     = Path(__file__).parent / "tree.json"
REQUEST_TIMEOUT     = 30

# ─── 环境变量加载 ─────────────────────────────────────────────────────────────

def load_api_key() -> str | None:
    """
    仅从环境变量 INVESTODAY_API_KEY 读取 API Key。
    """
    key = os.environ.get("INVESTODAY_API_KEY")
    if key:
        return key.strip()

    return None

# ─── 数据获取 ──────────────────────────────────────────────────────────────────

def fetch_json(url: str, headers: dict | None = None) -> Any:
    """从 URL 获取 JSON 数据"""
    try:
        req = request.Request(url, headers=headers or {})
        with request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            return json.load(resp)
    except (error.URLError, error.HTTPError) as e:
        print(f"请求失败 {url}: {e}", file=sys.stderr)
        sys.exit(1)


def fetch_openapi(force_remote: bool = False) -> dict:
    if not force_remote and LOCAL_OPENAPI_FILE.exists():
        print(f"读取本地 OpenAPI 规范（{LOCAL_OPENAPI_FILE.name}）...")
        return json.loads(LOCAL_OPENAPI_FILE.read_text(encoding="utf-8"))
    print("正在获取远程 OpenAPI 规范...")
    data = fetch_json(OPENAPI_URL)
    LOCAL_OPENAPI_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  已保存至 {LOCAL_OPENAPI_FILE.name}")
    return data


def fetch_tree(force_remote: bool = False) -> list:
    if not force_remote and LOCAL_TREE_FILE.exists():
        print(f"读取本地菜单分组树（{LOCAL_TREE_FILE.name}）...")
        result = json.loads(LOCAL_TREE_FILE.read_text(encoding="utf-8"))
    else:
        print("正在获取远程菜单分组树...")
        result = fetch_json(TREE_URL)
        LOCAL_TREE_FILE.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  已保存至 {LOCAL_TREE_FILE.name}")
    if isinstance(result, dict) and "data" in result:
        return result["data"]
    return result


def validate_api_key(api_key: str) -> bool:
    """调用免费接口验证 API Key 是否有效"""
    print("正在验证 API Key...")
    try:
        req = request.Request(
            f"{BASE_URL}{VALIDATE_ENDPOINT}",
            headers={"apiKey": api_key},
        )
        with request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            data = json.load(resp)
        if data.get("code") == 0:
            print("✅ API Key 验证通过")
            return True
        else:
            print(f"❌ API Key 验证失败: [{data.get('code')}] {data.get('message')}")
            return False
    except (error.URLError, error.HTTPError, TimeoutError, OSError, ValueError) as e:
        print(f"❌ API Key 验证异常: {e}")
        return False

# ─── 数据解析 ──────────────────────────────────────────────────────────────────

def parse_openapi_paths(openapi: dict) -> dict[str, dict]:
    """
    解析 OpenAPI paths，返回 lookup key -> 接口详情 的映射。

    以 operationId 作为唯一 key。
    当同一 operationId 同时存在 GET 和 POST 时，优先保留 POST 版本，
    让 POST 覆盖 GET。
    """
    path_map: dict[str, dict] = {}
    for path, methods in openapi.get("paths", {}).items():
        for method, operation in methods.items():
            if not isinstance(operation, dict):
                continue
            op_id = operation.get("operationId", "")
            if not op_id:
                continue

            http_method = method.upper()

            # GET 接口：参数在 parameters 数组（query/path）
            params = [
                {
                    "name":     p.get("name", ""),
                    "in":       p.get("in", "query"),
                    "required": p.get("required", False),
                    "desc":     p.get("description", ""),
                    "example":  p.get("schema", {}).get("example", ""),
                    "type":     p.get("schema", {}).get("type", "string"),
                }
                for p in operation.get("parameters", [])
            ]

            # POST 接口：参数在 requestBody（JSON body）
            if http_method == "POST" and "requestBody" in operation:
                content = operation["requestBody"].get("content", {})
                schema  = content.get("application/json", {}).get("schema", {})
                props   = schema.get("properties", {})
                required_fields = set(schema.get("required", []))
                for name, prop in props.items():
                    params.append({
                        "name":     name,
                        "in":       "body",
                        "required": name in required_fields,
                        "desc":     prop.get("description", ""),
                        "example":  prop.get("example", ""),
                        "type":     prop.get("type", "string"),
                    })

            detail = {
                "path":            path.lstrip("/"),
                "method":          http_method,
                "summary":         operation.get("summary", ""),
                "description":     operation.get("description", ""),
                "parameters":      params,
                "response_fields": _extract_response_fields(operation),
            }

            existing = path_map.get(op_id)
            if existing is None or existing.get("method") != "POST" or http_method == "POST":
                path_map[op_id] = detail

    return path_map


def _extract_response_fields(operation: dict) -> list[dict]:
    """从 200 响应中提取 data 字段列表"""
    try:
        schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
        properties = schema.get("properties", {})
        data_prop = properties.get("data", {})

        if data_prop:
            if data_prop.get("type") == "array":
                source = data_prop.get("items", {}).get("properties", {})
            else:
                source = data_prop.get("properties", {})
        elif schema.get("type") == "array":
            source = schema.get("items", {}).get("properties", {})
        else:
            source = {
                key: value
                for key, value in properties.items()
                if key not in {"code", "message"}
            }

        return [
            {"name": k, "desc": v.get("description", ""), "example": v.get("example", "")}
            for k, v in source.items()
        ]
    except (KeyError, TypeError):
        return []


def _get_localized_field(data: dict, base_key: str, language: str = "zh") -> str:
    value = data.get(base_key, "")
    if language != "en":
        return value
    for candidate in (f"{base_key}En", f"{base_key}EN", f"{base_key}English"):
        localized = data.get(candidate)
        if localized:
            return localized
    return value


def flatten_tree(nodes: list, parent_path: list | None = None) -> list[dict]:
    """递归展平分组树，返回包含完整路径的 API 条目列表"""
    if parent_path is None:
        parent_path = []
    results = []
    for node in nodes:
        current_path = parent_path + [{
            "zh": node.get("groupName", ""),
            "en": _get_localized_field(node, "groupName", "en"),
        }]
        for child in node.get("children", []):
            results.extend(flatten_tree([child], current_path))
        for api in node.get("apis", []):
            results.append({
                "group_path": [item["zh"] for item in current_path],
                "group_path_en": [item["en"] for item in current_path],
                "api_name":   api.get("apiName", ""),
                "tool_name":  api.get("toolName", ""),
                "tool_id":    api.get("toolId", ""),
                "api_path":   api.get("apiPath", ""),
                "apiMethod":  api.get("apiMethod", ""),
            })
    return results


def build_group_tree(flat_apis: list[dict]) -> dict[str, dict[str, list]]:
    """将扁平 API 列表重建为两级分组字典: {顶级: {子级: [api, ...]}}"""
    tree: dict[str, dict[str, list]] = {}
    for api in flat_apis:
        path = [p for p in api["group_path"] if p != "分组"]
        if not path:
            continue
        top = path[0]
        sub = path[1] if len(path) > 1 else top
        tree.setdefault(top, {}).setdefault(sub, []).append(api)
    return tree

# ─── Markdown 生成 ─────────────────────────────────────────────────────────────

def _param_table(params: list[dict]) -> str:
    if not params:
        return "_无参数_\n"
    rows = ["| 参数名 | 必填 | 类型 | 说明 | 示例 |",
            "|--------|:----:|------|------|------|"]
    for p in params:
        req = "✅" if p["required"] else "—"
        ex = f"`{p['example']}`" if p["example"] != "" else "—"
        rows.append(f"| `{p['name']}` | {req} | {p['type']} | {p['desc'].replace(chr(10), ' ')} | {ex} |")
    return "\n".join(rows) + "\n"


def _field_table(fields: list[dict]) -> str:
    if not fields:
        return ""
    rows = ["| 字段名 | 说明 | 示例 |", "|--------|------|------|"]
    for f in fields[:30]:
        ex = f"`{f['example']}`" if f["example"] != "" else "—"
        rows.append(f"| `{f['name']}` | {str(f['desc']).replace(chr(10), ' ')} | {ex} |")
    if len(fields) > 30:
        rows.append(f"| ... | _共 {len(fields)} 个字段_ | |")
    return "\n".join(rows) + "\n"


def _code_example(api_path: str, method: str, params: list[dict]) -> str:
    """
    生成 investoday-api 调用命令示例。
    只展示必填参数，可选参数由 LLM 按需查表传入。
    无必填参数时展示完整命令（不带参数）。
    """
    required = [p for p in params if p.get("required")]
    show     = required if required else []

    parts = [f"investoday-api {api_path}"]
    if method == "POST":
        parts.append("--method POST")

    for p in show:
        ex  = p["example"]
        typ = p.get("type", "string")
        if typ == "array":
            # array 参数：展开为多个 key=value
            items = ex if isinstance(ex, list) else [str(ex).strip("[]' ").split(",")[0].strip().strip("'\"")]
            for item in items[:2]:
                parts.append(f"{p['name']}={str(item).strip()}")
        else:
            val = ex if (ex != "" and ex is not None) else f"<{p['name']}>"
            parts.append(f"{p['name']}={val}")

    cmd = " ".join(parts)

    # 在命令下方加一行说明可选参数的提示
    optional_names = [p["name"] for p in params if not p.get("required")]
    if optional_names:
        optional_hint = f"# 可选参数: {', '.join(optional_names)}"
        return f"```bash\n{optional_hint}\n{cmd}\n```"
    return f"```bash\n{cmd}\n```"


def _detect_dual_method_ids(flat_apis: list[dict]) -> set[str]:
    """检测同时存在 GET 和 POST 的 tool_id，返回这些 id 的集合。"""
    from collections import defaultdict
    method_map: dict[str, set[str]] = defaultdict(set)
    for api in flat_apis:
        tid = api.get("tool_id", "")
        m = api.get("apiMethod", "").upper()
        if tid and m:
            method_map[tid].add(m)
    return {tid for tid, methods in method_map.items() if len(methods) > 1}


def _render_api_block(api: dict, detail: dict, dual_method_ids: set[str] | None = None) -> list[str]:
    """渲染单个接口的 Markdown 块"""
    lines = []
    api_path = api.get("api_path") or detail.get("path", "")
    # path_map 已按 operationId 唯一化，渲染时应以 detail 中的方法为准
    method   = detail.get("method", "").upper() or api.get("apiMethod", "").upper() or "GET"
    desc     = detail.get("description", "")
    params   = detail.get("parameters", [])

    tool_id   = api.get('tool_id', '')
    is_dual   = dual_method_ids and tool_id in dual_method_ids
    lines.append(f"## {api['api_name']}")
    lines.append("")
    method_badge = "**`POST`**" if method == "POST" else "`GET`"
    tool_name = api.get('tool_name') or tool_id
    lines.append(f"接口路径：`{api_path}`")
    lines.append(f"请求方式：{method_badge}")
    lines.append(f"tool_id：`{tool_id or tool_name}`")

    lines.append("")

    summary = detail.get("summary", "").strip()
    clean_desc = desc.replace("\n", " ").strip()
    interface_desc = clean_desc or summary
    if interface_desc:
        lines.append(f"接口说明：{interface_desc}")
        lines.append("")

    lines.append("**输入参数**")
    lines.append("")
    lines.append(_param_table(params))

    fields = detail.get("response_fields", [])
    if fields:
        lines.append("**输出参数**")
        lines.append("")
        lines.append(_field_table(fields))

    lines.append("**接口示例**")
    lines.append("")
    lines.append(_code_example(api_path, method, params))
    lines.append("")

    lines.append("---")
    lines.append("")
    return lines


def _is_flat_group(top_group: str, sub_groups: dict) -> bool:
    """判断是否为单层分组（无子分组，直接输出为 references/{top}.md）"""
    return len(sub_groups) == 1 and list(sub_groups.keys())[0] == top_group


def _lookup_api_detail(api: dict, path_map: dict) -> dict:
    """
    根据 tree 中的 api 条目查找 OpenAPI 详情。
    由于 path_map 已按 operationId 唯一化，这里只按 tool_id / tool_name 查找。
    当同一 operationId 同时存在 GET 和 POST 时，path_map 中保留 POST 版本。
    """
    tool_id   = api.get("tool_id", "")
    tool_name = api.get("tool_name", "")

    # 1. operationId / tool_id
    if tool_id:
        detail = path_map.get(tool_id)
        if detail:
            return detail

    # 2. fallback: tool_name
    if tool_name:
        detail = path_map.get(tool_name)
        if detail:
            return detail

    return {}


def generate_subgroup_md(top_group: str, sub_group: str, apis: list, path_map: dict,
                         dual_method_ids: set[str] | None = None) -> str:
    """为一个子分组生成 .md 内容"""
    title = top_group if sub_group == top_group else f"{top_group} / {sub_group}"
    lines = [
        f"# {title}",
        "",
        "---",
        "",
    ]
    for api in apis:
        detail = _lookup_api_detail(api, path_map)
        lines.extend(_render_api_block(api, detail, dual_method_ids))
    return "\n".join(lines)


def write_references(group_tree: dict, path_map: dict, output_dir: Path,
                     dual_method_ids: set[str] | None = None) -> list[dict]:
    """
    按子分组写出 .md 文件，返回文件信息列表供 SKILL.md 索引使用。

    规则：
    - 有子分组的顶级分组 → references/{top}/{sub}.md
    - 无子分组（flat）   → references/{top}.md
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    records = []  # [{top, sub, count, rel_path}]

    for top_group, sub_groups in group_tree.items():
        flat = _is_flat_group(top_group, sub_groups)

        for sub_group, apis in sub_groups.items():
            content = generate_subgroup_md(top_group, sub_group, apis, path_map, dual_method_ids)
            first_api = apis[0] if apis else {}
            localized_path = [
                en_name or zh_name
                for zh_name, en_name in zip(first_api.get("group_path", []), first_api.get("group_path_en", []))
                if zh_name != "分组"
            ]
            top_group_en = localized_path[0] if localized_path else top_group
            sub_group_en = top_group_en if flat else (localized_path[1] if len(localized_path) > 1 else sub_group)

            if flat:
                out_file = output_dir / f"{top_group}.md"
            else:
                sub_dir = output_dir / top_group
                sub_dir.mkdir(exist_ok=True)
                out_file = sub_dir / f"{sub_group}.md"

            rel_path = out_file.relative_to(output_dir.parent).as_posix()

            out_file.write_text(content, encoding="utf-8")
            records.append({
                "top":      top_group,
                "sub":      sub_group if not flat else "",
                "top_en":   top_group_en,
                "sub_en":   sub_group_en if not flat else "",
                "count":    len(apis),
                "rel_path": rel_path,
                "flat":     flat,
            })
            print(f"  ✓ {rel_path} ({len(apis)} 个接口)")

    return records


def _resolve_index_labels(record: dict, language: str) -> tuple[str, str]:
    if language != "en":
        top_label = record["top"]
        sub_label = record["top"] if record["flat"] else record["sub"]
        return top_label, sub_label

    top_label = record.get("top_en") or record["top"]
    sub_label = top_label if record["flat"] else (record.get("sub_en") or record["sub"])
    return top_label, sub_label


def generate_references_index_md(records: list[dict], language: str = "zh") -> str:
    if language == "en":
        lines = [
            "# Reference Index",
            "",
            "Check the files under `../references/` for endpoint paths, HTTP methods, and input parameters.",
            "The reference documents themselves are currently maintained in Chinese.",
            "",
        ]
    else:
        lines = [
            "# 接口索引",
            "",
            "在 `../references/` 目录中按分类查找接口路径、请求方法和输入参数。",
            "",
        ]

    prev_top = None
    for record in records:
        top_group = record["top"]
        if top_group != prev_top:
            if prev_top is not None:
                lines.append("")
            heading, _ = _resolve_index_labels(record, language)
            lines.append(f"## {heading}")
            lines.append("")

        _, title = _resolve_index_labels(record, language)
        rel_path = f"../{record['rel_path']}"
        lines.append(f"- [{title}]({rel_path})")
        prev_top = top_group

    lines.append("")
    return "\n".join(lines)


def write_references_index(records: list[dict], output_file: Path, language: str = "zh") -> None:
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(generate_references_index_md(records, language), encoding="utf-8")
    print(f"  ✓ {output_file.relative_to(output_file.parent.parent)}")


# ─── 入口 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="生成 investoday API 参考文档")
    parser.add_argument("--output", "-o", type=Path, default=DEFAULT_OUTPUT_DIR,
                        help=f"输出目录（默认: {DEFAULT_OUTPUT_DIR}）")
    parser.add_argument("--validate", action="store_true",
                        help="验证 API Key 可用性（需要环境变量 INVESTODAY_API_KEY）")
    parser.add_argument("--api-key", dest="api_key", default=None,
                        help="直接传入 API Key（优先级最高）")
    parser.add_argument("--remote", action="store_true",
                        help="强制从远程拉取最新数据（同时更新本地 openapi.json / tree.json）")
    args = parser.parse_args()

    # API Key 处理
    api_key = args.api_key or load_api_key()

    if args.validate:
        if not api_key:
            print("⚠️  未找到 API Key，跳过验证。请先设置环境变量 INVESTODAY_API_KEY=xxx", file=sys.stderr)
        else:
            validate_api_key(api_key)

    # 获取数据（默认读本地缓存，--remote 强制拉远程）
    openapi    = fetch_openapi(force_remote=args.remote)
    tree_data  = fetch_tree(force_remote=args.remote)

    print("解析数据...")
    path_map   = parse_openapi_paths(openapi)
    flat_apis  = flatten_tree(tree_data)
    group_tree = build_group_tree(flat_apis)
    dual_method_ids = _detect_dual_method_ids(flat_apis)

    # 生成子分组级 .md 文件
    output_dir: Path = args.output

    print("生成分组文档...")
    records = write_references(group_tree, path_map, output_dir, dual_method_ids)

    print("生成动态索引文档...")
    write_references_index(records, output_dir.parent / "docs" / "references-index.md")
    write_references_index(records, output_dir.parent / "docs" / "references-index.en.md", language="en")

    total_files = len(records)
    total_apis  = len(flat_apis)
    print(f"\n✅ 完成：共 {total_apis} 个接口，{total_files} 个文档 → {output_dir}")


if __name__ == "__main__":
    main()
