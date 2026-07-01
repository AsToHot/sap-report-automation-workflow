# ZTEST101 — 报税取数稽核报表 技术设计文档

## 程序信息

| 项目 | 值 |
|------|-----|
| 程序名 | ZTEST101 |
| 类型 | REPORT（可执行报表） |
| 包 | $TMP（本地包） |
| 模板参考 | templates/reference/ZSAP_FI244/ |
| INCLUDE 结构 | ZTEST101（主程序）+ ZTEST101T01（数据定义）+ ZTEST101SEL（选择屏幕）+ ZTEST101F01（逻辑） |

## 选择屏幕设计

| 参数 | 类型 | 参考 | 必输 | 默认值 | 角色分类 |
|------|------|------|------|--------|---------|
| S_BUKRS | SELECT-OPTIONS | ZSAP_BUKRS-BUKRS | 是 | - | **映射键**（需经 ZSAP_BUKRS 转换） |
| P_RYEAR | PARAMETERS | FAGLFLEXT-RYEAR | 是 | SY-DATUM(4) | **WHERE 过滤** |
| S_RPMAX | SELECT-OPTIONS | FAGLFLEXT-RPMAX | 是 | - | **计算参数**（决定 HSL 索引范围） |

### 选择屏幕字段角色分析

| 参数 | 角色 | 说明 | 使用方式 |
|------|------|------|---------|
| S_BUKRS | **映射键** | 需经 ZSAP_BUKRS 转换 → RBUKRS/ZZGS | 先查 ZSAP_BUKRS 得到 RBUKRS 列表，再用于 WHERE |
| P_RYEAR | **WHERE 过滤** | 直接过滤 FAGLFLEXT-RYEAR | 放入 FAGLFLEXT SELECT 的 WHERE 子句 |
| S_RPMAX | **计算参数** | 不过滤行，决定 HSL{start}~HSL{end} 索引范围 | 不出现于 WHERE；决定动态字段名 HSLxx |

## 字段契约

### FAGLFLEXT 取数字段

| 逻辑项 | 表名 | 字段名 | DATATYPE | LENG | 元数据文件 |
|--------|------|--------|----------|------|-----------|
| 会计年度 | FAGLFLEXT | RYEAR | NUMC | 4 | FAGLFLEXT.json |
| 公司代码 | FAGLFLEXT | RBUKRS | CHAR | 4 | FAGLFLEXT.json |
| 科目 | FAGLFLEXT | RACCT | CHAR | 10 | FAGLFLEXT.json |
| 期间 | FAGLFLEXT | RPMAX | NUMC | 3 | FAGLFLEXT.json |
| 借贷方向 | FAGLFLEXT | DRCRK | CHAR | 1 | FAGLFLEXT.json |
| 利润中心 | FAGLFLEXT | PRCTR | CHAR | 10 | FAGLFLEXT.json |
| 期间金额01-16 | FAGLFLEXT | HSL01~HSL16 | CURR | 23,2 | FAGLFLEXT.json |
| 总金额 | FAGLFLEXT | HSLVT | CURR | 23,2 | FAGLFLEXT.json |

### ZSAP_FI054 取数字段

| 逻辑项 | 表名 | 字段名 | DATATYPE | LENG | 元数据文件 |
|--------|------|--------|----------|------|-----------|
| 对方科目 | ZSAP_FI054 | HKONT_FY | CHAR | 10 | ZSAP_FI054.json |
| 交易日期 | ZSAP_FI054 | TRADEDATE | CHAR | 64 | ZSAP_FI054.json |
| 金额 | ZSAP_FI054 | AMOUNT | CURR | 15,2 | ZSAP_FI054.json |
| 本方银行账号 | ZSAP_FI054 | OURBANKACCOUNTNUMBER | CHAR | 64 | ZSAP_FI054.json |
| 公司代码 | ZSAP_FI054 | BUKRS | CHAR | 4 | ZSAP_FI054.json |

### SKA1 映射字段

