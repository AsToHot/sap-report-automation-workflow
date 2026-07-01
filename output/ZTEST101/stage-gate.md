# ZTEST101 阶段门禁

| 阶段 | 状态 | 说明 |
|------|------|------|
| S0=permission-check | yes | test_rfc.js 通过，双系统连通 |
| S1=functional-spec-ready | yes | spec/functional-spec-ai.md 已生成 |
| S1.5=object-name-confirmed | yes | ZTEST101 在 SAP 中不存在 |
| S2=metadata-ready | yes | 6 张表 metadata JSON 已落盘 |
| S2.1=fs-ddic-verified | yes | 已验证，3 处关键修正（KTOPL=EEKA, HKONT_FY, TRADEDATE 格式） |
| S2.5=performance-estimate-ready | yes | <100 行，全量 ALV |
| S3=tech-design-ready | yes | docs/tech-design.md 含字段契约+选择屏幕角色分析 |
| S3.5=fs-coverage-ready | yes | 覆盖全部输出列 |
| S3.6=deployment-config-ready | yes | docs/deployment-config.md，$TMP 本地包 |
| S4=code-generated | yes | 4 个 ABAP 文件，ASSIGN COMPONENT 字段名已对齐+6 轮自检通过 |
| S5=activated | yes | deploy_rfc.js 成功，4 个对象激活无错误 |
| S5.5=smoke-test-passed | yes | 2 公司代码 + 3 参数组合 + 12 应交金额列全部通过；申报金额受 SKA1 数据限制（已记录） |
