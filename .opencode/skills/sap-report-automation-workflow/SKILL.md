---
name: sap-report-automation-workflow
description: |
  End-to-end SAP ABAP 开发对象自动化——通过 node-rfc 直连 SADT_REST_RFC_ENDPOINT 调用 RFC ADT API。支持 REPORT/CLAS/FUGR/INTF/Include 全部对象类型。FS 规范化→DDIC 元数据→技术文档→按模板写 ABAP→激活循环。S0 探测 ABAP 版本并约束后续代码可用语法；SAP 查询统一走 `scripts/rfc_client.js`；部署按对象类型走 `deploy_report.js`/`deploy_report_include.js`/`deploy_fugr.js`/`deploy_clas.js`/`deploy_intf.js`。语法速查 [abap-syntax-quickref.md](abap-syntax-quickref.md)，卡点速查 [troubleshooting.md](troubleshooting.md)。
---

# SAP ABAP 开发对象自动化工作流（FS → 元数据 → 设计文档 → 代码 → 激活）

支持对象类型（S2 确认）：**REPORT**、**CLAS**、**FUGR**（含 Function Module）、**INTF**、**PROG/I**（Include）。

## 连接架构

```
# 查询链路
AI Agent → Bash → node scripts/rfc_client.js → node-rfc → SADT_REST_RFC_ENDPOINT → SAP

# 部署链路（按对象类型分发）
AI Agent → Bash → node scripts/deploy_report.js           → node-rfc → SADT_REST_RFC_ENDPOINT → SAP
                     node scripts/deploy_report_include.js
                     node scripts/deploy_fugr.js
                     node scripts/deploy_clas.js
                     node scripts/deploy_intf.js
```

所有 SAP 操作通过统一 RFC 客户端 `scripts/rfc_client.js`（通用查询）和 5 个类型专用部署脚本直连。`deploy_rfc.js` 保留为兼容入口。不再使用 MCP/HTTP 代理中间层。

## 阶段间强引用（元数据驱动；禁止凭语感写 Open SQL）

后续阶段**必须显式引用前序产物**，禁止凭记忆拼字段名/表名/JOIN 条件：

| 消费方 | 必须参照的输入 | 规则 |
|--------|--------------|------|
| `docs/tech-design.md` | `spec/functional-spec-ai.md` + `metadata/tables/*.json` | 每个物理字段须在元数据中可核对 |
| ABAP（Open SQL、内表） | `docs/tech-design.md` 的「字段契约」+ `metadata/tables/*.json` | SELECT/JOIN/WHERE 字段名必须来自契约或元数据 |
| ALV 列 / 内表组件 | 同上 | 列名与契约一致，计算列在契约中写清公式 |

**字段契约（S6 技术文档中必写）**：`docs/tech-design.md` 中至少包含：

| 逻辑项 | 表名 | 字段名 | 元数据文件 |
|--------|------|--------|------------|
| … | BKPF | BUKRS | output/<program>/metadata/tables/BKPF.json |

## 代理自主执行协议

代理在**同一任务内**按阶段 **0→1→2→3→4→5→6→7→8→9→10→11 顺序自动跑完**，仅在缺关键输入、SAP 不可达、或达重试上限时停顿。

**硬门禁**（除非用户明确说跳过）：
0. `test_rfc.js` 未通过 → 禁止进入 S1。代理必须指导用户完成 NW RFC SDK 安装和 `.env` 配置。
1. 无 `functional-spec-ai.md` → 禁止写 ABAP、禁止部署。
2. S2 对象名未确认（或已存在未覆盖授权） → 禁止进入 S3。
3. 无 metadata JSON 落盘 → 禁止进入 S4。
4. `fs-ddic-verification.md` 有语义偏差未修正 → 禁止进入 S6。
6. 无 `tech-design.md`（含字段契约+选择屏幕角色分析）→ 禁止进入 S9。
8. `deployment-config.md` 未生成（包/请求号/模板未明确） → 禁止进入 S10。
9-10. 必须实际调用 SAP，失败时自动修错循环直至成功或达上限。

**Preflight Gate**：任何 SAP 写操作前，必须确认 `stage-gate.md` 中 S0→S8 全部为 `yes`。禁止在门禁未通过时调用任何部署脚本或写操作。

受阻时**先查 [troubleshooting.md](troubleshooting.md)**，按"预判→预防→应对"处理。

