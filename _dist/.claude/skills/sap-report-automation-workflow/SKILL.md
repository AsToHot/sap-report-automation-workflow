---
name: sap-report-automation-workflow
description: |
  End-to-end SAP 报表自动化（与 Eclipse ADT 能力对齐）：自动安装 Eclipse ADT 同源 MCP（ai-abap）、FS 规范化、透明表 DDIC（ADT REST 或 RFC DDIF_FIELDINFO_GET）、技术文档、按模板写 ABAP、激活循环；Open SQL 与内表字段必须由 metadata 驱动、禁止脱离元数据自由发挥。触发场景：用户要写 ABAP/SAP 报表、REPORT、ALV、从 FS 到部署、切换 SAP、配置或安装 MCP、healthcheck 失败。**MCP 未就绪时代理必须自动 git clone + npm build + 写 settings.json，不得把安装推给用户**。GitHub MCP：https://github.com/mario-andreschak/mcp-abap-abap-adt-api ；备选 https://github.com/fr0ster/mcp-abap-adt
---

# SAP 报表自动化工作流（FS → 元数据 → 设计文档 → 代码 → 激活）

## 与 Eclipse ADT 的关系（术语一致、能力对齐）

- **术语**：口语中的「ADT」即运行在 Eclipse 上的 **ABAP Development Tools（ABAP 开发工具）**，与「Eclipse ADT」指**同一套官方开发环境**，不存在另一套并行标准。
- **本 Skill 的对接方式**：在 Claude Code 里通过 **`ai-abap` MCP** 调用与 **Eclipse ADT 相同的 ADT REST 契约**（`/sap/bc/adt/`），与 abap-adt-api 系实现同源。目标与在 Eclipse ADT 中开发一致：**与 SAP AS ABAP 联通**、**读写开发对象源码**、**语法检查**、**激活**（由 MCP 工具链完成，对应 Eclipse 中的同类后端操作）。
- **与桌面 IDE 的差异**：不在本机打开 Eclipse 窗口；**后端协议、对象 URI、权限要求与 Eclipse ADT 对齐**。若某地址在 Eclipse ADT 中能连上同一系统，则 `SAP_URL` 应使用与之对应的 **HTTPS 基地址**（网络经 SAProuter / Web Dispatcher / 代理时，以 Basis 给出的**最终可达** URL 为准，见 [reference.md](reference.md)）。
- **协作建议**：同一对象可在 Eclipse ADT 与 Claude Code+MCP 间切换编辑；注意**锁与传输**与 Eclipse 行为一致，避免并行编辑同一对象冲突。

## 阶段间强引用（元数据驱动实现；禁止「凭语感写 Open SQL」）

工作流各阶段**不是彼此无关的文档**，而是**同一链条上的输入/输出**。后续阶段**必须显式引用前序产物**；**禁止**在阶段 4 凭模型记忆拼字段名、表名或 JOIN 条件。


| 消费方                          | 必须参照的输入                                                        | 规则                                                                                                     |
| ---------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `docs/tech-design.md`        | `spec/functional-spec-ai.md` + `metadata/tables/*.json`        | 关联与 WHERE 中涉及的每个**物理字段**，须能在对应表的元数据文件中核对（或标注 TBD 并说明缺什么）。                                              |
| ABAP（Open SQL、内表 `ty_out` 等） | `docs/tech-design.md` 中的 **「字段契约」** + `metadata/tables/*.json` | **SELECT / JOIN / WHERE / ORDER BY** 中出现的表名、字段名，必须来自上一步契约或元数据；**禁止**引入契约中未出现的字段（除非先回到阶段 2 补拉元数据并更新契约）。 |
| ALV 列 / 内表组件                 | 同上                                                             | 列与组件名与契约一致；计算列在契约中写清公式，代码只实现契约。                                                                        |


**字段契约（阶段 3 必写）**：在 `docs/tech-design.md` 中设固定小节，至少包含下表（可复制扩展）：

```markdown
## 字段契约（实现唯一依据）

| 逻辑项（FS/输出） | 表名 | 字段名 | 元数据文件 |
|------------------|------|--------|------------|
| … | BKPF | BUKRS | metadata/tables/BKPF.json |
```

阶段 4 写程序时：**以「字段契约」+ `metadata/tables/<T>.json` 为白名单** 生成 Open SQL；若发现 FS 需要某字段但元数据无：**不得**直接编写，须先补拉该表或更正 FS，再更新契约与 JSON。

**与模版的关系**：模版（`INCLUDE` 结构等）只解决**程序骨架与团队风格**；**业务字段、SQL、WHERE 一律以契约与元数据为准**，不得用模版里的示例字段冒充本需求。

## 代理自主执行协议（本 Skill 的核心；不可省略）

本 Skill 的目标不是「多几个 Markdown 文件」，而是 **无人盯梢的自动工作流 + 可验证的智能**：用户给出 FS、模版、包/程序名等信息后，代理应在**同一任务内**按阶段 **1→2→3→4→5 顺序自动跑完**，仅在 **缺关键输入、MCP 不可用、或达到重试上限** 时停顿询问——**不得**因图快而跳过阶段，**不得**默认用户会逐步提醒「你该做第几步了」。

**硬门禁（除非用户明确说「跳过阶段 X」）：**

