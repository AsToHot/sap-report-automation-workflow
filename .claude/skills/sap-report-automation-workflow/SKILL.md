---
name: sap-report-automation-workflow
version: 2.0
description: |
  End-to-end SAP ABAP 开发对象自动化——通过 node-rfc 直连 SADT_REST_RFC_ENDPOINT 调用 RFC ADT API。支持 REPORT/CLAS/FUGR/INTF/Include 全部对象类型。FS 规范化→DDIC 元数据→技术文档→按模板写 ABAP→激活循环。所有 SAP 操作统一走 `scripts/rfc_client.js`（查询）和 `scripts/deploy_rfc.js`（部署）。语法速查 [abap-syntax-quickref.md](abap-syntax-quickref.md)，卡点速查 [troubleshooting.md](troubleshooting.md)。
---

# SAP ABAP 开发对象自动化工作流（FS → 元数据 → 设计文档 → 代码 → 激活）

支持对象类型（阶段 1.5 确认）：**REPORT**、**CLAS**、**FUGR**（含 Function Module）、**INTF**、**PROG/I**（Include）。

## 连接架构

```
Claude Code → Bash → node scripts/rfc_client.js → node-rfc → SADT_REST_RFC_ENDPOINT → SAP
Claude Code → Bash → node scripts/deploy_rfc.js → node-rfc → SADT_REST_RFC_ENDPOINT → SAP
```

所有 SAP 操作通过统一 RFC 客户端 `scripts/rfc_client.js`（通用查询）和 `scripts/deploy_rfc.js`（部署编排）直连。不再使用 MCP/HTTP 代理中间层。

## 阶段间强引用（元数据驱动；禁止凭语感写 Open SQL）

后续阶段**必须显式引用前序产物**，禁止凭记忆拼字段名/表名/JOIN 条件：

| 消费方 | 必须参照的输入 | 规则 |
|--------|--------------|------|
| `docs/tech-design.md` | `spec/functional-spec-ai.md` + `metadata/tables/*.json` | 每个物理字段须在元数据中可核对 |
| ABAP（Open SQL、内表） | `docs/tech-design.md` 的「字段契约」+ `metadata/tables/*.json` | SELECT/JOIN/WHERE 字段名必须来自契约或元数据 |
| ALV 列 / 内表组件 | 同上 | 列名与契约一致，计算列在契约中写清公式 |

**字段契约（阶段 3 必写）**：`docs/tech-design.md` 中至少包含：

| 逻辑项 | 表名 | 字段名 | 元数据文件 |
|--------|------|--------|------------|
| … | BKPF | BUKRS | output/<program>/metadata/tables/BKPF.json |

## 代理自主执行协议

代理在**同一任务内**按阶段 **0→1→1.5→2→2.1→2.5→3→3.5→3.6→4→5→5.5 顺序自动跑完**，仅在缺关键输入、SAP 不可达、或达重试上限时停顿。

**硬门禁**（除非用户明确说跳过）：
0. `test_rfc.js` 未通过 → 禁止进入阶段 1。代理必须指导用户完成 NW RFC SDK 安装和 `.env` 配置。
1. 无 `functional-spec-ai.md` → 禁止写 ABAP、禁止部署。
2. 无 metadata JSON 落盘 → 禁止进入阶段 2.1。
2.1. `fs-ddic-verification.md` 有语义偏差未修正 → 禁止进入阶段 3。
3. 无 `tech-design.md`（含字段契约+选择屏幕角色分析）→ 禁止进入阶段 4。
4. 阶段 4–5 必须实际调用 SAP，失败时自动修错循环直至成功或达上限。

**Preflight Gate**：任何 SAP 写操作前，必须确认 `stage-gate.md` 中 S0→S3.6 全部为 `yes`。禁止在门禁未通过时调 `deploy_rfc.js` 或任何写操作。

受阻时**先查 [troubleshooting.md](troubleshooting.md)**，按"预判→预防→应对"处理。

---
## 阶段 0：RFC 环境验证与连接

**代理自动执行诊断，仅凭据和系统级依赖缺时打断用户**。

### 0.1 环境探测

```bash
node scripts/test_rfc.js
```

通过 → 继续。失败 → 按输出分类诊断（DLL 缺失 / 环境变量 / 网络不通），指导用户修复。

