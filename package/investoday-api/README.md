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

Non-interactive one-shot initialization:

```bash
investoday-api init --api-key "<API_KEY>" --auto-update --skip-verify
```

Enable or disable background auto update during initialization:

```bash
investoday-api init --auto-update
investoday-api init --no-auto-update
```

Get an API key from:

- https://data-api.investoday.net/user/api-key

## Usage

```bash
investoday-api --help
investoday-api init
investoday-api config status
investoday-api config path
investoday-api config remove
investoday-api update status
investoday-api update run
investoday-api update enable
investoday-api update disable
investoday-api update register
investoday-api update unregister
investoday-api list
investoday-api list 沪深京数据
investoday-api search-api query=违规处罚 tool_ids=list_stock_violation_penalt
investoday-api search-api query=股票,基本面分析
investoday-api search-api query=股票 --text
investoday-api <endpoint> [key=value ...]
investoday-api <endpoint> --method POST [key=value ...]
investoday-api <endpoint> --method POST [queryKey=value ...] --body-json '{"bodyKey":[]}'
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
investoday-api industry-quote/realtime-v2 --method POST industryLevel=1 industryType=SW sortColumn=changeRatio order=desc pageSize=10 --body-json '{"industryCodes":[]}'
```

## Background updates

`investoday-api` can periodically update the CLI package and installed skills after user authorization.

```bash
# Show task registration status, last run, errors, next run, and local/remote versions
investoday-api update status

# Run one update immediately; skips when auto update is disabled
investoday-api update run

# Enable auto update and register the user-level scheduled task
investoday-api update enable

# Disable auto update and unregister the scheduled task
investoday-api update disable

# Register or repair the scheduled task without changing the enabled flag
investoday-api update register

# Unregister only the scheduled task without changing the enabled flag
investoday-api update unregister
```

The default manifest URL is:

```text
https://storage.txyun.investoday.net/application/skill-store/configs/investoday-api.manifest.json
```

For debugging, staging, or private deployments, override it with:

```bash
INVESTODAY_API_UPDATE_MANIFEST_URL=https://example.com/investoday-api.manifest.json investoday-api update status
```

## Config commands

```bash
# Show whether the API key is configured and where it is loaded from
investoday-api config status

# Print the local config file path
investoday-api config path

# Remove the local config and legacy credential files
investoday-api config remove
```

## Notes

- Uses the local JSON config created by `investoday-api init`
- Only calls `https://data-api.investoday.net/data`
- Bundles endpoint metadata for `list` and `search-api`
- `search-api` defaults to JSON output and includes params, response fields, and `exampleCommand`; use `--text` for a human-readable summary
- `search-api` only accepts structured inputs such as `query=` and `tool_ids=`; `query=` accepts one value and supports comma-separated keywords
- For POST endpoints with JSON body parameters, pass query parameters as `key=value` and pass body parameters with `--body-json`
- Background update settings are stored in the local JSON config and can be inspected with `investoday-api update status`
- Prints the API response `data` field as formatted JSON
