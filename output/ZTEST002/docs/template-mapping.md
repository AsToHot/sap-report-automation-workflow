# 模板映射 — ZTEST002

## 参考模板

| 模板文件 | 来源 | 映射到 |
|---------|------|--------|
| ZSAP_FI244.abap | templates/reference/ZSAP_FI244/ | ZTEST002.abap（主程序） |
| ZSAP_FI244T01.abap | templates/reference/ZSAP_FI244/ | ZTEST002T01.abap（TOP Include） |
| ZSAP_FI244SEL.abap | templates/reference/ZSAP_FI244/ | ZTEST002SEL.abap（选择屏幕） |
| ZSAP_FI244F01.abap | templates/reference/ZSAP_FI244/ | ZTEST002F01.abap（逻辑与显示） |

## INCLUDE 清单

| 新对象 | 类型 | 内容 |
|--------|------|------|
| ZTEST002 | PROG/P | REPORT 声明 + INCLUDE 引用 + INITIALIZATION + START-OF-SELECTION |
| ZTEST002T01 | PROG/I | TABLES 声明、ALV 引用、数据结构（GS_DATA/GT_DATA）、类定义 |
| ZTEST002SEL | PROG/I | 选择屏幕（P_BUKRS, P_GJAHR, S_RPMAX, S_RACCT, P_FCUR） |
| ZTEST002F01 | PROG/I | 类实现、GET_DATA、DISPLAY、SET_COLUMN、事件处理 |

## 差异说明

- 模板使用 BKPF+BSEG+FAGLFLEXA（凭证级别），本程序使用 FAGLFLEXT（科目余额汇总级别）
- 模板的选择屏字段较多（凭证日期、凭证编号等），本程序简化为年度+期间+科目
- 模板使用 `set_screen_status( report = sy-repid )`，本程序修正为 `report = 'SAPLKKBL'`（硬约束）