---
## S0：RFC 环境验证与连接

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
| `SAP_URL` | 是 | SAP 主机地址，如 `http://<host>:<port>` |
| `SAP_CLIENT` | 是 | 客户端号（如 `200`） |
| **`SAP_SYSNR`** | **是** | RFC 实例号——**不可依赖端口推导** |
| `SAP_USERNAME` | 是 | 开发账号 |
| `SAP_PASSWORD` | 是 | 密码 |
| `SAP_ROUTER` | 否 | Router 字符串（内网穿透） |

**双系统配置**：开发系统 `.env`，数据系统 `.env.data`。二者 SAP_SYSNR 通常相同，但 SAP_CLIENT 不同。

代理写入配置文件后**不启动任何后台进程**——`rfc_client.js` 每次执行时自动连接、执行、断开。

### 0.3 连通验证

```bash
# 一键双系统检测
node scripts/rfc_dual_check.js
```

两个系统都 `"ok": true` → 已就绪。任一失败 → 按 [troubleshooting.md](troubleshooting.md) §4 排查。记录到 `stage-gate.md` 的 `S0=connection-ok`。

### 0.4 双系统架构（硬约束）

| 配置文件 | 用途 | SAP_CLIENT |
|---------|------|-----------|
| `.env` | 开发：创建/修改/激活/语法检查 | 由用户指定（如 200） |
| `.env.data` | 数据：runQuery/tableContents | 由用户指定（如 300） |

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

### 0.6 ABAP 版本探测（写代码前强制）

在 S9 写 ABAP 之前，必须知道目标开发系统的 ABAP release，否则无法判断内联声明、`VALUE`、`CORRESPONDING` 等新语法是否可用。

```bash
# 默认读取 .env
node scripts/detect_abap_version.js

# 数据系统（如需要）
node scripts/detect_abap_version.js --env=.env.data
```

输出示例：

```json
{
  "status": "success",
  "system": {
    "sysid": "DEV",
    "database": "HDB",
    "sapReleaseRaw": "7400",
    "sapRelease": 740
  },
  "versionTier": "s4hana_early",
  "allowedSyntax": ["🔵", "🟢"],
  "notes": "ECC 6.0 EHP7/EHP8（ABAP 7.40）：仅可用 🔵 与 🟢 语法"
}
```

**处理规则**：
- `sapRelease` 为 `null` 或 `< 700` → 按最严格 `ecc_legacy` 处理，只允许 🔵 语法
- `allowedSyntax` 写入 `stage-gate.md` 的 `S0=abap-version`
- S9 写代码时，**只准使用 allowedSyntax 内图标标注的语法**；遇到新语法需求必须先确认版本

记录到 `stage-gate.md` 的 `S0=abap-version`。

### 0.7 切换 SAP 系统

用户说「换系统/切客户端/改密码」→ 更新对应 `.env` 文件 → 重新执行 0.3 连通验证。无需重启任何进程。

---
## S1：获取 FS → 规范化为 AI 可读的功能文件

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
## S2：对象名确认与 SAP 存在性检查

### 确定对象名与类型

| 对象类型 | ADT 码 | 命名约定 | 示例 |
|---------|--------|---------|------|
| 可执行报表 | `PROG/P` | `ZSAP_xxx` / `ZFI_xxx` | `ZSAP_FI086` |
| Include | `PROG/I` | `ZSAP_xxxT01` / `ZSAP_xxxF01` | `ZSAP_FI086T01` |
| 全局类 | `CLAS` | `ZCL_xxx` | `ZCL_FI_UTILITY` |
| 函数组 | `FUGR` | `ZFG_xxx` | `ZFG_FI_TOOLS` |
| 接口 | `INTF` | `ZIF_xxx` | `ZIF_FI_DATA_ACCESS` |

### 2.2 SAP 存在性检查

```bash
# 查主对象 + 所有 Include
node scripts/rfc_client.js --search "ZSAP_FI086"
node scripts/rfc_client.js --search "ZSAP_FI086T01"
```

已存在 → **立即停止**，报告对象名/类型，让用户重新提供或书面确认覆盖。**禁止**代理擅自改对象名或跳过。均不存在 → `[OK]`，继续 S3。

**S2 门禁**：全部对象名在 SAP 中均不存在，或用户已书面确认覆盖。

---
## S3：透明表 DDIC 元数据

### Z 表也必须拉 DDIC

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
## S4：FS → DDIC 字段交叉验证（强制）

