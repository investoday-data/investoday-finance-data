---
name: investoday-finance-data
title: 今日投资金融数据
version: 1.7.1
description: "获取中国市场金融数据与投研信息，覆盖 A股、港股、基金、指数、财务、公告、研报和宏观经济等 200+ 接口。Use when: 查询行情数据、财务数据、公告研报、基金指数数据、宏观经济数据。"
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
requirements:
  node: 18+
  network_access: true
---
# 今日投资金融数据 Skill

获取中国金融市场金融数据，覆盖A股、港股、指数、市场、研报、新闻、实时、宏观经济等数据。

## 安装 & 使用
```bash
# 安装 CLI
npm uninstall -g @investoday/investoday-api
npm install -g @investoday/investoday-api@latest
```

## CLI命令参考
```bash
# 初始化运行环境配置（如未配置时使用）
investoday-api init

# 用于浏览多级分组和叶子菜单
investoday-api list <group/subgroup/leaf>

#用于按关键词搜索接口(其中query、tool_ids支持多个入参，以英文逗号隔开)
investoday-api search-api query=<query> tool_ids=<tool_ids>

#发起请求
investoday-api <endpoint> [key=value ...]
```

示例：
```bash
# 初始化配置
investoday-api init
investoday-api config status

# 列举
investoday-api list
investoday-api list 沪深京数据
investoday-api list 沪深京数据/公司行为/基本信息

# 关键词搜索
investoday-api search-api query=股票,基本面分析
# 工具信息搜索
investoday-api search-api tool_ids=list_stock_violation_penalt,list_stock_report_schema

# 调用数据
investoday-api search key=贵州茅台 type=11
investoday-api stock/basic-info stockCode=600519
investoday-api fund/daily-quotes --method POST fundCode=000001 beginDate=2024-01-01 endDate=2024-12-31
```

## 使用策略
- 未明确接口，使用search-api或list查找
- 明确接口,不明确使用方式,使用 search-api来获取接口使用方式。
- 明确接口及使用方式，直接调用。

## 辅助文档
- 文档版接口索引见：`docs/references-index.md`
