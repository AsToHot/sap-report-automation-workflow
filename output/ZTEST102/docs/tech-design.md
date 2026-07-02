# 技术设计文档 — ZTEST102 报税取数稽核报表

> 基于：`spec/functional-spec-ai.md` + `metadata/tables/*.json` + `spec/fs-ddic-verification.md`
> 日期：2026-07-02

---

## 1. 选择屏幕字段角色分析（强制四角色分类）

| 屏幕字段 | 角色 | 说明 | 使用方式 |
| --- | --- | --- | --- |
| S_BUKRS | **映射键** | 屏幕选择公司代码 → 通过 ZSAP_BUKRS 映射为 RBUKRS + PRCTR | 先查 ZSAP_BUKRS 得到 RBUKRS（ZFGS=''→BUKRS；≠→ZZGS）和 PRCTR，再用于 WHERE |
| P_RYEAR | **WHERE 过滤** | 会计年度，直接过滤 FAGLFLEXT | 放入 FAGLFLEXT SELECT 的 WHERE RYEAR = P_RYEAR |
| S_RPMAX | **计算参数** | 期间范围，决定 HSL 列索引 | 不出现于 WHERE；用于确定 HSL{start} ~ HSL{end} 求和范围 |

---

## 2. 字段契约

### 输出列 → 源字段映射

| 逻辑项 | 输出列 | 表名 | 字段名 | 元数据文件 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 公司代码 | BUKRS | ZSAP_BUKRS | BUKRS | ZSAP_BUKRS.json | 直接取值 |
| 机构名称 | LTEXT | ZSAP_BUKRS | LTEXT | ZSAP_BUKRS.json | 直接取值 |
| 应交增值税 | ZYJZZ | FAGLFLEXT | HSL01~16 | FAGLFLEXT.json | SUM(HSL{期间}) WHERE RACCT='2221100000' |
| 申报增值税 | ZZZSB | ZSAP_FI054 | AMOUNT | ZSAP_FI054.json | SUM WHERE HKONT_FY='221100000' |
| 校验增值税 | ZZZJY | — | — | — | ZYJZZ - ZZZSB |
| 应交城建税 | ZYJCJ | FAGLFLEXT | HSL01~16 | FAGLFLEXT.json | SUM WHERE RACCT='2221020000' |
| 申报城建税 | ZCJSB | ZSAP_FI054 | AMOUNT | ZSAP_FI054.json | SUM WHERE HKONT_FY='2221020000' |
| 校验城建税 | ZCJJY | — | — | — | ZYJCJ - ZCJSB |
| 应交教育费附加 | ZYJJY | FAGLFLEXT | HSL01~16 | FAGLFLEXT.json | SUM WHERE RACCT='2221030000' |
| 申报教育费附加 | ZJYSB | ZSAP_FI054 | AMOUNT | ZSAP_FI054.json | SUM WHERE HKONT_FY='2221030000' |
| 校验教育费附加 | ZJYJY | — | — | — | ZYJJY - ZJYSB |
| 应交地方教育费附加 | ZYJDF | FAGLFLEXT | HSL01~16 | FAGLFLEXT.json | SUM WHERE RACCT='2221040000' |
| 申报地方教育费附加 | ZDFSB | ZSAP_FI054 | AMOUNT | ZSAP_FI054.json | SUM WHERE HKONT_FY='2221040000' |
| 校验地方教育费附加 | ZDFJY | — | — | — | ZYJDF - ZDFSB |
| 印花税 | ZYJYH | FAGLFLEXT | HSL01~16 | FAGLFLEXT.json | SUM WHERE RACCT='2221070000' |
| 申报印花税 | ZYHSB | ZSAP_FI054 | AMOUNT | ZSAP_FI054.json | SUM WHERE HKONT_FY='2221070000' |
| 校验印花税 | ZYHJY | — | — | — | ZYJYH - ZYHSB |
| 企业所得税 | ZYJQY | FAGLFLEXT | HSL01~16 | FAGLFLEXT.json | SUM WHERE RACCT='2221060000' |
| 申报企业所得税 | ZQYSB | ZSAP_FI054 | AMOUNT | ZSAP_FI054.json | SUM WHERE HKONT_FY='2221060000' |
| 校验企业所得税 | ZQYJY | — | — | — | ZYJQY - ZQYSB |

