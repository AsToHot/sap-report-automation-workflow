# 技术设计 — ZTEST002 科目余额表

> 基于 `spec/functional-spec-ai.md` + `metadata/tables/*.json`

## 表清单与用途

| 表名 | 用途 | 元数据 JSON |
|------|------|------------|
| FAGLFLEXT | 科目余额主数据（HSL/TSL 16 期间 + 结转） | FAGLFLEXT.json |
| ZSAP_BUKRS | 公司代码映射（BUKRS→RBUKRS/ZZGS/PRCTR） | ZSAP_BUKRS.json |
| SKAT | 科目描述文本（SPRAS='1'） | SKAT.json |
| SKA1 | 科目主数据（1002* 辅助维度 ZFKYH/ZYHZH） | SKA1.json |
| CEPC | 利润中心主数据（PRCTR 过滤） | CEPC.json |
| TFKBT | 功能范围描述（6601* 辅助维度 FKBTX） | TFKBT.json |

## 主外键与关联路径

### 关联 1：公司代码映射
```
ZSAP_BUKRS.BUKRS → (条件分支)
  ├── ZSAP_BUKRS.ZFGS = '' → ZSAP_BUKRS.BUKRS = FAGLFLEXT.RBUKRS
  └── ZSAP_BUKRS.ZFGS <> '' → ZSAP_BUKRS.ZZGS = FAGLFLEXT.RBUKRS
                                  AND ZSAP_BUKRS.PRCTR = CEPC.KHINR
                                  AND CEPC.DATBI = '99991231'
                                  AND CEPC.KOKRS = 'EEKA'
                                  AND CEPC.PRCTR = FAGLFLEXT.PRCTR
```

### 关联 2：科目描述
```
FAGLFLEXT.RACCT = SKAT.SAKNR
SKAT.SPRAS = '1' (LANG 类型, 长度 1, 中文)
SKAT.KTOPL = 'EEKA'
```

### 关联 3：1002* 辅助维度
```
FAGLFLEXT.RACCT = SKA1.SAKNR
SKA1.KTOPL = 'EEKA'
→ SKA1.ZFKYH (编码), SKA1.ZYHZH (名称)
```

### 关联 4：6601* 辅助维度
```
FAGLFLEXT.RFAREA = TFKBT.FKBER
TFKBT.SPRAS = '1' (LANG, 长度 1)
→ TFKBT.FKBTX (描述)
```

## 字段契约（实现唯一依据）

| 逻辑项（FS/输出） | 表名 | 字段名 | 元数据文件 |
|------------------|------|--------|------------|
| 客户端 | FAGLFLEXT | RCLNT | FAGLFLEXT.json |
| 会计年度 | FAGLFLEXT | RYEAR | FAGLFLEXT.json |
| 借贷标识 | FAGLFLEXT | DRCRK | FAGLFLEXT.json |
| 期间 | FAGLFLEXT | RPMAX | FAGLFLEXT.json |
| 科目编码 | FAGLFLEXT | RACCT | FAGLFLEXT.json |
| 公司代码 | FAGLFLEXT | RBUKRS | FAGLFLEXT.json |
| 利润中心 | FAGLFLEXT | PRCTR | FAGLFLEXT.json |
| 功能范围 | FAGLFLEXT | RFAREA | FAGLFLEXT.json |
| 币别 | FAGLFLEXT | RTCUR | FAGLFLEXT.json |
| 分类账 | FAGLFLEXT | RLDNR | FAGLFLEXT.json |
| 记录类型 | FAGLFLEXT | RRCTY | FAGLFLEXT.json |
| 版本 | FAGLFLEXT | RVERS | FAGLFLEXT.json |
| 结转金额（本币） | FAGLFLEXT | HSLVT | FAGLFLEXT.json |
| 期间 01-16（本币） | FAGLFLEXT | HSL01-HSL16 | FAGLFLEXT.json |
| 结转金额（外币） | FAGLFLEXT | TSLVT | FAGLFLEXT.json |
| 期间 01-16（外币） | FAGLFLEXT | TSL01-TSL16 | FAGLFLEXT.json |
| 公司代码（映射表） | ZSAP_BUKRS | BUKRS | ZSAP_BUKRS.json |
| 非公司代码标识 | ZSAP_BUKRS | ZFGS | ZSAP_BUKRS.json |
| 子公司代码 | ZSAP_BUKRS | ZZGS | ZSAP_BUKRS.json |
| 映射表利润中心 | ZSAP_BUKRS | PRCTR | ZSAP_BUKRS.json |
| 科目描述 | SKAT | TXT50 | SKAT.json |
| 科目语言 | SKAT | SPRAS | SKAT.json |
| 科目表 | SKAT | KTOPL | SKAT.json |
| 科目代码（SKA1） | SKA1 | SAKNR | SKA1.json |
| 银行户编码 | SKA1 | ZFKYH | SKA1.json |
| 银行户名称 | SKA1 | ZYHZH | SKA1.json |
| 利润中心组 | CEPC | KHINR | CEPC.json |
| 利润中心（CEPC） | CEPC | PRCTR | CEPC.json |
| 有效期至 | CEPC | DATBI | CEPC.json |
| 控制范围 | CEPC | KOKRS | CEPC.json |
| 功能范围代码 | TFKBT | FKBER | TFKBT.json |
| 功能范围描述 | TFKBT | FKBTX | TFKBT.json |
| 语言（TFKBT） | TFKBT | SPRAS | TFKBT.json |

