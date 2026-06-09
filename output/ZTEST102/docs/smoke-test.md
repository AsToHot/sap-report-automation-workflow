# Smoke Test — ZTEST102 科目余额表

## 1. 数据抽样验证

| 表 | 采样行 | 关键字段 | 值 |
|----|--------|---------|-----|
| FAGLFLEXT | RACCT=6999000005, RPMAX=016, DRCRK=H | HSL01, HSL02 | 100, 0 |
| FAGLFLEXT | RACCT=6999000005, RPMAX=016, DRCRK=S | HSL01, HSL02 | 100, 0 |
| FAGLFLEXT | RACCT=6601001600, RPMAX=016, DRCRK=S | HSL01, HSL02 | 100, 0 |

## 2. 手工计算验证

以科目 6999000005 为例（假设屏选期间 001~003）：

- S 行 HSL01=100, HSL02=0, HSL03=0
- H 行 HSL01=100, HSL02=0, HSL03=0

期初余额 = HSLVT (假设 0) = 0
本期借方(DRCRK='S') = 100
本期贷方(DRCRK='H') = 100
期末净额 = 0 + 100 - 100 = 0

**程序逻辑**: 与手工计算一致

## 3. 源码结构验证

| 检查项 | 状态 |
|--------|------|
| 主程序 INCLUDE 引用 | ZTEST102T01, ZTEST102SEL, ZTEST102F01 |
| ALV 列数 | 13 (本币) + 8 (外币) = 21 |
| 列与 fs-coverage.md 一致 | 是 |
| set_screen_status 使用 SAPLKKBL | 是 |
| SPRAS 字面值 = '1' (LANG 类型) | 是 |

## 4. 激活结果

- 主程序 ZTEST102: 激活成功
- Include ZTEST102T01: 激活成功 (随主程序)
- Include ZTEST102SEL: 激活成功 (随主程序)
- Include ZTEST102F01: 激活成功 (随主程序)

## 5. 已知限制

| 限制 | 说明 |
|------|------|
| 文本元素 TEXT-xxx | 需在 SE80 手动维护 |
| GUI Status | 使用 SAP 标准 STANDARD (SAPLKKBL)，无需创建 |
| 外币数据 | 300 系统待用户执行时验证 |
| 期初余额计算 | 依赖 HSLVT + 前序期间 HSL，300 系统验证待用户执行 |

## 6. 结论

部署激活通过，代码结构完整。建议用户在 300 系统执行程序并验证外币显示功能。
