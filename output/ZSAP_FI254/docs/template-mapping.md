# 模板映射 — ZSAP_FI254

## 参考对象

| 参考对象 | 路径 |
|---------|------|
| 主程序 | templates/reference/ZSAP_FI244/ZSAP_FI244.abap |
| TOP 包含 | templates/reference/ZSAP_FI244/ZSAP_FI244T01.abap |
| 选择屏幕 | templates/reference/ZSAP_FI244/ZSAP_FI244SEL.abap |
| 子程序 | templates/reference/ZSAP_FI244/ZSAP_FI244F01.abap |

## 新对象

| 新对象 | 输出路径 |
|--------|---------|
| 主程序 | output/ZSAP_FI254/abap/sources/ZSAP_FI254.abap |
| TOP 包含 | output/ZSAP_FI254/abap/sources/ZSAP_FI254T01.abap |
| 选择屏幕 | output/ZSAP_FI254/abap/sources/ZSAP_FI254SEL.abap |
| 子程序 | output/ZSAP_FI254/abap/sources/ZSAP_FI254F01.abap |

## 保留/替换说明

| 项目 | 保留/替换 | 说明 |
|------|----------|------|
| 程序骨架（REPORT + INCLUDE） | 保留 | 与模板完全一致 |
| 数据定义结构 | 替换 | 从序时账字段替换为科目余额表字段 |
| 选择屏幕字段 | 替换 | 从序时账条件替换为科目余额条件 |
| Open SQL 主查询 | 替换 | 从 BKPF+BSEG+FAGLFLEXA 替换为 FAGLFLEXT |
| ALV 列定义 | 替换 | 从序时账列替换为科目余额列 |
| 双击跳转逻辑 | 替换 | 移除 FB03 跳转（余额表无凭证跳转需求） |
| 工具栏事件 | 保留 | 保留 on_user_command / on_double_click 框架 |
| SET_COLUMN 辅助 Form | 保留 | 通用 ALV 列设置逻辑复用 |
