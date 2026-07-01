# FS→DDIC 字段交叉验证报告

## 验证日期
2026-07-01

## 验证概要

| 表名 | FS 引用字段数 | 存在 | 不匹配 | 语义偏差 |
|------|-------------|------|--------|---------|
| ZSAP_BUKRS | 5 | 5 | 0 | 0 |
| FAGLFLEXT | 4 | 4 | 0 | 1 |
| CEPC | 3 | 3 | 0 | 0 |
| ZSAP_FI054 | 4 | 3 | 2 | 2 |
| SKA1 | 4 | 4 | 1 | 1 |
| SKAT | 2 | 2 | 0 | 0 |

## 逐表字段验证

### ZSAP_BUKRS ✅

| FS 字段 | DDIC 字段 | DATATYPE | LENG | 存在 | 备注 |
|---------|----------|----------|------|------|------|
| BUKRS | BUKRS | CHAR | 4 | ✅ | 主键之一 |
| ZFGS | ZFGS | CHAR | 1 | ✅ | 空=直用BUKRS，非空=用ZZGS |
| ZZGS | ZZGS | CHAR | 4 | ✅ | 子公司映射码 |
| PRCTR | PRCTR | CHAR | 10 | ✅ | 利润中心 |
| LTEXT | LTEXT | CHAR | 40 | ✅ | 机构名称（另有 BUTXT CHAR 25） |

**数据验证**：11 条记录，全部 ZFGS=''（无不映射），PRCTR 格式为 Zxxxx（如 Z6010）。

### FAGLFLEXT ✅ (语义修正 1 项)

| FS 字段 | DDIC 字段 | DATATYPE | LENG | 存在 | 备注 |
|---------|----------|----------|------|------|------|
| RYEAR | RYEAR | NUMC | 4 | ✅ | |
| RBUKRS | RBUKRS | CHAR | 4 | ✅ | |
| RACCT | RACCT | CHAR | 10 | ✅ | |
| RPMAX | RPMAX | NUMC | 3 | ✅ | 期间号 1~16 |
| PRCTR | PRCTR | CHAR | 10 | ✅ | FS 未直接列出但逻辑需要 |
| DRCRK | DRCRK | CHAR | 1 | ✅ | S=借方 H=贷方 |
| HSL01~HSL16 | HSL01~HSL16 | CURR | 23,2 | ✅ | 本位币各期金额 |
| HSLVT | HSLVT | CURR | 23,2 | ✅ | 本位币总额 |

**⚠️ 语义修正**：DRCRK='S' 表示借记，金额为正数（非 SAP 标准科目余额的借正贷负语义）。实际数据验证：FAGLFLEXT 中 DRCRK='S' 且 HSL03=10000，金额为正 → 应交税金在借方（正常负债类科目）。

### CEPC ✅

| FS 字段 | DDIC 字段 | DATATYPE | LENG | 存在 | 备注 |
|---------|----------|----------|------|------|------|
| PRCTR | PRCTR | CHAR | 10 | ✅ | 主键 |
| KHINR | KHINR | CHAR | 12 | ✅ | 层次结构 |
| DATBI | DATBI | DATS | 8 | ✅ | 有效期至 |
| KOKRS | KOKRS | CHAR | 4 | ✅ | 控制范围 |

### ZSAP_FI054 ⚠️ (字段名不匹配 2 项)

| FS 字段 | DDIC 字段 | DATATYPE | LENG | 存在 | 备注 |
|---------|----------|----------|------|------|------|
| ~~KONT_FY~~ | **HKONT_FY** | CHAR | 10 | ⚠️ | **FS 写 KONT_FY，实际为 HKONT_FY** |
| TRADEDATE | TRADEDATE | CHAR | 64 | ⚠️ | CHAR 非 DATS；税务数据为 YYYYMMDD 格式 |
| AMOUNT | AMOUNT | CURR | 15,2 | ✅ | |
| OURBANKACCOUNTNUMBER | OURBANKACCOUNTNUMBER | CHAR | 64 | ✅ | |
| BUKRS | BUKRS | CHAR | 4 | ✅ | 公司代码（多数为空，仅税务数据有值） |

**⚠️ 字段名修正**：
1. FS 写 `ZSAP_FI054-KONT_FY` → 实际 DDIC 字段为 `HKONT_FY`（CHAR 10，描述"总帐"）
2. FS 写 `TRADEDATE` 日期过滤，实际为 CHAR(64) 格式：税务数据行使用 YYYYMMDD（如"20260301"），非税数据行使用 YYYY-MM-DD（如"2026-06-05"）

**⚠️ 数据量修正**：仅 10/10250 条记录有 HKONT_FY 非空，覆盖全部 6 个税种科目。

### SKA1 ⚠️ (KTOPL 值不匹配)

| FS 字段 | DDIC 字段 | DATATYPE | LENG | 存在 | 备注 |
|---------|----------|----------|------|------|------|
| KTOPL | KTOPL | CHAR | 4 | ✅ | |
| ZBUKRS | ZBUKRS | CHAR | 4 | ⚠️ | DDIC 标注 DATS(4) 疑误，实际为 CHAR/BUKRS |
| ZFKYH | ZFKYH | CHAR | 64 | ✅ | 银行账户号 |
| SAKNR | SAKNR | CHAR | 10 | ✅ | 科目号 |

**⚠️ 关键修正**：FS 写 `KTOPL="SKA1"`，但 SKA1 中不存在 `KTOPL='SKA1'`。实际应使用 `KTOPL='EEKA'`（1,270 条，与 KOKRS='EEKA' 一致）。KTOPL='EEKA' 有 ZFKYH 非空记录。

### SKAT ✅

| FS 字段 | DDIC 字段 | DATATYPE | LENG | 存在 | 备注 |
|---------|----------|----------|------|------|------|
| SPRAS | SPRAS | LANG | 1 | ✅ | **必须用 '1' 非 'ZH'** |
| TXT50 | TXT50 | CHAR | 50 | ✅ | 科目描述 |

## 修正汇总

| # | 严重度 | 描述 | 修正方案 |
|---|--------|------|---------|
| 1 | **HIGH** | KTOPL='SKA1' 不存在，应为 'EEKA' | 代码中使用 `KTOPL = 'EEKA'` |
| 2 | **HIGH** | FS 字段名 KONT_FY 不存在，应为 HKONT_FY | 代码中使用 `HKONT_FY` |
| 3 | MEDIUM | TRADEDATE 为 CHAR 非 DATS | 字符串比较 YYYYMMDD 范围（如 `>= '20260301' AND <= '20260630'`） |
| 4 | MEDIUM | 仅 ~10 条有税务数据 | 申报金额可能为 0，校验列标注原因 |
| 5 | LOW | SKA1-ZBUKRS DDIC 标注 DATS(4) | 按 CHAR(4) 使用即可 |

## 门禁判定

**S2.1 = yes** — 全部字段存在性已验证，语义偏差已标注修正方案，可进入 S3。
