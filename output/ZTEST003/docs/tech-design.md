# ZTEST003 技术设计文档

> 基于 `functional-spec-ai.md` + `metadata/tables/*.json` 生成

## 表清单与用途

| 表名 | 用途 | 角色 | 元数据 |
|------|------|------|--------|
| FAGLFLEXT | 总账科目余额（16 期 HSL/TSL 列） | 主驱动表 | FAGLFLEXT.json |
| ZSAP_BUKRS | 公司代码→子公司/利润中心映射 | 选择屏辅助 + 取数过滤 | ZSAP_BUKRS.json |
| SKA1 | 科目主数据（KTOPL='EEKA'） | 1002* 科目辅助维度 | SKA1.json |
| SKAT | 科目描述文本 | 科目名称 | SKAT.json |
| CEPC | 利润中心主数据 | 利润中心层级过滤 | CEPC.json |
| TFKBT | 功能范围描述 | 6601* 科目辅助维度名称 | TFKBT.json |

## 字段契约（实现唯一依据）

### 选择屏字段

| 逻辑项 | 表名 | 字段名 | 类型 | 长度 | 元数据文件 |
|--------|------|--------|------|------|------------|
| 公司代码 | ZSAP_BUKRS | BUKRS | CHAR | 4 | ZSAP_BUKRS.json |
| 会计年度 | FAGLFLEXT | RYEAR | NUMC | 4 | FAGLFLEXT.json |
| 期间 | FAGLFLEXT | RPMAX | NUMC | 3 | FAGLFLEXT.json |
| 科目编码 | FAGLFLEXT | RACCT | CHAR | 10 | FAGLFLEXT.json |

### 取数 JOIN 字段

| 逻辑项 | 表名 | 字段名 | 类型 | 长度 | 元数据文件 |
|--------|------|--------|------|------|------------|
| 公司代码(事实) | FAGLFLEXT | RBUKRS | CHAR | 4 | FAGLFLEXT.json |
| 子公司标识 | ZSAP_BUKRS | ZFGS | CHAR | 1 | ZSAP_BUKRS.json |
| 子公司代码 | ZSAP_BUKRS | ZZGS | CHAR | 4 | ZSAP_BUKRS.json |
| 利润中心组 | ZSAP_BUKRS | PRCTR | CHAR | 10 | ZSAP_BUKRS.json |
| 利润中心层级 | CEPC | KHINR | CHAR | 12 | CEPC.json |
| 利润中心号 | CEPC | PRCTR | CHAR | 10 | CEPC.json |
| 利润中心截止 | CEPC | DATBI | DATS | 8 | CEPC.json |
| 利润中心控制域 | CEPC | KOKRS | CHAR | 4 | CEPC.json |
| 科目号 | SKA1 | SAKNR | CHAR | 10 | SKA1.json |
| 科目科目录 | SKA1 | KTOPL | CHAR | 4 | SKA1.json |
| 辅助维度编码(Z) | SKA1 | ZFKYH | CHAR | 64 | SKA1.json |
| 辅助维度名称(Z) | SKA1 | ZYHZH | CHAR | 50 | SKA1.json |
| 科目描述 | SKAT | TXT50 | CHAR | 50 | SKAT.json |
| 科目语言 | SKAT | SPRAS | LANG | 1 | SKAT.json |
| 功能范围 | FAGLFLEXT | RFAREA | CHAR | 16 | FAGLFLEXT.json |
| 功能范围编码 | TFKBT | FKBER | CHAR | 16 | TFKBT.json |
| 功能范围语言 | TFKBT | SPRAS | LANG | 1 | TFKBT.json |
| 功能范围描述 | TFKBT | FKBTX | CHAR | 25 | TFKBT.json |

### HSL/TSL 金额字段（FAGLFLEXT）

| 逻辑项 | 表名 | 字段名 | 类型 | 长度 | 小数位 | 元数据文件 |
|--------|------|--------|------|------|--------|------------|
| 本币结转 | FAGLFLEXT | HSLVT | CURR | 23 | 2 | FAGLFLEXT.json |
| 本币 01-16 期 | FAGLFLEXT | HSL01-HSL16 | CURR | 23 | 2 | FAGLFLEXT.json |
| 外币结转 | FAGLFLEXT | TSLVT | CURR | 23 | 2 | FAGLFLEXT.json |
| 外币 01-16 期 | FAGLFLEXT | TSL01-TSL16 | CURR | 23 | 2 | FAGLFLEXT.json |
| 借贷标识 | FAGLFLEXT | DRCRK | CHAR | 1 | — | FAGLFLEXT.json |
| 记录类型 | FAGLFLEXT | RRCTY | CHAR | 1 | — | FAGLFLEXT.json |
| 版本 | FAGLFLEXT | RVERS | CHAR | 3 | — | FAGLFLEXT.json |

