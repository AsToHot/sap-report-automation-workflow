# 技术设计文档 — ZSAP_FI086A 科目余额表

## 字段契约（实现唯一依据）

### 输出字段契约

| 逻辑项（FS/输出） | 输出字段名 | 表名 | 字段名 | 元数据文件 | 计算/转换规则 |
|------------------|-----------|------|--------|------------|---------------|
| 一级节点 | ZYJKM | — | — | — | `LEFT(FAGLFLEXT-RACCT, 4)` |
| 科目编码 | RACCT | FAGLFLEXT | RACCT | metadata/tables/FAGLFLEXT.json | 直接取值 |
| 科目描述 | TXT50 | SKAT | TXT50 | metadata/tables/SKAT.json | `SKAT-SPRAS='ZH'`, `SKAT-KTOPL='EEKA'`, `SKAT-SAKNR=FAGLFLEXT-RACCT` |
| 核算维度编码 | ZFZHS | SKA1 / FAGLFLEXT | ZFKYH / RFAREA | metadata/tables/SKA1.json / metadata/tables/FAGLFLEXT.json | 1002*→SKA1-ZFKYH; 6601*→FAGLFLEXT-RFAREA |
| 核算维度名称 | ZFZTX | SKA1 / TFKBT | ZYHZH / FKBTX | metadata/tables/SKA1.json / metadata/tables/TFKBT.json | 1002*→SKA1-ZYHZH; 6601*→TFKBT-FKBTX |
| 期初余额借方 | ZQCJF | FAGLFLEXT | HSLVT/HSL01~16 | metadata/tables/FAGLFLEXT.json | 见「期初余额逻辑」; ≥0 展示 |
| 期初余额贷方 | ZQCDF | FAGLFLEXT | HSLVT/HSL01~16 | metadata/tables/FAGLFLEXT.json | 见「期初余额逻辑」; <0 展示 |
| 本期发生借方 | ZBQJF | FAGLFLEXT | HSL01~16 | metadata/tables/FAGLFLEXT.json | DRCRK='S', 屏选期间 SUM |
| 本期发生贷方 | ZBQDF | FAGLFLEXT | HSL01~16 | metadata/tables/FAGLFLEXT.json | DRCRK='H', 屏选期间 SUM |
| 本年累计借方 | ZBNJF | FAGLFLEXT | HSL01~16 | metadata/tables/FAGLFLEXT.json | DRCRK='S', 1~截止期间 SUM |
| 本年累计贷方 | ZBNDF | FAGLFLEXT | HSL01~16 | metadata/tables/FAGLFLEXT.json | DRCRK='H', 1~截止期间 SUM |
| 期末余额借方 | ZQMJF | — | — | — | ZQCJF+ZQCDF+ZBQJF+ZBQDF; ≥0 |
| 期末余额贷方 | ZQMDF | — | — | — | ZQCJF+ZQCDF+ZBQJF+ZBQDF; <0 |
| 期初余额借方(外币) | ZQCJF1 | FAGLFLEXT | TSLVT/TSL01~16 | metadata/tables/FAGLFLEXT.json | 同 ZQCJF，HSL→TSL |
| 期初余额贷方(外币) | ZQCDF1 | FAGLFLEXT | TSLVT/TSL01~16 | metadata/tables/FAGLFLEXT.json | 同 ZQCDF，HSL→TSL |
| 本期发生借方(外币) | ZBQJF1 | FAGLFLEXT | TSL01~16 | metadata/tables/FAGLFLEXT.json | 同 ZBQJF，HSL→TSL |
| 本期发生贷方(外币) | ZBQDF1 | FAGLFLEXT | TSL01~16 | metadata/tables/FAGLFLEXT.json | 同 ZBQDF，HSL→TSL |
| 本年累计借方(外币) | ZBNJF1 | FAGLFLEXT | TSL01~16 | metadata/tables/FAGLFLEXT.json | 同 ZBNJF，HSL→TSL |
| 本年累计贷方(外币) | ZBNDF1 | FAGLFLEXT | TSL01~16 | metadata/tables/FAGLFLEXT.json | 同 ZBNDF，HSL→TSL |
| 期末余额借方(外币) | ZQMJF1 | — | — | — | 同 ZQMJF，HSL→TSL |
| 期末余额贷方(外币) | ZQMDF1 | — | — | — | 同 ZQMDF，HSL→TSL |
| 币种 | RTCUR | FAGLFLEXT | RTCUR | metadata/tables/FAGLFLEXT.json | 仅外币模式展示 |