0. **未**通过 `ai-abap` 的 `healthcheck` → **禁止**进入阶段 1 以后。且 MCP 未就绪时代理**必须自动执行阶段 0 的克隆/构建/写 settings.json**，不得把「请先安装 MCP」丢回用户。
1. **未**写出可用的 `spec/functional-spec-ai.md`（或等价结构化需求）→ **禁止**写 ABAP、**禁止**调用 `setObjectSource` / 激活。
2. **未**对 FS 中出现的每张透明表完成元数据落盘（`metadata/tables/<TABNAME>.json`，失败则写入 `_errors.md` 并处理）→ **禁止**进入阶段 4。
3. **未**写出 `docs/tech-design.md`（含 **字段契约** 小节、关联、WHERE、选择屏映射、穿透/异常）→ **禁止**进入阶段 4。
4. 阶段 4–5：必须实际调用 MCP（`syntaxCheckCode`、`lock`、`setObjectSource`、`activate*` 等），并在失败时按 Skill **自动修错循环**，直至成功或达到重试上限。

**「智能」的最低标准**：主动用 MCP（如 `healthcheck`、`getObjectSource` 拉表定义、或 `runQuery`→`DD03L`）验证假设；发现 FS 笔误（如 BKFP→BKPF）在 `functional-spec-ai.md` 中**显式纠正**并记入 tech-design；不把「补文档」当成可选项，把「**跑通 Eclipse ADT 等效的联通、写码与激活**」当成交付的必要条件。若任务为**整包对象**拉取：必须先 **TADIR 分类统计 + 按类型套 URI 模板 + 分批 / `rowNumber` / manifest 续跑**（详见 [mcp-contract.md](mcp-contract.md)「整包开发对象」），**禁止**对整包用 `searchObject` 当枚举或逐对象猜路径试错。

**对用户的可见输出**：每一阶段结束用**简短进度说明**（一两句）即可，不要要求用户逐步确认流程——仅在门禁无法自动突破时提问。

## 抢跑根因与执行守卫（新增，给所有 Claude Code 代理）

### 已识别根因（必须规避）

1. 代理把"用户目标（创建程序）"当成"可立即执行动作"，忽略阶段门禁产物是否齐全。
2. 代理在长流程中丢失状态，未用统一文件证明"上一阶段完成"。
3. 代理把"文档阶段"当作软建议，而不是硬依赖，导致直接调用 `createObject`。

### Preflight Gate（强制前置守卫）

在 **任何** SAP 写操作（`createObject` / `setObjectSource` / `activate*`）前，代理必须先检查以下文件是否存在且非空：

- `spec/functional-spec-ai.md`
- `docs/tech-design.md`
- `docs/template-mapping.md`
- `docs/fs-coverage.md`
- `docs/deployment-config.md`
- `docs/stage-gate.md`

并在 `docs/stage-gate.md` 中确认以下 5 项为已完成：

- `S1=functional-spec-ready`
- `S2=metadata-ready`
- `S3=tech-design-ready`
- `S3.5=fs-coverage-ready`
- `S3.6=deployment-config-ready`

若任一条件不满足：**必须停止**，先补齐产物；禁止进入阶段 4/5。

### 禁止调用清单（硬约束）

当 `stage-gate` 未满足时，代理 **不得调用**：

- `createObject`
- `lock`
- `setObjectSource`
- `activateByName`
- `activateObjects`

违反上述约束视为流程错误，代理必须在会话中显式承认并回退到缺失阶段补齐。

---

## 阶段 0：MCP 自动安装与连通（**代理默认无人值守执行；不得把安装推给用户**）

本 Skill 的最硬性门禁：**在执行任何依赖与 Eclipse ADT 同源的 ADT REST 的操作（FS 校正、拉表结构、写 ABAP、激活）之前，`ai-abap`（内部名 `user-ai-abap`）MCP 必须处于「可 `healthcheck` 通过」的状态**。若未就绪，代理**必须主动完成安装与注册**，而不是回复「请您先安装 MCP」把球踢回用户。唯一允许打断自动流程向用户索要的，是**本机不可自动获取的 SAP 连接凭据**。

### 0.0 代理行为约束（红线）

- **MUST**：探测到 MCP 未就绪时，**立刻进入自动安装流程**，无需用户说「请安装」。
- **MUST**：在同一次任务内串起 `克隆 → 构建 → 写 settings.json → 提示重启 → 再 healthcheck`。
- **MUST NOT**：用占位符（`C:/path/to/...`、`your-sap-host`）冒充「已配置」；未通过 `healthcheck` 不得声称已连上 SAP。
- **MUST NOT**：把 `git clone` / `npm install` / `npm run build` 作为「让用户去做的作业」列出，代理有 Shell 能力就**自己跑**。
- **仅允许**向用户索要：`SAP_URL`、`SAP_USER`、`SAP_PASSWORD`、`SAP_CLIENT`、`SAP_LANGUAGE`、（可选）构建目录偏好。

### 0.1 探测（先判断再动手）

按顺序尝试，任一成功即视为「已就绪」：

1. 调用 MCP `ai-abap` / `user-ai-abap` 的 `healthcheck`（空参 `{}`）。
2. 若工具列表里**没有**该服务器条目 → MCP 未注册。
3. 若有条目但调用**超时/报错** → MCP 已注册但未构建成功或配置错误。

把判断结果明确分三类：`未注册` / `已注册未连通` / `已就绪`。据此进入 0.2、0.3 或直接跳到阶段 1。

### 0.2 自动安装（`未注册` 或 `已注册未连通`）

**默认安装路径**（代理如无用户偏好，直接用这些，**不要反复问「装在哪」**）：

- Windows：`%USERPROFILE%\mcp-servers\mcp-abap-abap-adt-api`
- macOS / Linux：`$HOME/mcp-servers/mcp-abap-abap-adt-api`

**执行命令**（代理使用其 Shell 工具实际运行，不要只把命令贴给用户）：

- Windows（PowerShell）：

```powershell
$dst = "$env:USERPROFILE\mcp-servers\mcp-abap-abap-adt-api"
New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
if (-not (Test-Path $dst)) {
  git clone https://github.com/mario-andreschak/mcp-abap-abap-adt-api.git $dst
} else {
  git -C $dst pull --ff-only
}
Push-Location $dst
npm install
npm run build
Pop-Location
Write-Host "ENTRY=$dst\dist\index.js"
```

