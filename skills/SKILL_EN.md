# InvestToday Financial Data Skill

Fetch Chinese financial-market data with coverage across A-shares, Hong Kong stocks, indices, market data, research reports, news, real-time quotes, macroeconomics, and related datasets.

## Installation & Usage

Requires Node.js 18+ and the Node package `@investoday/investoday-api`.

`investoday-api init` initializes the CLI's local runtime configuration and may create or update local config files used by the CLI.

## CLI Command Reference

```bash
# Initialize runtime
investoday-api init

# Browse multi-level groups and leaf categories
investoday-api list <group/subgroup/leaf>

# Search APIs by keyword or tool id.
# query and tool_ids can contain multiple values separated by English commas.
investoday-api search-api query=<query> tool_ids=<tool_ids>

# Fetch data
investoday-api <endpoint> [key=value ...]
```

Examples:

```bash
# Initialize runtime
investoday-api init

# List categories
investoday-api list
investoday-api list 沪深京数据
investoday-api list 沪深京数据/公司行为/基本信息

# Keyword search
investoday-api search-api query=股票,基本面分析

# Tool-id search
investoday-api search-api tool_ids=list_stock_violation_penalt,list_stock_report_schema

# Fetch data
investoday-api search key=贵州茅台 type=11
investoday-api stock/basic-info stockCode=600519
investoday-api fund/daily-quotes --method POST fundCode=000001 beginDate=2024-01-01 endDate=2024-12-31
```

## Usage Strategy

- If the endpoint is unclear, use `search-api` or `list` to find it.
- If the endpoint is clear but the usage is unclear, use `search-api` to get the usage details.
- If both the endpoint and usage are clear, call it directly.

## Supporting Docs

- API reference index: `docs/references-index.en.md`