**唯一允许打断用户的**：Node.js 安装、NW RFC SDK 安装、SAP 连接凭据。

### 0.2 `.env` 配置（6 个字段）

| 字段 | 必需 | 说明 |
|------|------|------|
| `SAP_URL` | 是 | SAP 主机地址，如 `http://10.32.21.11:8000` |
| `SAP_CLIENT` | 是 | 客户端号（开发=200，数据=300） |
| **`SAP_SYSNR`** | **是** | RFC 实例号——**不可依赖端口推导** |
| `SAP_USERNAME` | 是 | 开发账号 |
| `SAP_PASSWORD` | 是 | 密码 |
| `SAP_ROUTER` | 否 | Router 字符串（内网穿透） |

**双系统配置**：开发系统 `.env`（SAP_CLIENT=200），数据系统 `.env.data`（SAP_CLIENT=300）。二者 SAP_SYSNR 通常相同。

代理写入配置文件后**不启动任何后台进程**——`rfc_client.js` 每次执行时自动连接、执行、断开。

### 0.3 连通验证

```bash
# 一键双系统检测
node scripts/rfc_dual_check.js
```

两个系统都 `"ok": true` → 已就绪。任一失败 → 按 [troubleshooting.md](troubleshooting.md) §4 排查。

### 0.4 双系统架构（硬约束）

| 配置文件 | 用途 | SAP_CLIENT |
|---------|------|-----------|
| `.env` | 开发：创建/修改/激活/语法检查 | 200 |
| `.env.data` | 数据：runQuery/tableContents | 300 |

**三条死线**：
1. **禁止**用开发系统查业务表数据 → 开发机可能无数据
2. **禁止**把 `.env` 客户端改成数据系统客户端 → 部署会落到数据机
3. **禁止**因查不到数据而反复重写代码 → 先用 `--env=.env.data` 确认数据存在

### 0.5 权限前置探测

```bash
# 开发权限探针
node scripts/rfc_client.js --sql "SELECT COUNT(*) AS CNT FROM TADIR WHERE PGMID EQ 'R3TR' AND OBJECT EQ 'PROG'" --table TADIR

# 包权限探针（用户提供包名后）
node scripts/rfc_client.js --search "<包名>" --type DEVC
```

记录到 `stage-gate.md` 的 `S0=permission-check`。

### 0.6 切换 SAP 系统

用户说「换系统/切客户端/改密码」→ 更新对应 `.env` 文件 → 重新执行 0.3 连通验证。无需重启任何进程。

---
## 阶段 1：获取 FS → 规范化为 AI 可读的功能文件

### 1.0 获取 FS

代理一次性询问 FS 来源：A.粘贴文本 / B.提供文件路径(.docx/.txt/.md) / C.文件夹 / D.口头描述。

若用户提供 `.docx` 文件，用 `extract-docx.js` 提取文本：

```bash
node scripts/extract-docx.js "<路径>"
```

### 1.1 规范化 FS

套用 [templates/functional-spec-ai.md](templates/functional-spec-ai.md)，必须包含：业务目标与对象类型、选择条件（REPORT）/方法签名（CLASS/INTF/FUGR）、输出列与来源表字段、透明表清单、权限/性能/变式约束。表名一律大写。

**S1 门禁**：FS 中每个表名可在 DDIC 中查到；SPRAS 字段标注为 LANG(1) 不得写 `'ZH'`；输出列无 TBD。

---
## 阶段 1.5：对象名确认与 SAP 存在性检查

### 1.5.1 确定对象名与类型

| 对象类型 | ADT 码 | 命名约定 | 示例 |
|---------|--------|---------|------|
| 可执行报表 | `PROG/P` | `ZSAP_xxx` / `ZFI_xxx` | `ZSAP_FI086` |
| Include | `PROG/I` | `ZSAP_xxxT01` / `ZSAP_xxxF01` | `ZSAP_FI086T01` |
| 全局类 | `CLAS` | `ZCL_xxx` | `ZCL_FI_UTILITY` |
| 函数组 | `FUGR` | `ZFG_xxx` | `ZFG_FI_TOOLS` |
| 接口 | `INTF` | `ZIF_xxx` | `ZIF_FI_DATA_ACCESS` |

