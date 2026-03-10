# 今日投资数据 · AI Skill

> 让大模型直接调用专业金融数据，无需编写任何 API 代码。
> 覆盖 **A股 / 港股 / 基金 / 指数 / 宏观经济** 共 **186 个接口**，20年数据积累。
>
> 支持 **Cursor、Claude Code、OpenClaw** 等所有兼容 Agent Skills 的平台。

---

## 快速开始

### 第一步：获取 API Key

前往 [今日投资数据平台](https://data-api.investoday.net/login) 注册并创建 API Key。

### 第二步：配置环境

```bash
# 安装依赖
pip install -r requirements.txt

# 配置 API Key
cp .env.example .env
# 编辑 .env，填入你的 API Key：INVESTODAY_API_KEY=your_key_here
```

### 第三步：安装 Skill

根据使用的平台，将 `skills/` 目录复制到对应位置：

```bash
# Cursor — 个人级（适用所有项目）
cp -r skills/ ~/.cursor/skills/investoday/

# Cursor — 项目级
cp -r skills/ .cursor/skills/investoday/

# Claude Code
cp -r skills/ ~/.claude/skills/investoday/

# 其他平台参考各自 Skills 目录规范
```

完成后重启对应客户端，AI 会自动加载该 Skill。

---

## 两种接入方式

### 方式一：MCP Server（推荐）

零代码接入，AI 直接调用工具，无需任何脚本。各平台配置如下：

**Cursor**
```json
{
  "mcpServers": {
    "investoday": {
      "url": "https://data-api.investoday.net/data/mcp/preset?apiKey=YOUR_API_KEY"
    }
  }
}
```

**Claude Code / Dify（Streamable HTTP）**
```json
{
  "investoday": {
    "transport": "streamable_http",
    "url": "https://data-api.investoday.net/data/mcp/preset?apiKey=YOUR_API_KEY"
  }
}
```

> 如需自定义工具集（200+ 工具可选），登录 [个人中心](https://data-api.investoday.net/user) 创建 MCP 应用，获取专属 MCP Key。

### 方式二：Skill 脚本调用

安装 Skill 后，AI 通过内置脚本调用数据：

```bash
# 格式
python skills/scripts/call_api.py <接口路径> [参数名=参数值 ...]

# 示例：查询贵州茅台基本信息
python skills/scripts/call_api.py stock/basic-info stockCode=600519

# 示例：查询历史前复权行情
python skills/scripts/call_api.py stock/adjusted-quotes stockCode=600519 beginDate=2024-01-01 endDate=2024-12-31

# 示例：综合搜索
python skills/scripts/call_api.py search key=贵州茅台 type=11
```

输出为 JSON 格式，调用失败时打印错误信息并退出。

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

完整接口索引见 [`skills/SKILL.md`](skills/SKILL.md)，详细参数见 [`skills/references/`](skills/references/)。

---

## 常见错误码

| 错误码 | 含义 | 解决方法 |
|--------|------|----------|
| `0` | 请求成功 | — |
| `40008` | apiKey 不能为空 | 检查 `.env` 或环境变量配置 |
| `41000` | 必填参数为空 | 对照 references/ 确认参数名和必填项 |
| `460001` | 无效的应用 | 检查 API Key 是否正确 |
| `460002` | 接口未开放 | 该接口暂不对外，联系平台确认 |

---

## 维护：更新接口文档

当平台新增或变更接口时，重新生成 `skills/references/`：

```bash
# 生成文档
python create/generate_references.py

# 生成文档并验证 API Key 可用性
python create/generate_references.py --validate
```

---

## 项目结构

```
investoday-api-skills/
├── skills/                     # Skill 主体（安装到 AI 客户端的目录）
│   ├── SKILL.md                # Skill 入口，AI 优先读取
│   ├── references/             # 按分组自动生成的接口文档
│   │   ├── 基础数据.md
│   │   ├── 沪深京数据/
│   │   │   ├── 股票行情.md
│   │   │   └── ...
│   │   └── ...
│   └── scripts/
│       └── call_api.py         # AI 可直接执行的通用调用脚本
├── create/
│   └── generate_references.py  # 维护者用：从 OpenAPI 自动生成文档
├── .env.example                # API Key 配置模板
├── requirements.txt
└── README.md
```

---

> **免责声明**：本 Skill 提供的金融数据仅供参考，不构成投资建议。请遵守相关法律法规和交易所规定，合法合规使用数据。