- macOS / Linux：

```bash
DST="$HOME/mcp-servers/mcp-abap-abap-adt-api"
mkdir -p "$(dirname "$DST")"
if [ ! -d "$DST" ]; then
  git clone https://github.com/mario-andreschak/mcp-abap-abap-adt-api.git "$DST"
else
  git -C "$DST" pull --ff-only
fi
cd "$DST"
npm install
npm run build
echo "ENTRY=$DST/dist/index.js"
```

**失败处理**（逐条排查，不要把失败直接扔给用户）：

- `git` / `node` / `npm` 不存在 → 提示用户安装对应工具（**唯一**可请求用户介入的系统级前提）。
- 网络失败 → 重试一次；仍失败再建议备选仓库 `https://github.com/fr0ster/mcp-abap-adt`（同样自动克隆构建）。
- `npm run build` 失败 → 读构建日志定位；常见为 Node 版本过低，建议 Node ≥ 18。
- 构建目标不是 `dist/index.js` → **读取**仓库 `package.json` 的 `main` / `bin` 字段确定真实入口，勿猜。

### 0.3 写入 / 合并 `settings.json`（不要用占位符）

目标文件按优先级：

- 项目级 `{workspaceFolder}/.claude/settings.json`
- 用户级 `%USERPROFILE%\.claude\settings.json`（Windows）/ `~/.claude/settings.json`（macOS/Linux）

**规则**：

- 若文件**不存在** → 直接生成，`mcpServers.ai-abap` 的 `args[0]` 填 0.2 得到的真实 `ENTRY` 绝对路径（Windows 用正斜杠或双反斜杠）。
- 若文件**已存在** → **合并**而非覆盖：读原 JSON → 仅追加/更新 `mcpServers.ai-abap` 条目 → 回写；保留其他服务器。
- **密码等敏感字段先留空字符串**，再在 0.4 步由用户提供后再次合并，**切勿**把 `SAP_PASSWORD:"password"` 之类占位符写入文件。
- **强烈建议**将含密码的 `settings.json` 写到**用户级**位置，项目仓库只保留 `settings.json.example`。若必须写到项目级，代理须主动把 `.claude/settings.json` 追加到 `.gitignore`。

生成骨架（用户未给 env 前的状态）：

```json
{
  "mcpServers": {
    "ai-abap": {
      "command": "node",
      "args": ["<ENTRY 绝对路径>"],
      "env": {
        "SAP_URL": "",
        "SAP_USER": "",
        "SAP_PASSWORD": "",
        "SAP_CLIENT": "",
        "SAP_LANGUAGE": "ZH",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      },
      "disabled": false
    }
  }
}
```

### 0.4 收集 SAP 连接信息（**唯一**允许打断流程的环节）

代理必须一次性向用户索要全部连接信息（缺啥问啥，不要每次只问一个字段）。**支持两种输入方式**：

- **方式 A（推荐）**：用户直接在对话中给出信息 → 代理自动调用 `node scripts/write-config.js` 写入 `.env` 并合并 `settings.json`。
- **方式 B**：用户手动编辑 `.env` → 代理读取验证，缺失项再追问。

**必须收集的字段**：

| 字段 | 说明 | 示例 |
|------|------|------|
| `SAP_URL` | SAP 应用服务器 IP/域名 + 端口 | `http://10.32.21.11:8000` |
| `SAP_CLIENT` | 登录客户端 | `200` |
| `SAP_USERNAME` | 开发账号 | `ITL12` |
| `SAP_PASSWORD` | 开发密码 | `********` |
| `SAP_LANGUAGE` | 登录语言，默认 `ZH` | `ZH` |
| `SAP_SID` | 系统标识（用于传输请求命名、诊断） | `EE0` |
| `SAP_SYSNR` | 实例编号（从端口 80XX 推导或用户给出） | `00` |
| `SAP_ROUTER` | SAP Router 字符串（RFC 内网场景必填） | `/H/210.75.21.252` |
| `SAP_CONNECTION_TYPE` | `rfc`（推荐，支持 Router）或 `http` | `rfc` |

**自动推导规则**：
- 若 URL 为 `http://host:80XX`，默认 `SAP_SYSNR = XX`；用户显式给出时以用户为准。
- 若 `SAP_CONNECTION_TYPE = rfc` 且存在 `NW-RFC-SDK/nwrfcsdk/lib/sapnwrfc.dll`，代理**必须**配置 `mcp-launcher.js` 启动器（设置 `SAPNWRFC_HOME` + PATH），而非裸调 `dist/index.js`。

**写入动作（代理执行，不交给用户）**：

1. 生成 `.env`（含 `SAP_SID`、`SAP_SYSNR`、`SAP_ROUTER`）。
2. 若项目级 `.claude/settings.json` 存在 → 合并 `mcpServers` 条目；若不存在 → 询问用户是否写入用户级 `%USERPROFILE%/.claude/settings.json`。
3. 写入后调用 `node scripts/setup.js` 做一次性校验，输出诊断。

### 0.5 提示重启 → 再次 healthcheck（**自动重试**）

- 明确告诉用户：**退出并重新启动 Claude Code**（或新开一个会话），以使 MCP 配置生效。
- 重启完成后代理**主动**再调 `healthcheck`；失败最多 3 次自动重试，仍失败则输出**结构化诊断**（entry 路径是否存在、settings.json 路径、env 是否为空、`node <entry>` 直接启动的 stderr），再请用户判断。

### 0.9 权限前置探测（新增，阶段 0 末尾强制）

`healthcheck` 通过**不等于**业务操作权限足够。在进入阶段 1 前，代理必须执行一次轻量权限探针，避免到阶段 4 才发现无法创建对象：

