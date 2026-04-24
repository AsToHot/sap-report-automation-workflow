# SAP 报表工作流：参考与备选实现

## 与 Eclipse ADT 对齐（同一后端契约）

- **Eclipse ADT** = 运行在 Eclipse 上的 **ABAP Development Tools**；日常简称「ADT」即指该产品，**无第二套 ADT 标准**。
- 本工作流中的 **`ai-abap` MCP** 通过 **ADT REST**（`/sap/bc/adt/`）访问 AS ABAP，与 Eclipse ADT 调用的**同一类 HTTP 接口**（abap-adt-api 生态）。因此：**能在 Eclipse ADT 里连上并编辑的开发对象，在 MCP 连通且权限一致的前提下，应能同样读写与激活**；`SAP_URL` 须为可访问该系统的 **HTTPS 基地址**（经 Web Dispatcher / 反向代理 / 网络路由后的终端 URL，与 Eclipse 中「系统 URL」应对齐）。
- **差异**：MCP 在 Claude Code 中自动化执行；不替代 Eclipse GUI。锁、传输、并发编辑等行为与 Eclipse ADT 一致，需注意冲突。

## Eclipse ADT 同源 MCP（ai-abap）源码仓库（部署优先）


| 优先级    | 仓库                                                                                                  | 说明                                                                                |
| ------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **首选** | [mario-andreschak/mcp-abap-abap-adt-api](https://github.com/mario-andreschak/mcp-abap-abap-adt-api) | TypeScript，基于 abap-adt-api；与常见 `settings.json` 中 `node .../dist/index.js` 形态一致。 |
| **备选** | [fr0ster/mcp-abap-adt](https://github.com/fr0ster/mcp-abap-adt)                                     | 社区维护活跃，支持多传输方式；按仓库 README 调整启动命令与依赖。                                              |


### 本地构建（典型步骤）

以首选仓库为例（以官方 README 为准）：

```bash
git clone https://github.com/mario-andreschak/mcp-abap-abap-adt-api.git
cd mcp-abap-abap-adt-api
npm install
npm run build
```

记录 `**dist/index.js`（或 README 指明的入口）的绝对路径**，写入 Claude Code MCP 的 `args`。

### 自动安装脚本（代理侧直接执行，不要把脚本贴给用户让他自己跑）

> **适用条件**：SKILL.md 阶段 0.1 探测到 MCP `未注册` 或 `已注册未连通`。代理应使用自身的 Shell 工具在用户机上直接执行下列命令（中断 → 自动重试一次 → 仍失败再输出结构化诊断交给用户）。

**Windows（PowerShell）** — 一键克隆 + 构建 + 打印入口：

```powershell
$ErrorActionPreference = "Stop"
$dst = "$env:USERPROFILE\mcp-servers\mcp-abap-abap-adt-api"
New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
if (-not (Test-Path (Join-Path $dst ".git"))) {
  git clone https://github.com/mario-andreschak/mcp-abap-abap-adt-api.git $dst
} else {
  git -C $dst pull --ff-only
}
Push-Location $dst
npm install
npm run build
Pop-Location
$entry = Join-Path $dst "dist\index.js"
if (-not (Test-Path $entry)) { throw "Build 产物缺失：$entry（请检查 package.json 的 main/bin）" }
Write-Host "ENTRY=$entry"
```

**macOS / Linux（bash）**：

```bash
set -euo pipefail
DST="$HOME/mcp-servers/mcp-abap-abap-adt-api"
mkdir -p "$(dirname "$DST")"
if [ ! -d "$DST/.git" ]; then
  git clone https://github.com/mario-andreschak/mcp-abap-abap-adt-api.git "$DST"
else
  git -C "$DST" pull --ff-only
fi
cd "$DST"
npm install
npm run build
ENTRY="$DST/dist/index.js"
[ -f "$ENTRY" ] || { echo "Build 产物缺失：$ENTRY"; exit 1; }
echo "ENTRY=$ENTRY"
```

### 合并写入 `.claude/settings.json` 的算法（代理侧）

1. **定位目标文件**（按用户偏好；默认用户级，密码安全优先）：
   - 默认：Windows `%USERPROFILE%\.claude\settings.json`；macOS/Linux `~/.claude/settings.json`
   - 仅当用户明确希望项目级时：`{workspaceFolder}/.claude/settings.json`（并同时把该路径追加进 `.gitignore`）
2. **读 → 合并 → 写**，不要覆盖已有 `mcpServers` 下的其他条目：
   - 若无文件：创建骨架，只有 `mcpServers.ai-abap`
   - 若有文件：解析 JSON，定位或创建 `mcpServers.ai-abap`，仅更新 `command`、`args[0]=ENTRY`、`env.*`、`disabled=false`
3. **env 写入策略**：
   - 已从用户获取的字段：直接填真实值
   - 尚未获取的字段：**留空字符串** `""`，**严禁**写 `password`、`your-user`、`example.com` 之类占位符冒充已配置
4. 写入后立即在会话里告知用户「已更新 settings.json，请重启 Claude Code」，然后代理自己尝试再次 `healthcheck`（最多 3 次）。

### `healthcheck` 失败时的结构化诊断（输出给用户的最小集合）

- `entryExists`：`args[0]` 指向的文件是否存在
- `settingsJsonPath`：实际写入的配置文件路径
- `envFilled`：哪些 `SAP_*` 仍为空
- `directNodeStderr`：手动 `node <entry>` 启动 1–2 秒后的 stderr 摘要（帮助用户辨别是 MCP server 自己启动失败还是 Claude Code 未重启）

### Claude Code `settings.json` 示例（`mcpServers.ai-abap`）

将 `command`、`args` 指向本机构建产物；`env` 由用户提供（勿把真实密码提交到 Git）。

```json
{
  "mcpServers": {
    "ai-abap": {
      "command": "node",
      "args": ["C:/path/to/mcp-abap-abap-adt-api/dist/index.js"],
      "env": {
        "SAP_URL": "https://host:port",
        "SAP_USER": "",
        "SAP_PASSWORD": "",
        "SAP_CLIENT": "000",
        "SAP_LANGUAGE": "ZH",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      },
      "disabled": false
    }
  }
}
```

Claude Code 中 MCP 服务器标识符常为 `**user-ai-abap**`（内部名 `**ai-abap**`），与 `mcpServers` 的键名一致即可。

**安全**：含密码的 `settings.json` 应加入 `.gitignore`，或使用仅本机用户级配置 `%USERPROFILE%\.claude\settings.json`。

### Cursor

将同一 Node 进程作为 MCP server 注册到 Cursor 的 MCP 配置（`.cursor/mcp.json`）；路径与字段名以 Cursor 当前文档为准。Skill 仅要求：**先能成功执行一次 healthcheck 类调用** 再进入报表工作流。

### OpenClaw

将同一 Node 进程作为 MCP server 注册到 OpenClaw 的 MCP 配置（路径与字段名以 `https://docs.openclaw.ai` 当前文档为准）；Skill 仅要求：**先能成功执行一次 healthcheck 类调用** 再进入报表工作流。

---

## 成熟方案（可与本工作流组合）


| 方案                                          | 用途                                                     |
| ------------------------------------------- | ------------------------------------------------------ |
| **ADT REST** `/sap/bc/adt/`                 | Eclipse ADT 同款 API；稳定、可脚本化；MCP `user-ai-abap` 已封装常用操作。 |
| **abapify/adt-cli**（TypeScript）             | 契约化 HTTP 客户端与 CLI，适合流水线里拉代码、检查、部署。                     |
| **abapGit + CI**                            | `ZABAPGIT_CI` 或 REST 跑语法/对象检查；适合合并后与系统侧校验。             |
| **Jenkins / GitHub Actions + On-Prem ABAP** | 社区常见模式：凭证与网络由运维管控，代理只负责触发与收集日志。                        |


本 Skill 的「对话代理」负责需求结构化、设计文档与修错循环；**批量门禁**仍建议用 abapGit CI / ATC。

## RFC：`DDIF_FIELDINFO_GET`（备选）

当不能使用 ADT DDIC 工具时，对每个透明表调用：

- **IMPORT**：`TABNAME`（表名，大写）
- **TABLES**：`DFIES_TAB`（字段目录行）、`X031L_TAB`（技术信息，视版本而定）

注意：

- 需 SM59/网关与 RFC 授权；函数在多数版本可用，若禁用需 Basis 放行。
- Python 示例依赖 `pyrfc` 与 **SAP NW RFC SDK**（需从 SAP Support Portal 获取并配置 `SAPNWRFC_HOME`）。

伪代码逻辑：

```python
# 需安装 pyrfc 与 NW RFC SDK；仅作集成参考
from pyrfc import Connection

def fetch_ddif(conn_params, tabname):
    with Connection(**conn_params) as conn:
        result = conn.call("DDIF_FIELDINFO_GET", TABNAME=tabname)
        return result  # 序列化到 metadata/tables/<TABNAME>.json
```

## 透明表字段信息：ADT 正确调用（避免慢与试错）

**问题**：`ddicElement` / `ddicRepositoryAccess` 在多数场景下**不是**「整表字段目录」接口，返回体可能很薄，容易被误判为「参数不对、反复试错」。

**首选（推荐，一次到位、与 ADT 浏览器同源）**

- MCP 工具：`**getObjectSource`**
- 参数：`**objectSourceUrl`** = `**/sap/bc/adt/ddic/tables/<表名>/source/main**`
  - `<表名>` 与 ADT URI 一致，**通常小写**（如 `bkpf`、`bseg`）；大写多数系统也可接受，但为减少歧义统一用小写。
- 返回：表的 **源码形态定义**（S/4 常见为 **CDS `define table ...`**），**包含全部字段、主键、外键线索**，适合直接写入 `metadata/tables/<TABNAME>.json` 的 `source` 字段或再解析出字段列表。

**备选（需 SQL 权限，但同样快）**

- MCP 工具：`**runQuery`**
- 示例：`SELECT TABNAME, FIELDNAME, POSITION, KEYFLAG, DATATYPE, LENG, DECIMALS, ROLLNAME FROM DD03L WHERE TABNAME = 'BKPF' AND AS4LOCAL = 'A' ORDER BY POSITION`

**何时用 RFC `DDIF_FIELDINFO_GET`**

- 仅当 **ADT 不可用**或需要 **与 SAP GUI SE11 完全一致的 DFIES 结构** 时再启用（见上文 RFC 节）。

**不要用错工具**


| 工具                   | 典型用途                | 不适合                    |
| -------------------- | ------------------- | ---------------------- |
| `getObjectSource`    | 拉表/结构/类 **源码**      | —                      |
| `ddicElement`        | DDIC 元素 **导航/属性摘要** | 当作完整字段字典会失望            |
| `runQuery` + `DD03L` | 字段级 **行列清单**        | 无 Open SQL / DDIC 读权限时 |


## 错误处理与日志

- ADT 激活接口通常返回 XML/JSON 混合的 **消息列表**；提取 `severity`、`message`、`location`。
- 将每次失败 **追加** 到 `docs/activation-log.md`，便于审计与复盘。
