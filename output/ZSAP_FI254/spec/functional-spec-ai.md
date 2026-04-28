---
program: ZSAP_FI254
fs_id: EE086
fs_name: 科目余额表
version: 1.0
---

# 功能说明书（AI规范化）—— 科目余额表

## 1. 业务目标与报表类型

- **业务目标**：按照需求查询科目余额表，支持本币和外币余额展示。
- **报表类型**：在线 ALV 清单报表
- **使用频度**：日
- **处理模式**：在线处理
- **开发优先度**：高

## 2. 选择条件

| 字段描述 | 表名 | 字段名 | 选择方式 | 必输 | 默认值 | 补充逻辑 |
|----------|------|--------|----------|------|--------|----------|
| 公司代码 | ZSAP_BUKRS | BUKRS | 单选（PARAMETERS） | 是 | - | 搜索帮助取表 ZSAP_BUKRS-BUKRS |
| 会计年度 | FAGLFLEXT | RYEAR | 单选（PARAMETERS） | 是 | - | - |
| 期间 | FAGLFLEXT | RPMAX | 多选（SELECT-OPTIONS） | 否 | - | - |
| 科目编码 | FAGLFLEXT | RACCT | 多选（SELECT-OPTIONS） | 否 | - | - |
| 是否显示外币余额 | - | - | 复选框（CHECKBOX） | 否 | 空 | 勾选后 ALV 额外展示外币列 |

## 3. 输出列

### 3.1 本币列（始终展示）

| 输出字段描述 | 逻辑字段名 | 来源表 | 来源字段 | 计算/转换规则 |
|--------------|------------|--------|----------|---------------|
| 一级节点 | ZYJKM | FAGLFLEXT | RACCT | LEFT(FAGLFLEXT-RACCT, 4) |
| 科目编码 | RACCT | FAGLFLEXT | RACCT | - |
| 科目描述 | TXT50 | SKAT | TXT50 | SKAT-KTOPL='EEKA', SKAT-SPRAS=SY-LANGU |
| 核算维度编码 | ZFZHS | - | - | 1002*取 SKA1-ZFKYH；6601*取 FAGLFLEXT-RFAREA |
| 核算维度名称 | ZFZTX | - | - | 1002*取 SKA1-ZYHZH；6601*取 TFKBT-FKBTX |
| 期初余额借方 | ZQCJF | FAGLFLEXT | HSLVT+HSL01~16 | 期间起始=01取HSLVT；否则取HSLVT+截至起始期间前一月累计。仅当金额≥0展示 |
| 期初余额贷方 | ZQCDF | FAGLFLEXT | HSLVT+HSL01~16 | 同上逻辑。仅当金额<0展示 |
| 本期发生借方 | ZBQJF | FAGLFLEXT | HSL01~16 | DRCRK='S'，屏选期间累计 |
| 本期发生贷方 | ZBQDF | FAGLFLEXT | HSL01~16 | DRCRK='H'，屏选期间累计 |
| 本年累计借方 | ZBNJF | FAGLFLEXT | HSL01~16 | DRCRK='S'，从01到屏选截止期间累计 |
| 本年累计贷方 | ZBNDF | FAGLFLEXT | HSL01~16 | DRCRK='H'，从01到屏选截止期间累计 |
| 期末余额借方 | ZQMJF | - | - | 期初+本期发生。金额≥0时展示 |
| 期末余额贷方 | ZQMDF | - | - | 期初+本期发生。金额<0时展示 |

### 3.2 外币列（勾选"是否显示外币余额"时展示）

| 输出字段描述 | 逻辑字段名 | 来源表 | 来源字段 | 计算/转换规则 |
|--------------|------------|--------|----------|---------------|
| 期初余额借方（外币） | ZQCJF1 | FAGLFLEXT | TSLVT+TSL01~16 | 同本币逻辑，字段换为 TSL，增加 RTCUR 限制 |
| 期初余额贷方（外币） | ZQCDF1 | FAGLFLEXT | TSLVT+TSL01~16 | 同上 |
| 本期发生借方（外币） | ZBQJF1 | FAGLFLEXT | TSL01~16 | DRCRK='S'，屏选期间 TSL 累计 |
| 本期发生贷方（外币） | ZBQDF1 | FAGLFLEXT | TSL01~16 | DRCRK='H'，屏选期间 TSL 累计 |
| 本年累计借方（外币） | ZBNJF1 | FAGLFLEXT | TSL01~16 | DRCRK='S'，从01到截止期间 TSL 累计 |
| 本年累计贷方（外币） | ZBNDF1 | FAGLFLEXT | TSL01~16 | DRCRK='H'，从01到截止期间 TSL 累计 |
| 期末余额借方（外币） | ZQMJF1 | - | - | 期初+本期发生（外币） |
| 期末余额贷方（外币） | ZQMDF1 | - | - | 期初+本期发生（外币） |

## 4. 透明表与用途

| 表名 | 用途 | 主/从 |
|------|------|-------|
| FAGLFLEXT | 总账科目余额汇总表，主驱动表 | 主 |
| ZSAP_BUKRS | 公司代码自定义表，用于公司代码与利润中心映射 | 从 |
| CEPC | 利润中心主数据，用于利润中心层级限制 | 从 |
| SKA1 | 总账科目主数据，取辅助维度字段（ZFKYH） | 从 |
| SKAT | 总账科目文本，取科目描述 | 从 |
| TFKBT | 功能范围文本，取功能范围描述 | 从 |

## 5. 权限、性能、变式约束

- **权限**：标准 FI 报表权限，需 S_DEVELOP 等开发权限。
- **性能**：FAGLFLEXT 数据量可能较大，建议按公司代码+年度+期间+科目做索引限制。
- **变式**：允许保存变式。
- **排序**：按科目号升序排列。
