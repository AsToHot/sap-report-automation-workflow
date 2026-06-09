# Template Mapping — ZTEST102

## 参考模板

- **源模板**：`templates/reference/ZSAP_FI244/`
- **对象类型**：REPORT (PROG/P)

## INCLUDE 映射

| 模板文件 | 新程序文件 | 说明 |
|---------|-----------|------|
| ZSAP_FI244.abap | ZTEST102.abap | 主程序：REPORT 声明 + INCLUDE 引用 |
| ZSAP_FI244T01.abap | ZTEST102T01.abap | TOP Include：类型定义、内表、全局变量 |
| ZSAP_FI244SEL.abap | ZTEST102SEL.abap | 选择屏幕：PARAMETERS + SELECT-OPTIONS |
| ZSAP_FI244F01.abap | ZTEST102F01.abap | FORM 子程序：取数逻辑、ALV 输出 |

## 结构调整说明

- 保持与模板相同的 INCLUDE 分层结构（T01/SEL/F01）
- TOP Include 新增：FAGLFLEXT 工作区、汇总内表类型、外币金额字段
- SEL Include 新增：外币勾选框 P_FORCUR
- F01 Include 新增：期间金额动态汇总 FORM、维度编码/名称补充 FORM