### 1.5.2 SAP 存在性检查

```bash
# 查主对象 + 所有 Include
node scripts/rfc_client.js --search "ZSAP_FI086"
node scripts/rfc_client.js --search "ZSAP_FI086T01"
```

已存在 → **立即停止**，报告对象名/类型，让用户重新提供或书面确认覆盖。**禁止**代理擅自改对象名或跳过。均不存在 → `[OK]`，继续阶段 2。

**S1.5 门禁**：全部对象名在 SAP 中均不存在，或用户已书面确认覆盖。

---
## 阶段 2：透明表 DDIC 元数据

### 2.0 Z 表也必须拉 DDIC

首选封装脚本（一键完成取数 + JSON 落盘）：

```bash
node scripts/rfc_fetch_ddic.js --env=.env.data <TABNAME> output/<program>/metadata/tables/
```

备选手工路径（脚本不可用时）：

```bash
node scripts/rfc_client.js --env=.env.data --rows=2000 \
  --sql "SELECT FIELDNAME, POSITION, KEYFLAG, ROLLNAME, DATATYPE, LENG, DECIMALS FROM DD03L WHERE TABNAME EQ '<T>' ORDER BY POSITION" \
  --table DD03L
```

1. 每表串行拉取
2. `fetched_count` 为 0 时自动重试最多 3 次
3. 每表独立落盘 `metadata/tables/<TABNAME>.json`
4. 失败切备选路径（`--source` → 兜底 RFC），三种均尝试完毕才记入 `_errors.md`

---
## 阶段 2.1：FS → DDIC 字段交叉验证（强制）

> **硬约束**：业务人员写 FS 时可能写错字段名或误解字段语义。metadata JSON 落盘后必须立即逐字段对照验证，禁止盲目信任 FS。

### 2.1.1 验证内容

对 `functional-spec-ai.md` 中引用的每个 `表.字段`：
1. **存在性**：字段在 DD03L 中确实存在
2. **类型**：数据类型匹配预期使用方式
3. **语义**：字段的实际含义与 FS 描述一致（重点：SELECT-OPTIONS 的字段是真正的过滤字段还是参考字段）
4. **字面值陷阱**：SPRAS=LANG(1) 强制 `'1'` 非 `'ZH'`；DATS 格式 `'YYYYMMDD'`
5. **符号约定**（新增）：金额列需逐列确认 FS 中定义的是绝对值还是带符号值——SAP 中 DRCRK='H' 的金额通常存为负数，若 FS 按绝对值描述则代码需额外处理。**验证方法**：取一行真实数据，检查 DRCRK='S' vs 'H' 的实际符号，与 FS 描述对照，在 tech-design.md 字段契约中标注每列的符号来源

### 2.1.2 验证输出

落盘 `spec/fs-ddic-verification.md`：每表每字段一行，标注存在性+类型+语义审查结果。不通过项标注为 TBD，等用户澄清后再进入 S3。

**S2.1 门禁**：全部 FS 引用字段在 DDIC 中存在；语义偏差已标注并修正（或用户确认）；`fs-ddic-verification.md` 已落盘。

---
### 2.5 性能预估

对主驱动表执行 COUNT：
```bash
node scripts/rfc_client.js --env=.env.data \
  --sql "SELECT COUNT(*) AS CNT FROM <主表> WHERE <最严格条件>" --table <主表>
```

- `< 10,000` → 全量 ALV
- `10,000 ~ 1,000,000` → 建议分页
- `> 1,000,000` → 必须后台执行

结果写入 `performance-estimate.md`。

**S2 门禁**：每张表有 metadata JSON 且 `matched=true`；`performance-estimate.md` 已生成；多期金额表已通过数据系统取一行真实数据确认分布方式。

---
## 阶段 3：技术文档 `docs/tech-design.md`

必须包含：**字段契约**（FS 列/表.字段/metadata 溯源）、表清单、关联路径、取数逻辑、**选择屏幕字段角色分析**（四角色分类）、ALV 布局、性能设计（内表类型/嵌套 LOOP 替代/WHERE 排列/数据量预估）。

### 选择屏幕字段角色分析（强制）

> **硬约束**：每个选择屏幕字段必须先确定为四角色之一再决定使用方式，禁止默认全部塞入 WHERE。

