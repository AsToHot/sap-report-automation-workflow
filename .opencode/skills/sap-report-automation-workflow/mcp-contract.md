# RFC ADT 端点与 rfc_client.js 使用手册

## rfc_client.js 用法

```bash
# 基本格式
node scripts/rfc_client.js [--env=<file>] <模式> [参数]

# 模式
--discovery             连通性检查
--search <query>        搜索 ABAP 对象（--type 限定类型）
--sql <query>           执行 SQL（--table <T> 走 ddic 端点，无则走 freestyle）
--source <uri>          拉取对象源码
--inactive              列出未激活对象
<METHOD> <URI>          通用 RFC ADT 请求（--body 传请求体）
```

### 常用示例

```bash
# Discovery
node scripts/rfc_client.js --discovery
node scripts/rfc_client.js --env=.env.data --discovery

# 搜索对象
node scripts/rfc_client.js --search "ZSAP_FI086"
node scripts/rfc_client.js --search "BKPF" --type TABL
node scripts/rfc_client.js --search "ZGD01" --type DEVC

# SQL 查询
node scripts/rfc_client.js --env=.env.data --rows=2000 \
  --sql "SELECT FIELDNAME, DATATYPE, LENG FROM DD03L WHERE TABNAME EQ 'BKPF' ORDER BY POSITION" \
  --table DD03L

# COUNT
node scripts/rfc_client.js --env=.env.data \
  --sql "SELECT COUNT(*) AS CNT FROM BSEG WHERE BUKRS='1000'" --table BSEG

# 拉取源码
node scripts/rfc_client.js --source "/sap/bc/adt/programs/programs/zsap_fi086/source/main"
node scripts/rfc_client.js --source "/sap/bc/adt/programs/includes/zsap_fi086t01/source/main"

# 通用请求
echo "SELECT * FROM TADIR" | node scripts/rfc_client.js --env=.env.data \
  POST /sap/bc/adt/datapreview/ddic?rowNumber=10&ddicEntityName=TADIR --body -
```

### 输出格式

成功时 stdout 输出 JSON：
```json
{
  "status": "success",
  "statusCode": 200,
  "body": "<XML or text response>",
  "dataType": "xml"
}
```

失败时 stderr 输出错误，exit(1)。

### 选项

| 选项 | 说明 |
|------|------|
| `--env=<file>` | 配置文件（默认 `.env`；数据系统用 `.env.data`） |
| `--rows=<n>` | SQL 返回行数（默认 100） |
| `--table <T>` | SQL 走 `ddic` 端点（稳定，推荐） |
| `--type <t>` | 搜索对象类型（TABL/PROG/CLAS/DEVC/FUGR/INTF） |
| `--body <str>` | 请求体（`-` 从 stdin 读取） |

---

## 常用 RFC ADT 端点

### 查询类

| 操作 | 方法 | URI | 说明 |
|------|------|-----|------|
| Discovery | GET | `/sap/bc/adt/discovery` | 连通验证 |
| 搜索对象 | GET | `/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=<q>&maxResults=<n>[&objectType=<t>]` | 返回 XML |
| SQL 查询（DDIC） | POST | `/sap/bc/adt/datapreview/ddic?rowNumber=<n>&ddicEntityName=<T>` | Body=SQL，稳定 |
| SQL 查询（自由） | POST | `/sap/bc/adt/datapreview/freestyle?rowNumber=<n>` | Body=SQL，可能 400 |
| 读取程序源码 | GET | `/sap/bc/adt/programs/programs/{name}/source/main` | |
| 读取 Include 源码 | GET | `/sap/bc/adt/programs/includes/{name}/source/main` | |
| 读取类源码 | GET | `/sap/bc/adt/oo/classes/{name}/source/main` | |
| 读取接口源码 | GET | `/sap/bc/adt/oo/interfaces/{name}/source/main` | |
| 读取函数组源码 | GET | `/sap/bc/adt/functions/groups/{name}/source/main` | |
| 未激活对象列表 | GET | `/sap/bc/adt/inactiveobjects` | |

### 操作类（deploy_rfc.js 内部使用）

| 操作 | 方法 | URI | Content-Type |
|------|------|-----|-------------|
| 创建程序 | POST | `/sap/bc/adt/programs/programs` | `application/vnd.sap.adt.programs.programs.v4+xml` |
| 创建 Include | POST | `/sap/bc/adt/programs/includes` | 同上 |
| 创建类 | POST | `/sap/bc/adt/oo/classes` | |
| 创建接口 | POST | `/sap/bc/adt/oo/interfaces` | |
| 创建函数组 | POST | `/sap/bc/adt/functions/groups` | |
| Lock | POST | `{objectUri}?_action=LOCK&accessMode=MODIFY` | |
| Unlock | POST | `{objectUri}?_action=UNLOCK&lockHandle={h}` | |
| 上传源码 | PUT | `{objectUri}/source/main?lockHandle={h}` | `text/plain; charset=utf-8` |
| 语法检查 | POST | `{objectUri}/source/main?method=check` | |
| 激活 | POST | `/sap/bc/adt/activation?method=activate&preauditRequested=true` | `application/vnd.sap.adt.activation+xml` |

### 对象类型映射

| ADT 码 | URI 前缀 | 命名约定 |
|--------|---------|---------|
| `PROG/P` | `/sap/bc/adt/programs/programs/` | `ZSAP_xxx` / `ZFI_xxx` |
| `PROG/I` | `/sap/bc/adt/programs/includes/` | `ZSAP_xxxT01` 等 |
| `CLAS` | `/sap/bc/adt/oo/classes/` | `ZCL_xxx` |
| `INTF` | `/sap/bc/adt/oo/interfaces/` | `ZIF_xxx` |
| `FUGR` | `/sap/bc/adt/functions/groups/` | `ZFG_xxx` |
| `TABL` | `/sap/bc/adt/ddic/tables/` | 任意 |

### 整包开发对象拉取

1. **先统计**：`--sql "SELECT OBJECT, COUNT(*) AS CNT FROM TADIR WHERE DEVCLASS='ZGD01' AND PGMID='R3TR' GROUP BY OBJECT" --table TADIR`
2. **再按类型分批**：按 PROG/CLAS/FUGR 分类，每批 20-50 个对象
3. **套 URI 模板**：按上表拼 `{URI前缀}/{name}/source/main`
4. **分批落盘** + manifest.json 续跑
