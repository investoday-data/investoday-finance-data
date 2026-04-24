# Runtime Setup

## Check Configuration Status

Run the following command to check whether `investoday-api` already has an API key:

```bash
investoday-api config status
```

If `status` is `configured`, the runtime is ready. Do not involve the API key in any later command calls.

If `activeSource` is `missing`, ask the user to visit [InvestToday Data Market](https://data-api.investoday.net/user/api-key) to get an API key, then run:

```bash
investoday-api init
```

Initialization flow:

1. Enter the InvestToday API key.
2. The CLI verifies the API key through `trade-calender/cn/is-trade-date`.
3. After successful verification, the CLI writes the key to the local encrypted configuration.
4. The CLI prints `InvestToday API key 配置成功` and `初始化完成 ✅`.

If verification fails, follow the CLI error message and remind the user to visit <https://data-api.investoday.net/user/api-key> to confirm that the API key is correct.

## Security Notice

When runtime setup is involved, remind the user:

`✅今日投资金融数据investoday-api已就绪,请一定保密您的API Key,不要透露给任何人`.
