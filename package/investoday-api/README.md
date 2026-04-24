# @investoday/investoday-api

Official CLI for accessing InvestToday China market financial data.

## Install

```bash
npm install -g @investoday/investoday-api
```

## API key

Configure the API key once:

```bash
investoday-api init
```

Get an API key from:

- https://data-api.investoday.net/login

## Usage

```bash
investoday-api --help
investoday-api init
investoday-api config status
investoday-api list
investoday-api list 沪深京数据
investoday-api search-api query=违规处罚 tool_ids=list_stock_violation_penalt
investoday-api search-api query=股票,基本面分析
investoday-api search-api query=股票 --text
investoday-api <endpoint> [key=value ...]
investoday-api <endpoint> --method POST [key=value ...]
```

Examples:

```bash
investoday-api list 沪深京数据/股票行情
investoday-api search-api query=stockCodes
investoday-api search-api query=股票,基本面分析
investoday-api search-api tool_ids=list_stock_violation_penalt,list_stock_report_schema
investoday-api search-api query=股票 --text
investoday-api stock/basic-info stockCode=600519
investoday-api search key=贵州茅台 type=11
investoday-api fund/daily-quotes --method POST fundCode=000001 beginDate=2024-01-01 endDate=2024-12-31
```

## Notes

- Uses the local encrypted config created by `investoday-api init`
- Only calls `https://data-api.investoday.net/data`
- Bundles endpoint metadata for `list` and `search-api`
- `search-api` defaults to JSON output and includes params, response fields, and `exampleCommand`; use `--text` for a human-readable summary
- `search-api` only accepts structured inputs such as `query=` and `tool_ids=`; `query=` accepts one value and supports comma-separated keywords
- Prints the API response `data` field as formatted JSON
