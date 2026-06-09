# SAP 报表自动化工作流（Claude Skill）

端到端 SAP ABAP 开发对象自动化工作流：从功能规格（FS）到 SAP 系统激活的 AI 驱动闭环。

支持对象类型：REPORT、CLAS、FUGR/FM、INTF、Include。

## 包含内容

- **Claude Skill** (`.claude/skills/sap-report-automation-workflow/`)：阶段门禁、字段契约、元数据驱动规范、ABAP 语法速查
- **自动化脚本** (`scripts/`)
  - `test_rfc.js` — RFC 环境诊断（DLL、连接、PING）
  - `test_mcp_login.js` — MCP + RFC 代理端到端连通测试
  - `fetch_metadata.js` — 批量拉取透明表 DDIC 元数据
  - `perf_estimate.js` — 主表 COUNT 预估与性能建议
  - `deploy_rfc.js` — 主部署脚本（创建主程序 + Include / 语法检查 / 激活）
  - `deploy_includes_only.js` — 仅更新 Include（主程序已存在时）
  - `verify_report.js` — 通用报表真实数据校验（动态字段展示，多参数范围并行测试）
  - `release_locks.js` — 应急释放当前用户在 SAP 中的所有锁
  - `unlock_prog.js` / `unlock_includes.js` / `unlock_includes_v2.js` — 应急解锁指定对象
  - `extract-docx.js` — DOCX 功能说明书文本提取
  - `modules/` — ADT 原子操作模块（env、sap-connection、lock/unlock、create/upload、syntax-check、activate 等）
- **根目录辅助脚本**
  - `rfc-proxy-server.js` — RFC ADT 代理服务器（HTTP → RFC 转发）
  - `mcp-launcher.js` — MCP 启动包装器（自动设置 SAPNWRFC_HOME + PATH）
- **SAP NW RFC SDK** (`NW-RFC-SDK/`)：已解压就绪，开箱即用
- **配置**：`.mcp.json`（MCP 服务器注册）、`.env` / `.env.300`（SAP 连接凭据，不纳入版本控制）

## 当前架构

```
Claude Code → mcp-abap-abap-adt-api (MCP) → HTTP localhost:9876
→ rfc-proxy-server.js → node-rfc → SADT_REST_RFC_ENDPOINT → SAP
```

- **MCP 包**：`mcp-abap-abap-adt-api`（内置，无需 clone）
- **连接方式**：RFC via `SADT_REST_RFC_ENDPOINT`（支持 SAP Router）
- **双系统架构**：200（开发）通过 `abap-adt` → 300（数据）通过 `abap-adt-data`
- **配置位置**：项目根目录 `.mcp.json`（不是 `.claude/settings.json`）

## 快速开始

1. **构建 MCP 服务器**：
   ```bash
   cd mcp-abap-abap-adt-api
   npm install
   npm run build
   cd ..
   ```
2. **安装根目录依赖**：`npm install`（安装 `node-rfc`）
3. **配置 SAP 连接**：在项目根目录创建 `.env` 和 `.env.300`，填入真实 SAP 地址、凭据、Router（字段见下方）
4. `node scripts/test_rfc.js` — 检查 RFC 环境
5. `node rfc-proxy-server.js` — 启动代理（后台运行）
6. 在 Claude Code 中触发报表开发工作流

### `.env` / `.env.300` 字段清单

```bash
SAP_URL=http://<your-sap-host>:8000
SAP_CLIENT=<client>
SAP_USERNAME=<username>
SAP_PASSWORD=<password>
SAP_LANGUAGE=ZH
SAP_SID=<sid>
SAP_SYSNR=<sysnr>
SAP_ROUTER=<router-string>
SAP_CONNECTION_TYPE=rfc
```

`.env` 对应 200 开发系统，`.env.300` 对应 300 数据系统。300 仅用于 `runQuery`/`tableContents` 数据查询。