### 核心字段 DDIC 溯源

| 表 | 字段 | DATATYPE | LENG | DECIMALS | 用途 |
| --- | --- | --- | --- | --- | --- |
| ZSAP_BUKRS | BUKRS | CHAR | 4 | 0 | 输出公司代码 |
| ZSAP_BUKRS | LTEXT | CHAR | 40 | 0 | 输出机构名称 |
| ZSAP_BUKRS | ZFGS | CHAR | 1 | 0 | 分公司标识 |
| ZSAP_BUKRS | ZZGS | CHAR | 4 | 0 | 关联公司代码 |
| ZSAP_BUKRS | PRCTR | CHAR | 10 | 0 | 利润中心→CEPC 关联 |
| CEPC | PRCTR | CHAR | 10 | 0 | 利润中心 |
| CEPC | KHINR | CHAR | 12 | 0 | 利润中心组（关联 ZSAP_BUKRS-PRCTR） |
| CEPC | DATBI | DATS | 8 | 0 | 有效截止日期（='99991231'） |
| CEPC | KOKRS | CHAR | 4 | 0 | 控制范围（='EEKA'） |
| FAGLFLEXT | RYEAR | NUMC | 4 | 0 | 会计年度 |
| FAGLFLEXT | RBUKRS | CHAR | 4 | 0 | 公司代码 |
| FAGLFLEXT | RACCT | CHAR | 10 | 0 | 科目号 |
| FAGLFLEXT | PRCTR | CHAR | 10 | 0 | 利润中心 |
| FAGLFLEXT | DRCRK | CHAR | 1 | 0 | 借贷方 |
| FAGLFLEXT | HSL01~16 | CURR | 23 | 2 | 本币金额 1-16 期 |
| SKA1 | ZBUKRS | CHAR | 4 | 0 | 公司代码 |
| SKA1 | KTOPL | CHAR | 4 | 0 | 科目表 |
| SKA1 | ZFKYH | CHAR | 64 | 0 | 银行账户号 |
| ZSAP_FI054 | HKONT_FY | CHAR | 10 | 0 | 科目号（⚠️ FS 写 KONT_FY，实际为 HKONT_FY） |
| ZSAP_FI054 | TRADEDATE | CHAR | 64 | 0 | 交易日期（⚠️ CHAR 非 DATS） |
| ZSAP_FI054 | OURBANKACCOUNTNUMBER | CHAR | 64 | 0 | 银行账户号 |
| ZSAP_FI054 | AMOUNT | CURR | 15 | 2 | 交易金额 |

---

## 3. 表清单与关联路径

| 表 | 角色 | 关联 |
| --- | --- | --- |
| ZSAP_BUKRS | 主驱动 — 公司代码映射 | BUKRS ← S_BUKRS（屏幕选择） |
| CEPC | 利润中心过滤 | ZSAP_BUKRS-PRCTR = CEPC-KHINR → CEPC-PRCTR = FAGLFLEXT-PRCTR |
| FAGLFLEXT | 应交金额来源 | RBUKRS = mapped_bukrs, RYEAR = P_RYEAR, PRCTR = CEPC-PRCTR |
| SKA1 | 银行账户映射 | ZBUKRS ← S_BUKRS（屏幕选择）→ ZFKYH |
| ZSAP_FI054 | 申报金额来源 | OURBANKACCOUNTNUMBER = SKA1-ZFKYH, HKONT_FY = 对应科目 |

---

## 4. 取数逻辑

### 4.1 步骤 1：公司代码映射

```
SELECT BUKRS, ZFGS, ZZGS, PRCTR, LTEXT
  FROM ZSAP_BUKRS
  WHERE BUKRS IN @S_BUKRS
  INTO TABLE @DATA(lt_bukrs_map).

" 构建映射内表
LOOP AT lt_bukrs_map ASSIGNING <fs_map>.
  IF <fs_map>-zfgs = ''.
    <fs_map>-rbukrs = <fs_map>-bukrs.    " 直接用 BUKRS
  ELSE.
    <fs_map>-rbukrs = <fs_map>-zzgs.     " 用关联公司 ZZGS
  ENDIF.
ENDLOOP.
```

### 4.2 步骤 2：利润中心过滤

