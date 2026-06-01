---
name: sap-report-automation-workflow
version: 1.2
description: |
  End-to-end SAP ABAP 开发对象自动化（与 Eclipse ADT 能力对齐）：通过本地 RFC 代理将 HTTP ADT REST 请求转译为 RFC SADT_REST_RFC_ENDPOINT 调用 SAP；支持 **REPORT 报表**、**CLASS 类池**、**FUGR 函数组 / Function Module**、**INTF 接口**、**Include** 等全部常见 ABAP 开发对象类型。FS 规范化、透明表 DDIC、技术文档、按模板写 ABAP、激活循环；Open SQL 与内表字段必须由 metadata 驱动、禁止脱离元数据自由发挥。触发场景：用户要写 ABAP 代码（报表/类/函数/接口/增强）、从 FS 到部署、切换 SAP、配置或安装 MCP、login 失败。**MCP 未就绪时代理必须自动 npm build + 写 .mcp.json + 启动 rfc-proxy-server，不得把安装推给用户**。GitHub MCP：https://github.com/mario-andreschak/mcp-abap-abap-adt-api

  语法速查（多版本兼容）：内置 [abap-syntax-quickref.md](abap-syntax-quickref.md)，覆盖 ECC → S4HANA → Cloud 全谱系，每个模式标注最低版本要求。阶段 4 写代码时作为**硬约束**参考，禁止凭记忆写语法。完整语法追查 [SAP-samples/abap-cheat-sheets](https://github.com/SAP-samples/abap-cheat-sheets)。

  卡点速查：多轮实战沉淀的常见阻塞与提速方案见 [troubleshooting.md](troubleshooting.md)——代理在任一阶段受阻（MCP 不通、元数据拉取慢、表名混淆报错、激活失败等），**必须先查阅该文件**按"预判→预防→应对"处理，再继续。
---

# SAP ABAP 开发对象自动化工作流（FS → 元数据 → 设计文档 → 代码 → 激活）

支持对象类型（由阶段 1.5 确认）：**REPORT**（可执行报表）、**CLAS**（类池/全局类）、**FUGR**（函数组含 Function Module）、**INTF**（接口）、**PROG/I**（Include）。

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

**受阻即查**：以上任一步骤遇到阻塞、报错或反复重试无进展，**必须先打开 [troubleshooting.md](troubleshooting.md)** 按阶段查找对应的"预判→预防→应对"方案，再继续。不得在卡点反复重试消耗配额。

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

**新增：部署前禁止项**

- **禁止**在未通过 5.0 程序名存在性检查前调用 `scripts/deploy_rfc.js` 或任何 MCP 写操作。
- **禁止**将脚本中的 `process.exit(1)`（程序已存在时的终止行为）改为 `console.log` 警告并继续执行。
- **禁止**代理擅自修改程序名（如在末尾追加 `A`/`1`）来绕过已存在检查。

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

> **关键认知**：`SAP_URL` 必须填 `http://localhost:9876`（**不是** SAP 真实地址）。MCP 发送的 HTTP ADT REST 请求先到本地 `rfc-proxy-server.js`，再由代理通过 `node-rfc` → `SADT_REST_RFC_ENDPOINT` 转发到 SAP。真实 SAP 地址（`http://<your-sap-host>:8000`）和凭据由代理从 `.env` 读取，**不要**填到 `.mcp.json` 中。
>
> `SAPNWRFC_HOME` 和 `PATH` 在 `.mcp.json` 中必须设置，确保 MCP 子进程能加载 `sapnwrfc.dll`（代理启动时会在进程内设置这些变量）。

### 0.4 收集 SAP 连接信息（**唯一**允许打断流程的环节）

代理必须一次性向用户索要全部连接信息（缺啥问啥，不要每次只问一个字段）。**支持两种输入方式**：

- **方式 A（推荐）**：用户直接在对话中给出信息 → 代理使用 Write 工具直接生成 `.env`（按下方字段清单）并合并 `.mcp.json`。
- **方式 B**：用户手动编辑 `.env` → 代理读取验证，缺失项再追问。

**必须收集的字段**：

| 字段 | 说明 | 示例 |
|------|------|------|
| `SAP_URL` | SAP 应用服务器 IP/域名 + 端口 | `http://<your-sap-host>:8000` |
| `SAP_CLIENT` | 登录客户端 | `200` |
| `SAP_USERNAME` | 开发账号 | `<username>` |
| `SAP_PASSWORD` | 开发密码 | `********` |
| `SAP_LANGUAGE` | 登录语言，默认 `ZH` | `ZH` |
| `SAP_SID` | 系统标识（用于传输请求命名、诊断） | `EE0` |
| `SAP_SYSNR` | 实例编号（从端口 80XX 推导或用户给出） | `00` |
| `SAP_ROUTER` | SAP Router 字符串（RFC 内网场景必填） | `<router-string>` |
| `SAP_CONNECTION_TYPE` | `rfc`（推荐，支持 Router）或 `http` | `rfc` |

**自动推导规则**：
- 若 URL 为 `http://host:80XX`，默认 `SAP_SYSNR = XX`；用户显式给出时以用户为准。
- 若 `SAP_CONNECTION_TYPE = rfc` 且存在 `NW-RFC-SDK/nwrfcsdk/lib/sapnwrfc.dll`，代理**必须先启动** `rfc-proxy-server.js`（设置 `SAPNWRFC_HOME` + PATH），再将 `.mcp.json` 的 `SAP_URL` 指向 `http://localhost:9876`。

**写入动作（代理执行，不交给用户）**：

1. 生成 `.env`（含 `SAP_SID`、`SAP_SYSNR`、`SAP_ROUTER`）。
2. 若项目级 `.mcp.json` 存在 → 合并 `mcpServers` 条目；若不存在 → 直接生成。
3. 写入后调用 `node scripts/test_rfc.js` 做一次性校验，输出诊断。

### 0.4.1 RFC 连接稳定性指南（Windows 必看；内网 + SAP Router 场景）

RFC 连接在正确配置后是**稳定的**。以下方案是从实战中固化下来的**唯一正确路径**，用于解决初次配置时的环境问题；配置完成后 RFC 长连接稳定，无需过度担心。

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

## 模板程序目录约定

> **两个模板位置，用途不同，不要混淆。**

```
项目根目录
├── templates/
│   └── reference/                    ← 阶段 4 代码模板（ABAP 源码骨架）
│       ├── ZSAP_FI244/               REPORT 参考模板（已有用户程序）
│       │   ├── ZSAP_FI244.abap          主程序
│       │   ├── ZSAP_FI244T01.abap       TOP Include
│       │   ├── ZSAP_FI244SEL.abap       选择屏幕
│       │   └── ZSAP_FI244F01.abap       FORM 子程序
│       ├── ZCL_SKELETON/             CLASS 预置骨架
│       │   └── ZCL_SKELETON.clas.abap   类定义 + 实现（单文件）
│       ├── ZIF_SKELETON/             INTF 预置骨架
│       │   └── ZIF_SKELETON.intf.abap   接口定义（单文件）
│       └── ZFG_SKELETON/             FUGR 预置骨架
│           ├── ZFG_SKELETON.fugr.abap   函数组主文件
│           └── ZFM_SKELETON.fm.abap     Function Module
│
├── output/                           ← 阶段产出物（按对象名隔离）
│   └── <OBJECT_NAME>/
│       ├── spec/                     S1 功能规格
│       ├── metadata/tables/          S2 表元数据
│       ├── docs/                     S3 技术文档
│       └── abap/                     S4 生成的源码（部署前）
│
└── .claude/skills/sap-report-automation-workflow/templates/
    └── functional-spec-ai.md         ← S1 FS Markdown 模板（非 ABAP 代码）
```

**规则**：
- **ABAP 代码模板** → 放在 `templates/reference/<对象名>/`（项目根目录），子目录名为对象名大写
- **FS Markdown 模板** → 放在 skill 内部的 `.claude/skills/.../templates/`，与 ABAP 代码无关
- 用户可以把自己的参考程序通过 `getObjectSource` 拉取后放入 `templates/reference/`；代理在阶段 3.6 优先搜索此目录
- `output/` 只放产物，**不放模板**

### output/ 产物目录结构（按对象名隔离）

语法用 `<object>` 统一指代目标开发对象名。

```
output/<object>/
├── spec/
│   ├── functional-spec-raw.md      " 用户粘贴的原始 FS
│   └── functional-spec-ai.md       " 规范化后的功能说明
├── metadata/
│   ├── tables/<TABNAME>.json       " 每表一份字段与键信息
│   ├── tables/_errors.md           " 失败对象 + 补救记录
│   └── performance-estimate.md     " 主表 COUNT 预估与分页建议
├── docs/
│   ├── tech-design.md              " 表关系、取数逻辑、字段契约
│   ├── fs-coverage.md              " FS 字段与代码逐项对齐
│   ├── template-mapping.md         " 模板与新对象 INCLUDE 映射
│   ├── deployment-config.md        " 开发包、传输请求、对象名
│   ├── stage-gate.md               " 阶段门禁状态
│   └── smoke-test.md               " S5.5 冒烟测试结果
└── abap/                           " 生成的源码（部署前）
    ├── <name>.abap                 " REPORT: 主程序
    ├── <name>T01.abap              " REPORT: TOP Include
    ├── <name>SEL.abap              " REPORT: 选择屏幕
    ├── <name>F01.abap              " REPORT: FORM 子程序
    ├── <name>.clas.abap            " CLASS: 类定义+实现（单文件）
    ├── <name>.intf.abap            " INTF: 接口定义（单文件）
    ├── <name>.fugr.abap            " FUGR: 函数组主文件
    └── <fm_name>.fm.abap           " FUGR: Function Module
```

## 阶段 1：获取 FS → 规范化为 AI 可读的功能文件

### 1.0 获取 FS 来源（代理主动询问）

用户触发工作流后，代理第一件事是**主动询问 FS 来源**，支持以下方式：

| 方式 | 用户操作 | 代理行为 |
|------|---------|---------|
| **A. 粘贴文本** | 直接在对话中粘贴 FS 内容 | 写入 `output/<object>/spec/functional-spec-raw.md` |
| **B. 提供文件路径** | 给出 `.docx` / `.txt` / `.md` 文件路径 | 读取文件：`.docx` 走 `scripts/extract-docx.js`；`.txt`/`.md` 直接读 |
| **C. 提供文件夹** | 给出包含多个 FS 文件的目录 | 列出目录内容，让用户选择要处理哪个 |
| **D. 口头描述** | 用户用自然语言描述需求（无文档） | 代理直接生成 `functional-spec-ai.md`，标注 `来源=口头描述` |

**询问模板**（代理据此发问，一次问完，不要逐条追问）：

```
请提供功能说明书（FS），支持以下方式：
A. 直接粘贴 FS 文本
B. 提供 FS 文件路径（支持 .docx / .txt / .md）
C. 提供 FS 文件夹路径（我将列出文件供你选择）
D. 口头描述需求（无需文档）
```

阶段 1.5 确定对象名之前，FS 内容存放在 `output/<object>/spec/`（对象名确认后创建）。用户可按自己习惯管理原始 FS 文件，不做强制路径约束。

### 1.1 规范化 FS

将 FS 整理为 `functional-spec-ai.md`，可直接套用 [templates/functional-spec-ai.md](templates/functional-spec-ai.md)；**必须**包含下列区块（缺失则向用户追问）：

1. **业务目标与对象类型**（REPORT / CLASS / INTF / FUGR / FM）
2. **选择条件**（REPORT 类型）：字段、是否区间、是否必输、默认值、与表字段对应关系
3. **接口/方法签名**（CLASS / INTF / FUGR 类型）：方法名、参数、返回值、异常
4. **输出列**：字段、来源表/字段、计算或转换规则
5. **透明表与用途**：列出所有 `T`* 或明确透明表名；标注主从关系（若 FS 已写）
6. **权限、性能、变式**等约束

用稳定标题与列表，避免冗长叙述；表名一律 **大写**。

## 阶段 1.5：对象名确认与 SAP 存在性检查（硬门禁；所有对象类型通用）

> **位置**：`functional-spec-ai.md` 已确认、但 **尚未创建 `output/<object>/` 任何目录和文件** 之前。
> **目的**：避免生成全套产物后才发现对象名冲突，导致全部重做或误覆盖。
> **适用范围**：REPORT、CLAS、FUGR、INTF 等所有 ADT 可创建的 ABAP 开发对象。

### 1.5.1 确定对象类型与命名规则

代理从 `functional-spec-ai.md` 或用户指令中提取目标对象信息：

| 对象类型 | ADT 类型码 | 命名约定 | 示例 |
|---------|-----------|---------|------|
| 可执行报表（Report） | `PROG/P` | `ZSAP_xxxx` / `ZFI_xxxx` | `ZSAP_FI086` |
| Include | `PROG/I` | `ZSAP_xxxxT01` / `ZSAP_xxxxF01` | `ZSAP_FI086T01` |
| 全局类（Class） | `CLAS` | `ZCL_xxxx` | `ZCL_FI_UTILITY` |
| 函数组（Function Group） | `FUGR` | `ZFG_xxxx` | `ZFG_FI_TOOLS` |
| 接口（Interface） | `INTF` | `ZIF_xxxx` | `ZIF_FI_DATA_ACCESS` |

- 若用户未显式指定对象名 → 代理根据 FS 功能语义推荐命名（遵循上表约定），**必须向用户确认**。
- 若用户已指定 → 直接采用，但仍需执行下一步存在性检查。

### 1.5.2 立即执行 SAP 存在性检查（**禁止跳过**）

对象名一经确认，代理**必须立即**通过 MCP `searchObject` 查询 SAP 系统：

1. **主对象**：`searchObject` 查询主对象名（如 `ZSAP_FI086` 或 `ZCL_FI_UTILITY`）。
2. **关联子对象**（仅 REPORT 类型）：`searchObject` 查询 `${name}T01`、`${name}SEL`、`${name}F01`。
3. **类池 Include**（仅 CLAS 类型）：类创建时系统自动生成 `CCDEF`/`CCIMP`/`CCAU` 等 Include，**不需单独检查**。

**查询结果处理**：

| 结果 | 动作 |
|------|------|
| 主对象或任一关联子对象 **已存在** | **立即停止**，向用户报告对象名、类型、所属包、描述。必须让用户**重新提供新对象名**，或**用户明确书面确认"覆盖已有对象"**后，方可继续。**禁止**代理擅自改对象名、追加字母/数字、或把"已存在"当警告跳过。 |
| 主对象及所有关联子对象 **均不存在** | 输出 `[OK] ${objType} ${objName} 在 SAP 中可用`，继续阶段 2。 |

### 1.5.3 确认完毕后才开始生成产物

**硬性规则**：只有在 `searchObject` 确认目标对象名在 SAP 中**不存在**，或用户**书面确认覆盖**后，代理才允许：

- 创建 `output/<object>/` 目录树
- 写入 `functional-spec-ai.md`、`metadata/`、`docs/` 等任何文件
- 进入阶段 2 及以后

**违反后果**：若跳过 1.5.2 直接生成产物，后续发现对象名冲突时，代理必须：
1. 向用户道歉并说明冲突；
2. 等待用户确认新对象名；
3. 将已生成的全部产物**整体迁移**到新对象名目录（含文件内对象名替换）。

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
- **性能设计**（新增，阶段 3 即设计，禁止留到阶段 4 临时处理）：
  - **内表类型选择**：标注哪些内表需定义为 `SORTED TABLE` / `HASHED TABLE`、各自的主键/非唯一键字段
  - **嵌套 LOOP 替代策略**：若逻辑涉及两张内表 N:M 关联，须在此设计替代方案（SORT + READ TABLE BINARY SEARCH / SORTED TABLE + READ TABLE KEY / INNER JOIN 前置到 Open SQL）
  - **WHERE 条件排列**：主查询的 WHERE 字段顺序是否匹配目标表索引/主键顺序；避免否定条件（`<>`/`NOT`/`LIKE`）
  - **主查询数据量预估**：引用 `metadata/performance-estimate.md`，标注数据量级与分页策略
- **待确认项**（标为 TBD，**不得**在阶段 4 无契约实现）

## 阶段 4：按类型生成代码（契约驱动 + 语法速查，非创意驱动）

> **语法参考**：本阶段除「字段契约」+ `metadata/tables/*.json` 外，**必须以 [abap-syntax-quickref.md](abap-syntax-quickref.md) 为语法参考**——打开源码的同时打开本速查，禁止凭记忆写 SELECT / 内表 / OO 代码。速查覆盖 ECC → S4HANA → Cloud 全系，每个模式标注最低版本要求，按目标系统版本选择对应写法。完整语法追查 [SAP-samples/abap-cheat-sheets](https://github.com/SAP-samples/abap-cheat-sheets)。
>
> **GUI Status 与文本元素（硬约束）**：ADT REST **无法**创建 GUI 状态（SE41）和文本元素（SE32）。
> - **CL_SALV_TABLE**（首选）：自带标准工具栏，**禁止**调用 `set_screen_status`。SALV 的工具栏是内置的，不需要也不应该指定外部 GUI Status。
> - 经典 ALV（REUSE_ALV_GRID_DISPLAY）：不可用，因为没有 GUI Status。
> - 文本元素 TEXT-xxx：ADT 部署后需在 SE80/SE32 手动维护，或代码中用硬编码字符串代替。

### 4.0 对象类型分发（按阶段 1.5 确定的目标类型选择模板）

代理在进入阶段 4 时**第一步**即确定目标对象类型，并选择对应的代码骨架：

| 对象类型 | 代码文件 | 最低包含内容 | 参考模板 |
|---------|---------|-------------|---------|
| **REPORT** | 主程序 + T01/SEL/F01/O01 分层 | REPORT 语句 + INCLUDE 引用 + 选择屏 + ALV | `templates/reference/ZSAP_FI244/` |
| **CLAS** | `zcl_xxx.clas.abap`（单文件含 DEF+IMP） | CLASS DEFINITION + PUBLIC/PROTECTED/PRIVATE + METHOD IMPLEMENTATION | 无固定模板 → 按 quickref §11 生成 |
| **INTF** | `zif_xxx.intf.abap` | INTERFACE + METHODS + DATA + CONSTANTS | 用户参考或 quickref §12 |
| **FUGR** | 函数组主文件 + 各 FM 文件 | FUNCTION-POOL + FUNCTION MODULE 定义 | 用户参考或 quickref §13 |

**规则**：
- REPORT 类型：沿用现有 INCLUDE 分层模板（4.1–4.5）
- CLAS/INTF/FUGR 类型：走面向对象/函数模块生成路径（4.6–4.8），**不**强制 INCLUDE 分层
- 若用户指定了参考模板 → 以参考模板为骨架（所有类型适用）

### 4.1–4.5：REPORT 报表生成

> 以下步骤适用于 REPORT 类型（`PROG/P`）。CLAS/INTF/FUGR 类型跳转到 4.6–4.8。

1. **前置检查**：确认 `output/<object>/docs/deployment-config.md` 已存在。**禁止**在未确认开发包/请求号的状态下直接调用 `createObject`。
2. **三步开写**：(a) 打开 `tech-design.md`（字段契约） → (b) 打开 `metadata/tables/*.json`（元数据） → (c) 打开 `abap-syntax-quickref.md`（语法参考）。三者对照写代码，禁止凭记忆编字段名或语法。
3. **模板来源**：以阶段 3.6 确认的模板为骨架；**业务 SELECT/JOIN/WHERE** 不得与契约和元数据冲突。
4. **INCLUDE 分层强约束**：参考程序的分层结构必须保留。
   - 主程序：`<NAME>.abap`（REPORT 语句 + INCLUDE 引用）
   - TOP：`<NAME>T01.abap`、SEL：`<NAME>SEL.abap`、F01：`<NAME>F01.abap`、O01：`<NAME>O01.abap`
5. 生成前先写 `output/<object>/docs/template-mapping.md`。
6. **反模式自检**：对照 quickref §14「性能反模式」逐项自查（LOOP 内 SELECT、FOR ALL ENTRIES 驱表空、隐式标准键等），任一项未通过 → 修正后再继续。
7. **ADT 操作顺序**：`findObjectPath / createObject → lock → setObjectSource → syntaxCheckCode`。

### 4.6：CLASS 类池生成（OO 模式）

**适用场景**：用户要求创建全局类 `ZCL_xxx`（工具类、DAO、Service、Factory 等）。

**必读**：[abap-syntax-quickref.md](abap-syntax-quickref.md) §11「全局类」+ §12「接口」

**生成规则**：

1. **单文件输出**：`output/<object>/abap/<name>.clas.abap`（一个文件包含 CLASS DEFINITION + CLASS IMPLEMENTATION）。
2. **命名约定**：全局类 `ZCL_xxx`；若用户未指定 → 代理根据 FS 功能推荐，如 `ZCL_FI_JOURNAL_DAO`。
3. **最低包含内容**（按 quickref §11 骨架）：
   - `CLASS zcl_xxx DEFINITION PUBLIC FINAL CREATE PUBLIC.`
   - `PUBLIC SECTION.` — `METHODS` / `CLASS-METHODS` / `CONSTANTS` / `TYPES`
   - `PROTECTED SECTION.` / `PRIVATE SECTION.` — 内部类型、属性、方法
   - `ENDCLASS.`
   - `CLASS zcl_xxx IMPLEMENTATION.` — 所有方法的完整实现
   - `ENDCLASS.`
4. **推荐模式**（参考 34_OO_Design_Patterns）：
   - **DAO/数据访问**：封装数据库表读取，方法如 `get_by_key( )`、`get_list( )`
   - **Service**：封装业务逻辑，方法如 `calculate( )`、`validate( )`
   - **Factory**：`CLASS-METHODS create RETURNING VALUE(ro) TYPE REF TO zcl_xxx`
   - **Singleton**：`CLASS-METHODS get_instance RETURNING VALUE(ro) TYPE REF TO zcl_xxx` + 私有构造函数
5. **异常处理**：若有外部调用（RFC / BAPI / DB），声明 `RAISING` 异常或 try/catch `CX_ROOT`。
6. **元数据驱动**：类中若涉及 Open SQL，字段名仍须来自 `metadata/tables/*.json` + 字段契约。

**部署**：使用 `scripts/deploy_rfc.js`（或 MCP 直接调用 `createObject` + `setObjectSource`），按 CLAS 类型处理。类激活后可在 SE24 中验证。

### 4.7：INTF 接口生成

**适用场景**：用户要求创建全局接口 `ZIF_xxx`（定义方法签名供其他类实现）。

**必读**：[abap-syntax-quickref.md](abap-syntax-quickref.md) §12「接口」

**生成规则**：

1. **单文件输出**：`output/<object>/abap/<name>.intf.abap`
2. **最低包含内容**：
   - `INTERFACE zif_xxx PUBLIC.`
   - `METHODS` / `CLASS-METHODS` 声明（含参数签名）
   - `TYPES` / `CONSTANTS` / `DATA`（如有共享常量/类型）
   - `ENDINTERFACE.`
3. **注意**：接口中所有方法**只有签名，无实现**。实现交给 `CLASS ... IMPLEMENTATION`。
4. 接口方法建议加 `RAISING` 声明异常类型，方便实现类传递错误。

### 4.8：FUGR 函数组 / Function Module 生成

**适用场景**：用户要求创建函数组及 Function Module（RFC 或本地）。

**必读**：[abap-syntax-quickref.md](abap-syntax-quickref.md) §13「函数组与 Function Module」

**生成规则**：

1. **函数组主文件**：`output/<object>/abap/<name>.fugr.abap` — 含 `FUNCTION-POOL` 声明 + 全局数据定义。
2. **每个 FM 一个文件**：`output/<object>/abap/<fm_name>.fm.abap` — 含完整 `FUNCTION ... ENDFUNCTION.`
3. **FM 最低包含内容**：
   - `FUNCTION <fm_name>.`
   - `IMPORTING` / `EXPORTING` / `CHANGING` / `TABLES` 参数
   - `EXCEPTIONS`（推荐使用 class-based exceptions 替代经典 exceptions）
   - 业务逻辑（Open SQL、数据处理等）
   - `ENDFUNCTION.`
4. **RFC-enabled**：若为远程调用，FM 声明 `REMOTE` 标记。

**部署**：FUGR 创建方式与 REPORT/CLAS 不同，agent 需通过 `scripts/deploy_rfc.js` 或 MCP 对应工具逐个创建函数组、再创建 FM。

### 4.9：通用反模式自检（阶段 4 末尾强制，所有类型）

代码写入文件后、调用 MCP 部署前，代理**必须**对照 [abap-syntax-quickref.md](abap-syntax-quickref.md) **§14「性能反模式」** 逐项自查（已按柏玺 ABAP 开发标准 V2.1 扩充）。

**分级自查流程**（按 quickref §14.1–14.5 顺序，逐节检查，不得跳过）：

**第一轮：DB 层（quickref §14.1）**
- 所有 `SELECT` 都有 WHERE 条件且字段列表明确
- 零 LOOP 内 SELECT
- 零 `EXEC SQL ... END-EXEC`
- 聚合使用了 SQL 函数（MAX/MIN/SUM/AVG），非手动 LOOP 累加
- 每条 SELECT 后检查 `sy-subrc`

**第二轮：WHERE 层（quickref §14.2）**
- `FOR ALL ENTRIES` 前有 `IF ... IS NOT INITIAL`，驱动表已 SORT，结果已去重
- WHERE 字段排列顺序匹配索引/主键顺序
- 避免 `LIKE` / `NOT` / `<>`（确需时在代码注释中说明理由）
- 已知完整主键优先 `SELECT SINGLE`

**第三轮：内表层（quickref §14.3；新增嵌套 LOOP 替代分析）**
- **嵌套 LOOP 分析**（此项为新增硬约束）：若代码中存在 `LOOP AT A ... LOOP AT B ... ENDLOOP. ENDLOOP.`，代理**必须**在 `tech-design.md` 的「性能设计」小节说明为何不能用 SORT + READ TABLE BINARY SEARCH 或 SORTED/HASHED TABLE 替代。无理由直接使用嵌套 LOOP → 视为反模式，修正后再进入部署。
- 大结构 LOOP 使用 `ASSIGNING <fs>`（非 `INTO` 工作区）
- 条件满足后无多余的无效循环（有 `EXIT` 及时退出）
- 所有 `READ TABLE ... BINARY SEARCH` 前有对应的 `SORT` 语句
- `READ TABLE` 优先使用 `WITH TABLE KEY` 或 `BINARY SEARCH`，非 `WITH KEY` 线性搜索
- 无 `MOVE-CORRESPONDING` 滥用（大结构跨映射时逐字段手动赋值）
- 无 `COLLECT` 误用（数值累加场景不需去重时改用 `APPEND`）

**第四轮：控制流（quickref §14.4）**
- 所有 `CASE` 有 `WHEN OTHERS` 兜底
- 重复 IF 链（>3 个变体）改用 `CASE`，按概率降序排列 WHEN
- 每个 FORM ≤ 200 行
- 嵌套深度 ≤ 3 层（超过 → 拆解为独立子程序或用 `EXIT`/`CONTINUE` 降层）

**第五轮：其他规范（quickref §14.5）**
- 零 Hard Coding（动态值来自配置表 TVARVC 或选择屏参数）
- 有 `AUTHORITY-CHECK` 权限检查
- Z 表物理删除有 log 表记录
- 选择屏有默认值或 `OBLIGATORY` 约束

**任一轮未通过 → 修正源码后再继续；禁止未通过自检直接调 MCP 部署。**

**OO 专属自查**（CLASS/FUGR 类型额外检查）：
- 构造函数是否标记了 `CREATE PUBLIC/PROTECTED/PRIVATE`？
- 方法参数是否完整类型化（避免 `TYPE ANY` 滥用）？
- 是否避免了在方法中修改 IMPORTING 参数（引用传递规则）？
- 异常是否通过 `RAISING` 声明而非静默吞掉？

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
    - 例：功能名称为"序时账"、账号 `<username>`、日期 `20260424` → `ABAP_序时账_<username>_20260424`
    - 若系统不支持中文描述，转拼音或英文缩写，如 `ABAP_Journal_<username>_20260424`。
    - 创建后记录请求号到 `output/<program>/docs/deployment-config.md`。

### 3.6.3 程序模板选择

**模板搜索顺序（代理必须执行，不可跳过）**：

1. **按对象类型搜索本地模板**：
   - 所有类型：先搜 `templates/reference/<用户指定对象名>/`（用户指定的参考程序）
   - REPORT：`templates/reference/ZSAP_FI244/`（项目默认 REPORT 模板）
   - CLASS：`templates/reference/ZCL_SKELETON/`（项目预置 CLASS 骨架）
   - INTF：`templates/reference/ZIF_SKELETON/`（项目预置 INTF 骨架）
   - FUGR：`templates/reference/ZFG_SKELETON/`（项目预置 FUGR 骨架）
   - 兜底：`templates/reference/**/*.abap`
2. **搜索结果处理**：
   - **找到可用模板**：记录模板路径到 `deployment-config.md`，继续后续流程。
   - **未找到任何模板**：REPORT 类型使用 quickref §8 骨架；CLASS/INTF/FUGR 类型使用 quickref §11–13 骨架生成。**不需要**停止流程。
   - **有模板时优先用模板**，无模板时用 quickref 骨架——两种路径均合法。

**用户主动提供模板时**：
- 若用户提供程序名（如 `ZSAP_FI244`）：代理通过 `getObjectSource` 拉取该程序源码（含全部 INCLUDE），保存到 `templates/reference/<程序名>/`。
- 若用户提供本地目录路径：直接复制到 `templates/reference/` 下。
- 在 `output/<program>/docs/template-mapping.md` 中列出模板与新程序的 INCLUDE 对应关系。

**模板结构强约束**：无论使用用户模板还是默认模板，新程序必须保持同等的 INCLUDE 分层结构（`xxxT01`、`xxxSEL`、`xxxF01`），不得退化为单文件大程序（除非用户明确要求简化）。

### 3.6.4 输出产物

`output/<program>/docs/deployment-config.md` 至少包含：

```markdown
## Deployment Config

| 项 | 值 | 备注 |
|---|---|---|
| 目标包 | $TMP 或 ZGD01 | |
| 传输请求 | 空 或 K9XXXXXX | 本地包时为空 |
| 程序描述 | 功能说明书中的程序标题 | 创建程序时写入 SAP 的 description |
| 参考模板 | ZSAP_FI244 或用户指定 | |
| 新程序名 | ZSAP_XXXX | 用户指定 |
| 创建日期 | YYYY-MM-DD | |
```

**硬规则**：`output/<program>/docs/deployment-config.md` 未生成或开发包/请求号状态不明 → **禁止**进入阶段 4。

## 阶段门禁产物验证（新增）

每阶段完成后必须落盘 `output/<program>/docs/stage-gate.md` 并打勾，未打勾禁止进入下一阶段。

- 阶段 1 门禁：`output/<program>/spec/functional-spec-ai.md` 存在且包含选择条件/输出列/透明表清单。
- 阶段 1.5 门禁：`output/<object>/docs/stage-gate.md` 中 `S1.5=object-name-confirmed: yes`，且 `deployment-config.md` 中的对象名已通过 `searchObject` 验证在 SAP 中不存在（或用户书面确认覆盖）。**S1.5 未通过 → 禁止创建 `output/<object>/` 任何目录和文件。**
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
S1.5=object-name-confirmed: yes/no
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

## 阶段 5：部署与激活

> **优先方式**：批量部署走独立脚本 `scripts/deploy_rfc.js`（直接 RFC 调 ADT REST）。MCP 代理模式（`setObjectSource`/`activateObjects`）仅用于查询或脚本不可用时的手动调试。

### 5.0 部署前复核（新增，硬门禁）

在调用任何部署脚本或 MCP 写操作前，代理**必须**执行以下复核，缺一不可：

1. **程序名冲突复核**：确认阶段 1.5 的 `searchObject` 结果已记录在案，且 `deployment-config.md` 中的程序名与之一致。
   - 若阶段 1.5 未执行（如用户直接要求部署）→ **必须先补做 1.5.2 存在性检查**。
   - 若查询发现程序已存在但用户未书面确认覆盖 → **立即停止部署**。
2. **Include 名复核**：同样确认所有 Include 名在阶段 1.5 中已验证可用。
3. **阶段门禁复核**：确认 `stage-gate.md` 中 `S3.6=deployment-config-ready: yes` 且 `deployment-config.md` 中的程序名与用户最终确认的一致。

**违反 5.0 的后果**：覆盖已有程序可能导致生产事故、数据丢失或审计追责。代理若跳过此检查，视为严重流程错误。

### 5.1 独立脚本部署（推荐）

1. 执行 `node scripts/deploy_rfc.js [program]`。
2. 脚本自动完成：创建主程序 → Lock → 上传主程序源码 → 创建 Include → 逐个 Lock/Upload/Unlock → Unlock 主程序 → **语法检查** → **激活** → **检查激活结果**。
3. **脚本内部行为**：若程序已存在，脚本输出 `FATAL` 并 `process.exit(1)`；代理**禁止**修改脚本把报错降级为警告或自动继续。
4. **语法检查（激活前强制，红灯硬阻断）**：
   - 脚本对主程序及所有 Include 调用 ADT 语法检查（`POST .../source/main?method=check`）。
   - 若任一对象存在语法错误（`hasErrors=true`，含 `type="E"` / `type="A"` / `severity="error"` / `abapSyntaxError` / `<err>` 等全部指纹）→ **立即停止部署**（`process.exit(1)`），输出错误行号与消息，**严禁执行激活**。
   - 若端点返回 **405** → 标记 `unavailable`，记录日志，由激活阶段兜底验证语法（继续执行激活）。
   - 若 `hasErrors=true` 但 `errors` 数组为空（解析器无法提取详情），输出原始 XML（前 500 字符）便于调试，**仍视为失败阻断激活**。
   - 代理必须先修复源码语法错误，再重新部署。**禁止**在语法检查未通过的情况下绕过脚本直接调 MCP `activateObjects`。
5. **激活结果检查（新增，激活后强制）**：
   - 脚本解析激活响应，检查每个对象的激活状态。
   - 若激活返回失败（`severity=error`、`abapSyntaxError` 或对象状态非成功）→ **立即报告**，输出失败对象名与消息，标记部署失败。
   - **禁止**仅因 HTTP 200 就认为激活成功；必须解析响应体确认无错误。
   - 解析器必须覆盖三种格式：`<msg type="E|A">`、`<atom:entry>`（category=error）、`<entry>`。漏掉 `<msg type="E">` 会导致假成功。
6. 脚本成功后，进入阶段 5.5 冒烟测试。

### 5.2 MCP 手动部署（备用，仅脚本失败时）

1. 使用 `activateByName` 或 `activateObjects`（需完整 object URI 与类型信息）。
2. **INCLUDE 对象的部署**：
   - **禁止**用 MCP `setObjectSource` 直接上传 Include 名称（如 `ZxxxT01`、`ZxxxSEL`、`ZxxxF01`），因为该工具硬编码 `PROG/P`，会把 Include 创建为同名的可执行程序，造成类型错位。
   - **正确做法**：通过 `scripts/deploy_rfc.js` 直接调用原生 ADT REST API（`SADT_REST_RFC_ENDPOINT`），该脚本能正确处理 `PROG/I` 类型：创建 Include → Lock → 上传源码 → Unlock。
   - `activateObjects` 激活主程序时，系统会自动处理其引用的 Include。
3. 若失败：解析返回中的 **消息/日志**（含行号、对象名），**分类处理**：
  - 语法/拼写 → 改源码后 `setObjectSource`，再 `syntaxCheckCode`。
  - 依赖未激活 → 先激活依赖对象或调整顺序。
  - 锁/传输问题 → `unLock`、换请求或协调。
4. 重复直至激活成功；可用 `inactiveObjects` 复核。
5. **上限**：同一错误无进展重复超过约定次数（如 5 次）则停止自动重试，输出摘要请用户决策。

### 5.3 锁管理（Lock Handle 持久化与恢复）

> **核心问题**：ADT Lock Handle 在进程内存中获取，若部署中断/崩溃，Handle 丢失后无法解锁，对象长期被锁。

**实现机制（三层防护）**：

| 层级 | 触发条件 | 行为 |
|------|---------|------|
| **L1 持久化** | 每次 `lockObject` 成功时 | 自动写入 `.locks/<name>.json`（uri + handle + 时间戳） |
| **L2 自动恢复** | `unlockObject` 未收到 handle | 从 `.locks/` 文件加载 handle 再解锁 |
| **L3 全量清理** | 手动执行脚本 | `node scripts/release_locks.js` 三阶段级联：store → ADT 查询 → RFC DEQUEUE_ALL |

**文件结构**：

```
.locks/
  ├── zsap_fi254.json        # {"uri": "...", "handle": "...", "time": "..."}
  ├── zsap_fi254t01.json
  └── zsap_fi254f01.json
```

**代理行为**：
- `deploy_rfc.js` 崩溃时 → 错误日志列出残留锁 + 提示运行 `release_locks.js`
- 用户报告"对象被锁" → 代理先检查 `.locks/` 是否有记录，如有则用 handle 解锁；如无则运行 `release_locks.js --force`（DEQUEUE_ALL）
- `.locks/` 目录已加入 `.gitignore`，不会提交到 Git

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
- [ ] **1.5 程序名确认：已通过 MCP searchObject 确认目标程序名及所有 Include 名在 SAP 中不存在，或用户已书面确认覆盖**
- [ ] output/<program>/docs/deployment-config.md 已记录经确认的程序名
- [ ] 每张透明表均有 metadata JSON（阶段 2 产物）
- [ ] output/<program>/metadata/tables/_errors.md 对失败对象包含"尝试路径 + 原始报错 + 下一步动作"
- [ ] output/<program>/metadata/performance-estimate.md 已生成（主表 COUNT + 量级分类 + 分页建议）
- [ ] output/<program>/docs/tech-design.md 含「字段契约」且与 metadata 一致
- [ ] output/<program>/docs/fs-coverage.md 已覆盖 FS 全量字段（含 Done/TBD）
- [ ] output/<program>/docs/deployment-config.md 已生成（包/请求号/模板/新程序名）
- [ ] output/<program>/docs/template-mapping.md 已证明新程序结构对齐参考模板（含 INCLUDE）
- [ ] output/<program>/docs/stage-gate.md 每阶段门禁已打勾（含 S0/S2.5/S3.6/S5.5）
- [ ] Open SQL / 内表字段均可追溯到契约与 metadata（无凭空字段）
- [ ] **5.0 部署前：已通过 MCP searchObject 确认目标程序名及所有 Include 名在 SAP 中不存在，或用户已书面确认覆盖**
- [ ] 源码已 syntaxCheckCode
- [ ] 激活成功或达到重试上限并记录原因
- [ ] output/<program>/docs/smoke-test.md 已生成且通过最低验证（源码一致 / 执行探针 / ALV 列核对）
- [ ] （推荐）每阶段产物已 git commit
```

## 延伸阅读

- **ABAP 语法速查（阶段 4 必备）**：[abap-syntax-quickref.md](abap-syntax-quickref.md) — 精选自 [SAP-samples/abap-cheat-sheets](https://github.com/SAP-samples/abap-cheat-sheets)，覆盖 SELECT / 内表 / ALV / WHERE / 性能反模式。
- RFC 参数、Eclipse ADT / ADT REST 与 abapify CLI 要点：[reference.md](reference.md)
- **MCP 参数契约与易错点**（读 schema、禁止猜参数名）：[mcp-contract.md](mcp-contract.md)
- **官方完整速查表**：[SAP-samples/abap-cheat-sheets](https://github.com/SAP-samples/abap-cheat-sheets)（37 个 .md 速查表 + src/ 可执行实验代码）— 遇到本 quickref 未覆盖的语法问题时追查。

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

### 对象类型映射与命名约定

| ADT 类型码 | ADT URI 前缀 | 说明 | 命名约定 | 本 Skill 支持 |
|-----------|-------------|------|---------|-------------|
| `PROG/P` | `/sap/bc/adt/programs/programs/` | 可执行程序 | `ZSAP_xxx` / `ZFI_xxx` | **是（REPORT）** |
| `PROG/I` | `/sap/bc/adt/programs/includes/` | Include | `ZSAP_xxxT01` 等 | **是** |
| `CLAS` | `/sap/bc/adt/oo/classes/` | 全局类 | `ZCL_xxx` | **是** |
| `INTF` | `/sap/bc/adt/oo/interfaces/` | 接口 | `ZIF_xxx` | **是** |
| `FUGR` | `/sap/bc/adt/functions/groups/` | 函数组 | `ZFG_xxx` | **是** |
| `FUNC` | `/sap/bc/adt/functions/groups/<fugr>/fmodules/` | Function Module | 任意（与函数组关联） | **是** |
| `TABL` | `/sap/bc/adt/ddic/tables/` | 透明表 | 任意 | 仅读取 |
| `ENHO` | `/sap/bc/adt/enhancements/enhs/` | 增强实现 | 任意 | 仅读取 |

### ADT REST 端点（按对象类型）

| 操作 | 对象类型 | 方法 | URI |
|------|---------|------|-----|
| 创建 | PROG/P | POST | `/sap/bc/adt/programs/programs` |
| 创建 | PROG/I | POST | `/sap/bc/adt/programs/includes` |
| 创建 | CLAS | POST | `/sap/bc/adt/oo/classes` |
| 创建 | INTF | POST | `/sap/bc/adt/oo/interfaces` |
| 创建 | FUGR | POST | `/sap/bc/adt/functions/groups` |
| Lock | ALL | POST | `{objectUri}?_action=LOCK&accessMode=MODIFY` |
| 上传源码 | ALL | PUT | `{objectUri}/source/main?lockHandle={handle}` |
| 激活 | ALL | POST | `/sap/bc/adt/activation?method=activate&preauditRequested=true` |

### 故障排查速查表

| 症状 | 根因 | 解决 |
|------|------|------|
| 创建程序报 **404** | URI 拼写错误或程序名大小写问题 | 确认 URI 为 `/sap/bc/adt/programs/programs`；程序名在 URI 中统一使用**小写** |
| 创建程序报 **406** | `Accept` 或 `Content-Type` 头不匹配 | 对照上表使用正确的 MIME 类型；可用 Discovery（`GET /sap/bc/adt/discovery`）确认系统支持的类型 |
| 创建程序报 **409** | 程序已存在 | **必须问用户**：提供新程序名或确认覆盖。禁止代理自动跳过 |
| 上传源码报 **400/403** | `lockHandle` 缺失、过期或编码问题 | 重新 Lock 获取新 handle；确保 `lockHandle` 已 URL-encode |
| 激活失败 | 语法错误或依赖对象未激活 | 先修正源码语法；检查 INCLUDE 是否已上传并解锁 |
| `setObjectSource` 上传 Include 后，SAP 里按 Include 搜索不到 | `setObjectSource` 硬编码 `PROG/P`，把 Include 创建成了同名的**可执行程序** | **禁止**用 `setObjectSource` 直接传 Include 名称；改用 `scripts/deploy_rfc.js` 通过原生 ADT REST API 逐对象部署 |
| `ActivateObjects` 对 `PROG/I` 返回 "No suitable resource" | `buildObjectUri` 缺少 `PROG/I` 映射，生成错误 URI `/sap/bc/adt/prog/i/...` | 不单独激活 Include，只激活主程序；主程序激活时系统会自动处理其引用的 Include |
| 调用 `INSERT_REPORT` 报"函数不存在" | 使用了非标准 FM | **禁止**使用 `INSERT_REPORT`，改用 `SADT_REST_RFC_ENDPOINT` + ADT REST API |
| 激活报 HTTP 200 但对象实际未激活（假成功） | `activate-objects.js` 解析器仅匹配 `<entry>`，漏掉了 SAP 返回的 `<msg type="E">` 格式错误 | 重写解析器：同时匹配 `<msg type="E|A">`、`<atom:entry>`（category=error）、`<entry>` 三种格式，任何一条命中即视为激活失败 |
| 语法检查端点返回 **405** | 当前 SAP 版本不支持该 ADT 语法检查端点 | `syntax-check.js` 捕获 405 → 返回 `{ unavailable: true }`，由激活阶段兜底验证语法 |
| 文本元素 / GUI Status 写入报 **404** | 当前 SAP 版本的 ADT REST API 不支持通过该端点写入文本元素和 GUI Status | 标记为已知限制；部署后由用户在 SE80 中手动维护，并在 `smoke-test.md` 中记录 |
| 程序被创建到 `$TMP` 而非目标包 | `env.js` 错误地从 `.env` 读取全局 `SAP_DEPLOY_PACKAGE`，或脚本未使用 `load-deployment-config.js` | 部署配置必须按程序隔离：`load-deployment-config.js` 从 `output/<program>/docs/deployment-config.md` 读取每程序的目标包和传输请求，禁止在 `.env` 中写死全局包名 |
| `STATUS_LINE` 无 `STATUS_CODE` | 部分系统返回字段名不同 | 兼容解析：`STATUS_CODE` 优先， fallback 到 `CODE` |

### 参考实现（脚本库使用指南）

> **脚本库原则**：按 ADT URL 拆分为独立模块，每个模块职责单一；主脚本仅负责编排组合。所有脚本统一读取 `.env`，产出按 `output/<program>/` 隔离。

### 脚本目录结构

```
根目录辅助脚本
├── rfc-proxy-server.js              # RFC ADT 代理服务器（监听 localhost:9876）
├── mcp-launcher.js                  # MCP 启动包装器（自动设置 SAPNWRFC_HOME + PATH）
├── run-claude.js                    # 带预设 prompt 启动 Claude Code（一次性/遗留）
└── launch-claude.js                 # 启动 Claude Code（无 prompt，stdio inherit）

scripts/
├── deploy_rfc.js                    # 主部署脚本（编排模块）
├── deploy_includes_only.js          # 仅部署 Include（不创建/上传主程序）
├── extract-docx.js                  # 从 .docx 提取文本
├── test_rfc.js                      # RFC 环境诊断（独立验证 node-rfc + 连通性）
├── test_mcp_login.js                # MCP 端到端连通测试（通过 RFC 代理验证 objectTypes）
├── fetch_metadata.js                # 批量拉取透明表 DDIC
├── perf_estimate.js                 # 主表 COUNT 预估
├── release_locks.js                 # 释放当前用户在 SAP 中的所有锁（DEQUEUE_ALL）
├── unlock_prog.js                   # 解锁指定程序（需硬编码 lockHandle，应急用）
├── unlock_includes.js               # 解锁 Include（遗留）
├── unlock_includes_v2.js            # 解锁 Include（改进版）
└── modules/                         # ADT 原子操作模块（每个 URL 一个脚本）
    ├── env.js                       # 加载 .env，构建 RFC 连接参数（不含部署配置）
    ├── load-deployment-config.js    # 从 output/<program>/docs/deployment-config.md 读取程序级部署配置（包/请求号/描述）
    ├── sap-connection.js            # RFC Client 创建
    ├── adt-request.js               # 通用 ADT HTTP 请求（SADT_REST_RFC_ENDPOINT）
    ├── lock-object.js               # POST ...?_action=LOCK
    ├── unlock-object.js             # POST ...?_action=UNLOCK
    ├── create-program.js            # POST /sap/bc/adt/programs/programs
    ├── create-include.js            # POST /sap/bc/adt/programs/includes
    ├── upload-program-source.js     # PUT /programs/programs/{name}/source/main
    ├── upload-include-source.js     # PUT /programs/includes/{name}/source/main
    ├── syntax-check.js              # POST .../source/main?method=check
    ├── activate-objects.js          # POST /sap/bc/adt/activation?method=activate
    └── with-lock.js                 # 自动锁管理组合（lock → fn → unlock）
```

### 模块使用指南

| 模块 | 对应 ADT URL | 职责 |
|------|-------------|------|
| `modules/load-deployment-config.js` | 读取 Markdown 表格 | 从 `deployment-config.md` 解析目标包、传输请求、程序描述（程序级配置，非全局 `.env`） |
| `modules/env.js` | 读取 `.env` | 加载 SAP 连接参数（URL/USER/PASSWORD/CLIENT/ROUTER 等），**不含部署配置** |
| `modules/create-program.js` | `POST /sap/bc/adt/programs/programs` | 创建 PROG/P，处理 409 已存在 |
| `modules/create-include.js` | `POST /sap/bc/adt/programs/includes` | 创建 PROG/I，处理 409 已存在 |
| `modules/upload-program-source.js` | `PUT /programs/programs/{name}/source/main` | 上传主程序源码 |
| `modules/upload-include-source.js` | `PUT /programs/includes/{name}/source/main` | 上传 Include 源码 |
| `modules/lock-object.js` | `POST ...?_action=LOCK&accessMode=MODIFY` | 获取 lockHandle |
| `modules/unlock-object.js` | `POST ...?_action=UNLOCK&lockHandle={h}` | 释放锁（忽略错误） |
| `modules/syntax-check.js` | `POST .../source/main?method=check` | 语法检查；若系统返回 405 → 标记 `unavailable`，由激活阶段兜底验证 |
| `modules/activate-objects.js` | `POST /sap/bc/adt/activation?method=activate` | 激活对象；必须解析 `<msg type="E">`、`<atom:entry>`、`<entry>` 三种错误格式 |
| `modules/with-lock.js` | 组合 lock + fn + unlock | **保证无论 fn 成功/异常都释放锁** |

### 独立辅助脚本速查

以下脚本不在 `modules/` 下，但同样供代理在特定场景调用：

| 脚本 | 场景 | 说明 |
|------|------|------|
| `rfc-proxy-server.js` | 阶段 0 启动 RFC 代理 | 监听 `127.0.0.1:9876`，将 HTTP ADT REST 请求转译为 `SADT_REST_RFC_ENDPOINT` RFC 调用。启动后常驻后台，直到手动 `SIGINT`。 |
| `mcp-launcher.js` | 替代 `.mcp.json` 直接启动 MCP | 设置 `SAPNWRFC_HOME` 和 `PATH` 后加载 `mcp-abap-abap-adt-api/dist/index.js`。仅在 `.mcp.json` 使用 `args: ["mcp-launcher.js"]` 时生效。 |
| `scripts/test_mcp_login.js` | MCP 连通性端到端测试 | 自动检查代理是否运行 → 启动代理（如需）→ 对 MCP 发送 `objectTypes` JSON-RPC 请求 → 输出 `PASSED`/`FAILED`。用于验证整条链路（MCP → 代理 → SAP）。 |
| `scripts/release_locks.js` | 应急释放锁 | 通过 RFC 调用 `DEQUEUE_ALL` 释放当前用户持有的全部 SAP 锁。部署卡住或锁泄漏时使用。 |
| `scripts/unlock_prog.js` | 应急解锁指定程序 | 通过 RFC 直接发送 UNLOCK ADT 请求，需手动填入 `lockHandle`。用于代理锁异常时的手动释放。 |
| `scripts/unlock_includes.js` / `v2` | 应急解锁 Include | 同上，针对 Include 对象。v2 为改进版本。 |
| `scripts/deploy_includes_only.js` | 仅部署 Include | 当主程序已在 SAP 中创建好，只需更新 Include（T01/SEL/F01）时使用。不创建主程序、不覆盖主程序源码。 |
| `run-claude.js` / `launch-claude.js` | 本地启动 Claude Code | 一次性/遗留脚本，用于在 Windows 上通过 `child_process.spawn` 启动 Claude Code CLI。日常由用户直接使用 `claude` 命令替代。 |

### 主脚本部署流程（`scripts/deploy_rfc.js`）

```
1. 读取源码 → 2. 创建程序 → 3. 上传主程序（withLock）→
4. 创建 Include → 5. 上传 Include（withLock）→
6. 语法检查（全部对象）→ 7. 激活 → 8. 检查激活结果
```

**硬规则**：
- 语法检查有错误 → **立即停止**，不执行激活，输出错误行号与消息。
- 语法检查端点返回 **405** → 标记 `unavailable: true`，记录到日志，**由激活阶段兜底验证语法**（继续执行激活，不终止）。
- 激活返回失败 → **立即报告**，输出失败对象名与消息。
- **激活结果解析必须覆盖三种格式**：`<chkl:messages>` 中的 `<msg type="E|A">`、`<atom:entry>` 中 `category term="error"`、以及简单 `<entry>` 标签。**禁止**仅匹配 `<entry>` 而漏掉 `<msg type="E">` 格式的真实错误。
- 任何异常退出前，`finally` 中必须释放所有已获取的锁。

**部署后手动步骤（已知 ADT API 限制）**：
- **文本元素（Text Elements）**：ADT REST API 在当前 SAP 版本中写入文本元素返回 404，脚本无法自动写入。部署完成后需用户在 SE80 中手动维护 `TEXT-001` 等文本。
- **GUI 状态（GUI Status）**：ADT REST API 在当前 SAP 版本中写入 GUI Status 返回 404，脚本无法自动创建。部署完成后需用户在 SE80 中手动复制并维护 GUI Status。
- 上述限制应在 `smoke-test.md` 中明确标注为 "Manual step required in SE80"。

### 旧脚本

| 脚本 | 状态 | 说明 |
|------|------|------|
| `scripts/setup-rfc-env.ps1` | 已删除 | 功能与 `test_rfc.js` 重复 |

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

### INCLUDE 的正确部署方式（多文件原生 ADT REST）

**禁止合并单文件部署**。SAP 系统无法通过合并文件自动解析生成 INCLUDE 对象，这种做法会导致：
- 主程序编译时 INCLUDE 引用找不到对应对象
- 系统可能将 INCLUDE 创建为同名的可执行程序，造成类型错乱
- 后续维护、搜索、删除均异常

**正确做法**：使用 `scripts/deploy_rfc.js` 通过原生 ADT REST API（`SADT_REST_RFC_ENDPOINT`）逐对象部署：

1. **阶段 4 生成分层源码**：主程序 + T01 / SEL / F01 分别输出到 `output/<program>/abap/sources/`，保持代码结构与模板一致。
2. **阶段 5 执行脚本部署**：`node scripts/deploy_rfc.js <program>`
   - 脚本自动完成：创建主程序（`PROG/P`）→ Lock → 上传主程序源码
   - 创建 Include（`PROG/I`，`program:programType="I"`）→ 逐个 Lock/Upload/Unlock
   - Unlock 主程序 → Activate 主程序
3. **激活主程序即可**：主程序激活时，系统会自动处理其引用的 Include。

脚本内部通过 `SADT_REST_RFC_ENDPOINT` 直接调用 SAP ADT REST，绕过 MCP 层 `setObjectSource` 对 `PROG/P` 的硬编码限制。

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
