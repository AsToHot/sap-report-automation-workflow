# EE086 科目余额表 — 技术设计文档

## 表清单与用途

| 表名 | 别名 | 用途 | 元数据文件 |
|------|------|------|------------|
| FAGLFLEXT | gl | 总账汇总表（主驱动表），含期间金额 | metadata/tables/FAGLFLEXT.json |
| ZSAP_BUKRS | zb | 公司代码映射配置 | metadata/tables/ZSAP_BUKRS.json |
| CEPC | pc | 利润中心主数据（ZFGS≠'' 时关联） | metadata/tables/CEPC.json |
| SKA1 | sk | 科目主数据（1002* 科目取 ZFKYH/ZYHZH） | metadata/tables/SKA1.json |
| SKAT | st | 科目描述文本 | metadata/tables/SKAT.json |
| TFKBT | tf | 功能范围描述（6601* 科目取 FKBTX） | metadata/tables/TFKBT.json |

## 字段契约（实现唯一依据）

### 选择条件

| 逻辑项 | 表名 | 字段名 | 元数据文件 |
|--------|------|--------|------------|
| 公司代码 | ZSAP_BUKRS | BUKRS | metadata/tables/ZSAP_BUKRS.json |
| 会计年度 | FAGLFLEXT | RYEAR | metadata/tables/FAGLFLEXT.json |
| 期间(FROM) | FAGLFLEXT | RPMAX | metadata/tables/FAGLFLEXT.json |
| 期间(TO) | FAGLFLEXT | RPMAX | metadata/tables/FAGLFLEXT.json |
| 科目编码 | FAGLFLEXT | RACCT | metadata/tables/FAGLFLEXT.json |
| 显示外币 | — | — | checkbox，无对应表字段 |

### 输出列

| 逻辑项（FS/输出） | 表名 | 字段名 | 元数据文件 | 计算公式 |
|------------------|------|--------|------------|---------|
| 一级节点 | FAGLFLEXT | RACCT | metadata/tables/FAGLFLEXT.json | LEFT(RACCT, 4) |
| 科目编码 | FAGLFLEXT | RACCT | metadata/tables/FAGLFLEXT.json | 直接取值 |
| 科目描述 | SKAT | TXT50 | metadata/tables/SKAT.json | SPRAS='1', KTOPL='EEKA' |
| 核算维度编码 | SKA1/FAGLFLEXT | ZFKYH/RFAREA | metadata/tables/SKA1.json, FAGLFLEXT.json | 1002*→ZFKYH, 6601*→RFAREA |
| 核算维度名称 | SKA1/TFKBT | ZYHZH/FKBTX | metadata/tables/SKA1.json, TFKBT.json | 1002*→ZYHZH, 6601*→FKBTX |
| 期初余额借方 | FAGLFLEXT | HSLVT/HSL01-16 | metadata/tables/FAGLFLEXT.json | 计算列 |
| 期初余额贷方 | FAGLFLEXT | HSLVT/HSL01-16 | metadata/tables/FAGLFLEXT.json | 计算列 |
| 本期发生借方 | FAGLFLEXT | HSL01-16 | metadata/tables/FAGLFLEXT.json | DRCRK='S' |
| 本期发生贷方 | FAGLFLEXT | HSL01-16 | metadata/tables/FAGLFLEXT.json | DRCRK='H' |
| 本年累计借方 | FAGLFLEXT | HSL01-16 | metadata/tables/FAGLFLEXT.json | DRCRK='S' |
| 本年累计贷方 | FAGLFLEXT | HSL01-16 | metadata/tables/FAGLFLEXT.json | DRCRK='H' |
| 期末余额借方 | FAGLFLEXT | HSLVT/HSL01-16 | metadata/tables/FAGLFLEXT.json | 计算列 |
| 期末余额贷方 | FAGLFLEXT | HSLVT/HSL01-16 | metadata/tables/FAGLFLEXT.json | 计算列 |

> 外币列（ZQCJF1~ZQMDF1）：将上述 HSL 替换为 TSL，计算逻辑相同。

## 主外键与关联路径

```
FAGLFLEXT (gl)
  ├── gl.RBUKRS ← ZSAP_BUKRS.BUKRS (直接映射, ZFGS='')
  │   OR gl.RBUKRS ← ZSAP_BUKRS.ZZGS (间接映射, ZFGS≠'')
  ├── gl.PRCTR ← CEPC.PRCTR (仅 ZFGS≠'' 时)
  │     AND CEPC.DATBI = '99991231'
  │     AND CEPC.KOKRS = 'EEKA'
  │     AND CEPC.KHINR = ZSAP_BUKRS.PRCTR
  ├── gl.RACCT = SKA1.SAKNR (1002* 科目, SKA1.KTOPL='EEKA')
  ├── gl.RACCT = SKAT.SAKNR (科目描述, SKAT.SPRAS='1', SKAT.KTOPL='EEKA')
  └── gl.RFAREA = TFKBT.FKBER (6601* 科目, TFKBT.SPRAS='1')
```

