# 功能规格说明书 — 科目余额表（EE086）

## 1. 业务目标与报表类型

- **报表名称**：科目余额表
- **程序名**：ZSAP_FI086A
- **报表类型**：清单报表（在线 ALV）
- **用途**：按公司代码、会计年度、期间、科目编码查询总账科目余额及发生额
- **使用频度**：日
- **开发优先度**：高

## 2. 选择条件（选择屏幕）

| 字段描述 | 表名 | 字段名 | 输入类型 | 是否必输 | 默认值 | 搜索帮助 | 补充逻辑 |
|----------|------|--------|----------|----------|--------|----------|----------|
| 公司代码 | ZSAP_BUKRS | BUKRS | 单选 | 是 | — | ZSAP_BUKRS-BUKRS | — |
| 会计年度 | FAGLFLEXT | RYEAR | 单选 | 是 | — | — | — |
| 期间 | FAGLFLEXT | RPMAX | 多选 | 否 | 全部 | — | — |
| 科目编码 | FAGLFLEXT | RACCT | 多选 | 否 | 全部 | — | — |
| 是否显示外币余额 | — | — | Checkbox | 否 | 不勾选 | — | 勾选后 ALV 额外展示 TSL 外币列 |

## 3. 输出列

### 3.1 基础列（始终展示）

| 序号 | 字段描述 | 输出字段名 | 来源表 | 来源字段 | 计算/转换规则 |
|------|----------|-----------|--------|----------|---------------|
| 1 | 一级节点 | ZYJKM | — | — | `LEFT(FAGLFLEXT-RACCT, 4)` |
| 2 | 科目编码 | RACCT | FAGLFLEXT | RACCT | 直接取值 |
| 3 | 科目描述 | TXT50 | SKAT | TXT50 | `SKAT-SPRAS = 'ZH'`, `SKAT-KTOPL = 'EEKA'`, `SKAT-SAKNR = FAGLFLEXT-RACCT` |
| 4 | 核算维度编码 | ZFZHS | — | — | 1002* → `SKA1-ZFKYH` (KTOPL='EEKA'); 6601* → `FAGLFLEXT-RFAREA` |
| 5 | 核算维度名称 | ZFZTX | — | — | 1002* → `SKA1-ZYHZH` (KTOPL='EEKA'); 6601* → `TFKBT-FKBTX` (SPRAS='ZH') |
| 6 | 期初余额借方 | ZQCJF | — | — | 见 4.1 期初余额逻辑，金额≥0 时展示 |
| 7 | 期初余额贷方 | ZQCDF | — | — | 见 4.1 期初余额逻辑，金额<0 时展示 |
| 8 | 本期发生借方 | ZBQJF | — | — | 见 4.2 本期发生逻辑，DRCRK='S' |
| 9 | 本期发生贷方 | ZBQDF | — | — | 见 4.2 本期发生逻辑，DRCRK='H' |
| 10 | 本年累计借方 | ZBNJF | — | — | 见 4.3 本年累计逻辑，DRCRK='S' |
| 11 | 本年累计贷方 | ZBNDF | — | — | 见 4.3 本年累计逻辑，DRCRK='H' |
| 12 | 期末余额借方 | ZQMJF | — | — | `ZQCJF + ZQCDF + ZBQJF + ZBQDF`，结果≥0 |
| 13 | 期末余额贷方 | ZQMDF | — | — | `ZQCJF + ZQCDF + ZBQJF + ZBQDF`，结果<0 |

### 3.2 外币列（勾选"是否显示外币余额"时展示）

外币列逻辑与本币列完全一致，仅将 `HSL` 替换为 `TSL`，并增加 `FAGLFLEXT-RTCUR` 作为币种维度。

| 字段描述 | 输出字段名 |
|----------|-----------|
| 期初余额借方（外币） | ZQCJF1 |
| 期初余额贷方（外币） | ZQCDF1 |
| 本期发生借方（外币） | ZBQJF1 |
| 本期发生贷方（外币） | ZBQDF1 |
| 本年累计借方（外币） | ZBNJF1 |
| 本年累计贷方（外币） | ZBNDF1 |
| 期末余额借方（外币） | ZQMJF1 |
| 期末余额贷方（外币） | ZQMDF1 |

## 4. 取数逻辑

### 4.1 主驱动表

**FAGLFLEXT**（总账：总计表）为主表，按以下条件筛选：

