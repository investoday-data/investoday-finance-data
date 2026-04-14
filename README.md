# investoday-finance-data

`investoday-finance-data` 是一个通过全局命令 `investoday-api` 获取中国市场金融数据的 skill，覆盖 A 股、港股、基金、指数、财务、公告、研报和宏观经济等 180+ 接口。

## 特点

- 单一调用入口：`investoday-api`
- 单一认证方式：`INVESTODAY_API_KEY`
- 返回结构化 JSON 数据
- 支持 macOS、Linux、Windows
- 自带接口索引、参数文档和示例命令

## 快速开始

### 1. 配置 API Key

先配置环境变量：

```bash
export INVESTODAY_API_KEY="your_key"
```

获取 API Key：

- <https://data-api.investoday.net/login>

### 2. 初始化命令

执行：

```bash
node skills/scripts/install_cli.js
```

### 3. 请求数据

执行：

```bash
investoday-api stock/basic-info stockCode=600519
```

更多示例：

```bash
investoday-api search key=贵州茅台 type=11
investoday-api announcements stockCode=000001
investoday-api fund/daily-quotes --method POST fundCode=000001 beginDate=2024-01-01 endDate=2024-12-31
```

## 使用规则

- 只允许使用环境变量 `INVESTODAY_API_KEY`
- 只允许使用全局命令 `investoday-api`
- 不支持 `.env`
- 不允许 `curl`、`wget`、`requests`、`fetch` 或其他手写 HTTP 请求

## 文档位置

- Skill 入口：`skills/SKILL.md`
- 接口索引：`skills/docs/references-index.md`
- 详细接口文档：`skills/references/`

## 仓库结构

```text
skills/   运行时内容：SKILL.md、脚本、docs、references
create/   references 生成链：OpenAPI、菜单树、生成脚本
tests/    测试
```

## 维护

生成 references：

```bash
python3 create/generate_references.py
```

运行测试：

```bash
node --test tests/call_api.test.js tests/install_cli.test.js
python3 -m unittest discover -s tests -p 'test_*.py'
```
