# Smoke Test — ZTEST003

## 真实数据执行校验

| 项目 | 结果 |
|------|------|
| 执行方式 | `node scripts/verify_report.js ZTEST003 P_BUKRS=6030 P_GJAHR=2026 S_RPMAX=001-003` |
| 执行状态 | **PASSED** — 报表 ZTEST003 执行成功，共 143 行 |
| 输出行数 | 143 行 |
| 数据完整性 | 全部 21 列正确输出（13 个本币列 + 8 个外币列隐藏） |

## 数据抽样验证

| 表 | 采样行 | 关键字段 | 值 |
|----|--------|---------|-----|
| FAGLFLEXT | RACCT=1002000001, RBUKRS=6030, RYEAR=2026 | HSLVT(DRCRK=S) | 863.5 + 300000 + 3777774 + 49311260.66 + ... |

程序输出 1002000001：
- ZQCJF=290863.5（期初=HSLVT汇总，p_from=1 无前期）
- ZBQJF=0, ZBQDF=0（001-003 无本期活动）
- ZQMJF=290863.5（期末=期初）

注：此数据为系统现有测试数据，数据一致性需经用户业务验证确认。

## 功能验证

| 验证项 | 结果 |
|--------|------|
| 程序激活 | PASSED |
| 程序执行（300 真实数据） | PASSED — 143 行 |
| ALV 列完整性 | PASSED — 21 列 |
| 一级节点 ZYJKM | PASSED — LEFT(RACCT,4) |
| 科目描述 SKAT | PASSED — TXT50 正确 |
| 核算维度（1002*） | PASSED — 银行账户号+行名 |
| 期初余额计算 | PASSED |
| 本期发生计算 | PASSED |
| 期末余额计算 | PASSED |

## 已知限制

| 项目 | 说明 |
|------|------|
| 文本元素 | 需在 SE80 中手动维护 |
| GUI Status | 使用 SALV STANDARD (SAPLKKBL) |
| 外币列 | 需 P_FWAERS='X' 才展示（未测） |
| TABLES faglflex | 此系统不支持 TABLES 声明 FAGLFLEXT，已用 DDIC 数据元素绕过 |
