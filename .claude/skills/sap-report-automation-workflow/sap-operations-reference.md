# SAP 连接操作参考手册 — 入参/出参完整示例

所有示例均通过实际 SAP 系统（开发 200 + 数据 300）验证，时间戳 2026-06-24。

## 配置文件

### `.env` — 开发系统（200）
```
SAP_URL=http://10.32.21.11:8000
SAP_CLIENT=200
SAP_SYSNR=00
SAP_USERNAME=ITL12
SAP_PASSWORD=***
SAP_ROUTER=/H/210.75.21.252
```

### `.env.data` — 数据系统（300）
```
SAP_URL=http://10.32.21.11:8000
SAP_CLIENT=300
SAP_SYSNR=00
SAP_USERNAME=ITL12
SAP_PASSWORD=***
RFC_PROXY_PORT=9877
SAP_ROUTER=/H/210.75.21.252
```

**必需字段**：`SAP_URL`、`SAP_CLIENT`、`SAP_SYSNR`（必须显式）、`SAP_USERNAME`、`SAP_PASSWORD`。`SAP_ROUTER` 可选（内网穿透）。

---

## 1. 环境诊断 — `test_rfc.js`

```bash
node scripts/test_rfc.js
```

**入参**：无（从 `.env` 读取）

**出参**（实测）：
```
=== RFC Environment Diagnostics ===
Platform        : win32
Node.js version : v24.15.0
SAPNWRFC_HOME   : E:\ABAP工作流\NW-RFC-SDK\nwrfcsdk
SDK lib dir     : E:\ABAP工作流\NW-RFC-SDK\nwrfcsdk\lib
PATH includes lib? YES
SDK sapnwrfc.dll     : FOUND
SDK icudt74.dll      : MISSING
SDK icuuc74.dll      : MISSING
SDK icuin74.dll      : MISSING

=== node-rfc Native Addon Load ===
Status          : SUCCESS — node-rfc loaded

=== RFC Connection Parameters ===
ashost          : 10.32.21.11
sysnr           : 00
client          : 200
user            : ITL12
saprouter       : /H/210.75.21.252

=== RFC Connection Attempt ===
Status          : SUCCESS
```

**成功标志**：最后一行 `Status: SUCCESS`
**失败处理**：按输出中的 `>>> DIAGNOSIS:` 提示修复

---

## 2. 双系统连通检测 — `rfc_dual_check.js`

```bash
node scripts/rfc_dual_check.js
```

**入参**：无（读 `.env` + `.env.data`）

**出参**（实测）：
```json
{
  "status": "ALL_OK",
  "timestamp": "2026-06-24T02:14:06.780Z",
  "systems": [
    {
      "label": "开发系统",
      "envFile": ".env",
      "ok": true,
      "error": "",
      "client": "200",
      "sysnr": "00",
      "ashost": "10.32.21.11"
    },
    {
      "label": "数据系统",
      "envFile": ".env.data",
      "ok": true,
      "error": "",
      "client": "300",
      "sysnr": "00",
      "ashost": "10.32.21.11"
    }
  ]
}
```

**成功标志**：`"status": "ALL_OK"`，两个系统 `"ok": true`
**失败示例**：`"status": "PARTIAL_FAILURE"`，失败系统 `"error"` 字段含具体原因
**退出码**：成功 0，任一失败 1

---

## 3. 单系统 Discovery — `rfc_client.js --discovery`

```bash
node scripts/rfc_client.js --discovery
node scripts/rfc_client.js --env=.env.data --discovery
```

**入参**：`--env=` 可选（默认 `.env`）

**出参**（实测）：
```json
{
  "status": "success",
  "statusCode": 200,
  "body": "<?xml version=\"1.0\" encoding=\"utf-8\"?><app:service xmlns:app=...",
  "dataType": "xml"
}
```

**成功标志**：`"statusCode": 200`，`body` 含 `<app:service>` XML

---

## 4. 搜索对象 — `rfc_client.js --search`

### 搜索程序
```bash
node scripts/rfc_client.js --search "ZSAP_FI086"
```

**入参**：`--search <query>` + 可选 `--type PROG|TABL|CLAS|DEVC|FUGR|INTF`

**出参**（实测）：
```json
{
  "status": "success",
  "statusCode": 200,
  "body": "<?xml version=\"1.0\" encoding=\"utf-8\"?><adtcore:objectReferences xmlns:adtcore=\"http://www.sap.com/adt/core\"><adtcore:objectReference adtcore:uri=\"/sap/bc/adt/programs/programs/zsap_fi086\" adtcore:type=\"PROG/P\" adtcore:name=\"ZSAP_FI086\" adtcore:packageName=\"ZABAP\" adtcore:description=\"经管合同明细报表\"/></adtcore:objectReferences>",
  "dataType": "xml"
}
```