- `FAGLFLEXT-RYEAR = 屏选会计年度`
- `FAGLFLEXT-RPMAX IN 屏选期间`（多选）
- `FAGLFLEXT-RACCT IN 屏选科目编码`（多选，未输则不过滤）
- 公司代码条件见 4.4

### 4.2 期初余额逻辑（HSL 本位币）

**场景 A：屏选期间起始 = 01**
- 期初余额 = `FAGLFLEXT-HSLVT`（年初结转余额）

**场景 B：屏选期间起始 ≠ 01（如 03~06）**
- 期初余额 = `HSLVT + HSL01 + HSL02 + ... + HSL(起始期间-1)`
- 例：期间 03~06 → `HSLVT + HSL01 + HSL02`

**展示规则**：
- 期初余额 ≥ 0 → 展示在"期初余额借方"列
- 期初余额 < 0 → 展示在"期初余额贷方"列（取绝对值或保持负数，按业务约定）

### 4.3 本期发生逻辑（HSL 本位币）

- **本期发生借方**：`DRCRK = 'S'` 时，`SUM(HSLxx)`，xx 为屏选期间范围内各期间
  - 例：03~06 → `HSL03 + HSL04 + HSL05 + HSL06`
- **本期发生贷方**：`DRCRK = 'H'` 时，`SUM(HSLxx)`，同上

### 4.4 本年累计逻辑（HSL 本位币）

- **本年累计借方**：`DRCRK = 'S'` 时，`SUM(HSL01..HSLxx)`，xx 为屏选截止期间
  - 例：03~06 → `HSL01 + HSL02 + HSL03 + HSL04 + HSL05 + HSL06`
- **本年累计贷方**：`DRCRK = 'H'` 时，同上

### 4.5 期末余额逻辑

`期末余额 = 期初余额 + 本期发生借方 + 本期发生贷方`

- 结果 ≥ 0 → 展示在"期末余额借方"
- 结果 < 0 → 展示在"期末余额贷方"

### 4.6 公司代码关联逻辑

```
IF ZSAP_BUKRS-ZFGS = ""
    FAGLFLEXT-RBUKRS = ZSAP_BUKRS-BUKRS
ELSE
    FAGLFLEXT-RBUKRS = ZSAP_BUKRS-ZZGS
    AND ZSAP_BUKRS-PRCTR = CEPC-KHINR
    AND CEPC-DATBI = '99991231'
    AND CEPC-KOKRS = 'EEKA'
    AND CEPC-PRCTR = FAGLFLEXT-PRCTR
ENDIF
```

### 4.7 辅助维度逻辑

**核算维度编码（ZFZHS）**：
- `FAGLFLEXT-RACCT LIKE '1002*'` → 取 `SKA1-ZFKYH`（`SKA1-KTOPL = 'EEKA'`, `SKA1-SAKNR = FAGLFLEXT-RACCT`）
- `FAGLFLEXT-RACCT LIKE '6601*'` → 取 `FAGLFLEXT-RFAREA`
- 其他 → 空

**核算维度名称（ZFZTX）**：
- `FAGLFLEXT-RACCT LIKE '1002*'` → 取 `SKA1-ZYHZH`（`SKA1-KTOPL = 'EEKA'`）
- `FAGLFLEXT-RACCT LIKE '6601*'` → 取 `TFKBT-FKBTX`（`TFKBT-SPRAS = 'ZH'`）
- 其他 → 空

### 4.8 外币处理逻辑

勾选"是否显示外币余额"时：
- 所有金额字段逻辑不变，将 `HSL` 系列字段替换为 `TSL` 系列字段
- ALV 额外增加币种列 `RTCUR`

## 5. 透明表清单

| 表名 | 用途 | 主/从 |
|------|------|-------|
| FAGLFLEXT | 总账总计表，主驱动表 | 主 |
| ZSAP_BUKRS | 公司代码配置，辅助公司代码筛选 | 从 |
| SKA1 | 总账科目主数据，取辅助维度字段 | 从 |
| SKAT | 总账科目描述 | 从 |
| CEPC | 利润中心主数据，公司代码关联用 | 从 |
| TFKBT | 功能范围文本 | 从 |

## 6. 权限与性能约束

- **权限**：需 `S_DEVELOP` 权限创建/修改程序；运行时需 FI 模块读取权限
- **排序**：按科目号 `RACCT` 升序排列
- **性能**：FAGLFLEXT 通常数据量较大，建议按 `RBUKRS + RYEAR + RACCT` 组合索引取数
- **变式**：支持保存屏幕变式
