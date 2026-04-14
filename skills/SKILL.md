---
name: investoday-finance-data
version: 1.6.0
description: 通过全局命令 investoday-api 获取中国市场金融数据，覆盖 A股、港股、基金、指数、财务、公告、研报和宏观经济等 180+ 接口。先设置 INVESTODAY_API_KEY，再执行初始化命令。请求时只能使用 investoday-api，禁止 curl、fetch、requests 等直连 API。
homepage: https://github.com/investoday-data/investoday-api-skills.git
tags:
  - stock
  - fund
  - etf
  - index
  - bond
  - a-share
  - hk-stock
  - china-market
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
  - quantitative
  - investment-research
  - portfolio
  - backtesting
  - data-api
  - finance-api
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
      required: true
      sensitive: true
  network_access: true
---
# 今日投资金融数据 Skill

通过全局命令 `investoday-api` 获取中国金融市场数据。

## 快速开始

### 1. API Key 配置

询问用户：是否已配置 `INVESTODAY_API_KEY`？

如未配置，引导用户：

- 访问 <https://data-api.investoday.net/login>
- 获取 API Key
- 配置环境变量：

```bash
export INVESTODAY_API_KEY="<your_key>"
```

### 2. 初始化命令
> 安装全局 `investoday-api`命令

执行：

```bash
node scripts/install_cli.js
```

### 3. 请求数据

执行全局命令 `investoday-api`。

禁止：

- `curl`
- `wget`
- Python `requests`
- Node `fetch`
- 任何手写 HTTP 请求

命令格式：

```bash
investoday-api <接口路径> [key=value ...]
investoday-api <接口路径> --method POST [key=value ...]
```

示例：

```bash
investoday-api search key=贵州茅台 type=11
investoday-api stock/basic-info stockCode=600519
investoday-api fund/daily-quotes --method POST fundCode=000001 beginDate=2024-01-01 endDate=2024-12-31
```

## 常用说明

- 接口索引：`docs/references-index.md`
- 详细参数：`references/`
- 命令失败时直接报错，不要绕过命令
