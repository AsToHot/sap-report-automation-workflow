# 工作流卡点速查

> 代理受阻时**必须先读本文**。本文只做**索引 + 独有补丁**，完整诊断步骤一律跳转 SKILL.md 对应章节。

---

## 0. 200 vs 300：查不到数据先查客户端

**200 是开发机（无业务数据），300 是业务数据机。程序只能在 200 上创建/激活。**

| 症状 | 第一反应 | 禁止行为 |
|------|---------|---------|
| `runQuery` 查 FAGLFLEXT/BSEG/BKPF 返回 0 行 | **先用 `abap-adt-data`(300) 查**。200 上这些表本来就是空的 | **禁止**怀疑代码逻辑有问题、反复重写 ABAP |
| 程序执行后 ALV 金额全 0 | **先确认当前连接的是 200 还是 300**。200 无数据，全 0 正常 | **禁止**改 `.env` 客户端号到 300 来"验证" |
| 需要验证程序正确性 | 在 `abap-adt-data`(300) 上 `runQuery` 确认源表有数据 | **禁止**在 200 上因为没有数据就推翻已验证通过的程序 |

### MCP 工具→客户端 速查

| MCP 工具 | 用哪个 MCP | 原因 |
|----------|-----------|------|
| `runQuery`、`tableContents` | `abap-adt-data`（300） | 查业务数据 |
| `createObject`、`setObjectSource`、`lock`、`activate*` | `abap-adt`（200） | 开发操作 |
| `getObjectSource`（查程序源码） | `abap-adt`（200） | 开发对象在 200 |
| `getObjectSource`（查表 DDIC） | 均可 | DDIC 定义在 200/300 一致 |
| `searchObject` | `abap-adt`（200） | 查开发对象 |
| `deploy_rfc.js` | 从 `.env` 读连接 → 必须 SAP_CLIENT=200 | 部署到开发机 |

→ 完整规则见 [SKILL.md §0.5.5](SKILL.md)

---

## 1. DDIC 元数据拉取

**唯一可靠路径**：`runQuery → DD03L`。`getObjectSource` 对 DDIC 表永远返回 404。

→ 完整规则见 SKILL.md 阶段 2（`DD03L 单表串行 + COUNT 校验`）
→ 连接错误恢复见 SKILL.md §0.4.1

**独有补丁**：
- JSON 中过滤掉 `.INCLUDE` / `.INCLU--AP` 行（非实体字段）
- 每表拉完**立即**写文件，对话中只报告一行摘要

### 1.5 多期金额表数据模型验证（ZTEST104 血训）

**FAGLFLEXT / GLT0 等多期金额表：DDIC 只告诉你有哪些字段，不告诉你数据的分布方式。**

| 假设（错误） | 实际 |
|------------|------|
| RPMAX='003' 的行只有 HSL03 有值 | **每行的 16 个 HSL 列都可能非零**（不同 OBJNR 切片贡献不同期间金额） |
| 用 CASE RPMAX 取单列即可 | **必须遍历所有 16 列**，全量累加 |

**兜底规则**：阶段 2 拉完 DDIC 后，**必须**在 `abap-adt-data`（300）上 `runQuery` 取一行真实数据（含全部金额列），确认数据分布方式，再写阶段 3 技术设计和阶段 4 代码。**禁止凭 DDIC 字段名推断数据模型。**

---

## 2. 部署激活

→ 完整流程见 SKILL.md 阶段 5（`deploy_rfc.js` 编排）
→ 故障速查表见 SKILL.md 附录「故障排查速查表」
→ INCLUDE 类型错位根因见 SKILL.md 附录「INCLUDE 部署已知缺陷」

**独有补丁**：
- 源码必须写入 `output/<obj>/abap/sources/`，`deploy_rfc.js` 读这个目录

---

## 3. 代码生成易错点

→ 反模式自检完整清单见 SKILL.md §4.9（6 轮 字面值类型→DB→WHERE→内表→控制流→其他）
→ 语法参考见 `abap-syntax-quickref.md`

### 3.0 字面值长度越界（两次实战 Dump，最高优先级）

**症状**：运行时 Dump — "data loss during copy ... value was 'ZH' ... source type C length 2, target type C length 1"

**根因**：`spras = 'ZH'` 写进 WHERE 条件，但 SPRAS 是 DDIC 类型 **LANG / LENG=1**，'ZH' 是 2 字节溢出。

**发生过的表**（全部含 SPRAS 字段，全部 LANG/LENG=1）：
SKAT | CSKT | CEPCT | MAKT | T077X | T023T | ANKT

**唯一正确写法**：
```abap
" 中文 SAP 内码
AND skat~spras = '1'
" 或用系统变量（也是 LANG(1)）
AND skat~spras = @sy-langu
```

**预判**：写完代码后执行 `grep -rn "'ZH'\|'EN'\|'DE'" output/<program>/abap/sources/`，命中 → 对照 metadata JSON 检查 LENG。

**预防**：SKILL.md §4.9 新增「第零轮：DDIC 字面值类型长度」——代码写完后第一件事就是逐字面值对照 metadata LENG，通过才进入后续五轮。

**独有补丁**：

- **TYPE 用 ROLLNAME**：`TYPE bukrs`（数据元素），禁止 `TYPE bkpf-bukrs`（表-字段名）
- **New OpenSQL（7.40+）**：host variable 用 `@`，短 SELECT 也容易漏
- **FOR ALL ENTRIES 类型匹配**：两边 ROLLNAME 不同 → 改用 SELECT 全表 + SORT + BINARY SEARCH
- **CL_SALV_TABLE GUI Status**：`report = 'SAPLKKBL'`（不是 `sy-repid`）

---

## 4. MCP/代理连通

每新会话 `rfc-proxy-server.js` 不会自启。先进 `curl localhost:9876` 探活。

→ 自动安装流程见 SKILL.md 阶段 0
→ 故障分层定位（DLL→网络→认证→代理→MCP）见 SKILL.md §0.4.1
→ 连接恢复步骤见 SKILL.md §0.4.1

---

## 一句话总结

**DDIC 用 runQuery→DD03L 逐表串行，结果写文件不占上下文。部署走 deploy_rfc.js，代码字段从契约来不用猜。**
