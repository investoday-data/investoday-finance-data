# 沪深京数据 / 财务数据 / 财务ttm指标数据

---

## 财务指标（ttm偿债能力）

接口路径：`stock/fin-indicators-solvency-ttm`
请求方式：**`POST`**
tool_id：`list_fin_ind_solvency_ttm`

接口说明：支持通过单个股票代码、批量股票代码列表，结合报告发布时间范围（开始日期格式为yyyy-MM-dd、结束日期格式为yyyy-MM-dd）及分页参数，查询A股、B股的TTM偿债能力财务指标数据，包含股票代码、名称，报告发布日期、报告期截止日，以及经营现金流流动负债比、EBIT利息保障倍数、经营活动净现金流与总负债/有息债务/非流动负债的比值、营业利润与流动负债/总负债的比值、EBITDA与总负债/有息债务的比值等核心偿债指标，可用于股票财务状况分析、偿债能力评估等投研场景。

### 输入参数

**Query 参数**

_无参数_

**Body JSON 参数**

| 参数名 | 必填 | 类型 | 说明 | 示例 |
|--------|:----:|------|------|------|
| `stockCode` | — | string | 股票代码【与stockCodes组成多选一参数，必须且只能传递其中一个】 | `002594` |
| `stockCodes` | — | array | 股票代码列表【与stockCode组成多选一参数，必须且只能传递其中一个】 | `['000001', '600519']` |
| `beginDate` | — | string | 开始日期（格式yyyy-MM-dd）。 最小值:2020-01-01; | `2020-01-01` |
| `endDate` | — | string | 结束日期（格式yyyy-MM-dd） | `2025-01-01` |
| `pageNum` | — | integer | 页码。 最小值:1; | `1` |
| `pageSize` | — | integer | 页长。 最小值:1; 最大值:500; | `10` |

### 输出参数

| 字段名 | 说明 | 示例 |
|--------|------|------|
| `stockCode` | 股票代码 | `688569` |
| `stockName` | 股票名称 | `铁科轨道` |
| `publishDate` | 披露日期 | `2020-08-11 00:00:00` |
| `reportPeriodEnd` | 报告期截止日 | `2020-06-30 00:00:00` |
| `cfoToCurrentLiab` | 经营现金流流动负债比 | `0.2976` |
| `interestCoverageEbit` | EBIT利息保障倍数 | `54.6579` |
| `cfoToTotalLiabilities` | 经营活动现金流量净额／负债总额 | `1` |
| `cfoToInterestBearingDebt` | 经营活动现金流量净额/有息债务 | `3.03257631` |
| `cfoToNonCurrentLiab` | 经营活动现金流量净额/非流动负债 | `1.50485065` |
| `operatingProfitToCurrentLiab` | 营业利润/流动负债 | `1` |
| `operatingProfitToTotalLiabilities` | 营业利润/负债合计 | `0.15168014` |
| `ebitdaToTotalLiabilities` | 息税折旧摊销前利润/负债合计 | `0.19155736` |
| `ebitdaToInterestBearingDebt` | 息税折旧摊销前利润/有息债务 | `2.54500393` |

### 接口示例

```bash
# Body JSON 可选参数: stockCode, stockCodes, beginDate, endDate, pageNum, pageSize
investoday-api stock/fin-indicators-solvency-ttm --method POST --body-json '{"stockCode":"002594","stockCodes":["000001","600519"],"beginDate":"2020-01-01"}'
```

---
