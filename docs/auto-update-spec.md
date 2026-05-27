# investoday-finance-data 自动更新机制 Spec

## 状态

- 状态：Draft
- 适用范围：`@investoday/investoday-api`、`investoday-finance-data` skill
- 核心策略：用户授权后，后台定时更新 `investoday-api` 及本机已安装的 skill

## 背景

当前 `investoday-finance-data` 由两部分组成：

- node 包：`@investoday/investoday-api`
- skill：`investoday-finance-data`

`openapi.json` 和 `tree.json` 是 `@investoday/investoday-api` 包内置数据的一部分。API 更新后，只要 CI 重新生成元数据并发布新版 node 包，用户本地通过更新 node 包即可获得最新 `list` / `search-api` 能力。

因此本 spec 不再把 `openapi.json` 和 `tree.json` 作为独立热更新对象，而是把自动更新对象收敛为：

- 更新 node 包：`@investoday/investoday-api`
- 更新 skill：`investoday-finance-data`

## 目标

- `investoday-api init` 阶段完成自动更新授权，默认开启。
- 定时更新全局 node 包 `@investoday/investoday-api`。
- 定时更新本机已安装的 `investoday-finance-data` skill。
- 更新在后台定时任务中执行，不中断用户当前正在使用的 CLI 或 agent 会话。
- 所有远程版本和下载地址由远程 `manifest.json` 描述。
- 全局 skill 更新策略固定为 `existing-only`。
- `list` 和 `search-api` 继续读取 node 包内置 `data/openapi.json` 和 `data/tree.json`。
- skill zip 下载必须校验 checksum。
- 更新失败必须可诊断、可关闭；skill 替换失败必须回滚。

## 非目标

- 不单独热更新 `openapi.json` 和 `tree.json`。
- 不维护独立 metadata 缓存目录。
- 不把 skill 安装到新客户端或新 agent。
- 不创建不存在的 AI 客户端 skill 目录。
- 不修改用户 shell 配置。
- 不删除用户自定义内容。
- 不终止、重启或干预用户正在运行的 agent / CLI 进程。
- 不执行远程 Skill Store 发布、下架或删除操作。

## 分层设计

### 1. 远程配置层

远程配置层负责描述可更新对象。CLI 不应把最新版本、skill zip 地址、客户端安装路径规则或 checksum 硬编码在代码里。

需求：

- 提供远程 `manifest.json`。
- 远程 manifest 外网地址固定为：`https://storage.txyun.investoday.net/application/skill-store/configs/investoday-api.manifest.json`。
- COS 上传目标为：`files-1255879464/application/skill-store/configs/investoday-api.manifest.json`。
- CLI 支持用环境变量 `INVESTODAY_API_UPDATE_MANIFEST_URL` 覆盖默认 manifest 地址；普通用户不需要配置。
- manifest 必须包含 `schemaVersion`、`generatedAt`、全局更新策略、node 包信息、skills 数组和客户端发现规则。
- 第一版 `skills` 数组可以只包含 `investoday-finance-data`；使用数组是为了后续支持多个 skill 共享同一套自动更新机制。
- 全局 skill 安装策略为 `existing-only`，不在 client 级别重复配置。
- manifest 不包含密钥、不包含用户本地私有数据。
- manifest 中的 `clients` 由仓库内 `configs/investoday-api.clients.json` 单独维护，workflow 生成 manifest 时读取并校验该文件。
- 本地拉取 manifest 后必须校验必要字段。
- manifest 远程不可用时，`update run` 立即停止，不执行 node 包或 skill 更新。
- manifest 缓存只用于诊断和 `update status` 展示，不作为实际更新来源。

