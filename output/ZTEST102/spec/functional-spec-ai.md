# 功能说明（AI 可读模板）

> 来源：`spec/EE090 - 报税取数稽核报表_V1.0_20260325.docx`
> 目标程序：ZTEST102

## 1. 业务目标与报表类型

- 目标：用于相关报税数据科目稽核——比对 FAGLFLEXT 应交金额与 ZSAP_FI054 申报金额，按税种逐项校验差异
- 类型（清单 / 汇总 / 下载 / 其他）：汇总报表（ALV 展示）

## 2. 选择条件

| 屏幕字段 | 必输 | 类型 | 对应表.字段 | 说明 |
| ---- | --- | --- | ------ | --- |
| S_BUKRS | 是 | SELECT-OPTIONS | ZSAP_BUKRS-BUKRS | 公司代码（多选） |
| P_RYEAR | 是 | PARAMETERS | FAGLFLEXT-RYEAR | 会计年度（单选） |
| S_RPMAX | 是 | SELECT-OPTIONS | FAGLFLEXT-RPMAX | 核对期间（多选） |

## 3. 输出列

### 组织机构
| 列 | 来源表.字段 | 计算/转换 |
| --- | ------ | ----- |
| BUKRS | ZSAP_BUKRS-BUKRS | 直接取值 |
| LTEXT | ZSAP_BUKRS-LTEXT | 直接取值（机构名称） |

### 增值税（科目：FAGLFLEXT=2221100000，ZSAP_FI054=221100000）
| 列 | 来源表.字段 | 计算/转换 |
| --- | ------ | ----- |
| ZYJZZ | FAGLFLEXT-HSL | SUM(HSL{期间范围}) WHERE RACCT='2221100000' |
| ZZZSB | ZSAP_FI054-AMOUNT | SUM(AMOUNT) WHERE KONT_FY='221100000' |
| ZZZJY | 计算列 | ZYJZZ - ZZZSB |

### 城建税（科目：2221020000）
| 列 | 来源表.字段 | 计算/转换 |
| --- | ------ | ----- |
| ZYJCJ | FAGLFLEXT-HSL | SUM(HSL{期间范围}) WHERE RACCT='2221020000' |
| ZCJSB | ZSAP_FI054-AMOUNT | SUM(AMOUNT) WHERE KONT_FY='2221020000' |
| ZCJJY | 计算列 | ZYJCJ - ZCJSB |

### 教育费附加（科目：2221030000）
| 列 | 来源表.字段 | 计算/转换 |
| --- | ------ | ----- |
| ZYJJY | FAGLFLEXT-HSL | SUM(HSL{期间范围}) WHERE RACCT='2221030000' |
| ZJYSB | ZSAP_FI054-AMOUNT | SUM(AMOUNT) WHERE KONT_FY='2221030000' |
| ZJYJY | 计算列 | ZYJJY - ZJYSB |

### 地方教育费附加（科目：2221040000）
| 列 | 来源表.字段 | 计算/转换 |
| --- | ------ | ----- |
| ZYJDF | FAGLFLEXT-HSL | SUM(HSL{期间范围}) WHERE RACCT='2221040000' |
| ZDFSB | ZSAP_FI054-AMOUNT | SUM(AMOUNT) WHERE KONT_FY='2221040000' |
| ZDFJY | 计算列 | ZYJDF - ZDFSB |

### 印花税（科目：2221070000）
| 列 | 来源表.字段 | 计算/转换 |
| --- | ------ | ----- |
| ZYJYH | FAGLFLEXT-HSL | SUM(HSL{期间范围}) WHERE RACCT='2221070000' |
| ZYHSB | ZSAP_FI054-AMOUNT | SUM(AMOUNT) WHERE KONT_FY='2221070000' |
| ZYHJY | 计算列 | ZYJYH - ZYHSB |

### 企业所得税（科目：2221060000）
| 列 | 来源表.字段 | 计算/转换 |
| --- | ------ | ----- |
| ZYJQY | FAGLFLEXT-HSL | SUM(HSL{期间范围}) WHERE RACCT='2221060000' |
| ZQYSB | ZSAP_FI054-AMOUNT | SUM(AMOUNT) WHERE KONT_FY='2221060000' |
| ZQYJY | 计算列 | ZYJQY - ZQYSB |

