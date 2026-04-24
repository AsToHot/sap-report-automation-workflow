# user-ai-abap（ai-abap）MCP：使用说明与参数契约

本 MCP 封装 **ADT REST**（`/sap/bc/adt/`），与 **Eclipse ADT（ABAP Development Tools）** 访问 AS ABAP 时使用的后端契约**同源**；工具名与参数以 Claude Code 下发的 JSON schema 为准。

## 说明书在哪里？

**没有**与 Claude Code 分开发行的独立「Eclipse ADT / ADT MCP 合并用户手册 PDF」。**官方契约**就是 Claude Code 为已启用 MCP 下发的 **JSON Tool Descriptor**：

- 在本机通常位于：`<Claude Code 缓存>/mcps/user-ai-abap/tools/<工具名>.json`
- 对话里系统也会要求：**调用任意 MCP 工具前必须先读对应 schema**（`required` 字段名即合法参数名，大小写一致）。

代理**禁止**凭记忆猜测参数名（例如把 `max` 写成 `maxResults`）；**必须**打开上述 JSON 核对后再调用。

**与业务代码的关系**：MCP 拉取的表定义 / DD03L 结果写入 `metadata/tables/*.json` 后，**Open SQL 与内表字段只允许使用该元数据与 `docs/tech-design.md` 中的「字段契约」**，不得在实现阶段另起炉灶。详见主 Skill **「阶段间强引用」**。

---

## 报表工作流常用工具（按阶段）

### 0. 连通性


| 工具            | 必填参数      | 说明                |
| ------------- | --------- | ----------------- |
| `healthcheck` | 无（传 `{}`） | 确认 MCP 与 SAP 会话可用 |


### 1. 透明表 / DDIC：拉字段与定义（勿用错工具）


| 目的           | 工具                | 必填参数              | 说明                                                              |
| ------------ | ----------------- | ----------------- | --------------------------------------------------------------- |
| **整表定义（推荐）** | `getObjectSource` | `objectSourceUrl` | 例：`/sap/bc/adt/ddic/tables/bkpf/source/main`（表名在 URI 中**小写**最稳） |
| 行列表字段        | `runQuery`        | `sqlQuery`        | 可选 `rowNumber`。例：查 `DD03L`，`AS4LOCAL = 'A'`                     |
| 搜索对象 URI     | `searchObject`    | `query`           | 可选 `objType`、`**max`**（注意：是 `**max`不是 maxResults**）             |


**易错**：`ddicElement` / `ddicRepositoryAccess` **不是**「完整字段字典」接口，不要当主路径反复改 `path` 试错。

### 2. 程序：读/写/检查/激活


| 步骤       | 工具                                | 必填参数                                     |
| -------- | --------------------------------- | ---------------------------------------- |
| 解析对象 URL | `findObjectPath` 或 `searchObject` | 见各 JSON                                  |
| 加锁       | `lock`                            | `objectUrl`                              |
| 写源码      | `setObjectSource`                 | `objectSourceUrl`、`source`、`lockHandle`  |
| 语法检查     | `syntaxCheckCode`                 | `code`（可选 `url`/`mainProgram` 等见 schema） |
| 激活       | `activateByName`                  | `objectName`、`objectUrl`                 |


`lock` 返回里若含 **lock handle**，须原样传入 `setObjectSource` 的 `lockHandle`（字段名以实际响应与 schema 为准）。

### 3. 创建新对象（若需）


| 工具             | 必填参数                                                     |
| -------------- | -------------------------------------------------------- |
| `createObject` | `objtype`、`name`、`parentName`、`description`、`parentPath` |


具体 `objtype` 取值以系统 `objectTypes` 工具或 ADT 为准，**先查 schema / 再调用**。

---

## 常见参数错误（对照 schema 自查）

1. `**searchObject`**：上限字段为 `**max`**，不是 `maxResults`。
2. **DDIC 表源码**：用 `**getObjectSource`** + `objectSourceUrl` 指向 `.../ddic/tables/<name>/source/main`，不要指望 `ddicElement` 返回完整字段列表。
3. `**runQuery`**：必填只有 `sqlQuery`；未传合法 SQL 会失败，不是「ADT 慢」。