远程 manifest 示例：

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-05-27T03:00:00Z",
  "updatePolicy": {
    "skillInstallPolicy": "existing-only",
    "local_task_cron": "0 3 * * *"
  },
  "nodePackage": {
    "name": "@investoday/investoday-api",
    "version": "1.8.15",
    "packageManager": "npm"
  },
  "skills": [
    {
      "name": "investoday-finance-data",
      "version": "1.8.15",
      "zipUrl": "https://storage.txyun.investoday.net/application/skill-store/packages/investoday-finance-data/investoday-finance-data.zip",
      "sha256": "REPLACE_WITH_SKILL_ZIP_SHA256"
    }
  ],
  "clients": [
    {
      "id": "codex",
      "name": "Codex",
      "targets": [
        {
          "type": "fixed",
          "paths": [
            "$HOME/.codex/skills"
          ]
        }
      ]
    },
    {
      "id": "openclaw",
      "name": "OpenClaw",
      "targets": [
        {
          "type": "fixed",
          "paths": [
            "$HOME/.openclaw/skills"
          ]
        },
        {
          "type": "discovery",
          "paths": [
            "$HOME/.openclaw/workspace*/skills"
          ]
        }
      ]
    },
    {
      "id": "workbuddy",
      "name": "WorkBuddy",
      "targets": [
        {
          "type": "fixed",
          "paths": [
            "$HOME/.workbuddy/skills"
          ]
        }
      ]
    }
  ]
}
```

`clients` 维护文件示例：

```json
[
  {
    "id": "codex",
    "name": "Codex",
    "targets": [
      {
        "type": "fixed",
        "paths": [
          "$HOME/.codex/skills"
        ]
      }
    ]
  },
  {
    "id": "openclaw",
    "name": "OpenClaw",
    "targets": [
      {
        "type": "fixed",
        "paths": [
          "$HOME/.openclaw/skills"
        ]
      },
      {
        "type": "discovery",
        "paths": [
          "$HOME/.openclaw/workspace*/skills"
        ]
      }
    ]
  },
  {
    "id": "workbuddy",
    "name": "WorkBuddy",
    "targets": [
      {
        "type": "fixed",
        "paths": [
          "$HOME/.workbuddy/skills"
        ]
      }
    ]
  }
]
```

`clients` 维护规则：

- `configs/investoday-api.clients.json` 是客户端路径规则的唯一维护入口。
- workflow 只负责读取、校验并写入 manifest，不在 workflow 脚本中硬编码客户端路径。
- 新增或调整客户端时，只修改 `configs/investoday-api.clients.json`。
- `clients` 配置变更必须触发 `Package Skills` workflow，重新生成并上传远程 manifest。
- `clients[].id` 必须唯一。
- `clients[].targets` 不能为空。
- `targets[].paths[]` 必须以 `$HOME/` 开头，避免把系统目录或绝对私有路径写入远程 manifest。

客户端发现规则：

- `clients[].targets[]` 表示某个客户端可能存在的一组 skills 根目录。
- `targets[].type=fixed`：`paths` 是固定 skills 根目录，直接检查目录是否存在。
- `targets[].type=discovery`：`paths` 是带通配符的 skills 根目录表达式，需要展开后检查。
- `paths` 指向 skills 根目录，不直接指向 skill 目录。
- 对 `skills[]` 中的每个 skill，实际更新目标为：`<skills-root>/<skill.name>`。
- 所有路径必须支持 `$HOME` 展开；实现时按当前操作系统解析用户主目录。
- macOS / Linux 的 `$HOME` 通常是 `/Users/<name>` 或 `/home/<name>`；Windows 可解析为用户 profile 目录。
- 所有命中的实际更新目标必须是已存在目录，且目录内存在 `SKILL.md`。
- 不存在的 skills 根目录或 skill 目录一律跳过。
- `type` 只允许 `fixed` 和 `discovery`；未知类型必须跳过并记录日志。

`local_task_cron` 字段说明：

- `updatePolicy.local_task_cron` 表示远程推荐的默认定时更新频率，用于控制用户本地定时任务。
- cron 表达式采用 5 段格式：`minute hour day-of-month month day-of-week`。
- cron 按用户本机时区解释。
- 第一版必须支持标准 5 段 cron；不要求支持秒级 cron、`@daily` 这类别名或复杂扩展语法。
- `local_task_cron` 是远程控制的本地定时任务频率。
- 每次成功获取远程 manifest 后，CLI 都必须用 manifest 中的 `updatePolicy.local_task_cron` 更新本地配置 `autoUpdate.local_task_cron`。
- 如果 manifest 缺少 `local_task_cron`，本地配置写入默认值 `0 3 * * *`。
- 本地已有 `autoUpdate.local_task_cron` 不作为长期自定义配置；下一次成功获取 manifest 后会被远程配置覆盖。

`nodePackage` 字段说明：

- `nodePackage.name` 是要更新的 npm 包名。
- `nodePackage.version` 是远程期望版本，用于和本地安装版本对比。
- `nodePackage.packageManager` 第一版只要求支持 `npm`。
- manifest 不保存 `installCommand`，避免命令和包名/版本字段重复导致不一致。
- 执行更新时，CLI 统一生成安装命令：`npm install -g <nodePackage.name>@latest`。
- 安装完成后必须重新读取本地包版本，并确认本地版本大于等于 manifest 中的 `nodePackage.version`。
- 如果 `@latest` 低于 manifest 版本，视为 npm 发布或 registry 同步异常，记录错误。

CI 侧约束：

- API 更新后，CI 必须重新生成 `package/investoday-api/data/openapi.json` 和 `package/investoday-api/data/tree.json`。
- CI 必须发布新版 `@investoday/investoday-api`。
- CI 必须发布新版 `investoday-finance-data` skill zip。
- CI 必须生成或更新远程 manifest，使 `nodePackage.version`、`skills[].version`、`skills[].zipUrl`、`skills[].sha256` 与实际发布产物一致。
- CI 只把 skill zip 和 manifest 上传到 COS，不把生成后的 zip 回写提交到仓库。
- workflow 只做编排；manifest 生成逻辑放在 `scripts/generate-update-manifest.py`，manifest 校验逻辑放在 `scripts/validate-update-manifest.py`。

### 2. 初始化

初始化层负责获取用户授权，并安装或更新定时任务。

需求：

- `investoday-api init` 增加自动更新授权提示。
- 默认启用自动更新。
- 回车采用默认值 `yes`。
- 支持非交互参数：
  - `--auto-update`
  - `--no-auto-update`
- 初始化可重复执行。
- 重复执行时允许修改自动更新开关。
- 启用时安装或更新定时任务。
- 关闭时卸载定时任务。
- 启用后立即执行一次 `investoday-api update run`。
- API Key 验证必须区分错误类型，不能只输出笼统的验证失败。

交互示例：

```text
InvestToday API Key: ********
Verifying InvestToday API key...
InvestToday API key 配置成功

