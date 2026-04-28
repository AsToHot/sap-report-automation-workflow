# Smoke Test Report — ZSAP_FI254

| 测试项 | 执行方式 | 结果 |
|--------|----------|------|
| 源码一致性（主程序） | ADT getObjectSource vs 本地文件 | PASS |
| 源码一致性（ZSAP_FI254T01） | ADT getObjectSource vs 本地文件 | PASS |
| 源码一致性（ZSAP_FI254SEL） | ADT getObjectSource vs 本地文件 | PASS |
| 源码一致性（ZSAP_FI254F01） | ADT getObjectSource vs 本地文件 | PASS |
| ALV 列核对 | 静态源码分析 vs FS | PASS |

## ALV 列核对详情

代码中 `display` FORM 定义的 ALV 列（含本币+外币）共 21 列：

| 字段名 | 描述 | FS 对应 |
|--------|------|---------|
| ZYJKM | 一级节点 | Done |
| RACCT | 科目编码 | Done |
| TXT50 | 科目描述 | Done |
| ZFZHS | 核算维度编码 | Done |
| ZFZTX | 核算维度名称 | Done |
| ZQCJF | 期初余额借方 | Done |
| ZQCDF | 期初余额贷方 | Done |
| ZBQJF | 本期发生借方 | Done |
| ZBQDF | 本期发生贷方 | Done |
| ZBNJF | 本年累计借方 | Done |
| ZBNDF | 本年累计贷方 | Done |
| ZQMJF | 期末余额借方 | Done |
| ZQMDF | 期末余额贷方 | Done |
| ZQCJF1 | 期初余额借方（外币） | Done |
| ZQCDF1 | 期初余额贷方（外币） | Done |
| ZBQJF1 | 本期发生借方（外币） | Done |
| ZBQDF1 | 本期发生贷方（外币） | Done |
| ZBNJF1 | 本年累计借方（外币） | Done |
| ZBNDF1 | 本年累计贷方（外币） | Done |
| ZQMJF1 | 期末余额借方（外币） | Done |
| ZQMDF1 | 期末余额贷方（外币） | Done |

外币列通过选择屏参数 `P_WAERS` 控制显示/隐藏（`set_technical`），与 FS 一致。

## 已知限制（手动步骤）

- **文本元素**：SEL 文件中的中文文本元素（TEXT-T00、TEXT-001~TEXT-005）需在 SE80 中手动维护。
- **GUI Status**：ALV 使用的 GUI Status `S1000` 需在 SE80 中手动创建或从模板程序复制。

## 结论

冒烟测试通过，可标记 `S5.5=smoke-test-passed: yes`。
