# EE041 元数据拉取异常记录

- `getObjectSource /sap/bc/adt/ddic/tables/<tab>/source/main` 在当前系统对透明表返回不存在，已改用 `runQuery` + `DD03L` 方式获取字段。
- 根因定位：`DD03L` 多表批量/并发查询会触发间歇性 `Internal server error`；同样对象改为“单表串行 + COUNT 校验”后可稳定成功。
- 已按方案A修复并落盘：`SKAT`、`SKA1`、`CEPC`（见对应 JSON，`expected_count == fetched_count`）。
- 已按同策略继续修复并落盘：`CEPCT`、`CSKT`、`KNA1`、`LFA1`、`MAKT`、`MARA`、`T077X`（均 `expected_count == fetched_count`）。
- 仍失败对象（历史记录，见下方复盘修正）：
  - `T023T`、`ANLA`、`ANKT`、`ZSAP_FI179`、`ZFI032_DOC`、`ZSAP_FI054` 曾报 `Internal server error`。
- 本轮补充验证（按你要求改为完整 SQL）：
  - `tableContents` + 完整 `SELECT ... FROM DD03L WHERE TABNAME='T023T/ANLA' ORDER BY POSITION` 仍 `Internal server error`。
  - `runQuery` + 完整 `SELECT ... FROM DD03L WHERE TABNAME='ANKT/ZSAP_FI179/ZFI032_DOC/ZSAP_FI054' ORDER BY POSITION` 仍 `Internal server error`。
  - 结论：失败并非 `sqlQuery` 语法简写导致，而是这些对象在当前连接下的服务端访问异常（需 RFC 或系统侧授权/视图可见性处理）。
- 复盘修正（关键）：后续断点排查确认存在 `Session timed out`，重新 `login` 后 `ANLA`、`ZSAP_FI179` 查询恢复成功。该类故障应归类为“会话问题”，不是 SAP 业务表本身错误。
- 本轮复拉结果（先 `login` 再单表串行）：
  - 已成功补齐并落盘：`T023T`、`ANLA`、`ANKT`、`ZSAP_FI179`、`ZFI032_DOC`、`ZSAP_FI054`。
  - 结论：该批错误根因是会话过期，不是 SAP 表或 SQL 语法本身。
