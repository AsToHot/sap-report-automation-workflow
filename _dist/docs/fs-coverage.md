# EE041 字段覆盖审查（ZSAP_FI250）

| FS 逻辑项 | 输出字段/选择字段 | 契约字段（表.字段） | 元数据文件 | 代码落点 | 状态 |
|---|---|---|---|---|---|
| 公司代码 | S_BUKRS | BKPF.BUKRS / FAGLFLEXA.RBUKRS | metadata/tables/BKPF.json | `ZSAP_FI250SEL` | Done |
| 会计年度 | S_GJAHR | BKPF.GJAHR | metadata/tables/BKPF.json | `ZSAP_FI250SEL` | Done |
| 期间 | S_MONAT | BKPF.MONAT | metadata/tables/BKPF.json | `ZSAP_FI250SEL` | Done |
| 档号 | DANGH | 常量 `EEKA` | N/A | `ZSAP_FI250F01` | Done |
| 机构代码 | RBUKRS | FAGLFLEXA.RBUKRS | metadata/tables/FAGLFLEXA.json | `ZSAP_FI250F01` | Done |
| 会计年度 | GJAHR | FAGLFLEXA.RYEAR/BKPF.GJAHR | metadata/tables/FAGLFLEXA.json | `ZSAP_FI250F01` | Done |
| 会计期间 | POPER | FAGLFLEXA.POPER | metadata/tables/FAGLFLEXA.json | `ZSAP_FI250F01` | Done |
| 过账日期 | BUDAT | BKPF.BUDAT | metadata/tables/BKPF.json | `ZSAP_FI250F01` | Done |
| 修改日期 | AEDAT | BKPF.AEDAT | metadata/tables/BKPF.json | `ZSAP_FI250F01` | Done |
| 凭证类型 | BLART | BKPF.BLART | metadata/tables/BKPF.json | `ZSAP_FI250F01` | Done |
| 凭证号码 | DOCNR | FAGLFLEXA.DOCNR | metadata/tables/FAGLFLEXA.json | `ZSAP_FI250F01` | Done |
| 序号 | DOCLN | FAGLFLEXA.DOCLN | metadata/tables/FAGLFLEXA.json | `ZSAP_FI250F01` | Done |
| 会计科目编码 | RACCT | FAGLFLEXA.RACCT | metadata/tables/FAGLFLEXA.json | `ZSAP_FI250F01` | Done |
| 会计科目描述 | TXT50 | SKAT.TXT50 | metadata/tables/SKAT.json | `ZSAP_FI250F01` | Done |
| 借方金额 | DMBTR_S | FAGLFLEXA.HSL (DRCRK='S') | metadata/tables/FAGLFLEXA.json | `ZSAP_FI250F01` | Done |
| 贷方金额 | DMBTR_H | FAGLFLEXA.HSL (DRCRK='H') | metadata/tables/FAGLFLEXA.json | `ZSAP_FI250F01` | Done |
| 部门 | KOSTL | BSEG.KOSTL | metadata/tables/BSEG.json | `ZSAP_FI250F01` | Done |
| 利润中心描述 | PRCTR_TXT | CEPCT.LTEXT | metadata/tables/CEPCT.json | `ZSAP_FI250F01` | Done |
| 物料分组名称 | WGBEZ60 | T023T.WGBEZ60 | metadata/tables/T023T.json | `ZSAP_FI250F01` | Done |
| 资产类别名称 | TXK50 | ANKT.TXK50 | metadata/tables/ANKT.json | `ZSAP_FI250F01` | Done |
| 业务编号 | BUSNUM | ZFI032_DOC.BANKSERIALNUMBER / ZSAP_FI054.BANKSERIALNUMBER | metadata/tables/ZFI032_DOC.json | `ZSAP_FI250F01` | Done |
