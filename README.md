

# SAP 报表自动化工作流（OpenCode Skill）

端到端 SAP ABAP 开发对象自动化：从功能规格（FS）→ DDIC 元数据 → 技术文档 → 代码生成 → 激活 → 冒烟测试的 AI 驱动闭环。

支持对象类型：**REPORT**、**CLAS**、**FUGR/FM**、**INTF**、**Include**。

## 架构

```
查询链路：
AI Agent → node scripts/rfc_client.js → node-rfc → SADT_REST_RFC_ENDPOINT → SAP

部署链路（按对象类型分发）：
AI Agent → node scripts/deploy_report_include.js
                → node scripts/deploy_report.js
                → node scripts/deploy_fugr.js
                → node scripts/deploy_clas.js
                → node scripts/deploy_intf.js
         → node-rfc → SADT_REST_RFC_ENDPOINT → SAP
```

**node-rfc 直连**，无 MCP 服务器、无 HTTP 代理中间层。所有操作通过 `scripts/rfc_client.js`（统一查询入口）和类型专用部署脚本执行。`scripts/deploy_rfc.js` 保留为兼容入口。

## 快速开始

### 1. 安装依赖

```bash
npm install          # 安装 node-rfc
```

**系统要求**：Node.js ≥ 18、SAP NW RFC SDK（解压到 `NW-RFC-SDK/nwrfcsdk/`）。

### 2. 配置 SAP 连接

创建 `.env`（开发系统，SAP_CLIENT=开发客户端）和 `.env.data`（数据系统，SAP_CLIENT=开发机单元测试客户端）：

```bash
SAP_URL=http://<host>:8000
SAP_CLIENT=200(或其他)
SAP_SYSNR=00              # 实例编号
SAP_USERNAME=<username>
SAP_PASSWORD=<password>
SAP_ROUTER=/H/<router>    # 可选，内网穿透
```

### 3. 验证连通

```bash
node scripts/test_rfc.js       # 环境诊断（DLL + 连接）
node scripts/rfc_dual_check.js # 双系统一键检测
```

输出 `"status": "ALL_OK"` → 就绪。

## 包含内容

### Skill 文档（`.opencode/skills/sap-report-automation-workflow/`）

| 文件 | 用途 |
|------|------|
| `SKILL.md` | 主工作流定义（S0–S11 共 12 阶段 + 门禁 + 反模式自检） |
| `sap-operations-reference.md` | 全部 SAP 操作入参/出参实测手册 |
| `abap-syntax-quickref.md` | ABAP 语法速查（ECC→S4HANA→Cloud） |
| `troubleshooting.md` | 卡点速查（DDIC/部署/代码/连接） |
| `reference.md` | ABAP 参考源 + 脚本库 |
| `rfc-adt-client-manual.md` | RFC ADT 端点 + rfc_client.js 手册 |

### 核心脚本（`scripts/`）

| 脚本 | 用途 | 频率 |
|------|------|------|
| `rfc_client.js` | 统一 RFC ADT 客户端（discovery/search/SQL/source） | 每次会话 |
| `rfc_fetch_ddic.js` | 单表 DDIC 元数据一键拉取 → JSON | 每张表 |
| `rfc_dual_check.js` | 双系统连通检测 | 每次会话 |
| `detect_abap_version.js` | 探测目标 SAP 系统的 ABAP release | S0 |
| `deploy_report.js` | 部署 REPORT（单文件） | 每个程序 |
| `deploy_report_include.js` | 部署 REPORT + INCLUDE（自动发现 INCLUDE） | 每个程序 |
| `deploy_fugr.js` | 部署 FUGR + FM | 每个函数组 |
| `deploy_clas.js` | 部署 CLAS | 每个类 |
| `deploy_intf.js` | 部署 INTF | 每个接口 |
| `deploy_rfc.js` | 兼容旧模板（固定 T01/SEL/F01/O01） | 旧程序兼容 |
| `verify_report.js` | 冒烟测试（执行报表 + 多参数比对） | 每个程序 |
| `test_rfc.js` | RFC 环境诊断（DLL + node-rfc + 连接） | 首次/故障 |
| `release_locks.js` | 应急释放 SAP 锁 | 按需 |
| `fetch_table.js` | DDIC 端点统一取数（完整 SELECT，WHERE 可靠） | 每报表 |
| `data_sampler.js` | fetch_table.js 兼容包装 | 每报表 |
| `extract-docx.js` | DOCX 功能说明书文本提取 | 按需 |
| `modules/` | 共享模块（env/sap-connection/adt-request/lock/create/upload/activate 等） | — |

## 工作流阶段

