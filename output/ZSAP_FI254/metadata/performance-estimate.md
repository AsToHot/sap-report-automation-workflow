## 主查询性能预估

| 项 | 值 |
|---|---|
| 表名 | FAGLFLEXT |
| 预估行数 | 0（当前系统无数据） |
| WHERE 条件 | RBUKRS = 屏选公司代码 AND RYEAR = 屏选年度 AND RPMAX IN 屏选期间 AND RACCT IN 屏选科目 |
| 量级分类 | < 10,000 行（预估；当前系统为空） |
| 分页建议 | 无分页，全量 ALV |
| 索引分析 | FAGLFLEXT 主键包含 RYEAR, OBJNR00~08, DRCRK, RPMAX；WHERE 中 RBUKRS, RYEAR, RPMAX, RACCT 均有索引支撑 |
| 性能风险 | 无（汇总表，单表查询，维度字段均有键覆盖） |