1. **开发权限探针**：`runQuery` 查 `AGR_USERS` 或执行 `AUTHORITY-CHECK OBJECT 'S_DEVELOP'` 等效逻辑（如查询 `TADIR` 测试读取）：
   ```sql
   SELECT COUNT(*) AS CNT FROM TADIR WHERE PGMID = 'R3TR' AND OBJECT = 'PROG' AND ROWS BETWEEN 1 AND 10
   ```
   - 若返回权限不足 → 立即停止，输出结构化诊断（缺少的权限对象、建议联系 Basis）。
2. **包权限探针**（若用户已提供目标包）：`runQuery` 查 `TRDIR` 或尝试 `searchObject` 一个已知存在的程序，验证读写权限。
3. **传输请求探针**：验证用户是否有可用的传输请求（若后续需要创建对象）。

**失败处理**：
- 权限不足 → 输出缺失的权限对象列表 + 建议的角色/事务码（如 `PFCG` 分配 `SAP_BC_DWB_ABAPDEVELOPER`），停止工作流。
- 探针结果记录到 `docs/stage-gate.md` 的 `S0=permission-check` 行。

### 0.8 会话保活与自动重登录（新增，强制）

`healthcheck = healthy` 不代表业务查询会话永久有效。针对 `runQuery`、`tableContents`、`searchObject` 等业务工具，必须执行以下策略：

1. **阶段 2/3/4 开始前先预热会话**：调用一次 `login`（空参 `{}`）或轻量查询（如 `SELECT MANDT FROM T000`）。
2. 若返回包含 `Session timed out`（或 400/会话过期语义），**禁止**直接判定为 SAP 业务错误，必须按顺序：
   - `login` 重新建会话；
   - 重放原请求 1 次（报文不变）；
   - 仅在重放仍失败时再进入 SQL/权限诊断。
3. `Internal server error` 发生时，先做一次"会话有效性探针"（`searchObject BKPF` 或 `SELECT MANDT FROM T000`）：
   - 探针失败且提示会话问题 -> 先重登录再重放；
   - 探针成功 -> 再按对象/权限/SQL 路径排查。
4. 所有会话重连动作必须记录到 `metadata/tables/_errors.md` 或诊断日志，明确标注"会话问题（非 SAP 业务逻辑错误）"。

### 0.6 切换 SAP 系统

用户说「换系统 / 切到 PRD / 改客户端 300」时：

- 仅更新 `mcpServers.ai-abap.env` 中的对应字段；**不要**新增新的服务器键（除非用户要求并行多套）。
- 回写后重复 0.5（重启 + healthcheck）。

### 0.7 最小可见输出

0.1–0.5 全过程给用户的**进度反馈限制在极简**：

```
[MCP] 未就绪 → 自动克隆 mcp-abap-abap-adt-api 到 %USERPROFILE%\mcp-servers
[MCP] npm install / build 完成，入口：.../dist/index.js
[MCP] 已写入 .claude/settings.json（密码字段待填）
[MCP] 请提供 SAP_URL / USER / PASSWORD / CLIENT / LANGUAGE
[MCP] 请重启 Claude Code，完成后我会自动 healthcheck
```

**禁止**把上面的命令再原样抛给用户让他自己跑——代理能跑就跑，跑不了再说。

## 目标与原则

- **连接方式**：优先使用已配置的 **ADT REST**（通过 MCP `user-ai-abap` 暴露）；与 **Eclipse ADT** 使用同一套 `/sap/bc/adt/` 契约，适合无头自动化与 CI。
- **表字段元数据**：**首选** MCP `getObjectSource`，`objectSourceUrl` = `/sap/bc/adt/ddic/tables/<小写表名>/source/main`（一次拉全表定义；勿把 `ddicElement` 当字段字典空转）。**备选** `runQuery`→`DD03L`。**RFC** `DDIF_FIELDINFO_GET` 仅兜底（见 [reference.md](reference.md)）。
- **成熟方案参考**：团队级 CI/CD 可叠加 **abapGit**、流水线（Jenkins / GitHub Actions）与 **abapify/adt-cli**；本 Skill 聚焦「对话式代理 + **Eclipse ADT 同源 ADT REST**」闭环，可与上述方案并存。

## 前置条件

- **代理侧已按「阶段 0」自动部署并注册 MCP**（`ai-abap` 的 `healthcheck` 通过）；若否，回到阶段 0 由**代理自己**完成克隆/构建/写 `settings.json`，不把安装甩给用户。
- **用户侧**只需提供：SAP 开发账号（URL/USER/PASSWORD/CLIENT/LANGUAGE）、包/传输请求权限、对象创建与激活权限；系统级工具（Node ≥ 18、git、npm）缺失时由用户安装。
- **调用任一 MCP 工具前**，必须先阅读该工具的 **JSON schema**（`mcps/user-ai-abap/tools/<工具>.json`）或等价 descriptor，**参数名以 `required` 为准、禁止臆测**（易错示例见 [mcp-contract.md](mcp-contract.md)）。
- 使用 RFC 时：系统需释放 `DDIF_FIELDINFO_GET`，客户端安装 **SAP NW RFC SDK** 与 **pyrfc**（仅作备选）。

## 产物目录（建议在仓库中固定）

```
spec/
  functional-spec-raw.md          # 用户粘贴的 FS
  functional-spec-ai.md           # 规范化后的功能说明（见下节结构）
metadata/
  tables/<TABNAME>.json           # 每表一份字段与键信息
docs/
  tech-design.md                  # 表关系、取数逻辑、选择屏、ALV 要点
abap/
  sources/                        # 生成的源码片段或完整程序（按项目约定）
```

## 阶段 1：FS → 便于 AI 识别的功能文件