## 取数逻辑

### 第一步：公司代码映射

```abap
SELECT SINGLE * FROM zsap_bukrs INTO @ls_bukrs WHERE bukrs = @p_bukrs.
```

- 若 `ls_bukrs-zfgs` 为空 → 直接以 `p_bukrs` 过滤 `gl~rbukrs`
- 若 `ls_bukrs-zfgs` 非空 → 以 `ls_bukrs-zzgs` 过滤 `gl~rbukrs`，且加利润中心限制

### 第二步：主数据查询

```abap
SELECT racct, rbukrs, prctr, rfarea, ryear, rpmax, drcrk,
       hslvt, hsl01, hsl02, ..., hsl16,
       tslvt, tsl01, tsl02, ..., tsl16, rTCUR
  FROM faglflext
  INTO TABLE @gt_faglflext
  WHERE rbukrs = @lv_bukrs     " 映射后的公司代码
    AND ryear  = @p_ryear
    AND rpmax IN @s_rpmax
    AND racct IN @s_racct.
```

> 数据量 < 5000 行，单次 SELECT 全量取出，后续在 ABAP 内表处理。

### 第三步：金额聚合（ABAP 内表处理）

策略：将 FAGLFLEXT 按 `RACCT + RBUKRS + PRCTR + RFAREA` 分组汇总。

**期初余额**：
- p_from = 001: opening = HSLVT
- p_from > 001: opening = HSLVT + HSL01 + ... + HSL(p_from - 1)
- >= 0 → ZQCJF (期初借方), < 0 → ZQCDF (期初贷方，取绝对值)

**本期发生**：
- period_sum = HSL(p_from) + ... + HSL(p_to)
- DRCRK='S' → ZBQJF (本期借方), DRCRK='H' → ZBQDF (本期贷方)

**本年累计**：
- ytd_sum = HSL01 + ... + HSL(p_to)
- DRCRK='S' → ZBNJF (累计借方), DRCRK='H' → ZBNDF (累计贷方)

**期末余额**：
- closing = opening + period_s - period_h
- >= 0 → ZQMJF (期末借方), < 0 → ZQMDF (期末贷方，取绝对值)

### 第四步：维度与描述补充

LOOP 输出内表，逐行补充：
- SKAT 科目描述
- 1002* 科目的 SKA1-ZFKYH / SKA1-ZYHZH
- 6601* 科目的 TFKBT-FKBTX

### 第五步：ALV 输出

按 RACCT 升序，动态列（外币列按 p_forcur 控制显示/隐藏）。

## 选择屏 ↔ 数据库映射

| 选择屏参数 | 类型 | 对应表.字段 | Where 条件 |
|-----------|------|------------|-----------|
| S_BUKRS | SELECT-OPTIONS | ZSAP_BUKRS-BUKRS | 先取映射 → FAGLFLEXT-RBUKRS |
| P_RYEAR | PARAMETERS | FAGLFLEXT-RYEAR | = P_RYEAR |
| S_RPMAX | SELECT-OPTIONS | FAGLFLEXT-RPMAX | IN S_RPMAX |
| S_RACCT | SELECT-OPTIONS | FAGLFLEXT-RACCT | IN S_RACCT |
| P_FORCUR | PARAMETERS (checkbox) | FAGLFLEXT-RTCUR | 控制 ALV 外币列显示 |

## 性能设计

- **数据量**：< 5000 行 → 单次 SELECT 全量，无分页
- **内表类型**：STANDARD TABLE，单次 LOOP 汇总（无嵌套 LOOP）
- **聚合策略**：FAGLFLEXT 按 科目+公司+利润中心+功能范围 分组，使用 SORTED TABLE 或 COLLECT
- **JOIN 替代**：SKAT/SKA1/TFKBT 通过预加载内表 + READ TABLE 替代 LEFT JOIN，减少 DB 负担

## 待确认项

| 项 | 状态 | 说明 |
|----|------|------|
| CEPC 表实际数据确认 | TBD | 300 系统待验证 |
| SKA1-ZFKYH/ZYHZH Z字段存在 | 已确认 | DD03L 元数据中有 ZFKYH(CHAR 64) + ZYHZH(CHAR 50) |
| TFKBT 表实际数据 | TBD | 300 系统待验证 |