| 角色 | 说明 | 示例 | 使用方式 |
|------|------|------|----------|
| **WHERE 过滤** | 直接过滤主表行 | P_RYEAR、S_RACCT | 放入 FAGLFLEXT SELECT 的 WHERE 子句 |
| **映射键** | 需经中间表转换 | P_BUKRS | 先查 ZSAP_BUKRS 得到 RBUKRS，再用于 WHERE |
| **计算参数** | 不过滤行，决定聚合范围 | S_RPMAX | 不出现于 WHERE；决定 HSL{start}~HSL{end} 索引范围 |
| **显示控制** | 不影响取数，控制输出 | P_FORCUR | 控制 ALV 列 visible/technical |

**S3 门禁**：`tech-design.md` 含字段契约 + 选择屏幕字段角色分析表；`fs-coverage.md` 覆盖全部输出列；`template-mapping.md` 列出新旧 INCLUDE 对应；`deployment-config.md` 已生成。

---
## 阶段 3.5：FS 对齐审查 `docs/fs-coverage.md`

| FS 逻辑项 | 输出字段 | 契约字段（表.字段） | 元数据文件 | 代码落点 | 状态 |
|-----------|---------|-------------------|-----------|---------|------|

FS 中每个输出列/选择条件都必须出现一行。阶段 5 前做反查：从最终代码回填确认无遗漏。

---
## 阶段 3.6：部署配置 `docs/deployment-config.md`

确认三项并落盘：
- **开发包**：用户提供或默认 `$TMP`（本地包无需传输请求）
- **传输请求**：仅非 `$TMP` 时需要
- **模板选择**：优先 `templates/reference/<对象名>/`，其次默认模板，无模板用 quickref 骨架

**S3.6 门禁**：`deployment-config.md` 已生成，包/请求号/模板状态明确。

---
## 阶段 4：按类型生成代码

> **语法硬约束**：以 [abap-syntax-quickref.md](abap-syntax-quickref.md) 为参考，禁止凭记忆写语法。

### 4.0 对象类型分发

| 类型 | 代码文件 | 参考模板 |
|------|---------|---------|
| **REPORT** | 主程序 + T01/SEL/F01 分层 | `templates/reference/ZSAP_FI244/` |
| **CLAS** | `zcl_xxx.clas.abap`（单文件） | quickref §11 |
| **INTF** | `zif_xxx.intf.abap` | quickref §12 |
| **FUGR** | 函数组主文件 + 各 FM 文件 | quickref §13 |

### REPORT 生成

1. 打开 `tech-design.md` → `metadata/tables/*.json` → `abap-syntax-quickref.md`
2. INCLUDE 分层强约束：主程序 + T01/SEL/F01/O01 保持模板结构
3. 生成前先写 `template-mapping.md`
4. 反模式自检通过（见 §4.9）

**GUI Status**：`CL_SALV_TABLE` 使用 `report = 'SAPLKKBL'`，**不能**是 `sy-repid`。

### CLASS/INTF/FUGR 生成

按 quickref §11–13 骨架。FM 参数用 ABAP 原生语法（`FUNCTION ... IMPORTING/EXPORTING ... ENDFUNCTION`），**禁止** `*"*"` 注释块格式。

### 4.9 通用反模式自检（6 轮，强制）

代码写入后、部署前，逐轮检查（详见 [abap-syntax-quickref.md](abap-syntax-quickref.md) §14）：

**第负一轮 — ASSIGN COMPONENT**：扫描每个 `ASSIGN COMPONENT`，对照 metadata JSON 确认拼接变量 DATATYPE/LENG；NUMC 类型确认字段名长度匹配；每个后有 `sy-subrc` 检查。

**第零轮 — DDIC 字面值**：扫描所有字面值对照 metadata LENG。重点陷阱：`SPRAS`(LANG, LENG=1) 必须用 `'1'` 非 `'ZH'`。

**第一~五轮**：DB → WHERE → 内表 → 控制流 → 其他规范（无 Hard Coding/有 AUTHORITY-CHECK）。

任一轮未通过 → 修正源码后再继续。

**S4 门禁**：ASSIGN COMPONENT 字段名对齐 + 6 轮自检通过 + 源码结构与 template-mapping.md 一致 + **选择屏幕文本已设置**。

