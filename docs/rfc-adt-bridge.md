# SADT_REST_RFC_ENDPOINT 调用说明

## 概述

`SADT_REST_RFC_ENDPOINT` 是 SAP 标准函数模块，负责将 ADT 请求通过 RFC 通道转发到 SAP 内部的 ADT 服务。这是 Eclipse ADT（通过 JCo）使用的同一机制。

## 调用方式

### 请求结构

```javascript
const result = await rfcClient.call('SADT_REST_RFC_ENDPOINT', {
  REQUEST: {
    REQUEST_LINE: {
      METHOD: 'GET',
      URI: '/sap/bc/adt/discovery',
      VERSION: 'HTTP/1.1',
    },
    HEADER_FIELDS: [
      { NAME: 'Accept', VALUE: 'application/xml' },
      { NAME: 'Content-Type', VALUE: 'text/plain; charset=utf-8' },
    ],
    MESSAGE_BODY: Buffer.from(body, 'utf-8'),
  },
});
```

### 响应结构

```javascript
const resp = result.RESPONSE;

const statusCode = parseInt(
  resp.STATUS_LINE?.STATUS_CODE || resp.STATUS_LINE?.CODE || '0', 10
);

const statusText = resp.STATUS_LINE?.REASON_PHRASE || resp.STATUS_LINE?.REASON || '';

const body = resp.MESSAGE_BODY
  ? (Buffer.isBuffer(resp.MESSAGE_BODY)
      ? resp.MESSAGE_BODY.toString('utf-8')
      : String(resp.MESSAGE_BODY))
  : '';

const headers = {};
for (const field of (resp.HEADER_FIELDS || [])) {
  if (field.NAME && field.VALUE !== undefined) {
    headers[field.NAME.toLowerCase()] = field.VALUE;
  }
}
```

## 关键端点

### Discovery
```
GET /sap/bc/adt/discovery
Accept: application/atomsvc+xml
```

### 程序管理

**创建程序**
```
POST /sap/bc/adt/programs/programs
Content-Type: application/vnd.sap.adt.programs.programs.v4+xml
Accept: application/vnd.sap.adt.programs.programs.v4+xml

Body:
<?xml version="1.0" encoding="UTF-8"?>
<program:abapProgram xmlns:program="http://www.sap.com/adt/programs/programs"
  xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="..." adtcore:language="EN" adtcore:name="ZPROG"
  adtcore:type="PROG/P" adtcore:masterLanguage="EN"
  program:programType="1" program:application="*">
  <adtcore:packageRef adtcore:name="$TMP"/>
</program:abapProgram>
```

**Lock 程序**
```
POST /sap/bc/adt/programs/programs/{name}?_action=LOCK&accessMode=MODIFY
Accept: application/vnd.sap.as+xml
```

返回 XML 包含 `<LOCK_HANDLE>...</LOCK_HANDLE>`

**上传源码**
```
PUT /sap/bc/adt/programs/programs/{name}/source/main?lockHandle={handle}
Content-Type: text/plain; charset=utf-8
Accept: text/plain
```

**Unlock**
```
POST /sap/bc/adt/programs/programs/{name}?_action=UNLOCK&lockHandle={handle}
Accept: application/vnd.sap.as+xml
```

**激活**
```
POST /sap/bc/adt/activation?method=activate&preauditRequested=true
Content-Type: application/vnd.sap.adt.activation+xml
Accept: application/xml

Body:
<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/programs/programs/{name}"
    adtcore:name="{NAME}"/>
</adtcore:objectReferences>
```

## 程序类型映射

| 类型 | 代码 |
|------|------|
| executable | 1 |
| include | I |
| module_pool | M |
| function_group | F |
| class_pool | K |
| interface_pool | J |

## 与直接 RFC FM 调用的区别

| 方式 | 调用目标 | 适用场景 |
|------|---------|---------|
| SADT_REST_RFC_ENDPOINT | RFC ADT API | 代码创建、修改、激活等开发操作 |
| 直接 FM（如 DDIF_FIELDINFO_GET） | SAP 标准函数模块 | 数据字典查询、表数据读取等 |

