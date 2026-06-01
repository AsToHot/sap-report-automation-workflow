# 功能说明书（AI 规范化）— ZTEST102 电子档案对接报表

> 来源: `spec/EE041 - 电子档案对接报表_V1.0_20260417.docx`
> 规范化日期: 2026-06-01
> 对象类型: REPORT (PROG/P)
> 目标程序: ZTEST102

## 1. 业务目标

按电子档案要求存储 FI 凭证数据到底表 ZSAP_FI179，供电子档案系统获取。用户在线执行报表，选择条件后点击执行，ALV 展示明细数据同时自动写入底表。

## 2. 选择条件

| 字段 | 选项类型 | 必填 | 对应表.字段 | 备注 |
|------|---------|------|-----------|------|
| 公司代码 | 多选 (SELECT-OPTIONS) | 是 | BKPF-BUKRS | |
| 会计年度 | 单选 (PARAMETERS) | 是 | BKPF-GJAHR | |
| 期间 | 单选 (PARAMETERS) | 是 | BKPF-MONAT | |

## 3. 透明表清单

### 3.1 SAP 标准表

| 表名 | 用途 | 关联方式 |
|------|------|---------|
| FAGLFLEXA | 主驱动表（总账行项目） | — |
| BKPF | 凭证头 | FAGLFLEXA-RBUKRS=BKPF-BUKRS, FAGLFLEXA-DOCNR=BKPF-BELNR, FAGLFLEXA-RYEAR=BKPF-GJAHR |
| BSEG | 凭证行项目（客户/供应商/物料等） | FAGLFLEXA-RBUKRS=BSEG-BUKRS, FAGLFLEXA-DOCNR=BSEG-BELNR, FAGLFLEXA-RYEAR=BSEG-GJAHR, FAGLFLEXA-BUZEI=BSEG-BUZEI |
| LFA1 | 供应商主数据 | BSEG-LIFNR=LFA1-LIFNR |
| KNA1 | 客户主数据 | BSEG-KUNNR=KNA1-KUNNR |
| MARA | 物料主数据 | BSEG-MATNR=MARA-MATNR |
| MAKT | 物料描述 | BSEG-MATNR=MAKT-MATNR |
| SKAT | 总账科目描述 | FAGLFLEXA-RACCT=SKAT-SAKNR |
| SKA1 | 总账科目主数据（含银行信息） | FAGLFLEXA-RACCT=SKA1-SAKNR |
| CSKT | 成本中心描述 | BSEG-KOSTL=CSKT-KOSTL, CSKT-SPRAS=ZH, CSKT-DATBI=99991231, CSKT-KOKRS=EEKA |
| CEPC | 利润中心主数据 | FAGLFLEXA-PRCTR=CEPC-PRCTR, CEPC-DATBI=99991231 |
| CEPCT | 利润中心描述 | FAGLFLEXA-PRCTR=CEPCT-PRCTR, CEPCT-SPRAS=ZH, CEPCT-DATBI=99991231, CEPCT-KOKRS=EEKA |
| T077X | 客户账户组描述 | KNA1-KTOKD=T077X-KTOKD |
| T023T | 物料组描述 | MARA-MATKL=T023T-MATKL |
| ANKT | 资产类别描述 | ANLA-ANLKL=ANKT-ANLKL |
| ANLA | 资产主数据 | BSEG-ANLN1=ANLA-ANLN1 |

### 3.2 自定义表

| 表名 | 用途 | 备注 |
|------|------|------|
| ZSAP_BUKRS | 公司代码配置（含机构/分公司映射） | 已有表 |
| ZSAP_FI179 | 电子档案输出底表 | 已有表，执行时写入 |
| ZSAP_FI180 | 电子档案凭证字配置 | 新增配置表 |
| ZFI032_DOC | 银行业务编号来源（优先） | 已有表，优先级1 |
| ZSAP_FI054 | 银行业务编号来源（次选） | 已有表，优先级2 |

> **FS 笔误纠正**: 原始 FS 中多处写 `BKFP`，已全部纠正为 **BKPF**。`MART` 纠正为 **MARA**。

## 4. ALV 输出字段