### 选择屏字段契约

| 选择屏字段 | 屏幕元素 | 关联表 | 关联字段 | 元数据文件 | 输入类型 | 必输 |
|-----------|---------|--------|----------|------------|----------|------|
| 公司代码 | S_BUKRS | ZSAP_BUKRS | BUKRS | metadata/tables/ZSAP_BUKRS.json | 单选 | 是 |
| 会计年度 | S_RYEAR | FAGLFLEXT | RYEAR | metadata/tables/FAGLFLEXT.json | 单选 | 是 |
| 期间 | S_RPMAX | FAGLFLEXT | RPMAX | metadata/tables/FAGLFLEXT.json | 多选 | 否 |
| 科目编码 | S_RACCT | FAGLFLEXT | RACCT | metadata/tables/FAGLFLEXT.json | 多选 | 否 |
| 显示外币 | P_WAERS | — | — | — | Checkbox | 否 |

## 表清单与用途

| 表名 | 用途 | 主/从 | 元数据文件 |
|------|------|-------|------------|
| FAGLFLEXT | 总账总计表，主驱动表，提供余额/发生额 | 主 | metadata/tables/FAGLFLEXT.json |
| ZSAP_BUKRS | 公司代码配置，辅助公司代码筛选与利润中心关联 | 从 | metadata/tables/ZSAP_BUKRS.json |
| SKA1 | 总账科目主数据，取辅助维度编码/名称（ZFKYH/ZYHZH） | 从 | metadata/tables/SKA1.json |
| SKAT | 总账科目描述 | 从 | metadata/tables/SKAT.json |
| CEPC | 利润中心主数据，公司代码-ZFGS≠""时关联用 | 从 | metadata/tables/CEPC.json |
| TFKBT | 功能范围文本，6601*科目时取描述 | 从 | metadata/tables/TFKBT.json |

## 主外键与关联路径

### 路径 1：公司代码 → FAGLFLEXT（基础）

```
ZSAP_BUKRS-BUKRS = 屏选公司代码
  → IF ZSAP_BUKRS-ZFGS = ""
       FAGLFLEXT-RBUKRS = ZSAP_BUKRS-BUKRS
     ELSE
       ZSAP_BUKRS-PRCTR = CEPC-KHINR
       AND CEPC-DATBI = '99991231'
       AND CEPC-KOKRS = 'EEKA'
       AND CEPC-PRCTR = FAGLFLEXT-PRCTR
```

### 路径 2：科目 → 描述

```
FAGLFLEXT-RACCT = SKAT-SAKNR
  AND SKAT-KTOPL = 'EEKA'
  AND SKAT-SPRAS = 'ZH'
```

### 路径 3：辅助维度（1002*）

```
FAGLFLEXT-RACCT LIKE '1002*'
  → SKA1-SAKNR = FAGLFLEXT-RACCT
     AND SKA1-KTOPL = 'EEKA'
     → SKA1-ZFKYH (编码), SKA1-ZYHZH (名称)
```

### 路径 4：辅助维度（6601*）

```
FAGLFLEXT-RACCT LIKE '6601*'
  → FAGLFLEXT-RFAREA (编码)
  → TFKBT-FKBER = FAGLFLEXT-RFAREA
     AND TFKBT-SPRAS = 'ZH'
     → TFKBT-FKBTX (名称)
```

## 取数逻辑

### 主查询（Open SQL）

