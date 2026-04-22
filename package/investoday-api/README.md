# @investoday/investoday-api

Official CLI for accessing InvestToday China market financial data.

## Install

```bash
npm install -g @investoday/investoday-api
```

## API key

Set your API key with the `INVESTODAY_API_KEY` environment variable:

```bash
export INVESTODAY_API_KEY="<your_key>"
```

Get an API key from:

- https://data-api.investoday.net/login

## Usage

```bash
investoday-api <endpoint> [key=value ...]
investoday-api <endpoint> --method POST [key=value ...]
```

Examples:

```bash
investoday-api stock/basic-info stockCode=600519
investoday-api search key=贵州茅台 type=11
investoday-api fund/daily-quotes --method POST fundCode=000001 beginDate=2024-01-01 endDate=2024-12-31
```

## Notes

- Only reads credentials from `INVESTODAY_API_KEY`
- Only calls `https://data-api.investoday.net/data`
- Prints the API response `data` field as formatted JSON
