# ZTEST003 科目余额表 — 功能说明书（AI 规范化）

> 来源：`spec/EE086 - 科目余额表_V1.0_20260324(1).docx`
> 规范化日期：2026-06-09

## 1. 业务目标与对象类型

- **对象类型**：REPORT（可执行报表，`PROG/P`）
- **程序名**：ZTEST003
- **业务描述**：按公司代码、会计年度、期间、科目编码查询科目余额表，展示期初余额、本期发生额、本年累计、期末余额，支持本币（HSL）与外币（TSL）两种视图。
- **使用频度**：日
- **处理方式**：在线

## 2. 选择屏幕设计

| 字段名 | 表名 | 字段 | 是否必输 | 类型 | 说明 |
|--------|------|------|---------|------|------|
| P_BUKRS | ZSAP_BUKRS | BUKRS | 必填 | PARAMETERS（单选） | 公司代码，带搜索帮助 |
| P_GJAHR | FAGLFLEXT | RYEAR | 必填 | PARAMETERS（单选） | 会计年度 |
| S_RPMAX | FAGLFLEXT | RPMAX | 可选 | SELECT-OPTIONS | 期间（多选/区间），默认全选 001–016 |
| S_RACCT | FAGLFLEXT | RACCT | 可选 | SELECT-OPTIONS | 科目编码（多选/区间），默认全选 |
| P_FWAERS | — | — | 可选 | PARAMETERS（复选框） | 是否显示外币余额 |

## 3. 透明表清单

| 表名 | 用途 | 角色 |
|------|------|------|
| FAGLFLEXT | 总账科目余额（事实表，含 16 期 HSL/TSL 列） | 主驱动表 |
| ZSAP_BUKRS | 公司代码映射（BUKRS → 子公司/利润中心组） | 选择屏辅助 + JOIN |
| SKA1 | 科目主数据（KTOPL='EEKA'） | 辅助维度 ZFKYH/ZYHZH |
| SKAT | 科目描述文本（SPRAS='1'） | 科目名称 |
| CEPC | 利润中心主数据（KOKRS='EEKA', DATBI='99991231'） | 利润中心层级过滤 |
| TFKBT | 功能范围描述（SPRAS='1'） | 辅助维度名称 FKBTX |

## 4. 业务逻辑

### 4.1 公司代码映射（ZSAP_BUKRS）

```
IF ZSAP_BUKRS-ZFGS = ''
  → 直连：ZSAP_BUKRS-BUKRS = FAGLFLEXT-RBUKRS（无利润中心限制）
ELSE  (ZFGS ≠ '')
  → 子公司：ZSAP_BUKRS-ZFGS = FAGLFLEXT-RBUKRS
  → 利润中心限制：ZSAP_BUKRS-PRCTR = CEPC-KHINR
     AND CEPC-DATBI = '99991231'
     AND CEPC-KOKRS = 'EEKA'
     AND CEPC-PRCTR = FAGLFLEXT-PRCTR
```

### 4.2 科目过滤

- 若 S_RACCT 有输入 → FAGLFLEXT-RACCT IN S_RACCT
- 若 S_RACCT 为空 → 全科目

### 4.3 辅助维度

**1002\* 科目**（银行相关）：
- SKA1-SAKNR = FAGLFLEXT-RACCT, SKA1-KTOPL = 'EEKA'
- 核算维度编码 → SKA1-ZFKYH
- 核算维度名称 → SKA1-ZYHZH

**6601\* 科目**（功能范围相关）：
- FAGLFLEXT-RFAREA = TFKBT-FKBER, TFKBT-SPRAS = '1'
- 核算维度编码 → FAGLFLEXT-RFAREA
- 核算维度名称 → TFKBT-FKBTX

**其他科目**：
- 核算维度编码 = ''
- 核算维度名称 = ''

### 4.4 金额计算（本币 HSL）

SAP 中 DRCRK='H' 行以**负数**存储。设选中期间范围 = [p_from, p_to]。

**HSLxx 列索引**：HSL01=1, HSL02=2, ..., HSL16=16。

```
期初余额 = HSLVT
         + (p_from = 01 ? 0 : SUM(HSL01 .. HSL(p_from-1)))

期初余额借方 = 期初余额 >= 0 ? 期初余额 : 0     " ZQCJF
期初余额贷方 = 期初余额 < 0  ? ABS(期初余额) : 0 " ZQCDF

本期发生_S = SUM(HSL(p_from) .. HSL(p_to)) WHERE DRCRK = 'S'
本期发生_H = SUM(HSL(p_from) .. HSL(p_to)) WHERE DRCRK = 'H'

本期发生借方 = ABS(本期发生_S)                  " ZBQJF
本期发生贷方 = ABS(本期发生_H)                  " ZBQDF

本年累计_S = SUM(HSL01 .. HSL(p_to)) WHERE DRCRK = 'S'
本年累计_H = SUM(HSL01 .. HSL(p_to)) WHERE DRCRK = 'H'

本年累计借方 = ABS(本年累计_S)                  " ZBNJF
本年累计贷方 = ABS(本年累计_H)                  " ZBNDF

期末余额 = 期初余额 + 本期发生_S + 本期发生_H
        （注：H 行为负值，直接相加即可）

期末余额借方 = 期末余额 >= 0 ? 期末余额 : 0      " ZQMJF
期末余额贷方 = 期末余额 < 0  ? ABS(期末余额) : 0 " ZQMDF
```

