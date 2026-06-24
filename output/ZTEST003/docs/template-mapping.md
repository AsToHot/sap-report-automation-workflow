# Template Mapping — ZTEST003

## 参考模板

`templates/reference/ZSAP_FI244/`（项目默认 REPORT 模板）

## INCLUDE 对应关系

| 模板文件 | 新程序文件 | 用途 |
|---------|-----------|------|
| ZSAP_FI244.abap | ZTEST003.abap | 主程序（REPORT 语句 + INCLUDE 引用） |
| ZSAP_FI244T01.abap | ZTEST003T01.abap | TOP Include（全局数据定义、内表、工作区） |
| ZSAP_FI244SEL.abap | ZTEST003SEL.abap | 选择屏幕（PARAMETERS / SELECT-OPTIONS） |
| ZSAP_FI244F01.abap | ZTEST003F01.abap | FORM 子程序（取数、计算、ALV 输出） |

## 模板适配说明

- 模板的 ALV 骨架（CL_SALV_TABLE）直接复用
- 选择屏按本需求重写（P_BUKRS / P_GJAHR / S_RPMAX / S_RACCT / P_FWAERS）
- 取数逻辑按 tech-design.md 字段契约实现
- 金额计算按 FS 4.4/4.5 公式实现
- 模板中与本需求无关的字段/逻辑删除

## SALV GUI Status

```abap
gr_alv->set_screen_status(
  pfstatus      = 'STANDARD'
  report        = 'SAPLKKBL'
  set_functions = gr_alv->c_functions_all
).
```
