# SAP 报表工作流：参考与备选实现

## ABAP 语法参考源（推荐）

- **首选**：[SAP-samples/abap-cheat-sheets](https://github.com/SAP-samples/abap-cheat-sheets) — SAP 官方示例库。37 个主题速查表涵盖内表、Open SQL、类型系统、OO、设计模式、选择屏幕、WHERE 条件、性能优化、异常处理等全部主题。
- **本 Skill 内置速查**：[abap-syntax-quickref.md](abap-syntax-quickref.md) — 精选最高频模式，阶段 4 代码生成的语法约束。
- 各阶段 cheat sheet 对应：
  - 阶段 4（REPORT）：01_Internal_Tables, 03_ABAP_SQL, 16_Data_Types_and_Objects
  - 阶段 4（CLASS）：04_ABAP_Object_Orientation, 34_OO_Design_Patterns, 27_Exceptions
  - 阶段 3（技术设计）：31_WHERE_Conditions, 03_ABAP_SQL
  - 选择屏幕设计：20_Selection_Screens_Lists
  - 性能审查：32_Performance_Notes

## 与 Eclipse ADT 的关系

本工作流通过 `node-rfc → SADT_REST_RFC_ENDPOINT` 直连 SAP ADT API（RFC 通道）（`/sap/bc/adt/`），与 Eclipse ADT 使用**同一后端契约**。能在 Eclipse ADT 中连上并编辑的开发对象，在 RFC 连通且权限一致的前提下应能同样操作。锁、传输、并发编辑等行为与 Eclipse ADT 一致。

## 成熟方案（可与本工作流组合）

| 方案 | 用途 |
|------|------|
| **RFC ADT** `/sap/bc/adt/` | Eclipse ADT 同款 API；`rfc_client.js` 已封装常用操作 |
| **abapify/adt-cli**（TypeScript） | 契约化 HTTP 客户端与 CLI，适合流水线 |
| **abapGit + CI** | `ZABAPGIT_CI` 或 REST 跑语法/对象检查 |
| **Jenkins / GitHub Actions** | 社区常见 CI/CD 模式 |

本 Skill 的「对话代理」负责需求结构化、设计文档与修错循环；批量门禁建议用 abapGit CI / ATC。

## RFC：`DDIF_FIELDINFO_GET`（备选）

当 ADT DDIC 端点不可用时，对每个透明表直接 RFC 调用：

- **IMPORT**：`TABNAME`（表名，大写）
- **TABLES**：`DFIES_TAB`（字段目录行）、`X031L_TAB`（技术信息）

需 SM59/网关与 RFC 授权。

## 透明表字段信息：正确调用方式

**首选（稳定）**：
```bash
node scripts/rfc_client.js --env=.env.data --rows=2000 \
  --sql "SELECT TABNAME, FIELDNAME, POSITION, KEYFLAG, DATATYPE, LENG, DECIMALS, ROLLNAME FROM DD03L WHERE TABNAME='BKPF' ORDER BY POSITION" \
  --table DD03L
```
`rfc_client.js --sql --table DD03L` 走 `ddic` 端点，是唯一可靠的元数据路径。

**备选**：
```bash
node scripts/rfc_client.js --source "/sap/bc/adt/ddic/tables/bkpf/source/main"
```
注意：对传统透明表可能返回 404，不可作为主路径。

**兜底 RFC**：`DDIF_FIELDINFO_GET`（见上文）。

## 错误处理与日志

- ADT 激活接口返回 XML，格式因 SAP 版本而异，解析器必须兼容三种：
  1. `<chkl:messages>` 中的 `<msg type="E">` 或 `<msg type="A">`
  2. `<atom:entry>` 中 `category term="error"`
  3. 简单 `<entry>` 标签
  - **禁止**仅匹配 `<entry>` 就判定成功
- 语法检查端点返回 405 → 标记 `unavailable`，激活阶段兜底验证
- 每次失败追加到 `output/<program>/docs/smoke-test.md`

## RFC ADT 常用端点

| 操作 | 方法 | URI |
|------|------|-----|
| Discovery | GET | `/sap/bc/adt/discovery` |
| 搜索对象 | GET | `/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=<q>&maxResults=<n>` |
| SQL 查询（DDIC 端点） | POST | `/sap/bc/adt/datapreview/ddic?rowNumber=<n>&ddicEntityName=<T>` |
| SQL 查询（自由） | POST | `/sap/bc/adt/datapreview/freestyle?rowNumber=<n>` |
| 读取程序源码 | GET | `/sap/bc/adt/programs/programs/{name}/source/main` |
| 读取 Include 源码 | GET | `/sap/bc/adt/programs/includes/{name}/source/main` |
| 读取类源码 | GET | `/sap/bc/adt/oo/classes/{name}/source/main` |
| 创建程序 | POST | `/sap/bc/adt/programs/programs` |
| 创建 Include | POST | `/sap/bc/adt/programs/includes` |
| Lock | POST | `{objectUri}?_action=LOCK&accessMode=MODIFY` |
| Unlock | POST | `{objectUri}?_action=UNLOCK&lockHandle={h}` |
| 上传源码 | PUT | `{objectUri}/source/main?lockHandle={h}` |
| 语法检查 | POST | `{objectUri}/source/main?method=check` |
| 激活 | POST | `/sap/bc/adt/activation?method=activate&preauditRequested=true` |

## 脚本库参考

所有 SAP 查询统一走 `scripts/rfc_client.js`，部署走 `scripts/deploy_rfc.js`。

### 核心脚本

| 脚本 | 场景 |
|------|------|
| `scripts/rfc_client.js` | **统一 SAP 客户端**：discovery / search / SQL / source |
| `scripts/deploy_rfc.js` | 主部署编排（创建→Lock→上传→语法检查→激活） |
| `scripts/verify_report.js` | 冒烟测试：多组参数执行报表并比对 |
| `scripts/test_rfc.js` | RFC 环境诊断（DLL + 连接） |
| `scripts/release_locks.js` | 应急释放 SAP 锁 |

### modules/ 目录

| 模块 | 职责 |
|------|------|
| `env.js` | 加载 .env，构建 RFC 参数 |
| `sap-connection.js` | 创建 node-rfc Client |
| `adt-request.js` | 通用 SADT_REST_RFC_ENDPOINT 请求 |
| `load-deployment-config.js` | 从 deployment-config.md 读取包/请求号 |
| `create-program.js` / `create-include.js` / `create-fugr.js` / `create-fm.js` | 对象创建 |
| `upload-program-source.js` / `upload-include-source.js` / `upload-fm-source.js` | 源码上传 |
| `lock-object.js` / `unlock-object.js` / `with-lock.js` | 锁管理 |
| `syntax-check.js` | 语法检查 |
| `activate-objects.js` | 激活 + 结果验证 |