```abap
SELECT ryear, racct, rbukrs, prctr, rfarea, rcur,
       drck, hslvt, hsl01, hsl02, ..., hsl16,
       tslvt, tsl01, tsl02, ..., tsl16
  FROM faglflext
  INTO TABLE @gt_raw
 WHERE ryear  = @p_ryear
   AND rpmax IN @s_rpmax
   AND racct IN @s_racct.
```

> 注：公司代码条件在 LOOP 后通过内表逻辑过滤（因涉及 ZSAP_BUKRS + CEPC 关联，无法用纯 Open SQL 表达）。

### 期初余额逻辑

```abap
IF 屏选起始期间 = '01'.
  lv_qc = hslvt.
ELSE.
  lv_qc = hslvt.
  DO 起始期间 - 1 TIMES.
    lv_idx = sy-index.
    lv_qc = lv_qc + hsl{lv_idx}.
  ENDDO.
ENDIF.
```

### 本期发生逻辑

```abap
LOOP AT 屏选期间范围 INTO lv_per.
  lv_idx = lv_per.
  IF drck = 'S'. "借方
    lv_bq_jf = lv_bq_jf + hsl{lv_idx}.
  ELSEIF drck = 'H'. "贷方
    lv_bq_df = lv_bq_df + hsl{lv_idx}.
  ENDIF.
ENDLOOP.
```

### 本年累计逻辑

```abap
LOOP FROM 1 TO 屏选截止期间 INTO lv_per.
  lv_idx = lv_per.
  IF drck = 'S'.
    lv_bn_jf = lv_bn_jf + hsl{lv_idx}.
  ELSEIF drck = 'H'.
    lv_bn_df = lv_bn_df + hsl{lv_idx}.
  ENDIF.
ENDLOOP.
```

### 期末余额逻辑

```abap
lv_qm = lv_qc_jf + lv_qc_df + lv_bq_jf + lv_bq_df.
IF lv_qm >= 0.
  lv_qm_jf = lv_qm.  "期末借方
ELSE.
  lv_qm_df = lv_qm.  "期末贷方
ENDIF.
```

### 外币处理

勾选 `P_WAERS` 时，上述所有 `HSL` → `TSL`，并增加 `RTCUR` 到输出。

## 选择屏 ↔ 数据库映射

| 屏幕元素 | 类型 | 关联数据库字段 | WHERE 条件 |
|---------|------|---------------|------------|
| S_BUKRS | SELECT-OPTIONS | ZSAP_BUKRS-BUKRS | 单值，用于读取 ZSAP_BUKRS 行 |
| S_RYEAR | SELECT-OPTIONS | FAGLFLEXT-RYEAR | `RYEAR = S_RYEAR-low` |
| S_RPMAX | SELECT-OPTIONS | FAGLFLEXT-RPMAX | `RPMAX IN S_RPMAX` |
| S_RACCT | SELECT-OPTIONS | FAGLFLEXT-RACCT | `RACCT IN S_RACCT`（未输则不过滤） |
| P_WAERS | PARAMETERS | — | 控制 ALV 字段动态展示 |

## ALV 布局

- **排序**：`RACCT` 升序
- **列顺序**：与字段契约表一致
- **外币列**：勾选 `P_WAERS` 时动态添加 8 列外币字段 + RTCUR
- **合计/小计**：按 `ZYJKM`（一级节点）做小计，总计行展示全部合计

## 待确认项（TBD）

| 序号 | 问题 | 影响 | 建议 |
|------|------|------|------|
| 1 | ZSAP_BUKRS 当前客户端无数据 | 公司代码关联逻辑无法测试 | 需业务确认该表是否已配置，或测试时手动造数 |
| 2 | 期初余额贷方/期末余额贷方展示方式 | FS 写"<0 展示"，但未明确是否取绝对值 | 建议取绝对值展示，符号通过借/贷列区分 |
| 3 | FAGLFLEXT 数据为空 | 冒烟测试时可能无返回数据 | 需确认系统中是否有已执行的总账汇总数据 |
| 4 | SKA1-ZFKYH/ZYHZH 为增强字段 | 非标准字段，需确认所有目标系统均已增强 | 若目标系统无此字段，代码需做兼容性处理 |