| 阶段 | 名称 | 产物 |
|------|------|------|
| S0 | RFC 环境验证与连接 | `.env` / `.env.data` |
| S1 | 功能规格规范化 | `spec/functional-spec-ai.md` |
| S2 | 对象名确认与 SAP 存在性检查 | 确认的对象名清单 + `--search` 结果 |
| S3 | 透明表 DDIC 元数据 | `metadata/tables/<T>.json` |
| S4 | FS → DDIC 字段交叉验证 | `spec/fs-ddic-verification.md` |
| S5 | 性能预估 | `docs/performance-estimate.md` |
| S6 | 技术设计 | `docs/tech-design.md` |
| S7 | FS 对齐审查 | `docs/fs-coverage.md` |
| S8 | 部署配置 | `docs/deployment-config.md` |
| S9 | 按类型生成代码 | `abap/*.abap` |
| S10 | 部署与激活 | SAP 中已激活对象 |
| S11 | 冒烟测试 | `output/<程序>/smoke-test.md` |

### S0：RFC 环境验证与连接

- **描述**：启动任何 SAP 工作前，先确认本地 RFC 环境、SAP 连接凭据、开发系统与数据系统双系统连通性。
- **作用**：保证后续阶段可以稳定调用 SAP，避免写到一半发现连不上或数据环境不对。
- **产物**：
  - `.env`（开发系统配置）
  - `.env.data`（数据系统配置）
  - 连通验证结果
  - ABAP 版本探测结果（`allowedSyntax`）
  - `stage-gate.md`：`S0=connection-ok: yes`、`S0=permission-check: yes`、`S0=abap-version: yes`

### S1：功能规格规范化

- **描述**：把用户提供的 FS（Word、PDF、口头描述等）转化为结构化、可执行的 `functional-spec-ai.md`。
- **作用**：把自然语言/业务文档转成 AI 能一致理解的输入，作为后续阶段的单一事实来源。
- **产物**：
  - `spec/functional-spec-ai.md`（业务目标、选择屏幕、输出列、透明表、业务逻辑、约束）
  - `stage-gate.md`：`S1=functional-spec-ready: yes`

### S2：对象名确认与 SAP 存在性检查

- **描述**：确认最终对象名（如 `ZTEST109`）以及所有 Include/Function/Method 命名，并在 SAP 中检查是否已存在。
- **作用**：防止覆盖已有对象或导致激活失败。若已存在，必须停止并请求用户确认。
- **产物**：
  - 确认的对象名与类型清单
  - SAP `--search` 不存在记录
  - `stage-gate.md`：`S2=object-name-confirmed: yes`

### S3：透明表 DDIC 元数据

- **描述**：从 SAP 数据系统拉取 FS 涉及的所有透明表（含 Z 表）的 DDIC 字段元数据，落盘为 JSON。
- **作用**：消除代码生成阶段凭记忆写字段名、表名、类型的风险；后续所有 SQL、内表、ALV 列都基于这些元数据。
- **产物**：
  - `output/<对象名>/metadata/tables/<TABNAME>.json`
  - `stage-gate.md`：`S3=metadata-ready: yes`

### S4：FS → DDIC 字段交叉验证

- **描述**：逐字段核对 `functional-spec-ai.md` 中引用的 `表.字段` 是否真实存在于 DDIC 元数据，并确认类型、长度、语义与 FS 一致。
- **作用**：在写代码前发现并修正 FS 字段名错误、类型误解、字面值陷阱（如 `SPRAS` 用 `'1'` 而非 `'ZH'`）。
- **产物**：
  - `spec/fs-ddic-verification.md`
  - 所有偏差项标注为 TBD 或已修正
  - `stage-gate.md`：`S4=fs-ddic-verified: yes`

### S5：性能预估

- **描述**：对主驱动表执行 `COUNT(*)`，按最严格条件估算数据量，决定输出方案（全量 ALV、分页、后台执行）。
- **作用**：防止数据量爆炸导致报表卡死或超时；在写代码前就确定性能策略。
- **产物**：
  - `docs/performance-estimate.md`
  - 数据量等级判定（全量 / 分页 / 后台）
  - `stage-gate.md`：`S5=performance-estimate-ready: yes`

### S6：技术设计

- **描述**：基于 FS 和 DDIC 元数据编写完整技术设计，包括字段契约、表关联路径、选择屏幕字段角色、取数逻辑、ALV 布局、性能设计。
- **作用**：把业务需求翻译成代码实现方案，让所有 SQL 字段、JOIN 条件、计算列有源可追。
- **产物**：
  - `docs/tech-design.md`（含字段契约、角色分析表、内表类型、ALV 设计）
  - `docs/template-mapping.md`（新对象与参考模板的对应关系）
  - `stage-gate.md`：`S6=tech-design-ready: yes`