| 逻辑项 | 表名 | 字段名 | DATATYPE | LENG | 元数据文件 |
|--------|------|--------|----------|------|-----------|
| 科目表 | SKA1 | KTOPL | CHAR | 4 | SKA1.json |
| 总账科目 | SKA1 | SAKNR | CHAR | 10 | SKA1.json |
| 公司代码 | SKA1 | ZBUKRS | CHAR | 4 | SKA1.json |
| 银行账户 | SKA1 | ZFKYH | CHAR | 64 | SKA1.json |

### ZSAP_BUKRS 映射字段

| 逻辑项 | 表名 | 字段名 | DATATYPE | LENG | 元数据文件 |
|--------|------|--------|----------|------|-----------|
| 公司代码 | ZSAP_BUKRS | BUKRS | CHAR | 4 | ZSAP_BUKRS.json |
| 机构名称 | ZSAP_BUKRS | LTEXT | CHAR | 40 | ZSAP_BUKRS.json |
| 映射标记 | ZSAP_BUKRS | ZFGS | CHAR | 1 | ZSAP_BUKRS.json |
| 子公司码 | ZSAP_BUKRS | ZZGS | CHAR | 4 | ZSAP_BUKRS.json |
| 利润中心 | ZSAP_BUKRS | PRCTR | CHAR | 10 | ZSAP_BUKRS.json |

## 取数逻辑

### 第一步：公司代码映射

```abap
" 从 S_BUKRS 选择屏幕 → ZSAP_BUKRS 映射
SELECT BUKRS, LTEXT, ZFGS, ZZGS, PRCTR
  FROM ZSAP_BUKRS
  INTO TABLE @lt_bukrs_map
  WHERE BUKRS IN @s_bukrs[].
```

对于每条映射记录：
- `ZFGS = ''` → 实际公司代码 = `BUKRS`
- `ZFGS ≠ ''` → 实际公司代码 = `ZZGS`

得到 `lt_rbukrs`（实际记账公司代码列表）和对应的利润中心列表。

### 第二步：利润中心映射（CEPC）

```abap
" PRCTR → CEPC-KHINR 层次展开
SELECT PRCTR, KHINR
  FROM CEPC
  INTO TABLE @lt_cepc
  FOR ALL ENTRIES IN @lt_bukrs_map
  WHERE KHINR = @lt_bukrs_map-prctr
    AND DATBI = '99991231'
    AND KOKRS = 'EEKA'.
```

得到可用的利润中心列表 `lt_prctr`。

### 第三步：应交金额（FAGLFLEXT）

```abap
SELECT RYEAR, RBUKRS, RACCT, RPMAX, DRCRK,
       HSL01, HSL02, ..., HSL16, HSLVT
  FROM FAGLFLEXT
  INTO TABLE @lt_fagl
  WHERE RYEAR = @p_ryear
    AND RBUKRS IN @lt_rbukrs
    AND PRCTR IN @lt_prctr
    AND RACCT IN @lt_tax_accounts.   " 6 个税种科目
```

在 ABAP 中按公司代码+科目汇总，根据 `S_RPMAX` 决定汇总哪些 HSLxx 列。

### 第四步：银行账户映射（SKA1）

```abap
" 公司代码 → 银行账户
SELECT ZBUKRS, ZFKYH
  FROM SKA1
  INTO TABLE @lt_bank_map
  WHERE ZBUKRS IN @s_bukrs[]
    AND KTOPL = 'EEKA'
    AND ZFKYH NE ''.
```

### 第五步：申报金额（ZSAP_FI054）

```abap
" 日期范围构造：P_RYEAR + S_RPMAX[min]~(max) → YYYYMMDD~YYYYMMDD
" 例：2026 + 03~06 → 20260301 ~ 20260630

SELECT HKONT_FY, OURBANKACCOUNTNUMBER, BUKRS, AMOUNT
  FROM ZSAP_FI054
  INTO TABLE @lt_fi054
  FOR ALL ENTRIES IN @lt_bank_map
  WHERE OURBANKACCOUNTNUMBER = @lt_bank_map-zfkyh
    AND HKONT_FY IN @lt_tax_accounts
    AND TRADEDATE >= @lv_date_from
    AND TRADEDATE <= @lv_date_to.
```