是否启用自动更新？
启用后将后台定时更新 investoday-api 及 skill，以保障您能及时获取到我们最新的 API。
默认：是
[Y/n]:
```

命令示例：

```bash
investoday-api init --auto-update
investoday-api init --no-auto-update
```

API Key 验证错误分类：

- `invalid_api_key`：接口正常返回，但 API Key 无效、无权限、过期或被拒绝。
- `network_timeout`：连接或响应超时。
- `network_unreachable`：DNS、TLS、连接失败、代理不可用或网络不可达。
- `server_error`：远程服务返回 5xx 或服务端异常。
- `unexpected_response`：响应不是合法 JSON，或响应结构不符合预期。

`verifyApiKey` 返回结构示例：

```json
{
  "ok": false,
  "errorType": "network_timeout",
  "serverConnected": false,
  "message": "连接今日投资数据服务超时，请检查网络或代理后重试。"
}
```

`message` 生成规则：

- 如果已经连接到服务端，并且服务端返回了可解析的错误信息，则 `message` 必须优先使用服务端返回的错误信息。
- 如果没有连接到服务端，或连接过程在 DNS、TLS、TCP、代理、超时阶段失败，则 `message` 由 CLI 按错误类型生成。
- `message` 中不得包含完整 API Key、token、cookie 或其他敏感凭证。
- 服务端错误信息过长时允许截断，但必须保留核心错误原因。

用户提示要求：

- `invalid_api_key`：提示用户检查 API Key 是否正确、是否过期、是否有权限。
- `network_timeout` / `network_unreachable`：提示用户检查网络、代理、DNS 或稍后重试，不要暗示 API Key 错误。
- `server_error`：提示服务端暂时不可用，可稍后重试。
- `unexpected_response`：提示服务返回异常，并保留简短诊断信息。

本地配置示例：

```json
{
  "INVESTODAY_API_KEY": "xxxx",
  "autoUpdate": {
    "enabled": true,
    "local_task_cron": "0 3 * * *",
    "lastRunAt": "2026-05-27T03:05:00Z",
    "lastSuccessAt": "2026-05-27T03:05:20Z",
    "lastError": null
  }
}
```

本地配置说明：

- 本地配置文件路径固定为：`$HOME/.config/investoday/investoday-api.config.json`。
- 本地配置保存 `INVESTODAY_API_KEY`、用户授权、从远程配置初始化得到的定时任务频率和最近运行状态。
- 旧配置文件 `$HOME/.config/investoday/credentials.enc` 不再作为主配置文件。
- 新配置写入成功后删除历史 `$HOME/.config/investoday/credentials.enc` 和 `$HOME/.config/investoday/.encryption_key`。
- `investoday-api config remove` 同时删除新 JSON 配置和历史凭证文件。
- `autoUpdate.local_task_cron` 来自远程 manifest 的 `updatePolicy.local_task_cron`。
- 每次成功获取远程 manifest 后，都必须同步更新本地 `autoUpdate.local_task_cron`。
- 如果远程 manifest 缺少 `updatePolicy.local_task_cron`，本地默认写入 `0 3 * * *`，表示每天凌晨 3 点。
- 如果同步后的 `autoUpdate.local_task_cron` 与当前系统定时任务频率不同，CLI 必须更新本机定时任务，使下一次执行时间跟随远程配置。
- 本地配置不保存已安装 node 包版本。
- 本地配置不保存已安装 skill 版本。
- `update run` 和 `update status` 每次都必须实时读取本机真实版本。
- node 包本地版本从当前可执行环境中已安装的 `@investoday/investoday-api/package.json` 读取。
- skill 本地版本从命中路径的 `SKILL.md` frontmatter `version` 读取。

本地缓存目录建议：

```text
~/.cache/investoday/finance-data/
  manifest.json
  skill/
    investoday-finance-data.zip
  backups/
  logs/
    auto-update.log
    auto-update.err.log
  state.json
