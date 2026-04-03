# 安全与隐私说明

## 安全

- 仅通过 HTTPS 调用 `data-api.investoday.net`
- 凭证按以下顺序读取：环境变量 `INVESTODAY_API_KEY`，若未设置则读取 skill 根目录 `.env` 中的同名键
- API Key 仅用于身份验证，不会被记录或转发至第三方

## 隐私

- 离开本机的数据：接口路径、查询参数、解析后的 `INVESTODAY_API_KEY`
- 不离开本机的数据：本地文件、环境中的其他变量、对话内容

## 外部接口

- 用途：金融数据查询
- 发送的数据：API Key（Header）、查询参数

> **信任声明**：本 Skill 会将查询请求发送至今日投资数据平台（`data-api.investoday.net`）。请在信任该平台后再安装使用。