> **硬约束**：业务人员写 FS 时可能写错字段名或误解字段语义。metadata JSON 落盘后必须立即逐字段对照验证，禁止盲目信任 FS。

### 4.1 验证内容

对 `functional-spec-ai.md` 中引用的每个 `表.字段`：
1. **存在性**：字段在 DD03L 中确实存在
2. **类型**：数据类型匹配预期使用方式
3. **语义**：字段的实际含义与 FS 描述一致（重点：SELECT-OPTIONS 的字段是真正的过滤字段还是参考字段）
4. **字面值陷阱**：SPRAS=LANG(1) 强制 `'1'` 非 `'ZH'`；DATS 格式 `'YYYYMMDD'`
5. **符号约定**（新增）：金额列需逐列确认 FS 中定义的是绝对值还是带符号值——SAP 中 DRCRK='H' 的金额通常存为负数，若 FS 按绝对值描述则代码需额外处理。**验证方法**：取一行真实数据，检查 DRCRK='S' vs 'H' 的实际符号，与 FS 描述对照，在 tech-design.md 字段契约中标注每列的符号来源

### 4.2 验证输出

落盘 `spec/fs-ddic-verification.md`：每表每字段一行，标注存在性+类型+语义审查结果。不通过项标注为 TBD，等用户澄清后再进入 S6。

**S4 门禁**：全部 FS 引用字段在 DDIC 中存在；语义偏差已标注并修正（或用户确认）；`fs-ddic-verification.md` 已落盘。

---
## S5：性能预估

对主驱动表执行 COUNT：
```bash
node scripts/rfc_client.js --env=.env.data \
  --sql "SELECT COUNT(*) AS CNT FROM <主表> WHERE <最严格条件>" --table <主表>
```

- `< 10,000` → 全量 ALV
- `10,000 ~ 1,000,000` → 建议分页
- `> 1,000,000` → 必须后台执行

结果写入 `performance-estimate.md`。

**S5 门禁**：每张表有 metadata JSON 且 `matched=true`；`performance-estimate.md` 已生成；多期金额表已通过数据系统取一行真实数据确认分布方式。

---
## S6：技术文档 `docs/tech-design.md`

必须包含：**字段契约**（FS 列/表.字段/metadata 溯源）、表清单、关联路径、取数逻辑、**选择屏幕字段角色分析**（四角色分类）、ALV 布局、性能设计（内表类型/嵌套 LOOP 替代/WHERE 排列/数据量预估）。

### 选择屏幕字段角色分析（强制）

> **硬约束**：每个选择屏幕字段必须先确定为四角色之一再决定使用方式，禁止默认全部塞入 WHERE。

| 角色 | 说明 | 示例 | 使用方式 |
|------|------|------|----------|
| **WHERE 过滤** | 直接过滤主表行 | P_RYEAR、S_RACCT | 放入 FAGLFLEXT SELECT 的 WHERE 子句 |
| **映射键** | 需经中间表转换 | P_BUKRS | 先查 ZSAP_BUKRS 得到 RBUKRS，再用于 WHERE |
| **计算参数** | 不过滤行，决定聚合范围 | S_RPMAX | 不出现于 WHERE；决定 HSL{start}~HSL{end} 索引范围 |
| **显示控制** | 不影响取数，控制输出 | P_FORCUR | 控制 ALV 列 visible/technical |

**S6 门禁**：`tech-design.md` 含字段契约 + 选择屏幕字段角色分析表；`fs-coverage.md` 覆盖全部输出列；`template-mapping.md` 列出新旧 INCLUDE 对应；`deployment-config.md` 已生成。

---
## S7：FS 对齐审查 `docs/fs-coverage.md`

| FS 逻辑项 | 输出字段 | 契约字段（表.字段） | 元数据文件 | 代码落点 | 状态 |
|-----------|---------|-------------------|-----------|---------|------|

FS 中每个输出列/选择条件都必须出现一行。S10 前做反查：从最终代码回填确认无遗漏。

---
## S8：部署配置 `docs/deployment-config.md`

确认三项并落盘：
- **开发包**：用户提供或默认 `$TMP`（本地包无需传输请求）
- **传输请求**：仅非 `$TMP` 时需要
- **模板选择**：优先 `templates/reference/<对象名>/`，其次默认模板，无模板用 quickref 骨架

**必须按如下固定格式写入**（部署脚本通过正则解析）：

