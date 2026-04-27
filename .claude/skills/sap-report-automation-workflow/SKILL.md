---
name: sap-report-automation-workflow
description: |
  End-to-end SAP 报表自动化（与 Eclipse ADT 能力对齐）：通过本地 RFC 代理将 HTTP ADT REST 请求转译为 RFC SADT_REST_RFC_ENDPOINT 调用 SAP；FS 规范化、透明表 DDIC、技术文档、按模板写 ABAP、激活循环；Open SQL 与内表字段必须由 metadata 驱动、禁止脱离元数据自由发挥。触发场景：用户要写 ABAP/SAP 报表、REPORT、ALV、从 FS 到部署、切换 SAP、配置或安装 MCP、login 失败。**MCP 未就绪时代理必须自动 npm build + 写 .mcp.json + 启动 rfc-proxy-server，不得把安装推给用户**。GitHub MCP：https://github.com/mario-andreschak/mcp-abap-abap-adt-api
---

# SAP 报表自动化工作流（FS → 元数据 → 设计文档 → 代码 → 激活）

## 与 Eclipse ADT 的关系（术语一致、能力对齐）

- **术语**：口语中的「ADT」即运行在 Eclipse 上的 **ABAP Development Tools（ABAP 开发工具）**，与「Eclipse ADT」指**同一套官方开发环境**，不存在另一套并行标准。
- **本 Skill 的对接方式**：在 Claude Code 里通过 **`abap-adt` MCP** 调用与 **Eclipse ADT 相同的 ADT REST 契约**（`/sap/bc/adt/`），与 abap-adt-api 系实现同源。目标与在 Eclipse ADT 中开发一致：**与 SAP AS ABAP 联通**、**读写开发对象源码**、**语法检查**、**激活**（由 MCP 工具链完成，对应 Eclipse 中的同类后端操作）。
- **与桌面 IDE 的差异**：不在本机打开 Eclipse 窗口；**后端协议、对象 URI、权限要求与 Eclipse ADT 对齐**。若某地址在 Eclipse ADT 中能连上同一系统，则 `SAP_URL` 应使用与之对应的 **HTTPS 基地址**（网络经 SAProuter / Web Dispatcher / 代理时，以 Basis 给出的**最终可达** URL 为准，见 [reference.md](reference.md)）。
- **协作建议**：同一对象可在 Eclipse ADT 与 Claude Code+MCP 间切换编辑；注意**锁与传输**与 Eclipse 行为一致，避免并行编辑同一对象冲突。

## 阶段间强引用（元数据驱动实现；禁止「凭语感写 Open SQL」）

工作流各阶段**不是彼此无关的文档**，而是**同一链条上的输入/输出**。后续阶段**必须显式引用前序产物**；**禁止**在阶段 4 凭模型记忆拼字段名、表名或 JOIN 条件。


| 消费方                          | 必须参照的输入                                                        | 规则                                                                                                     |
| ---------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `output/<program>/docs/tech-design.md` | `output/<program>/spec/functional-spec-ai.md` + `output/<program>/metadata/tables/*.json` | 关联与 WHERE 中涉及的每个**物理字段**，须能在对应表的元数据文件中核对（或标注 TBD 并说明缺什么）。                                              |
| ABAP（Open SQL、内表 `ty_out` 等） | `output/<program>/docs/tech-design.md` 中的 **「字段契约」** + `output/<program>/metadata/tables/*.json` | **SELECT / JOIN / WHERE / ORDER BY** 中出现的表名、字段名，必须来自上一步契约或元数据；**禁止**引入契约中未出现的字段（除非先回到阶段 2 补拉元数据并更新契约）。 |
| ALV 列 / 内表组件                 | 同上                                                             | 列与组件名与契约一致；计算列在契约中写清公式，代码只实现契约。                                                                        |


**字段契约（阶段 3 必写）**：在 `output/<program>/docs/tech-design.md` 中设固定小节，至少包含下表（可复制扩展）：

```markdown
## 字段契约（实现唯一依据）

| 逻辑项（FS/输出） | 表名 | 字段名 | 元数据文件 |
|------------------|------|--------|------------|
| … | BKPF | BUKRS | output/<program>/metadata/tables/BKPF.json |
```

阶段 4 写程序时：**以「字段契约」+ `output/<program>/metadata/tables/<T>.json` 为白名单** 生成 Open SQL；若发现 FS 需要某字段但元数据无：**不得**直接编写，须先补拉该表或更正 FS，再更新契约与 JSON。

**与模版的关系**：模版（`INCLUDE` 结构等）只解决**程序骨架与团队风格**；**业务字段、SQL、WHERE 一律以契约与元数据为准**，不得用模版里的示例字段冒充本需求。

## 代理自主执行协议（本 Skill 的核心；不可省略）

本 Skill 的目标不是「多几个 Markdown 文件」，而是 **无人盯梢的自动工作流 + 可验证的智能**：用户给出 FS、模版、包/程序名等信息后，代理应在**同一任务内**按阶段 **1→2→3→4→5 顺序自动跑完**，仅在 **缺关键输入、MCP 不可用、或达到重试上限** 时停顿询问——**不得**因图快而跳过阶段，**不得**默认用户会逐步提醒「你该做第几步了」。

**硬门禁（除非用户明确说「跳过阶段 X」）：**

0. **未**通过 `abap-adt` MCP 连通验证失败 → **禁止**进入阶段 1 以后。且 MCP 未就绪时代理**必须自动执行阶段 0 的构建/写 .mcp.json + 启动 rfc-proxy-server**，不得把「请先安装 MCP」丢回用户。
1. **未**写出可用的 `output/<program>/spec/functional-spec-ai.md`（或等价结构化需求）→ **禁止**写 ABAP、**禁止**调用 `setObjectSource` / 激活。
2. **未**对 FS 中出现的每张透明表完成元数据落盘（`output/<program>/metadata/tables/<TABNAME>.json`，失败则写入 `_errors.md` 并处理）→ **禁止**进入阶段 4。
3. **未**写出 `output/<program>/docs/tech-design.md`（含 **字段契约** 小节、关联、WHERE、选择屏映射、穿透/异常）→ **禁止**进入阶段 4。
4. 阶段 4–5：必须实际调用 MCP（`syntaxCheckCode`、`lock`、`setObjectSource`、`activate*` 等），并在失败时按 Skill **自动修错循环**，直至成功或达到重试上限。

**「智能」的最低标准**：主动用 MCP（如 验证连通、`getObjectSource` 拉表定义、或 `runQuery`→`DD03L`）验证假设；发现 FS 笔误（如 BKFP→BKPF）在 `functional-spec-ai.md` 中**显式纠正**并记入 tech-design；不把「补文档」当成可选项，把「**跑通 Eclipse ADT 等效的联通、写码与激活**」当成交付的必要条件。若任务为**整包对象**拉取：必须先 **TADIR 分类统计 + 按类型套 URI 模板 + 分批 / `rowNumber` / manifest 续跑**（详见 [mcp-contract.md](mcp-contract.md)「整包开发对象」），**禁止**对整包用 `searchObject` 当枚举或逐对象猜路径试错。

**对用户的可见输出**：每一阶段结束用**简短进度说明**（一两句）即可，不要要求用户逐步确认流程——仅在门禁无法自动突破时提问。

## 抢跑根因与执行守卫（新增，给所有 Claude Code 代理）

### 已识别根因（必须规避）

1. 代理把"用户目标（创建程序）"当成"可立即执行动作"，忽略阶段门禁产物是否齐全。
2. 代理在长流程中丢失状态，未用统一文件证明"上一阶段完成"。
3. 代理把"文档阶段"当作软建议，而不是硬依赖，导致直接调用 `createObject`。

### Preflight Gate（强制前置守卫）

在 **任何** SAP 写操作（`createObject` / `setObjectSource` / `activate*`）前，代理必须先检查以下文件是否存在且非空：