```

### 3. 定时更新层

定时更新层负责根据远程 manifest 更新 node 包和 skill。

设计原则：

- 更新逻辑必须集中在可直接执行的 CLI 命令里。
- 定时任务只负责按计划运行命令，不承载业务更新逻辑。
- `investoday-api init` 和 `investoday-api update enable` 只负责写本地配置、安装或更新定时任务，并可触发一次 `investoday-api update run`。
- 所有平台的定时任务最终执行同一个命令：`investoday-api update run`。

命令需求：

- `investoday-api update run`：立即执行一次更新。
- `investoday-api update status`：显示更新状态及信息。
- `investoday-api update enable`：开启自动更新并安装定时任务。
- `investoday-api update disable`：关闭自动更新并卸载定时任务。
- `investoday-api update register`：按当前本地配置重新注册或修复定时任务。

`update register` 行为：

- 不修改 `autoUpdate.enabled`。
- 不修改 `INVESTODAY_API_KEY`。
- 不执行 node 包或 skill 更新。
- 读取本地 `autoUpdate.local_task_cron`；如果缺失，则先拉取 manifest 并同步远程 `updatePolicy.local_task_cron`。
- 如果 manifest 也缺少 `local_task_cron`，使用默认值 `0 3 * * *`。
- 按当前操作系统注册用户级定时任务。
- 如果已有定时任务但执行命令、cron 或日志路径不一致，则覆盖为当前标准配置。
- 如果 `autoUpdate.enabled=false`，允许注册任务，但任务状态仍应显示为“已注册但未开启”；定时任务执行 `update run` 时必须因 disabled 跳过。
- 注册失败时写入 `autoUpdate.lastError`，并输出失败原因。

`update status` 必须包含：

- 定时任务状态：开启 / 关闭。
- 定时任务注册状态：未注册 / 已注册 / 注册异常 / 配置漂移。
- 最新一次更新时间：`autoUpdate.lastRunAt`。
- 最新一次更新成功时间：`autoUpdate.lastSuccessAt`。
- 最新一次更新错误信息：`autoUpdate.lastError`。
- 下一次更新时间：根据 `autoUpdate.local_task_cron` 和本机时区计算。
- 本地 / 远程版本：包括 `@investoday/investoday-api` 和每个已发现 skill 目标。

`update status` 示例：

```text
定时任务状态: 开启
定时任务注册状态: 已注册
最新一次更新时间: 2026-05-27T03:05:00Z
最新一次更新成功时间: 2026-05-27T03:05:20Z
最新一次更新错误信息: 无
下一次更新时间: 2026-05-28 03:00:00 Asia/Shanghai