```
SELECT PRCTR FROM CEPC
  INTO TABLE @DATA(lt_cepc)
  WHERE KHINR IN (list of ZSAP_BUKRS-PRCTR)
    AND DATBI = '99991231'
    AND KOKRS = 'EEKA'.
```

### 4.3 步骤 3：FAGLFLEXT 应交金额

```
" 期间范围 → HSL 列索引
" S_RPMAX LOW=3, HIGH=6 → 汇总 HSL03+HSL04+HSL05+HSL06

SELECT RBUKRS, RACCT, HSL01, HSL02, HSL03, HSL04, HSL05, HSL06,
       HSL07, HSL08, HSL09, HSL10, HSL11, HSL12, HSL13, HSL14, HSL15, HSL16
  FROM FAGLFLEXT
  INTO TABLE @DATA(lt_gl)
  WHERE RYEAR = @P_RYEAR
    AND RBUKRS IN @lt_rbukrs_list
    AND RACCT IN ('2221100000','2221020000','2221030000','2221040000','2221070000','2221060000')
    AND PRCTR IN @lt_cepc_prctr_list.

" ABAP 中按 RBUKRS + RACCT 汇总
LOOP AT lt_gl ASSIGNING <fs_gl>.
  lv_hsl_sum = <fs_gl>-hsl03 + <fs_gl>-hsl04 + ...  " 按 S_RPMAX 动态加总
  " 累加到 gt_ys 内表
ENDLOOP.
```

### 4.4 步骤 4：ZSAP_FI054 申报金额

```
" 4a. 获取银行账户
SELECT ZBUKRS, ZFKYH FROM SKA1
  INTO TABLE @DATA(lt_ska1)
  WHERE ZBUKRS IN @S_BUKRS
    AND KTOPL = 'EEKA'.

" 4b. 日期转换（P_RYEAR + S_RPMAX → YYYYMMDD）
" S_RPMAX LOW=03, HIGH=06, P_RYEAR=2026 → 20260301 ~ 20260630

" 4c. 取申报数据
SELECT OURBANKACCOUNTNUMBER, HKONT_FY, SUM( AMOUNT ) AS AMOUNT
  FROM ZSAP_FI054
  INTO TABLE @DATA(lt_fi054)
  WHERE HKONT_FY IN ('221100000','2221020000','2221030000','2221040000','2221070000','2221060000')
    AND TRADEDATE BETWEEN @lv_date_from AND @lv_date_to
    AND OURBANKACCOUNTNUMBER IN @lt_zfkyh_list
  GROUP BY OURBANKACCOUNTNUMBER, HKONT_FY.

" 4d. 按银行账户归属→BUKRS 汇总
LOOP AT lt_fi054 ASSIGNING <fs_fi>.
  " 查找 SKA1 中 OURBANKACCOUNTNUMBER → ZBUKRS
  " 累加到对应 BUKRS + HKONT_FY
ENDLOOP.
```

### 4.5 步骤 5：合并输出

```
" 为每个 BUKRS 生成一行：
"   BUKRS, LTEXT (from ZSAP_BUKRS)
"   6个税种的应交/申报/校验 = 步骤3的应交 - 步骤4的申报
```

---

## 5. ALV 布局设计

### 输出内表结构 (ty_out)

```
BUKRS  CHAR   4   公司代码
LTEXT  CHAR  40   机构名称
ZYJZZ  CURR  23   应交增值税
ZZZSB  CURR  23   申报增值税
ZZZJY  CURR  23   校验增值税
ZYJCJ  CURR  23   应交城建税
ZCJSB  CURR  23   申报城建税
ZCJJY  CURR  23   校验城建税
ZYJJY  CURR  23   应交教育费附加
ZJYSB  CURR  23   申报教育费附加
ZJYJY  CURR  23   校验教育费附加
ZYJDF  CURR  23   应交地方教育费附加
ZDFSB  CURR  23   申报地方教育费附加
ZDFJY  CURR  23   校验地方教育费附加
ZYJYH  CURR  23   印花税
ZYHSB  CURR  23   申报印花税
ZYHJY  CURR  23   校验印花税
ZYJQY  CURR  23   企业所得税
ZQYSB  CURR  23   申报企业所得税
ZQYJY  CURR  23   校验企业所得税
```

### ALV 列标题