**解析后**：uri=`/sap/bc/adt/programs/programs/zsap_fi086`、type=`PROG/P`、name=`ZSAP_FI086`、package=`ZABAP`、description=`经管合同明细报表`

### 搜索表
```bash
node scripts/rfc_client.js --search "BKPF" --type TABL
```
**出参**：`adtcore:name="BKPF"` 含类型和包信息

**成功标志**：`statusCode: 200`，body 含 `<adtcore:objectReference>` 标签
**不存在时**：body 含空的 `<adtcore:objectReferences/>`

---

## 5. SQL 查询 — `rfc_client.js --sql`

### DD03L 字段查询
```bash
node scripts/rfc_client.js --env=.env.data --rows=2000 \
  --sql "SELECT FIELDNAME, POSITION, KEYFLAG, ROLLNAME, DATATYPE, LENG, DECIMALS FROM DD03L WHERE TABNAME EQ 'BKPF' ORDER BY POSITION" \
  --table DD03L
```

**入参**：
| 参数 | 说明 |
|------|------|
| `--env=` | 配置文件（数据查询用 `.env.data`） |
| `--rows=` | 返回行数上限（DD03L 建议 2000） |
| `--sql` | ABAP OpenSQL 语句（**必须用 `EQ` 而非 `=`**） |
| `--table` | 走 `ddic` 端点，指定 entity name（如 `DD03L`） |

**出参**：`"statusCode": 200`，body 为 XML `dataPreview:tableData` 格式，含 `<dataPreview:columns>`(列元数据) + `<dataPreview:dataSet>`(按列排列的数据值)

### COUNT 查询
```bash
node scripts/rfc_client.js --rows=1 \
  --sql "SELECT COUNT(*) AS CNT FROM TADIR WHERE PGMID EQ 'R3TR' AND OBJECT EQ 'PROG'" \
  --table TADIR
```

**出参**：返回 XML 含 COUNT 聚合结果

### 数据采样
```bash
node scripts/rfc_client.js --env=.env.data --rows=5 \
  --sql "SELECT BUKRS, BELNR, GJAHR, BLART FROM BKPF WHERE BUKRS EQ '1000'" \
  --table BKPF
```
**出参**：`"statusCode": 200`，body 含结构化数据 XML

**⚠ 关键约束**：SQL 必须使用 ABAP 语法——`EQ` 代替 `=`、`AND`/`OR` 连接。`=` 会导致 400 Bad Request。

---

## 6. DDIC 元数据一键拉取 — `rfc_fetch_ddic.js`

```bash
# 开发系统
node scripts/rfc_fetch_ddic.js --env=.env BKPF output/<prog>/metadata/tables/

# 数据系统（默认）
node scripts/rfc_fetch_ddic.js BSEG output/<prog>/metadata/tables/
```

**入参**：
| 参数 | 必需 | 说明 |
|------|------|------|
| `TABNAME` | 是 | 表名大写，位置参数 1 |
| `OUTDIR` | 否 | 输出目录，位置参数 2（默认 `./output/_metadata/tables/`） |
| `--env=` | 否 | 配置文件（默认 `.env.data`） |

**出参**（实测 BSEG）：
```
[OK] BSEG: 353 fields → output/<prog>/metadata/tables/BSEG.json
```

**JSON 文件内容**（实测 BKPF）：
```json
{
  "tabname": "BKPF",
  "fetched_count": 122,
  "matched": true,
  "pulled_at": "2026-06-24T01:55:01.993Z",
  "source": ".env",
  "fields": [
    {"FIELDNAME":"MANDT","POSITION":1,"KEYFLAG":"X","ROLLNAME":"MANDT","DATATYPE":"CLNT","LENG":3,"DECIMALS":0},
    {"FIELDNAME":"BUKRS","POSITION":2,"KEYFLAG":"X","ROLLNAME":"BUKRS","DATATYPE":"CHAR","LENG":4,"DECIMALS":0},
    {"FIELDNAME":"BELNR","POSITION":3,"KEYFLAG":"X","ROLLNAME":"BELNR_D","DATATYPE":"CHAR","LENG":10,"DECIMALS":0},
    {"FIELDNAME":"GJAHR","POSITION":4,"KEYFLAG":"X","ROLLNAME":"GJAHR","DATATYPE":"NUMC","LENG":4,"DECIMALS":0},
    {"FIELDNAME":"BLART","POSITION":5,"KEYFLAG":"","ROLLNAME":"BLART","DATATYPE":"CHAR","LENG":2,"DECIMALS":0}
  ]
}
```