```markdown
| 程序名 | ZTESTXXX |
| 目标包 | $TMP |
| 传输请求 | — |
| 程序描述 | <程序功能描述> |
```

> 部署脚本用 `| 目标包 | ([^|]+) |` 正则提取包名。不用此格式会报 `Package name not found`。`

**S8 门禁**：`deployment-config.md` 已生成，包/请求号/模板状态明确。

---
## S9：按类型生成代码

> **语法硬约束**：以 [abap-syntax-quickref.md](abap-syntax-quickref.md) 为参考，禁止凭记忆写语法。

### 对象类型分发

| 类型 | 代码文件 | 部署脚本 | 参考模板 |
|------|---------|---------|---------|
| **REPORT** | 主程序 + T01/SEL/F01 分层 | `deploy_report_include.js` | `templates/reference/<模板程序名>/` |
| **REPORT**（无 INCLUDE） | 主程序单个文件 | `deploy_report.js` | quickref §1–6 |
| **CLAS** | `<名>.clas.abap`（单文件） | `deploy_clas.js` | quickref §11 |
| **INTF** | `<名>.intf.abap` | `deploy_intf.js` | quickref §12 |
| **FUGR** | `<FM名>.fm.abap`（每 FM 一个文件） | `deploy_fugr.js` | quickref §13 |

### REPORT 生成

1. **强制先读模板**：打开 `templates/reference/report/` 下全部 4 个文件，逐行理解其结构后再写代码。禁止跳过后直接写。
2. 打开 `tech-design.md` → `metadata/tables/*.json` → `abap-syntax-quickref.md`
3. INCLUDE 分层强约束：主程序 + T01/SEL/F01 保持模板结构
4. 生成前先写 `template-mapping.md`
5. 反模式自检通过（见 [S9 通用反模式自检](SKILL.md#s9-按类型生成代码)）

**GUI Status 强制规则**（CL_SALV_TABLE 专用，已激活旧对象可能用`sy-repid`+`S1000`，不要模仿）：
- `CL_SALV_TABLE` 的 `set_screen_status` 必须用 `report = 'SAPLKKBL'`，**绝不能**是 `sy-repid`
- 必须在 `display()` 前调用，带 `pfstatus = 'STANDARD'` 和 `set_functions = gr_alv->c_functions_all`

> pfstatus `'STANDARD'` 是 SAPLKKBL 自带的 GUI 状态；**不要**使用自定义 `'S1000'`，它仅适用于 `sy-repid` 自定义状态。

**禁止参考 output/ 下旧对象**：已有项目可能使用旧版单文件结构，**不是**本技能规定的标准。必须严格按模板 `templates/reference/report/` 分层结构生成。

### CLASS/INTF/FUGR 生成

1、按 quickref §11–13 骨架。FM 参数用 ABAP 原生语法（`FUNCTION ... IMPORTING/EXPORTING ... ENDFUNCTION`），**禁止** `*"*"` 注释块格式。
2、参考模板`templates/reference/class/`、`templates/reference/function/`、`templates/reference/interface/`

### 通用反模式自检（6 轮，强制）

代码写入后、部署前，逐轮检查（详见 [abap-syntax-quickref.md](abap-syntax-quickref.md) §14）：

**第负一轮 — ASSIGN COMPONENT**：扫描每个 `ASSIGN COMPONENT`，对照 metadata JSON 确认拼接变量 DATATYPE/LENG；NUMC 类型确认字段名长度匹配；每个后有 `sy-subrc` 检查。

**第零轮 — DDIC 字面值**：扫描所有字面值对照 metadata LENG。重点陷阱：`SPRAS`(LANG, LENG=1) 必须用 `'1'` 非 `'ZH'`。

**第零轮(2) — 模板代码风格对齐**：逐项对照 `templates/reference/report/`(其他程序类型，对应不同文件夹) 检查：
- ✅ GUI Status：`report = 'SAPLKKBL'`（不是 `sy-repid`），`pfstatus = 'STANDARD'`（不是 `'S1000'`），在 `display()` 前调用
- ✅ INCLUDE 分层：主程序仅 REPORT+INCLUDE+事件块，FORM 在 F01 中
- ✅ 列格式化：用 `set_column` 辅助 FORM（非内联 `CAST cl_salv_column_table`）
- ✅ FIELD-SYMBOLS 不同 FORM 不同名
- ✅ 主程序不含除 REPORT/INCLUDE/事件块以外的代码

**第一~五轮**：DB → WHERE → 内表 → 控制流 → 其他规范（无 Hard Coding/有 AUTHORITY-CHECK）。

任一轮未通过 → 修正源码后再继续。

**S9 门禁**：ASSIGN COMPONENT 字段名对齐 + 7 轮自检通过（含模板代码风格对齐） + 源码结构与 template-mapping.md 一致 + **选择屏幕文本已设置** + **GUI Status 用 `'SAPLKKBL'`**。

---
## 选择屏幕文本元素处理

> 选择屏幕参数/选择项的中文标签通过以下两种运行时方法设置，无需 SE32 文本元素。

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
S0=connection-ok: yes/no
S0=permission-check: yes/no
S0=abap-version: yes/no
S1=functional-spec-ready: yes/no
S2=object-name-confirmed: yes/no
S3=metadata-ready: yes/no
S4=fs-ddic-verified: yes/no
S5=performance-estimate-ready: yes/no
S6=tech-design-ready: yes/no
S7=fs-coverage-ready: yes/no
S8=deployment-config-ready: yes/no
S9=code-generated: yes/no
S10=activated: yes/no
S11=smoke-test-passed: yes/no
```

> 门禁通过后由用户决定是否 `git add + git commit`，格式建议：`[SAP-WF] 阶段X: 简述产物`。代理不自动执行 git 提交。

---
## S10：部署与激活

> **2026-07 重构**：部署脚本按对象类型拆分为 5 个独立脚本，每个有可重复的入参出参示例。`deploy_rfc.js` 保留为兼容入口（REPORT + 固定 INCLUDE 结构）。

### 部署脚本选型（按对象类型分发）

| 对象类型 | 脚本 | 源码文件约定 |
|---------|------|------------|
| **REPORT**（无 INCLUDE） | `node scripts/deploy_report.js <名>` | `output/<名>/abap/<名>.abap` |
| **REPORT + INCLUDE** | `node scripts/deploy_report_include.js <名>` | 主程序 + 从源码自动发现 INCLUDE 名 |
| **FUGR + FM** | `node scripts/deploy_fugr.js <名>` | `output/<名>/abap/<FM名>.fm.abap` |
| **CLAS** | `node scripts/deploy_clas.js <名>` | `output/<名>/abap/<名>.clas.abap` |
| **INTF** | `node scripts/deploy_intf.js <名>` | `output/<名>/abap/<名>.intf.abap` |
| **REPORT**（固定 T01/SEL/F01/O01） | `node scripts/deploy_rfc.js <名>` | 兼容旧模板 |

### 部署前复核

1. S2 的 `--search` 结果已记录，程序名一致
2. `stage-gate.md` 中 S8=yes
3. `deployment-config.md` 已按固定表格格式生成

### 标准流程（所有脚本通用）

每个脚本内部执行：创建对象 → Lock → 上传源码 → Unlock → 激活 → 验证版本。

**关键行为规则**（2026-07 实战验证）：

| 规则 | 说明 |
|------|------|
| **INCLUDE 自动发现** | `deploy_report_include.js` 从主程序源码 `INCLUDE xxx.` 指令提取 INCLUDE 名，不限死 T01/SEL/F01 |
| **FM 必须入激活列表** | 只激活 FUGR 不会激活其 FM。`deploy_fugr.js` 自动把 FUGR + 所有 FM 放入一个 activation 请求 |
| **CLAS/INTF 走 OO URI** | CLAS 激活 URI 是 `/oo/classes/`，INTF 是 `/oo/interfaces/`，不能用 `activateObjects()` 的 programs URI |
| **已存在 = 405 或 409** | 此系统"已存在"返回 405，不是标准 409。所有新脚本兼容两种 |
| **激活响应体可能为空** | HTTP 200 + 空 body = 激活成功（此系统行为） |
| **Syntax check 405** | 此系统不支持独立语法检查，激活时验证语法 |

### 部署后验证（所有脚本自动执行）

每个脚本激活后自动 GET 对象元数据，提取 `adtcore:version` 字段确认 `active`。结果以 JSON 输出：

```json
{"status":"success","objects":[{"name":"ZTEST006","type":"PROG/P","version":"active"},...],"errors":[]}
```

### 锁管理

Lock Handle 持久化到 `.locks/<name>.json`。残留锁用 `scripts/release_locks.js` 清理。

**S10 门禁**：部署成功，所有对象 version=active。

---
## S11：冒烟测试（激活后强制，不可跳过）

> **执行范式强制参照**：[smoke-test-procedure.md](smoke-test-procedure.md)——含入参矩阵、手工计算步骤、逐字段比对脚本模板。

### 硬门禁（代理不得自行跳过）

1. **禁止**在 `ZREPORT_EXEC_VERIFY` FM 不存在或不返回 `EV_SUCCESS='X'` 时标记 S11=yes
2. **禁止**仅跑一次 `verify_report.js` 看返回码即通过
3. **禁止** `smoke-test.md` 的数值来源于**推测/人工伪造**——所有数必须来自 `verify_report.js` 真实返回的 `EV_DATA_JSON`；
   伪造数据是严重违规，发现后必须重写并道歉
4. **禁止**源表数据全零时不标注"数据全零，计算逻辑待补充验证"即通过
5. **禁止**仅比对金额列；描述列（TXT50/ZFZHS/ZFZTX/ZYJKM）也必须逐列比对
6. **必须**≥2 个不同公司代码、≥3 组参数组合、≥8 个金额列逐列 0.01 容差匹配
7. `smoke-test.md` 落盘路径为 `output/<程序>/smoke-test.md`（**非** docs/ 子目录）

### 数据抽样（fetch_table.js 统一入口——DDIC 端点，WHERE 可靠）

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

### 关键维度选择（如适用）

若报表涉及公司代码（BUKRS）等维度，需先确定有效值：

```bash
# 1. 找有数据的关键维度值
node scripts/data_sampler.js "--table=FAGLFLEXT" "--where=RYEAR = '2026'" "--rows=5"
# 2. 查映射表（如 ZSAP_BUKRS 的 ZFGS/ZZGS）
node scripts/data_sampler.js "--table=ZSAP_BUKRS" "--fields=BUKRS,ZFGS,ZZGS" "--rows=100"
# 3. 确定有效值（ZFGS=''→BUKRS; ZFGS≠''→ZZGS）
# 4. 验证有效值在主表中有数据
```

### 报表执行校验

```bash
node scripts/verify_report.js <程序名> P_xxx=<值> "S_xxx=低-高,低-高"
```

**前提**：`ZREPORT_EXEC_VERIFY` FM 已在 SAP 开发系统部署。
`verify_report.js` 调用 FM → SUBMIT 报表 → 捕获 SALV 数据 → 返回 JSON。

### 11.4 verify_report.js 失败排查（实战教训）

`verify_report.js` 失败时，**不要先怀疑连接**——同一个 SAP 实例（同一 `ashost+sysnr`）下的不同客户端必定同时连通或同时不通。
错误 `"An exception has occurred that was not caught"` 是报表程序本身的 ABAP 异常（dump 或 TYPE E 消息），而非 RFC 连接问题。

| 症状 | 最可能根因 | 检查方法 |
|------|-----------|---------|
| `An exception has occurred that was not caught` | 报表内部 ABAP dump：AUTHORITY-CHECK 用错字段、消息 TYPE 'E'、数据转换错 | 检查 F01 逻辑，特别是 authority_check 是否传了正确字段 |
| `Fill all required fields` / 参数类 404 | ZREPORT_EXEC_VERIFY 的 IT_RSPARAMS 结构不对 | 直接 node-rfc 传参测试（跳过 verify_report.js 参数解析层） |
| `ZREPORT_EXEC_VERIFY` FM 404 | FM 未部署 | 检查 docs/ 下部署记录 |
| RFCEXEC 相关错误 | 网络/路由/NW-RFC-SDK | 先跑 `node scripts/test_rfc.js` 确认客户端连通，再跑 `node scripts/test_rfc.js .env.data` 确认数据系统连通 |

**关键原则**：先最小化——用直接 node-rfc 调用 FM 排除脚本层问题，再逐层向上排查。

### 逐字段比对（例子：8 金额列 + 5 描述列）

```
金额列: ZQCJF, ZQCDF, ZBQJF, ZBQDF, ZBNJF, ZBNDF, ZQMJF, ZQMDF (×外币列 if P_FORCUR=X)
描述列: ZYJKM, RACCT, TXT50, ZFZHS, ZFZTX

每列必须：
  - 金额列: |程序值 - 源表手工计算值| < 0.01
  - 描述列: 程序值 = 单独查 SKAT/SKA1/TFKBT 的值
```

### ALV 列核对

静态分析源码，确认列名/列数与 `fs-coverage.md` 一致。外部币列受 `P_FORCUR` 控制。

**S11 门禁**：
- 三步不可跳过（源表采样 → 手工预期 → verify_report.js 多组比对）
- ≥2 单选、≥3 多选参数组合 SUCCESS
- 8 金额列 + 5 描述列逐列比对通过
- 全零数据必须检查是否程序出问题
- `output/<程序>/smoke-test.md` 已按 [smoke-test-procedure.md](smoke-test-procedure.md) 模板生成

---
## 全工作流 SAP 操作速查

| 阶段 | 操作 | 命令 |
|------|------|------|
| S0 | 环境诊断 | `node scripts/test_rfc.js` |
| S0 | 双系统连通 | `node scripts/rfc_dual_check.js` |
| S0 | 权限探测 | `node scripts/rfc_client.js --sql "SELECT COUNT(*) AS CNT FROM TADIR WHERE PGMID EQ 'R3TR'" --table TADIR` |
| S0 | **ABAP 版本探测** | `node scripts/detect_abap_version.js [--env=.env.data]` |
| S1 | **提取 DOCX** | `node scripts/extract-docx.js "<路径>"` |
| S2 | 查对象名 | `node scripts/rfc_client.js --search "<对象名>"` |
| S3 | **拉 DD03L** | `node scripts/rfc_fetch_ddic.js --env=.env.data <TABNAME> output/<prog>/metadata/tables/` |
| S4 | 主表 COUNT | `node scripts/rfc_client.js --env=.env.data --sql "SELECT COUNT(*) AS CNT FROM <主表>" --table <主表>` |
| S8 | 验证包 | `node scripts/rfc_client.js --search "<包名>" --type DEVC` |
| S10 | **部署 REPORT**（单文件） | `node scripts/deploy_report.js <程序名>` |
| S10 | **部署 REPORT+INCLUDE** | `node scripts/deploy_report_include.js <程序名>` |
| S10 | **部署 FUGR+FM** | `node scripts/deploy_fugr.js <函数组名>` |
| S10 | **部署 CLAS** | `node scripts/deploy_clas.js <类名>` |
| S10 | **部署 INTF** | `node scripts/deploy_intf.js <接口名>` |
| S10 | 部署（兼容旧模板） | `node scripts/deploy_rfc.js <程序名>` |
| S11 | **取数（DDIC 端点）** | `node scripts/fetch_table.js --table=<T> --where="<cond>" --fields=<f> --rows=<n>` |
| S11 | 数据采样（兼容） | `node scripts/data_sampler.js "--table=<T>" "--where=<cond>" "--rows=100"` |
| S11 | **报表校验** | `node scripts/verify_report.js <程序名> P_xxx=<值> "S_xxx=低-高"` |

---
## 增量更新机制

FS 变更时禁止默认全量重跑。按变更类型选择恢复起点：

| 变更类型 | 恢复起点 | 需重新执行 |
|---------|---------|-----------|
| 纯输出列调整 | S7 | 7, 9, 10, 11 |
| 新增/替换透明表 | S3 | 3, 4, 5, 6, 7, 9, 10, 11 |
| 选择屏条件变更 | S6 | 6, 5(重估), 7, 9, 10, 11 |
| 模板/INCLUDE 结构调整 | S9 | 9, 10, 11 |

规则：已有 metadata JSON 不得删除重建；先拉基线再应用变更；增量更新后在 `stage-gate.md` 追加版本号。

---
## 执行检查清单

```
- [ ] S0: test_rfc.js 通过，双系统 --discovery 通过，权限前置探测通过，ABAP 版本已探测并记录 allowedSyntax
- [ ] S1: functional-spec-ai.md 结构完整，表名大写
- [ ] S2: --search 确认全部对象名在 SAP 中不存在（或用户书面确认覆盖）
- [ ] S3: 每张表有 metadata JSON (matched=true)，_errors.md 完整
- [ ] S4: fs-ddic-verification.md 已生成，全部字段存在+语义审查通过
- [ ] S5: performance-estimate.md 已生成
- [ ] S5: 多期金额表已通过数据系统取真实数据确认分布
- [ ] S6: tech-design.md 含字段契约 + 性能设计
- [ ] S7: fs-coverage.md 覆盖 FS 全量字段
- [ ] S8: deployment-config.md 已生成（包/请求号/模板明确）
- [ ] S9: ASSIGN COMPONENT 字段名对齐 + sy-subrc 检查 + 反模式自检通过 + 选择屏幕文本已设置
- [ ] S9: 源码结构与 template-mapping.md 一致
- [ ] S10: 对应类型部署脚本成功，激活无错误
- [ ] S11: ZREPORT_EXEC_VERIFY FM 已确认存在
- [ ] S11: 关键维度数据已验证存在（如公司代码等）
- [ ] S11: 源表手工聚合 vs verify_report.js 输出逐列比对通过
- [ ] S11: ≥3 组参数组合 SUCCESS
- [ ] S11: output/<程序>/smoke-test.md 按 smoke-test-procedure.md 模板生成
- [ ] 每阶段 gate 通过后 git commit（推荐）
```

---
## 延伸阅读

- **部署脚本**：[deploy_report.js](../../scripts/deploy_report.js) · [deploy_report_include.js](../../scripts/deploy_report_include.js) · [deploy_fugr.js](../../scripts/deploy_fugr.js) · [deploy_clas.js](../../scripts/deploy_clas.js) · [deploy_intf.js](../../scripts/deploy_intf.js) — 每种对象类型独立脚本，含可重复入参出参示例
- **ABAP 语法速查**：[abap-syntax-quickref.md](abap-syntax-quickref.md) — S9 必备
- **冒烟测试范式**：[smoke-test-procedure.md](smoke-test-procedure.md) — S11 强制参照
- **卡点速查**：[troubleshooting.md](troubleshooting.md) — 受阻时先查
- **SAP 操作参考**：[sap-operations-reference.md](sap-operations-reference.md) — 全部 SAP 命令的入参/出参/已测试状态
- **RFC ADT 端点**：[rfc-adt-client-manual.md](rfc-adt-client-manual.md) — 各端点 URI + rfc_client.js 使用手册
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
| 创建 Include | POST | `/sap/bc/adt/programs/includes` |
| 创建类 | POST | `/sap/bc/adt/oo/classes` |
| 创建接口 | POST | `/sap/bc/adt/oo/interfaces` |
| 创建函数组 | POST | `/sap/bc/adt/functions/groups` |
| 创建 FM | POST | `.../fmodules`（命名空间 `fmodules`，非 `groups`） |
| Lock | POST | `{objectUri}?_action=LOCK&accessMode=MODIFY` |
| 激活 | POST | `/sap/bc/adt/activation?method=activate&preauditRequested=false` |

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
| 创建报 **409** | 程序已存在 | **必须问用户**，禁止自动跳过 |
| 创建报 **405**（非 409） | 此系统"已存在"返回 405 而非 409 | 脚本兼容处理：405+body 含 AlreadyExists |
| 激活 HTTP 200 但空 body | 此系统激活成功不返回 XML | 正常行为。部署后 GET 元数据确认 `version="active"` |
| 激活 HTTP 200 但 FM 仍 inactive | **只激活了 FUGR 没激活 FM** | FM 必须放入同一个 activation 请求 |
| CLAS/INTF 激活报 Internal error 8 | 用了 programs URI 而非 OO URI | `deploy_clas.js`/`deploy_intf.js` 使用正确的 `/oo/classes/` `/oo/interfaces/` URI |
| FM 创建报 400 "期望的是元素 fmodules" | 命名空间错误（用了 `groups` 而非 `fmodules`） | FM XML 必须用 `http://www.sap.com/adt/functions/fmodules` |
| 激活报错对象名为 "unknown" | 错误解析器无法从响应中提取对象名 | 查看完整 XML 响应中的 `objDescr`/`objName` 属性 |
| Syntax check 报 405 | 此系统不支持独立语法检查 | 依赖激活时验证语法 |
| `freestyle` 返回 400 | 系统不支持该端点 | 改用 `--table <T>` 走 `ddic` 端点 |

### 迁移到其他环境

复制 Skill 目录到目标仓库的 `.opencode/skills/sap-report-automation-workflow/`。首次触发时代理按 S0 自动验证 RFC 环境、引导用户创建 `.env`。需用户安装 Node.js ≥ 18 + NW RFC SDK。

### INCLUDE 部署缺陷与 FUGR/FM 支持

→ [docs/rfc-adt-bridge.md](../../../../docs/rfc-adt-bridge.md)





