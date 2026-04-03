# Security & Privacy

## Security

- Requests are sent only over HTTPS to `data-api.investoday.net`
- Credentials are resolved in this order: environment variable `INVESTODAY_API_KEY`, then the same key in the skill-root `.env` file if the environment variable is unset
- The API Key is used only for authentication and is not forwarded to third parties

## Privacy

- Data sent off the local machine: endpoint path, query parameters, and the resolved `INVESTODAY_API_KEY`
- Data that stays local: local files, other environment variables, and chat content

## External Endpoint

- Purpose: financial data queries
- Data sent: API Key (header), query parameters

> **Trust notice:** This skill sends requests to the InvestToday data platform (`data-api.investoday.net`). Only install and use it if you trust this service.