**字段说明**：
| JSON 字段 | 含义 |
|-----------|------|
| `FIELDNAME` | 字段名 |
| `POSITION` | 在表中的位置 |
| `KEYFLAG` | `X` = 主键字段 |
| `ROLLNAME` | 数据元素 |
| `DATATYPE` | ABAP 数据类型（CLNT/CHAR/NUMC/DATS/DEC/CURR/QUAN/INT4 等） |
| `LENG` | 长度 |
| `DECIMALS` | 小数位 |

**成功标志**：`matched: true`，`fetched_count > 0`
**失败处理**：`fetched_count: 0` 时自动重试最多 3 次，仍失败记入 `_errors.md`

---

## 7. 源码拉取 — `rfc_client.js --source`

```bash
# 程序源码
node scripts/rfc_client.js --source "/sap/bc/adt/programs/programs/zsap_fi086/source/main"

# Include 源码
node scripts/rfc_client.js --source "/sap/bc/adt/programs/includes/zsap_fi086t01/source/main"

# 类源码
node scripts/rfc_client.js --source "/sap/bc/adt/oo/classes/zcl_dao/source/main"
```

**入参**：`--source <ADT URI>`，URI 必须以 `/sap/bc/adt/` 开头

**出参**（实测 ZSAP_FI086，1134 行）：
```json
{
  "status": "success",
  "statusCode": 200,
  "body": "*&---------------------------------------------------------------------*\r\n*& Report  ZSAP_FI086\r\n...\r\nENDFORM.                    \" FRM_GETTEXT"
}
```
`body` 为完整 ABAP 源码文本（`\r\n` 换行）

**成功标志**：`"statusCode": 200`

---

## 8. 部署 — `deploy_rfc.js`

```bash
node scripts/deploy_rfc.js <程序名>
```

**入参**：程序名（如 `ZSAP_FI086`），位置参数 1

**前置条件**：
- `output/<程序名>/abap/sources/` 存在，含 `<程序名>.abap` + `<程序名>T01.abap` + `<程序名>SEL.abap` + `<程序名>F01.abap`
- `output/<程序名>/docs/deployment-config.md` 含目标包和传输请求

**行为流程**：
1. `[OK] RFC connected` — 建立 RFC 连接
2. 创建主程序（`POST /sap/bc/adt/programs/programs`）→ Lock → 上传源码
3. 创建 Include → 逐个 Lock/Upload/Unlock
4. 语法检查（`POST .../source/main?method=check`）
5. 激活（`POST /sap/bc/adt/activation`）→ 检查激活结果
6. 输出 `SUCCESS` 或 `FAILED`

**成功输出**：`... DEPLOY SUCCESS`
**失败输出**：`[FATAL] ...` + 错误详情（语法错误含行号）

---

## 9. 冒烟测试 — `verify_report.js`

```bash
# 单组参数
node scripts/verify_report.js ZTEST001 P_BUKRS=6030 P_GJAHR=2025 S_RPMAX=001-004

# 多组参数（逗号分隔，串行执行并逐组比对）
node scripts/verify_report.js ZTEST001 P_BUKRS=6030 "S_RPMAX=001-004,009-012,001-016"

# 指定数据系统
node scripts/verify_report.js --env=.env.data ZTEST001 P_BUKRS=6030
```

**入参**：
| 参数 | 格式 | 说明 |
|------|------|------|
| 程序名 | 位置参数 1 | SAP 中已激活的报表程序 |
| `P_xxx=值` | PARAMETER | 单值参数 (OPTION=EQ) |
| `S_xxx=低-高` | SELECT-OPTIONS | 区间参数 (OPTION=BT)，逗号分隔多组 |
| `--env=` | 可选 | 配置文件（默认 `.env.data`） |

**前置**：数据系统上已部署 `ZREPORT_EXEC_VERIFY` FM（源码见 `docs/ZREPORT_EXEC_VERIFY.txt`）

**出参**：每组参数的行数、金额合计、前 8 行明细（动态列展示）

**无参数时输出**：
```
用法: node scripts/verify_report.js [--env=.env.data] <程序名> [P_xxx=值] [S_xxx=低-高] [...]
示例: node scripts/verify_report.js ZTEST001 P_BUKRS=6030 P_GJAHR=2025 S_RPMAX=001-004,009-012
```

---

## 10. 应急锁释放 — `release_locks.js`

```bash
node scripts/release_locks.js
```

**入参**：无（从 `.env` 读取）

**出参**（实测）：
```
[OK] RFC connected
[T1] No persisted lock records found
=== DONE (T1: store) ===
```

---

## 11. 通用 RFC ADT 请求 — `rfc_client.js <METHOD> <URI>`

