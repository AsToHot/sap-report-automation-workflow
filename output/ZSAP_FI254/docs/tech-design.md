# 技术设计文档 — 科目余额表 ZSAP_FI254

## 1. 表清单与用途

| 表名 | 用途 | 元数据文件 |
|------|------|------------|
| FAGLFLEXT | 总账科目余额汇总表（主驱动表） | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json |
| ZSAP_BUKRS | 公司代码自定义映射表 | output/ZSAP_FI254/metadata/tables/ZSAP_BUKRS.json |
| CEPC | 利润中心主数据（取 KHINR 层级） | output/ZSAP_FI254/metadata/tables/CEPC.json |
| SKA1 | 总账科目主数据（取 ZFKYH, ZYHZH） | output/ZSAP_FI254/metadata/tables/SKA1.json |
| SKAT | 总账科目文本（取 TXT50） | output/ZSAP_FI254/metadata/tables/SKAT.json |
| TFKBT | 功能范围文本（取 FKBTX） | output/ZSAP_FI254/metadata/tables/TFKBT.json |

## 2. 字段契约（实现唯一依据）

| 逻辑项（FS/输出） | 表名 | 字段名 | 元数据文件 |
|------------------|------|--------|------------|
| 一级节点 | - | ZYJKM | 计算列：LEFT(FAGLFLEXT-RACCT,4) |
| 科目编码 | FAGLFLEXT | RACCT | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json |
| 科目描述 | SKAT | TXT50 | output/ZSAP_FI254/metadata/tables/SKAT.json |
| 核算维度编码（1002*） | SKA1 | ZFKYH | output/ZSAP_FI254/metadata/tables/SKA1.json |
| 核算维度编码（6601*） | FAGLFLEXT | RFAREA | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json |
| 核算维度名称（1002*） | SKA1 | ZYHZH | output/ZSAP_FI254/metadata/tables/SKA1.json |
| 核算维度名称（6601*） | TFKBT | FKBTX | output/ZSAP_FI254/metadata/tables/TFKBT.json |
| 期初余额借方 | FAGLFLEXT | HSLVT+HSL01~16 | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json |
| 期初余额贷方 | FAGLFLEXT | HSLVT+HSL01~16 | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json |
| 本期发生借方 | FAGLFLEXT | HSL01~16 | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json |
| 本期发生贷方 | FAGLFLEXT | HSL01~16 | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json |
| 本年累计借方 | FAGLFLEXT | HSL01~16 | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json |
| 本年累计贷方 | FAGLFLEXT | HSL01~16 | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json |
| 期末余额借方 | - | ZQMJF | 计算列 |
| 期末余额贷方 | - | ZQMDF | 计算列 |
| 公司代码（选择屏） | ZSAP_BUKRS | BUKRS | output/ZSAP_FI254/metadata/tables/ZSAP_BUKRS.json |
| 会计年度（选择屏） | FAGLFLEXT | RYEAR | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json |
| 期间（选择屏） | FAGLFLEXT | RPMAX | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json |
| 科目编码（选择屏） | FAGLFLEXT | RACCT | output/ZSAP_FI254/metadata/tables/FAGLFLEXT.json |

## 3. 主外键与关联路径

- **FAGLFLEXT ↔ ZSAP_BUKRS**：
  - 若 ZSAP_BUKRS-ZFGS = ''，则 ZSAP_BUKRS-BUKRS = FAGLFLEXT-RBUKRS
  - 若 ZSAP_BUKRS-ZFGS ≠ ''，则 ZSAP_BUKRS-ZZGS = FAGLFLEXT-RBUKRS，且 ZSAP_BUKRS-PRCTR = CEPC-KHINR，CEPC-DATBI='99991231'，CEPC-KOKRS='EEKA'，CEPC-PRCTR = FAGLFLEXT-PRCTR
- **FAGLFLEXT ↔ SKAT**：SKAT-KTOPL='EEKA'，SKAT-SPRAS=SY-LANGU，SKAT-SAKNR = FAGLFLEXT-RACCT
- **FAGLFLEXT ↔ SKA1**：SKA1-KTOPL='EEKA'，SKA1-SAKNR = FAGLFLEXT-RACCT（仅当 RACCT=1002* 时取 ZFKYH/ZYHZH）
- **FAGLFLEXT ↔ TFKBT**：TFKBT-SPRAS='1'（或 SY-LANGU），TFKBT-FKBER = FAGLFLEXT-RFAREA（仅当 RACCT=6601* 时）
- **ZSAP_BUKRS ↔ CEPC**：CEPC-KHINR = ZSAP_BUKRS-PRCTR，CEPC-DATBI='99991231'，CEPC-KOKRS='EEKA'

## 4. 取数逻辑

### 4.1 主查询（FAGLFLEXT）

```
SELECT FROM FAGLFLEXT
  WHERE RBUKRS  IN 公司代码范围
    AND RYEAR   =  会计年度
    AND RPMAX   IN 期间范围
    AND RACCT   IN 科目编码范围
```

**公司代码范围推导逻辑**（在 ABAP 中先处理）：
1. 读取 ZSAP_BUKRS，根据屏选 BUKRS 取 ZFGS/ZZGS/PRCTR
2. 若 ZFGS = ''，直接限制 FAGLFLEXT-RBUKRS = 屏选 BUKRS
3. 若 ZFGS ≠ ''，限制 FAGLFLEXT-RBUKRS = ZZGS，且通过 CEPC 限制 PRCTR

### 4.2 金额计算逻辑

**期初余额**：
- 若屏选期间起始 = 01：取 HSLVT
- 若屏选期间起始 ≠ 01：取 HSLVT + HSL01 到 (起始期间-1) 的累计
- 结果 ≥ 0 → 期初余额借方；结果 < 0 → 期初余额贷方（取绝对值）

**本期发生借方**：DRCRK='S'，屏选期间 HSL 累计（如 03~06 取 HSL03+HSL04+HSL05+HSL06）
**本期发生贷方**：DRCRK='H'，屏选期间 HSL 累计

**本年累计借方**：DRCRK='S'，从 01 到屏选截止期间 HSL 累计
**本年累计贷方**：DRCRK='H'，从 01 到屏选截止期间 HSL 累计

**期末余额**：期初 + 本期发生；≥0 为借方，<0 为贷方（取绝对值）

### 4.3 外币逻辑

勾选外币时，所有 HSL 字段替换为 TSL，并增加 RTCUR 作为分组/展示维度。

## 5. 选择屏 ↔ 数据库映射

| 选择屏字段 | 数据库字段 | 条件类型 |
|-----------|-----------|---------|
| P_BUKRS | ZSAP_BUKRS-BUKRS | 单值必填 |
| P_GJAHR | FAGLFLEXT-RYEAR | 单值必填 |
| S_RPMAX | FAGLFLEXT-RPMAX | 区间多选 |
| S_RACCT | FAGLFLEXT-RACCT | 区间多选 |
| P_WAERS | - | 复选框（控制 ALV 列展示） |

## 6. ALV 布局

列顺序与 FS 输出字段要求一致：
1. 一级节点
2. 科目编码
3. 科目描述
4. 核算维度编码
5. 核算维度名称
6. 期初余额借方
7. 期初余额贷方
8. 本期发生借方
9. 本期发生贷方
10. 本年累计借方
11. 本年累计贷方
12. 期末余额借方
13. 期末余额贷方

勾选外币时，在每对本币列后插入对应外币列。

## 7. 待确认项（TBD）

- 无
