# InvestToday Financial Data Skill

Fetch Chinese financial-market data with coverage across A-shares, Hong Kong stocks, indices, market data, research reports, news, real-time quotes, macroeconomics, and related datasets.

## What This Skill Is For

Common tasks for this skill:

- Review recent price action for stocks, Hong Kong stocks, indices, funds, and ETFs
- Check company profile, financial trends, valuation, and operating performance
- Gather announcements, research reports, news, and analyst ratings
- Inspect sectors, themes, industry chains, and market heat
- Read macroeconomic and market datasets
- Export structured datasets for later analysis, comparison, or backtesting

Start from the user's research goal, then decide whether to browse categories, search APIs, or call a known endpoint directly.

## When To Use

Prefer this skill when the user's intent matches one of these:

- Price action / trend: recent moves, relative strength, turnover, market activity
- Financials / valuation: reports, profit trends, valuation, cash flow, dividends, metrics
- Announcements / research / news: recent filings, catalysts, analyst views, report summaries
- Funds / ETFs / indices: NAV, quotes, constituents, fund profile, performance
- Sectors / themes / industry chains: strongest sectors, theme heat, industry relationships
- Macro / market: CPI, PPI, PMI, rates, market statistics, macro indicators
- Data export / research prep: pull structured datasets for downstream analysis or comparison

## What This Skill Is Not For

This skill is not for:

- Giving direct trading advice or replacing an investment advisor
- Automated trading or order execution
- Inventing conclusions when data is unavailable, incomplete, or out of scope
- Building a backtesting engine, optimizer, or trading system itself

If data access, time range, or endpoint capability is limited, say so clearly.

## Natural-Language Trigger Guide

This skill should still trigger even if the user never mentions `investoday-api`, endpoint names, or field names, as long as the intent sounds like:

- Check how this stock has been doing recently
- Give me a quick read on XX
- Help me review the latest financials
- What announcements or catalysts are out recently
- Which sector is strongest lately
- Show me ETF or fund performance
- Compare these companies
- Pull a dataset for me
- Export this as CSV

When the user speaks in natural language, interpret the task first instead of jumping to endpoint names. Prefer to treat:

- "recently" as a reasonable time window
- "financials" as recent quarters or recent annual periods
- "strong or weak" as trend, relative performance, and activity
- "catalyst" as announcements, reports, news, or policy signals

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
