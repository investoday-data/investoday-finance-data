# investoday-finance-data

`investoday-finance-data` 提供两部分能力：

- `investoday-api`：今日投资金融数据 CLI
- `skills/`：提供给 agent 使用的 skill 入口、接口索引和 references

当前覆盖中国市场金融数据与投研信息，包括 A 股、港股、基金、指数、财务、公告、研报和宏观经济等 200+ 接口。

## 快速开始

复制skills目录
```text
- 复制skills目录到对应软件的skills文件夹中，并重命名为 `investoday-finance-data`
- 检查 `investoday-finance-data` 目录文件完整
```

安装 CLI：

```bash
npm install -g @investoday/investoday-api
```

初始化本地运行环境：

```bash
investoday-api init
```

查看帮助：

```bash
investoday-api --help
```

## 常用命令

浏览分组和叶子菜单：

```bash
investoday-api list
investoday-api list 沪深京数据
investoday-api list 沪深京数据/公司行为/基本信息
```

按关键词或 `tool_id` 搜索接口：

```bash
investoday-api search-api query=股票,基本面分析
investoday-api search-api query=违规处罚
investoday-api search-api tool_ids=list_stock_violation_penalt,list_stock_report_schema
investoday-api search-api query=股票 --text
```

直接调用接口：

```bash
investoday-api search key=贵州茅台 type=11
investoday-api stock/basic-info stockCode=600519
investoday-api fund/daily-quotes --method POST fundCode=000001 beginDate=2024-01-01 endDate=2024-12-31
```

## 推荐使用方式

当你还不知道具体接口时：

1. 先用 `investoday-api list` 浏览分组。
2. 再用 `investoday-api search-api` 按关键词或 `tool_id` 定位接口。
3. 确认参数后，直接调用目标接口。

当你已经知道接口路径时：

```bash
investoday-api <endpoint> [key=value ...]
investoday-api <endpoint> --method POST [key=value ...]
```

## Skill 用法

如果是在 agent 或 ClawHub/OpenClaw 中使用这个 skill，入口文件是：

- 中文：[skills/SKILL.md](/Users/kenneth/My/Codes/External/3-Python/LLMs/skills/业务/investoday-finance-data/skills/SKILL.md)
- 英文：[skills/SKILL_EN.md](/Users/kenneth/My/Codes/External/3-Python/LLMs/skills/业务/investoday-finance-data/skills/SKILL_EN.md)

推荐的 agent 调用顺序：

1. 先执行 `investoday-api init` 初始化本地运行环境。
2. 若接口不明确，优先使用 `list` 或 `search-api`。
3. 找到接口后，再执行真实调用。
4. 需要进一步查看字段和参数时，再读 references 文档。

约束建议：

- 仅使用 `investoday-api`
- 不要用 `curl`、`wget`、`requests`、`fetch` 或其他手写 HTTP 请求替代 CLI
- 不要在未说明的情况下自动改动 shell 配置、PATH 或其他持久化系统设置

## 文档入口

- CLI 说明：[package/investoday-api/README.md](/Users/kenneth/My/Codes/External/3-Python/LLMs/skills/业务/investoday-finance-data/package/investoday-api/README.md)
- 接口索引：[skills/docs/references-index.md](/Users/kenneth/My/Codes/External/3-Python/LLMs/skills/业务/investoday-finance-data/skills/docs/references-index.md)
- 英文索引：[skills/docs/references-index.en.md](/Users/kenneth/My/Codes/External/3-Python/LLMs/skills/业务/investoday-finance-data/skills/docs/references-index.en.md)
- 详细 references：[skills/references](/Users/kenneth/My/Codes/External/3-Python/LLMs/skills/业务/investoday-finance-data/skills/references)

## 仓库结构

```text
skills/   skill主文件夹
create/   工程化文件，AI无需读取
package/  底层包命令工程化文件，AI无需读取
tests/    测试文件夹，AI无需读取
```
