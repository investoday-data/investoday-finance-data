---
name: investoday
description: 今日投资数据市场 API 专业金融数据接口封装，覆盖A股/港股/基金/指数/宏观经济等 186 个数据接口。使用场景：查询股票行情、财务报表、公司公告、研报评级、基金净值、行业分析、宏观经济指标；需要实体识别（股票代码/名称相互转换）；调用 MCP Server 接入 AI 应用；构建量化分析、投研报告生成等场景。
---

# 今日投资数据市场 (InvestToday)

## 前置：配置 API Key

`call_api.py` 脚本从以下位置按优先级读取 API Key：

1. **环境变量**：`export INVESTODAY_API_KEY=your_key_here`
2. **`.env` 文件**：在项目根目录创建 `.env`，写入 `INVESTODAY_API_KEY=your_key_here`

> 没有 API Key？前往 [今日投资数据平台](https://data-api.investoday.net/login) 注册获取。

## 数据调用方式（直接执行，无需写代码）

```bash
# GET 接口（默认）
python skills/scripts/call_api.py <接口路径> [参数名=参数值 ...]

# POST 接口（加 --method POST，参数以 JSON body 发送）
python skills/scripts/call_api.py <接口路径> --method POST [参数名=参数值 ...]
```

> 接口是 GET 还是 POST，请查看 references/ 文档中的方法标记（`GET` / **`POST`**）。

**示例：**

```bash
# 综合搜索（GET）
python skills/scripts/call_api.py search key=贵州茅台 type=11

# 股票基本信息（GET）
python skills/scripts/call_api.py stock/basic-info stockCode=600519

# 历史前复权行情（GET）
python skills/scripts/call_api.py stock/adjusted-quotes stockCode=600519 beginDate=2024-01-01 endDate=2024-12-31

# 基金日行情（POST）
python skills/scripts/call_api.py fund/daily-quotes --method POST fundCode=000001 beginDate=2024-01-01 endDate=2024-12-31

# 实体识别（POST）
python skills/scripts/call_api.py entity-recognition --method POST
```

> 输出为标准 JSON，调用失败时打印错误信息并退出。

## 查找接口路径和参数

在下方 [接口索引](#接口索引) 中找到对应分类，打开 references/ 文档查看：
- **接口路径**（`call_api.py` 的第一个参数）
- **输入参数**（参数名、是否必填、示例值）

## 接口索引

| 分类 | 子分类 | 接口数 | 文档 |
|------|--------|:------:|------|
| 基础数据 | — | 5 | [基础数据.md](references/基础数据.md) |
| 市场数据 | — | 1 | [市场数据.md](references/市场数据.md) |
| 沪深京数据 | 基础信息 | 4 | [基础信息.md](references/沪深京数据/基础信息.md) |
|  | 股票行情 | 17 | [股票行情.md](references/沪深京数据/股票行情.md) |
|  | 财务数据 | 24 | [财务数据.md](references/沪深京数据/财务数据.md) |
|  | 特色数据 | 18 | [特色数据.md](references/沪深京数据/特色数据.md) |
|  | 公司行为 | 29 | [公司行为.md](references/沪深京数据/公司行为.md) |
| 板块 | 基础行情 | 3 | [基础行情.md](references/板块/基础行情.md) |
|  | 衍生行情 | 2 | [衍生行情.md](references/板块/衍生行情.md) |
|  | 基础数据 | 3 | [基础数据.md](references/板块/基础数据.md) |
|  | 财务数据 | 1 | [财务数据.md](references/板块/财务数据.md) |
|  | 特色数据 | 1 | [特色数据.md](references/板块/特色数据.md) |
|  | 分析与预测 | 1 | [分析与预测.md](references/板块/分析与预测.md) |
| 指数 | 基础行情 | 2 | [基础行情.md](references/指数/基础行情.md) |
|  | 技术指标 | 1 | [技术指标.md](references/指数/技术指标.md) |
|  | 行情衍生数据 | 1 | [行情衍生数据.md](references/指数/行情衍生数据.md) |
|  | 指数资料 | 1 | [指数资料.md](references/指数/指数资料.md) |
| 新闻与观点 | 基础数据 | 2 | [基础数据.md](references/新闻与观点/基础数据.md) |
| 研报 | 基础数据 | 1 | [基础数据.md](references/研报/基础数据.md) |
|  | 特色数据 | 1 | [特色数据.md](references/研报/特色数据.md) |
|  | 投资评级 | 2 | [投资评级.md](references/研报/投资评级.md) |
| 公告 | — | 2 | [公告.md](references/公告.md) |
| 港股 | 财务数据 | 3 | [财务数据.md](references/港股/财务数据.md) |
|  | 基础数据 | 3 | [基础数据.md](references/港股/基础数据.md) |
|  | 港股行情 | 7 | [港股行情.md](references/港股/港股行情.md) |
|  | 公司行为 | 2 | [公司行为.md](references/港股/公司行为.md) |
| 工具 | 图标 | 2 | [图标.md](references/工具/图标.md) |
| 宏观经济 | 国内宏观 | 2 | [国内宏观.md](references/宏观经济/国内宏观.md) |
| 大模型语料 | — | 2 | [大模型语料.md](references/大模型语料.md) |
| 基金 | 基金行情 | 4 | [基金行情.md](references/基金/基金行情.md) |
|  | 基金资料 | 12 | [基金资料.md](references/基金/基金资料.md) |
|  | 基金业绩表现 | 12 | [基金业绩表现.md](references/基金/基金业绩表现.md) |
|  | 基金投资组合 | 6 | [基金投资组合.md](references/基金/基金投资组合.md) |
|  | 基金持有人 | 2 | [基金持有人.md](references/基金/基金持有人.md) |
|  | 特色数据 | 3 | [特色数据.md](references/基金/特色数据.md) |
|  | ETF基金 | 2 | [ETF基金.md](references/基金/ETF基金.md) |
|  | 基金财务数据 | 2 | [基金财务数据.md](references/基金/基金财务数据.md) |

## MCP 接入（AI 应用推荐）

```json
{
  "mcpServers": {
    "investoday": {
      "url": "https://data-api.investoday.net/data/mcp/preset?apiKey=YOUR_API_KEY"
    }
  }
}
```
