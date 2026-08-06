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
| `pageNum` | page number | `1` |
| `pageSize` | page size | `100` |
| `totalCount` | total count | `0` |
| `data` |  | — |

### 接口示例

```bash
# Body JSON 可选参数: stockCode, stockCodes, beginDate, endDate, pageNum, pageSize
investoday-api stock/fin-indicators-solvency-ttm --method POST --body-json '{"stockCode":"002594","stockCodes":["000001","600519"],"beginDate":"2020-01-01"}'
```

---

## 财务指标（ttm盈利能力）

接口路径：`stock/fin-indicators-profitab-ttm`
请求方式：**`POST`**
tool_id：`list_fin_ind_profit_ttm`

接口说明：获取沪深京股票单季度盈利能力财务指标，支持通过股票代码、代码列表及发布日期范围（yyyy-MM-dd）筛选，返回包含毛利率、净利率、ROE（摊薄/扣非）、ROA、ROIC及总资产报酬率等核心数据，适用于大模型进行企业单季度盈利表现分析与横向对比。

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
| `pageNum` | page number | `1` |
| `pageSize` | page size | `100` |
| `totalCount` | total count | `0` |
| `data` |  | — |

### 接口示例

```bash
# Body JSON 可选参数: stockCode, stockCodes, beginDate, endDate, pageNum, pageSize
investoday-api stock/fin-indicators-profitab-ttm --method POST --body-json '{"stockCode":"002594","stockCodes":["000001","600519"],"beginDate":"2020-01-01"}'
```

---

## 财务衍生指标(ttm)

接口路径：`stock/fin-der-inds-ttm`
请求方式：**`POST`**
tool_id：`list_stock_fin_derivative_inds_ttm`

接口说明：支持通过单只股票代码或多只股票代码列表，结合报告发布时间范围（格式yyyy-MM-dd），查询A股、B股的财务衍生TTM指标数据，包含股票代码、名称、发布日期、报告期截止日，以及盈利能力、偿债能力、运营能力、成长能力、现金流等多维度核心财务指标，可用于股票基本面分析、价值评估等投研场景

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
| `pageNum` | page number | `1` |
| `pageSize` | page size | `100` |
| `totalCount` | total count | `0` |
| `data` |  | — |

### 接口示例

```bash
# Body JSON 可选参数: stockCode, stockCodes, beginDate, endDate, pageNum, pageSize
investoday-api stock/fin-der-inds-ttm --method POST --body-json '{"stockCode":"002594","stockCodes":["000001","600519"],"beginDate":"2020-01-01"}'
```

---