- `output/<program>/spec/functional-spec-ai.md`
- `output/<program>/docs/tech-design.md`
- `output/<program>/docs/template-mapping.md`
- `output/<program>/docs/fs-coverage.md`
- `output/<program>/docs/deployment-config.md`
- `output/<program>/docs/stage-gate.md`

并在 `output/<program>/docs/stage-gate.md` 中确认以下 5 项为已完成：

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

本 Skill 的最硬性门禁：**在执行任何依赖与 Eclipse ADT 同源的 ADT REST 的操作（FS 校正、拉表结构、写 ABAP、激活）之前，`abap-adt`（内部名 `abap-adt`）MCP 必须处于「可连通 SAP」的状态**。若未就绪，代理**必须主动完成安装与注册**，而不是回复「请您先安装 MCP」把球踢回用户。唯一允许打断自动流程向用户索要的，是**本机不可自动获取的 SAP 连接凭据**。

### 0.0 代理行为约束（红线）

- **MUST**：探测到 MCP 未就绪时，**立刻进入自动安装流程**，无需用户说「请安装」。
- **MUST**：在同一次任务内串起 `构建 → 写 .mcp.json → 启动代理 → 提示重启 → 再验证连通`。
- **MUST NOT**：用占位符（`C:/path/to/...`、`your-sap-host`）冒充「已配置」；未验证连通不得声称已连上 SAP。
- **MUST NOT**：把 `git clone` / `npm install` / `npm run build` 作为「让用户去做的作业」列出，代理有 Shell 能力就**自己跑**。
- **仅允许**向用户索要：`SAP_URL`、`SAP_USER`、`SAP_PASSWORD`、`SAP_CLIENT`、`SAP_LANGUAGE`、`SAP_ROUTER`（RFC 场景必填）、`SAP_CONNECTION_TYPE`（RFC 场景必填）、（可选）构建目录偏好。

### 0.1 探测（先判断再动手）

按顺序尝试，任一成功即视为「已就绪」：

1. 调用 MCP `abap-adt` / `abap-adt` 的轻量工具（如 `objectTypes` 空参 `{}`）；成功返回即代表 MCP 与 SAP 联通。
2. 若工具列表里**没有**该服务器条目 → MCP 未注册。
3. 若有条目但调用**超时/报错** → MCP 已注册但未构建成功、代理未启动或配置错误。

把判断结果明确分三类：`未注册` / `已注册未连通` / `已就绪`。据此进入 0.2、0.3 或直接跳到阶段 1。

> **架构认知**：本 Skill 的 MCP 链路为 **mcp-abap-abap-adt-api (HTTP ADT REST) → rfc-proxy-server.js (localhost:9876) → node-rfc → SADT_REST_RFC_ENDPOINT → SAP**。所有 ADT 请求走完整链路；若失败需按链路分层排查（见 0.4.1）。

### 0.2 自动构建（`未注册` 或 `已注册未连通`）

本工作流已内置 `mcp-abap-abap-adt-api` 源码仓库（位于 `{workspaceFolder}/mcp-abap-abap-adt-api/`），**不需要** `git clone`。代理只需执行构建：

**执行命令**（代理使用其 Shell 工具实际运行，不要只把命令贴给用户）：

- Windows（Git Bash / PowerShell）：

```bash
cd "E:/ABAP工作流/mcp-abap-abap-adt-api"
npm install
npm run build
echo "ENTRY=$(pwd)/dist/index.js"
```

- macOS / Linux：

```bash
cd "$(pwd)/mcp-abap-abap-adt-api"
npm install
npm run build
echo "ENTRY=$(pwd)/dist/index.js"
```

**失败处理**（逐条排查，不要把失败直接扔给用户）：

- `node` / `npm` 不存在 → 提示用户安装对应工具（**唯一**可请求用户介入的系统级前提）。
- `npm run build` 失败 → 读构建日志定位；常见为 Node 版本过低，建议 Node ≥ 18。
- 构建目标不是 `dist/index.js` → **读取**仓库 `package.json` 的 `main` / `bin` 字段确定真实入口，勿猜。

### 0.3 写入 MCP 配置文件 `.mcp.json`（不要用占位符）

> **关键认知**：Claude Code 的 MCP 服务器配置**不能**放在 `.claude/settings.json` 或用户级 `settings.json` 中——`settings.json` 的 validation 会拒绝 `mcpServers` 字段（`Unrecognized field: mcpServers`）。**唯一正确位置**是项目根目录的 `.mcp.json`。

目标文件：**`{workspaceFolder}/.mcp.json`**（项目根目录）。

**规则**：

- 若 `.mcp.json`**不存在** → 直接生成；若**已存在** → **合并**而非覆盖：读原 JSON → 仅追加/更新 `mcpServers.abap-adt` 条目 → 回写；保留其他服务器。
- **`.mcp.json` 只包含代理地址和 DLL 路径，不含任何 SAP 凭据**（凭据统一保存在 `.env`）。
- **Windows 必看**：`command` 字段必须填 `node.exe` 的**绝对路径**（如 `E:/Node.Js/node.exe`）。Git Bash 的 `PATH` 与 Windows 系统 `PATH` 是两套环境，Claude Code spawn MCP 进程时使用系统 PATH，`"command": "node"` 会报 `ENOENT`。

**本工作流统一配置**（RFC 代理模式；不区分 HTTP/RFC 场景，全部走代理）：

```json
{
  "mcpServers": {
    "abap-adt": {
      "command": "E:/Node.Js/node.exe",
      "args": ["E:/ABAP工作流/mcp-abap-abap-adt-api/dist/index.js"],
      "env": {
        "SAP_URL": "http://localhost:9876",
        "SAPNWRFC_HOME": "E:/ABAP工作流/NW-RFC-SDK/nwrfcsdk",
        "PATH": "E:/ABAP工作流/NW-RFC-SDK/nwrfcsdk/lib",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      },
      "disabled": false
    }
  }
}
```

> **关键认知**：`SAP_URL` 必须填 `http://localhost:9876`（**不是** SAP 真实地址）。MCP 发送的 HTTP ADT REST 请求先到本地 `rfc-proxy-server.js`，再由代理通过 `node-rfc` → `SADT_REST_RFC_ENDPOINT` 转发到 SAP。真实 SAP 地址（`http://10.32.21.11:8000`）和凭据由代理从 `.env` 读取，**不要**填到 `.mcp.json` 中。
>
> `SAPNWRFC_HOME` 和 `PATH` 在 `.mcp.json` 中必须设置，确保 MCP 子进程能加载 `sapnwrfc.dll`（代理启动时会在进程内设置这些变量）。

### 0.4 收集 SAP 连接信息（**唯一**允许打断流程的环节）

代理必须一次性向用户索要全部连接信息（缺啥问啥，不要每次只问一个字段）。**支持两种输入方式**：

- **方式 A（推荐）**：用户直接在对话中给出信息 → 代理自动调用 `node scripts/write-config.js` 写入 `.env` 并合并 `.mcp.json`。
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
- 若 `SAP_CONNECTION_TYPE = rfc` 且存在 `NW-RFC-SDK/nwrfcsdk/lib/sapnwrfc.dll`，代理**必须先启动** `rfc-proxy-server.js`（设置 `SAPNWRFC_HOME` + PATH），再将 `.mcp.json` 的 `SAP_URL` 指向 `http://localhost:9876`。

**写入动作（代理执行，不交给用户）**：

1. 生成 `.env`（含 `SAP_SID`、`SAP_SYSNR`、`SAP_ROUTER`）。
2. 若项目级 `.mcp.json` 存在 → 合并 `mcpServers` 条目；若不存在 → 直接生成。
3. 写入后调用 `node scripts/test_rfc.js` 做一次性校验，输出诊断。

### 0.4.1 RFC 连接稳定性指南（Windows 必看；内网 + SAP Router 场景）

本 Skill 当前最大的稳定性痛点是 **RFC 连接报错**。以下方案是从多次实战中固化下来的**唯一正确路径**；任何偏离都会导致 `node-rfc` 加载失败或连接间歇性中断。

