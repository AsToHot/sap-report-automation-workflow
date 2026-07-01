# EE090 — 报税取数稽核报表

## 基本信息

| 项目 | 值 |
|------|-----|
| FS 编号 | EL-FS-FI-EE090 |
| FS 名称 | 报税取数稽核报表 |
| 版本 | 1.0 |
| 对象类型 | REPORT（可执行报表） |
| 程序名 | ZTEST101 |
| 开发包 | $TMP（本地包） |
| 模块 | FI |
| 频度 | 日 |
| 处理方式 | 在线 |

## 业务目标

对比应交税金（FAGLFLEXT 总账余额）与申报税金（ZSAP_FI054 银行流水），按公司代码×税种维度稽核差异，输出稽核报表。

## 选择屏幕

| 参数 | 类型 | 参考表/字段 | 说明 |
|------|------|-----------|------|
| P_BUKRS | SELECT-OPTIONS | ZSAP_BUKRS-BUKRS | 公司代码（多选） |
| P_RYEAR | PARAMETERS | FAGLFLEXT-RYEAR | 会计年度（单选） |
| S_RPMAX | SELECT-OPTIONS | FAGLFLEXT-RPMAX | 核对期间（多选） |

## 业务逻辑

### 1. 应交金额（FAGLFLEXT）

**1-1 公司代码映射**：屏幕选择公司代码通过 ZSAP_BUKRS 映射到实际记账公司代码：
- 若 `ZSAP_BUKRS-ZFGS = ''`，则 `ZSAP_BUKRS-BUKRS → FAGLFLEXT-RBUKRS`
- 若 `ZSAP_BUKRS-ZFGS ≠ ''`，则 `ZSAP_BUKRS-ZZGS → FAGLFLEXT-RBUKRS`

**1-2 利润中心映射**：`ZSAP_BUKRS-PRCTR → CEPC-KHINR`，且 `CEPC-DATBI = '99991231'`、`CEPC-KOKRS = 'EEKA'`，取 `CEPC-PRCTR → FAGLFLEXT-PRCTR` 过滤。

**1-3 科目限制**：`FAGLFLEXT-RACCT` = 对应税种科目。

**1-4 期间汇总**：屏幕选择年度 = `FAGLFLEXT-RYEAR`，汇总屏幕选择期间范围对应的 HSL 字段（如期间 03~06 → SUM(HSL03+HSL04+HSL05+HSL06)）。

### 2. 申报金额（ZSAP_FI054）

**2-1 科目限制**：`ZSAP_FI054-KONT_FY` = 对应税种科目。

**2-2 期间限制**：`ZSAP_FI054-TRADEDATE` 在屏幕年度+期间转日期范围内（如 2026年3~6月 → 20260301~20260630）。

**2-3 银行账户映射**：屏幕公司代码 → `SKA1-ZBUKRS`，`SKA1-KTOPL = 'SKA1'` → `SKA1-ZFKYH = ZSAP_FI054-OURBANKACCOUNTNUMBER`。

汇总维度：`OURBANKACCOUNTNUMBER + KONT_FY`，取 `SUM(AMOUNT)`。

### 3. 校验结果

```
校验结果 = 应交金额 - 申报金额
```

## 税种科目映射

| 税种 | 科目 | 应交字段 | 申报字段 | 校验字段 |
|------|------|---------|---------|---------|
| 增值税 | 2221100000 | ZYJZZ | ZZZSB | ZZZJY |
| 城建税 | 2221020000 | ZYJCJ | ZCJSB | ZCJJY |
| 教育费附加 | 2221030000 | ZYJJY | ZJYSB | ZJYJY |
| 地方教育费附加 | 2221040000 | ZYJDF | ZDFSB | ZDFJY |
| 印花税 | 2221070000 | ZYJYH | ZYHSB | ZYHJY |
| 企业所得税 | 2221060000 | ZYJQY | ZQYSB | ZQYJY |

## ALV 输出列

| 列名 | 描述 | 来源 |
|------|------|------|
| BUKRS | 公司代码 | ZSAP_BUKRS-BUKRS |
| LTEXT | 机构名称 | ZSAP_BUKRS-LTEXT（或 BUTXT） |
| ZYJZZ | 应交增值税 | FAGLFLEXT-HSL{period}, RACCT='2221100000' |
| ZZZSB | 增值税申报金额 | ZSAP_FI054-AMOUNT, KONT_FY='2221100000' |
| ZZZJY | 增值税校验结果 | ZYJZZ - ZZZSB |
| ZYJCJ | 应交城建税 | FAGLFLEXT-HSL{period}, RACCT='2221020000' |
| ZCJSB | 城建税申报金额 | ZSAP_FI054-AMOUNT, KONT_FY='2221020000' |
| ZCJJY | 城建税校验结果 | ZYJCJ - ZCJSB |
| ZYJJY | 应交教育费附加 | FAGLFLEXT-HSL{period}, RACCT='2221030000' |
| ZJYSB | 教育费附加申报金额 | ZSAP_FI054-AMOUNT, KONT_FY='2221030000' |
| ZJYJY | 教育费附加校验结果 | ZYJJY - ZJYSB |
| ZYJDF | 应交地方教育费附加 | FAGLFLEXT-HSL{period}, RACCT='2221040000' |
| ZDFSB | 地方教育费申报金额 | ZSAP_FI054-AMOUNT, KONT_FY='2221040000' |
| ZDFJY | 地方教育费校验结果 | ZYJDF - ZDFSB |
| ZYJYH | 应交印花税 | FAGLFLEXT-HSL{period}, RACCT='2221070000' |
| ZYHSB | 印花税申报金额 | ZSAP_FI054-AMOUNT, KONT_FY='2221070000' |
| ZYHJY | 印花税校验结果 | ZYJYH - ZYHSB |
| ZYJQY | 应交企业所得税 | FAGLFLEXT-HSL{period}, RACCT='2221060000' |
| ZQYSB | 企业所得税申报金额 | ZSAP_FI054-AMOUNT, KONT_FY='2221060000' |
| ZQYJY | 企业所得税校验结果 | ZYJQY - ZQYSB |

## 透明表清单

| 表名 | 类型 | 用途 |
|------|------|------|
| ZSAP_BUKRS | Z表 | 公司代码映射（BUKRS→RBUKRS/ZZGS）+ 利润中心映射 + LTEXT |
| FAGLFLEXT | SAP 标准 | 总账科目余额（含 16 期金额列 + 合计列） |
| CEPC | SAP 标准 | 利润中心主数据（层次结构映射） |
| ZSAP_FI054 | Z表 | 银行流水申报数据 |
| SKA1 | SAP 标准 | 总账科目主数据（含银行账户 ZFKYH） |
| SKAT | SAP 标准 | 科目描述文本 |

## 约束与假设

1. 公司代码通过 ZSAP_BUKRS 映射，支持集团-子公司层级关系
2. 利润中心通过 CEPC 层次结构过滤（KOKRS='EEKA'）
3. 金额符号以 FAGLFLEXT 实际存储为准，需 S2.1 验证
4. 申报表 ZSAP_FI054 可能多行（不同银行账户），需先按科目+账户汇总
5. 本地包 $TMP，无需传输请求