### S7：FS 对齐审查

- **描述**：以表格形式逐行检查 FS 中的每个输出列、选择条件，是否已在 `tech-design.md` 字段契约和元数据中有映射，并标注代码落点。
- **作用**：确保没有遗漏列、没有多余字段、每个业务逻辑项都有对应的代码实现位置。
- **产物**：
  - `docs/fs-coverage.md`
  - `stage-gate.md`：`S7=fs-coverage-ready: yes`

### S8：部署配置

- **描述**：确认开发包、传输请求、参考模板选择，并写入固定格式的 `deployment-config.md`。
- **作用**：让部署脚本能正确读取包名和传输请求，避免部署到错误环境或失败。
- **产物**：
  - `docs/deployment-config.md`（固定表格格式）
  - `stage-gate.md`：`S8=deployment-config-ready: yes`

### S9：按类型生成代码

- **描述**：根据对象类型（REPORT/CLAS/INTF/FUGR）和参考模板生成 ABAP 源码，并强制通过反模式自检。
- **作用**：产出可直接部署到 SAP 的代码，同时保证代码风格、语法、字段契约、模板结构一致。
- **产物**：
  - `output/<对象名>/abap/<对象名>.abap`
  - 相关 Include/类/接口/FM 源文件
  - `stage-gate.md`：`S9=code-generated: yes`

### S10：部署与激活

- **描述**：按对象类型选择对应部署脚本，将源码上传到 SAP 开发系统，执行 Lock、上传、解锁、激活，并验证所有对象版本为 `active`。
- **作用**：让代码在 SAP 中真正生效，可被执行和测试。
- **产物**：
  - SAP 中已激活的 ABAP 对象
  - 部署脚本返回的 JSON 结果
  - `stage-gate.md`：`S10=activated: yes`

### S11：冒烟测试

- **描述**：在数据系统中抽取真实数据，手工计算预期结果，与 `verify_report.js` 返回的报表输出进行逐字段比对，确保计算逻辑正确。
- **作用**：验证代码逻辑在真实数据下正确，且输出字段与 FS 一致。不能仅凭程序能运行就通过。
- **产物**：
  - `output/<对象名>/smoke-test.md`（含参数组合、手工计算过程、结果比对）
  - `stage-gate.md`：`S11=smoke-test-passed: yes`

### 硬门禁

- S0 未通过 → 禁止进入 S1
- S1 无 `functional-spec-ai.md` → 禁止写 ABAP、禁止部署
- S2 对象名未确认（或已存在未覆盖授权） → 禁止进入 S3
- S3 无 metadata JSON 落盘 → 禁止进入 S4
- S4 `fs-ddic-verification.md` 有未修正语义偏差 → 禁止进入 S6
- S6 无 `tech-design.md`（含字段契约+选择屏幕角色分析） → 禁止进入 S9
- S8 无 `deployment-config.md`（包/请求号/模板未明确） → 禁止进入 S10
- S9 未完成反模式自检 → 禁止部署
- S11 未通过真实数据验证 → 禁止标记通过

> 门禁通过后由用户决定是否 `git add + git commit`，格式建议：`[SAP-WF] 阶段X: 简述产物`。代理不自动执行 git 提交。

### 全阶段 SAP 命令速查

```bash
# S0 — 环境诊断
node scripts/test_rfc.js
node scripts/rfc_dual_check.js

# S0 — 权限探测
node scripts/rfc_client.js --sql "SELECT COUNT(*) AS CNT FROM TADIR WHERE PGMID EQ 'R3TR'" --table TADIR

# S0 — ABAP 版本探测
node scripts/detect_abap_version.js

# S2 — 查对象名
node scripts/rfc_client.js --search "<对象名>"

# S3 — 拉 DDIC 元数据
node scripts/rfc_fetch_ddic.js --env=.env.data BKPF output/<prog>/metadata/tables/

# S4 — FS ↔ DDIC 验证（手工审查产物 spec/fs-ddic-verification.md）

# S5 — 主表 COUNT / 性能预估
node scripts/rfc_client.js --env=.env.data --sql "SELECT COUNT(*) AS CNT FROM <T>" --table <T>

# S6 — 技术设计（手工产物 docs/tech-design.md）

# S7 — FS 对齐审查（手工产物 docs/fs-coverage.md）

# S8 — 验证包
node scripts/rfc_client.js --search "<包名>" --type DEVC

# S10 — 部署（按对象类型选择）
# REPORT + INCLUDE 分层
node scripts/deploy_report_include.js <程序名>

# REPORT 单文件（无 INCLUDE）
node scripts/deploy_report.js <程序名>

# 函数组 + FM
node scripts/deploy_fugr.js <函数组名>

# 全局类
node scripts/deploy_clas.js <类名>

# 接口
node scripts/deploy_intf.js <接口名>

# 兼容旧模板（固定 T01/SEL/F01/O01）
node scripts/deploy_rfc.js <程序名>

# S11 — 取数（DDIC 端点，完整 SELECT）
node scripts/fetch_table.js --table=FAGLFLEXT --where="RYEAR = '2026'" --fields=RYEAR,RACCT --rows=50

# S11 — 冒烟测试
node scripts/verify_report.js <程序名> P_BUKRS=6030 P_GJAHR=2025 "S_RPMAX=001-004"
```

