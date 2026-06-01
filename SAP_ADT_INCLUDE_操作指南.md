# SAP ADT REST API - INCLUDE 程序操作指南

> **对象类型**: `PROG/I` (Include Program)  
> **与主程序区别**: INCLUDE 不能独立执行，需通过 `INCLUDE` 语句嵌入主程序  
> **最低系统版本**: SAP Basis 7.31 SP04

---

## 目录

1. [对象类型对照](#1-对象类型对照)
2. [创建 INCLUDE](#2-创建-include)
3. [读取 INCLUDE](#3-读取-include)
4. [修改 INCLUDE](#4-修改-include)
5. [语法检查](#5-语法检查)
6. [激活对象](#6-激活对象)
7. [完整 Python 示例](#7-完整-python-示例)
8. [HTTP 原始请求参考](#8-http-原始请求参考)
9. [常见问题](#9-常见问题)

---

## 1. 对象类型对照

| 对象 | 类型代码 | programType | 说明 |
|------|----------|-------------|------|
| 主程序 (Executable Program) | `PROG/P` | `1` | 可独立执行的报告程序 |
| **INCLUDE 程序** | **`PROG/I`** | **`I`** | **包含程序，不可独立执行** |
| 模块池 (Module Pool) | `PROG/M` | `M` | 屏幕事务程序 |
| 函数组 (Function Group) | `FUGR/F` | - | 函数组主程序 |
| 子例程池 | `PROG/S` | `S` | 子例程集合 |

> 关键: 操作 INCLUDE 时，object_type 必须明确指定为 `PROG/I`，否则系统会按普通程序处理。

---

## 2. 创建 INCLUDE

### 2.1 Python (abap-adt-py)

```python
from abap_adt import AdtClient

client = AdtClient(
    sap_host="http://your-sap-system:8000",
    username="DEVELOPER",
    password="your_password",
    client="100",
    language="EN",
)

client.login()

# 创建 INCLUDE - 类型必须是 PROG/I
client.create(
    object_type="PROG/I",
    name="z_my_include",
    description="My Include Program",
    parent="$TMP",              # 本地包（不传输）
    # parent="Z_DEV",           # 开发包（需要传输请求）
)
```

### 2.2 创建后立即写入初始源代码

```python
include_uri = "/sap/bc/adt/programs/programs/z_my_include"

# 锁定
lock_handle = client.lock(include_uri)

# 写入初始代码
initial_source = "* Include Z_MY_INCLUDE
"
initial_source += "DATA: gv_counter TYPE i.

"
initial_source += "FORM process_data USING iv_input TYPE string.
"
initial_source += "  gv_counter = gv_counter + 1.
"
initial_source += "ENDFORM."

client.set_object_source(
    f"{include_uri}/source/main",
    initial_source,
    lock_handle,
)

# 语法检查 + 激活
client.syntax_check_code(initial_source, url=include_uri)
client.activate("Z_MY_INCLUDE", include_uri)

# 解锁
client.unlock(include_uri, lock_handle)
```

---

## 3. 读取 INCLUDE

### 3.1 搜索对象

```python
# 搜索 INCLUDE
results = client.search_object("z_my_include", max_results=50)
# 返回: [{"name": "Z_MY_INCLUDE", "uri": "/sap/bc/adt/programs/programs/z_my_include", "type": "PROG/I"}]
```

### 3.2 读取源代码

```python
include_uri = "/sap/bc/adt/programs/programs/z_my_include"

# 读取源代码（必须加 /source/main 后缀）
source = client.get_object_source(f"{include_uri}/source/main")
print(source)
```

### 3.3 读取元数据

```python
# 获取对象元数据（类型、包、描述等）
metadata = client.get_object_metadata(include_uri)
```

---

## 4. 修改 INCLUDE

### 4.1 标准修改流程

```python
include_uri = "/sap/bc/adt/programs/programs/z_my_include"

# Step 1: 锁定对象（获取 lockHandle）
lock_handle = client.lock(include_uri)

# Step 2: 准备新源代码
new_source = "* Include Z_MY_INCLUDE - Updated
"
new_source += "DATA: gv_counter TYPE i.
"
new_source += "DATA: gv_timestamp TYPE timestamp.

"
new_source += "FORM process_data USING iv_input TYPE string.
"
new_source += "  gv_counter = gv_counter + 1.
"
new_source += "  GET TIME STAMP FIELD gv_timestamp.
"
new_source += "ENDFORM.

"
new_source += "FORM display_result.
"
new_source += "  WRITE: / 'Counter:', gv_counter.
"
new_source += "ENDFORM."

# Step 3: 写入源代码
client.set_object_source(
    f"{include_uri}/source/main",    # 必须加 /source/main
    new_source,
    lock_handle,
    transport="DEVK123456",         # 可选：传输请求号（修改开发包对象时需要）
)

# Step 4: 语法检查
client.syntax_check_code(new_source, url=include_uri)

# Step 5: 激活
client.activate("Z_MY_INCLUDE", include_uri)

# Step 6: 解锁
client.unlock(include_uri, lock_handle)
```

### 4.2 关键参数说明

| 参数 | 说明 | 必填 |
|------|------|------|
| `object_type="PROG/I"` | 对象类型，必须是 PROG/I | 是 |
| `f"{uri}/source/main"` | 源代码 URI 后缀 | 是 |
| `lock_handle` | 锁定句柄，防止并发修改 | 是 |
| `transport` | 传输请求号（修改开发包对象时需要） | 视情况 |

---

## 5. 语法检查

### 5.1 Python 调用

```python
# 方式一：直接检查代码字符串
result = client.syntax_check_code(
    source_code=new_source,
    url=include_uri,           # 对象 URI（不含 /source/main）
)
# 返回检查结果，包含错误或警告信息

# 方式二：检查已保存的源代码
result = client.syntax_check(include_uri)
```

### 5.2 处理检查结果

```python
if result.has_errors():
    for error in result.errors:
        print(f"Error at line {error.line}: {error.message}")

if result.has_warnings():
    for warning in result.warnings:
        print(f"Warning at line {warning.line}: {warning.message}")

if result.is_success():
    print("Syntax check passed")
```

---

## 6. 激活对象

### 6.1 单对象激活

```python
# 激活单个 INCLUDE
client.activate("Z_MY_INCLUDE", include_uri)
```

### 6.2 批量激活（如果 INCLUDE 被多个主程序引用）

```python
# 激活 INCLUDE 及其所有引用对象
client.activate_with_refs("Z_MY_INCLUDE", include_uri)
```

### 6.3 激活 HTTP 请求

```http
POST /sap/bc/adt/activation
Content-Type: application/xml

<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference 
    adtcore:uri="/sap/bc/adt/programs/programs/z_my_include"
    adtcore:type="PROG/I"
    adtcore:name="Z_MY_INCLUDE"/>
</adtcore:objectReferences>
```

---

## 7. 完整 Python 示例

```python
#!/usr/bin/env python3
# SAP ADT INCLUDE 程序完整操作示例

from abap_adt import AdtClient

# ==================== 配置 ====================
SAP_HOST = "http://your-sap-system:8000"
USERNAME = "DEVELOPER"
PASSWORD = "your_password"
CLIENT = "100"
LANGUAGE = "EN"

INCLUDE_NAME = "z_my_include"
PACKAGE = "$TMP"                    # 本地包（无需传输）
# PACKAGE = "Z_DEV"                 # 开发包（需要传输请求）
TRANSPORT = None                    # 本地包无需传输请求
# TRANSPORT = "DEVK123456"          # 开发包需要传输请求

# ==================== 连接 ====================
client = AdtClient(
    sap_host=SAP_HOST,
    username=USERNAME,
    password=PASSWORD,
    client=CLIENT,
    language=LANGUAGE,
)

client.login()
print(f"已登录 SAP 系统: {SAP_HOST}")

# ==================== 创建 INCLUDE ====================
print(f"创建 INCLUDE: {INCLUDE_NAME}")
try:
    client.create(
        object_type="PROG/I",
        name=INCLUDE_NAME,
        description="My Include Program",
        parent=PACKAGE,
    )
    print(f"INCLUDE {INCLUDE_NAME} 创建成功")
except Exception as e:
    print(f"创建失败（可能已存在）: {e}")

# ==================== 更新源代码 ====================
include_uri = f"/sap/bc/adt/programs/programs/{INCLUDE_NAME.lower()}"
source_uri = f"{include_uri}/source/main"

print(f"锁定对象: {INCLUDE_NAME}")
lock_handle = client.lock(include_uri)
print(f"锁定成功, lockHandle: {lock_handle}")

# 构建源代码
source_code = f"* &---------------------------------------------------------------------*
"
source_code += f"* &  Include          {INCLUDE_NAME}
"
source_code += f"* &---------------------------------------------------------------------*

"
source_code += f"DATA: gv_counter TYPE i.
"
source_code += f"DATA: gv_timestamp TYPE timestamp.

"
source_code += f"FORM process_data USING iv_input TYPE string.
"
source_code += f"  gv_counter = gv_counter + 1.
"
source_code += f"  GET TIME STAMP FIELD gv_timestamp.
"
source_code += f"ENDFORM.

"
source_code += f"FORM display_result.
"
source_code += f"  WRITE: / 'Counter:', gv_counter,
"
source_code += f"         / 'Timestamp:', gv_timestamp.
"
source_code += f"ENDFORM."

print(f"写入源代码...")
client.set_object_source(
    source_uri,
    source_code,
    lock_handle,
    transport=TRANSPORT,
)
print("源代码写入成功")

# ==================== 语法检查 ====================
print(f"语法检查...")
result = client.syntax_check_code(source_code, url=include_uri)

if result.has_errors():
    print("语法检查失败:")
    for error in result.errors:
        print(f"   Line {error.line}: {error.message}")
    client.unlock(include_uri, lock_handle)
    raise RuntimeError("Syntax check failed")
else:
    print("语法检查通过")

# ==================== 激活 ====================
print(f"激活对象...")
client.activate(INCLUDE_NAME, include_uri)
print("激活成功")

# ==================== 解锁 ====================
print(f"解锁对象...")
client.unlock(include_uri, lock_handle)
print("解锁成功")

# ==================== 验证读取 ====================
print(f"验证读取源代码...")
read_source = client.get_object_source(source_uri)
print("源代码内容:")
print(read_source)

print(f"INCLUDE {INCLUDE_NAME} 操作完成!")
```

---

## 8. HTTP 原始请求参考

### 8.1 创建 INCLUDE

```http
POST /sap/bc/adt/programs/programs
Content-Type: application/vnd.sap.adt.programs.programs.v2+xml
X-CSRF-Token: {token}
Accept: application/vnd.sap.adt.programs.programs.v2+xml

<?xml version="1.0" encoding="UTF-8"?>
<program:abapProgram 
    xmlns:program="http://www.sap.com/adt/programs/programs"
    xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference 
    adtcore:uri="/sap/bc/adt/programs/programs/z_my_include"
    adtcore:type="PROG/I"
    adtcore:name="Z_MY_INCLUDE"/>
  <adtcore:packageRef adtcore:name="$TMP"/>
  <program:programType>I</program:programType>
  <program:sourceUri>./source/main</program:sourceUri>
</program:abapProgram>
```

### 8.2 锁定对象

```http
POST /sap/bc/adt/programs/programs/z_my_include?lock=true
X-CSRF-Token: {token}

# 响应头返回:
# ETag: {lockHandle}
```

### 8.3 更新源代码

```http
PUT /sap/bc/adt/programs/programs/z_my_include/source/main
Content-Type: text/plain
If-Match: {lockHandle}

* Include Z_MY_INCLUDE
DATA: gv_counter TYPE i.
FORM process_data USING iv_input TYPE string.
ENDFORM.
```

### 8.4 语法检查

```http
POST /sap/bc/adt/checkruns?uri=/sap/bc/adt/programs/programs/z_my_include
Content-Type: text/plain
X-CSRF-Token: {token}

* Include Z_MY_INCLUDE
DATA: gv_counter TYPE i.
FORM process_data USING iv_input TYPE string.
ENDFORM.
```

### 8.5 激活

```http
POST /sap/bc/adt/activation
Content-Type: application/xml
X-CSRF-Token: {token}

<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference 
    adtcore:uri="/sap/bc/adt/programs/programs/z_my_include"
    adtcore:type="PROG/I"
    adtcore:name="Z_MY_INCLUDE"/>
</adtcore:objectReferences>
```

### 8.6 解锁

```http
DELETE /sap/bc/adt/programs/programs/z_my_include?lock={lockHandle}
X-CSRF-Token: {token}
```

---

## 9. 常见问题

### Q1: 创建时报错 "Object type PROG/I not supported"?
- **原因**: 系统版本低于 7.31 SP04，或 ADT 服务未激活。
- **解决**: 检查 `/sap/bc/adt/programs/` 服务是否激活，确认系统版本。

### Q2: 修改标准 SAP INCLUDE（非 Z* 对象）?
- **必须**先在 SAP GUI 中使用 **Modification Assistant** 创建修改括号。
- ADT 只能编辑已有的 REPLACE/DELETE/INSERT 括号。
- 需要 `S_DEVELOP` 和 `S_ADT_RES` 授权对象。

### Q3: 传输请求（Transport）什么时候需要？
- 对象在 **本地包（$TMP）**: 不需要传输请求。
- 对象在 **开发包（如 Z_DEV）**: 必须提供传输请求号，否则保存失败。

### Q4: 如何确认对象已正确创建为 INCLUDE 类型？
```python
metadata = client.get_object_metadata(include_uri)
print(metadata.type)  # 应输出: PROG/I
```

### Q5: INCLUDE 被主程序引用后，修改 INCLUDE 需要重新激活主程序吗？
- **不需要** - 激活 INCLUDE 后，引用它的主程序会自动使用最新版本。
- 但如果修改了 INCLUDE 的接口（如 FORM 参数变化），建议重新激活主程序进行完整语法检查。

### Q6: 权限不足?
需要以下授权对象：
- `S_ADT_RES` - ADT 资源访问
- `S_DEVELOP` - ABAP 开发对象操作
- `S_TRANSPRT` - 传输请求操作（如涉及传输）

---

## 参考文档

- [SAP Help: ABAP Development Tools (ADT)](https://help.sap.com/docs/abap-cloud)
- [abap-adt-py GitHub](https://github.com/jfilak/abap-adt-py)
- [SAP ADT REST API Documentation](https://api.sap.com/api/SAP_ADT_API)

---

*文档版本: 2026-04-27*  
*适用系统: SAP Basis 7.31 SP04+*
