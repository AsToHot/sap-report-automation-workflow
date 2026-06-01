# 工作流卡点与提速参考（多轮实战沉淀）

> **用途**：代理在执行工作流各阶段遇到阻塞时，应先查阅本文的对应阶段章节，按"预判→预防→应对"顺序处理。本文不绑定任何特定程序。

---

## 目录

- [S0：MCP 连通](#s0-mcp-连通)
- [S1/S1.5：FS 处理与对象名确认](#s1s15-fs-处理与对象名确认)
- [S2：元数据拉取（最耗时阶段）](#s2-元数据拉取最耗时阶段)
- [S3：技术文档](#s3-技术文档)
- [S4：代码生成](#s4-代码生成)
- [S5：部署激活](#s5-部署激活)
- [通用提速原则](#通用提速原则)

---

## S0：MCP 连通

### 卡点：代理进程未启动

**现象**：MCP 调用报 `ECONNREFUSED` 或 `AggregateError`

**预判**：每次新会话，`rfc-proxy-server.js` 不会自动启动。

**预防**：进入阶段 1 前，先执行：
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:9876/sap/bc/adt/discovery
```
若返回非 200 → `node rfc-proxy-server.js &`（后台启动），等 3 秒后复验。

**应对**：若代理已启动但 MCP 仍不通 → 按 0.4.1 分层排查：DLL → 网络 → 认证 → 代理 → MCP。

### 卡点：`getObjectSource` 对 DDIC 表返回 404

**现象**：`getObjectSource` 用 URL `/sap/bc/adt/ddic/tables/<table>/source/main` 返回 404

**预判**：当前 SAP 版本大概率不支持此端点。

**预防**：**全程用 `runQuery → DD03L`** 拉取表结构，不用 `getObjectSource` 做 DDIC 拉取。`getObjectSource` 仅用于拉 ABAP 源码（如拉模板程序）。

---

## S1/S1.5：FS 处理与对象名确认

### 卡点：.docx FS 需要额外提取

**现象**：用户提供 `.docx` 文件，直接读返回乱码

**预防**：先用 `node scripts/extract-docx.js <path>` 提取文本，再写入 `functional-spec-raw.md`。

### 卡点：对象名冲突

**现象**：部署时才发现程序已存在（409）

**预防**：阶段 1.5 硬约束 —— **必须** `searchObject` 查主对象 + 所有 Include 名，任一已存在 → 停止并要用户确认。

---

## S2：元数据拉取（最耗时阶段）

### 核心原则

**不要逐表在对话中 MCP 调 runQuery**。每张表的原始 JSON（尤其是 BSEG/BKPF/MARA 这种 150-400 字段的表）会占满上下文。用批量脚本，结果直接写文件。

### 卡点：表多时 MCP 往返次数爆炸

**现象**：20 张表 × 每表一次 MCP 调用 = 10+ 轮对话，每次返回全量 JSON

**预防**：写 `batch_fetch_metadata.js`，内部串行调 MCP，但工具结果只输出一行摘要（"OK: X fields → file"），不把原始 JSON 带回对话。

**批量脚本设计**：
```
输入：表名数组 + 输出目录
流程：
  对每表：
    1. runQuery("SELECT FIELDNAME, POSITION, KEYFLAG, ROLLNAME, DATATYPE, LENG, DECIMALS FROM DD03L WHERE TABNAME = '<T>' ORDER BY POSITION", rowNumber=2000)
    2. 过滤掉 .INCLUDE / .INCLU--AP 行
    3. 写 <T>.json
  汇总：写 _errors.md
输出：console.log 每表一行摘要
```

**应对**：若批量脚本不可用，至少做到：
- `rowNumber` 设足够大（2000+），避免分页重试
- 2 并发是上限（SKILL 硬约束），出错立即降回串行
- 出现 `Internal server error` → 先按 0.8 检查代理，再决定是否记为对象失败

### 卡点：超大表 JSON 占满上下文

**现象**：BSEG ~400 字段、BKPF ~130 字段、MARA ~300 字段，raw JSON 20-60KB/表

**预防**：批量脚本只保存 FS 涉及的字段到 JSON，其余字段标注"省略"。

**应对**：若已拉取全量且在上下文中，优先处理掉（写文件后即可丢弃对话中的原始数据）。

### 卡点：`batch_fetch_metadata.js` 用错 API

**现象**：脚本调 `getObjectSource` `/sap/bc/adt/ddic/tables/<table>/source/main` 全部返回 405

**根因**：该脚本是早期遗留，用 `getObjectSource` 尝试拉 DDIC 表定义，但当前 SAP 不支持此端点。

**预防**：批量脚本改为 `runQuery → DD03L` 方式。脚本内部循环：`SELECT COUNT(*) AS CNT FROM DD03L WHERE TABNAME='<T>'` → `SELECT FIELDNAME, POSITION, KEYFLAG, ROLLNAME, DATATYPE, LENG, DECIMALS FROM DD03L WHERE TABNAME='<T>' ORDER BY POSITION` → 过滤掉 `.INCLUDE`/`.INCLU--AP` 行 → 写 `<T>.json`。

**应对**：若批量脚本不可用，MCP 逐表 `runQuery` 时至少做到 2 并发、rowNumber≥2000。

### 卡点：保存 JSON 用 heredoc 效率低

**预防**：让批量脚本直接 `fs.writeFileSync`。元数据 JSON 不要用 `write_to_file` 逐表手写——写一个 `save_metadata.js` 一次性保存已获取的所有表。

### 卡点：`abap/sources/` 目录与 SKILL 文档不一致

**现象**：SKILL 文档写产物放 `output/<obj>/abap/`，但 `deploy_rfc.js` 读 `output/<obj>/abap/sources/`。第一次部署直接报 `[FATAL] Source directory not found`。

**预防**：阶段 4 代码生成时，直接把 ABAP 源文件写入 `output/<obj>/abap/sources/`。SKILL 文档中的 `abap/` 目录保留作为最终产物的只读副本。

**应对**：若已写入 `abap/`，执行 `mkdir -p output/<obj>/abap/sources && cp output/<obj>/abap/*.abap output/<obj>/abap/sources/` 后重新部署。

---

## S3：技术文档

### 卡点：字段契约遗漏导致后续返工

**预防**：tech-design.md 的"字段契约"表必须逐行对照 `functional-spec-ai.md` 的每个输出列。每行必有：表名、字段名、DDIC 类型、元数据文件路径。缺一行 → 阶段 4 会凭空编字段。

---

## S4：代码生成

### 卡点：代码中表名/字段名与字段契约不一致

**现象**：FS 和 tech-design 字段契约明确写的表名是 A，但 ABAP 代码中写成了 B。激活报"组件 XXX 不存在"，排查发现 FROM 子句的表名用错。

**根因**：代理在写代码时**凭记忆或语感编写表名**，未逐项对照 tech-design.md 的字段契约表和 metadata JSON。这是 SKILL 阶段间强引用规则的核心防范目标——契约是对的，代码违反了契约。

**预防**：阶段 4 写代码时，打开三个文件同步对照：
- `tech-design.md`（字段契约列 + 表名）
- `metadata/tables/<T>.json`（确认字段的 DDIC 名称和类型）
- 代码文件本身

**具体操作**：写完 `SELECT ... FROM <table>` 后，立即回头在字段契约中找到该表名对应的行，确认表名一致。写完每个 TYPE 引用后，在 metadata JSON 的 `ROLLNAME` 字段找到对应的数据元素名。

**应对**：激活报错后，不要猜测改正——回到字段契约表，逐项比对报错行与契约行，确保代码中的每个表名/字段名都可在契约中找到原始出处。

### 卡点：`TYPE table-field` 写法不查 ROLLNAME

**现象**：手写 `TYPE bkpf-bukrs` 或 `TYPE faglflexa-docnr`，但 data element 名才是 ABAP 类型系统的标准引用方式。

**预防**：**统一从 metadata JSON 的 `ROLLNAME` 字段取数据元素名作为 TYPE 引用**：
- `TYPE bukrs`（ROLLNAME=BUKRS）
- `TYPE belnr_d`（ROLLNAME=BELNR_D）
- `TYPE racct`（ROLLNAME=RACCT）
- `TYPE prctr`（ROLLNAME=PRCTR）
- `TYPE vtcur12` / `TYPE vlcur12`（金额字段的 ROLLNAME）

生成代码前，在 metadata JSON 中找到每个字段对应的 `ROLLNAME` 值，直接作为 TYPE 引用。

### 卡点：CL_SALV_TABLE 调 `set_screen_status` 引用不存在的 GUI Status（硬约束，不可再犯）

**现象**：代码写 `gr_alv->set_screen_status( pfstatus = 'STANDARD' ... )`，但 ADT REST **无法创建** GUI Status（SE41）。程序中不存在该 GUI Status，运行时可能 dump。

**根因**：从旧模板（如 ZSAP_FI244 的 `'S1000'`）照搬。旧程序通过 SE80 手工创建了 GUI Status，ADT 部署的新程序没有。

**预防（硬规则）**：
- **CL_SALV_TABLE 自带标准工具栏**，**永远不要**调 `set_screen_status`。
- 若需控制按钮，用 `gr_alv->get_functions( )->set_all( abap_true )` 等 SALV 内置方法。
- 模板 ZSAP_FI244 中的 `'S1000'` 是**反例**——手工在 SE41 创建，ADT 下不可复制。

**正确写法**：
```abap
" CL_SALV_TABLE 自带工具栏，无需 set_screen_status
cl_salv_table=>factory( IMPORTING r_salv_table = gr_alv CHANGING t_table = gt_out ).
gr_alv->get_columns( )->set_optimize( 'X' ).
gr_alv->display( ).
```

**应对**：已部署代码写了 `set_screen_status` → 删除该调用，重新上传 F01 并激活。

### 卡点：new OpenSQL 要求逗号分隔字段列表（7.40+）

**现象**：激活报 `The elements in the "SELECT LIST" list must be separated using commas` 和 `If host variables are escaped using @, new OpenSQL must used`

**根因**：SAP 系统版本 ≥ 7.40，要求所有 OpenSQL 使用新语法：字段列表逗号分隔、host variables 用 `@` 转义。

**预防**：阶段 4 生成 SELECT 语句时**一律用逗号分隔字段**：
```abap
" ❌ 旧语法
SELECT bukrs gjahr belnr FROM bkpf INTO TABLE gt_data WHERE bukrs = p_bukrs.

" ✅ 新语法 (7.40+)
SELECT bukrs, gjahr, belnr FROM bkpf INTO TABLE @gt_data WHERE bukrs = @p_bukrs.
```

**应对**：激活报逗号错误时，逐条检查所有 SELECT 的字段列表。主 SELECT 容易加，**容易漏的是 LOOKUP 短查询**（`SELECT field1 field2 FROM table` → `SELECT field1, field2 FROM table`）。

### 卡点：FOR ALL ENTRIES 字段类型/长度必须一致

**现象**：激活报 `使用附加项 "FOR ALL ENTRIES IN itab" 时，字段"XXX" 和 "YYY" 必须具有相同类型和相同长度`

**根因**：`FOR ALL ENTRIES` 要求 WHERE 子句中两边字段的 DDIC 类型和长度完全一致。常见触发场景：
- 自定义表字段与标准表字段长度不同（如 Z 表用 CHAR 4 但 CEPC-KHINR 是 CHAR 12）
- 内表字段声明用了 `TYPE ztable-field`（继承自定义长度）但驱动表是标准表

**预防**：写 FOR ALL ENTRIES 前，比对两表字段的 DDIC 定义（ROLLNAME 一致则类型必一致；ROLLNAME 不同则需人工确认）。

**应对**：类型不匹配的替代方案：
- 方案 A：不用 FOR ALL ENTRIES，改为 SELECT 全表 + 应用层 SORT + BINARY SEARCH 过滤（适用于小表如 CEPC/CSKT）
- 方案 B：声明中间内表，字段类型用目标表的 ROLLNAME，将源表值赋值过去

---

## S5：部署激活

### 卡点：源码目录与脚本不匹配

**现象**：SKILL 文档写产物放 `output/<obj>/abap/`，但 `deploy_rfc.js` 读 `output/<obj>/abap/sources/`

**预防**：代码生成阶段直接写入 `output/<obj>/abap/sources/`。

### 卡点：语法检查端点 405

**现象**：`POST .../source/main?method=check` 返回 405 Method Not Allowed

**预判**：当前 SAP 版本不支持此 ADT 端点。

**预防**：不期望语法检查一定可用。`deploy_rfc.js` 已内置 fallback（405 → 标记 unavailable → 激活兜底验证语法）。

**应对**：激活失败时，解析激活返回的 `<msg type="E">` 错误消息，修正源码后重新上传 + 激活。

### 卡点：激活成功但 HTTP 200 包含错误（假成功）

**现象**：激活返回 HTTP 200，但响应体含 `<msg type="E">` 错误消息

**预防**：`activate-objects.js` 必须解析三种错误格式：
- `<msg type="E|A">`（SAP 消息格式）
- `<atom:entry>` category=error
- `<entry>` 简单格式

**应对**：若部署脚本报告成功但程序实际未激活 → 手动检查激活 XML 响应体。

---

## 通用提速原则

| 原则 | 说明 |
|------|------|
| **结果写文件，不占上下文** | 元数据拉取、批量查询的结果直接写磁盘，对话中只留一行摘要 |
| **脚本化 > 手写** | 任何需要重复 3+ 次的操作（如逐表拉元数据）写脚本 |
| **DDIC 数据元素做类型引用** | 不用 `TYPE table-field`，用 `ROLLNAME` 中的数据元素名 |
| **部署前本地校验表名** | FROM/JOIN 中的表名向 DD02L 验证 |
| **SAP 系统能力参差不齐** | 不假设 ADT 端点全可用，每个端点有 fallback 路径 |
| **代理随会话起停** | rfc-proxy-server 每次新会话需重启动，探测失败自动拉起 |
| **TY 结构字段先全后写** | 写 F01 前先扫一遍所有 `gs_out-xxx` 引用，对照 T01 的 ty_out 结构逐一核对字段是否存在 |
| **SELECT 生成后自检逗号** | 写完所有 SELECT 后 grep `FROM` — 确保 SQL 字段列表都是逗号分隔（new OpenSQL） |
| **FOR ALL ENTRIES 必须同类型同长度** | 两表字段 ROLLNAME 不一致时，优先改用 SELECT 全表 + BINARY SEARCH（小表尤其适用） |
| **部署前本地目录校验** | `deploy_rfc.js` 读 `abap/sources/`；代码生成时直接写入该目录，不要写 `abap/` 后手动复制 |

---

## 参考

- [SKILL.md](SKILL.md) — 工作流主文档
- [abap-syntax-quickref.md](abap-syntax-quickref.md) — ABAP 语法速查
- [mcp-contract.md](mcp-contract.md) — MCP 参数契约与易错点
- [reference.md](reference.md) — Eclipse ADT / ADT REST 与 RFC 参数参考
