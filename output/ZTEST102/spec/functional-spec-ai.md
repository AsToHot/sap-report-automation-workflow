# EE086 科目余额表 — 功能说明书（AI规范化）

## 1. 业务目标与对象类型

- **业务目标**：按需查询科目余额表，支持多期间汇总、多科目筛选、本币/外币切换
- **对象类型**：REPORT（可执行报表）
- **程序名**：ZTEST102
- **开发包**：$TMP（本地包）

## 2. 选择条件

| 序号 | 字段 | 表.字段 | 类型 | 必输 | 默认值 | 说明 |
|------|------|---------|------|------|--------|------|
| 1 | 公司代码 | ZSAP_BUKRS-BUKRS | SELECT-OPTIONS (单选) | 是 | — | 带搜索帮助，取值 ZSAP_BUKRS |
| 2 | 会计年度 | FAGLFLEXT-RYEAR | PARAMETERS (单选) | 是 | — | 年度，如 2025 |
| 3 | 期间 | FAGLFLEXT-RPMAX | SELECT-OPTIONS (区间) | 否 | — | 如 001~003 |
| 4 | 科目编码 | FAGLFLEXT-RACCT | SELECT-OPTIONS (多选) | 否 | — | 空=全部科目 |
| 5 | 是否显示外币余额 | — | PARAMETERS (checkbox) | 否 | 空(不显示) | 勾选后展示外币金额列 |

## 3. 输出列

### 固定列

| 列名 | 字段名 | 来源 | 说明 |
|------|--------|------|------|
| 一级节点 | ZYJKM | LEFT(FAGLFLEXT-RACCT, 4) | 科目前4位 |
| 科目编码 | RACCT | FAGLFLEXT-RACCT | 科目号 |
| 科目描述 | TXT50 | SKAT-TXT50 | SPRAS='1', KTOPL='EEKA' |
| 核算维度编码 | ZFZHS | SKA1-ZFKYH 或 FAGLFLEXT-RFAREA | 见下方逻辑 |
| 核算维度名称 | ZFZTX | SKA1-ZYHZH 或 TFKBT-FKBTX | 见下方逻辑 |
| 期初余额借方 | ZQCJF | 计算列 | >=0 时展示 |
| 期初余额贷方 | ZQCDF | 计算列 | <0 时展示（取绝对值） |
| 本期发生借方 | ZBQJF | 计算列 | DRCRK='S' |
| 本期发生贷方 | ZBQDF | 计算列 | DRCRK='H' |
| 本年累计借方 | ZBNJF | 计算列 | DRCRK='S' |
| 本年累计贷方 | ZBNDF | 计算列 | DRCRK='H' |
| 期末余额借方 | ZQMJF | 计算列 | >=0 时展示 |
| 期末余额贷方 | ZQMDF | 计算列 | <0 时展示（取绝对值） |

### 外币列（仅勾选"显示外币余额"时展示）

| 列名 | 字段名 | 说明 |
|------|--------|------|
| 期初余额借方(外币) | ZQCJF1 | 同 ZQCJF 逻辑，取 TSL 字段 |
| 期初余额贷方(外币) | ZQCDF1 | 同 ZQCDF 逻辑，取 TSL 字段 |
| 本期发生借方(外币) | ZBQJF1 | 同 ZBQJF 逻辑，取 TSL 字段 |
| 本期发生贷方(外币) | ZBQDF1 | 同 ZBQDF 逻辑，取 TSL 字段 |
| 本年累计借方(外币) | ZBNJF1 | 同 ZBNJF 逻辑，取 TSL 字段 |
| 本年累计贷方(外币) | ZBNDF1 | 同 ZBNDF 逻辑，取 TSL 字段 |
| 期末余额借方(外币) | ZQMJF1 | 同 ZQMJF 逻辑，取 TSL 字段 |
| 期末余额贷方(外币) | ZQMDF1 | 同 ZQMDF 逻辑，取 TSL 字段 |

## 4. 透明表清单

