---
name: investoday-finance-data
version: 1.5.0
description: 通过 InvestToday API 获取中国市场金融数据，覆盖 A股、港股、基金、指数、财务、公告、研报和宏观经济等 180+ 接口。适用于用户需要查询行情、财报、公告、研报评级、宏观指标、证券代码与名称映射，或直接获取结构化 JSON / 原始数据时。需要 INVESTODAY_API_KEY 环境变量，或在 skill 根目录 .env 中配置同名键。
homepage: https://github.com/investoday-data/investoday-api-skills.git
tags:
  # 资产类别
  - stock
  - fund
  - etf
  - index
  - bond
  # 市场
  - a-share
  - hk-stock
  - china-market
  # 数据类型
  - financial-data
  - market-data
  - quote
  - realtime-quote
  - financial-statement
  - balance-sheet
  - income-statement
  - cash-flow
  - valuation
  - dividend
  - ipo
  - announcement
  - research-report
  - analyst-rating
  - macro-economics
  # 场景
  - quantitative
  - investment-research
  - portfolio
  - backtesting
  - data-api
  - finance-api
  # 中文关键词（方便中文搜索）
  - 股票
  - 基金
  - 行情
  - 财务
  - A股
  - 港股
  - 指数
  - 宏观经济
  - 研报
  - 公告
  - 量化
  - 投研
metadata:
  clawdbot:
    emoji: "📈"
    category: "finance"
    files: ["scripts/*"]
credentials:
  - name: INVESTODAY_API_KEY
    description: 今日投资数据市场 API Key，用于认证和授权访问金融数据接口。
    how_to_get: "https://data-api.investoday.net/login"
requirements:
  node: 18+
  environment_variables:
    - name: INVESTODAY_API_KEY
      required: false
      sensitive: true
  network_access: true
---
# 今日投资数据市场 (InvestToday)

> 国际用户请查看英文版：[SKILL_EN.md](./SKILL_EN.md)
> For international users, see: [SKILL_EN.md](./SKILL_EN.md)

通过 InvestToday API 获取中国市场金融数据，适合在需要查询行情、财报、公告、研报评级、宏观指标、证券代码与名称映射，或直接获取结构化 JSON / 原始数据时使用。

## API Key

- [注册获取 API Key](https://data-api.investoday.net/login)
- 支持两种配置方式，优先读取环境变量：

- 环境变量（推荐，优先）：

```bash
export INVESTODAY_API_KEY=<your_key>
```

- `.env` 文件（位于 skill 根目录，不要提交到版本库）：

```dotenv
INVESTODAY_API_KEY=<your_key>
```

- 大模型执行时，直接调用脚本即可，不需要在每次执行前额外检查 `INVESTODAY_API_KEY` 是否已配置
- **不要**在控制台、日志、对话消息、命令行参数或错误信息中显示 API Key 明文
- 详细配置与安全规范见 [API Key 设置说明](./docs/api-key-setup.md)

## 调用接口

```bash
# GET（默认）
node scripts/call_api.js <接口路径> [key=value ...]

# POST（参数以 JSON body 发送）
node scripts/call_api.js <接口路径> --method POST [key=value ...]

# array 参数：同一 key 重复传入
node scripts/call_api.js <接口路径> --method POST codes=000001 codes=000002
```

接口的 GET / POST 方法见 `references/` 文档中的标记。输出为 JSON，失败时打印错误信息。

**示例**

```bash
node scripts/call_api.js search key=贵州茅台 type=11
node scripts/call_api.js stock/basic-info stockCode=600519
node scripts/call_api.js stock/adjusted-quotes stockCode=600519 beginDate=2024-01-01 endDate=2024-12-31
node scripts/call_api.js fund/daily-quotes --method POST fundCode=000001 beginDate=2024-01-01 endDate=2024-12-31
```

## 接口索引

- 若已明确接口路径，可直接调用脚本
- 若不确定分类或参数，先查看 [接口索引](./docs/references-index.md)
- 再打开对应 `references/` 文档确认接口路径、请求方法和输入参数

## 信任与数据说明

- 详细说明见 [安全与隐私说明](./docs/security-privacy.md)

## 相关链接

[官方网站](https://data-api.investoday.net/hub?url=%2Fapidocs%2Fai-native-financial-data) · [常见问题](https://data-api.investoday.net/hub?url=%2Fapidocs%2Ffaq) · [联系我们](https://data-api.investoday.net/hub?url=%2Fapidocs%2Fcontact-me)