#### 核心原则

1. **Git Bash `export PATH` 对 `node-rfc` 完全无效**
   - `node.exe` 是 Windows 原生进程，只读取 Windows 注册表中的系统/用户环境变量。
   - Git Bash 里 `export PATH=/.../NW-RFC-SDK/nwrfcsdk/lib:$PATH` **不会**影响 `node-rfc` 的 DLL 搜索路径。
   - **唯一正确方式**：通过 Windows「系统属性 → 环境变量」对话框设置。

2. **`rfc-proxy-server.js` 必须随 MCP 一起启动**
   - 本工作流的链路为：**MCP (mcp-abap-abap-adt-api) → HTTP localhost:9876 → rfc-proxy-server.js → node-rfc → SADT_REST_RFC_ENDPOINT → SAP**。
   - 代理服务 `rfc-proxy-server.js` 负责将 abap-adt-api 发出的 HTTP ADT REST 请求转译为 RFC 调用。若代理未启动，MCP 的 `SAP_URL=http://localhost:9876` 将连接失败（`ECONNREFUSED`）。
   - 启动方式：`node rfc-proxy-server.js`（后台运行，监听 `127.0.0.1:9876`）。代理启动时会自动执行 RFC `client.open()` 预连接。

3. **禁止把 DLL 复制到 `node_modules/node-rfc/prebuilds/` 中**
   - 不要手工将 `sapnwrfc.dll`、`icudt74.dll`、`icuuc74.dll`、`icuin74.dll` 复制到 `node_modules/node-rfc/prebuilds/win32-x64/`。
   - 这种「看似能跑」的 workaround 会导致版本冲突和不稳定的加载行为（例如换 Node 版本后突然失效）。

#### Windows 环境变量配置（精确步骤）

代理在探测到 `SAP_CONNECTION_TYPE=rfc` 且 `platform === 'win32'` 时，**必须**引导用户完成以下配置（或自动检测并提示）：

```
1. Win + R → 输入 sysdm.cpl → 回车
2. 「高级」页签 → 「环境变量(N)...」
3. 「系统变量」区块 → 「新建(W)...」
   变量名 : SAPNWRFC_HOME
   变量值 : E:\ABAP工作流\NW-RFC-SDK\nwrfcsdk   （按实际仓库路径）
   → 确定
4. 「系统变量」区块 → 找到 Path → 「编辑(I)...」
   → 「新建」→ 输入 %SAPNWRFC_HOME%\lib
   → 确定（共三次）
5. 完全关闭并重新打开所有终端 / VS Code / Claude Code 窗口
   （Git Bash 也要全部关闭再开；仅 source .bashrc 无效）
```

#### 自动化验证（代理必须执行）

环境变量配置完成后，代理**不要**直接调 MCP 验证连通，而应先跑底层诊断：

```bash
# 验证 node-rfc 能否加载 + RFC 能否连通（独立于 MCP）
node scripts/test_rfc.js
```

- **通过** → 再启动 `rfc-proxy-server.js`（`node rfc-proxy-server.js &`），然后调 MCP 验证连通。
- **失败** → 按脚本输出的分类诊断处理（见下表），**禁止**跳过直接进入阶段 1。

自动化验证统一使用：
```bash
node scripts/test_rfc.js
```
该脚本会自动检测环境变量、加载 `node-rfc`、测试 RFC 连通性并输出分类诊断。

#### 常见错误诊断速查表

| 错误信息 | 根因 | 解决动作 |
|---------|------|---------|
| `The specified module could not be found: node.napi.node` | `SAPNWRFC_HOME` 或 `PATH` 未设置，或 `node-rfc` 找不到 `sapnwrfc.dll` | 按「Windows 环境变量配置」精确设置；确认完全重启终端 |
| `connection to partner '...' broken` + `WSAECONNRESET` (10054) | SAP Router 拒绝连接，或 SAP 实例未监听 RFC 端口 | 核对 `SAP_ROUTER` 字符串；联系 Basis 确认 RFC 端口 `33XX` 开放；确认客户端 IP 在白名单 |
| `partner '...' not reached` + `WSAETIMEDOUT` (10060) | 网络不可达、防火墙阻断、或 `ashost`/`sysnr` 错误 | 核对 `SAP_URL` 的主机和端口；`sysnr` 必须从端口 `80XX` 的 `XX` 推导（如 `8000` → `00`，RFC 端口 `3300`）；测试 Router 主机 `ping`/`telnet` |
| `NAME_OR_PASSWORD is incorrect` / `not authorized` | 用户名、密码错误或账号锁定 | 核对 `.env` 中的 `SAP_USERNAME`/`SAP_PASSWORD`；确认用户有 `S_RFCACL` 权限 |
| `LOGON ... language` | 登录语言或客户端错误 | 核对 `SAP_CLIENT`、`SAP_LANGUAGE` |

#### 故障分层定位（代理执行顺序）

当用户报告「MCP 连不上 SAP」时，代理必须按以下顺序排查，**不得**直接重试 验证连通：

1. **DLL 层**：`node scripts/test_rfc.js` 能否加载 `node-rfc`？
   - 失败 → 环境变量问题（100% 是 `SAPNWRFC_HOME`/`PATH`）。
2. **网络层**：`test_rfc.js` 能否 `client.open()` 成功？
   - 失败 → Router / 防火墙 / 端口 / sysnr 问题。
3. **认证层**：`client.open()` 报 `NAME_OR_PASSWORD`？
   - 失败 → `.env` 凭据错误或账号权限问题。
4. **代理层**：RFC 直连正常，但 `rfc-proxy-server.js` 是否已启动？
   - 检查 `curl http://localhost:9876/sap/bc/adt/discovery` 是否返回 200。
   - 若 `ECONNREFUSED` → 代理未启动；执行 `node rfc-proxy-server.js &`。
   - 若代理启动但返回 502 → 代理内部 RFC 连接失败，检查 `.env` 配置。
5. **MCP 层**：前 4 层都通过后，验证连通 仍失败？
   - 失败 → `.mcp.json` 配置错误（入口路径、`env` 字段缺失、`SAP_URL` 未指向 `localhost:9876` 等）。

**只有第 5 层才属于 MCP 配置问题；前 4 层都属于环境 / 网络 / 账号 / 代理问题，必须在外部解决。**

### 0.5 提示重启 → 再次验证连通（**自动重试**）

- 明确告诉用户：**退出并重新启动 Claude Code**（或新开一个会话），以使 MCP 配置生效。
- 重启完成后代理**主动**再调 验证连通；失败最多 3 次自动重试，仍失败则输出**结构化诊断**（entry 路径是否存在、.mcp.json 路径、env 字段是否完整（仅需 `SAP_URL`、`SAPNWRFC_HOME`、`PATH`）、`node <entry>` 直接启动的 stderr），再请用户判断。

### 0.9 权限前置探测（新增，阶段 0 末尾强制）

验证连通 通过**不等于**业务操作权限足够。在进入阶段 1 前，代理必须执行一次轻量权限探针，避免到阶段 4 才发现无法创建对象：

1. **开发权限探针**：`runQuery` 查 `AGR_USERS` 或执行 `AUTHORITY-CHECK OBJECT 'S_DEVELOP'` 等效逻辑（如查询 `TADIR` 测试读取）：
   ```sql
   SELECT COUNT(*) AS CNT FROM TADIR WHERE PGMID = 'R3TR' AND OBJECT = 'PROG' AND ROWS BETWEEN 1 AND 10
   ```
   - 若返回权限不足 → 立即停止，输出结构化诊断（缺少的权限对象、建议联系 Basis）。
2. **包权限探针**（若用户已提供目标包）：`runQuery` 查 `TRDIR` 或尝试 `searchObject` 一个已知存在的程序，验证读写权限。
3. **传输请求探针**：验证用户是否有可用的传输请求（若后续需要创建对象）。

