# SAP 报表自动化工作流 - Skill 打包与分发指南

## 包结构

```
sap-report-automation-workflow/
├── .claude/
│   └── skills/
│       └── sap-report-automation-workflow/
│           ├── SKILL.md              # Claude Skill 主文档
│           ├── mcp-contract.md       # MCP 工具契约与易错点
│           ├── reference.md          # RFC/ADT 参考与备选实现
│           └── templates/
│               └── functional-spec-ai.md
├── scripts/
│   ├── setup.js                      # 环境初始化检查
│   ├── healthcheck.js                # MCP + SAP 连接健康检查
│   └── stage-check.js                # 工作流阶段门禁检查
├── templates/
│   └── report/                       # 新建报表的标准目录模板
│       ├── spec/
│       │   └── functional-spec-ai.md
│       ├── docs/
│       │   ├── tech-design.md
│       │   ├── fs-coverage.md
│       │   ├── template-mapping.md
│       │   └── stage-gate.md
│       ├── metadata/
│       │   └── tables/
│       └── abap/
│           └── sources/
├── .env.example                      # SAP 连接配置模板
├── .mcp.json.template                # MCP 注册配置模板
├── mcp-launcher.js                   # MCP 启动器（设置 SAPNWRFC_HOME + PATH）
├── README.md                         # 人类可读的使用说明
└── setup-guide.md                    # 首次部署指南
```

## 依赖管理（不打包大文件，用脚本引导）

| 依赖 | 是否打包 | 获取方式 |
|------|---------|---------|
| `mcp-abap-adt`（fr0ster 版） | 否 | `git clone + npm install + npm run build` |
| `node-rfc` | 否 | `npm install`（mcp-abap-adt 依赖） |
| SAP NW RFC SDK | **是**（已内置） | 包内包含 `NW-RFC-SDK/nwrfcsdk/` |
| Node.js ≥ 22 | 否 | 用户自行安装 |

### NW-RFC-SDK 已内置

本 Skill 包已包含已解压的 `NW-RFC-SDK/nwrfcsdk/`（约 50 MB）及原始 `.zip` 安装包，接收方无需再从 SAP Support Portal 下载。若需更新版本，可替换 `NW-RFC-SDK/` 下的文件。

## 开包即用流程

1. **解压 Skill 包**到工作目录
2. **复制 `.env.example` → `.env`**，填入真实 SAP 连接信息
3. **放置 NW-RFC-SDK**：下载 `nwrfc750P_X-XXXXXXXX.zip`，解压到 `NW-RFC-SDK/`
4. **运行 `node scripts/setup.js`**：检查环境是否就绪
5. **运行 `node scripts/healthcheck.js`**：验证 MCP + SAP 连接
6. **开始工作流**：按 SKILL.md 的阶段 1→5 执行

## 针对 Claude Code 的 MCP 注册

### 方案 A：fr0ster/mcp-abap-adt（Claude 端推荐，支持 RFC + HTTP）

```bash
git clone https://github.com/fr0ster/mcp-abap-adt.git
cd mcp-abap-adt
npm install
npm run build
```

`.mcp.json`：
```json
{
  "mcpServers": {
    "abap-adt": {
      "command": "node",
      "args": ["/path/to/workflow/mcp-launcher.js"]
    }
  }
}
```

`mcp-launcher.js` 会自动：
- 设置 `SAPNWRFC_HOME` → `NW-RFC-SDK/nwrfcsdk`
- 将 SDK `lib` 目录加入 PATH
- 启动 `mcp-abap-adt/dist/server/launcher.js`
- 自动读取工作目录的 `.env`

### 方案 B：mario-andreschak/mcp-abap-abap-adt-api（Cursor/HTTP 端）

见 `reference.md` 中的详细说明。

## 迁移到另一台机器

只需复制以下文件（不包含 node_modules / NW-RFC-SDK）：
- `.claude/skills/sap-report-automation-workflow/`
- `scripts/`
- `templates/`
- `.env.example`
- `.mcp.json.template`
- `mcp-launcher.js`

目标机器执行：
1. `git clone https://github.com/fr0ster/mcp-abap-adt.git && cd mcp-abap-adt && npm install && npm run build`
2. 下载 NW-RFC-SDK 并解压
3. `cp .env.example .env` 并填写
4. `node scripts/setup.js && node scripts/healthcheck.js`
