# 冒烟测试执行范式（S5.5 强制）

> 阶段 5.5 冒烟测试必须按本文档执行，不可跳过，不可仅跑脚本看返回码。
> 违约风险：代码在零数据场景"看起来正确"，但实际有数据的计算逻辑全错。

## 1. 测试范式总则

```
每个必输字段都必须有值
每个范围参数必须测试多组区间
每个输出字段必须逐列比对源表手工计算值
源表数据 = 0 不等于测试通过——必须找到非零数据或明确标注未覆盖
```

## 2. 入参组合矩阵

以 REPORT 类型为例，假设选择屏有：

| 参数 | 类型 | 必输 |
|------|------|------|
| P_BUKRS | PARAMETERS 单选 | X |
| P_RYEAR | PARAMETERS 单选 | X |
| S_RPMAX | SELECT-OPTIONS 多选 | X |
| S_RACCT | SELECT-OPTIONS 多选 | |
| P_FORCUR | PARAMETERS CHECKBOX | |

### 最少测试组合（4 组起）

> 设选择屏有：必输单值 P1/P2、必输范围 S1、可选范围 S2、可选按钮 C1
> 从 FS 中提取实际参数名和类型

| 组 | 必输单值1 | 必输单值2 | 必输范围 | 可选范围 | 可选按钮 | 目的 |
|----|---------|---------|---------|---------|---------|------|
| A | 有数据值#1 | 有数据值#1 | 单值 EQ | 不填 | 不勾 | 基准：全量 |
| B | 有数据值#1 | 有数据值#1 | 单值 EQ | 特殊分支值 BT | 不勾 | 验证可选过滤 |
| C | 有数据值#2 | 有数据值#1 | 单值 EQ | 不填 | 勾 | 验证按钮逻辑 |
| D | 有数据值#1 | 有数据值#2 | 单值 EQ | 不填 | 不勾 | 验证另一维度 |

如有**映射逻辑**（如公司代码通过 Z 表映射），加测 E 组（覆盖另一映射分支）。

> 具体示例（以 ZTEST005 科目余额表为例）见本文档附录 A。

### 选择测试数据值的步骤（通用）

以 FUNCTIONAL-SPEC 中的**主驱动表**和**必输选择字段**为输入，按以下步骤找到至少 2 组有数据的值：

```bash
# 1. 从 FS 确认主驱动表（通常是取数逻辑中的 FROM 主表）
#    例如：FAGLFLEXT / BKPF / BSEG / MARA / LFA1 等

# 2. 用主驱动表 GROUP BY 必输字段，找有数据的值
node scripts/data_sampler.js \
  "--table=<主驱动表>" \
  "--fields=<必输字段1>,<必输字段2>,COUNT(*) AS CNT" \
  "--where=<FS 中的基准过滤条件>" \
  "--rows=20"
# 输出: 每个字段组合的数据行数 → 选 ≥2 组有数据的值

# 3. 如果 FS 中有映射表（如 Z 表映射公司代码），单独抽样确认映射逻辑
node scripts/data_sampler.js \
  "--table=<映射表>" \
  "--fields=<关键字段>" \
  "--rows=50"

# 4. 确认选中值在主驱动表中确实有数据（用 WHERE 精确过滤）
node scripts/data_sampler.js \
  "--table=<主驱动表>" \
  "--where=<必输字段1> = '<选中值1>' AND <必输字段2> = '<选中值2>'" \
  "--rows=5"
```

**选择原则**：
- 每个必输字段至少 2 个不同值
- 如果字段有映射逻辑（如公司代码→有效公司代码），选能覆盖所有分支的值
- 如果有特殊值逻辑（如科目 1002* 分支），确保选中值覆盖所有分支

## 3. 执行步骤（每组测试）

### 步骤 1：源表手工计算

```bash
# 以 FS 的输出列溯源表和字段为基准，抽样主驱动表
node scripts/data_sampler.js \
  "--table=<主驱动表>" \
  "--fields=<FS 输出列涉及的源表字段，逗号分隔>" \
  "--where=<选择屏必输字段> = '<选中值>' AND <其他过滤条件>" \
  "--rows=100"

# 手工聚合规则（从 tech-design.md 的金额计算公式推导）：
#   对每个输出行（如按科目/物料/供应商归集），逐条应用 FS 中的计算逻辑
#   记录每个聚合键的中间值和最终输出值
```

