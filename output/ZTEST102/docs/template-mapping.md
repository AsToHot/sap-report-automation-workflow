# Template Mapping — ZTEST102

## INCLUDE 分层映射

| 新 Include | 角色 | 内容 |
| --- | --- | --- |
| ZTEST102T01 | TOP | TYPES、DATA、CONSTANTS、税种科目常量 |
| ZTEST102SEL | SEL | PARAMETERS P_RYEAR、SELECT-OPTIONS S_BUKRS/S_RPMAX |
| ZTEST102F01 | F01 | FORMs: authority_check / get_bukrs_map / get_gl_data / get_fi054_data / fill_output / display_alv / parse_periods |

## 反模式自检结果 (6 轮)

| 轮次 | 检查项 | 结果 |
| --- | --- | --- |
| -1 | ASSIGN COMPONENT HSL 字段名对齐 + sy-subrc | ✅ 通过 |
| 0 | DDIC 字面值长度 (KOKRS='EEKA'/KTOPL='EEKA'/DATBI='99991231') | ✅ 通过 |
| 1 | DB: 全部 SELECT 有 WHERE + 无 LOOP-SELECT + 无 EXEC SQL | ✅ 通过 |
| 2 | WHERE: FOR ALL ENTRIES → IN (已修正) | ✅ 通过 |
| 3 | 内表: SORTED/HASHED TABLE + LOOP ASSIGNING + 无嵌套 LOOP | ✅ 通过 |
| 4 | 控制流: CASE 有 WHEN OTHERS + FORM < 200 行 + 嵌套 < 3 层 | ✅ 通过 |
| 5 | 其他: AUTHORITY-CHECK + 无硬编码 | ✅ 通过 |