```bash
# GET
node scripts/rfc_client.js GET "/sap/bc/adt/inactiveobjects"

# POST（body 从 stdin）
echo "SELECT * FROM TADIR" | node scripts/rfc_client.js POST \
  "/sap/bc/adt/datapreview/ddic?rowNumber=10&ddicEntityName=TADIR" --body -

# POST（body 直接传）
node scripts/rfc_client.js POST "/sap/bc/adt/datapreview/ddic?rowNumber=5&ddicEntityName=DD03L" \
  --body "SELECT FIELDNAME FROM DD03L WHERE TABNAME EQ 'T001'"
```

**入参**：`<METHOD> <URI>` + 可选 `--body <str>`（`-` = stdin）

**出参**：同其他模式，JSON `{"status":"success","statusCode":...,"body":"..."}`

---

## 工作流全阶段 SAP 操作速查

| 阶段 | 操作 | 命令 | 系统 |
|------|------|------|------|
| S0 | 环境诊断 | `node scripts/test_rfc.js` | — |
| S0 | 双系统连通 | `node scripts/rfc_dual_check.js` | 双系统 |
| S0 | 权限探测 | `node scripts/rfc_client.js --sql "SELECT COUNT(*) AS CNT FROM TADIR WHERE PGMID EQ 'R3TR'" --table TADIR` | 200 开发 |
| S1.5 | 查对象存在 | `node scripts/rfc_client.js --search "<OBJNAME>"` | 200 开发 |
| S2 | **拉 DDIC** | `node scripts/rfc_fetch_ddic.js --env=.env.data <T> output/<prog>/metadata/tables/` | 300 数据 |
| S2.5 | 主表 COUNT | `node scripts/rfc_client.js --env=.env.data --sql "SELECT COUNT(*) AS CNT FROM <T>" --table <T>` | 300 数据 |
| S3.6 | 验证包 | `node scripts/rfc_client.js --search "<PKG>" --type DEVC` | 200 开发 |
| S5 | **部署** | `node scripts/deploy_rfc.js <程序名>` | 200 开发 |
| S5.5 | 数据采样 | `node scripts/rfc_client.js --env=.env.data --rows=5 --sql "SELECT * FROM <T>" --table <T>` | 300 数据 |
| S5.5 | **报表校验** | `node scripts/verify_report.js <程序名> P_xxx=<值> "S_xxx=低-高"` | 300 数据 |

---

## 常见 RFC ADT 端点

| 操作 | 方法 | URI |
|------|------|-----|
| Discovery | GET | `/sap/bc/adt/discovery` |
| 搜索对象 | GET | `/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=<q>&maxResults=50` |
| SQL（DDIC） | POST | `/sap/bc/adt/datapreview/ddic?rowNumber=<n>&ddicEntityName=<T>` |
| SQL（自由） | POST | `/sap/bc/adt/datapreview/freestyle?rowNumber=<n>` |
| 程序源码 | GET | `/sap/bc/adt/programs/programs/{name}/source/main` |
| Include 源码 | GET | `/sap/bc/adt/programs/includes/{name}/source/main` |
| 类源码 | GET | `/sap/bc/adt/oo/classes/{name}/source/main` |
| 未激活对象 | GET | `/sap/bc/adt/inactiveobjects` |
| 创建程序 | POST | `/sap/bc/adt/programs/programs` |
| Lock | POST | `{objectUri}?_action=LOCK&accessMode=MODIFY` |
| 激活 | POST | `/sap/bc/adt/activation?method=activate&preauditRequested=true` |

---

## 已测试验证状态（2026-06-24）

| 操作 | 开发(200) | 数据(300) | 示例表 |
|------|-----------|-----------|--------|
| `test_rfc.js` 诊断 | ✅ | — | — |
| `rfc_dual_check.js` | ✅ | ✅ | — |
| `--discovery` | ✅ 200 + XML | ✅ | — |
| `--search` | ✅ ZSAP_FI086(PROG/P) | — | — |
| `--search --type TABL` | ✅ BKPF | — | — |
| `--sql --table DD03L` | ✅ | ✅ BKPF 122 fields | — |
| `--sql --table <T> COUNT` | ✅ | — | TADIR |
| `--sql --table <T> 数据` | ✅ | ✅ | BKPF |
| `rfc_fetch_ddic.js` | ✅ BKPF 122 | ✅ BSEG 353 | — |
| `--source` | ✅ 1134 行 ABAP | — | ZSAP_FI086 |
| `deploy_rfc.js` | ✅（依赖源码） | — | — |
| `verify_report.js` | ✅（依赖 FM） | ✅ | — |
| `release_locks.js` | ✅ | — | — |
