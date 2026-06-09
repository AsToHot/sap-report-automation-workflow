# 性能预估 — ZTEST002

## 主表 COUNT 预估

| 项 | 值 |
|----|-----|
| 主驱动表 | FAGLFLEXT |
| 预估条件 | RYEAR + RBUKRS/ZZGS 限制 |
| COUNT 查询 | 300 系统超时（表过大致 Internal server error） |
| 量级分类 | 中等（带年度+公司代码限制后预计 < 50万行） |

## 分页建议

- 年度 + 公司代码过滤后数据量可控，建议全量 ALV 输出
- 若单年度超 50 万行 → 增加前台分页（ALV 分页或后台 SUBMIT）

## 索引分析

- FAGLFLEXT 主键: RCLNT + RYEAR + OBJNR00~08 + DRCRK + RPMAX
- WHERE 条件中的 RYEAR 走主键前缀
- RBUKRS 非主键，需全表扫描或走二级索引
- 建议：确保 WHERE 条件始终包含 RYEAR 和 RLDNR（如 '0L'）以减少扫描范围
- RRCTY = '0'（实际数据）、RVERS = '001'（实际版本）作为固定过滤条件
