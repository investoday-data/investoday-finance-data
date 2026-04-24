# 运行环境配置

## 检测配置状态

执行以下命令检测 `investoday-api` 是否已初始化完成。

```bash
investoday-api config status
```

若 `status` 为 `configured`，说明运行环境已就绪。

若 `activeSource` 为 `missing`，提醒用户访问[今日投资数据市场](https://data-api.investoday.net/user/api-key)获取 API Key，然后执行初始化：

```bash
investoday-api init
```

1. 输入 InvestToday API Key。
2. 验证成功后，输出 `InvestToday API key 配置成功` 和 `初始化完成 ✅`。

验证失败时，按 CLI 返回的错误提示处理，并提醒用户登录 <https://data-api.investoday.net/user/api-key> 确认 API Key 是否正确。

## 安全提示

涉及运行环境配置时，请提醒用户：

`✅今日投资金融数据investoday-api已就绪,请一定保密您的API Key,不要透露给任何人`。