> 聚合规则示例见本文档附录 A，具体公式以本程序的 `docs/tech-design.md` §5 为准。
```

### 步骤 2：程序执行取数

```javascript
// 通过 ZREPORT_EXEC_VERIFY FM 调用程序
const res = await client.call('ZREPORT_EXEC_VERIFY', {
  IV_REPORT: 'ZTEST005',
  IT_RSPARAMS: [
    { SELNAME: 'P_BUKRS', KIND: 'P', SIGN: 'I', OPTION: 'EQ', LOW: '<公司>', HIGH: '' },
    { SELNAME: 'P_RYEAR', KIND: 'P', SIGN: 'I', OPTION: 'EQ', LOW: '<年>', HIGH: '' },
    { SELNAME: 'S_RPMAX', KIND: 'S', SIGN: 'I', OPTION: 'EQ', LOW: '<期间>', HIGH: '' },
    // 可选: { SELNAME: 'S_RACCT', KIND: 'S', SIGN: 'I', OPTION: 'BT', LOW: '1002000000', HIGH: '1002999999' },
  ]
});
// 输出: EV_SUCCESS, EV_MESSAGE, EV_ROW_COUNT, EV_DATA_JSON
```

### 步骤 3：逐字段比对

```javascript
// 对每个重叠 RACCT，比对 8 个金额列
const fields = ['ZQCJF','ZQCDF','ZBQJF','ZBQDF','ZBNJF','ZBNDF','ZQMJF','ZQMDF'];
for (const row of progRows) {
  const src = sourceMap[row.RACCT];
  if (!src) continue;
  
  // 计算预期值
  const opening = src.hslvt_all; // ΣHSLVT
  const exp_qcjf = opening >= 0 ? opening : 0;
  const exp_qcdf = opening < 0 ? -opening : 0;
  const closing = exp_qcjf - exp_qcdf + src.hsl_curr_s - src.hsl_curr_h;
  const exp_qmjf = closing >= 0 ? closing : 0;
  const exp_qmdf = closing < 0 ? -closing : 0;
  
  // 逐列比对
  const match = 
    Math.abs(row.ZQCJF - exp_qcjf) < 0.01 &&
    Math.abs(row.ZQCDF - exp_qcdf) < 0.01 &&
    Math.abs(row.ZBQJF - src.hsl_curr_s) < 0.01 &&
    Math.abs(row.ZBQDF - src.hsl_curr_h) < 0.01 &&
    Math.abs(row.ZBNJF - src.hsl_cumul_s) < 0.01 &&
    Math.abs(row.ZBNDF - src.hsl_cumul_h) < 0.01 &&
    Math.abs(row.ZQMJF - exp_qmjf) < 0.01 &&
    Math.abs(row.ZQMDF - exp_qmdf) < 0.01;
  
  if (!match) { /* 记录差异 */ }
}
```

## 4. 描述字段比对

除金额外，以下字段也必须比对：

| 程序字段 | 源表/逻辑 | 比对方式 |
|---------|----------|---------|
| 维度列 (如科目/物料/供应商) | 主驱动表的对应字段 | 程序值在源表中存在 |
| 描述列 (如名称/文本) | FS 中指定的文本表 | 单独查文本表比对（注意 SPRAS='1'） |
| 维度编码/名称 (如有) | FS 中指定的关联表 | 对特殊值分支逐一验证非空 |
| 计算列 (如 LEFT 截取) | 表达式结果 | 与程序输出逐位比对 |

```bash
# 验证文本描述的通用模板
node scripts/data_sampler.js \
  "--table=<FS 指定的文本表>" \
  "--where=<键字段> IN (<从程序输出取样的键值>)" \
  "--rows=5"
# 比对: 程序输出.描述列 = 文本表.描述字段
```

## 5. 通过标准

```
[ ] 至少 2 个不同的必输字段值组合测试通过
[ ] 至少 3 组参数组合 (含不同必输值/不同范围/不同按钮状态) SUCCESS
[ ] 全部金额/数值列对每个重叠键值 0.01 容差内匹配
[ ] 全部描述/文本列对样本验证正确（单独查文本表比对）
[ ] 源表有非零数据时，程序输出对应非零
      ——或明确标注"数据全零，计算逻辑待有数据后补充验证"
