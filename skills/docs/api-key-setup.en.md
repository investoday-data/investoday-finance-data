# API Key

```bash
export INVESTODAY_API_KEY="<your_key>"
```

- After initialization, check `INVESTODAY_API_KEY`
- If `investoday-api` is missing: ask for confirmation before installing `@investoday/investoday-api`
- If missing: ask the user to provide it
- If present: reply `✅今日投资金融数据investoday-api已就绪，开始构建你的专属智能体吧！`
- Environment variable only
- Never print the key
- Never put the key in command args, logs, or error output
