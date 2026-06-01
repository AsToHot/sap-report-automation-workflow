# Technical Design — ZTEST102 电子档案对接报表

> 基于: `output/ZTEST102/spec/functional-spec-ai.md`
> 元数据: `output/ZTEST102/metadata/tables/*.json`
> 模板: `templates/reference/ZSAP_FI244/`

## 1. 表清单与用途

### 主查询表

| 表名 | 别名 | 用途 | 元数据 |
|------|------|------|--------|
| FAGLFLEXA | fl | 主驱动表（总账行项目） | FAGLFLEXA.json |
| BKPF | bk | 凭证头信息 | BKPF.json |
| BSEG | bs | 凭证行项目详情 | BSEG.json |

### LOOKUP 表（应用层关联，非 SQL JOIN）

| 表名 | 用途 | 关联键 |
|------|------|--------|
| ZSAP_BUKRS | 机构名称、分公司代码/名称 | RBUKRS → BUKRS, CEPC-KHINR → BUKRS |
| SKAT | 会计科目描述 | RACCT → SAKNR, SPRAS=ZH |
| SKA1 | 银行名称/账号 | RACCT → SAKNR |
| CSKT | 部门名称 | KOSTL → KOSTL, SPRAS=ZH, DATBI=99991231, KOKRS=EEKA |
| CEPC | 利润中心层次 | PRCTR → PRCTR, DATBI=99991231 |
| CEPCT | 利润中心描述 | PRCTR → PRCTR, SPRAS=ZH, DATBI=99991231, KOKRS=EEKA |
| LFA1 | 供应商名称 | LIFNR → LIFNR |
| KNA1 | 客户名称 | KUNNR → KUNNR |
| MARA | 物料组 | MATNR → MATNR |
| MAKT | 物料名称 | MATNR → MATNR, SPRAS=ZH |
| T077X | 客户分组描述 | KTOKD → KTOKD |
| T023T | 物料组描述 | MATKL → MATKL |
| ANLA | 资产类别 | ANLN1 → ANLN1 |
| ANKT | 资产类别名称 | ANLKL → ANLKL |
| ZSAP_FI180 | 凭证字配置 | RBUKRS → BUKRS |
| ZFI032_DOC | 银行业务编号(优先) | RBUKRS→BUKRS, DOCNR→BELNR, RYEAR→GJAHR, ZCXFLAG≠X |
| ZSAP_FI054 | 银行业务编号(次选) | RBUKRS→BUKRS, DOCNR→BELNR, RYEAR→GJAHR |

### 输出表

| 表名 | 用途 |
|------|------|
| ZSAP_FI179 | ALV 展示 + 数据保存 |

## 2. 字段契约（实现唯一依据）

