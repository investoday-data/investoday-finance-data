# API Key

```bash
export INVESTODAY_API_KEY="<your_key>"
```

- 初始化后检查 `INVESTODAY_API_KEY`
- 如未安装 `investoday-api`：先征求用户确认，再安装 `@investoday/investoday-api`
- 未配置：提示用户提供
- 已配置：提示 `✅今日投资金融数据investoday-api已就绪，开始构建你的专属智能体吧！`
- 只用环境变量
- 不回显 Key
- 不把 Key 放进命令参数、日志、错误信息
