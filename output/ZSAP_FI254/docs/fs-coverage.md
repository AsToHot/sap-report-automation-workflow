# FS 对齐审查 — ZSAP_FI254

| FS 逻辑项 | 输出字段/选择字段 | 契约字段（表.字段） | 元数据文件 | 代码落点 | 状态 |
|---|---|---|---|---|---|
| 公司代码（选择屏） | P_BUKRS | ZSAP_BUKRS.BUKRS | output/ZSAP_FI254/metadata/tables/ZSAP_BUKRS.json | ZSAP_FI254SEL | Done |
| 会计年度（选择屏） | P_GJAHR | FAGLFLEXT.RYEAR | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json | ZSAP_FI254SEL | Done |
| 期间（选择屏） | S_RPMAX | FAGLFLEXT.RPMAX | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json | ZSAP_FI254SEL | Done |
| 科目编码（选择屏） | S_RACCT | FAGLFLEXT.RACCT | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json | ZSAP_FI254SEL | Done |
| 是否显示外币余额 | P_WAERS | - | - | ZSAP_FI254SEL | Done |
| 一级节点 | ZYJKM | 计算列 LEFT(RACCT,4) | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json | ZSAP_FI254F01 | Done |
| 科目编码 | RACCT | FAGLFLEXT.RACCT | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json | ZSAP_FI254F01 | Done |
| 科目描述 | TXT50 | SKAT.TXT50 | output/ZSAP_FI254/metadata/tables/SKAT.json | ZSAP_FI254F01 | Done |
| 核算维度编码（1002*） | ZFZHS | SKA1.ZFKYH | output/ZSAP_FI254/metadata/tables/SKA1.json | ZSAP_FI254F01 | Done |
| 核算维度编码（6601*） | ZFZHS | FAGLFLEXT.RFAREA | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json | ZSAP_FI254F01 | Done |
| 核算维度名称（1002*） | ZFZTX | SKA1.ZYHZH | output/ZSAP_FI254/metadata/tables/SKA1.json | ZSAP_FI254F01 | Done |
| 核算维度名称（6601*） | ZFZTX | TFKBT.FKBTX | output/ZSAP_FI254/metadata/tables/TFKBT.json | ZSAP_FI254F01 | Done |
| 期初余额借方 | ZQCJF | FAGLFLEXT.HSLVT+HSL01~16 | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json | ZSAP_FI254F01 | Done |
| 期初余额贷方 | ZQCDF | FAGLFLEXT.HSLVT+HSL01~16 | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json | ZSAP_FI254F01 | Done |
| 本期发生借方 | ZBQJF | FAGLFLEXT.HSL01~16 | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json | ZSAP_FI254F01 | Done |
| 本期发生贷方 | ZBQDF | FAGLFLEXT.HSL01~16 | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json | ZSAP_FI254F01 | Done |
| 本年累计借方 | ZBNJF | FAGLFLEXT.HSL01~16 | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json | ZSAP_FI254F01 | Done |
| 本年累计贷方 | ZBNDF | FAGLFLEXT.HSL01~16 | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json | ZSAP_FI254F01 | Done |
| 期末余额借方 | ZQMJF | 计算列 | - | ZSAP_FI254F01 | Done |
| 期末余额贷方 | ZQMDF | 计算列 | - | ZSAP_FI254F01 | Done |
| 期初余额借方（外币） | ZQCJF1 | FAGLFLEXT.TSLVT+TSL01~16 | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json | ZSAP_FI254F01 | Done |
| 期初余额贷方（外币） | ZQCDF1 | FAGLFLEXT.TSLVT+TSL01~16 | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json | ZSAP_FI254F01 | Done |
| 本期发生借方（外币） | ZBQJF1 | FAGLFLEXT.TSL01~16 | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json | ZSAP_FI254F01 | Done |
| 本期发生贷方（外币） | ZBQDF1 | FAGLFLEXT.TSL01~16 | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json | ZSAP_FI254F01 | Done |
| 本年累计借方（外币） | ZBNJF1 | FAGLFLEXT.TSL01~16 | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json | ZSAP_FI254F01 | Done |
| 本年累计贷方（外币） | ZBNDF1 | FAGLFLEXT.TSL01~16 | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json | ZSAP_FI254F01 | Done |
| 期末余额借方（外币） | ZQMJF1 | 计算列 | - | ZSAP_FI254F01 | Done |
| 期末余额贷方（外币） | ZQMDF1 | 计算列 | - | ZSAP_FI254F01 | Done |
