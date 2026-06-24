# SAP 报表自动化工作流（Claude Skill）

端到端 SAP ABAP 开发对象自动化：从功能规格（FS）→ DDIC 元数据 → 技术文档 → 代码生成 → 激活 → 冒烟测试的 AI 驱动闭环。

支持对象类型：**REPORT**、**CLAS**、**FUGR/FM**、**INTF**、**Include**。

## 架构

```
Claude Code → Bash → node scripts/rfc_client.js → node-rfc → SADT_REST_RFC_ENDPOINT → SAP
                  → node scripts/deploy_rfc.js   → node-rfc → SADT_REST_RFC_ENDPOINT → SAP
```

**node-rfc 直连**，无 MCP 服务器、无 HTTP 代理中间层。所有操作通过 `scripts/rfc_client.js`（统一查询入口）和 `scripts/deploy_rfc.js`（部署编排）执行。

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

### Skill 文档（`.claude/skills/sap-report-automation-workflow/`）

| 文件 | 用途 |
|------|------|
| `SKILL.md` | 主工作流定义（6 阶段 + 门禁 + 反模式自检） |
| `sap-operations-reference.md` | 全部 SAP 操作入参/出参实测手册 |
| `abap-syntax-quickref.md` | ABAP 语法速查（ECC→S4HANA→Cloud） |
| `troubleshooting.md` | 卡点速查（DDIC/部署/代码/连接） |
| `reference.md` | ABAP 参考源 + 脚本库 |
| `mcp-contract.md` | RFC ADT 端点 + rfc_client.js 手册 |

### 核心脚本（`scripts/`）

| 脚本 | 用途 | 频率 |
|------|------|------|
| `rfc_client.js` | 统一 RFC ADT 客户端（discovery/search/SQL/source） | 每次会话 |
| `rfc_fetch_ddic.js` | 单表 DDIC 元数据一键拉取 → JSON | 每张表 |
| `rfc_dual_check.js` | 双系统连通检测 | 每次会话 |
| `deploy_rfc.js` | 部署编排（创建→Lock→上传→语法检查→激活） | 每个程序 |
| `verify_report.js` | 冒烟测试（执行报表 + 多参数比对） | 每个程序 |
| `test_rfc.js` | RFC 环境诊断（DLL + node-rfc + 连接） | 首次/故障 |
| `release_locks.js` | 应急释放 SAP 锁 | 按需 |
| `fetch_table.js` | DDIC 端点统一取数（完整 SELECT，WHERE 可靠） | 每报表 |
| `data_sampler.js` | fetch_table.js 兼容包装 | 每报表 |
| `extract-docx.js` | DOCX 功能说明书文本提取 | 按需 |
| `modules/` | 共享模块（env/sap-connection/adt-request/lock/create/upload/activate 等） | — |

## 工作流阶段

| 阶段 | 产物 | SAP 操作 |
|------|------|---------|
| S0 | RFC 环境验证 | `test_rfc.js` + `rfc_dual_check.js` |
| S1 | `spec/functional-spec-ai.md` | — |
| S1.5 | 对象名确认 | `rfc_client.js --search` |
| S2 | `metadata/tables/<T>.json` | `rfc_fetch_ddic.js --env=.env.data <T>` |
| S2.1 | `spec/fs-ddic-verification.md` | 逐字段存在性 + 类型 + 语义验证 |
| S2.5 | `metadata/performance-estimate.md` | `rfc_client.js --sql COUNT --table <T>` |
| S3 | `docs/tech-design.md`（含字段契约 + 选择屏幕字段角色分析） | — |
| S3.5 | `docs/fs-coverage.md` | — |
| S3.6 | `docs/deployment-config.md` | — |
| S4 | `abap/sources/*.abap` | — |
| S5 | 激活 | `deploy_rfc.js <程序名>` |
| S5.5 | `output/<程序>/smoke-test.md` | `fetch_table.js` + `verify_report.js` |

### 全阶段 SAP 命令速查

```bash
# S0 — 环境诊断
node scripts/test_rfc.js
node scripts/rfc_dual_check.js

# S0 — 权限探测
node scripts/rfc_client.js --sql "SELECT COUNT(*) AS CNT FROM TADIR WHERE PGMID EQ 'R3TR'" --table TADIR

# S1.5 — 查对象名
node scripts/rfc_client.js --search "ZSAP_FI086"

# S2 — 拉 DDIC 元数据
node scripts/rfc_fetch_ddic.js --env=.env.data BKPF output/<prog>/metadata/tables/

# S2.5 — 主表 COUNT
node scripts/rfc_client.js --env=.env.data --sql "SELECT COUNT(*) AS CNT FROM <T>" --table <T>

# S5 — 部署
node scripts/deploy_rfc.js <程序名>

# S5.5 — 取数（DDIC 端点，完整 SELECT）
node scripts/fetch_table.js --table=FAGLFLEXT --where="RYEAR = '2026'" --fields=RYEAR,RACCT --rows=50

# S5.5 — 冒烟测试
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
│   └── functional-spec-ai.md
├── metadata/tables/           # S2: DDIC 元数据
│   └── <TABNAME>.json
├── docs/                      # S3: 技术文档
│   ├── tech-design.md         # 字段契约 + 关联 + WHERE
│   ├── fs-coverage.md         # FS 字段→代码 逐项对齐
│   ├── template-mapping.md    # INCLUDE 映射
│   ├── deployment-config.md   # 包/请求号/模板
│   ├── stage-gate.md          # 阶段门禁状态
│   └── smoke-test.md          # 冒烟测试结果
└── abap/sources/              # S4: 源码
    ├── <name>.abap            # 主程序
    ├── <name>T01.abap         # TOP Include
    ├── <name>SEL.abap         # 选择屏幕
    └── <name>F01.abap         # FORM 子程序
```

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| **V3.1** | 2026-06-24 | S2.1 FS→DDIC 验证、选择屏幕文本运行时、冒烟测试标准化、fetch_table.js、GitHub 推送准则 |
| V3.0 | 2026-06-24 | RFC ADT 直连架构：去除 MCP/代理中间层，统一走 node-rfc → SADT_REST_RFC_ENDPOINT |
| V0.3 | 2026-06-10 | FM 创建流程（IMPORTING/EXPORTING/TABLES + RFC）；冒烟测试真实数据验证；配置去硬编码 |
| V0.2 | 2026-06-09 | 冒烟测试方法论修正（先查源表→手工预期→跑程序→比对）；去敏感信息 |
| V0.1 | 2026-04-27 | 初始版本：REPORT 全流程、双系统架构、RFC 代理模式 |
