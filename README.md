# SAP 报表自动化工作流（Claude Skill）

端到端 SAP ALV 报表开发工作流：从功能规格（FS）到 SAP 系统激活的 AI 驱动闭环。

## 包含内容

- **Claude Skill** (`.claude/skills/sap-report-automation-workflow/`)：阶段门禁、字段契约、元数据驱动规范
- **自动化脚本** (`scripts/`)
  - `setup.js` — 环境检查（.env、SDK、node-rfc、MCP 构建产物）
  - `healthcheck.js` — MCP + SAP 连接探测
  - `stage-check.js` — 工作流阶段门禁检查（S1~S5）
  - `pack-skill.js` — 打包本 Skill 为可分发 zip
- **SAP NW RFC SDK** (`NW-RFC-SDK/`)：已解压就绪，开箱即用
- **示例项目**：`spec/`、`docs/`、`metadata/`、`abap/sources/`（EE041 ZSAP_FI250）
- **配置模板**：`.env.example`、`.mcp.json`、`mcp-launcher.js`

## 快速开始

1. 解压 `sap-report-automation-workflow-skill.zip`
2. `git clone https://github.com/fr0ster/mcp-abap-adt.git && cd mcp-abap-adt && npm install && npm run build`
3. `cp .env.example .env`，填入真实 SAP 连接信息
4. `node scripts/setup.js` — 检查环境
5. `node scripts/healthcheck.js` — 验证 SAP 连接
6. 在 Claude Code 中触发报表开发工作流

## 工作流阶段

| 阶段 | 产物 | 门禁 |
|------|------|------|
| S1 | `spec/functional-spec-ai.md` | 功能规格就绪 |
| S2 | `metadata/tables/*.json` | 透明表元数据落盘 |
| S2.5 | `metadata/performance-estimate.md` | 主表 COUNT + 分页建议 |
| S3 | `docs/tech-design.md` | 字段契约 + 关联 + WHERE |
| S3.5 | `docs/fs-coverage.md` | FS 字段与代码逐项对齐 |
| S4 | `abap/sources/*/...abap` | 按模板生成代码 |
| S5 | 激活记录 | `syntaxCheck` + `activate` 通过 |
| S5.5 | `docs/smoke-test.md` | 源码一致 / 执行探针 / ALV 列核对 |

## 双 MCP 方案

| 场景 | MCP | 连接方式 |
|------|-----|---------|
| 内网 + SAP Router | **fr0ster/mcp-abap-adt** | RFC (`SADT_REST_RFC_ENDPOINT`) |
| 公网 / 无 Router | mario-andreschak/mcp-abap-abap-adt-api | HTTP ADT |

本包默认使用 **fr0ster 版 + RFC**（`NW-RFC-SDK` 已内置）。