## 产物目录（按对象名隔离）

```
output/<object>/
  spec/
    functional-spec-raw.md
    functional-spec-ai.md
  metadata/
    tables/<TABNAME>.json
    performance-estimate.md
  docs/
    tech-design.md
    fs-coverage.md
    template-mapping.md
    deployment-config.md
    stage-gate.md
    smoke-test.md
  abap/sources/
    <name>.abap      # REPORT: 主程序
    <name>T01.abap   # REPORT: TOP Include（类型定义）
    <name>SEL.abap   # REPORT: 选择屏幕
    <name>F01.abap   # REPORT: 逻辑处理
    <name>.clas.abap # CLASS: 类定义+实现
    <name>.intf.abap # INTF: 接口定义
    <name>.fugr.abap # FUGR: 函数组
```

## 冒烟测试流程（V0.2 硬性规则）

**正确顺序（不可颠倒）**：

1. **先查源表**：`runQuery`（300）取具体科目的原始列值（HSLxx/TSLxx），手工计算预期输出
2. **再跑程序**：`verify_report.js` 执行报表，获取实际输出
3. **逐项比对**：实际值 = 预期值 → PASS；不一致 → 查代码 Bug

**三条铁律**：
- 金额为 0 ≠ Bug（数据可能在该期间无活动）
- 子范围 = 全范围 ≠ Bug（数据可能集中在该子范围）
- 预期值必须来自源表手工计算，不准用程序输出倒推

```bash
# 多组参数并行测试
node scripts/verify_report.js <程序名> P_xxx=<值> "S_xxx=范围1,范围2,范围3"
```

## 工作流阶段

| 阶段 | 产物 | 门禁 |
|------|------|------|
| S0 | MCP 双系统联通 | `abap-adt`(200) + `abap-adt-data`(300) 均通 |
| S1 | `output/<object>/spec/functional-spec-ai.md` | 功能规格就绪 |
| S1.5 | SAP 对象名存在性检查 | 目标对象名在 SAP 中不存在（或用户确认覆盖） |
| S2 | `output/<object>/metadata/tables/*.json` | 透明表元数据落盘 |
| S2.5 | `output/<object>/metadata/performance-estimate.md` | 主表 COUNT + 分页建议 |
| S3 | `output/<object>/docs/tech-design.md` | 字段契约 + 关联 + WHERE |
| S3.5 | `output/<object>/docs/fs-coverage.md` | FS 字段与代码逐项对齐 |
| S3.6 | `output/<object>/docs/deployment-config.md` | 开发包 / 请求号 / 模板确认 |
| S4 | `output/<object>/abap/sources/*.abap` | 按模板 + 契约 + 元数据生成代码 |
| S5 | 激活记录 | `deploy_rfc.js` 部署 + 语法检查 + 激活 |
| S5.5 | `output/<object>/docs/smoke-test.md` | 冒烟测试通过（含数据抽样验证） |

## 已知限制

- **MCP 直接写 Include**：当前 MCP `setObjectSource` 工具硬编码 `PROG/P`，若直接传入 Include 名称会把对象创建为同名的可执行程序（类型错位）。阶段 5 部署请使用 `scripts/deploy_rfc.js`。
- **激活主程序即可**：主程序激活时 SAP 会自动处理其引用的 Include。
- **文本元素 / GUI Status**：ADT REST API 不支持自动写入，部署后需在 SE80 手动维护。GUI Status 使用 SAPLKKBL 标准工具栏。
- **部分 ADT 端点**：`datapreview/freestyle` 等端点在 `SADT_REST_RFC_ENDPOINT` 通道下不支持。

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.2 | 2026-06-09 | 冒烟测试方法论修正（先查源表→手工预期→跑程序→比对）；`verify_report.js` 动态字段；去硬编码敏感信息 |
| v0.1 | 2026-04-27 | 初始版本：REPORT 全流程、双系统架构、RFC 代理模式 |