版本:
- @investoday/investoday-api 本地: 1.8.14 远程: 1.8.15
- investoday-finance-data 本地: 1.8.14 远程: 1.8.15 路径: /Users/kenneth/.codex/skills/investoday-finance-data
```

定时任务：

- 第一版必须支持 macOS、Linux 和 Windows。
- 定时频率由本地配置中的 `autoUpdate.local_task_cron` 控制。
- 本地配置中的 `autoUpdate.local_task_cron` 每次成功获取 manifest 后由远程 `updatePolicy.local_task_cron` 同步写入。
- 如果 manifest 没有 `updatePolicy.local_task_cron`，同步写入默认值 `0 3 * * *`。
- 定时任务执行命令：`investoday-api update run`。
- macOS 使用 `launchd`。
- Linux 优先使用用户级 cron；如果环境没有 cron，再考虑 `systemd --user timer`。
- Windows 使用 Task Scheduler。
- 各平台安装定时任务前必须先校验 `local_task_cron` 是否可被当前平台适配。
- 默认值 `0 3 * * *` 必须在 macOS、Linux 和 Windows 三个平台都可安装。
- 如果用户配置的 cron 表达式超出当前平台适配能力，`update enable` 必须失败并说明原因，不得安装错误频率的任务。

macOS launchd plist 示例：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>net.investoday.finance-data.auto-update</string>

  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/investoday-api</string>
    <string>update</string>
    <string>run</string>
  </array>

  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>3</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>

  <key>StandardOutPath</key>
  <string>${HOME}/.cache/investoday/finance-data/logs/auto-update.log</string>

  <key>StandardErrorPath</key>
  <string>${HOME}/.cache/investoday/finance-data/logs/auto-update.err.log</string>
</dict>
</plist>
```

`update run` 流程：

1. 读取本地配置，确认 `autoUpdate.enabled=true`；手动执行时允许提示当前为关闭状态。
2. 获取更新锁，避免多个 `update run` 并发执行。
3. 记录 `autoUpdate.lastRunAt`。
4. 拉取远程 manifest；如果远程不可用，立即停止，不执行后续更新。
5. 校验 manifest schema 和必要字段。
6. 缓存 manifest。
7. 将 `manifest.updatePolicy.local_task_cron` 同步写入本地 `autoUpdate.local_task_cron`；如果远程缺失则写入 `0 3 * * *`。
8. 如果定时任务已开启，且同步后的 cron 与当前系统定时任务频率不同，则更新系统定时任务。
9. 读取当前本机 `@investoday/investoday-api` 版本。
10. 对比 `manifest.nodePackage.version`。
11. 如果本地 node 包版本与远程版本不一致且远程版本更高，执行统一安装命令：`npm install -g <nodePackage.name>@latest`。
12. 安装后重新读取本地 node 包版本，确认版本大于等于 `manifest.nodePackage.version`。
13. 根据 manifest 扫描客户端安装目标。
14. 过滤为已存在且包含 `SKILL.md` 的 skill 目录。
15. 对 manifest `skills[]` 中的每个 skill，按 `skill.name` 计算目标目录。
16. 对比每个目标目录的 `SKILL.md` frontmatter version。
17. 如果某个 skill 本地版本与远程版本不一致，下载该 skill zip 到临时文件。
18. 校验 skill zip sha256。
19. 解压 zip 到临时目录。
20. 对每个需要更新的目标目录备份旧目录。
21. 原子替换目标目录。
22. 替换失败时回滚该目标。
23. 写入本地配置中的最近运行状态、`state.json` 和日志。
24. 释放更新锁。

不中断原则：

