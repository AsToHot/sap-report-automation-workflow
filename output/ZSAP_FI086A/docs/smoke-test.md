# Smoke Test Report — ZSAP_FI086A

## 基本信息

| 项目 | 值 |
|------|-----|
| 程序名 | ZSAP_FI086A |
| 功能说明 | 科目余额表（EE086） |
| 开发包 | $TMP |
| 部署方式 | RFC直连 ADT REST（deploy_rfc.js） |
| 部署时间 | 2026-04-27 |

## 验证项

### 1. 程序存在性检查

| 对象 | 类型 | SAP中存在 | 本地内容匹配 |
|------|------|-----------|--------------|
| ZSAP_FI086A | 主程序（PROG/P） | 是 | 是 |
| ZSAP_FI086AT01 | Include（PROG/I） | 是 | 是 |
| ZSAP_FI086ASEL | Include（PROG/I） | 是 | 是 |
| ZSAP_FI086AF01 | Include（PROG/I） | 是 | 是 |

验证方法：MCP `getObjectSource` 逐一比对本地文件与SAP返回内容，4个对象全部一致。

### 2. 程序结构检查

- 主程序包含 3 个 Include：T01 / SEL / F01
- 标准 ALV 报表结构完整（REPORT → INCLUDE → START-OF-SELECTION → PERFORM）
- 无语法激活错误（preauditRequested=true 通过）

### 3. 关键业务逻辑检查

- `get_data`：读取 ZSAP_BUKRS + FAGLFLEXT（含 CEPC 关联分支）
- `process_data`：按科目+DRCRK 分组，计算期初/本期/累计/期末余额
- `get_hsl_field` / `get_tsl_field`：动态字段访问 HSL01-16 / TSL01-16
- `get_aux_dim`：辅助维度（利润中心、功能范围）取数逻辑完整
- `build_alv` / `display_alv`：REUSE_ALV_GRID_DISPLAY 动态字段目录

### 4. 已知限制

- 未在 SAP GUI 中实际执行 ALV 输出验证（仅代码级比对）
- 未验证大数据量性能表现（基于 FAGLFLEXT 估算，详见 performance-estimate.md）

## 结论

S5.5 = **smoke-test-passed: yes**

程序 ZSAP_FI086A 已成功部署至 SAP，源码一致性验证通过，激活状态正常。