**注意**：`INSERT_REPORT` 不是 SAP 标准函数模块，在部分系统上不存在。所有代码部署应通过 RFC ADT API（即 `SADT_REST_RFC_ENDPOINT`）完成。

## 参考代码

见 `scripts/deploy_rfc.js` -- 完整示例，展示通过 `SADT_REST_RFC_ENDPOINT` 创建程序、上传源码、激活的完整流程。

## 故障排查速查表

| 症状 | 根因 | 解决 |
|------|------|------|
| 创建程序报 **404** | URI 拼写错误 | 确认 URI；程序名统一小写 |
| 创建程序报 **406** | Accept/Content-Type 头不匹配 | 用 Discovery 确认系统支持的类型 |
| 创建程序报 **409** | 程序已存在 | **必须问用户**：新程序名或确认覆盖。禁止自动跳过 |
| 上传源码报 **400/403** | lockHandle 缺失/过期/编码问题 | 重新 Lock 获取新 handle；确保 URL-encode |
| 激活失败 | 语法错误或依赖未激活 | 先修正语法；检查 INCLUDE 是否已上传并解锁 |
| 激活 HTTP 200 但未激活（假成功） | 解析器漏掉 `<msg type="E">` | 匹配三种格式：`<msg type="E\|A">`、`<atom:entry>`(category=error)、`<entry>` |
| 语法检查 405 | 系统不支持该端点 | 标记 unavailable，激活兜底验证语法 |
| 文本元素/GUI Status 写 404 | RFC ADT 通道不支持写入 | 已知限制；部署后 SE80 手动维护 |
| `STATUS_LINE` 无 `STATUS_CODE` | 部分系统字段名不同 | 兼容：`STATUS_CODE` 优先，fallback `CODE` |

## 脚本库参考

### 目录结构

```
scripts/
├── rfc_client.js                # 统一 RFC ADT 客户端（discovery/search/SQL/source）
├── rfc_fetch_ddic.js            # 单表 DDIC 元数据一键拉取
├── rfc_dual_check.js            # 双系统连通检测
├── deploy_rfc.js                # 主部署脚本
├── verify_report.js             # 通用报表真实数据校验
├── test_rfc.js                  # RFC 环境诊断
├── release_locks.js             # 释放所有锁（DEQUEUE_ALL）
└── modules/
    ├── env.js                   # 加载 .env，构建 RFC 连接参数
    ├── load-deployment-config.js # 从 deployment-config.md 读取程序级部署配置
    ├── sap-connection.js        # RFC Client 创建
    ├── adt-request.js           # 通用 ADT HTTP 请求
    ├── lock-object.js           # POST ...?_action=LOCK
    ├── unlock-object.js         # POST ...?_action=UNLOCK
    ├── create-program.js        # POST /sap/bc/adt/programs/programs
    ├── create-include.js        # POST /sap/bc/adt/programs/includes
    ├── create-fugr.js           # POST /sap/bc/adt/functions/groups
    ├── create-fm.js             # POST .../fmodules
    ├── upload-program-source.js # PUT .../source/main
    ├── upload-include-source.js # PUT .../source/main
    ├── upload-fm-source.js      # PUT .../source/main
    ├── syntax-check.js          # POST .../source/main?method=check
    ├── activate-objects.js      # POST /sap/bc/adt/activation
    ├── with-lock.js             # 自动锁管理组合（lock → fn → unlock）
    ├── lock-store.js            # Lock Handle 持久化（.locks/ 目录）
    └── query-locks.js           # 查询当前 SAP 锁
```

### 模块使用指南