| 逻辑项（FS/输出） | 表名 | 字段名 | 元数据文件 |
|------------------|------|--------|------------|
| 档号 | — | — | 固定值 "EEKA" |
| 机构代码 | FAGLFLEXA | RBUKRS | FAGLFLEXA.json |
| 机构名称 | ZSAP_BUKRS | LTEXT | ZSAP_BUKRS.json |
| 分公司代码 | ZSAP_BUKRS | BUKRS | ZSAP_BUKRS.json (via CEPC-KHINR) |
| 分公司名称 | ZSAP_BUKRS | LTEXT | ZSAP_BUKRS.json |
| 会计年度 | FAGLFLEXA | RYEAR | FAGLFLEXA.json |
| 会计期间 | FAGLFLEXA | POPER | FAGLFLEXA.json |
| 过账日期 | BKPF | BUDAT | BKPF.json |
| 记账日期 | BKPF | CPUDT | BKPF.json |
| 修改日期 | BKPF | AEDAT | BKPF.json |
| 审核 | BKPF | USNAM | BKPF.json（所有角色共用） |
| 制单 | BKPF | USNAM | BKPF.json |
| 过账 | BKPF | USNAM | BKPF.json |
| 核准 | BKPF | USNAM | BKPF.json |
| 经办 | BKPF | USNAM | BKPF.json |
| 附件数 | — | — | 保留字段 |
| 是否调整期凭证 | FAGLFLEXA | POPER | FAGLFLEXA.json (13/14/15/16→是) |
| 引入版本号 | — | — | 保留字段 |
| 业务类型 | BKPF | BLART | BKPF.json (Z4→期末调汇) |
| 是否已冲销 | BKPF | XREVERSAL | BKPF.json |
| 凭证类型 | BKPF | BLART | BKPF.json |
| 凭证号码 | FAGLFLEXA | DOCNR | FAGLFLEXA.json |
| 凭证字 | ZSAP_FI180 | ZVOUTY | ZSAP_FI180 (新增表) |
| 摘要 | BKPF | BKTXT | BKPF.json |
| 序号 | FAGLFLEXA | DOCLN | FAGLFLEXA.json |
| 会计科目编码 | FAGLFLEXA | RACCT | FAGLFLEXA.json |
| 会计科目描述 | SKAT | TXT50 | SKAT.json |
| 币别 | BKPF | WAERS | BKPF.json |
| 原币金额 | FAGLFLEXA | TSL | FAGLFLEXA.json |
| 借方金额 | FAGLFLEXA | HSL | FAGLFLEXA.json (DRCRK=S) |
| 贷方金额 | FAGLFLEXA | HSL | FAGLFLEXA.json (DRCRK=H, *-1) |
| 部门 | BSEG | KOSTL | BSEG.json |
| 部门名称 | CSKT | KLTXT | CSKT (known) |
| 利润中心 | FAGLFLEXA | PRCTR | FAGLFLEXA.json |
| 利润中心描述 | CEPCT | LTEXT | CEPCT (known) |
| 行项目文本 | BSEG | SGTXT | BSEG.json |
| 物料名称 | MAKT | MAKTG | MAKT (known) |
| 客户分组名称 | T077X | TXT30 | T077X (known) |
| 银行名称 | SKA1 | ZYHZH | SKA1.json |
| 组织机构名称 | — | — | 保留字段 |
| 物料分组名称 | T023T | WGBEZ60 | T023T (known) |
| 财务供应商名称 | LFA1 | NAME1 | LFA1.json (KTOKK=Z010) |
| 财务客户名称 | KNA1 | NAME1 | KNA1 (known) (KTOKD=Z006) |
| 银行账号名称 | SKAT | TXT50 | SKAT.json (RACCT LIKE 1002%) |
| 其他货币资金账号名称 | SKAT | TXT50 | SKAT.json (RACCT LIKE 1012%) |
| 客户名称 | KNA1 | NAME1 | KNA1 (known) (KTOKD≠Z006) |
| 供应商名称 | LFA1 | NAME1 | LFA1.json (KTOKK∉{Z010,Z011}) |
| 费用项目名称 | — | — | 保留字段 |
| 资产类别名称 | ANKT | TXK50 | ANKT (known) |
| 员工名称 | LFA1 | NAME1 | LFA1.json (KTOKK=Z011) |
| 单位 | BSEG | MEINS | BSEG.json |
| 单价 | — | — | 保留字段 |
| 数量 | BSEG | MENGE | BSEG.json |
| 结算方式 | — | — | 保留字段 |
| 结算号 | BKPF | XBLNR | BKPF.json |
| 参照字段 | — | — | 保留字段 |
| 汇率类型 | — | — | 固定值 "固定汇率" |
| 汇率 | BKPF | KURSF | BKPF.json（为空时默认 HLTX01_SYS） |
| 业务编号 | ZFI032_DOC | BANKSERIALNUMBER | ZFI032_DOC.json (RACCT LIKE 1002%/1012%) |
| 摘要库 | — | — | 保留字段 |
| 银行账号 | SKA1 | ZFKYH | SKA1.json (RACCT LIKE 1002%/1012%) |
| 核算维度 | — | — | 保留字段 |

## 3. 主查询设计

