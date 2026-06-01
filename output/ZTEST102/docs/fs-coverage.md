# FS Coverage — ZTEST102 电子档案对接报表

| FS 逻辑项 | 输出字段/选择字段 | 契约字段（表.字段） | 元数据文件 | 代码落点 | 状态 |
|-----------|----------------|-------------------|-----------|---------|------|
| 档号 | ARCHIVE_ID | —（固定值EEKA） | — | ZTEST102T01.abap | Done |
| 机构代码 | RBUKRS | FAGLFLEXA.RBUKRS | FAGLFLEXA.json | ZTEST102F01.abap SELECT | Done |
| 机构名称 | RLTEXT | ZSAP_BUKRS.LTEXT | ZSAP_BUKRS.json | ZTEST102F01.abap LOOKUP | Done |
| 分公司代码 | BUKRS | ZSAP_BUKRS.BUKRS | ZSAP_BUKRS.json | ZTEST102F01.abap LOOKUP | Done |
| 分公司名称 | LTEXT | ZSAP_BUKRS.LTEXT | ZSAP_BUKRS.json | ZTEST102F01.abap LOOKUP | Done |
| 会计年度 | RYEAR | FAGLFLEXA.RYEAR | FAGLFLEXA.json | ZTEST102F01.abap SELECT | Done |
| 会计期间 | POPER | FAGLFLEXA.POPER | FAGLFLEXA.json | ZTEST102F01.abap SELECT | Done |
| 过账日期 | BUDAT | BKPF.BUDAT | BKPF.json | ZTEST102F01.abap SELECT | Done |
| 记账日期 | CPUDT | BKPF.CPUDT | BKPF.json | ZTEST102F01.abap SELECT | Done |
| 修改日期 | AEDAT | BKPF.AEDAT | BKPF.json | ZTEST102F01.abap SELECT | Done |
| 审核 | REVIEWER | BKPF.USNAM | BKPF.json | ZTEST102F01.abap SELECT | Done |
| 制单 | PREPARER | BKPF.USNAM | BKPF.json | ZTEST102F01.abap SELECT | Done |
| 过账 | POSTER | BKPF.USNAM | BKPF.json | ZTEST102F01.abap SELECT | Done |
| 核准 | APPROVER | BKPF.USNAM | BKPF.json | ZTEST102F01.abap SELECT | Done |
| 经办 | OPERATOR | BKPF.USNAM | BKPF.json | ZTEST102F01.abap SELECT | Done |
| 附件数 | ATTCHNUM | —（保留） | — | ZTEST102T01.abap | Done |
| 是否调整期凭证 | ADJUST_FLG | FAGLFLEXA.POPER | FAGLFLEXA.json | ZTEST102F01.abap LOGIC | Done |
| 引入版本号 | VERNUM | —（保留） | — | ZTEST102T01.abap | Done |
| 业务类型 | BUSTYPE | BKPF.BLART | BKPF.json | ZTEST102F01.abap LOGIC | Done |
| 是否已冲销 | XREVERSAL | BKPF.XREVERSAL | BKPF.json | ZTEST102F01.abap SELECT | Done |
| 凭证类型 | BLART | BKPF.BLART | BKPF.json | ZTEST102F01.abap SELECT | Done |
| 凭证号码 | DOCNR | FAGLFLEXA.DOCNR | FAGLFLEXA.json | ZTEST102F01.abap SELECT | Done |
| 凭证字 | ZVOUTY | ZSAP_FI180.ZVOUTY | ZSAP_FI180 | ZTEST102F01.abap LOOKUP | Done |
| 摘要 | BKTXT | BKPF.BKTXT | BKPF.json | ZTEST102F01.abap SELECT | Done |
| 序号 | DOCLN | FAGLFLEXA.DOCLN | FAGLFLEXA.json | ZTEST102F01.abap SELECT | Done |
| 会计科目编码 | RACCT | FAGLFLEXA.RACCT | FAGLFLEXA.json | ZTEST102F01.abap SELECT | Done |
| 会计科目描述 | RACCT_TXT | SKAT.TXT50 | SKAT.json | ZTEST102F01.abap LOOKUP | Done |
| 币别 | WAERS | BKPF.WAERS | BKPF.json | ZTEST102F01.abap SELECT | Done |
| 原币金额 | TSL | FAGLFLEXA.TSL | FAGLFLEXA.json | ZTEST102F01.abap SELECT | Done |
| 借方金额 | HSL_S | FAGLFLEXA.HSL | FAGLFLEXA.json | ZTEST102F01.abap LOGIC | Done |
| 贷方金额 | HSL_H | FAGLFLEXA.HSL | FAGLFLEXA.json | ZTEST102F01.abap LOGIC | Done |
| 部门 | KOSTL | BSEG.KOSTL | BSEG.json | ZTEST102F01.abap SELECT | Done |
| 部门名称 | KOSTL_TXT | CSKT.KLTXT | CSKT (known) | ZTEST102F01.abap LOOKUP | Done |
| 利润中心 | PRCTR | FAGLFLEXA.PRCTR | FAGLFLEXA.json | ZTEST102F01.abap SELECT | Done |
| 利润中心描述 | PRCTR_TXT | CEPCT.LTEXT | CEPCT (known) | ZTEST102F01.abap LOOKUP | Done |
| 行项目文本 | SGTXT | BSEG.SGTXT | BSEG.json | ZTEST102F01.abap SELECT | Done |
| 物料名称 | MAKTX | MAKT.MAKTG | MAKT (known) | ZTEST102F01.abap LOOKUP | Done |
| 客户分组名称 | KTOKD_TXT | T077X.TXT30 | T077X (known) | ZTEST102F01.abap LOOKUP | Done |
| 银行名称 | ZYHZH | SKA1.ZYHZH | SKA1.json | ZTEST102F01.abap LOOKUP | Done |
| 组织机构名称 | ORGNAME | —（保留） | — | ZTEST102T01.abap | Done |
| 物料分组名称 | WGBEZ60 | T023T.WGBEZ60 | T023T (known) | ZTEST102F01.abap LOOKUP | Done |
| 财务供应商名称 | NAME1_LIF_FI | LFA1.NAME1 | LFA1.json | ZTEST102F01.abap LOOKUP | Done |
| 财务客户名称 | NAME1_KUR_FI | KNA1.NAME1 | KNA1 (known) | ZTEST102F01.abap LOOKUP | Done |
| 银行账号名称 | HKONT_BKN | SKAT.TXT50 | SKAT.json | ZTEST102F01.abap LOOKUP | Done |
| 其他货币资金账号名称 | HKONT_FDN | SKAT.TXT50 | SKAT.json | ZTEST102F01.abap LOOKUP | Done |
| 客户名称 | NAME1_KUR | KNA1.NAME1 | KNA1 (known) | ZTEST102F01.abap LOOKUP | Done |
| 供应商名称 | NAME1_LIF | LFA1.NAME1 | LFA1.json | ZTEST102F01.abap LOOKUP | Done |
| 费用项目名称 | EXPENSENAME | —（保留） | — | ZTEST102T01.abap | Done |
| 资产类别名称 | NAME1_ANL | ANKT.TXK50 | ANKT (known) | ZTEST102F01.abap LOOKUP | Done |
| 员工名称 | NAME1_LIF_PA | LFA1.NAME1 | LFA1.json | ZTEST102F01.abap LOOKUP | Done |
| 单位 | MEINS | BSEG.MEINS | BSEG.json | ZTEST102F01.abap SELECT | Done |
| 单价 | PRICE | —（保留） | — | ZTEST102T01.abap | Done |
| 数量 | MENGE | BSEG.MENGE | BSEG.json | ZTEST102F01.abap SELECT | Done |
| 结算方式 | PAYMETHOD | —（保留） | — | ZTEST102T01.abap | Done |
| 结算号 | XBLNR | BKPF.XBLNR | BKPF.json | ZTEST102F01.abap SELECT | Done |
| 参照字段 | — | —（保留） | — | ZTEST102T01.abap | Done |
| 汇率类型 | RAT_TYPE | —（固定值） | — | ZTEST102T01.abap | Done |
| 汇率 | RAT | BKPF.KURSF | BKPF.json | ZTEST102F01.abap SELECT | Done |
| 业务编号 | BUSNUM | ZFI032_DOC.BANKSERIALNUMBER | ZFI032_DOC.json | ZTEST102F01.abap LOOKUP | Done |
| 摘要库 | ABSLIB | —（保留） | — | ZTEST102T01.abap | Done |
| 银行账号 | ZFKYH | SKA1.ZFKYH | SKA1.json | ZTEST102F01.abap LOOKUP | Done |
| 核算维度 | ACCTDIM | —（保留） | — | ZTEST102T01.abap | Done |

## 选择屏字段

| FS 项 | 参数名 | 类型 | 表.字段 | 代码落点 | 状态 |
|-------|--------|------|--------|---------|------|
| 公司代码 | S_BUKRS | SELECT-OPTIONS | BKPF.BUKRS | ZTEST102SEL.abap | Done |
| 会计年度 | P_GJAHR | PARAMETERS | BKPF.GJAHR | ZTEST102SEL.abap | Done |
| 期间 | P_MONAT | PARAMETERS | BKPF.MONAT | ZTEST102SEL.abap | Done |

> 状态: 62 个输出字段 + 3 个选择屏参数全部 Done