---
## 选择屏幕文本元素处理

> 选择屏幕参数/选择项的中文标签通过以下两种运行时方法设置，无需 SE32 文本元素。
> 来源：`spec/选择屏幕文本元素处理方式.pdf`

### 方法一：直接赋值（单参数，最简单）

```abap
AT SELECTION-SCREEN OUTPUT.
  %_p_param_%_app_%-text = '参数标签'.
  %_s_selopt_%_app_%-text = '选择项标签'.
```

格式：`%_<名>_%_app_%-text`，其中 `<名>` 为 PARAMETERS 或 SELECT-OPTIONS 的名称（**大写**）。

### 方法二：SELECTION_TEXTS_MODIFY FM（多参数，推荐）

```abap
FORM modify_sel_texts.
  DATA lt_sel TYPE TABLE OF rsseltexts.
  DATA ls_sel TYPE rsseltexts.

  ls_sel-name = 'P_BUKRS'.
  ls_sel-kind = 'P'.           " P=PARAMETERS, S=SELECT-OPTIONS
  ls_sel-text = '公司代码'.
  APPEND ls_sel TO lt_sel[].

  CALL FUNCTION 'SELECTION_TEXTS_MODIFY'
    EXPORTING
      program                     = sy-repid
    TABLES
      seltexts                    = lt_sel
    EXCEPTIONS
      program_not_found           = 1
      program_cannot_be_generated = 2
      OTHERS                      = 3.
  IF sy-subrc <> 0.
    MESSAGE ID sy-msgid TYPE sy-msgty NUMBER sy-msgno
            WITH sy-msgv1 sy-msgv2 sy-msgv3 sy-msgv4.
  ENDIF.
ENDFORM.
```

**调用**（在主程序的 `AT SELECTION-SCREEN OUTPUT` 中）：

```abap
AT SELECTION-SCREEN OUTPUT.
  PERFORM modify_sel_texts.
```

### 约束

- `ls_sel-name` 必须与 PARAMETERS / SELECT-OPTIONS 声明名**大写完全一致**
- `ls_sel-kind`：`'P'` = PARAMETERS，`'S'` = SELECT-OPTIONS
- **ADT 部署优先用方法一**（`%_xxx_%_app_%-text`）：方法二将 FORM 放在 INCLUDE 中，更新部署时 ADT 激活可能因 INCLUDE 解析先后顺序找不到 FORM。方法一直接在主程序 `AT SELECTION-SCREEN OUTPUT` 中赋值，无此问题
- SELECTION-SCREEN BLOCK 的 `TITLE TEXT-xxx` 不适用上述两种方法；用 `WITH FRAME` 不加 TITLE 即可

---
## 阶段门禁产物验证

每阶段完成落盘 `stage-gate.md`：
```markdown
S0=permission-check: yes/no
S1=functional-spec-ready: yes/no
S1.5=object-name-confirmed: yes/no
S2=metadata-ready: yes/no
S2.1=fs-ddic-verified: yes/no
S2.5=performance-estimate-ready: yes/no
S3=tech-design-ready: yes/no
S3.5=fs-coverage-ready: yes/no
S3.6=deployment-config-ready: yes/no
S4=code-generated: yes/no
S5=activated: yes/no
S5.5=smoke-test-passed: yes/no
```

每阶段门禁通过后自动 `git add + git commit`，格式 `[SAP-WF] 阶段X: 简述产物`。

---
## 阶段 5：部署与激活

走 `scripts/deploy_rfc.js`（直连 RFC → SADT_REST_RFC_ENDPOINT）。

### 5.0 部署前复核

1. 阶段 1.5 的 `--search` 结果已记录，程序名一致
2. Include 名复核
3. `stage-gate.md` 中 S3.6=yes

### 5.1 脚本部署

```bash
node scripts/deploy_rfc.js <program>
```

自动完成：创建主程序 → Lock → 上传源码 → 创建 Include → 逐个 Lock/Upload/Unlock → 语法检查 → 激活 → 检查激活结果。

- 语法检查有错误 → **立即停止**，禁止激活
- 激活结果必须解析 `<msg type="E|A">`、`<atom:entry>`、`<entry>` 三种格式
- HTTP 200 ≠ 成功——必须解析响应体

