# InvestToday Financial Data

Fetch Chinese-market financial data via InvestToday API, covering A-shares, Hong Kong stocks, funds, indices, financials, announcements, research, and macro data. Use it when the user needs quotes, financial statements, announcements, rating data, code/name mapping, or structured JSON/raw data.

> 中文版说明请见：[SKILL.md](./SKILL.md)

## API Key

- [Get an API Key](https://data-api.investoday.net/login)
- Two configuration methods are supported. The environment variable takes precedence:
- Environment variable (recommended, higher priority):

```bash
export INVESTODAY_API_KEY=<your_key>
```

- `.env` file in the skill root (local use only; do not commit it):

```dotenv
INVESTODAY_API_KEY=<your_key>
```

- Call the script directly; there is no need to pre-check whether `INVESTODAY_API_KEY` is configured before each invocation
- **Do not** expose the API Key in terminal output, logs, chat messages, command-line arguments, or error output
- Detailed setup and safety rules: [API Key Setup](./docs/api-key-setup.en.md)

## Calling the API

```bash
# GET (default)
node scripts/call_api.js <endpoint> [key=value ...]

# POST (parameters are sent as JSON body)
node scripts/call_api.js <endpoint> --method POST [key=value ...]

# Array parameters: repeat the same key
node scripts/call_api.js <endpoint> --method POST codes=000001 codes=000002
```

Check the `references/` docs for the endpoint path, HTTP method, and parameters. Responses are returned as JSON. Failures are printed as error messages.

**Examples**

```bash
node scripts/call_api.js search key=600519 type=11
node scripts/call_api.js stock/basic-info stockCode=600519
node scripts/call_api.js stock/adjusted-quotes stockCode=600519 beginDate=2024-01-01 endDate=2024-12-31
node scripts/call_api.js fund/daily-quotes --method POST fundCode=000001 beginDate=2024-01-01 endDate=2024-12-31
```

## Reference Index

- If you already know the endpoint path, call the script directly
- If you are unsure about the category or parameters, check [Reference Index](./docs/references-index.en.md)
- Then open the matching file under `references/` to confirm the endpoint path, method, and parameters
- The reference docs are currently maintained in Chinese

## Trust & Data Handling

- See [Security &amp; Privacy](./docs/security-privacy.en.md)

## Related Links

[API Docs](https://data-api.investoday.net/hub?url=%2Fapidocs%2Fai-native-financial-data) · [FAQ](https://data-api.investoday.net/hub?url=%2Fapidocs%2Ffaq) · [Contact](https://data-api.investoday.net/hub?url=%2Fapidocs%2Fcontact-me)
