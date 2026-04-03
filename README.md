# 今日投资数据Skills

让 AI 大模型直接调用专业金融数据的 Agent Skill，覆盖 **A股 / 港股 / 基金 / 指数 / 宏观经济** 180+ 个接口，支持 Cursor、Claude Code 等兼容 Agent Skills 的平台。

数据由 [今日投资数据市场](https://data-api.investoday.net) 提供，20 年金融数据积累，腾讯投资、毕马威 KPMG 金融科技 50 强认证。

---

## 快速开始

### 1. 获取 API Key

前往 [今日投资数据平台](https://data-api.investoday.net/login) 注册并创建 API Key。

### 2. 准备运行环境

`skills/` 目录的运行时依赖为 **Node.js 18+**。

仓库顶层的 `requirements.txt` 仅用于维护脚本，不属于 `skills/` 的运行时依赖。

### 3. 配置 API Key

支持两种配置方式，优先读取环境变量：

```bash
export INVESTODAY_API_KEY=your_key_here
```

或者在 `skills/` 根目录创建 `.env` 文件（仅限本机使用，不要提交到版本库）：

```dotenv
INVESTODAY_API_KEY=your_key_here
```

### 4. 安装 Skill

发布到 ClawHub 或手动安装时，仅需上传 / 复制 `skills/` 目录。

将 `skills/` 目录复制到对应平台的 Skills 目录：

```bash
# Cursor — 个人级（适用所有项目）
cp -r skills/ ~/.cursor/skills/investoday/

# Cursor — 项目级
cp -r skills/ .cursor/skills/investoday/

# Claude Code
cp -r skills/ ~/.claude/skills/investoday/
```

重启客户端后，AI 自动加载该 Skill。

### 5. 仓库结构说明

- `skills/`：实际发布和运行的 Skill 内容
- `create/`：用于生成 / 更新参考文档的维护脚本，不属于 Skill 运行时
- `requirements.txt`：仅供维护脚本使用，不是 Skill 安装前置依赖

---

## 数据覆盖

| 分类 | 接口数 | 典型数据 |
|------|:------:|---------|
| 沪深京数据 | 92 | 行情、财务、公司行为、特色数据 |
| 基金 | 43 | 行情、资料、业绩、投资组合、ETF |
| 港股 | 15 | 行情、财务、基础数据、公司行为 |
| 板块 | 11 | 行情、财务、分析与预测 |
| 指数 | 5 | 行情、技术指标 |
| 研报 | 4 | 基础数据、投资评级 |
| 基础数据 | 5 | 交易日历、实体识别、综合搜索 |
| 其他 | 11 | 宏观经济、公告、新闻、工具、大模型语料 |
| **合计** | **186** | |

---

## 相关链接

- [官方网站](https://data-api.investoday.net/hub?url=%2Fapidocs%2Fai-native-financial-data)
- [常见问题](https://data-api.investoday.net/hub?url=%2Fapidocs%2Ffaq)
- [联系我们](https://data-api.investoday.net/hub?url=%2Fapidocs%2Fcontact-me)

---

> 本 Skill 提供的金融数据仅供参考，不构成投资建议。请遵守相关法律法规和交易所规定，合法合规使用数据。
