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
  - 从项目根目录 .env 或环境变量 INVESTODAY_API_KEY 中读取

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

try:
    import requests
except ImportError:
    print("请先安装依赖: pip install requests", file=sys.stderr)
    sys.exit(1)

# ─── 配置 ──────────────────────────────────────────────────────────────────────

OPENAPI_URL = "https://data-api.investoday.net/data/cloud/sys/api/export/api"
TREE_URL    = "https://data-api.investoday.net/data/cloud/sys/common/tree?apiId=-1"
BASE_URL    = "https://data-api.investoday.net/data"

VALIDATE_ENDPOINT = "/trade-calender/special-date"

DEFAULT_OUTPUT_DIR  = Path(__file__).parent.parent / "skills" / "references"
LOCAL_OPENAPI_FILE  = Path(__file__).parent / "openapi.json"
LOCAL_TREE_FILE     = Path(__file__).parent / "tree.json"
REQUEST_TIMEOUT     = 30

# ─── 环境变量 / .env 加载 ──────────────────────────────────────────────────────

def load_api_key() -> str | None:
    """
    按优先级加载 API Key：
    1. 命令行参数（由 argparse 传入）
    2. 环境变量 INVESTODAY_API_KEY
    3. 项目根目录的 .env 文件
    """
    # 先尝试环境变量
    key = os.environ.get("INVESTODAY_API_KEY")
    if key:
        return key.strip()

    # 再尝试 .env 文件（向上查找，最多 4 层）
    search_dir = Path(__file__).parent
    for _ in range(4):
        env_file = search_dir / ".env"
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                if k.strip() == "INVESTODAY_API_KEY":
                    return v.strip().strip('"').strip("'")
        search_dir = search_dir.parent

    return None

# ─── 数据获取 ──────────────────────────────────────────────────────────────────

