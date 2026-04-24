# MCP 可行性分析与社区价值评估

## 1. "这套东西"能否打包成 MCP？

**不能，也不应该。**

当前工作流是 **"基于 MCP 的业务流程自动化框架"**，而非 MCP 协议实现本身。两者的层级关系如下：

| 层级 | 对应物 | 作用 |
|------|--------|------|
| 协议层 | Model Context Protocol (MCP) | 定义工具发现、调用、返回的 JSON-RPC 契约 |
| 服务器层 | `mcp-abap-adt`（fr0ster 版）| 封装 ADT REST / RFC，暴露 `getObjectSource`、`setObjectSource`、`activate` 等工具 |
| 业务框架层 | **本工作流** | 定义 "FS → 元数据 → 设计 → 代码 → 激活" 的 SOP、阶段门禁、契约验证 |

把业务框架层"打包成 MCP"属于**概念混淆**。MCP 服务器只负责"暴露工具"，不负责"规定什么时候该用什么工具、按什么顺序、产出什么文档"。

**但工作流中有一个独立组件可以反哺上游 MCP：**

- **`SAP_ROUTER` 环境变量桥接修复**（`mcp-abap-adt/dist/server/launcher.js` 第 77-84 行的 `keys` 数组）
- 这是一个明确的 **bug fix**，应作为 PR 提交给 `fr0ster/mcp-abap-adt`。

---

## 2. 跟原来 MCP ADT 的区别

### 2.1 能力互补，非替代

| 维度 | MCP ADT（fr0ster） | 本工作流 |
|------|-------------------|---------|
| **定位** | 通用工具集（CRUD + 查询） | 报表开发 SOP（流程 + 模板 + 门禁） |
| **使用者** | 任何需要操作 SAP 开发对象的 AI Agent | 专注"SAP ALV 报表从 0 到 1"的 Claude Code 会话 |
| **输入** | 工具调用参数（JSON） | 功能规格（Markdown）、参考模板、SAP 连接配置 |
| **输出** | 对象源码、激活结果、查询数据 | 完整报表项目（规格 + 元数据 + 设计文档 + ABAP 代码 + 激活记录） |
| **约束** | 无业务约束，只验证参数合法性 | 强约束：元数据驱动、字段契约、阶段门禁、禁止凭语感写 Open SQL |
| **连接方式** | HTTP ADT 或 RFC | 当前实际使用 **RFC + SAP Router**（修复后） |

### 2.2 为什么用 fr0ster 版而不是 mario-andreschak 版？

当前工作流在 Claude 端使用 **fr0ster/mcp-abap-adt**，原因：

1. **RFC 支持**：支持通过 `node-rfc` 调用 `SADT_REST_RFC_ENDPOINT`，适合需要 SAP Router 的内网环境。
2. **内置 SAP Router 解析**：`RfcAbapConnection` 已读取 `SAP_ROUTER` 环境变量（修复 launcher 桥接后即生效）。
3. **多认证模式**：除 basic 外，还支持 JWT/XSUAA、service-key（BTP 场景）。
4. **自包含**：一个仓库覆盖 HTTP / RFC / SSE / StreamableHTTP 多种传输。

Cursor 端仍可用 mario-andreschak 版（纯 HTTP ADT），两者在工具名和契约上**不对等**，不能简单互换。Skill 文档已对此做隔离说明。

---

## 3. 发布到 GitHub 社区的价值

### 3.1 高价值：Skill / 模板项目

将本工作流作为 **GitHub 模板仓库（template repo）** 发布，价值明确：

- **目标用户**：SAP 开发团队、ABAP 顾问、企业内部 DevOps
- **解决的问题**：
  - 每次新建报表都要重新搭建目录结构、写同样的文档模板
  - AI 生成 ABAP 代码时"幻觉"字段名、表名，导致编译失败
  - 缺乏从需求到激活的完整可追溯链条
- **核心资产**：
  - `SKILL.md`（Claude Skill 规范）
  - `templates/functional-spec-ai.md`（标准化 FS 格式）
  - `docs/tech-design.md` 字段契约模式
  - `scripts/healthcheck.js` + `stage-check.js`（自动化门禁）
  - 阶段门禁（S1→S5.5）的增量更新策略

**建议仓库名**：`claude-sap-report-workflow` 或 `abap-report-automation-skill`

### 3.2 中等价值：上游 PR（SAP_ROUTER 修复）

将 `SAP_ROUTER` 桥接修复提交给 `fr0ster/mcp-abap-adt`：

- **影响范围**：所有使用 RFC 模式 + SAP Router 的用户
- **修复点**：`src/server/launcher.ts`（或 `dist/server/launcher.js`）的 `hydrateSystemContextFromEnvFile`
- **PR 标题建议**：`fix(launcher): bridge SAP_ROUTER from .env to process.env for RFC connections`

### 3.3 低价值：将工作流伪装成 MCP Server

不建议做一个"包裹层 MCP Server"来封装本工作流。原因：
- 增加无意义的抽象层
- 破坏 MCP 的通用性（其他 Agent 不需要报表开发的阶段门禁）
- 维护成本高（MCP 协议版本迭代时需同步更新）

---

## 4. 结论与建议行动

| 行动 | 优先级 | 形式 |
|------|--------|------|
| 将工作流打包为 GitHub Template Repo | **P0** | 公开仓库，含 Skill 文档 + 脚本 + 模板 |
| 向 fr0ster/mcp-abap-adt 提交 SAP_ROUTER PR | **P1** | 单文件修复，附带 RFC + Router 的测试说明 |
| 在 README 中对比 fr0ster vs mario-andreschak 的适用场景 | **P1** | 帮助用户根据自身网络环境选择 |
| 不做"工作流层 MCP Server" | — | 避免过度工程化 |