**失败处理**：
- 权限不足 → 输出缺失的权限对象列表 + 建议的角色/事务码（如 `PFCG` 分配 `SAP_BC_DWB_ABAPDEVELOPER`），停止工作流。
- 探针结果记录到 `output/<program>/docs/stage-gate.md` 的 `S0=permission-check` 行。

### 0.8 RFC 代理连接稳定性

当前架构（MCP → HTTP → RFC 代理 → SAP）**无 HTTP 会话概念**：每次 MCP 工具调用都是独立的 HTTP 请求，由 `rfc-proxy-server.js` 即时翻译为 `SADT_REST_RFC_ENDPOINT` RFC 调用。RFC 连接由代理内部长连接维护，MCP 层无需预热或重登录。

针对 `runQuery`、`tableContents`、`searchObject` 等业务工具，若返回连接类错误（`ECONNREFUSED`、`Connection broken`、`RFC_COMMUNICATION_FAILURE` 等），按以下顺序处理：

1. **检查代理进程**：`curl http://localhost:9876/sap/bc/adt/discovery` 是否返回 200？
   - 失败 → 代理未运行或未就绪，执行 `node rfc-proxy-server.js &` 重启。
2. **重放原请求 1 次**（报文不变）。
3. 仍失败 → 进入 SQL/权限/网络诊断（见 0.4 故障分层定位）。
4. 所有代理重连动作记录到 `output/<program>/metadata/tables/_errors.md`，明确标注"代理连接问题（非 SAP 业务逻辑错误）"。

### 0.6 切换 SAP 系统

用户说「换系统 / 切到 PRD / 改客户端 300 / 改密码」时，代理按以下顺序操作：

1. **更新 `.env`**（RFC 场景）：`rfc-proxy-server.js` 从 `.env` 读取真实 SAP 地址和凭据；修改后必须确保 `.env` 与目标 SAP 系统一致。`.mcp.json` **只含代理地址**（`SAP_URL=http://localhost:9876`），切换系统时**无需修改** `.mcp.json`。
2. **重启代理**（RFC 场景）：代理启动后不会热重载 `.env`，修改后必须杀掉旧进程、重新执行 `node rfc-proxy-server.js`。
3. **提示用户重启 Claude Code**：`.mcp.json` 只在启动时加载，若 `.mcp.json` 本身无变更则无需重启；但若代理端口或 DLL 路径有变则需重启。
4. 重启完成后代理主动验证连通。

**不要**新增新的服务器键（除非用户要求并行多套）。

### 0.7 最小可见输出

0.1–0.5 全过程给用户的**进度反馈限制在极简**：

```
[MCP] 未就绪 → 自动构建 mcp-abap-abap-adt-api
[MCP] npm install / build 完成，入口：.../dist/index.js
[MCP] 已写入 .mcp.json（所有字段已填入实际值）
[MCP] 请提供 SAP_URL / USER / PASSWORD / CLIENT / LANGUAGE / ROUTER(RFC) / CONNECTION_TYPE
[MCP] 请重启 Claude Code，完成后我会自动验证连通
```

**禁止**把上面的命令再原样抛给用户让他自己跑——代理能跑就跑，跑不了再说。

## 目标与原则

- **连接方式**：优先使用已配置的 **ADT REST**（通过 MCP `abap-adt` 暴露）；与 **Eclipse ADT** 使用同一套 `/sap/bc/adt/` 契约，适合无头自动化与 CI。
- **表字段元数据**：**首选** MCP `getObjectSource`，`objectSourceUrl` = `/sap/bc/adt/ddic/tables/<小写表名>/source/main`（一次拉全表定义；勿把 `ddicElement` 当字段字典空转）。**备选** `runQuery`→`DD03L`。**RFC** `DDIF_FIELDINFO_GET` 仅兜底（见 [reference.md](reference.md)）。
- **成熟方案参考**：团队级 CI/CD 可叠加 **abapGit**、流水线（Jenkins / GitHub Actions）与 **abapify/adt-cli**；本 Skill 聚焦「对话式代理 + **Eclipse ADT 同源 ADT REST**」闭环，可与上述方案并存。

## 前置条件

- **代理侧已按「阶段 0」自动部署并注册 MCP**（`abap-adt` 的 验证连通 通过）；若否，回到阶段 0 由**代理自己**完成构建/写 `.mcp.json`/启动代理，不把安装甩给用户。
- **用户侧**只需提供：SAP 开发账号（URL/USER/PASSWORD/CLIENT/LANGUAGE）、包/传输请求权限、对象创建与激活权限；系统级工具（Node ≥ 18、git、npm）缺失时由用户安装。
- **调用任一 MCP 工具前**，必须先阅读该工具的 **JSON schema**（`mcps/user-abap-adt/tools/<工具>.json`）或等价 descriptor，**参数名以 `required` 为准、禁止臆测**（易错示例见 [mcp-contract.md](mcp-contract.md)）。

### 外部依赖包（代理必须主动识别并提示安装）

本工作流使用 RFC 代理架构，涉及以下依赖。代理在阶段 0 探测到缺失时，必须明确告知用户缺失项及安装方式，不得跳过：

| 依赖 | 作用 | 安装方式 | 由谁负责 |
|------|------|---------|---------|
| **Node.js** (≥ 18) | 运行 MCP 服务器、RFC 代理和诊断脚本 | 官网下载或系统包管理器 | **用户**（系统级前提） |
| **SAP NW RFC SDK** (`nwrfcsdk`) | 提供 `sapnwrfc.dll` 等原生库，供 `node-rfc` 加载 | SAP 官网下载（需 S-User）或 Basis 提供 | **用户**（含原生 DLL，不可通过 npm 安装） |
| **`node-rfc`** | Node.js 封装层，调用 NW RFC SDK 实现 RFC 通信 | 已含在 `mcp-abap-abap-adt-api/package.json` 中，`npm install` 自动安装 | **代理**（自动） |
| **`abap-adt-api`** | HTTP ADT REST 客户端库，MCP 通过它构造 ADT 请求 | 已含在 `mcp-abap-abap-adt-api/package.json` 中，`npm install` 自动安装 | **代理**（自动） |
| **`@modelcontextprotocol/sdk`** | MCP 协议 SDK | 已含在 `mcp-abap-abap-adt-api/package.json` 中，`npm install` 自动安装 | **代理**（自动） |

**关键区分**：
- **用户必须手动安装**：Node.js 和 SAP NW RFC SDK。其中 NW RFC SDK 必须解压到工作区（如 `E:/ABAP工作流/NW-RFC-SDK/nwrfcsdk/`），且 Windows 系统环境变量 `SAPNWRFC_HOME` 和 `Path` 必须指向该目录（见 0.4.1「Windows 环境变量配置」）。
- **代理自动安装**：进入 `mcp-abap-abap-adt-api/` 执行 `npm install` 即可拉取 `node-rfc`、`abap-adt-api` 等全部 npm 依赖，无需用户干预。

**故障速查**：
- `The specified module could not be found: node.napi.node` → `node-rfc` 找不到 `sapnwrfc.dll`，**100% 是 NW RFC SDK 未安装或环境变量未设置**，与 npm 无关。
- `npm install` 报错 `node-rfc` 编译失败 → Node.js 版本过低（需 ≥ 18）或缺少 Python/VC++ 构建工具（Windows 下 `npm install --global windows-build-tools` 或安装 Visual Studio Build Tools）。

## 产物目录（按 FS/程序隔离；禁止全局混用）

> **硬性规则**：每个报表程序拥有自己独立的产物目录，以**程序名（大写）**为隔离键。多份 FS 并存时不得共用同一文件。

