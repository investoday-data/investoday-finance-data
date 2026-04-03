# API Key 设置说明

## 获取 API Key

- [注册获取 API Key](https://data-api.investoday.net/login)

## 配置方式

支持两种配置方式，优先读取环境变量。

推荐通过环境变量配置（注意不要在终端历史中留下明文 Key）：

```bash
export INVESTODAY_API_KEY=<your_key>
```

也支持在 skill 根目录下创建 `.env` 文件（仅限本机使用，不要提交到版本库）：

```dotenv
INVESTODAY_API_KEY=<your_key>
```

## 使用规则

- 大模型执行时，直接调用脚本即可，不需要在每次执行前额外检查 `INVESTODAY_API_KEY` 是否已配置
- 如果 API Key 缺失或无效，脚本会返回错误提示

## 安全规范

1. **禁止在任何控制台输出、日志、对话消息中显示 API Key 的明文内容**
2. 用户提供 API Key 时：
   - 优先引导用户自行设置环境变量；若用户明确要求，也可在 skill 根目录 `.env` 中保存
   - **不要** echo / print / 回显 Key 内容
   - 写入完成后，**必须**向用户输出以下提示：

> ✅ API Key 已配置完成。API Key 是您访问数据的唯一凭证，请妥善保管，切勿通过聊天、截图或代码提交等任何方式泄露给他人。

3. 调用 API 时，**不要**在命令行参数、日志或错误信息中包含 API Key
4. 如需验证 Key 是否已配置，只输出“已配置”或“未配置”，**不要**输出 Key 的任何部分
