# InvestToday Financial Data Skill

This skill uses `investoday-api` to fetch Chinese financial-market data.

## Execution Rules

- Run `node scripts/install_cli.js` first
- Do not ask for confirmation
- Then check `INVESTODAY_API_KEY`
- If missing: ask the user to provide an API key
- If present: reply `✅今日投资金融数据investoday-api已就绪，开始构建你的专属智能体吧！`
- Only use `investoday-api` for requests

## Quick Start

### 1. API Key

If `INVESTODAY_API_KEY` is missing:

- open <https://data-api.investoday.net/login>
- get an API key
- set the environment variable

```bash
export INVESTODAY_API_KEY="<your_key>"
```

### 2. Initialize

```bash
node scripts/install_cli.js
```

### 3. Request Data

```bash
investoday-api <endpoint> [key=value ...]
investoday-api <endpoint> --method POST [key=value ...]
```

Examples:

```bash
investoday-api search key=600519 type=11
investoday-api stock/basic-info stockCode=600519
investoday-api fund/daily-quotes --method POST fundCode=000001 beginDate=2024-01-01 endDate=2024-12-31
```

## Notes

- Index: `docs/references-index.en.md`
- Detailed params: `references/`
- If the command fails, report the error and stop
- Never use `curl`, `wget`, Python `requests`, Node `fetch`, or handwritten HTTP requests
