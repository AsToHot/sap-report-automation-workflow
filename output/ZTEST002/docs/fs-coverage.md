# FS 字段对齐审查 — ZTEST002

| FS 逻辑项 | 输出字段/选择字段 | 契约字段（表.字段） | 元数据文件 | 代码落点 | 状态 |
|-----------|-----------------|-------------------|------------|---------|------|
| 公司代码（选择） | P_BUKRS | ZSAP_BUKRS-BUKRS | ZSAP_BUKRS.json | ZTEST002SEL | Done |
| 会计年度（选择） | P_GJAHR | FAGLFLEXT-RYEAR | FAGLFLEXT.json | ZTEST002SEL | Done |
| 期间（选择） | S_RPMAX | FAGLFLEXT-RPMAX | FAGLFLEXT.json | ZTEST002SEL | Done |
| 科目编码（选择） | S_RACCT | FAGLFLEXT-RACCT | FAGLFLEXT.json | ZTEST002SEL | Done |
| 是否显示外币余额 | P_FCUR | — | — | ZTEST002SEL | Done |
| 一级节点 | ZYJKM | LEFT(RACCT,4) | FAGLFLEXT.json | ZTEST002F01 | Done |
| 科目编码 | RACCT | FAGLFLEXT-RACCT | FAGLFLEXT.json | ZTEST002F01 | Done |
| 科目描述 | TXT50 | SKAT-TXT50 | SKAT.json | ZTEST002F01 | Done |
| 核算维度编码（1002*） | ZFZHS | SKA1-ZFKYH | SKA1.json | ZTEST002F01 | Done |
| 核算维度编码（6601*） | ZFZHS | FAGLFLEXT-RFAREA | FAGLFLEXT.json | ZTEST002F01 | Done |
| 核算维度名称（1002*） | ZFZTX | SKA1-ZYHZH | SKA1.json | ZTEST002F01 | Done |
| 核算维度名称（6601*） | ZFZTX | TFKBT-FKBTX | TFKBT.json | ZTEST002F01 | Done |
| 期初余额借方 | ZQCJF | HSLVT+HSL01.. | FAGLFLEXT.json | ZTEST002F01 | Done |
| 期初余额贷方 | ZQCDF | HSLVT+HSL01.. | FAGLFLEXT.json | ZTEST002F01 | Done |
| 本期发生借方 | ZBQJF | DRCRK='S' HSL.. | FAGLFLEXT.json | ZTEST002F01 | Done |
| 本期发生贷方 | ZBQDF | DRCRK='H' HSL.. | FAGLFLEXT.json | ZTEST002F01 | Done |
| 本年累计借方 | ZBNJF | DRCRK='S' HSL01.. | FAGLFLEXT.json | ZTEST002F01 | Done |
| 本年累计贷方 | ZBNDF | DRCRK='H' HSL01.. | FAGLFLEXT.json | ZTEST002F01 | Done |
| 期末余额借方 | ZQMJF | 计算 | FAGLFLEXT.json | ZTEST002F01 | Done |
| 期末余额贷方 | ZQMDF | 计算 | FAGLFLEXT.json | ZTEST002F01 | Done |
| 外币列（8列） | ZQCJF1..ZQMDF1 | TSL 版同上 | FAGLFLEXT.json | ZTEST002F01 | Done |
| 公司代码映射 | ZFGS/ZZGS | ZSAP_BUKRS-ZFGS/-ZZGS | ZSAP_BUKRS.json | ZTEST002F01 | Done |
| 利润中心过滤 | PRCTR | CEPC-KHINR/-PRCTR | CEPC.json | ZTEST002F01 | Done |