将 `functional-spec-raw.md` 整理为 `functional-spec-ai.md`，可直接套用 [templates/functional-spec-ai.md](templates/functional-spec-ai.md)；**必须**包含下列区块（缺失则向用户追问）：

1. **业务目标与报表类型**（清单 / 汇总 / 下载等）
2. **选择条件**：字段、是否区间、是否必输、默认值、与表字段对应关系
3. **输出列**：字段、来源表/字段、计算或转换规则
4. **透明表与用途**：列出所有 `T`* 或明确透明表名；标注主从关系（若 FS 已写）
5. **权限、性能、变式**等约束

用稳定标题与列表，避免冗长叙述；表名一律 **大写**。

## 阶段 2：透明表列表与 DDIC 元数据

1. 从 `functional-spec-ai.md` 提取透明表集合（正则 `[A-Z][A-Z0-9_]{3,}` 辅助 + 人工确认）。
2. **默认执行策略采用方案A（强制）**：`DD03L 单表串行 + COUNT 校验`，禁止多表 `IN (...)` 合并查询作为主路径。
   - 2.1 `COUNT`：`SELECT COUNT(*) AS CNT FROM DD03L WHERE TABNAME = '<TAB>' [AND AS4LOCAL='A']`
   - 2.2 明细：`SELECT FIELDNAME, POSITION, KEYFLAG, ROLLNAME, DATATYPE, LENG, DECIMALS FROM DD03L WHERE TABNAME = '<TAB>' [AND AS4LOCAL='A'] ORDER BY POSITION`
   - 2.3 `rowNumber` 建议 `>= 2000`（按系统表宽度可提高）；若 `fetched_count < expected_count`，必须自动重试（最多 3 次）并记录分页/重试轨迹。
   - 2.4 每张表独立落盘，JSON 中必须包含 `expected_count`、`fetched_count`、`matched`。
2. 对每张表拉取字段与键信息（**禁止**在 `ddicElement` 上反复试错当主路径）：
  - **首选**：`getObjectSource`，`objectSourceUrl` = `/sap/bc/adt/ddic/tables/<表名小写>/source/main`，将返回的 `source` 原文写入 `metadata/tables/<TABNAME>.json`（可另附解析出的字段数组）。
  - **备选**：`runQuery` 查询 `DD03L`（`AS4LOCAL = 'A'`），同样写入 JSON。
  - **兜底 RFC**：`DDIF_FIELDINFO_GET`；详见 [reference.md](reference.md)。
3. **失败补救是强制流程，不是可选项**：任一路径失败时必须自动切到下一兜底路径，直到三种路径均尝试完毕。禁止"报错即跳过"直接进入阶段 3/4。
4. 若某对象不是透明表或名称错误，记录到 `metadata/tables/_errors.md` 并回到 FS 修正或用户确认。
5. `metadata/tables/_errors.md` 必须包含：`对象名`、`已尝试路径`、`原始报错`、`下一步动作`（修正名 / 请求权限 / RFC 兜底），禁止只写一句"Internal server error"。
6. **并发约束（新增）**：阶段 2 默认串行。仅在单表稳定后，允许最多 `2` 并发；出现一次 `Internal server error` 立即降回串行。
7. **会话门禁（新增）**：若出现 `Internal server error`，必须先执行"0.8 会话保活与自动重登录"再决定是否记为对象失败，禁止在会话过期时把对象误记为失败。

### 2.5 主查询性能预估（新增，阶段 2 末尾）

在全部透明表元数据落盘后、进入阶段 3 前，代理必须对**主驱动表**（通常是数据量最大的那张表，如 `FAGLFLEXA`/`BSEG`）执行一次 `COUNT(*)` 预估：

- **预估 SQL**：`SELECT COUNT(*) AS CNT FROM <主表> WHERE <最严格的选择屏条件组合>`
- **数据量级分类**：
  - `< 10,000` 行 → 无分页，全量 ALV
  - `10,000 ~ 1,000,000` 行 → 建议分页（`CL_GUI_ALV_GRID` 分页或 `SUBMIT` 后台执行）
  - `> 1,000,000` 行 → 必须后台执行或增量抽取，禁止在线 ALV 全量输出
- **索引建议**：根据 WHERE 条件中的字段，在 `tech-design.md` 中标注是否走主键/二级索引；若预估全表扫描 → 标注为性能风险（TBD）。
- **输出**：结果写入 `metadata/performance-estimate.md`，包含：表名、预估行数、WHERE 条件、量级分类、分页建议、索引分析。

**硬规则**：`performance-estimate.md` 未生成或主表数据量 `> 100万` 且无分页方案 → 阶段 3 必须包含分页设计，禁止直接生成无限制在线 ALV。

## 阶段 3：开发技术文档 `docs/tech-design.md`

在拥有全部 `metadata/tables/*.json` 后生成；**须以元数据为准**描述结构，且**必须**包含上文 **「字段契约」** 小节（FS 列 / 表.字段 / `metadata/tables/<TABNAME>.json` 溯源）。此外建议包含：

- **表清单与用途**（每张表对应哪个 JSON）
- **主外键与关联路径**（仅使用元数据中可见字段名；推断处标注假设）
- **取数逻辑**：主查询顺序、JOIN/WHERE 要点（每条条件字段指向契约行）
- **选择屏 ↔ 数据库** 映射表
- **ALV/布局** 与字段契约列顺序一致
- **待确认项**（标为 TBD，**不得**在阶段 4 无契约实现）

## 阶段 4：按模板创建程序（契约驱动，非创意驱动）

