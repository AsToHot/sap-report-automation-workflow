# ZTEST101 部署配置

## 基本信息

| 项目 | 值 |
|------|-----|
| 程序名 | ZTEST101 |
| 目标包 | $TMP |
| 传输请求 | — |
| 程序描述 | 报税取数稽核报表（EE090） |
| 对象类型 | PROG/P（可执行报表） |
| 开发包 | $TMP（本地包，无需传输请求） |

## 模板选择

| INCLUDE | 模板参考 | 说明 |
|---------|---------|------|
| ZTEST101.abap | ZSAP_FI244.abap | 主程序骨架（REPORT + INIT + START-OF-SELECTION） |
| ZTEST101T01.abap | ZSAP_FI244T01.abap | 全局数据定义、ALV 引用、类型定义 |
| ZTEST101SEL.abap | ZSAP_FI244SEL.abap | 选择屏幕（简化为 3 个参数） |
| ZTEST101F01.abap | ZSAP_FI244F01.abap | 取数逻辑 + ALV 显示（适配本报表逻辑） |

## 与模板的差异

| 差异项 | 模板 ZSAP_FI244 | ZTEST101 |
|-------|----------------|----------|
| GUI Status | set_screen_status + S1000 | 无（SALV 默认工具栏） |
| 数据源 | BKPF+BSEG+FAGLFLEXA（凭证级） | FAGLFLEXT（汇总级）+ ZSAP_FI054 |
| 事件处理 | 双击跳转 FB03 | 无（汇总表无需跳转） |
| 选择屏幕参数 | 19 个参数/选择项 | 3 个参数/选择项 |
| ALV 列数 | ~25 列 | 20 列（1+1+6*3） |

## 部署计划

1. 创建主程序 ZTEST101
2. Lock → Upload ZTEST101.abap
3. 创建 Include ZTEST101T01 → Lock → Upload → Unlock
4. 创建 Include ZTEST101SEL → Lock → Upload → Unlock
5. 创建 Include ZTEST101F01 → Lock → Upload → Unlock
6. 语法检查全部文件
7. 激活全部对象
8. 冒烟测试