def fetch_json(url: str, headers: dict | None = None) -> Any:
    """从 URL 获取 JSON 数据"""
    try:
        resp = requests.get(url, headers=headers or {}, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
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
    print(f"正在验证 API Key ({api_key[:8]}...)...")
    try:
        resp = requests.get(
            f"{BASE_URL}{VALIDATE_ENDPOINT}",
            headers={"apiKey": api_key},
            timeout=REQUEST_TIMEOUT,
        )
        data = resp.json()
        if data.get("code") == 0:
            print("✅ API Key 验证通过")
            return True
        else:
            print(f"❌ API Key 验证失败: [{data.get('code')}] {data.get('message')}")
            return False
    except Exception as e:
        print(f"❌ API Key 验证异常: {e}")
        return False

# ─── 数据解析 ──────────────────────────────────────────────────────────────────

def parse_openapi_paths(openapi: dict) -> dict[str, dict]:
    """解析 OpenAPI paths，返回 operationId -> 接口详情 的映射"""
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

            path_map[op_id] = {
                "path":            path.lstrip("/"),
                "method":          http_method,
                "summary":         operation.get("summary", ""),
                "description":     operation.get("description", ""),
                "parameters":      params,
                "response_fields": _extract_response_fields(operation),
            }
    return path_map


def _extract_response_fields(operation: dict) -> list[dict]:
    """从 200 响应中提取 data 字段列表"""
    try:
        schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
        data_prop = schema.get("properties", {}).get("data", {})
        if data_prop.get("type") == "array":
            source = data_prop.get("items", {}).get("properties", {})
        else:
            source = data_prop.get("properties", {})
        return [
            {"name": k, "desc": v.get("description", ""), "example": v.get("example", "")}
            for k, v in source.items()
        ]
    except (KeyError, TypeError):
        return []


def flatten_tree(nodes: list, parent_path: list | None = None) -> list[dict]:
    """递归展平分组树，返回包含完整路径的 API 条目列表"""
    if parent_path is None:
        parent_path = []
    results = []
    for node in nodes:
        current_path = parent_path + [node.get("groupName", "")]
        for child in node.get("children", []):
            results.extend(flatten_tree([child], current_path))
        for api in node.get("apis", []):
            results.append({
                "group_path": current_path,
                "api_name":   api.get("apiName", ""),
                "tool_name":  api.get("toolName", ""),
                "tool_id":    api.get("toolId", ""),
                "api_path":   api.get("apiPath", ""),
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
    生成 call_api.py 调用命令示例。
    只展示必填参数，可选参数由 LLM 按需查表传入。
    无必填参数时展示完整命令（不带参数）。
    """
    required = [p for p in params if p.get("required")]
    show     = required if required else []

    parts = [f"python skills/scripts/call_api.py {api_path}"]
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


def _render_api_block(api: dict, detail: dict) -> list[str]:
    """渲染单个接口的 Markdown 块"""
    lines = []
    api_path = api.get("api_path") or detail.get("path", "")
    method   = detail.get("method", "GET")
    desc     = detail.get("description", "")
    params   = detail.get("parameters", [])

    lines.append(f"#### {api['api_name']}")
    lines.append("")
    method_badge = "**`POST`**" if method == "POST" else "`GET`"
    lines.append(f"接口：`{api.get('tool_name') or api.get('tool_id', '')}`　{method_badge}")
    lines.append("")

    summary = detail.get("summary", "")
    if desc and desc != summary:
        clean_desc = desc.replace("\n", " ").strip()
        lines.append(clean_desc)
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


def generate_subgroup_md(top_group: str, sub_group: str, apis: list, path_map: dict) -> str:
    """为一个子分组生成 .md 内容"""
    title = top_group if sub_group == top_group else f"{top_group} / {sub_group}"
    lines = [
        f"# {title}",
        "",
        "---",
        "",
    ]
    for api in apis:
        detail = path_map.get(api.get("tool_id", ""), {})
        if not detail:
            detail = path_map.get(api.get("tool_name", ""), {})
        lines.extend(_render_api_block(api, detail))
    return "\n".join(lines)


def write_references(group_tree: dict, path_map: dict, output_dir: Path) -> list[dict]:
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
            content = generate_subgroup_md(top_group, sub_group, apis, path_map)

            if flat:
                out_file = output_dir / f"{top_group}.md"
                rel_path = f"references/{top_group}.md"
            else:
                sub_dir = output_dir / top_group
                sub_dir.mkdir(exist_ok=True)
                out_file = sub_dir / f"{sub_group}.md"
                rel_path = f"references/{top_group}/{sub_group}.md"

            out_file.write_text(content, encoding="utf-8")
            records.append({
                "top":      top_group,
                "sub":      sub_group if not flat else "",
                "count":    len(apis),
                "rel_path": rel_path,
                "flat":     flat,
            })
            print(f"  ✓ {rel_path} ({len(apis)} 个接口)")

    return records


def generate_skill_md_table(records: list[dict]) -> str:
    """生成 SKILL.md 两级索引表"""
    rows = ["| 分类 | 子分类 | 接口数 | 文档 |",
            "|------|--------|:------:|------|"]
    prev_top = None
    for r in records:
        top  = r["top"] if r["top"] != prev_top else ""
        sub  = r["sub"] or "—"
        link = f"[{r['rel_path'].split('/')[-1]}]({r['rel_path']})"
        rows.append(f"| {top} | {sub} | {r['count']} | {link} |")
        prev_top = r["top"]
    return "\n".join(rows)

# ─── 入口 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="生成 investoday API 参考文档")
    parser.add_argument("--output", "-o", type=Path, default=DEFAULT_OUTPUT_DIR,
                        help=f"输出目录（默认: {DEFAULT_OUTPUT_DIR}）")
    parser.add_argument("--validate", action="store_true",
                        help="验证 API Key 可用性（需要 .env 或环境变量 INVESTODAY_API_KEY）")
    parser.add_argument("--api-key", dest="api_key", default=None,
                        help="直接传入 API Key（优先级最高）")
    parser.add_argument("--remote", action="store_true",
                        help="强制从远程拉取最新数据（同时更新本地 openapi.json / tree.json）")
    args = parser.parse_args()

    # API Key 处理
    api_key = args.api_key or load_api_key()

    if args.validate:
        if not api_key:
            print("⚠️  未找到 API Key，跳过验证。请在 .env 中设置 INVESTODAY_API_KEY=xxx", file=sys.stderr)
        else:
            validate_api_key(api_key)

    # 获取数据（默认读本地缓存，--remote 强制拉远程）
    openapi    = fetch_openapi(force_remote=args.remote)
    tree_data  = fetch_tree(force_remote=args.remote)

    print("解析数据...")
    path_map   = parse_openapi_paths(openapi)
    flat_apis  = flatten_tree(tree_data)
    group_tree = build_group_tree(flat_apis)

    # 生成子分组级 .md 文件
    output_dir: Path = args.output

    print("生成分组文档...")
    records = write_references(group_tree, path_map, output_dir)

    total_files = len(records)
    total_apis  = len(flat_apis)
    print(f"\n✅ 完成：共 {total_apis} 个接口，{total_files} 个文档 → {output_dir}")

    # 打印 SKILL.md 表格（供参考）
    print("\n── SKILL.md 接口索引表格（可复制）──")
    print(generate_skill_md_table(records))


if __name__ == "__main__":
    main()