1. **前置检查**：进入阶段 4 前，代理必须确认 `docs/deployment-config.md` 已存在且包含：目标包、传输请求（非 `$TMP` 时）、参考模板路径、新程序名。**禁止**在未确认开发包/请求号的状态下直接调用 `createObject`。
2. **先打开** `docs/tech-design.md`（字段契约）与涉及的 `metadata/tables/*.json`，再动笔；**Open SQL、内表定义、LOOP 中使用的字段名**须与之一致。
3. **模板来源**：以阶段 3.6 确认的模板为骨架（用户指定模板 或 Skill 默认模板 `templates/reference/ZSAP_FI244/`）；**业务 SELECT/JOIN/WHERE** 不得与契约和元数据冲突。
4. **模板结构强约束**：若参考程序是"主程序 + INCLUDE 分层"（如 `xxxT01`/`xxxSEL`/`xxxF01`），新程序必须保持同等分层，不允许退化为单文件大程序（除非用户明确要求简化）。
5. 生成前必须先写 `docs/template-mapping.md`，至少列出：`参考对象`、`新对象`、`对应 INCLUDE 清单`、`保留/替换说明`，以便审计"确实参照了模板格式"。
6. **Eclipse ADT 侧同类操作在 MCP 中的顺序**（概念上）：`findObjectPath` / `createObject` → `lock` → `setObjectSource` → `syntaxCheckCode`。
   - `createObject` 时按 `deployment-config.md` 传入 `devclass`（包）与 `transport`（请求号）；若包为 `$TMP`，传输请求字段留空或按 MCP schema 要求处理。
7. 传输：`transport` / `transportReference` 按 MCP 工具要求传入。

## FS 对齐审查机制（新增，阶段 3.5，未通过禁止阶段 4）

在写代码前，必须生成 `docs/fs-coverage.md`，用于证明"FS 字段与代码实现逐项对齐"。

最少包含以下列：

| FS 逻辑项 | 输出字段/选择字段 | 契约字段（表.字段） | 元数据文件 | 代码落点 | 状态 |
|---|---|---|---|---|---|
| 例：会计年度 | GJAHR | BKPF.GJAHR | metadata/tables/BKPF.json | `...F01` SELECT | Done/TBD |

硬规则：

1. `functional-spec-ai.md` 中每个"输出列/选择条件"都必须在 `fs-coverage.md` 出现一行，不得遗漏。
2. `状态=Done` 必须给出代码落点（主程序或 INCLUDE 名称）；`状态=TBD` 必须给原因与处理计划。
3. 阶段 5 前必须做一次"反查"：从最终代码（SELECT 列、WHERE、ALV 列）回填到 `fs-coverage.md`，确认无"代码有但 FS 无"与"FS 有但代码无"。

## 阶段 3.6：开发包、传输请求与程序模板确认（新增，未通过禁止阶段 4）

在获得 `fs-coverage.md` 对齐确认后、生成代码前，代理必须向用户确认以下三项，并落盘 `docs/deployment-config.md`：

### 3.6.1 开发包（Package）

- **询问用户**：目标开发包名称（如 `ZGD01`、`ZFI01`）。
- **若用户无法提供或留空**：默认使用 **`$TMP`（本地包）**，此时**无需传输请求**。
- **若用户提供了开发包**：代理须通过 `runQuery` 或 `searchObject` 验证该包在系统中是否存在、用户是否有写入权限。
  - 验证失败 → 回退到 `$TMP` 或请用户换包，记录到 `docs/deployment-config.md`。

### 3.6.2 传输请求（Transport Request）——仅非本地包时需要

- **若包 = `$TMP`**：跳过本节，传输请求字段留空。
- **若包 ≠ `$TMP`**：询问用户是否已有可用请求号。
  - **用户有请求号**：记录到 `docs/deployment-config.md`，代理在后续 `createObject`/`lock` 时按 MCP 要求传入。
  - **用户无请求号或要求新建**：代理通过 MCP 或引导用户在 SAP GUI 中创建传输请求。
    - **命名规则**：`ABAP_<功能名称>_<开发账号>_<YYYYMMDD>`
    - 例：功能名称为"序时账"、账号 `ITL12`、日期 `20260424` → `ABAP_序时账_ITL12_20260424`
    - 若系统不支持中文描述，转拼音或英文缩写，如 `ABAP_Journal_ITL12_20260424`。
    - 创建后记录请求号到 `docs/deployment-config.md`。

### 3.6.3 程序模板选择

- **询问用户**：是否有现有报表程序作为模板参考（提供程序名，如 `ZSAP_FI244`）。
  - **用户提供了模板**：代理通过 `getObjectSource` 拉取该程序源码（含全部 INCLUDE），保存到 `templates/reference/<程序名>/`，并在 `docs/template-mapping.md` 中列出模板与新程序的 INCLUDE 对应关系。
  - **用户未提供模板**：使用 Skill 包内置的**默认模板** `abap/sources/ZSAP_FI244/`（标准主程序 + `T01`/`SEL`/`F01` 三层 INCLUDE 结构）。代理须将该目录复制到 `templates/reference/ZSAP_FI244/` 作为本次参考基线。
- **模板结构强约束**：无论使用用户模板还是默认模板，新程序必须保持同等的 INCLUDE 分层结构（`xxxT01`、`xxxSEL`、`xxxF01`），不得退化为单文件大程序（除非用户明确要求简化）。

### 3.6.4 输出产物

`docs/deployment-config.md` 至少包含：

```markdown
## Deployment Config

| 项 | 值 | 备注 |
|---|---|---|
| 目标包 | $TMP 或 ZGD01 | |
| 传输请求 | 空 或 K9XXXXXX | 本地包时为空 |
| 参考模板 | ZSAP_FI244 或用户指定 | |
| 新程序名 | ZSAP_XXXX | 用户指定 |
| 创建日期 | YYYY-MM-DD | |
```

**硬规则**：`docs/deployment-config.md` 未生成或开发包/请求号状态不明 → **禁止**进入阶段 4。

