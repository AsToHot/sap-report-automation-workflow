# FS 对齐审查 — ZSAP_FI086A

## 选择屏字段覆盖

| FS 逻辑项 | 输出字段/选择字段 | 契约字段（表.字段） | 元数据文件 | 代码落点 | 状态 |
|-----------|------------------|---------------------|------------|----------|------|
| 公司代码 | S_BUKRS | ZSAP_BUKRS.BUKRS | metadata/tables/ZSAP_BUKRS.json | ZSAP_FI086ASEL | Done |
| 会计年度 | S_RYEAR | FAGLFLEXT.RYEAR | metadata/tables/FAGLFLEXT.json | ZSAP_FI086ASEL | Done |
| 期间 | S_RPMAX | FAGLFLEXT.RPMAX | metadata/tables/FAGLFLEXT.json | ZSAP_FI086ASEL | Done |
| 科目编码 | S_RACCT | FAGLFLEXT.RACCT | metadata/tables/FAGLFLEXT.json | ZSAP_FI086ASEL | Done |
| 是否显示外币余额 | P_WAERS | — | — | ZSAP_FI086ASEL | Done |

## 输出字段覆盖

| FS 逻辑项 | 输出字段/选择字段 | 契约字段（表.字段） | 元数据文件 | 代码落点 | 状态 |
|-----------|------------------|---------------------|------------|----------|------|
| 一级节点 | ZYJKM | — | — | ZSAP_FI086AF01 | Done |
| 科目编码 | RACCT | FAGLFLEXT.RACCT | metadata/tables/FAGLFLEXT.json | ZSAP_FI086AF01 | Done |
| 科目描述 | TXT50 | SKAT.TXT50 | metadata/tables/SKAT.json | ZSAP_FI086AF01 | Done |
| 核算维度编码 | ZFZHS | SKA1.ZFKYH / FAGLFLEXT.RFAREA | metadata/tables/SKA1.json / metadata/tables/FAGLFLEXT.json | ZSAP_FI086AF01 | Done |
| 核算维度名称 | ZFZTX | SKA1.ZYHZH / TFKBT.FKBTX | metadata/tables/SKA1.json / metadata/tables/TFKBT.json | ZSAP_FI086AF01 | Done |
| 期初余额借方 | ZQCJF | FAGLFLEXT.HSLVT/HSL01~16 | metadata/tables/FAGLFLEXT.json | ZSAP_FI086AF01 | Done |
| 期初余额贷方 | ZQCDF | FAGLFLEXT.HSLVT/HSL01~16 | metadata/tables/FAGLFLEXT.json | ZSAP_FI086AF01 | Done |
| 本期发生借方 | ZBQJF | FAGLFLEXT.HSL01~16 | metadata/tables/FAGLFLEXT.json | ZSAP_FI086AF01 | Done |
| 本期发生贷方 | ZBQDF | FAGLFLEXT.HSL01~16 | metadata/tables/FAGLFLEXT.json | ZSAP_FI086AF01 | Done |
| 本年累计借方 | ZBNJF | FAGLFLEXT.HSL01~16 | metadata/tables/FAGLFLEXT.json | ZSAP_FI086AF01 | Done |
| 本年累计贷方 | ZBNDF | FAGLFLEXT.HSL01~16 | metadata/tables/FAGLFLEXT.json | ZSAP_FI086AF01 | Done |
| 期末余额借方 | ZQMJF | — | — | ZSAP_FI086AF01 | Done |
| 期末余额贷方 | ZQMDF | — | — | ZSAP_FI086AF01 | Done |
| 期初余额借方(外币) | ZQCJF1 | FAGLFLEXT.TSLVT/TSL01~16 | metadata/tables/FAGLFLEXT.json | ZSAP_FI086AF01 | Done |
| 期初余额贷方(外币) | ZQCDF1 | FAGLFLEXT.TSLVT/TSL01~16 | metadata/tables/FAGLFLEXT.json | ZSAP_FI086AF01 | Done |
| 本期发生借方(外币) | ZBQJF1 | FAGLFLEXT.TSL01~16 | metadata/tables/FAGLFLEXT.json | ZSAP_FI086AF01 | Done |
| 本期发生贷方(外币) | ZBQDF1 | FAGLFLEXT.TSL01~16 | metadata/tables/FAGLFLEXT.json | ZSAP_FI086AF01 | Done |
| 本年累计借方(外币) | ZBNJF1 | FAGLFLEXT.TSL01~16 | metadata/tables/FAGLFLEXT.json | ZSAP_FI086AF01 | Done |
| 本年累计贷方(外币) | ZBNDF1 | FAGLFLEXT.TSL01~16 | metadata/tables/FAGLFLEXT.json | ZSAP_FI086AF01 | Done |
| 期末余额借方(外币) | ZQMJF1 | — | — | ZSAP_FI086AF01 | Done |
| 期末余额贷方(外币) | ZQMDF1 | — | — | ZSAP_FI086AF01 | Done |
| 币种 | RTCUR | FAGLFLEXT.RTCUR | metadata/tables/FAGLFLEXT.json | ZSAP_FI086AF01 | Done |

## 反查：代码有但 FS 无

| 字段 | 来源 | 说明 | 处理 |
|------|------|------|------|
| DRCRK | FAGLFLEXT | 借贷标识，FS 逻辑中隐含使用（"DRCRK='S'"），但未在输出列中独立列出 | 正常，作为计算条件使用 |
| PRCTR | FAGLFLEXT / CEPC | 利润中心，FS 中仅在公司代码关联逻辑中提及 | 正常，作为关联条件使用 |
| RBUKRS | FAGLFLEXT | 公司代码（实际存储字段），FS 中使用的是 ZSAP_BUKRS-BUKRS | 正常，筛选时映射 |

## 审查结论

- FS 全量输出字段已覆盖，无遗漏
- 选择屏字段已覆盖，无遗漏
- 无 "FS 有但代码无" 的情况
- 无 "代码有但 FS 无" 的意外字段

状态：**通过**