- `npm install -g <nodePackage.name>@latest` 只影响后续新启动的 `investoday-api` 命令，不要求当前正在运行的 CLI 进程重启。
- node 包更新失败不得阻断 skill 更新，避免单点失败扩大为整体不可用。
- `update run` 当前进程不得依赖安装过程中可能被覆盖的新文件继续执行关键逻辑。
- skill zip 必须先下载并校验到临时目录，不能直接覆盖目标目录。
- skill 替换必须通过临时目录和原子 rename 完成，避免目标目录处于半更新状态。
- 替换失败必须回滚到旧目录。
- 不主动停止、重启或通知正在运行的 agent；已运行会话继续使用其已加载上下文，新会话读取更新后的 skill。
- 更新过程中必须持有锁，避免定时任务和用户手动执行同时修改 npm 包或 skill 目录。

`state.json` 示例：

```json
{
  "lastRunAt": "2026-05-27T03:05:00Z",
  "lastSuccessAt": "2026-05-27T03:05:20Z",
  "lastError": null,
  "remote": {
    "manifestGeneratedAt": "2026-05-27T03:00:00Z",
    "nodePackageVersion": "1.8.15",
    "skills": [
      {
        "name": "investoday-finance-data",
        "version": "1.8.15"
      }
    ]
  },
  "local": {
    "nodePackageVersion": "1.8.15",
    "skills": [
      {
        "name": "investoday-finance-data",
        "version": "1.8.15"
      }
    ]
  },
  "nodePackage": {
    "name": "@investoday/investoday-api",
    "fromVersion": "1.8.14",
    "toVersion": "1.8.15",
    "status": "updated"
  },
  "updatedTargets": [
    {
      "clientId": "codex",
      "skillName": "investoday-finance-data",
      "path": "/Users/kenneth/.codex/skills/investoday-finance-data",
      "fromVersion": "1.8.14",
      "toVersion": "1.8.15",
      "status": "updated"
    }
  ],
  "skippedTargets": [
    {
      "clientId": "openclaw",
      "skillName": "investoday-finance-data",
      "path": "/Users/kenneth/.openclaw/agents/example/skills/investoday-finance-data",
      "reason": "not_found"
    }
  ]
}
```

## CLI 数据读取顺序

`list` 和 `search-api` 只读取当前已安装 node 包内置数据：

```text
package/investoday-api/data/openapi.json
package/investoday-api/data/tree.json
```

不再引入独立 metadata 热更新缓存。API 元数据更新通过升级 `@investoday/investoday-api` 完成。

## 验收标准

- `investoday-api init` 可开启或关闭自动更新。
- `investoday-api init` 验证 API Key 失败时能区分 API Key 错误、网络超时、网络不可达、服务端异常和响应异常。
- `verifyApiKey` 连接服务端成功时优先返回服务端错误信息；未连接成功时返回 CLI 自定义错误信息。
- 开启后会安装定时任务，并立即执行一次更新。
- 关闭后会卸载定时任务。
- 定时任务只执行 `investoday-api update run`，不包含重复业务逻辑。
- `update register` 可在定时任务缺失、损坏或配置漂移时重新注册任务。
- `update status` 能展示定时任务是否已注册，以及注册配置是否与当前本地配置一致。
- macOS、Linux 和 Windows 均可安装默认定时更新任务。
- `update run` 可把 `@investoday/investoday-api` 更新到 manifest 指定版本。
- `update run` 只更新已存在的 `investoday-finance-data` skill 目录。
- `update run` 不影响当前正在运行的 CLI 或 agent 会话。
- 不存在的客户端目录不会被创建。
- 多 agent 场景下，只更新已经安装过该 skill 的 agent。
- skill zip checksum 不匹配时拒绝替换。
- 替换 skill 失败时回滚。
- `list` / `search-api` 通过新版 node 包读取最新 `openapi.json` 和 `tree.json`。
- `update status` 能展示授权状态、定时任务状态、最近成功时间、最近错误、本地版本和远程版本。
- `update status` 能展示下一次更新时间。

## 第一版实现范围

- 实现远程 manifest 读取与缓存。
- 实现 node 包版本检查与更新。
- 实现 `existing-only` skill 更新。
- 实现 `update run/status/enable/disable/register`。
- 实现 macOS `launchd`、Linux 用户级 cron、Windows Task Scheduler 定时任务。
- 保持 `list` / `search-api` 读取 node 包内置 metadata。