按 `OURBANKACCOUNTNUMBER + HKONT_FY` 汇总 AMOUNT。再通过 SKA1 反查：`ZFKYH → ZBUKRS`，将申报金额关联回屏幕公司代码。

### 第六步：按公司代码×税种汇总和校验

```abap
" 对每个 ZSAP_BUKRS-BUKRS × 税种：
" 校验 = 应交 - 申报
```

## ALV 输出结构

### 内表 GS_OUTPUT

| 组件 | 类型 | 长度 | 小数 | 描述 |
|------|------|------|------|------|
| BUKRS | CHAR | 4 | - | 组织代码 |
| LTEXT | CHAR | 40 | - | 机构名称 |
| ZYJZZ | CURR | 23 | 2 | 应交增值税 |
| ZZZSB | CURR | 23 | 2 | 增值税申报金额 |
| ZZZJY | CURR | 23 | 2 | 增值税校验结果 |
| ZYJCJ | CURR | 23 | 2 | 应交城建税 |
| ZCJSB | CURR | 23 | 2 | 城建税申报金额 |
| ZCJJY | CURR | 23 | 2 | 城建税校验结果 |
| ZYJJY | CURR | 23 | 2 | 应交教育费附加 |
| ZJYSB | CURR | 23 | 2 | 教育费附加申报金额 |
| ZJYJY | CURR | 23 | 2 | 教育费附加校验结果 |
| ZYJDF | CURR | 23 | 2 | 应交地方教育费附加 |
| ZDFSB | CURR | 23 | 2 | 地方教育费申报金额 |
| ZDFJY | CURR | 23 | 2 | 地方教育费校验结果 |
| ZYJYH | CURR | 23 | 2 | 应交印花税 |
| ZYHSB | CURR | 23 | 2 | 印花税申报金额 |
| ZYHJY | CURR | 23 | 2 | 印花税校验结果 |
| ZYJQY | CURR | 23 | 2 | 应交企业所得税 |
| ZQYSB | CURR | 23 | 2 | 企业所得税申报金额 |
| ZQYJY | CURR | 23 | 2 | 企业所得税校验结果 |

## 税种常量定义

```abap
CONSTANTS:
  gc_vat   TYPE RACCT VALUE '2221100000',  " 增值税
  gc_city  TYPE RACCT VALUE '2221020000',  " 城建税
  gc_edu   TYPE RACCT VALUE '2221030000',  " 教育费附加
  gc_local TYPE RACCT VALUE '2221040000',  " 地方教育费附加
  gc_stamp TYPE RACCT VALUE '2221070000',  " 印花税
  gc_income TYPE RACCT VALUE '2221060000'. " 企业所得税
```

## 性能设计

| 项目 | 评估 |
|------|------|
| FAGLFLEXT 预估行数 | ~2 行（按 RYEAR=2026 + 税种科目，系统 300） |
| ZSAP_BUKRS | 11 行（全量） |
| ZSAP_FI054 | 10 行（HKONT_FY 非空） |
| CEPC | 极少（DATBI=99991231 过滤） |
| SKA1 | 少量（ZBUKRS IN 选择公司代码） |
| 策略 | **全量 ALV** — 数据量极小，无需分页 |
| 内表类型 | STANDARD TABLE（数据量极小无需 SORTED/HASHED） |
| JOIN 策略 | 应用层 LOOP（数据量小，避免复杂嵌套 SQL） |

## 金额符号约定

- **FAGLFLEXT**：DRCRK='S'=借方（正数），DRCRK='H'=贷方。实际数据中 DRCRK='S' 且 HSL03 为正 → 应交税金在借方
- **ZSAP_FI054-AMOUNT**：申报金额为绝对值（正数），数据验证已确认
- **校验公式**：应交（FAGLFLEXT HSL 汇总）− 申报（ZSAP_FI054 AMOUNT 汇总），结果无符号翻转
