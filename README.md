# SAP 报表自动化工作流（Claude Skill）

端到端 SAP ALV 报表开发工作流：从功能规格（FS）到 SAP 系统激活的 AI 驱动闭环。

## 包含内容

- **Claude Skill** (`.claude/skills/sap-report-automation-workflow/`)：阶段门禁、字段契约、元数据驱动规范
- **自动化脚本** (`scripts/`)
  - `test_rfc.js` — RFC 环境诊断（DLL、连接、PING）
  - `test_mcp_login.js` — MCP + RFC 代理端到端连通测试
  - `fetch_metadata.js` — 批量拉取透明表 DDIC 元数据
  - `perf_estimate.js` — 主表 COUNT 预估与性能建议
  - `deploy_rfc.js` — 主部署脚本（创建主程序 + Include / 语法检查 / 激活）
  - `deploy_includes_only.js` — 仅更新 Include（主程序已存在时）
  - `release_locks.js` — 应急释放当前用户在 SAP 中的所有锁
  - `unlock_prog.js` / `unlock_includes.js` / `unlock_includes_v2.js` — 应急解锁指定对象
  - `extract-docx.js` — DOCX 功能说明书文本提取
  - `modules/` — ADT 原子操作模块（env、sap-connection、lock/unlock、create/upload、syntax-check、activate 等）
- **根目录辅助脚本**
  - `rfc-proxy-server.js` — RFC ADT 代理服务器（HTTP → RFC 转发）
  - `mcp-launcher.js` — MCP 启动包装器（自动设置 SAPNWRFC_HOME + PATH）
- **SAP NW RFC SDK** (`NW-RFC-SDK/`)：已解压就绪，开箱即用
- **配置**：`.mcp.json`（MCP 服务器注册）、`.env`（SAP 连接凭据，不纳入版本控制）

## 当前架构

```
Claude Code → mcp-abap-abap-adt-api (MCP) → HTTP localhost:9876
→ rfc-proxy-server.js → node-rfc → SADT_REST_RFC_ENDPOINT → SAP
```

- **MCP 包**：`mcp-abap-abap-adt-api`（内置，无需 clone）
- **连接方式**：RFC via `SADT_REST_RFC_ENDPOINT`（支持 SAP Router）
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
3. **配置 SAP 连接**：在项目根目录创建 `.env`，填入真实 SAP 地址、凭据、Router（字段见下方）
4. `node scripts/test_rfc.js` — 检查 RFC 环境
5. `node rfc-proxy-server.js` — 启动代理（后台运行）
6. 在 Claude Code 中触发报表开发工作流

### `.env` 字段清单

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

## 产物目录（按程序名隔离）

```
output/<program>/
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
    <program>.abap      # 主程序
    <program>T01.abap   # 类型定义 Include
    <program>SEL.abap   # 选择屏幕 Include
    <program>F01.abap   # 逻辑处理 Include
```

## 工作流阶段

| 阶段 | 产物 | 门禁 |
|------|------|------|
| S1 | `output/<program>/spec/functional-spec-ai.md` | 功能规格就绪 |
| S2 | `output/<program>/metadata/tables/*.json` | 透明表元数据落盘 |
| S2.5 | `output/<program>/metadata/performance-estimate.md` | 主表 COUNT + 分页建议 |
| S3 | `output/<program>/docs/tech-design.md` | 字段契约 + 关联 + WHERE |
| S3.5 | `output/<program>/docs/fs-coverage.md` | FS 字段与代码逐项对齐 |
| **S3.6** | `output/<program>/docs/deployment-config.md` | **开发包 / 请求号 / 模板确认** |
| S4 | `output/<program>/abap/sources/*.abap` | 按模板生成代码 |
| S5 | 激活记录 | `deploy_rfc.js` 部署 + 激活 |
| S5.5 | `output/<program>/docs/smoke-test.md` | 源码一致 / 执行探针 / ALV 列核对 |

## 已知限制

- **MCP 直接写 Include**：当前 MCP `setObjectSource` 工具硬编码 `PROG/P`，若直接传入 Include 名称会把对象创建为同名的**可执行程序**（类型错位）。**阶段 5 部署请使用 `scripts/deploy_rfc.js`**，该脚本通过原生 ADT REST API（`SADT_REST_RFC_ENDPOINT`）分别创建主程序（`PROG/P`）和各 Include（`PROG/I`），并正确处理 lock / upload / activate 流程。
- **激活主程序即可**：主程序激活时 SAP 会自动处理其引用的 Include，无需单独激活 Include。
- **文本元素 / GUI Status**：当前 SAP 版本的 ADT REST API 不支持通过该端点自动写入文本元素和 GUI Status，部署后需在 SE80 中手动维护。
- **部分 ADT 端点**：`datapreview/freestyle` 等端点在 `SADT_REST_RFC_ENDPOINT` 通道下不支持，元数据查询应使用 `DDIF_FIELDINFO_GET` 或 `runQuery`。
