# SADT_REST_RFC_ENDPOINT 调用说明

## 概述

`SADT_REST_RFC_ENDPOINT` 是 SAP 标准函数模块，负责将 ADT REST 请求通过 RFC 通道转发到 SAP 内部的 ADT REST 服务。这是 Eclipse ADT（通过 JCo）使用的同一机制。

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
| SADT_REST_RFC_ENDPOINT | ADT REST API | 代码创建、修改、激活等开发操作 |
| 直接 FM（如 DDIF_FIELDINFO_GET） | SAP 标准函数模块 | 数据字典查询、表数据读取等 |

**注意**：`INSERT_REPORT` 不是 SAP 标准函数模块，在部分系统上不存在。所有代码部署应通过 ADT REST API（即 `SADT_REST_RFC_ENDPOINT`）完成。

## 参考代码

见 `scripts/deploy_rfc.js` -- 完整示例，展示通过 `SADT_REST_RFC_ENDPOINT` 创建程序、上传源码、激活的完整流程。