```sql
SELECT fl~rbukrs, fl~ryear, fl~docnr, fl~docln, fl~poper, fl~racct, fl~prctr, fl~tsl, fl~hsl, fl~drcrk,
       bk~budat, bk~cpudt, bk~aedat, bk~usnam, bk~blart, bk~xreversal, bk~bktxt, bk~waers, bk~kursf, bk~xblnr,
       bs~kostl, bs~sgtxt, bs~matnr, bs~lifnr, bs~kunnr, bs~meins, bs~menge, bs~anln1, bs~buzei
  FROM faglflexa AS fl
  INNER JOIN bkpf AS bk ON bk~bukrs = fl~rbukrs AND bk~belnr = fl~docnr AND bk~gjahr = fl~ryear
  LEFT JOIN bseg AS bs ON bs~bukrs = fl~rbukrs AND bs~belnr = fl~docnr AND bs~gjahr = fl~ryear AND bs~buzei = fl~buzei
  WHERE fl~rbukrs IN @s_bukrs
    AND fl~ryear   = @p_gjahr
    AND fl~poper   = @p_monat
  ORDER BY fl~rbukrs, fl~ryear, fl~poper, fl~docnr, fl~docln.
```

## 4. 选择屏 ↔ 数据库映射

| 选择屏参数 | 类型 | 目标表.字段 | WHERE 子句 |
|-----------|------|-----------|-----------|
| S_BUKRS | SELECT-OPTIONS | FAGLFLEXA-RBUKRS | fl~rbukrs IN @s_bukrs |
| P_GJAHR | PARAMETERS | FAGLFLEXA-RYEAR | fl~ryear = @p_gjahr |
| P_MONAT | PARAMETERS | FAGLFLEXA-POPER | fl~poper = @p_monat |

## 5. 应用层 LOOKUP 设计

主查询完成后逐行 LOOP，通过 READ TABLE BINARY SEARCH 获取：
- ZSAP_BUKRS (KEY: BUKRS)
- SKAT (KEY: SAKNR, SPRAS=ZH)
- SKA1 (KEY: SAKNR)
- CSKT (KEY: KOSTL)
- CEPC/CEPCT (KEY: PRCTR)
- LFA1 (KEY: LIFNR) — 按 KTOKK 区分 财务供应商/员工/普通供应商
- KNA1 (KEY: KUNNR) — 按 KTOKD 区分 财务客户/普通客户
- MAKT (KEY: MATNR)
- T077X (KEY: KTOKD)
- T023T (KEY: MATKL)
- ANKT (KEY: ANLKL) — via ANLA join
- ZSAP_FI180 (KEY: BUKRS)
- ZFI032_DOC (KEY: BUKRS+BELNR+GJAHR)

## 6. ALV 输出

使用 CL_SALV_TABLE（自带标准工具栏，无需自定义 GUI Status）。
62 列按字段契约顺序排列。

## 7. 数据保存

LOOP 内表 gt_out 写入 ZSAP_FI179：
- MODIFY zsap_fi179 FROM gs_out（按主键 FLNUM+RBUKRS+RLTEXT+RYEAR+POPER+DOCNR+DOCLN）
- FLNUM 固定值 "EEKA"

## 8. 性能设计

- 主查询 INNER JOIN BKPF + LEFT JOIN BSEG，WHERE 匹配索引（RBUKRS+RYEAR 是 FAGLFLEXA 主键前缀）
- LOOKUP 表预加载到内表，SORT 后 BINARY SEARCH（避免嵌套 SQL）
- 使用 FIELD-SYMBOLS 进行 LOOP ASSIGNING（避免 INTO 拷贝）
- ZSAP_FI179 写入使用 MODIFY 批量更新

## 9. 待确认项 (TBD)

1. BKPF-USNAM 5 个角色列显示同一值——已按 FS 实现
2. 执行前是否清空 ZSAP_FI179 已有数据——默认不清空
3. ZSAP_FI180 凭证字配置表需用户预先通过 SM30 维护