| 模块 | 对应 ADT URL | 职责 |
|------|-------------|------|
| `load-deployment-config.js` | 读取 Markdown 表格 | 从 deployment-config.md 解析包/请求号/描述 |
| `env.js` | 读取 `.env` | 加载 SAP 连接参数，不含部署配置 |
| `create-program.js` | `POST /sap/bc/adt/programs/programs` | 创建 PROG/P，处理 409 |
| `create-include.js` | `POST /sap/bc/adt/programs/includes` | 创建 PROG/I，处理 409 |
| `upload-program-source.js` | `PUT .../programs/{name}/source/main` | 上传主程序源码 |
| `upload-include-source.js` | `PUT .../includes/{name}/source/main` | 上传 Include 源码 |
| `lock-object.js` | `POST ...?_action=LOCK` | 获取 lockHandle |
| `unlock-object.js` | `POST ...?_action=UNLOCK` | 释放锁 |
| `syntax-check.js` | `POST .../source/main?method=check` | 语法检查；405 → unavailable |
| `activate-objects.js` | `POST /sap/bc/adt/activation` | 激活；匹配三种错误格式 |
| `create-fugr.js` | `POST /sap/bc/adt/functions/groups` | 创建函数组 FUGR/F |
| `create-fm.js` | `POST .../fmodules` | 创建 FM FUGR/FF |
| `upload-fm-source.js` | `PUT .../fmodules/{fm}/source/main` | 上传 FM 源码 |
| `with-lock.js` | 组合 lock + fn + unlock | 保证异常时也释放锁 |

### 辅助脚本速查

| 脚本 | 场景 | 说明 |
|------|------|------|
| `rfc_client.js` | 所有 SAP 查询 | 统一入口：discovery/search/SQL/source |
| `rfc_fetch_ddic.js` | 阶段 2 DDIC 元数据 | 一键拉取 + JSON 落盘 |
| `rfc_dual_check.js` | 阶段 0 连通检测 | 双系统一键诊断 |
| `verify_report.js` | 阶段 5.5 冒烟测试 | 多组参数并行，动态字段展示 |
| `release_locks.js` | 应急释放锁 | 调用 DEQUEUE_ALL |

---

## INCLUDE 部署已知缺陷与根因记录

> 记录时间：2026-04-27 | 影响范围：阶段 4–5

### 问题描述

RFC ADT API 中 `PROG/I` 类型的 URI 与 `PROG/P` 不同，直接混用会创建为错误的类型。

### 根因分析

**根因 1**：`setObjectSource` 透传 `objectSourceUrl`，不做对象类型校验。若传入 `/sap/bc/adt/programs/programs/{name}`，SAP 中创建的是 `PROG/P` 而非 `PROG/I`。

**根因 2**：`abap-adt-api` 的 `activate` 函数对 `PROG/I` 类型缺少 URI 映射。

**根因 3**：`abap-adt-api` 的 `AdtClient` 没有 `getInclude()` 写入客户端，缺少对 Include 的 lock/update/create 封装。

### INCLUDE 正确部署方式

使用 `scripts/deploy_rfc.js` 通过原生 RFC ADT API 逐对象部署：
1. 阶段 4 生成分层源码（主程序 + T01/SEL/F01）
2. 阶段 5 执行脚本：`node scripts/deploy_rfc.js <program>`
3. 脚本自动创建 `PROG/P` 主程序和 `PROG/I` Include（`program:programType="I"`）
4. 激活主程序时，系统自动处理其引用的 Include

### 相关 RFC ADT 端点（供未来实现参考）

| 操作 | 对象类型 | ADT URI |
|------|---------|---------|
| 读取 Include 源码 | `PROG/I` | `GET /sap/bc/adt/programs/includes/{name}/source/main` |
| 写入 Include 源码 | `PROG/I` | `PUT /sap/bc/adt/programs/includes/{name}/source/main?lockHandle={handle}` |
| 锁定 Include | `PROG/I` | `POST /sap/bc/adt/programs/includes/{name}?_action=LOCK&accessMode=MODIFY` |
| Include 对象 URI | `PROG/I` | `/sap/bc/adt/programs/includes/{name}` |
| 可执行程序对象 URI | `PROG/P` | `/sap/bc/adt/programs/programs/{name}` |