### 5.2 锁管理

Lock Handle 持久化到 `.locks/<name>.json`。残留锁用 `scripts/release_locks.js` 清理。

**S5 门禁**：部署成功，激活无错误。

---
## 阶段 5.5：冒烟测试（激活后强制，不可跳过）

> **执行范式强制参照**：[smoke-test-procedure.md](smoke-test-procedure.md)——含入参矩阵、手工计算步骤、逐字段比对脚本模板。

### 硬门禁（代理不得自行跳过）

1. **禁止**在 `ZREPORT_EXEC_VERIFY` FM 不存在或不返回 `EV_SUCCESS='X'` 时标记 S5.5=yes
2. **禁止**仅跑一次 `verify_report.js` 看返回码即通过
3. **禁止**源表数据全零时不标注"数据全零，计算逻辑待补充验证"即通过
4. **禁止**仅比对金额列；描述列（TXT50/ZFZHS/ZFZTX/ZYJKM）也必须逐列比对
5. **必须**≥2 个不同公司代码、≥3 组参数组合、≥8 个金额列逐列 0.01 容差匹配
6. `smoke-test.md` 落盘路径为 `output/<程序>/smoke-test.md`（**非** docs/ 子目录）

### 5.5.1 数据抽样（fetch_table.js 统一入口——DDIC 端点，WHERE 可靠）

```bash
# 通用取数（走 DDIC 端点 /sap/bc/adt/datapreview/ddic，WHERE 可靠过滤）
node scripts/fetch_table.js --table=FAGLFLEXT \
  --fields=RYEAR,RBUKRS,RACCT,RPMAX,DRCRK,HSLVT,HSL01,HSL02,HSL03,HSL04 \
  --where="RYEAR = '2026' AND RBUKRS = '80K0' AND RACCT = '1002000001'" \
  --rows=50

# data_sampler.js 已重构为 fetch_table.js 的薄包装，参数格式兼容
node scripts/data_sampler.js "--table=FAGLFLEXT" "--where=RYEAR = '2026'" "--fields=RACCT,DRCRK" "--rows=50"
```

入参：`--table` / `--where` / `--fields` / `--rows` / `--env`
出参：JSON `{ table, where, rowCount, columns, rows, _validation: { passed, failures[] } }`

> **硬约束**：取数后必须检查 `_validation.passed`，任意字段不匹配 WHERE 条件则立即阻断。禁止在取数失败/过滤错误时继续后续步骤。

### 5.5.2 公司代码选择（强制步骤）

```bash
# 1. 找有数据的公司代码
node scripts/data_sampler.js "--table=FAGLFLEXT" "--where=RYEAR = '2026'" "--rows=5"
# 2. 查 ZSAP_BUKRS 映射（ZFGS/ZZGS）
node scripts/data_sampler.js "--table=ZSAP_BUKRS" "--fields=BUKRS,ZFGS,ZZGS" "--rows=100"
# 3. 确定有效 BUKRS（ZFGS=''→BUKRS; ZFGS≠''→ZZGS）
# 4. 验证有效 BUKRS 在 FAGLFLEXT 中有数据
```

### 5.5.3 报表执行校验

```bash
node scripts/verify_report.js <程序名> P_xxx=<值> "S_xxx=低-高,低-高"
```

**前提**：`ZREPORT_EXEC_VERIFY` FM 已在 SAP 开发系统部署。
`verify_report.js` 调用 FM → SUBMIT 报表 → 捕获 SALV 数据 → 返回 JSON。

### 5.5.4 逐字段比对（8 金额列 + 5 描述列）

```
金额列: ZQCJF, ZQCDF, ZBQJF, ZBQDF, ZBNJF, ZBNDF, ZQMJF, ZQMDF (×外币列 if P_FORCUR=X)
描述列: ZYJKM, RACCT, TXT50, ZFZHS, ZFZTX

每列必须：
  - 金额列: |程序值 - 源表手工计算值| < 0.01
  - 描述列: 程序值 = 单独查 SKAT/SKA1/TFKBT 的值
```

### 5.5.5 ALV 列核对

静态分析源码，确认列名/列数与 `fs-coverage.md` 一致。外部币列受 `P_FORCUR` 控制。

