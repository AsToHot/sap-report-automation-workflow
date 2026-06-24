# Performance Estimate — ZTEST003

## 主表 COUNT 预估

| 项目 | 值 |
|------|-----|
| 主表 | FAGLFLEXT |
| WHERE 条件 | RRCTY = '0' AND RVERS = '001' |
| 预估行数 | **4,866** |
| 量级分类 | < 10,000（小数据量） |
| 分页建议 | 不需要分页，全量 ALV 输出 |

## 索引分析

FAGLFLEXT 主键：RCLNT + RYEAR + OBJNR00-08 + DRCRK + RPMAX（12 字段组合键）。
WHERE 条件中的 RYEAR 命中主键前缀，RRCTY/RVERS 为辅助过滤字段。

## 结论

数据量极小，无需分页或后台执行。在线 ALV 全量输出即可。
