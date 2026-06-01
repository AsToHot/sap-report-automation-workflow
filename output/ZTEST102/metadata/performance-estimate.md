# Performance Estimate - ZTEST102

## 主表预估

| 项目 | 值 |
|------|-----|
| 主表 | FAGLFLEXA |
| 关键 WHERE 条件 | RBUKRS IN (选择屏公司代码), RYEAR = 选择屏年度, POPER = 选择屏期间 |
| 索引情况 | 主键含 RCLNT+RYEAR+DOCNR+RLDNR+RBUKRS+DOCLN，RBUKRS+RYEAR 可走主键前缀 |
| 数据量级 | 中等（取决于公司代码和期间范围） |
| 分页建议 | 单期间数据通常 < 100,000 行，适合在线 ALV 全量输出 |
| 性能风险 | BSEG JOIN 可能放大行数（一对多），建议先取 FAGLFLEXA 再按需 JOIN BSEG |

## 建议策略

- 主查询：FAGLFLEXA + BKPF INNER JOIN（按凭证头过滤）
- BSEG 左连接获取行项目详情
- 所有 LOOKUP 表（LFA1/KNA1/SKAT 等）通过应用层 READ TABLE 获取（非 SQL JOIN）
- 执行后写入 ZSAP_FI179 采用 MODIFY（存在则更新，不存在则插入）
