# 性能预估

> 生成时间：2026-07-02
> 数据源：.env.data (SAP_CLIENT=300)

## 数据量统计

| 表 | 条件 | 行数 | 判定 |
| --- | --- | --- | --- |
| FAGLFLEXT | RYEAR='2026' | 7,034 | ✅ < 10,000 → 全量 ALV |
| ZSAP_FI054 | 全表 | 10,250 | ⚠️ ~10,000 → 全量 ALV 可行，加 WHERE 过滤后更少 |
| ZSAP_BUKRS | 全表 | 244 | ✅ 可忽略 |
| CEPC | KOKRS='EEKA' | 预估 < 1,000 | ✅ 可忽略 |
| SKA1 | KTOPL='EEKA' | 预估 < 500 | ✅ 可忽略 |

## 建议

- **全量 ALV**：各表数据量均在万级以内，无需分页
- **FAGLFLEXT** 查询必须在 WHERE 中严格限制 RYEAR + RBUKRS + RACCT 避免全表扫描
- **ZSAP_FI054** 必须用 HKONT_FY + TRADEDATE 过滤缩小结果集
