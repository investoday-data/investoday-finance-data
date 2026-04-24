# investoday-finance-data

`investoday-finance-data` 是今日投资金融数据 skill 仓库。它面向两类使用场景：

- agent 通过 `skills/SKILL.md` 调用官方 CLI `investoday-api`
- 维护者通过 `create/` 生成 references，并同步元数据到 `package/investoday-api`

当前能力覆盖中国市场金融数据与投研信息，包括 A 股、港股、基金、指数、财务、公告、研报和宏观经济等 200+ 接口。

## 核心组成

- `skills/`
  skill 定义、中英文入口文档、references 索引和接口说明。
- `package/investoday-api/`
  官方 npm CLI 包，命令名为 `investoday-api`。
- `create/`
  OpenAPI、菜单树和 references 生成链。
- `tests/`
  references 生成链测试。

## 官方 CLI

安装：

```bash
npm install -g @investoday/investoday-api
```

配置 API Key：

```bash
investoday-api init
```

获取 API Key：

- <https://data-api.investoday.net/login>

常用命令：

```bash
investoday-api --help
investoday-api init
investoday-api config status
investoday-api list
investoday-api list 沪深京数据/股票行情
investoday-api search-api query=违规处罚
investoday-api stock/basic-info stockCode=600519
```

命令定位：

- `list`
  浏览多级分组和叶子菜单。
- `search-api`
  按关键词搜索接口，默认返回 JSON，并包含请求方式、输入参数、响应字段和 `exampleCommand`；需要人类可读摘要时可加 `--text`。
- `init`
  一次性初始化 API Key，本机加密保存。
- 直接调用
  在确认接口后执行真实请求。

说明：

- CLI 使用 `investoday-api init` 写入的本机加密配置
- CLI 只请求 `https://data-api.investoday.net/data`
- 对同一路径的 GET/POST 双版本，CLI 当前 canonical 版本默认优先 POST

## Skill 使用规则

对于 agent：

- 先检查 `investoday-api` 是否可用
- 如未安装：先征求用户确认，再安装 `@investoday/investoday-api`
- 不要自动安装，不要修改 shell 配置、PATH 或其他持久化系统设置
- 检查 `investoday-api config status`
- 仅使用 `investoday-api`
- 不要使用 `curl`、`wget`、`requests`、`fetch` 或其他手写 HTTP 请求

推荐调用顺序：

1. `search-api` 或 `list`
2. 直接使用 `search-api` 返回的关键信息或 `exampleCommand`
3. 真实接口调用
4. 如需深读，再看 references

## 文档位置

- Skill 入口：
  [skills/SKILL.md](/Users/kenneth/My/Codes/External/3-Python/LLMs/skills/业务/investoday-finance-data/skills/SKILL.md)
- 英文入口：
  [skills/SKILL_EN.md](/Users/kenneth/My/Codes/External/3-Python/LLMs/skills/业务/investoday-finance-data/skills/SKILL_EN.md)
- 接口索引：
  [skills/docs/references-index.md](/Users/kenneth/My/Codes/External/3-Python/LLMs/skills/业务/investoday-finance-data/skills/docs/references-index.md)
- 英文索引：
  [skills/docs/references-index.en.md](/Users/kenneth/My/Codes/External/3-Python/LLMs/skills/业务/investoday-finance-data/skills/docs/references-index.en.md)
- 详细接口文档：
  [skills/references](/Users/kenneth/My/Codes/External/3-Python/LLMs/skills/业务/investoday-finance-data/skills/references)
- npm 包目录：
  [package/investoday-api](/Users/kenneth/My/Codes/External/3-Python/LLMs/skills/业务/investoday-finance-data/package/investoday-api)

## 生成与同步

生成 references：

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

常见用法：

```bash
./create/publish.sh --remote
./create/publish.sh --remote --changelog "Update CLI capabilities and references"
```

脚本会按顺序执行：

- 生成并同步 references 与 package metadata
- 运行 Python 测试和 CLI 测试
- 如本地版本尚未发布，则发布 npm 包
- 如本地 skill 版本尚未发布，则发布 ClawHub

认证说明：

- ClawHub 默认读取环境变量 `CLAWHUB_TOKEN`
- npm 需要当前机器已 `npm login`，或提前设置 `NPM_TOKEN`