## 阶段门禁产物验证（新增）

每阶段完成后必须落盘 `docs/stage-gate.md` 并打勾，未打勾禁止进入下一阶段。

- 阶段 1 门禁：`spec/functional-spec-ai.md` 存在且包含选择条件/输出列/透明表清单。
- 阶段 2 门禁：每张透明表对应 `metadata/tables/<TAB>.json` 或 `_errors.md` 有完整补救记录；`metadata/performance-estimate.md` 已生成（阶段 2.5）。
- 阶段 3 门禁：`docs/tech-design.md` + `docs/fs-coverage.md` + `docs/template-mapping.md` 完整。
- 阶段 3.6 门禁：`docs/deployment-config.md` 已生成，开发包/请求号/模板状态明确。
- 阶段 4 门禁：代码结构与模板映射一致（含 INCLUDE 清单）。
- 阶段 5 门禁：`syntaxCheck` 通过、激活结果记录（成功或达到重试上限）。
- 阶段 5.5 门禁：`docs/smoke-test.md` 已生成且通过最低验证。

`docs/stage-gate.md` 建议固定格式（避免代理误判）：

```markdown
S0=permission-check: yes/no
S1=functional-spec-ready: yes/no
S2=metadata-ready: yes/no
S2.5=performance-estimate-ready: yes/no
S3=tech-design-ready: yes/no
S3.5=fs-coverage-ready: yes/no
S3.6=deployment-config-ready: yes/no
S4=code-generated: yes/no
S5=activated: yes/no
S5.5=smoke-test-passed: yes/no
```

### 版本控制自动提交（新增，推荐）

若当前目录是 Git 仓库，代理应在每阶段门禁通过后自动执行 `git add + git commit`，形成可追溯的变更历史：

- **提交信息格式**：`[SAP-WF] 阶段X: 简述产物`
  - 例：`[SAP-WF] S1: 功能规格规范化 EE041-ZSAP_FI250`
  - 例：`[SAP-WF] S2: 落盘 4 张透明表元数据 + 性能预估`
  - 例：`[SAP-WF] S5.5: 激活通过 + 冒烟测试通过`
- **提交范围**：每阶段新增/修改的产物文件（不要 `git add -A` 提交无关文件）。
- **失败处理**：若 `git` 不可用或仓库未初始化 → 跳过并提示用户；不阻塞工作流。
- **价值**：当阶段 4/5 反复修错时，可随时 `git diff` 查看变更；当需要回滚到某阶段时，可直接 `git checkout` 到对应提交。

## 阶段 5：部署与激活（循环直至成功）

1. 使用 `activateByName` 或 `activateObjects`（需完整 object URI 与类型信息）。
2. 若失败：解析返回中的 **消息/日志**（含行号、对象名），**分类处理**：
  - 语法/拼写 → 改源码后 `setObjectSource`，再 `syntaxCheckCode`。
  - 依赖未激活 → 先激活依赖对象或调整顺序。
  - 锁/传输问题 → `unLock`、换请求或协调。
3. 重复直至激活成功；可用 `inactiveObjects` 复核。
4. **上限**：同一错误无进展重复超过约定次数（如 5 次）则停止自动重试，输出摘要请用户决策。

## 阶段 5.5：冒烟测试（新增，激活后强制）

激活通过 ≠ 程序可用。在标记 `S5=activated: yes` 前，代理必须执行至少以下验证之一（按系统权限从易到难）：

1. **语法与结构验证**（最低要求，总能执行）：
   - 通过 `getObjectSource` 拉取激活后的源码，确认 `setObjectSource` 写入的代码与系统内一致（防止激活覆盖或截断）。
   - 核对源码中是否包含字段契约中所有 `状态=Done` 的字段。

2. **执行探针**（若系统允许 `SUBMIT` 或后台执行）：
   - 用 `runQuery` 或 MCP 等价工具执行一次带最严格选择条件的查询，验证 WHERE 条件在真实数据上是否返回非空结果。
   - 若返回 0 行 → 不一定是错误，但必须在 `docs/activation-log.md` 中标注"选择条件过严可能导致空输出"。

3. **ALV 列核对**（从源码静态分析）：
   - 检查 `gt_fieldcat` 或 `slis_t_fieldcat_alv` 的赋值语句，确认列数与 `fs-coverage.md` 中 `状态=Done` 的行数一致。
   - 发现"代码有但 FS 无"的列 → 回填到 `fs-coverage.md` 并标注 `状态=Unexpected`。

**输出**：`docs/smoke-test.md`，包含：测试项、执行方式、结果、异常列说明。`smoke-test.md` 未生成 → 禁止标记 `S5=activated: yes`。

## 增量更新机制（新增，FS 变更时复用已有产物）

当用户说"改一下 FS"、"加一列"、"换一张表"时，代理**禁止**默认全量重跑 0→5。必须先判断变更范围，从最近可复用阶段恢复：

### 变更范围判定与恢复策略

| 变更类型 | 影响阶段 | 恢复起点 | 需重新执行的阶段 | 可复用产物 |
|---------|---------|---------|----------------|-----------|
| 纯输出列调整（不改表/条件） | 3.5 → 5.5 | S3.5 | 3.5, 4, 5, 5.5 | S1, S2, S3, metadata |
| 新增/替换透明表 | 2 → 5.5 | S2 | 2, 2.5, 3, 3.5, 4, 5, 5.5 | S1（若选择屏未变） |
| 选择屏条件变更 | 3 → 5.5 | S3 | 3, 2.5(重估), 3.5, 4, 5, 5.5 | S1, S2, metadata |
| 模板/INCLUDE 结构调整 | 4 → 5.5 | S4 | 4, 5, 5.5 | S1~S3.5, metadata |
| 仅改 ALV 布局/格式 | 4 → 5.5 | S4 | 4, 5, 5.5 | S1~S3.5, metadata, tech-design |
| 改程序描述/文本 | 5 → 5.5 | S5 | 5, 5.5 | 全部 |