| 列 | 短文本 | 中文本 | 长文本 |
| --- | --- | --- | --- |
| BUKRS | 公司代码 | 公司代码 | 公司代码 |
| LTEXT | 机构名称 | 机构名称 | 机构名称 |
| ZYJZZ | 应交增值税 | 应交增值税 | 应交增值税 |
| ZZZSB | 申报增值税 | 申报增值税 | 申报增值税 |
| ZZZJY | 增值税校验 | 增值税校验 | 增值税校验 |
| ... | ... | ... | ... |

### 金额列格式

- 所有金额列：`CURRENCY 'CNY'`，2 位小数，千分位分隔
- 校验列支持负值显示（红色标记）

---

## 6. INCLUDE 分层结构

| Include | 内容 |
| --- | --- |
| ZTEST102T01 | TYPES、DATA、CONSTANTS、税种科目常量 |
| ZTEST102SEL | PARAMETERS P_RYEAR、SELECT-OPTIONS S_BUKRS/S_RPMAX |
| ZTEST102F01 | FORM get_bukrs_map / get_gl_data / get_fi054_data / fill_output / display_alv / authority_check |

### 主程序骨架

```abap
REPORT ztest102.
INCLUDE ztest102t01.
INCLUDE ztest102sel.
INCLUDE ztest102f01.

INITIALIZATION.
  P_RYEAR = sy-datum(4).

AT SELECTION-SCREEN OUTPUT.
  " 选择屏幕文本设置

AT SELECTION-SCREEN.
  " 输入校验

START-OF-SELECTION.
  PERFORM authority_check.
  PERFORM get_bukrs_map.
  PERFORM get_gl_data.
  PERFORM get_fi054_data.
  PERFORM fill_output.
  PERFORM display_alv.
```

---

## 7. 税种科目常量定义

```abap
CONSTANTS: BEGIN OF gc_tax,
  zzs  TYPE racct VALUE '2221100000',  " 增值税 (FAGLFLEXT)
  cjs  TYPE racct VALUE '2221020000',  " 城建税
  jyf  TYPE racct VALUE '2221030000',  " 教育费附加
  dfjy TYPE racct VALUE '2221040000',  " 地方教育费附加
  yhs  TYPE racct VALUE '2221070000',  " 印花税
  qys  TYPE racct VALUE '2221060000',  " 企业所得税
END OF gc_tax.

CONSTANTS: BEGIN OF gc_fi054_kt,
  zzs  TYPE char10 VALUE '221100000',   " 增值税 (ZSAP_FI054-HKONT_FY，9位)
  cjs  TYPE char10 VALUE '2221020000',  " 城建税
  jyf  TYPE char10 VALUE '2221030000',  " 教育费附加
  dfjy TYPE char10 VALUE '2221040000',  " 地方教育费附加
  yhs  TYPE char10 VALUE '2221070000',  " 印花税
  qys  TYPE char10 VALUE '2221060000',  " 企业所得税
END OF gc_fi054_kt.
```

---

## 8. 符号约定

- **FAGLFLEXT-HSLxx**：CURR 类型，含借贷方符号（DRCRK='S'借方正数，DRCRK='H'贷方负数）
- **ZSAP_FI054-AMOUNT**：CURR 类型，申报金额（通常为正）
- **校验列 = 应交 - 申报**：正数=多交，负数=少交
- 技术设计不做绝对值处理，原始符号保留
- S5.5 时抽样验证实际符号约定

---

## 9. 性能设计

| 项目 | 设计 |
| --- | --- |
| 数据量 | FAGLFLEXT: ~7k / ZSAP_FI054: ~10k → 全量 ALV |
| WHERE 策略 | FAGLFLEXT 严格限制 RYEAR + RBUKRS + RACCT + PRCTR |
| ZSAP_FI054 策略 | HKONT_FY + TRADEDATE BETWEEN + OURBANKACCOUNTNUMBER IN |
| 内表类型 | 输出表 STANDARD，辅助表 SORTED (BY BUKRS + RACCT) |
| 聚合方式 | ZSAP_FI054 用 SQL GROUP BY 聚合；FAGLFLEXT 在 ABAP 内聚合 |
| 嵌套 LOOP | 申报数据汇总时：SKA1 用 HASHED TABLE (KEY=ZFKYH)，避免嵌套 LOOP |