```
output/<program>/spec/
  functional-spec-raw.md          # 用户粘贴的 FS
  functional-spec-ai.md           # 规范化后的功能说明（见下节结构）
output/<program>/metadata/
  tables/<TABNAME>.json           # 每表一份字段与键信息
  performance-estimate.md         # 主表 COUNT 预估与分页建议
output/<program>/docs/
  tech-design.md                  # 表关系、取数逻辑、选择屏、ALV 要点
  fs-coverage.md                  # FS 字段与代码逐项对齐审查
  template-mapping.md             # 模板与新程序 INCLUDE 映射
  deployment-config.md            # 开发包、传输请求、程序名
  stage-gate.md                   # 该程序的阶段门禁状态
output/<program>/abap/sources/    # 生成的源码（主程序 + INCLUDE）
```

**示例**（程序名 `ZSAP_FI253`）：
```
output/ZSAP_FI253/spec/functional-spec-ai.md
output/ZSAP_FI253/metadata/tables/BKPF.json
output/ZSAP_FI253/metadata/performance-estimate.md
output/ZSAP_FI253/docs/tech-design.md
output/ZSAP_FI253/docs/fs-coverage.md
output/ZSAP_FI253/docs/template-mapping.md
output/ZSAP_FI253/docs/deployment-config.md
output/ZSAP_FI253/docs/stage-gate.md
output/ZSAP_FI253/abap/sources/
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
  - **首选**：`getObjectSource`，`objectSourceUrl` = `/sap/bc/adt/ddic/tables/<表名小写>/source/main`，将返回的 `source` 原文写入 `output/<program>/metadata/tables/<TABNAME>.json`（可另附解析出的字段数组）。
  - **备选**：`runQuery` 查询 `DD03L`（`AS4LOCAL = 'A'`），同样写入 JSON。
  - **兜底 RFC**：`DDIF_FIELDINFO_GET`；详见 [reference.md](reference.md)。
3. **失败补救是强制流程，不是可选项**：任一路径失败时必须自动切到下一兜底路径，直到三种路径均尝试完毕。禁止"报错即跳过"直接进入阶段 3/4。
4. 若某对象不是透明表或名称错误，记录到 `output/<program>/metadata/tables/_errors.md` 并回到 FS 修正或用户确认。
5. `output/<program>/metadata/tables/_errors.md` 必须包含：`对象名`、`已尝试路径`、`原始报错`、`下一步动作`（修正名 / 请求权限 / RFC 兜底），禁止只写一句"Internal server error"。
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
- **输出**：结果写入 `output/<program>/metadata/performance-estimate.md`，包含：表名、预估行数、WHERE 条件、量级分类、分页建议、索引分析。

**硬规则**：`performance-estimate.md` 未生成或主表数据量 `> 100万` 且无分页方案 → 阶段 3 必须包含分页设计，禁止直接生成无限制在线 ALV。

## 阶段 3：开发技术文档 `output/<program>/docs/tech-design.md`

在拥有全部 `output/<program>/metadata/tables/*.json` 后生成；**须以元数据为准**描述结构，且**必须**包含上文 **「字段契约」** 小节（FS 列 / 表.字段 / `output/<program>/metadata/tables/<TABNAME>.json` 溯源）。此外建议包含：

- **表清单与用途**（每张表对应哪个 JSON）
- **主外键与关联路径**（仅使用元数据中可见字段名；推断处标注假设）
- **取数逻辑**：主查询顺序、JOIN/WHERE 要点（每条条件字段指向契约行）
- **选择屏 ↔ 数据库** 映射表
- **ALV/布局** 与字段契约列顺序一致
- **待确认项**（标为 TBD，**不得**在阶段 4 无契约实现）

## 阶段 4：按模板创建程序（契约驱动，非创意驱动）

1. **前置检查**：进入阶段 4 前，代理必须确认 `output/<program>/docs/deployment-config.md` 已存在且包含：目标包、传输请求（非 `$TMP` 时）、参考模板路径、新程序名。**禁止**在未确认开发包/请求号的状态下直接调用 `createObject`。
2. **先打开** `output/<program>/docs/tech-design.md`（字段契约）与涉及的 `output/<program>/metadata/tables/*.json`，再动笔；**Open SQL、内表定义、LOOP 中使用的字段名**须与之一致。
3. **模板来源**：以阶段 3.6 确认的模板为骨架（用户指定模板 或 Skill 默认模板 `templates/reference/ZSAP_FI244/`）；**业务 SELECT/JOIN/WHERE** 不得与契约和元数据冲突。
4. **模板结构强约束**：若参考程序是"主程序 + INCLUDE 分层"（如 `xxxT01`/`xxxSEL`/`xxxF01`），新程序**源码生成阶段**必须保持同等分层（输出到 `output/<program>/abap/sources/`），以便审计与后续维护。
   > **⚠️ INCLUDE 部署限制（已知缺陷）**：当前 MCP `abap-adt` 的 `setObjectSource` 工具硬编码 `PROG/P`（可执行程序），**不能用于创建/更新 Include（`PROG/I`）**。若直接用 `setObjectSource` 上传 Include 名称，SAP 中实际创建的是同名的可执行程序，导致类型错位、后续激活/搜索/删除均异常。因此：
   > - **阶段 5 部署时**：使用**合并单文件**（`ZSAP_FIxxx_merged.abap`，将主程序与全部 INCLUDE 拼接为一个完整 REPORT）通过 `setObjectSource` 部署到**主程序名**上。
   > - **分层源码仍必须保留**在 `output/<program>/abap/sources/` 下，作为代码资产与后续人工拆分的基础。
5. 生成前必须先写 `output/<program>/docs/template-mapping.md`，至少列出：`参考对象`、`新对象`、`对应 INCLUDE 清单`、`保留/替换说明`，以便审计"确实参照了模板格式"。
6. **Eclipse ADT 侧同类操作在 MCP 中的顺序**（概念上）：`findObjectPath` / `createObject` → `lock` → `setObjectSource` → `syntaxCheckCode`。
   - `createObject` 时按 `deployment-config.md` 传入 `devclass`（包）与 `transport`（请求号）；若包为 `$TMP`，传输请求字段留空或按 MCP schema 要求处理。
7. 传输：`transport` / `transportReference` 按 MCP 工具要求传入。

## FS 对齐审查机制（新增，阶段 3.5，未通过禁止阶段 4）

在写代码前，必须生成 `output/<program>/docs/fs-coverage.md`，用于证明"FS 字段与代码实现逐项对齐"。

最少包含以下列：

| FS 逻辑项 | 输出字段/选择字段 | 契约字段（表.字段） | 元数据文件 | 代码落点 | 状态 |
|---|---|---|---|---|---|
| 例：会计年度 | GJAHR | BKPF.GJAHR | output/<program>/metadata/tables/BKPF.json | `...F01` SELECT | Done/TBD |

硬规则：

1. `functional-spec-ai.md` 中每个"输出列/选择条件"都必须在 `fs-coverage.md` 出现一行，不得遗漏。
2. `状态=Done` 必须给出代码落点（主程序或 INCLUDE 名称）；`状态=TBD` 必须给原因与处理计划。
3. 阶段 5 前必须做一次"反查"：从最终代码（SELECT 列、WHERE、ALV 列）回填到 `fs-coverage.md`，确认无"代码有但 FS 无"与"FS 有但代码无"。

## 阶段 3.6：开发包、传输请求与程序模板确认（新增，未通过禁止阶段 4）

在获得 `output/<program>/docs/fs-coverage.md` 对齐确认后、生成代码前，代理必须向用户确认以下三项，并落盘 `output/<program>/docs/deployment-config.md`：

### 3.6.1 开发包（Package）

- **询问用户**：目标开发包名称（如 `ZGD01`、`ZFI01`）。
- **若用户无法提供或留空**：默认使用 **`$TMP`（本地包）**，此时**无需传输请求**。
- **若用户提供了开发包**：代理须通过 `runQuery` 或 `searchObject` 验证该包在系统中是否存在、用户是否有写入权限。
  - 验证失败 → 回退到 `$TMP` 或请用户换包，记录到 `output/<program>/docs/deployment-config.md`。

### 3.6.2 传输请求（Transport Request）——仅非本地包时需要

- **若包 = `$TMP`**：跳过本节，传输请求字段留空。
- **若包 ≠ `$TMP`**：询问用户是否已有可用请求号。
  - **用户有请求号**：记录到 `output/<program>/docs/deployment-config.md`，代理在后续 `createObject`/`lock` 时按 MCP 要求传入。
  - **用户无请求号或要求新建**：代理通过 MCP 或引导用户在 SAP GUI 中创建传输请求。
    - **命名规则**：`ABAP_<功能名称>_<开发账号>_<YYYYMMDD>`
    - 例：功能名称为"序时账"、账号 `ITL12`、日期 `20260424` → `ABAP_序时账_ITL12_20260424`
    - 若系统不支持中文描述，转拼音或英文缩写，如 `ABAP_Journal_ITL12_20260424`。
    - 创建后记录请求号到 `output/<program>/docs/deployment-config.md`。

### 3.6.3 程序模板选择

- **询问用户**：是否有现有报表程序作为模板参考（提供程序名，如 `ZSAP_FI244`）。
  - **用户提供了模板**：代理通过 `getObjectSource` 拉取该程序源码（含全部 INCLUDE），保存到 `templates/reference/<程序名>/`，并在 `output/<program>/docs/template-mapping.md` 中列出模板与新程序的 INCLUDE 对应关系。
  - **用户未提供模板**：使用 Skill 包内置的**默认模板** `output/ZSAP_FI244/abap/sources/`（标准主程序 + `T01`/`SEL`/`F01` 三层 INCLUDE 结构）。代理须将该目录复制到 `templates/reference/ZSAP_FI244/` 作为本次参考基线。
- **模板结构强约束**：无论使用用户模板还是默认模板，新程序必须保持同等的 INCLUDE 分层结构（`xxxT01`、`xxxSEL`、`xxxF01`），不得退化为单文件大程序（除非用户明确要求简化）。

### 3.6.4 输出产物

`output/<program>/docs/deployment-config.md` 至少包含：

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

**硬规则**：`output/<program>/docs/deployment-config.md` 未生成或开发包/请求号状态不明 → **禁止**进入阶段 4。

## 阶段门禁产物验证（新增）

每阶段完成后必须落盘 `output/<program>/docs/stage-gate.md` 并打勾，未打勾禁止进入下一阶段。

- 阶段 1 门禁：`output/<program>/spec/functional-spec-ai.md` 存在且包含选择条件/输出列/透明表清单。
- 阶段 2 门禁：每张透明表对应 `output/<program>/metadata/tables/<TAB>.json` 或 `_errors.md` 有完整补救记录；`output/<program>/metadata/performance-estimate.md` 已生成（阶段 2.5）。
- 阶段 3 门禁：`output/<program>/docs/tech-design.md` + `output/<program>/docs/fs-coverage.md` + `output/<program>/docs/template-mapping.md` 完整。
- 阶段 3.6 门禁：`output/<program>/docs/deployment-config.md` 已生成，开发包/请求号/模板状态明确。
- 阶段 4 门禁：代码结构与模板映射一致（含 INCLUDE 清单）。
- 阶段 5 门禁：`syntaxCheck` 通过、激活结果记录（成功或达到重试上限）。
- 阶段 5.5 门禁：`output/<program>/docs/smoke-test.md` 已生成且通过最低验证。

`output/<program>/docs/stage-gate.md` 建议固定格式（避免代理误判）：

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
2. **INCLUDE 对象的部署限制**：
   - **禁止**用 `setObjectSource` 直接上传 Include 名称（如 `ZxxxT01`、`ZxxxSEL`、`ZxxxF01`），因为该工具硬编码 `PROG/P`，会把 Include 创建为同名的可执行程序，造成类型错位。
   - **正确做法**：将主程序与所有 Include 拼接为**合并单文件**（`ZSAP_FIxxx_merged.abap`，保持 `REPORT` + `INCLUDE` 语句完整），通过 `setObjectSource` 部署到**主程序名**上。SAP 系统在编译主程序时会自动解析其中的 `INCLUDE` 语句并在本地创建对应的 Include 对象（类型为 `PROG/I`）。
   - 若需要显式激活 Include，当前 `ActivateObjects`（`ActivateObjectLow`）对 `PROG/I` 的支持存在缺陷：其内部 `buildObjectUri` 缺少 `PROG/I` → `/sap/bc/adt/programs/includes/{name}` 的映射，会生成错误的 URI（`/sap/bc/adt/prog/i/...`），导致 ADT 返回 "No suitable resource"。**因此现阶段只需激活主程序即可**；主程序激活时，系统会自动处理其引用的 Include。
3. 若失败：解析返回中的 **消息/日志**（含行号、对象名），**分类处理**：
  - 语法/拼写 → 改源码后 `setObjectSource`，再 `syntaxCheckCode`。
  - 依赖未激活 → 先激活依赖对象或调整顺序。
  - 锁/传输问题 → `unLock`、换请求或协调。
4. 重复直至激活成功；可用 `inactiveObjects` 复核。
5. **上限**：同一错误无进展重复超过约定次数（如 5 次）则停止自动重试，输出摘要请用户决策。

## 阶段 5.5：冒烟测试（新增，激活后强制）

激活通过 ≠ 程序可用。在标记 `S5=activated: yes` 前，代理必须执行至少以下验证之一（按系统权限从易到难）：

1. **语法与结构验证**（最低要求，总能执行）：
   - 通过 `getObjectSource` 拉取激活后的源码，确认 `setObjectSource` 写入的代码与系统内一致（防止激活覆盖或截断）。
   - 核对源码中是否包含字段契约中所有 `状态=Done` 的字段。

2. **执行探针**（若系统允许 `SUBMIT` 或后台执行）：
   - 用 `runQuery` 或 MCP 等价工具执行一次带最严格选择条件的查询，验证 WHERE 条件在真实数据上是否返回非空结果。
   - 若返回 0 行 → 不一定是错误，但必须在 `output/<program>/docs/smoke-test.md` 中标注"选择条件过严可能导致空输出"。

3. **ALV 列核对**（从源码静态分析）：
   - 检查 `gt_fieldcat` 或 `slis_t_fieldcat_alv` 的赋值语句，确认列数与 `fs-coverage.md` 中 `状态=Done` 的行数一致。
   - 发现"代码有但 FS 无"的列 → 回填到 `fs-coverage.md` 并标注 `状态=Unexpected`。

**输出**：`output/<program>/docs/smoke-test.md`，包含：测试项、执行方式、结果、异常列说明。`smoke-test.md` 未生成 → 禁止标记 `S5=activated: yes`。

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
- [ ] 阶段 0：abap-adt MCP 自动安装完成（入口路径真实存在）
- [ ] 阶段 0：.env 已生成且包含真实 SAP 连接信息（URL/CLIENT/USER/PASSWORD/SID/SYSNR/ROUTER/TYPE）
- [ ] 阶段 0：`.mcp.json` 的 abap-adt 条目已就绪（仅含代理地址 `SAP_URL=http://localhost:9876` + DLL 路径；不含 SAP 凭据；args[0] 指向 dist/index.js；RFC 场景 rfc-proxy-server.js 已启动；Windows 用 node.exe 绝对路径）
- [ ] 阶段 0：RFC 底层验证通过（`node scripts/test_rfc.js` 成功；仅 RFC 场景，禁止跳过）
- [ ] 阶段 0：验证连通通过（重启后实测）
- [ ] 阶段 0.9：权限前置探测通过（S_DEVELOP / 包权限 / 传输请求）
- [ ] output/<program>/spec/functional-spec-ai.md 结构完整
- [ ] 每张透明表均有 metadata JSON（阶段 2 产物）
- [ ] output/<program>/metadata/tables/_errors.md 对失败对象包含"尝试路径 + 原始报错 + 下一步动作"
- [ ] output/<program>/metadata/performance-estimate.md 已生成（主表 COUNT + 量级分类 + 分页建议）
- [ ] output/<program>/docs/tech-design.md 含「字段契约」且与 metadata 一致
- [ ] output/<program>/docs/fs-coverage.md 已覆盖 FS 全量字段（含 Done/TBD）
- [ ] output/<program>/docs/deployment-config.md 已生成（包/请求号/模板/新程序名）
- [ ] output/<program>/docs/template-mapping.md 已证明新程序结构对齐参考模板（含 INCLUDE）
- [ ] output/<program>/docs/stage-gate.md 每阶段门禁已打勾（含 S0/S2.5/S3.6/S5.5）
- [ ] Open SQL / 内表字段均可追溯到契约与 metadata（无凭空字段）
- [ ] 源码已 syntaxCheckCode
- [ ] 激活成功或达到重试上限并记录原因
- [ ] output/<program>/docs/smoke-test.md 已生成且通过最低验证（源码一致 / 执行探针 / ALV 列核对）
- [ ] （推荐）每阶段产物已 git commit
```

## 延伸阅读

- RFC 参数、Eclipse ADT / ADT REST 与 abapify CLI 要点：[reference.md](reference.md)
- **MCP 参数契约与易错点**（读 schema、禁止猜参数名）：[mcp-contract.md](mcp-contract.md)

## 附录：RFC 直连 ADT REST 部署模式（SADT_REST_RFC_ENDPOINT）

当 `SAP_CONNECTION_TYPE=rfc` 时，底层通过 RFC 函数模块 `SADT_REST_RFC_ENDPOINT` 将 ADT REST 请求转发到 SAP 内部的 ADT REST 服务。这是 Eclipse ADT（通过 JCo）使用的**同一机制**，所有与 Eclipse ADT 同源的操作均支持。

### 调用方式选择（硬约束）

| 场景 | 正确方式 | 说明 |
|------|---------|------|
| **代码部署**（创建/修改/激活程序） | `SADT_REST_RFC_ENDPOINT` + **ADT REST API** | 与 Eclipse ADT 同源，所有 SAP 系统均支持 |
| **数据字典查询**（表结构） | `DDIF_FIELDINFO_GET` **直接调用** | 标准 SAP FM，可直接 RFC 调用 |
| **表数据读取**（COUNT/采样） | `RFC_READ_TABLE` **直接调用** | 标准 SAP FM，可直接 RFC 调用 |

**硬约束**：
- `INSERT_REPORT` **不是 SAP 标准函数模块**，在部分系统上不存在。**所有代码部署必须**通过 `SADT_REST_RFC_ENDPOINT` 调用 ADT REST API。
- `DDIF_FIELDINFO_GET`、`RFC_READ_TABLE` 是 SAP 标准 FM，可直接通过 `node-rfc`/`sap-rfc-lite` 调用，无需走 ADT REST 转发。

### SADT_REST_RFC_ENDPOINT 请求/响应结构

```javascript
const result = await client.call('SADT_REST_RFC_ENDPOINT', {
  REQUEST: {
    REQUEST_LINE: { METHOD: 'POST', URI: '/sap/bc/adt/programs/programs', VERSION: 'HTTP/1.1' },
    HEADER_FIELDS: [
      { NAME: 'Content-Type', VALUE: 'application/vnd.sap.adt.programs.programs.v4+xml' },
      { NAME: 'Accept', VALUE: 'application/vnd.sap.adt.programs.programs.v4+xml' },
    ],
    MESSAGE_BODY: Buffer.from(xmlBody, 'utf-8'),
  },
});

const resp = result.RESPONSE;
const statusCode = parseInt(
  resp.STATUS_LINE?.STATUS_CODE || resp.STATUS_LINE?.CODE || '0', 10
);
const body = resp.MESSAGE_BODY
  ? (Buffer.isBuffer(resp.MESSAGE_BODY) ? resp.MESSAGE_BODY.toString('utf-8') : String(resp.MESSAGE_BODY))
  : '';
```

### 关键 ADT REST 端点（程序管理）

| 操作 | 方法 | URI | Content-Type |
|------|------|-----|-------------|
| 创建程序 | POST | `/sap/bc/adt/programs/programs` | `application/vnd.sap.adt.programs.programs.v4+xml` |
| Lock | POST | `/sap/bc/adt/programs/programs/{name}?_action=LOCK&accessMode=MODIFY` | `application/vnd.sap.as+xml` |
| 上传源码 | PUT | `/sap/bc/adt/programs/programs/{name}/source/main?lockHandle={handle}` | `text/plain; charset=utf-8` |
| Unlock | POST | `/sap/bc/adt/programs/programs/{name}?_action=UNLOCK&lockHandle={handle}` | `application/vnd.sap.as+xml` |
| 激活 | POST | `/sap/bc/adt/activation?method=activate&preauditRequested=true` | `application/vnd.sap.adt.activation+xml` |

### 程序类型映射

| 类型 | 代码 |
|------|------|
| executable（可执行程序） | `1` |
| include（包含程序） | `I` |
| module pool | `M` |
| function group | `F` |
| class pool | `K` |
| interface pool | `J` |

### 故障排查速查表

| 症状 | 根因 | 解决 |
|------|------|------|
| 创建程序报 **404** | URI 拼写错误或程序名大小写问题 | 确认 URI 为 `/sap/bc/adt/programs/programs`；程序名在 URI 中统一使用**小写** |
| 创建程序报 **406** | `Accept` 或 `Content-Type` 头不匹配 | 对照上表使用正确的 MIME 类型；可用 Discovery（`GET /sap/bc/adt/discovery`）确认系统支持的类型 |
| 创建程序报 **409** | 程序已存在 | 正常情况，跳过创建直接执行 Lock + 上传 |
| 上传源码报 **400/403** | `lockHandle` 缺失、过期或编码问题 | 重新 Lock 获取新 handle；确保 `lockHandle` 已 URL-encode |
| 激活失败 | 语法错误或依赖对象未激活 | 先修正源码语法；检查 INCLUDE 是否已上传并解锁 |
| `setObjectSource` 上传 Include 后，SAP 里按 Include 搜索不到 | `setObjectSource` 硬编码 `PROG/P`，把 Include 创建成了同名的**可执行程序** | **禁止**用 `setObjectSource` 直接传 Include 名称；改用**合并单文件**部署到主程序，让 SAP 自动解析 `INCLUDE` 语句创建 `PROG/I` |
| `ActivateObjects` 对 `PROG/I` 返回 "No suitable resource" | `buildObjectUri` 缺少 `PROG/I` 映射，生成错误 URI `/sap/bc/adt/prog/i/...` | 不单独激活 Include，只激活主程序；主程序激活时系统会自动处理其引用的 Include |
| 调用 `INSERT_REPORT` 报"函数不存在" | 使用了非标准 FM | **禁止**使用 `INSERT_REPORT`，改用 `SADT_REST_RFC_ENDPOINT` + ADT REST API |
| `STATUS_LINE` 无 `STATUS_CODE` | 部分系统返回字段名不同 | 兼容解析：`STATUS_CODE` 优先， fallback 到 `CODE` |

### 参考实现（脚本库使用指南）

> **脚本库原则**：只保留 4 个独立脚本，职责单一、无重复。所有脚本统一读取 `.env`，产出按 `output/<program>/` 隔离。

| 脚本 | 用途 | 调用方式 | 产出路径 |
|------|------|---------|---------|
| `scripts/test_rfc.js` | RFC 环境诊断（DLL、连接、PING） | `node scripts/test_rfc.js` | 仅控制台输出，不写文件 |
| `scripts/fetch_metadata.js` | 批量拉取透明表 DDIC 元数据 | `node scripts/fetch_metadata.js [program]` | `output/<program>/metadata/tables/<TAB>.json` |
| `scripts/perf_estimate.js` | 主表 COUNT 预估与性能建议 | `node scripts/perf_estimate.js [program]` | `output/<program>/metadata/performance-estimate.md` |
| `scripts/deploy_rfc.js` | RFC 直连 ADT REST 部署程序 | `node scripts/deploy_rfc.js`（程序名在脚本内配置） | 读取 `output/<progName>/abap/sources/` 下源码，写入 SAP |

**参数说明**：
- `[program]`：可选，程序名（如 `ZSAP_FI253`）。缺省时依次读取 `process.argv[2]`、`SAP_PROGRAM` 环境变量、默认值 `ZSAP_FI253`。
- 所有脚本均从 `.env` 读取 SAP 连接参数，**无需在脚本内硬编码**。

**已删除脚本**：`scripts/setup-rfc-env.ps1`（功能与 `test_rfc.js` 完全重复，不再维护）。

## 迁移到其他环境

### Claude Code 统一架构

本 Skill 使用单一 MCP 实现（`mcp-abap-abap-adt-api`），通过本地代理层适配不同网络环境：

| 场景 | 连接方式 | 代理层 |
|------|---------|--------|
| 内网 + SAP Router | RFC (`SADT_REST_RFC_ENDPOINT`) | `rfc-proxy-server.js`（自动设置 `SAPNWRFC_HOME` + PATH） |
| 公网 / 无 Router | HTTP ADT (`/sap/bc/adt/`) | 无代理，直接连接 SAP |

- **构建命令**：`cd mcp-abap-abap-adt-api && npm install && npm run build`。
- **RFC 场景**：工作目录需包含 `.env`（`SAP_CONNECTION_TYPE=rfc`、`SAP_ROUTER=/H/...`）和 `NW-RFC-SDK/`，先启动 `node rfc-proxy-server.js`，再将 `.mcp.json` 的 `SAP_URL` 设为 `http://localhost:9876`。
- **自动检查**：复制 Skill 后先运行 `node scripts/test_rfc.js` 检查环境，再调用 MCP 验证连通 验证连接。

- **其他 Claude Code 用户**：复制本 Skill 整个目录到对方仓库的 `.claude/skills/sap-report-automation-workflow/`（或到 `~/.claude/skills/` 作为全局 Skill）。新环境首次触发时，**代理按阶段 0 自动**构建 MCP、合并 `.mcp.json`、启动代理、收集 SAP 凭据、提示重启后 验证连通——**不要求对方手动装 MCP**。RFC 场景仍需用户安装 NW RFC SDK。
- **Cursor**：使用仓库内 `.cursor/skills/sap-report-automation-workflow/`，配置写入 `.cursor/mcp.json`。
- **OpenClaw**：使用仓库内 `openclaw/skills/sap_report_automation_workflow/`，复制到 `~/.openclaw/skills/` 或工作区 skills 目录后重启 gateway / `openclaw skills list` 校验；MCP 侧仍由代理按阶段 0 自动安装 Node 版 server，在 OpenClaw/宿主侧注册同一入口（具体 MCP 配置方式以 OpenClaw 当前文档为准）。

---

## 附录：INCLUDE 部署已知缺陷与根因记录（技术债务）

> 记录时间：2026-04-27 | 影响范围：阶段 4（代码生成）与阶段 5（部署激活）

### 问题描述

当参考模板采用"主程序 + INCLUDE 分层"（如 `ZxxxT01`/`ZxxxSEL`/`ZxxxF01`）时，**不能**像 Eclipse ADT 那样分别创建/更新主程序和各个 Include。当前 MCP 工具链存在两处缺陷，导致直接用 Include 名称调用部署工具会产生**类型错位的对象**（在 SAP 中创建为 `PROG/P` 而非 `PROG/I`），进而引发激活失败、搜索不到、删除异常等一系列连锁问题。

### 根因分析

#### 根因 1：`setObjectSource` 透传 `objectSourceUrl`，调用方若传入程序 URI 则创建为 `PROG/P`

- **位置**：`mcp-abap-abap-adt-api/src/handlers/ObjectSourceHandlers.ts:77-82` → `abap-adt-api/build/api/objectcontents.js:23-38`
- **行为**：`setObjectSource` 完全透传 `objectSourceUrl`，本身不做对象类型校验。若调用方（部署脚本/SKILL）在更新 Include 时传入 `/sap/bc/adt/programs/programs/{name}`，则 SAP 中实际创建的是同名可执行程序 `PROG/P`，而非 Include `PROG/I`。该对象在 SAP 中按 Include 搜索搜不到，按程序搜索能搜到但删除也可能出问题。

#### 根因 2：`activate` 在 `abap-adt-api` 中缺少 `PROG/I` 的 URI 映射

- **位置**：`mcp-abap-abap-adt-api/node_modules/abap-adt-api/build/api/activate.js`
- **行为**：`abap-adt-api` 的 `activate` 函数在处理对象引用时，对 `PROG/I` 类型未做正确映射。当通过 `activateObjects` 传入 `{"type": "PROG/I", "name": "ZxxxT01"}` 时，可能生成错误 URI 或无法被 ADT 识别。
- **后果**：单独激活 Include 对象时，ADT 返回 `No suitable resource found` 或类似错误。

#### 根因 3：`AdtClient`（abap-adt-api）没有 `getInclude()` 写入客户端

- **位置**：`mcp-abap-abap-adt-api/node_modules/abap-adt-api/build/AdtClient.js`
- **行为**：`abap-adt-api` 的 `AdtClient` 只暴露了 `getProgram()`、`getClass()`、`getInterface()` 等，**没有 `getInclude()`**。虽然 `abap-adt-api` 底层支持读取 Include 源码，但缺少对 Include 的 lock / update / create 封装。
- **后果**：MCP 中不存在 `UpdateInclude` 或 `CreateInclude` 工具。

### 当前 workaround（合并单文件部署）

1. **阶段 4 仍生成分层源码**：主程序 + T01 / SEL / F01 分别输出到 `output/<program>/abap/sources/`，保持代码结构与模板一致，便于审计和维护。
2. **阶段 5 使用合并文件**：将主程序与所有 Include 按正确顺序拼接为一个完整文件（`ZSAP_FIxxx_merged.abap`），保留所有 `INCLUDE` 语句。
3. **通过 `setObjectSource` 部署到主程序名**：上传合并文件到主程序（如 `ZSAP_FI253`）。SAP 编译主程序时，会自动解析源码中的 `INCLUDE ZSAP_FI253T01.` 等语句，在本地创建对应的 `PROG/I` 对象。
4. **只激活主程序**：主程序激活时，系统会自动处理其引用的 Include，无需（也无法）单独激活 Include。

### 若要彻底修复 MCP

需要在 `abap-adt-api` 包和 MCP handler 层做以下改动：

1. **修复 `buildObjectUri`**：在 `activationUtils.js` 中添加：
   ```javascript
   case 'PROG/I':
       return `/sap/bc/adt/programs/includes/${lowerName}`;
   ```
2. **新增 `UpdateInclude` handler**：仿照 `setObjectSource`，但使用 `/sap/bc/adt/programs/includes/{name}` 端点进行 lock / update / activate。
3. **新增 `CreateInclude` handler**：用于显式创建 Include 对象（POST `/sap/bc/adt/programs/includes`）。

### 相关 ADT REST 端点（供未来实现参考）

| 操作 | 对象类型 | ADT URI |
|------|---------|---------|
| 读取 Include 源码 | `PROG/I` | `GET /sap/bc/adt/programs/includes/{name}/source/main` |
| 写入 Include 源码 | `PROG/I` | `PUT /sap/bc/adt/programs/includes/{name}/source/main?lockHandle={handle}` |
| 锁定 Include | `PROG/I` | `POST /sap/bc/adt/programs/includes/{name}?_action=LOCK&accessMode=MODIFY` |
| Include 对象 URI | `PROG/I` | `/sap/bc/adt/programs/includes/{name}` |
| 可执行程序对象 URI | `PROG/P` | `/sap/bc/adt/programs/programs/{name}` |
