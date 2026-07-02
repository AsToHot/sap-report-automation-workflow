# FS 覆盖率审查

> 对照：`spec/functional-spec-ai.md` → `docs/tech-design.md`

## 选择条件覆盖

| FS 逻辑项 | 屏幕字段 | 契约字段 | 元数据文件 | 代码落点 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 公司代码多选 | S_BUKRS | ZSAP_BUKRS-BUKRS | ZSAP_BUKRS.json | ZTEST102SEL + F01 get_bukrs_map | OK |
| 会计年度单选 | P_RYEAR | FAGLFLEXT-RYEAR | FAGLFLEXT.json | ZTEST102SEL + F01 get_gl_data | OK |
| 核对期间多选 | S_RPMAX | FAGLFLEXT-RPMAX | FAGLFLEXT.json | ZTEST102SEL + F01 (期间→HSL索引) | OK |

## 输出列覆盖 — 组织

| FS 逻辑项 | 输出列 | 契约字段 | 元数据文件 | 代码落点 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 公司代码 | BUKRS | ZSAP_BUKRS-BUKRS | ZSAP_BUKRS.json | ty_out-bukrs | OK |
| 机构名称 | LTEXT | ZSAP_BUKRS-LTEXT | ZSAP_BUKRS.json | ty_out-ltext | OK |

## 输出列覆盖 — 增值税 (2221100000 / 221100000)

| FS 逻辑项 | 输出列 | 契约字段 | 状态 |
| --- | --- | --- | --- |
| 应交增值税 | ZYJZZ | FAGLFLEXT-HSLxx | OK |
| 申报增值税 | ZZZSB | ZSAP_FI054-AMOUNT | OK |
| 校验增值税 | ZZZJY | 计算列 ZYJZZ-ZZZSB | OK |

## 输出列覆盖 — 城建税 (2221020000)

| FS 逻辑项 | 输出列 | 契约字段 | 状态 |
| --- | --- | --- | --- |
| 应交城建税 | ZYJCJ | FAGLFLEXT-HSLxx | OK |
| 申报城建税 | ZCJSB | ZSAP_FI054-AMOUNT | OK |
| 校验城建税 | ZCJJY | 计算列 ZYJCJ-ZCJSB | OK |

## 输出列覆盖 — 教育费附加 (2221030000)

| FS 逻辑项 | 输出列 | 契约字段 | 状态 |
| --- | --- | --- | --- |
| 应交教育费附加 | ZYJJY | FAGLFLEXT-HSLxx | OK |
| 申报教育费附加 | ZJYSB | ZSAP_FI054-AMOUNT | OK |
| 校验教育费附加 | ZJYJY | 计算列 ZYJJY-ZJYSB | OK |

## 输出列覆盖 — 地方教育费附加 (2221040000)

| FS 逻辑项 | 输出列 | 契约字段 | 状态 |
| --- | --- | --- | --- |
| 应交地方教育费附加 | ZYJDF | FAGLFLEXT-HSLxx | OK |
| 申报地方教育费附加 | ZDFSB | ZSAP_FI054-AMOUNT | OK |
| 校验地方教育费附加 | ZDFJY | 计算列 ZYJDF-ZDFSB | OK |

## 输出列覆盖 — 印花税 (2221070000)

| FS 逻辑项 | 输出列 | 契约字段 | 状态 |
| --- | --- | --- | --- |
| 印花税 | ZYJYH | FAGLFLEXT-HSLxx | OK |
| 申报印花税 | ZYHSB | ZSAP_FI054-AMOUNT | OK |
| 校验印花税 | ZYHJY | 计算列 ZYJYH-ZYHSB | OK |

## 输出列覆盖 — 企业所得税 (2221060000)

| FS 逻辑项 | 输出列 | 契约字段 | 状态 |
| --- | --- | --- | --- |
| 企业所得税 | ZYJQY | FAGLFLEXT-HSLxx | OK |
| 申报企业所得税 | ZQYSB | ZSAP_FI054-AMOUNT | OK |
| 校验企业所得税 | ZQYJY | 计算列 ZYJQY-ZQYSB | OK |

## 汇总

- 选择条件：3/3 覆盖 ✅
- 输出列：20/20 覆盖 ✅（2 组织 + 18 税种数据列 = 6 税种 × 3 列）