[ ] smoke-test.md 写入 output/<程序>/（非 docs/）
```

## 6. 附录

### 附录 A：具体示例（ZTEST005 科目余额表）

**入参组合**（对应通用矩阵）：
| 组 | P_BUKRS | P_RYEAR | S_RPMAX | S_RACCT | P_FORCUR | 目的 |
|----|---------|---------|---------|---------|----------|------|
| A | 80L0 | 2026 | 016 | (空) | (空) | 基准 |
| B | 80L0 | 2026 | 016 | 1002* | 核算维度-银行 |
| C | 80N0 | 2025 | 016 | (空) | (空) | 另一公司 |
| D | 80K0 | 2025 | 016 | 6601* | X | 核算维度-功能范围+外币 |

**选择测试值步骤**：
```bash
# 1. 确认主驱动表 FAGLFLEXT 有数据的公司代码
node scripts/data_sampler.js "--table=FAGLFLEXT" \
  "--where=RYEAR = '2026'" "--rows=1"
# → RBUKRS=80L0 有 609 行

# 2. 查 ZSAP_BUKRS 映射
node scripts/data_sampler.js "--table=ZSAP_BUKRS" \
  "--fields=BUKRS,ZFGS,ZZGS" "--rows=100"
# → 80L0: ZFGS='X', ZZGS='80F0'

# 3. 确认有效公司代码有数据
node scripts/data_sampler.js "--table=FAGLFLEXT" \
  "--where=RYEAR = '2026' AND RBUKRS = '80F0'" "--rows=5"
# → 101 行
```

**手工聚合规则**（以期间 016 为例，来源于 FS §3-§4）：
```
期初 = ΣHSLVT (全部 DRCRK)
本期借方 = ΣHSL16 (DRCRK='S', 在屏选范围内)
本期贷方 = ΣHSL16 (DRCRK='H', 在屏选范围内)
累计借方 = ΣHSL16 (DRCRK='S', ≤截止期间)
累计贷方 = ΣHSL16 (DRCRK='H', ≤截止期间)
期末 = 期初借方 - 期初贷方 + 本期借方 - 本期贷方
```

**描述字段验证**：
```bash
# 文本表抽样
node scripts/data_sampler.js "--table=SKAT" \
  "--where=SPRAS = '1' AND SAKNR IN ('1002000001','6401010001')" "--rows=5"
# → 与程序 TXT50 比对
```

## 6. 写入 smoke-test.md 模板

```markdown
# <程序名> 冒烟测试报告

## 测试日期
YYYY-MM-DD

## 数据环境
| 系统 | 客户端 | 说明 |
|------|--------|------|
| 数据系统 | 300 | .env.data |

## 入参出参矩阵

| # | 入参 | EV_SUCCESS | EV_ROW_COUNT | 源表比对 | 备注 |
|---|------|-----------|-------------|---------|------|
| 1 | P_BUKRS=X, P_RYEAR=Y, S_RPMAX=Z | X | N | 33/33 MATCH | |

## 比对详情

### 用例 N: 参数组合
| 步骤 | 操作 | 结果 |
|------|------|------|
| 1-源表 | data_sampler.js --table=X --where=Y | N 行 |
| 2-聚合 | 手工按 RACCT+DRCRK 聚合 | M 个 RACCT |
| 3-程序 | ZREPORT_EXEC_VERIFY | N 行, SUCCESS |
| 4-比对 | 逐字段 diff | K/K MATCH |

### 字段级比对（样本）
| RACCT | 源-期初借 | 程序-期初借 | diff | 源-本期借 | 程序-本期借 | diff | ... |
|-------|----------|-----------|------|----------|-----------|------|-----|
| | | | | | | | |

### 描述字段比对（样本）
| RACCT | 程序-TXT50 | SKAT-TXT50 | 匹配 | 程序-ZFZHS | SKA1-ZFKYH | 匹配 |
|-------|-----------|-----------|------|-----------|-----------|------|
| | | | | | | |

## 结论
- [x/n] 金额列全部匹配
- [x/n] 描述列全部匹配
- [ ] 非零数据验证 (有/无)
```
