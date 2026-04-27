# Template Mapping — ZSAP_FI086A

## 参考模板

| 参考对象 | 状态 | 说明 |
|---------|------|------|
| ZSAP_FI244 | 不可用 | 默认模板目录 `templates/reference/ZSAP_FI244/` 已删除，本地无可用模板 |

## 本次采用方案

因无可用参考模板，采用 **标准 SAP ALV 报表三层 INCLUDE 结构**：

| 新对象 | 类型 | 用途 |
|--------|------|------|
| ZSAP_FI086A | PROG/P | 主程序（REPORT + 全局声明） |
| ZSAP_FI086AT01 | PROG/I | Top Include：数据声明、类型定义、常量 |
| ZSAP_FI086ASEL | PROG/I | Selection Include：选择屏幕定义 |
| ZSAP_FI086AF01 | PROG/I | Form Include：取数逻辑、ALV 展示、事件处理 |

## 保留/替换说明

- 骨架结构：标准 REPORT + INCLUDE 三层
- 选择屏：完全按 FS 字段契约定义
- 取数逻辑：按 tech-design.md 中的 Open SQL + 内表处理实现
- ALV：使用 `CL_SALV_TABLE`（SALV）或 `REUSE_ALV_GRID_DISPLAY`（函数组）
- 外币动态列：通过 `P_WAERS` 控制 `gt_fieldcat` 动态构建