### 4.5 外币处理（TSL）

当 P_FWAERS = 'X' 时，额外展示外币列。逻辑同上，但：
- 所有 HSL 替换为 TSL（TSLVT, TSL01–TSL16）
- 增加限制 `FAGLFLEXT-RTCUR = <外币币种>`（TBD：外币币种来源需确认）

### 4.6 辅助维度描述关联

对于 1002\* 科目：SKA1 表 JOIN
- SKA1-SAKNR = FAGLFLEXT-RACCT
- SKA1-KTOPL = 'EEKA'
- 取 SKA1-ZFKYH（维度编码）、SKA1-ZYHZH（维度描述）

对于 6601\* 科目：TFKBT 表 JOIN
- TFKBT-FKBER = FAGLFLEXT-RFAREA
- TFKBT-SPRAS = '1'（TBD：LANG 类型长度 1，实际系统中中文可能是 '1'）
- 取 TFKBT-FKBTX（维度描述）

## 5. 输出列（ALV）

| 输出字段 | ALV 列名 | 来源 | 说明 |
|---------|---------|------|------|
| ZYJKM | 一级节点 | LEFT(RACCT, 4) | 科目前 4 位 |
| RACCT | 科目编码 | FAGLFLEXT-RACCT | |
| TXT50 | 科目描述 | SKAT-TXT50 | SPRAS='1' |
| ZFZHS | 核算维度编码 | 见 4.3 | |
| ZFZTX | 核算维度名称 | 见 4.3 | |
| ZQCJF | 期初余额借方 | 计算（4.4） | >=0 展示 |
| ZQCDF | 期初余额贷方 | 计算（4.4） | <0 展示（取绝对值） |
| ZBQJF | 本期发生借方 | 计算（4.4） | DRCRK='S' |
| ZBQDF | 本期发生贷方 | 计算（4.4） | DRCRK='H' |
| ZBNJF | 本年累计借方 | 计算（4.4） | DRCRK='S' |
| ZBNDF | 本年累计贷方 | 计算（4.4） | DRCRK='H' |
| ZQMJF | 期末余额借方 | 计算（4.4） | >=0 展示 |
| ZQMDF | 期末余额贷方 | 计算（4.4） | <0 展示（取绝对值） |

**外币列**（仅 P_FWAERS='X' 时展示）：

| 输出字段 | ALV 列名 | 说明 |
|---------|---------|------|
| ZQCJF1 | 期初余额借方(外币) | TSL 版 4.4 |
| ZQCDF1 | 期初余额贷方(外币) | TSL 版 4.4 |
| ZBQJF1 | 本期发生借方(外币) | TSL 版 4.4 |
| ZBQDF1 | 本期发生贷方(外币) | TSL 版 4.4 |
| ZBNJF1 | 本年累计借方(外币) | TSL 版 4.4 |
| ZBNDF1 | 本年累计贷方(外币) | TSL 版 4.4 |
| ZQMJF1 | 期末余额借方(外币) | TSL 版 4.4 |
| ZQMDF1 | 期末余额贷方(外币) | TSL 版 4.4 |

## 6. 数据展示

- 按科目编码升序排列
- 所有字段横向展示
- 使用 CL_SALV_TABLE 输出 ALV

## 7. 约束与待确认

| 项目 | 状态 | 说明 |
|------|------|------|
| ZSAP_BUKRS-ZFGS vs ZZGS | TBD | 原始 FS 中写 "ZZGS"，实际字段名需拉 DDIC 确认。推测为 ZFGS（子公司） |
| SPRAS='1' vs 'ZH' | 已确认 | LANG 类型长度 1，单字节日程码；中文对应 '1'，英文 'E'。原始 FS 写 'ZH' 会导致 Dump |
| 外币币种 RTCUR | TBD | FS 未指定外币币种筛选条件；若勾选外币展示，需确认是否所有币种均展示 |
| RRCTY + RVERS 过滤 | 已确认 | FAGLFLEXT 需过滤 RRCTY='0'（实际过账）AND RVERS='001'（标准版本），排除计划数据 |
| 1002* + 6601* 之外的科目维 | Done | 为空 |