## 4. 透明表

| 表名 | 用途 | 主从/关联说明 |
| --- | --- | ------- |
| FAGLFLEXT | 科目余额汇总（应交金额来源） | 主驱动表：公司代码+科目+期间汇总 |
| ZSAP_BUKRS | 公司代码映射（BUKRS/ZFGS/ZZGS/PRCTR/LTEXT） | 主表：输出公司代码及名称，BUKRS→RBUKRS 映射 |
| CEPC | 利润中心主数据 | 辅助过滤：ZSAP_BUKRS-PRCTR → CEPC-KHINR 关联，过滤 PRCTR |
| ZSAP_FI054 | 申报金额交易数据 | 主驱动表2：申报金额来源 |
| SKA1 | 科目主数据 | 辅助映射：SKA1-ZBUKRS → SKA1-ZFKYH，关联银行账户 |

## 5. 业务逻辑

### 5.1 应交金额取数（FAGLFLEXT）

1. **公司代码映射**：通过 ZSAP_BUKRS 将屏幕选择的公司代码映射为实际账簿公司代码
   - 如 ZSAP_BUKRS-ZFGS = ''，则 ZSAP_BUKRS-BUKRS = FAGLFLEXT-RBUKRS
   - 如 ZSAP_BUKRS-ZFGS ≠ ''，则 ZSAP_BUKRS-ZZGS = FAGLFLEXT-RBUKRS
2. **利润中心限制**：ZSAP_BUKRS-PRCTR = CEPC-KHINR，CEPC-DATBI = '99991231'，CEPC-KOKRS = 'EEKA'，取 CEPC-PRCTR = FAGLFLEXT-PRCTR 进行数据限制
3. **科目限制**：FAGLFLEXT-RACCT = 对应税种科目（6个科目）
4. **期间汇总**：FAGLFLEXT-RYEAR = P_RYEAR，按 S_RPMAX 区间汇总 HSL{start}~HSL{end}
5. **按公司代码+科目分组汇总**

### 5.2 申报金额取数（ZSAP_FI054）

1. **科目限制**：ZSAP_FI054-KONT_FY = 对应申报科目
2. **期间限制**：ZSAP_FI054-TRADEDATE BETWEEN 年度+起始月首日 AND 年度+结束月末日（如 2026年3~6月 → 20260301 ~ 20260630）
3. **银行账户限制**：通过 SKA1 关联——SKA1-ZBUKRS = 屏幕选择公司代码，SKA1-KTOPL = 'SKA1'，取 SKA1-ZFKYH = ZSAP_FI054-OURBANKACCOUNTNUMBER
4. **按银行账户+科目分组汇总**

### 5.3 校验计算

校验结果 = 应交金额 - 申报金额（逐税种逐公司代码计算）

## 6. 税种科目映射

| 税种 | FAGLFLEXT-RACCT | ZSAP_FI054-KONT_FY |
| --- | --- | --- |
| 增值税 | 2221100000 | 221100000 |
| 城建税 | 2221020000 | 2221020000 |
| 教育费附加 | 2221030000 | 2221030000 |
| 地方教育费附加 | 2221040000 | 2221040000 |
| 印花税 | 2221070000 | 2221070000 |
| 企业所得税 | 2221060000 | 2221060000 |

## 7. 约束与 TBD

- 权限：FAGLFLEXT 需财务会计权限
- 性能：FAGLFLEXT 可能数据量较大，建议按年度+公司代码+科目严格过滤
- 变式：无特殊要求
- 待确认：
  1. 增值税的 ZSAP_FI054-KONT_FY 为 '221100000'（少一位），需确认是否正确
  2. 利润中心 CEPC-KHINR 与 ZSAP_BUKRS-PRCTR 的关联字段确认
  3. SKA1-KTOPL 值为 'SKA1' 是否正确（通常为 'EEKA'）
