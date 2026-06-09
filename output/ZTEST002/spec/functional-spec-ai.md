# EE086 — 科目余额表 功能说明书（AI 规范化）

> 来源：`spec/EE086 - 科目余额表_V1.0_20260324(1).docx` | 对象类型：REPORT | 程序名：ZTEST002

## 1. 业务目标

按公司代码、会计年度、期间、科目查询科目余额表，支持本币与外币双视图。输出含期初余额、本期发生、本年累计、期末余额的借/贷方及对应的外币列。

## 2. 选择条件（选择屏）

| 字段 | 表.字段 | 类型 | 必输 | 默认值 | 备注 |
|------|---------|------|------|--------|------|
| 公司代码 | ZSAP_BUKRS-BUKRS | 单选 | 是 | — | 搜索帮助取 ZSAP_BUKRS |
| 会计年度 | FAGLFLEXT-RYEAR | 单选 | 是 | — | |
| 期间 | FAGLFLEXT-RPMAX | 多选/区间 | 是 | — | 如 001~016 |
| 科目编码 | FAGLFLEXT-RACCT | 多选/区间 | 否 | 全部 | |
| 是否显示外币余额 | — | Checkbox | 否 | 不勾选 | 勾选后 ALV 额外展示 8 列外币金额 |

## 3. 涉及透明表

| 表名 | 用途 | 主/从 |
|------|------|-------|
| FAGLFLEXT | 科目余额主数据（HSL/TSL 16 期间列） | 主 |
| ZSAP_BUKRS | 公司代码映射（BUKRS→RBUKRS/ZZGS/PRCTR） | 从 |
| SKA1 | 科目主数据（1002* 科目辅助维度） | 从 |
| SKAT | 科目描述文本 | 从 |
| CEPC | 利润中心主数据 | 从 |
| TFKBT | 功能范围描述（6601* 科目辅助维度） | 从 |

## 4. 关键业务逻辑

### 4.1 公司代码映射

- 若 `ZSAP_BUKRS-ZFGS = ''`（空）→ `ZSAP_BUKRS-BUKRS = FAGLFLEXT-RBUKRS`
- 若 `ZSAP_BUKRS-ZFGS <> ''`（非空）→ `ZSAP_BUKRS-ZZGS = FAGLFLEXT-RBUKRS`，且 `ZSAP_BUKRS-PRCTR = CEPC-KHINR`，`CEPC-DATBI = '99991231'`，`CEPC-KOKRS = 'EEKA'`，取 `CEPC-PRCTR = FAGLFLEXT-PRCTR` 做数据限制

### 4.2 辅助维度

| 条件 | 编码字段 | 描述字段 | 取值逻辑 |
|------|---------|---------|---------|
| RACCT 以 `1002` 开头 | SKA1-ZFKYH | SKA1-ZYHZH | SKA1-SAKNR = FAGLFLEXT-RACCT, SKA1-KTOPL = 'EEKA' |
| RACCT 以 `6601` 开头 | FAGLFLEXT-RFAREA | TFKBT-FKBTX | TFKBT-FKBER = FAGLFLEXT-RFAREA, TFKBT-SPRAS = '1'（中文） |

> **注意**：SPRAS 为 LANG 类型（长度 1），中文 = `'1'`，英文 = `'E'`。

### 4.3 金额计算（本币 = HSL，外币 = TSL）

设屏选期间范围起始期 = `n`，截止期 = `m`（n, m ∈ {01..16}）。

**期初余额** = `HSLVT + SUM(HSL01..HSL_{n-1})`（若 n=01 则仅 HSLVT）— 不分 DRCRK，按合计值符号分流借/贷方

**本期发生借方** = DRCRK = 'S' 的行：`SUM(HSL_{n}..HSL_{m})`

**本期发生贷方** = DRCRK = 'H' 的行：`SUM(HSL_{n}..HSL_{m})`（H 行 HSL 在 ABAP 中存储为负值，输出时取绝对值）

**本年累计借方** = DRCRK = 'S' 的行：`SUM(HSL01..HSL_{m})`

**本年累计贷方** = DRCRK = 'H' 的行：`SUM(HSL01..HSL_{m})`（取绝对值）

**期末余额** = 期初余额 + 本期发生借方 + 本期发生贷方，结果 ≥0 → 借方列，<0 → 贷方列

### 4.4 外币处理

当屏幕勾选"是否显示外币余额"时，上述 8 列金额对应改为 TSL（外币金额），同时增加限制 `FAGLFLEXT-RTCUR`（币别）。

## 5. 输出列（ALV）

| 列名 | 来源 | 说明 |
|------|------|------|
| ZYJKM（一级节点） | LEFT(FAGLFLEXT-RACCT, 4) | |
| RACCT（科目编码） | FAGLFLEXT-RACCT | |
| TXT50（科目描述） | SKAT-TXT50 | SKAT-SAKNR=RACCT, SPRAS='1' |
| ZFZHS（核算维度编码） | SKA1-ZFKYH / FAGLFLEXT-RFAREA | 按 4.2 分支 |
| ZFZTX（核算维度名称） | SKA1-ZYHZH / TFKBT-FKBTX | 按 4.2 分支 |
| ZQCJF（期初余额借方） | FAGLFLEXT | ≥0 时展示 |
| ZQCDF（期初余额贷方） | FAGLFLEXT | <0 时展示（取绝对值） |
| ZBQJF（本期发生借方） | FAGLFLEXT | DRCRK='S' |
| ZBQDF（本期发生贷方） | FAGLFLEXT | DRCRK='H'（取绝对值） |
| ZBNJF（本年累计借方） | FAGLFLEXT | DRCRK='S' |
| ZBNDF（本年累计贷方） | FAGLFLEXT | DRCRK='H'（取绝对值） |
| ZQMJF（期末余额借方） | 计算 | ≥0 |
| ZQMDF（期末余额贷方） | 计算 | <0（取绝对值） |
| ZQCJF1（期初余额借方外币） | FAGLFLEXT | 仅外币模式，TSL 版，≥0 |
| ZQCDF1（期初余额贷方外币） | FAGLFLEXT | 仅外币模式，TSL 版，<0（取绝对值） |
| ZBQJF1（本期发生借方外币） | FAGLFLEXT | 仅外币模式，TSL 版，DRCRK='S' |
| ZBQDF1（本期发生贷方外币） | FAGLFLEXT | 仅外币模式，TSL 版，DRCRK='H'（取绝对值） |
| ZBNJF1（本年累计借方外币） | FAGLFLEXT | 仅外币模式，TSL 版，DRCRK='S' |
| ZBNDF1（本年累计贷方外币） | FAGLFLEXT | 仅外币模式，TSL 版，DRCRK='H'（取绝对值） |
| ZQMJF1（期末余额借方外币） | 计算 | 仅外币模式，TSL 版，≥0 |
| ZQMDF1（期末余额贷方外币） | 计算 | 仅外币模式，TSL 版，<0（取绝对值） |

### 排序

按 `FAGLFLEXT-RACCT` 升序排列。

## 6. 约束与备注

- 权限：需 `S_DEVELOP` 开发权限
- 性能：FAGLFLEXT 为大数据量表，WHERE 条件必须有 RYEAR + RBUKRS 限制
- 变式：支持保存选择屏变式
- 部署：本地包 `$TMP`，无需传输请求