| 序号 | 输出列名 | 来源表.字段 | 计算/转换规则 |
|------|---------|-----------|-------------|
| 1 | 档号 | — | 固定值 `EEKA` |
| 2 | 机构代码 | FAGLFLEXA-RBUKRS | 直接取值 |
| 3 | 机构名称 | ZSAP_BUKRS-LTEXT | FAGLFLEXA-RBUKRS=ZSAP_BUKRS-BUKRS |
| 4 | 分公司代码 | ZSAP_BUKRS-BUKRS | FAGLFLEXA-PRCTR=CEPC-PRCTR, CEPC-DATBI=99991231 → CEPC-KHINR → ZSAP_BUKRS-BUKRS 匹配；否则空 |
| 5 | 分公司名称 | ZSAP_BUKRS-LTEXT | CEPC-KHINR=ZSAP_BUKRS-BUKRS → ZSAP_BUKRS-LTEXT |
| 6 | 会计年度 | FAGLFLEXA-RYEAR | 直接取值 |
| 7 | 会计期间 | FAGLFLEXA-POPER | 直接取值 |
| 8 | 过账日期 | BKPF-BUDAT | 直接取值 |
| 9 | 记账日期 | BKPF-CPUDT | 直接取值 |
| 10 | 修改日期 | BKPF-AEDAT | 直接取值 |
| 11 | 审核 | BKPF-USNAM | 角色=reviewer |
| 12 | 制单 | BKPF-USNAM | 角色=preparer |
| 13 | 过账 | BKPF-USNAM | 角色=poster |
| 14 | 核准 | BKPF-USNAM | 角色=approver |
| 15 | 经办 | BKPF-USNAM | 角色=handler |
| 16 | 附件数 | — | 保留字段，暂不取值 |
| 17 | 是否调整期凭证 | — | FAGLFLEXA-POPER IN (13,14,15,16) → `是`，否则 `否` |
| 18 | 引入版本号 | — | 保留字段，暂不取值 |
| 19 | 业务类型 | — | BKPF-BLART=Z4 → `期末调汇`，否则 `手工录入` |
| 20 | 是否已冲销 | BKPF-XREVERSAL | 直接取值 |
| 21 | 凭证类型 | BKPF-BLART | 直接取值 |
| 22 | 凭证号码 | FAGLFLEXA-DOCNR | 直接取值 |
| 23 | 凭证字 | ZSAP_FI180-ZVOUTY | FAGLFLEXA-RBUKRS=ZSAP_FI180-BUKRS |
| 24 | 摘要 | BKPF-BKTXT | 直接取值 |
| 25 | 序号 | FAGLFLEXA-DOCLN | 直接取值 |
| 26 | 会计科目编码 | FAGLFLEXA-RACCT | 直接取值 |
| 27 | 会计科目描述 | SKAT-TXT50 | FAGLFLEXA-RACCT=SKAT-SAKNR, SKAT-SPRAS=ZH |
| 28 | 币别 | BKPF-WAERS | 直接取值 |
| 29 | 原币金额 | FAGLFLEXA-TSL | 直接取值 |
| 30 | 借方金额 | FAGLFLEXA-HSL | FAGLFLEXA-DRCRK=`S` 时取 HSL |
| 31 | 贷方金额 | FAGLFLEXA-HSL | FAGLFLEXA-DRCRK=`H` 时取 HSL×(-1) |
| 32 | 部门 | BSEG-KOSTL | 直接取值 |
| 33 | 部门名称 | CSKT-KLTXT | CSKT-SPRAS=ZH, CSKT-DATBI=99991231, CSKT-KOKRS=EEKA, BSEG-KOSTL=CSKT-KOSTL |
| 34 | 利润中心 | FAGLFLEXA-PRCTR | 直接取值 |
| 35 | 利润中心描述 | CEPCT-LTEXT | CEPCT-SPRAS=ZH, CEPCT-DATBI=99991231, CEPCT-KOKRS=EEKA, FAGLFLEXA-PRCTR=CEPCT-PRCTR |
| 36 | 行项目文本 | BSEG-SGTXT | 直接取值 |
| 37 | 物料名称 | MAKT-MAKTG | BSEG-MATNR=MAKT-MATNR, MAKT-SPRAS=ZH |
| 38 | 客户分组名称 | T077X-TXT30 | BSEG-KUNNR=KNA1-KUNNR → KNA1-KTOKD=T077X-KTOKD |
| 39 | 银行名称 | SKA1-ZYHZH | FAGLFLEXA-RACCT LIKE `1002%` OR `1012%`, FAGLFLEXA-RACCT=SKA1-SAKNR |
| 40 | 组织机构名称 | — | 保留字段，暂不取值 |
| 41 | 物料分组名称 | T023T-WGBEZ60 | BSEG-MATNR=MARA-MATNR → MARA-MATKL=T023T-MATKL |
| 42 | 财务供应商名称 | LFA1-NAME1 | BSEG-LIFNR=LFA1-LIFNR, LFA1-KTOKK=Z010 |
| 43 | 财务客户名称 | KNA1-NAME1 | BSEG-KUNNR=KNA1-KUNNR, KNA1-KTOKD=Z006 |
| 44 | 银行账号名称 | SKAT-TXT50 | FAGLFLEXA-RACCT LIKE `1002%`, FAGLFLEXA-RACCT=SKAT-SAKNR, SKAT-SPRAS=ZH |
| 45 | 其他货币资金账号名称 | SKAT-TXT50 | FAGLFLEXA-RACCT LIKE `1012%`, FAGLFLEXA-RACCT=SKAT-SAKNR, SKAT-SPRAS=ZH |
| 46 | 客户名称 | KNA1-NAME1 | BSEG-KUNNR=KNA1-KUNNR, KNA1-KTOKD≠Z006 |
| 47 | 供应商名称 | LFA1-NAME1 | BSEG-LIFNR=LFA1-LIFNR, LFA1-KTOKK∉{Z010,Z011} |
| 48 | 费用项目名称 | — | 保留字段，暂不取值 |
| 49 | 资产类别名称 | ANKT-TXK50 | BSEG-ANLN1=ANLA-ANLN1 → ANLA-ANLKL=ANKT-ANLKL |
| 50 | 员工名称 | LFA1-NAME1 | BSEG-LIFNR=LFA1-LIFNR, LFA1-KTOKK=Z011 |
| 51 | 单位 | BSEG-MEINS | 直接取值 |
| 52 | 单价 | — | 保留字段，暂不取值 |
| 53 | 数量 | BSEG-MENGE | 直接取值 |
| 54 | 结算方式 | — | 保留字段，暂不取值 |
| 55 | 结算号 | BKPF-XBLNR | 直接取值 |
| 56 | 参照字段 | — | 保留字段，暂不取值 |
| 57 | 汇率类型 | — | 固定值 `固定汇率` |
| 58 | 汇率 | BKPF-KURSF | 固定值 `HLTX01_SYS`（当为空时默认） |
| 59 | 业务编号 | ZFI032_DOC-BANKSERIALNUMBER / ZSAP_FI054-BANKSERIALNUMBER / ZFI032_DOC-URID | 仅 RACCT LIKE `1002%` OR `1012%`；优先级: ①ZFI032_DOC (ZCXFLAG≠X) ②ZSAP_FI054 ③SKAT-TXT50 含"汇丰"→ZFI032_DOC-URID |
| 60 | 摘要库 | — | 保留字段，暂不取值 |
| 61 | 银行账号 | SKA1-ZFKYH | FAGLFLEXA-RACCT LIKE `1002%` OR `1012%`, FAGLFLEXA-RACCT=SKA1-SAKNR |
| 62 | 核算维度 | — | 保留字段，暂不取值 |

## 5. 数据保存

- 点击执行后，ALV 展示的同时将相同数据写入底表 **ZSAP_FI179**
- 写入前是否需要清空已有数据（按选择条件）→ TBD，需用户确认

## 6. 权限与约束

- 无特殊权限对象要求（使用标准 FI 表读取权限）
- 主表 FAGLFLEXA 数据量可能很大，需 WHERE 条件严格匹配选择屏

## 7. 待确认项 (TBD)

1. BKPF-USNAM 同时用于审核/制单/过账/核准/经办 5 列——BKPF 只有一个 USNAM 字段，这 5 列将显示同一值，是否确认？
2. 执行前是否需要按选择条件清空 ZSAP_FI179 中的已有数据？
3. ZSAP_FI180 凭证字配置表是否需要在本程序中维护（ALV 可编辑），还是通过 SM30 单独维护？
4. 选择条件中的"公司代码"来源于 BKPF 而非 FAGLFLEXA 的 RBUKRS——两者是否应一致？实际 WHERE 条件应基于哪张表？