---

## 整包开发对象（如 `DEVCLASS = ZGD01`）：禁止「盲试 URI」，必须分类 + 分批

读**整张表**和读**整个包**不是同一类问题：包里有成百上千个对象、多种 `TADIR-OBJECT` 类型。若对每个对象用 `searchObject` 乱试、或对 ADT 路径猜来猜去，就会表现为**一直试错**，且数据量一大必然超时或刷屏。

### 正确顺序（数据量大时也要坚持）

1. **先统计、再分类（一次或少量几次查询）**
  - 用 `**runQuery`** 查 `TADIR`（或你们允许的清单视图），**按对象类型聚合**，例如：
    - `SELECT object, COUNT(*) AS cnt FROM tadir WHERE devclass = 'ZGD01' AND pgmid = 'R3TR' GROUP BY object ORDER BY cnt DESC`
  - 目的：知道包里有 **PROG / CLAS / FUGR / TABL / …** 各多少，**再决定拉取顺序和批量大小**，而不是一口气拉全量。
2. **再拉清单（可分页）**
  - 按类型分批查明细，例如只拉 `PROG`：  
   `SELECT object, obj_name FROM tadir WHERE devclass = 'ZGD01' AND pgmid = 'R3TR' AND object = 'PROG' ORDER BY obj_name`
  - 使用 `runQuery` 的 `**rowNumber`** 限制单次行数；若仍很多，**按字母或 `obj_name` 范围拆批**（`obj_name` 前缀、`BETWEEN` 等），或多次查询分段落盘。
  - **禁止**依赖「对一个包名反复 `searchObject`」当枚举主手段（适合补全单个对象，不适合整包）。
3. **按类型套 ADT URI 模板（不猜）**
  - 对每个 `(OBJECT, OBJ_NAME)`，用**固定规则**拼 `objectSourceUrl`，再调 `**getObjectSource`**。常见模板（**名称一律小写**拼进路径，与 ADT 一致）：
    - 可执行程序：`/sap/bc/adt/programs/programs/<name>/source/main`
    - Include：`/sap/bc/adt/programs/includes/<name>/source/main`
    - 类：`/sap/bc/adt/oo/classes/<name>/source/main`
    - 透明表：`/sap/bc/adt/ddic/tables/<name>/source/main`
    - 域/数据元素等：见包内或团队的 **URI 规则表**（与 Eclipse ADT 打开对象时的 URL 一致即可）。
  - 若某类型一次失败：**先换该类已知备选路径**（如 PROG 与 INCLUDE 互换），仍失败再对该对象单独 `findObjectPath` / `searchObject`，**不要把整包拉回试错模式**。
4. **分批落盘 + 可续跑**
  - 每批处理 **N 条**（如 20～50 个对象，视单对象体积调整），写入目录并维护 `**manifest.json`/`progress.tsv`**：已拉取、失败原因、下一批游标。
  - 失败批次**单独重试**，避免从第一个对象重新开始。
5. **超大规模包的替代**
  - 若对象数达到数百上千且以**全量镜像**为目标，优先评估 **abapGit Export / 系统侧导出**，MCP 更适合**增量、按清单、可续跑**的拉取与自动化，而不是单次会话硬拉全集。

### 小结


| 错误做法                   | 正确做法                               |
| ---------------------- | ---------------------------------- |
| 整包用 `searchObject` 当枚举 | `TADIR` 清单 + 按类型                   |
| 每个对象猜 ADT 路径           | 按 `OBJECT` 类型套**固定 URI 模板**        |
| 一次拉 500+ 对象不限制         | `**rowNumber` / 分批 / manifest 续跑** |
| 失败从头重试                 | **只重试失败子集**                        |


---

## 上游开源项目（人类可读文档）

MCP 实现来自例如 [mario-andreschak/mcp-abap-abap-adt-api](https://github.com/mario-andreschak/mcp-abap-abap-adt-api)（README、Issues）。**运行时仍以 Claude Code 下发的 `tools/*.json` 为准**（版本不一致时以本机为准）。