### ALV 输出列

| 输出列 | 来源 | 表.字段 | 元数据文件 |
|--------|------|---------|------------|
| ZYJKM（一级节点） | 计算 | LEFT(FAGLFLEXT-RACCT, 4) | FAGLFLEXT.json |
| RACCT（科目编码） | 直接 | FAGLFLEXT-RACCT | FAGLFLEXT.json |
| TXT50（科目描述） | 外键 | SKAT-TXT50 | SKAT.json |
| ZFZHS（核算维度编码） | 分支 | SKA1-ZFKYH / FAGLFLEXT-RFAREA | SKA1.json / FAGLFLEXT.json |
| ZFZTX（核算维度名称） | 分支 | SKA1-ZYHZH / TFKBT-FKBTX | SKA1.json / TFKBT.json |
| ZQCJF（期初余额借方） | 计算 | HSLVT + HSL01..(p_from-1) >= 0 | FAGLFLEXT.json |
| ZQCDF（期初余额贷方） | 计算 | ABS(HSLVT + HSL01..(p_from-1)) < 0 | FAGLFLEXT.json |
| ZBQJF（本期发生借方） | 计算 | SUM(HSLp_from..HSLp_to) WHERE DRCRK='S' | FAGLFLEXT.json |
| ZBQDF（本期发生贷方） | 计算 | ABS(SUM(HSLp_from..HSLp_to)) WHERE DRCRK='H' | FAGLFLEXT.json |
| ZBNJF（本年累计借方） | 计算 | SUM(HSL01..HSLp_to) WHERE DRCRK='S' | FAGLFLEXT.json |
| ZBNDF（本年累计贷方） | 计算 | ABS(SUM(HSL01..HSLp_to)) WHERE DRCRK='H' | FAGLFLEXT.json |
| ZQMJF（期末余额借方） | 计算 | 期末净额 >= 0 | FAGLFLEXT.json |
| ZQMDF（期末余额贷方） | 计算 | ABS(期末净额) < 0 | FAGLFLEXT.json |
| ZQCJF1-8（外币列） | 计算 | 同上逻辑，TSL 字段 | FAGLFLEXT.json |

## 主外键与关联路径

### 公司代码映射（ZSAP_BUKRS）

两种情况：

1. **ZFGS = ''**（直连）：`ZSAP_BUKRS-BUKRS = FAGLFLEXT-RBUKRS`，无利润中心限制。
2. **ZFGS = 'X'**（子公司）：`ZSAP_BUKRS-ZZGS = FAGLFLEXT-RBUKRS`，且 `ZSAP_BUKRS-PRCTR = CEPC-KHINR`，`CEPC-KOKRS = 'EEKA'`，`CEPC-DATBI = '99991231'`，最终 `CEPC-PRCTR = FAGLFLEXT-PRCTR`。

> **DDIC 确认**：ZSAP_BUKRS 中 ZFGS（CHAR 1）和 ZZGS（CHAR 4）均存在。ZFGS 空表示直连，'X' 表示走 ZZGS 子公司映射。

### 科目描述（SKAT）

`SKAT-SAKNR = FAGLFLEXT-RACCT`, `SKAT-KTOPL = 'EEKA'`, `SKAT-SPRAS = '1'`（中文，LANG 1 字节）

### 辅助维度（1002* 科目）

`SKA1-SAKNR = FAGLFLEXT-RACCT`, `SKA1-KTOPL = 'EEKA'`
→ 取 SKA1-ZFKYH（编码）、SKA1-ZYHZH（描述）

### 辅助维度（6601* 科目）

`TFKBT-FKBER = FAGLFLEXT-RFAREA`, `TFKBT-SPRAS = '1'`
→ 取 TFKBT-FKBTX（描述），编码取 FAGLFLEXT-RFAREA

## 取数逻辑

### 主查询

```sql
SELECT ryear, drcrk, rpmax, rbukrs, ractr, rfare, prctr
       hslvt, hsl01, hsl02, ... hsl16
       tslvt, tsl01, tsl02, ... tsl16
  FROM faglflex
  WHERE rrcty = '0'           " 实际过账
    AND rvers = '001'         " 标准版本
    AND ryear = @p_gjahr      " 会计年度
```