| 表名 | 用途 | 类型 |
|------|------|------|
| **FAGLFLEXT** | 总账汇总表（主表），含期间金额 HSL01~HSL16 / TSL01~TSL16 | 主数据表 |
| **ZSAP_BUKRS** | 公司代码映射配置表（Z表） | 配置表 |
| **CEPC** | 利润中心主数据 | 主数据表 |
| **SKA1** | 科目主数据（科目表级） | 主数据表 |
| **SKAT** | 科目描述文本 | 文本表 |
| **TFKBT** | 功能范围描述 | 文本表 |

## 5. 取数逻辑

### 5.1 公司代码映射

```
IF ZSAP_BUKRS-ZFGS = ''.
  → ZSAP_BUKRS-BUKRS = FAGLFLEXT-RBUKRS  " 直接映射
ELSE.
  → ZSAP_BUKRS-ZZGS = FAGLFLEXT-RBUKRS   " 间接映射
  → ZSAP_BUKRS-PRCTR = CEPC-KHINR
    AND CEPC-DATBI = '99991231'
    AND CEPC-KOKRS = 'EEKA'
    AND CEPC-PRCTR = FAGLFLEXT-PRCTR      " 利润中心限制
ENDIF.
```

### 5.2 核算维度编码/名称

```
IF FAGLFLEXT-RACCT LIKE '1002%'.
  → SKA1-SAKNR = FAGLFLEXT-RACCT, SKA1-KTOPL = 'EEKA'
  → 维度编码 = SKA1-ZFKYH
  → 维度名称 = SKA1-ZYHZH

ELSEIF FAGLFLEXT-RACCT LIKE '6601%'.
  → 维度编码 = FAGLFLEXT-RFAREA
  → TFKBT-FKBER = FAGLFLEXT-RFAREA, TFKBT-SPRAS = '1'
  → 维度名称 = TFKBT-FKBTX
ENDIF.
```

> **FS纠正**：原FS写 `TFKBT-SPRAS = ZH`，但 SPRAS 字段类型为 LANG（长度1），中文语言代码为 `'1'`（非 `'ZH'`）。已修正。

### 5.3 金额计算（本币 HSL）

设屏选期间范围 [P_FROM, P_TO]：

**期初余额：**
- P_FROM = 001: 期初 = HSLVT
- P_FROM > 001: 期初 = HSLVT + HSL01 + ... + HSL(P_FROM-1)
- 结果 >= 0 → 期初借方(ZQCJF)；结果 < 0 → 期初贷方(ZQCDF)，取绝对值

**本期发生：**
- 借方(DRCRK='S'): 本期 = HSL(P_FROM) + ... + HSL(P_TO)
- 贷方(DRCRK='H'): 本期 = HSL(P_FROM) + ... + HSL(P_TO)

**本年累计：**
- 借方(DRCRK='S'): 累计 = HSL01 + ... + HSL(P_TO)
- 贷方(DRCRK='H'): 累计 = HSL01 + ... + HSL(P_TO)

**期末余额：**
- 净额 = 期初余额 + 本期借方 - 本期贷方
- 结果 >= 0 → 期末借方(ZQMJF)；结果 < 0 → 期末贷方(ZQMDF)，取绝对值
- 等价于：净额 = 期初余额借 - 期初余额贷 + 本期发生借 - 本期发生贷

### 5.4 外币金额（TSL，勾选时展示）

计算逻辑同 5.3，将 HSL 替换为 TSL，并增加 `FAGLFLEXT-RTCUR` 限制。

## 6. 权限约束

- 需对 FAGLFLEXT 有读取权限（`S_TABU_DIS` 或等价）
- 需对 ZSAP_BUKRS 有读取权限

## 7. 展示要求

- 按科目号(RACCT)升序排列
- 列横向展示
- 一级节点(ZYJKM) = RACCT 前4位

## 8. 来源

- 原始文档：`spec/EE086 - 科目余额表_V1.0_20260324(1).docx`
- 提取方式：`scripts/extract-docx.js`
