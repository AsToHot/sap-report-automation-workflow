# FS → DDIC 字段交叉验证

> 生成时间：2026-07-02
> 对照 FS：`spec/functional-spec-ai.md`
> 对照元数据：`metadata/tables/*.json`

## 验证汇总

| 表 | FS 引用字段数 | 存在 | 类型匹配 | 语义OK | 差异 |
| --- | --- | --- | --- | --- | --- |
| FAGLFLEXT | 5+16 | ✅ | ✅ | ✅ | 0 |
| ZSAP_BUKRS | 5 | ✅ | ✅ | ✅ | 0 |
| CEPC | 4 | ✅ | ✅ | ✅ | 0 |
| ZSAP_FI054 | 4 | ⚠️ | ⚠️ | ⚠️ | 1 |
| SKA1 | 3 | ✅ | ✅ | ⚠️ | 1 |

---

## 逐字段明细

### FAGLFLEXT

| FS 字段名 | DDIC 存在 | DATATYPE | LENG | DECIMALS | 语义审查 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| RYEAR | ✅ | NUMC | 4 | 0 | 会计年度，与 FS 一致 | OK |
| RBUKRS | ✅ | CHAR | 4 | 0 | 公司代码，与 FS 一致 | OK |
| RACCT | ✅ | CHAR | 10 | 0 | 科目号，长度=10 足够容纳10位科目号 | OK |
| RPMAX | ✅ | NUMC | 3 | 0 | 期间，与 FS 一致 | OK |
| PRCTR | ✅ | CHAR | 10 | 0 | 利润中心，与 FS 一致 | OK |
| DRCRK | ✅ | CHAR | 1 | 0 | 借贷方标识，S=借方/H=贷方 | OK |
| HSL01~HSL16 | ✅ | CURR | 23 | 2 | 本币金额期间1-16，与 FS 一致 | OK |

> **符号约定提醒**：HSL01-HSL16 为 CURR 类型，DRCRK='H'(贷方)通常存负数。FS 按绝对值描述"应交金额"，代码中若需汇总后取绝对值处理，需在 tech-design.md 中明确标注。

### ZSAP_BUKRS

| FS 字段名 | DDIC 存在 | DATATYPE | LENG | DECIMALS | 语义审查 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| BUKRS | ✅ | CHAR | 4 | 0 | 公司代码 | OK |
| ZFGS | ✅ | CHAR | 1 | 0 | 分公司标识，''=本公司，非空=关联公司 | OK |
| ZZGS | ✅ | CHAR | 4 | 0 | 关联公司代码 | OK |
| PRCTR | ✅ | CHAR | 10 | 0 | 利润中心 | OK |
| LTEXT | ✅ | CHAR | 40 | 0 | 机构名称 | OK |

### CEPC

| FS 字段名 | DDIC 存在 | DATATYPE | LENG | DECIMALS | 语义审查 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| PRCTR | ✅ | CHAR | 10 | 0 | 利润中心（KEY） | OK |
| KHINR | ✅ | CHAR | 12 | 0 | 利润中心组/层次结构 | OK |
| DATBI | ✅ | DATS | 8 | 0 | 有效截止日期，FS 要求='99991231' | OK |
| KOKRS | ✅ | CHAR | 4 | 0 | 控制范围，FS 要求='EEKA'，LENG=4 匹配 | OK |

### ZSAP_FI054

| FS 字段名 | DDIC 存在 | DATATYPE | LENG | DECIMALS | 语义审查 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| **KONT_FY** | ❌ 实际为 **HKONT_FY** | CHAR | 10 | 0 | FS 写 KONT_FY，DDIC 中为 HKONT_FY | **⚠️ 字段名差异** |
| TRADEDATE | ✅ | CHAR | 64 | 0 | **CHAR(64) 非 DATS**，FS 要求日期范围 BETWEEN 需字段值格式为 YYYYMMDD | **⚠️ 类型为 CHAR，非日期型** |
| OURBANKACCOUNTNUMBER | ✅ | CHAR | 64 | 0 | 银行账户号 | OK |
| AMOUNT | ✅ | CURR | 15 | 2 | 金额（CURR 类型，需关联货币码） | OK |

> **差异 1 — KONT_FY vs HKONT_FY**：FS 中写 `ZSAP_FI054-KONT_FY`，DDIC 中实际字段名为 `HKONT_FY`。代码中必须使用 `HKONT_FY`。
>
> **差异 2 — TRADEDATE 为 CHAR(64)**：FS 要求对 TRADEDATE 做日期范围 BETWEEN（如 20260301 ~ 20260630）。CHAR(64) 可参与字符串比较，前提是字段存储格式为 YYYYMMDD。需取真实数据抽样确认 TRADEDATE 的存储格式。

### SKA1

| FS 字段名 | DDIC 存在 | DATATYPE | LENG | DECIMALS | 语义审查 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| ZBUKRS | ✅ | CHAR | 4 | 0 | 公司代码 | OK |
| KTOPL | ✅ | CHAR | 4 | 0 | 科目表，FS 要求='SKA1'，但 KTOPL 通常存储科目表代码（如 'EEKA'），值 'SKA1' 疑为笔误 | **⚠️ 待确认** |
| ZFKYH | ✅ | CHAR | 64 | 0 | 银行账户号 | OK |

> **差异 3 — SKA1-KTOPL='SKA1'**：SKA1 是表名，KTOPL 字段存储的是科目表代码（Chart of Accounts），典型值为 'EEKA'。FS 中写 `SKA1-KTOPL="SKA1"` 极可能是表名与科目表代码混淆。建议确认正确的科目表代码（大概率是 'EEKA'）。

---

## 待用户确认项

1. **ZSAP_FI054 科目字段名**：FS 写 `KONT_FY`，DDIC 实际为 `HKONT_FY`——确认用 `HKONT_FY`？
2. **TRADEDATE 字段格式**：CHAR(64) 是否以 YYYYMMDD 格式存储？抽样验证后再定 BETWEEN 语法
3. **SKA1-KTOPL 值**：FS 写 `'SKA1'`，疑为 `'EEKA'`——请确认正确的科目表代码
4. **增值税申报科目号**：ZSAP_FI054 侧为 `221100000`（9位），FAGLFLEXT 侧为 `2221100000`（10位）——确认 ZSAP_FI054-HKONT_FY 中增值税科目确为 9 位？

---

## 判定

- **阻塞项**：差异 1（字段名 KONT_FY→HKONT_FY）——代码不能使用不存在的字段名
- **风险项**：差异 2（TRADEDATE 非 DATS）、差异 3（KTOPL 值可疑）、待确认项 4（科目号位数不一致）
- **可通过**：FAGLFLEXT / ZSAP_BUKRS / CEPC 全部字段已验证无误

> **建议**：差异 1 按 DDIC 实际使用 `HKONT_FY`（高置信度——DDIC 中无 KONT_FY 字段）；差异 3 改为 `'EEKA'`（与 CEPC-KOKRS 一致）。差异 2 和待确认项 4 在 S5.5 冒烟测试时抽样验证。