**S5.5 门禁**：
- 三步不可跳过（源表采样 → 手工预期 → verify_report.js 多组比对）
- ≥2 公司代码、≥3 参数组合 SUCCESS
- 8 金额列 + 5 描述列逐列比对通过
- 全零数据必须标注"计算逻辑待补充验证"
- `output/<程序>/smoke-test.md` 已按 [smoke-test-procedure.md](smoke-test-procedure.md) 模板生成

---
## 全工作流 SAP 操作速查

| 阶段 | 操作 | 命令 |
|------|------|------|
| 0 | 环境诊断 | `node scripts/test_rfc.js` |
| 0 | 双系统连通 | `node scripts/rfc_dual_check.js` |
| 1 | **提取 DOCX** | `node scripts/extract-docx.js "<路径>"` |
| 0 | 权限探测 | `node scripts/rfc_client.js --sql "SELECT COUNT(*) AS CNT FROM TADIR WHERE PGMID EQ 'R3TR'" --table TADIR` |
| 1.5 | 查对象名 | `node scripts/rfc_client.js --search "ZSAP_FI086"` |
| 2 | **拉 DD03L** | `node scripts/rfc_fetch_ddic.js --env=.env.data <TABNAME> output/<prog>/metadata/tables/` |
| 2.5 | 主表 COUNT | `node scripts/rfc_client.js --env=.env.data --sql "SELECT COUNT(*) AS CNT FROM <主表>" --table <主表>` |
| 3.6 | 验证包 | `node scripts/rfc_client.js --search "<包名>" --type DEVC` |
| 5 | **部署** | `node scripts/deploy_rfc.js <程序名>` |
| 5.5 | **取数（DDIC 端点）** | `node scripts/fetch_table.js --table=<T> --where="<cond>" --fields=<f> --rows=<n>` |
| 5.5 | 数据采样（兼容） | `node scripts/data_sampler.js "--table=<T>" "--where=<cond>" "--rows=100"` |
| 5.5 | **报表校验** | `node scripts/verify_report.js <程序名> P_xxx=<值> "S_xxx=低-高"` |

---
## 增量更新机制

FS 变更时禁止默认全量重跑。按变更类型选择恢复起点：

| 变更类型 | 恢复起点 | 需重新执行 |
|---------|---------|-----------|
| 纯输出列调整 | S3.5 | 3.5, 4, 5, 5.5 |
| 新增/替换透明表 | S2 | 2, 2.1, 2.5, 3, 3.5, 4, 5, 5.5 |
| 选择屏条件变更 | S3 | 3, 2.5(重估), 3.5, 4, 5, 5.5 |
| 模板/INCLUDE 结构调整 | S4 | 4, 5, 5.5 |

规则：已有 metadata JSON 不得删除重建；先拉基线再应用变更；增量更新后在 `stage-gate.md` 追加版本号。

---
## 执行检查清单

```
- [ ] S0: test_rfc.js 通过，双系统 --discovery 通过
- [ ] S0.5: 权限前置探测通过
- [ ] S1: functional-spec-ai.md 结构完整，表名大写
- [ ] S1.5: --search 确认全部对象名在 SAP 中不存在（或用户书面确认覆盖）
- [ ] S2: 每张表有 metadata JSON (matched=true)，_errors.md 完整
- [ ] S2.1: fs-ddic-verification.md 已生成，全部字段存在+语义审查通过
- [ ] S2.5: performance-estimate.md 已生成
- [ ] S2.5: 多期金额表已通过数据系统取真实数据确认分布
- [ ] S3: tech-design.md 含字段契约 + 性能设计
- [ ] S3.5: fs-coverage.md 覆盖 FS 全量字段
- [ ] S3.6: deployment-config.md 已生成（包/请求号/模板明确）
- [ ] S4: ASSIGN COMPONENT 字段名对齐 + sy-subrc 检查 + 6 轮自检通过 + 选择屏幕文本已设置
- [ ] S4: 源码结构与 template-mapping.md 一致
- [ ] S5: deploy_rfc.js 成功，激活无错误
- [ ] S5.5: ZREPORT_EXEC_VERIFY FM 已确认存在
- [ ] S5.5: ≥2 公司代码的 FAGLFLEXT 数据已验证存在
- [ ] S5.5: 源表手工聚合 vs verify_report.js 输出逐列比对通过（8 金额列 + 5 描述列）
- [ ] S5.5: ≥3 组参数组合 SUCCESS
- [ ] S5.5: output/<程序>/smoke-test.md 按 smoke-test-procedure.md 模板生成
- [ ] 每阶段 gate 通过后 git commit（推荐）
```

