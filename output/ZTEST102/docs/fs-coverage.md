# FS 字段与代码实现对齐

## 选择条件

| FS逻辑项 | 输出/选择字段 | 契约字段（表.字段） | 元数据文件 | 代码落点 | 状态 |
|---------|-------------|-------------------|------------|---------|------|
| 公司代码 | S_BUKRS | ZSAP_BUKRS-BUKRS | metadata/tables/ZSAP_BUKRS.json | ZTEST102SEL | Done |
| 会计年度 | P_RYEAR | FAGLFLEXT-RYEAR | metadata/tables/FAGLFLEXT.json | ZTEST102SEL | Done |
| 期间 | S_RPMAX | FAGLFLEXT-RPMAX | metadata/tables/FAGLFLEXT.json | ZTEST102SEL | Done |
| 科目编码 | S_RACCT | FAGLFLEXT-RACCT | metadata/tables/FAGLFLEXT.json | ZTEST102SEL | Done |
| 显示外币余额 | P_FORCUR | — | — | ZTEST102SEL | Done |

## 输出列（本币）

| FS逻辑项 | 输出字段 | 契约字段（表.字段） | 元数据文件 | 代码落点 | 状态 |
|---------|---------|-------------------|------------|---------|------|
| 一级节点 | ZYJKM | LEFT(FAGLFLEXT-RACCT, 4) | metadata/tables/FAGLFLEXT.json | ZTEST102F01 | Done |
| 科目编码 | RACCT | FAGLFLEXT-RACCT | metadata/tables/FAGLFLEXT.json | ZTEST102F01 | Done |
| 科目描述 | TXT50 | SKAT-TXT50 | metadata/tables/SKAT.json | ZTEST102F01 | Done |
| 核算维度编码 | ZFZHS | SKA1-ZFKYH 或 FAGLFLEXT-RFAREA | metadata/tables/SKA1.json | ZTEST102F01 | Done |
| 核算维度名称 | ZFZTX | SKA1-ZYHZH 或 TFKBT-FKBTX | metadata/tables/SKA1.json, TFKBT.json | ZTEST102F01 | Done |
| 期初余额借方 | ZQCJF | FAGLFLEXT-HSLVT/HSL01-16 | metadata/tables/FAGLFLEXT.json | ZTEST102F01 | Done |
| 期初余额贷方 | ZQCDF | FAGLFLEXT-HSLVT/HSL01-16 | metadata/tables/FAGLFLEXT.json | ZTEST102F01 | Done |
| 本期发生借方 | ZBQJF | FAGLFLEXT-HSL01-16 (DRCRK='S') | metadata/tables/FAGLFLEXT.json | ZTEST102F01 | Done |
| 本期发生贷方 | ZBQDF | FAGLFLEXT-HSL01-16 (DRCRK='H') | metadata/tables/FAGLFLEXT.json | ZTEST102F01 | Done |
| 本年累计借方 | ZBNJF | FAGLFLEXT-HSL01-16 (DRCRK='S') | metadata/tables/FAGLFLEXT.json | ZTEST102F01 | Done |
| 本年累计贷方 | ZBNDF | FAGLFLEXT-HSL01-16 (DRCRK='H') | metadata/tables/FAGLFLEXT.json | ZTEST102F01 | Done |
| 期末余额借方 | ZQMJF | FAGLFLEXT-HSLVT/HSL01-16 | metadata/tables/FAGLFLEXT.json | ZTEST102F01 | Done |
| 期末余额贷方 | ZQMDF | FAGLFLEXT-HSLVT/HSL01-16 | metadata/tables/FAGLFLEXT.json | ZTEST102F01 | Done |

## 输出列（外币，仅 P_FORCUR='X' 时显示）

| FS逻辑项 | 输出字段 | 契约字段（表.字段） | 元数据文件 | 代码落点 | 状态 |
|---------|---------|-------------------|------------|---------|------|
| 期初余额借方(外币) | ZQCJF1 | FAGLFLEXT-TSLVT/TSL01-16 | metadata/tables/FAGLFLEXT.json | ZTEST102F01 | Done |
| 期初余额贷方(外币) | ZQCDF1 | FAGLFLEXT-TSLVT/TSL01-16 | metadata/tables/FAGLFLEXT.json | ZTEST102F01 | Done |
| 本期发生借方(外币) | ZBQJF1 | FAGLFLEXT-TSL01-16 (DRCRK='S') | metadata/tables/FAGLFLEXT.json | ZTEST102F01 | Done |
| 本期发生贷方(外币) | ZBQDF1 | FAGLFLEXT-TSL01-16 (DRCRK='H') | metadata/tables/FAGLFLEXT.json | ZTEST102F01 | Done |
| 本年累计借方(外币) | ZBNJF1 | FAGLFLEXT-TSL01-16 (DRCRK='S') | metadata/tables/FAGLFLEXT.json | ZTEST102F01 | Done |
| 本年累计贷方(外币) | ZBNDF1 | FAGLFLEXT-TSL01-16 (DRCRK='H') | metadata/tables/FAGLFLEXT.json | ZTEST102F01 | Done |
| 期末余额借方(外币) | ZQMJF1 | FAGLFLEXT-TSLVT/TSL01-16 | metadata/tables/FAGLFLEXT.json | ZTEST102F01 | Done |
| 期末余额贷方(外币) | ZQMDF1 | FAGLFLEXT-TSLVT/TSL01-16 | metadata/tables/FAGLFLEXT.json | ZTEST102F01 | Done |

## 反查结果

> 阶段 5 前执行：从最终代码 SELECT 列、WHERE、ALV 列回填确认。
