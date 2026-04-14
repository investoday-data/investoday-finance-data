# InvestToday Financial Data Skill

This skill uses `investoday-api` to fetch Chinese financial-market data.

## Quick Start

### 1. API Key

Ask the user whether `INVESTODAY_API_KEY` is configured.

If not:

- open <https://data-api.investoday.net/login>
- get an API key
- set the environment variable:

```bash
export INVESTODAY_API_KEY="<your_key>"
```

### 2. Initialize

Run:

```bash
node scripts/install_cli.js
```

### 3. Request Data

Only use `investoday-api`.

Do not use:

- `curl`
- `wget`
- Python `requests`
- Node `fetch`
- handwritten HTTP requests

Command format:

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
