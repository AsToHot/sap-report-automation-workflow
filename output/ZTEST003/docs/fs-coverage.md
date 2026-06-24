# FS Coverage — ZTEST003 字段对齐审查

| FS 逻辑项 | 输出字段/选择字段 | 契约字段（表.字段） | 元数据文件 | 代码落点 | 状态 |
|-----------|-----------------|-------------------|------------|---------|------|
| 公司代码 | P_BUKRS | ZSAP_BUKRS-BUKRS | ZSAP_BUKRS.json | ZTEST003SEL | Done |
| 会计年度 | P_GJAHR | FAGLFLEXT-RYEAR | FAGLFLEXT.json | ZTEST003SEL | Done |
| 期间 | S_RPMAX | FAGLFLEXT-RPMAX | FAGLFLEXT.json | ZTEST003SEL | Done |
| 科目编码 | S_RACCT | FAGLFLEXT-RACCT | FAGLFLEXT.json | ZTEST003SEL | Done |
| 是否显示外币余额 | P_FWAERS | — | — | ZTEST003SEL | Done |
| 一级节点 | ZYJKM | LEFT(FAGLFLEXT-RACCT,4) | FAGLFLEXT.json | ZTEST003F01 | Done |
| 科目编码 | RACCT | FAGLFLEXT-RACCT | FAGLFLEXT.json | ZTEST003F01 | Done |
| 科目描述 | TXT50 | SKAT-TXT50 | SKAT.json | ZTEST003F01 | Done |
| 核算维度编码 | ZFZHS | SKA1-ZFKYH / FAGLFLEXT-RFAREA | SKA1.json | ZTEST003F01 | Done |
| 核算维度名称 | ZFZTX | SKA1-ZYHZH / TFKBT-FKBTX | SKA1.json / TFKBT.json | ZTEST003F01 | Done |
| 期初余额借方 | ZQCJF | HSLVT+HSL01.. >=0 | FAGLFLEXT.json | ZTEST003F01 | Done |
| 期初余额贷方 | ZQCDF | ABS(HSLVT+HSL01..) <0 | FAGLFLEXT.json | ZTEST003F01 | Done |
| 本期发生借方 | ZBQJF | SUM(HSLp_from..p_to) DRCRK='S' | FAGLFLEXT.json | ZTEST003F01 | Done |
| 本期发生贷方 | ZBQDF | ABS(SUM(HSLp_from..p_to)) DRCRK='H' | FAGLFLEXT.json | ZTEST003F01 | Done |
| 本年累计借方 | ZBNJF | SUM(HSL01..p_to) DRCRK='S' | FAGLFLEXT.json | ZTEST003F01 | Done |
| 本年累计贷方 | ZBNDF | ABS(SUM(HSL01..p_to)) DRCRK='H' | FAGLFLEXT.json | ZTEST003F01 | Done |
| 期末余额借方 | ZQMJF | 期末净额 >=0 | FAGLFLEXT.json | ZTEST003F01 | Done |
| 期末余额贷方 | ZQMDF | ABS(期末净额) <0 | FAGLFLEXT.json | ZTEST003F01 | Done |
| 期初余额借方(外币) | ZQCJF1 | TSLVT+TSL01.. >=0 | FAGLFLEXT.json | ZTEST003F01 | Done |
| 期初余额贷方(外币) | ZQCDF1 | ABS(TSLVT+TSL01..) <0 | FAGLFLEXT.json | ZTEST003F01 | Done |
| 本期发生借方(外币) | ZBQJF1 | SUM(TSLp_from..p_to) DRCRK='S' | FAGLFLEXT.json | ZTEST003F01 | Done |
| 本期发生贷方(外币) | ZBQDF1 | ABS(SUM(TSLp_from..p_to)) DRCRK='H' | FAGLFLEXT.json | ZTEST003F01 | Done |
| 本年累计借方(外币) | ZBNJF1 | SUM(TSL01..p_to) DRCRK='S' | FAGLFLEXT.json | ZTEST003F01 | Done |
| 本年累计贷方(外币) | ZBNDF1 | ABS(SUM(TSL01..p_to)) DRCRK='H' | FAGLFLEXT.json | ZTEST003F01 | Done |
| 期末余额借方(外币) | ZQMJF1 | 期末TSL净额 >=0 | FAGLFLEXT.json | ZTEST003F01 | Done |
| 期末余额贷方(外币) | ZQMDF1 | ABS(期末TSL净额) <0 | FAGLFLEXT.json | ZTEST003F01 | Done |