---

## ZREPORT_EXEC_VERIFY 部署说明

`ZREPORT_EXEC_VERIFY` 是阶段 5.5 冒烟测试的**核心前置依赖**——通过 `SUBMIT … WITH SELECTION-TABLE` 执行目标报表并用 `cl_salv_bs_runtime_info` 捕获 ALV 输出为 JSON。

### 代码位置

FM 完整源码：`docs/ZREPORT_EXEC_VERIFY.txt`

### 部署方式

**方式 A — 用户自行部署（推荐）**：在数据系统上通过 SE80/SE37 手动创建函数组，粘贴 FM 源码，激活。

**方式 B — 代理辅助部署**：
1. 询问部署目标（`$TMP` 或具体包）
2. 创建函数组（如 `ZFG_REPORT_VERIFY`）：`POST /sap/bc/adt/functions/groups`
3. 在函数组内创建 FM `ZREPORT_EXEC_VERIFY`：`POST .../fmodules`
4. 上传 FM 源码：`PUT .../source/main?lockHandle={handle}`
5. 激活函数组

### 代理行为

- 阶段 5.5 执行 `verify_report.js` 前，必须先验证 FM 在数据系统上存在
- 若 FM 不存在 → 提示用户部署（代码在 `docs/ZREPORT_EXEC_VERIFY.txt`）
- **禁止**在 FM 未部署的情况下声称冒烟测试通过

---

## FUGR / Function Module 创建与部署（RFC ADT 完整支持）

### 能力确认

RFC ADT API **已支持**函数组和 FM 的创建与部署。FM 入参/出参定义在 ABAP 源码中——上传包含完整 `FUNCTION ... ENDFUNCTION` 块后，SAP 自动解析接口参数，不需要单独的"参数创建"API。

### 支持的 ADT 类型码

| 类型码 | 含义 | ADT 创建端点 | 父对象 |
|--------|------|-------------|--------|
| `FUGR/F` | 函数组 | `POST /sap/bc/adt/functions/groups` | `DEVC/K`（包） |
| `FUGR/FF` | Function Module | `POST .../fmodules` | `FUGR/F` |
| `FUGR/I` | 函数组 Include | `POST .../includes` | `FUGR/F` |

### FM 源码格式（含接口参数）— 已验证

FM 参数**不能在 `*"*"` 注释块中定义**（RFC ADT 拒绝）。正确方式是 ABAP 原生声明语法：

```abap
FUNCTION zfm_example
  IMPORTING
    VALUE(iv_bukrs) TYPE bukrs
    VALUE(iv_gjahr) TYPE gjahr
  EXPORTING
    VALUE(ev_amount) TYPE dmbtr
  TABLES
    it_data STRUCTURE some_structure OPTIONAL
  EXCEPTIONS
    no_data_found
    invalid_input.
  ... implementation ...
ENDFUNCTION.
```

**关键约束**：
- `REMOTE` 不是源码关键字——通过 PUT FM resource XML 的 `fmodule:processingType="rfc"` 设置
- `*"*"` 注释块格式严格禁止
- FM 参数名遵循 SAP 命名约定：`IV_`（导入）、`EV_`（导出）、`IT_`（导入表）、`ET_`（导出表）、`CT_`（更改表）

### 部署流程（通过 SADT_REST_RFC_ENDPOINT）— 已验证

```
1. 创建函数组 → POST /sap/bc/adt/functions/groups
2. 在函数组内创建 FM → POST .../fmodules
3. Lock FM → POST .../fmodules/{fm}?_action=LOCK&accessMode=MODIFY
4. 设置 FM 元数据（processingType 等）→ PUT .../fmodules/{fm}?lockHandle={handle}
5. 上传 FM 源码（含内联参数声明）→ PUT .../source/main?lockHandle={handle}
6. 激活函数组 → POST /sap/bc/adt/activation
```

步骤 4 和 5 在同一锁内完成，锁释放后执行激活。