不直接在 SQL 中按 RBUKRS/RACCT 过滤（因为公司代码映射逻辑复杂），改为在 ABAP 内表中处理。

### 公司代码过滤（ABAP 内表）

1. 读 ZSAP_BUKRS WHERE BUKRS = P_BUKRS
2. 若 ZFGS = ''：保留 FAGLFLEXT 中 RBUKRS = ZSAP_BUKRS-BUKRS 的行
3. 若 ZFGS = 'X'：
   - 保留 RBUKRS = ZSAP_BUKRS-ZZGS 的行
   - 读 CEPC WHERE KHINR = ZSAP_BUKRS-PRCTR AND DATBI = '99991231' AND KOKRS = 'EEKA' → 取得利润中心列表
   - 保留 FAGLFLEXT-PRCTR IN 利润中心列表的行

### 科目过滤

若 S_RACCT 非空：保留 RACCT IN S_RACCT

### 期间与金额计算

选中的期间范围 p_from、p_to 由 S_RPMAX LOW/HIGH 确定（默认 001–016）。

**在 ABAP 内表中聚合**（按 RACCT + RBUKRS 分组）：
- 期初净值 = SUM(HSLVT + (p_from=01?0:HSL01+...+HSL(p_from-1))) 
  - DRCRK='S' 为正，DRCRK='H' 为负（SAP 中 H 存储为负值）→ 直接 SUM
- 本期 S = SUM(HSLp_from..HSLp_to WHERE DRCRK='S')
- 本期 H = SUM(HSLp_from..HSLp_to WHERE DRCRK='H')
- 本年累计 S = SUM(HSL01..HSLp_to WHERE DRCRK='S')
- 本年累计 H = SUM(HSL01..HSLp_to WHERE DRCRK='H')
- 期末 = 期初净值 + 本期S + 本期H

## 选择屏 ↔ 数据库映射

| 选择屏参数 | 类型 | 映射字段 | 说明 |
|-----------|------|---------|------|
| P_BUKRS | PARAMETERS | ZSAP_BUKRS-BUKRS | 带搜索帮助 |
| P_GJAHR | PARAMETERS | FAGLFLEXT-RYEAR | 年度 |
| S_RPMAX | SELECT-OPTIONS | FAGLFLEXT-RPMAX | 默认 001-016 |
| S_RACCT | SELECT-OPTIONS | FAGLFLEXT-RACCT | 空=全科目 |
| P_FWAERS | PARAMETERS AS CHECKBOX | — | 勾选=展示外币列 |

## 性能设计

### 内表类型

- `gt_data`（FAGLFLEXT 数据）：`STANDARD TABLE`，约 5000 行
- `gt_out`（ALV 输出）：`STANDARD TABLE`，按 RACCT 聚合后约 100-300 行
- `gt_bukrs`（公司代码映射）：`STANDARD TABLE`，约 100 行
- `gt_cepc`（利润中心）：`STANDARD TABLE`，用 SORTED TABLE（PRCTR 为 UNIQUE KEY）

### 嵌套 LOOP 替代

- 主查询→ALV 输出采用单层 LOOP：先按 RACCT+RBUKRS 聚合 → 再与 SKAT/SKA1/TFKBT 用 `READ TABLE` 补维度描述
- 不使用嵌套 LOOP，采用 `SORT + READ TABLE BINARY SEARCH` 模式

### WHERE 条件排列

- FAGLFLEXT WHERE：RYEAR = P_GJAHR（命中主键前缀）+ RRCTY/RVERS 辅助过滤
- 不在 DB 层过滤 RBUKRS（因 ZSAP_BUKRS 映射逻辑），在 ABAP 中处理

### 数据量预估

- 主表预估：4,866 行（RRCTY='0' AND RVERS='001'）
- 量级：< 10,000 → 无需分页，全量 ALV

## 待确认项

| 项目 | 状态 | 说明 |
|------|------|------|
| ZFGS/ZZGS 字段 | 已确认 | DDIC 验证 ZFGS CHAR 1（子公司标识）、ZZGS CHAR 4（子公司代码）均存在 |
| SPRAS = '1' | 已确认 | LANG 类型长度 1，中文为 '1' |
| 外币币种 RTCUR | TBD | 若不指定币种则全币种展示 |
| 6601* 以外科目维度 | Done | 为空 |