### 恢复执行规则

1. **读取当前 `stage-gate.md`**，确认上一版本的各阶段状态。
2. **对比新旧 FS**：代理用 diff 逻辑（或用户明确说明）确定变更类型，按上表选择恢复起点。
3. **更新策略**：
   - 若恢复起点 ≤ S2：仅对新表执行元数据拉取，已有表的 JSON **不得**删除重建（保持历史）。
   - 若恢复起点 = S3.5：在 `fs-coverage.md` 中新增/修改对应行，保留已 `Done` 的历史行。
   - 若恢复起点 = S4：先 `getObjectSource` 拉取当前系统上的源码作为基线，再应用变更（避免覆盖他人并行修改）。
4. **版本标记**：增量更新完成后，在 `stage-gate.md` 中追加版本号，如 `S5=activated: yes (v2)`。
5. **Git 提交**：增量更新单独提交，信息格式 `[SAP-WF] 增量更新(v2): 简述变更`。

### 禁止行为

- **禁止**用户说"加一列"就重拉所有表元数据。
- **禁止**增量更新时直接覆盖系统上的对象而不先 `getObjectSource` 拉基线。
- **禁止**不更新 `fs-coverage.md` 和 `stage-gate.md` 就直接改代码。

## 执行检查清单

```
- [ ] 阶段 0：ai-abap MCP 自动安装完成（入口路径真实存在）
- [ ] 阶段 0：.env 已生成且包含真实 SAP 连接信息（URL/CLIENT/USER/PASSWORD/SID/SYSNR/ROUTER/TYPE）
- [ ] 阶段 0：.claude/settings.json 或用户级 settings.json 的 ai-abap 条目已就绪（无占位符）
- [ ] 阶段 0：healthcheck 返回成功（重启后实测）
- [ ] 阶段 0.9：权限前置探测通过（S_DEVELOP / 包权限 / 传输请求）
- [ ] functional-spec-ai.md 结构完整
- [ ] 每张透明表均有 metadata JSON（阶段 2 产物）
- [ ] metadata/tables/_errors.md 对失败对象包含"尝试路径 + 原始报错 + 下一步动作"
- [ ] metadata/performance-estimate.md 已生成（主表 COUNT + 量级分类 + 分页建议）
- [ ] tech-design.md 含「字段契约」且与 metadata 一致
- [ ] fs-coverage.md 已覆盖 FS 全量字段（含 Done/TBD）
- [ ] deployment-config.md 已生成（包/请求号/模板/新程序名）
- [ ] template-mapping.md 已证明新程序结构对齐参考模板（含 INCLUDE）
- [ ] stage-gate.md 每阶段门禁已打勾（含 S0/S2.5/S3.6/S5.5）
- [ ] Open SQL / 内表字段均可追溯到契约与 metadata（无凭空字段）
- [ ] 源码已 syntaxCheckCode
- [ ] 激活成功或达到重试上限并记录原因
- [ ] smoke-test.md 已生成且通过最低验证（源码一致 / 执行探针 / ALV 列核对）
- [ ] （推荐）每阶段产物已 git commit
```

## 延伸阅读

- RFC 参数、Eclipse ADT / ADT REST 与 abapify CLI 要点：[reference.md](reference.md)
- **MCP 参数契约与易错点**（读 schema、禁止猜参数名）：[mcp-contract.md](mcp-contract.md)

## 迁移到其他环境

### Claude Code 双方案选择

Claude 端支持两种 MCP 实现，代理按用户网络环境自动选择：

| 场景 | 推荐 MCP | 连接方式 | 启动器 |
|------|---------|---------|--------|
| 内网 + SAP Router | **fr0ster/mcp-abap-adt** | RFC (`SADT_REST_RFC_ENDPOINT`) | `mcp-launcher.js`（自动设置 `SAPNWRFC_HOME` + PATH） |
| 公网 / 无 Router | mario-andreschak/mcp-abap-abap-adt-api | HTTP ADT (`/sap/bc/adt/`) | 直接 `node dist/index.js` |

- **fr0ster 版安装**：`git clone https://github.com/fr0ster/mcp-abap-adt.git && npm install && npm run build`。工作目录需包含 `.env`（`SAP_CONNECTION_TYPE=rfc`、`SAP_ROUTER=/H/...`）和 `NW-RFC-SDK/`。
- **自动检查**：复制 Skill 后先运行 `node scripts/setup.js` 检查环境，再运行 `node scripts/healthcheck.js` 验证连接。

- **其他 Claude Code 用户**：复制本 Skill 整个目录到对方仓库的 `.claude/skills/sap-report-automation-workflow/`（或到 `~/.claude/skills/` 作为全局 Skill）。新环境首次触发时，**代理按阶段 0 自动**克隆并构建 MCP、合并 `settings.json`、收集 SAP 凭据、提示重启后 `healthcheck`——**不要求对方手动装 MCP**。RFC 备选仍需用户安装 NW RFC SDK。
- **Cursor**：使用仓库内 `.cursor/skills/sap-report-automation-workflow/`，配置写入 `.cursor/mcp.json`。
- **OpenClaw**：使用仓库内 `openclaw/skills/sap_report_automation_workflow/`，复制到 `~/.openclaw/skills/` 或工作区 skills 目录后重启 gateway / `openclaw skills list` 校验；MCP 侧仍由代理按阶段 0 自动安装 Node 版 server，在 OpenClaw/宿主侧注册同一入口（具体 MCP 配置方式以 OpenClaw 当前文档为准）。