## 取数逻辑

### 主查询

```sql
-- 第 1 步：公司代码映射
SELECT FROM zsap_bukrs WHERE bukrs = @p_bukrs
-- 得到 ZFGS, ZZGS, PRCTR
-- 若 ZFGS = '' → rbukrs = @p_bukrs
-- 若 ZFGS <> '' → rbukrs = ZZGS，且需通过 CEPC 过滤 PRCTR

-- 第 2 步：主数据查询
SELECT ryear, racct, drcrk, rpmax, rbukrs, prctr, rfarea, rtcur,
       hslvt, hsl01..hsl16, tslvt, tsl01..tsl16
  FROM faglflext
 WHERE rclnt = @sy-mandt
   AND rldnr = '0L'
   AND rrcty = '0'
   AND rvers = '001'
   AND ryear  = @p_gjahr
   AND rbukrs = @lv_rbukrs
   AND racct  IN @s_racct
   AND rpmax  IN @s_rpmax
```

### 金额计算（ABAP 内表聚合）

设屏选期间 = S_RPMAX (LOW..HIGH)，起始期 = lv_from，截止期 = lv_to

**期初余额** = SUM(HSLVT) + 若 lv_from > 1 则 SUM(HSL01..HSL_{lv_from-1})
→ 结果 >= 0 → 期初借方 | < 0 → 期初贷方（取绝对值）

**本期发生借方** = DRCRK='S' 的行: SUM(HSL{lv_from}..HSL{lv_to})
**本期发生贷方** = DRCRK='H' 的行: ABS(SUM(HSL{lv_from}..HSL{lv_to}))

**本年累计借方** = DRCRK='S': SUM(HSL01..HSL{lv_to})
**本年累计贷方** = DRCRK='H': ABS(SUM(HSL01..HSL{lv_to}))

**期末余额** = 期初净值 + 本期借方 + 本期贷方（贷方为负值）
→ >= 0 → 期末借方 | < 0 → 期末贷方（取绝对值）

### 外币处理

当 P_FCUR = 'X' 时，上述 HSL→TSL，增加 RTCUR 列输出。

## 选择屏 ↔ 数据库映射

| 选择屏参数 | 类型 | 对应 DB 字段 | 说明 |
|-----------|------|-------------|------|
| P_BUKRS | PARAMETERS (单选) | ZSAP_BUKRS-BUKRS | 必填，搜索帮助 |
| P_GJAHR | PARAMETERS (单选) | FAGLFLEXT-RYEAR | 必填 |
| S_RPMAX | SELECT-OPTIONS (区间) | FAGLFLEXT-RPMAX | 必填 |
| S_RACCT | SELECT-OPTIONS (区间) | FAGLFLEXT-RACCT | 可选（全选） |
| P_FCUR | PARAMETERS (Checkbox) | — | 是否显示外币 |

## ALV 列设计

### 固定列（始终展示）

| 字段名 | 标题 | 来源 |
|--------|------|------|
| ZYJKM | 一级节点 | LEFT(RACCT, 4) |
| RACCT | 科目编码 | FAGLFLEXT-RACCT |
| TXT50 | 科目描述 | SKAT-TXT50 |
| ZFZHS | 核算维度编码 | SKA1-ZFKYH / RFAREA |
| ZFZTX | 核算维度名称 | SKA1-ZYHZH / TFKBT-FKBTX |
| ZQCJF | 期初余额借方 | 计算 (>=0 展示) |
| ZQCDF | 期初余额贷方 | 计算 (<0 时绝对值) |
| ZBQJF | 本期发生借方 | 计算 (DRCRK='S') |
| ZBQDF | 本期发生贷方 | 计算 (DRCRK='H' 绝对值) |
| ZBNJF | 本年累计借方 | 计算 (DRCRK='S') |
| ZBNDF | 本年累计贷方 | 计算 (DRCRK='H' 绝对值) |
| ZQMJF | 期末余额借方 | 计算 (>=0 展示) |
| ZQMDF | 期末余额贷方 | 计算 (<0 时绝对值) |

### 外币列（P_FCUR='X' 时展示）

| 字段名 | 标题 |
|--------|------|
| RTCUR | 外币币别 |
| ZQCJF1 | 期初余额借方(外币) |
| ZQCDF1 | 期初余额贷方(外币) |
| ZBQJF1 | 本期发生借方(外币) |
| ZBQDF1 | 本期发生贷方(外币) |
| ZBNJF1 | 本年累计借方(外币) |
| ZBNDF1 | 本年累计贷方(外币) |
| ZQMJF1 | 期末余额借方(外币) |
| ZQMDF1 | 期末余额贷方(外币) |

## 性能设计

### 内表类型
- GT_DATA: STANDARD TABLE（按 RACCT 排序后用于 ALV）
- GT_FAGLFLEXT: STANDARD TABLE（原始数据暂存，聚合后释放）
- LT_SKA1, LT_TFKBT, LT_SKAT: SORTED TABLE（按 KEY 字段排序，READ TABLE BINARY SEARCH）

### 聚合策略
- 避免嵌套 LOOP：先用 SORT + COLLECT 或 READ TABLE BINARY SEARCH
- HSL 列求和：用 ADD 语句逐列累加（避免 CASE 链）

### WHERE 条件
- 固定 RRCTY='0'（实际数据）、RVERS='001'（实际版本）、RLDNR='0L'（主导分类账）
- RYEAR 走主键前缀
