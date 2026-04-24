# investoday-finance-data

`investoday-finance-data` 是今日投资金融数据 skill 仓库，包含两部分：

- `skills/`：提供给 agent 使用的 skill 入口、接口索引和 references
- `package/investoday-api/`：官方 npm CLI，命令名为 `investoday-api`

仓库当前覆盖中国市场金融数据与投研信息，包括 A 股、港股、基金、指数、财务、公告、研报和宏观经济等 200+ 接口。

## 快速开始

安装 CLI：

```bash
npm install -g @investoday/investoday-api
```

初始化 API Key：

```bash
investoday-api init
```

获取 API Key：

- <https://data-api.investoday.net/user/api-key>

常用命令：

```bash
investoday-api --help
investoday-api init
investoday-api config status
investoday-api list
investoday-api list 沪深京数据/公司行为/基本信息
investoday-api search-api query=股票,基本面分析
investoday-api search-api tool_ids=list_stock_violation_penalt,list_stock_report_schema
investoday-api stock/basic-info stockCode=600519
investoday-api fund/daily-quotes --method POST fundCode=000001 beginDate=2024-01-01 endDate=2024-12-31
```

命令定位：

- `init`：初始化本机加密配置
- `config status|path|remove`：检查、定位或清理本机配置
- `list`：浏览多级分组和叶子菜单
- `search-api`：按关键词或 `tool_id` 搜索接口，默认返回 JSON
- 直接调用：在确认接口后发起真实请求

## Skill 与文档

- Skill 入口：
  [skills/SKILL.md](/Users/kenneth/My/Codes/External/3-Python/LLMs/skills/业务/investoday-finance-data/skills/SKILL.md)
- 英文入口：
  [skills/SKILL_EN.md](/Users/kenneth/My/Codes/External/3-Python/LLMs/skills/业务/investoday-finance-data/skills/SKILL_EN.md)
- 运行环境说明：
  [skills/docs/api-key-setup.md](/Users/kenneth/My/Codes/External/3-Python/LLMs/skills/业务/investoday-finance-data/skills/docs/api-key-setup.md)
- 接口索引：
  [skills/docs/references-index.md](/Users/kenneth/My/Codes/External/3-Python/LLMs/skills/业务/investoday-finance-data/skills/docs/references-index.md)
- 详细接口文档：
  [skills/references](/Users/kenneth/My/Codes/External/3-Python/LLMs/skills/业务/investoday-finance-data/skills/references)
- npm 包目录：
  [package/investoday-api](/Users/kenneth/My/Codes/External/3-Python/LLMs/skills/业务/investoday-finance-data/package/investoday-api)

## Agent 约束

对于 agent：

- 先检查 `investoday-api` 是否可用
- 如未安装，先征求用户确认，再安装 `@investoday/investoday-api`
- 不要自动修改 shell 配置、PATH 或其他持久化系统设置
- 先看 `investoday-api config status`
- 仅使用 `investoday-api`
- 不要使用 `curl`、`wget`、`requests`、`fetch` 或其他手写 HTTP 请求

推荐调用顺序：

1. `search-api` 或 `list`
2. 直接使用 `search-api` 返回的关键信息或 `exampleCommand`
3. 真实接口调用
4. 如需深读，再看 references

## 仓库结构

```text
skills/                  skill 定义、中英文入口、references 与辅助文档
package/investoday-api/  官方 npm CLI
create/                  OpenAPI、菜单树、references 生成链与发布脚本
tests/                   references 生成链测试
```

## 生成与同步

本地元数据生成：

```bash
python3 create/generate_references.py
```

从远程拉取最新 OpenAPI 和菜单树后再生成：

```bash
python3 create/generate_references.py --remote
```

生成脚本会同时：

- 更新 `create/openapi.json`
- 更新 `create/tree.json`
- 同步到 `package/investoday-api/data/`
- 重建 `skills/references/`
- 重建 `skills/docs/references-index.md`

## 测试

references 生成链测试：

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
```

CLI 测试：

```bash
cd package/investoday-api
npm test
```

## 发布

一键发布 npm 包和 ClawHub：

```bash
./create/publish.sh
```

常用示例：

```bash
./create/publish.sh --remote
./create/publish.sh --remote --changelog "Update CLI capabilities and references"
```

发布脚本会按顺序执行：

- 生成并同步 references 与 package metadata
- 运行 Python 测试和 CLI 测试
- 如本地版本尚未发布，则发布 npm 包
- 如本地 skill 版本尚未发布，则发布 ClawHub

认证说明：

- ClawHub 读取环境变量 `CLAWHUB_TOKEN`
- npm 依赖当前机器的 `npm login` 或 `NPM_TOKEN`
