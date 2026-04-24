# ZSAP_FI250 技术设计（EE041）

## 表清单与用途

- `FAGLFLEXA`：总账行项目主数据（核心驱动表）
- `BKPF`：凭证抬头（日期、凭证类型、币别、摘要、汇率）
- `BSEG`：凭证行项目扩展（部门、客户、供应商、物料、行文本）
- `ZSAP_BUKRS`：公司与分公司扩展映射（后续增强）

## 字段契约（实现唯一依据）

| 逻辑项（FS/输出） | 表名 | 字段名 | 元数据文件 |
|---|---|---|---|
| 机构代码 | FAGLFLEXA | RBUKRS | metadata/tables/FAGLFLEXA.json |
| 会计年度 | FAGLFLEXA/BKPF | RYEAR/GJAHR | metadata/tables/FAGLFLEXA.json |
| 会计期间 | FAGLFLEXA | POPER | metadata/tables/FAGLFLEXA.json |
| 过账日期 | BKPF | BUDAT | metadata/tables/BKPF.json |
| 记账日期 | BKPF | CPUDT | metadata/tables/BKPF.json |
| 修改日期 | BKPF | AEDAT | metadata/tables/BKPF.json |
| 凭证类型 | BKPF | BLART | metadata/tables/BKPF.json |
| 凭证号码 | FAGLFLEXA | DOCNR | metadata/tables/FAGLFLEXA.json |
| 摘要 | BKPF | BKTXT | metadata/tables/BKPF.json |
| 序号 | FAGLFLEXA | DOCLN | metadata/tables/FAGLFLEXA.json |
| 会计科目编码 | FAGLFLEXA | RACCT | metadata/tables/FAGLFLEXA.json |
| 币别 | BKPF | WAERS | metadata/tables/BKPF.json |
| 原币金额 | FAGLFLEXA | TSL | metadata/tables/FAGLFLEXA.json |
| 借方金额/贷方金额 | FAGLFLEXA | HSL/DRCRK | metadata/tables/FAGLFLEXA.json |
| 行项目文本 | BSEG | SGTXT | metadata/tables/BSEG.json |
| 结算号 | BKPF | XBLNR | metadata/tables/BKPF.json |
| 汇率 | BKPF | KURSF | metadata/tables/BKPF.json |

## 关联关系

- `FAGLFLEXA.RBUKRS = BKPF.BUKRS`
- `FAGLFLEXA.DOCNR = BKPF.BELNR`
- `FAGLFLEXA.RYEAR = BKPF.GJAHR`
- `FAGLFLEXA.(RBUKRS,DOCNR,RYEAR,BUZEI) = BSEG.(BUKRS,BELNR,GJAHR,BUZEI)`

## 选择屏映射

- `S_BUKRS -> BKPF-BUKRS / FAGLFLEXA-RBUKRS`
- `S_GJAHR -> BKPF-GJAHR`
- `S_MONAT -> BKPF-MONAT`

## 已实现范围与待补齐

- 已实现：核心查询、ALV 输出、请求号 `EFDK900012` 下对象创建与激活。
- 待补齐：FS 中扩展字段（客户分组、银行账号、资产类别、业务编号等）依赖的外围表查询，待二期补元数据后加入。
