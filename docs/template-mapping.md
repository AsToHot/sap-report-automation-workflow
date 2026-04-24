# ZSAP_FI250 模板映射（参照 ZSAP_FI244）

## 参考对象与新对象

- 参考主程序：`ZSAP_FI244`
- 新主程序：`ZSAP_FI250`
- 包：`ZABAP`
- 请求号：`EFDK900012`

## INCLUDE 映射

| 参考 INCLUDE | 新 INCLUDE | 作用 |
|---|---|---|
| `ZSAP_FI244T01` | `ZSAP_FI250T01` | 全局类型/数据/事件类定义 |
| `ZSAP_FI244SEL` | `ZSAP_FI250SEL` | 选择屏幕 |
| `ZSAP_FI244F01` | `ZSAP_FI250F01` | 取数逻辑与 ALV 展示 |

## 结构约束

- 主程序只保留事件块与 INCLUDE 引用，不承载主业务 SQL。
- 选择条件、输出字段、SQL 仅能来自 `docs/tech-design.md` 字段契约与 `metadata/tables/*.json`。
- 未在 FS 契约中的字段禁止擅自加入，需先补文档与元数据。