## FUGR / Function Module 部署

RFC ADT（通过 SADT_REST_RFC_ENDPOINT） 完整支持函数组和 FM。

```abap
" FM 源码格式（ABAP 原生声明，禁止 *"*" 注释块）
FUNCTION zfm_example
  IMPORTING VALUE(iv_input) TYPE string
  EXPORTING VALUE(ev_output) TYPE string
  TABLES it_data LIKE rfc_db_opt OPTIONAL.
  ... implementation ...
ENDFUNCTION.
```

部署流程：`POST FUGR → POST FM → Lock → PUT metadata + source → Activate`

## 产物目录

```
output/<object>/
├── spec/                      # S1: 功能规格
│   ├── functional-spec-ai.md
│   └── fs-ddic-verification.md # S4
├── metadata/tables/           # S3: DDIC 元数据
│   └── <TABNAME>.json
├── docs/                      # S3: 技术文档
│   ├── tech-design.md         # 字段契约 + 关联 + WHERE
│   ├── fs-coverage.md         # FS 字段→代码 逐项对齐
│   ├── template-mapping.md    # INCLUDE 映射
│   ├── performance-estimate.md # S5 性能预估
│   └── deployment-config.md   # 包/请求号/模板
├── abap/                      # S4: 源码
│   ├── <name>.abap            # 主程序
│   ├── <name>T01.abap         # TOP Include
│   ├── <name>SEL.abap         # 选择屏幕
│   ├── <name>F01.abap         # FORM 子程序
│   └── ...
├── stage-gate.md              # 阶段门禁状态
└── smoke-test.md              # S11 冒烟测试结果
```

## 已知限制

- **文本元素 / GUI Status**：RFC ADT 通道不支持 SE32/SE41。GUI Status 使用 `report = 'SAPLKKBL'` 标准工具栏。选择屏幕文本通过运行时设置：`%_xxx_%_app_%-text` 直接赋值（优先），或 `SELECTION_TEXTS_MODIFY` FM（备选）
- **FM 参数格式**：必须用 ABAP 原生声明，`*"*'` 注释块被 RFC ADT 拒绝
- **`freestyle` SQL 端点**：部分 SAP 版本返回 400，用 `--table <T>` 走 `ddic` 端点兜底

## GitHub 推送准则

1. **敏感信息零泄露**：`.env*` 全部 gitignore，含 SAP 凭据/服务器地址；仅提供 `.env.example` 空模板
2. **`.opencode/` 选择性上传**：`skills/` 公开分享；`settings.local.json` 仅含通用权限（Bash/Git/npm）
3. **产物不上传**：`spec/`（除 `.gitkeep`）、`output/`（除 `.gitkeep`）、`_dist/`、`*.zip`、`*.log`、`.locks/` 全部 gitignore
4. **Commit 规范**：Conventional Commits（feat/fix/chore/docs/refactor）+ 中文描述
5. **推送前检查**：`git status` 确认无 `.env*`、无产物混入、无硬编码凭据

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| **V3.1** | 2026-06-24 | S4 FS→DDIC 验证、选择屏幕文本运行时、冒烟测试标准化、fetch_table.js、GitHub 推送准则 |
| V3.0 | 2026-06-24 | RFC ADT 直连架构：去除 MCP/代理中间层，统一走 node-rfc → SADT_REST_RFC_ENDPOINT |
| V0.3 | 2026-06-10 | FM 创建流程（IMPORTING/EXPORTING/TABLES + RFC）；冒烟测试真实数据验证；配置去硬编码 |
| V0.2 | 2026-06-09 | 冒烟测试方法论修正（先查源表→手工预期→跑程序→比对）；去敏感信息 |
| V0.1 | 2026-04-27 | 初始版本：REPORT 全流程、双系统架构、RFC 代理模式 |