---
## 延伸阅读

- **ABAP 语法速查**：[abap-syntax-quickref.md](abap-syntax-quickref.md) — 阶段 4 必备
- **冒烟测试范式**：[smoke-test-procedure.md](smoke-test-procedure.md) — 阶段 5.5 强制参照
- **卡点速查**：[troubleshooting.md](troubleshooting.md) — 受阻时先查
- **SAP 操作参考**：[sap-operations-reference.md](sap-operations-reference.md) — 全部 SAP 命令的入参/出参/已测试状态
- **RFC ADT 端点**：[mcp-contract.md](mcp-contract.md) — 各端点 URI + rfc_client.js 使用手册
- **脚本库参考**：[reference.md](reference.md)
- **RFC-ADT 桥接**：[docs/rfc-adt-bridge.md](../../../../docs/rfc-adt-bridge.md) — SADT_REST_RFC_ENDPOINT 详解、INCLUDE/FUGR/FM 部署

完整语法追查 [SAP-samples/abap-cheat-sheets](https://github.com/SAP-samples/abap-cheat-sheets)。

---
## 附录：关键 RFC ADT 端点与故障排查

### 常用端点

| 操作 | 方法 | URI |
|------|------|-----|
| Discovery | GET | `/sap/bc/adt/discovery` |
| 搜索对象 | GET | `/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=<q>&maxResults=<n>` |
| SQL 查询（指定表） | POST | `/sap/bc/adt/datapreview/ddic?rowNumber=<n>&ddicEntityName=<T>` |
| SQL 查询（自由） | POST | `/sap/bc/adt/datapreview/freestyle?rowNumber=<n>` |
| 读取源码 | GET | `/sap/bc/adt/programs/programs/{name}/source/main` |
| 创建程序 | POST | `/sap/bc/adt/programs/programs` |
| Lock | POST | `{objectUri}?_action=LOCK&accessMode=MODIFY` |
| 激活 | POST | `/sap/bc/adt/activation?method=activate&preauditRequested=true` |

### 对象类型映射

| ADT 码 | URI 前缀 | 命名约定 |
|--------|---------|---------|
| `PROG/P` | `/sap/bc/adt/programs/programs/` | `ZSAP_xxx` |
| `PROG/I` | `/sap/bc/adt/programs/includes/` | `ZSAP_xxxT01` |
| `CLAS` | `/sap/bc/adt/oo/classes/` | `ZCL_xxx` |
| `INTF` | `/sap/bc/adt/oo/interfaces/` | `ZIF_xxx` |
| `FUGR` | `/sap/bc/adt/functions/groups/` | `ZFG_xxx` |

### 故障排查速查

| 症状 | 根因 | 解决 |
|------|------|------|
| `test_rfc.js` DLL 加载失败 | SAPNWRFC_HOME/PATH 未设 | 设置 Windows 系统环境变量，完全重启终端 |
| RFC 连接超时 | Router/防火墙/端口 | 检查 VPN，核对 SAP_ROUTER |
| 创建报 409 | 程序已存在 | **必须问用户**，禁止自动跳过 |
| `freestyle` 返回 400 | 系统不支持该端点 | 改用 `--table <T>` 走 `ddic` 端点 |
| 激活 HTTP 200 但未激活 | 解析器漏掉 `<msg type="E">` | 三种错误格式均需匹配 |

### 迁移到其他环境

复制 Skill 目录到目标仓库的 `.claude/skills/sap-report-automation-workflow/`。首次触发时代理按阶段 0 自动验证 RFC 环境、引导用户创建 `.env`。需用户安装 Node.js ≥ 18 + NW RFC SDK。

### INCLUDE 部署缺陷与 FUGR/FM 支持

→ [docs/rfc-adt-bridge.md](../../../../docs/rfc-adt-bridge.md)
