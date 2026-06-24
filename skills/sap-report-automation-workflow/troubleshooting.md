# 工作流卡点速查

> 代理受阻时**必须先读本文**。本文只做**索引 + 独有补丁**，完整诊断步骤一律跳转 SKILL.md 对应章节。

---

## 0. 200 vs 300：查不到数据先查客户端

**200 是开发机（无业务数据），300 是业务数据机。程序只能在 200 上创建/激活。**

| 症状 | 第一反应 | 禁止行为 |
|------|---------|---------|
| SQL 查 FAGLFLEXT/BSEG/BKPF 返回 0 行 | **先用 `--env=.env.data` 查数据系统(300)**。200 上这些表本来就是空的 | **禁止**怀疑代码逻辑有问题、反复重写 ABAP |
| 程序执行后 ALV 金额全 0 | **先确认数据采自数据系统(300)**。200 无数据，全 0 正常 | **禁止**改 `.env` 客户端号到 300 来"验证" |
| 需要验证程序正确性 | 在数据系统(300)上 `--env=.env.data` 查源表确认有数据 | **禁止**在 200 上因为没有数据就推翻已验证通过的程序 |

### 脚本→系统 速查

| 操作 | 配置文件 | 说明 |
|------|---------|------|
| `rfc_client.js --sql ... --table <T>` 查业务数据 | `--env=.env.data`（数据系统 300） | 查业务数据 |
| `rfc_client.js --search` 查 ABAP 对象 | 默认 `.env`（开发系统 200） | 查开发对象 |
| `rfc_fetch_ddic.js <T>` 拉元数据 | `--env=.env.data`（数据系统 300） | DDIC 定义 200/300 一致，有数据处更快 |
| `deploy_rfc.js <prog>` 部署 | 默认 `.env`（开发系统 200） | 部署到开发机 |
| `verify_report.js` 冒烟测试 | 默认 `.env.data`（数据系统 300） | 执行业务数据校验 |

→ 完整规则见 [SKILL.md §0.5.5](SKILL.md)

---

## 1. DDIC 元数据拉取

**唯一可靠路径**：`runQuery → DD03L`。`getObjectSource` 对 DDIC 表永远返回 404。

→ 完整规则见 SKILL.md 阶段 2（`DD03L 单表串行 + COUNT 校验`）
→ 连接错误恢复：0.4.1 业务工具运行时恢复流程

**独有补丁**：
- JSON 中过滤掉 `.INCLUDE` / `.INCLU--AP` 行（非实体字段）
- 每表拉完**立即**写文件，对话中只报告一行摘要

### 1.5 多期金额表数据模型验证（ZTEST104 血训）

**FAGLFLEXT / GLT0 等多期金额表：DDIC 只告诉你有哪些字段，不告诉你数据的分布方式。**

| 假设（错误） | 实际 |
|------------|------|
| RPMAX='003' 的行只有 HSL03 有值 | **每行的 16 个 HSL 列都可能非零**（不同 OBJNR 切片贡献不同期间金额） |
| 用 CASE RPMAX 取单列即可 | **必须遍历所有 16 列**，全量累加 |

**兜底规则**：阶段 2 拉完 DDIC 后，**必须**用 `rfc_client.js --env=.env.data` 在数据系统(300)上取一行真实数据（含全部金额列），确认数据分布方式，再写阶段 3 技术设计和阶段 4 代码。**禁止凭 DDIC 字段名推断数据模型。**

---

## 2. 部署激活

→ 完整流程见 SKILL.md 阶段 5（`deploy_rfc.js` 编排）
→ 故障速查表见 SKILL.md 附录「故障排查速查」
→ INCLUDE 类型错位根因见 [docs/rfc-adt-bridge.md](../../docs/rfc-adt-bridge.md)「INCLUDE 部署已知缺陷」

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

### 3.1 ASSIGN COMPONENT 动态字段名与 NUMC 类型不匹配（ZTEST003 血训，最高优先级）

**症状**：程序无 Dump 无语法错，但所有动态计算列（本期发生、本年累计）全为 0，只有直接字段引用（如期初 `hslvt`）有值。

**根因**：`ASSIGN COMPONENT` 生成的字段名与结构体字段名**字符数不一致**——`|HSL{ iv_period }|` 里 `iv_period` 是 RPMAX（NUMC **3**），拼出 `HSL001`，但结构体字段是 `HSL01`（固定 2 位数字）。ASSIGN 失败时 `sy-subrc ≠ 0`，值保持 CLEAR 后的 0，**不报错**。

**发生场景**：凡是涉及 NUMC 类型用于动态字段名拼接的地方——RPMAX（期间）、MONAT（月份）、BUKRS（公司代码）等。

**预判**：
```bash
# 阶段 4 写完代码后，在 abap/sources 目录执行：
grep -n "ASSIGN COMPONENT" *.abap
# → 对每个 ASSIGN COMPONENT，打开对应 metadata JSON 检查拼接变量的 DATATYPE 和 LENG
# → 如果是 NUMC，确认拼接后的字段名字符数 == 结构体字段名字符数
```

**预防**：
- 拼接时用 `iv_period+1(2)`（取后 2 位）或 `|HSL{ CONV numc2( iv_period ) }|`
- 每个 `ASSIGN COMPONENT` 后**必须**检查 `sy-subrc`，`≠ 0` 时记日志或显式赋值一个不可能被忽略的哨兵值（如 `-99999999`）

**独有补丁**：
```abap
" ✅ 正确：适配 NUMC 3 → 结构体 2 位字段名
lv_name = |HSL{ iv_period+1(2) }|.
ASSIGN COMPONENT lv_name OF STRUCTURE is_aggr TO <fs_val>.
IF sy-subrc <> 0.
  " 必须报错或设哨兵，禁止默默继续
  MESSAGE |字段名生成失败: { lv_name }| TYPE 'E'.
ENDIF.

" ❌ 错误：iv_period='001' → 'HSL001' → 找不到组件 → 返回 0
lv_name = |HSL{ iv_period }|.
```

---

## 4. RFC 连接诊断

每新会话无需启动后台进程。`rfc_client.js` 每次执行自动连接→请求→断开。

**分层排查**：
1. **DLL 层**：`node scripts/test_rfc.js` → 查看 `SAPNWRFC_HOME` + SDK lib 状态
2. **网络层**：`node scripts/rfc_client.js --discovery` → 确认 RFC 可达 SAP
3. **认证层**：核对 `.env` 中 `SAP_USERNAME`/`SAP_PASSWORD`/`SAP_CLIENT`
4. **数据层**：`node scripts/rfc_client.js --env=.env.data --discovery` → 确认数据系统

**常见错误**：
- `Error during logon` → 用户名/密码/客户端错误，或账号锁定
- `Connection refused` → SAP 实例未监听 RFC 端口，检查 `SAP_SYSNR`（**不可依赖端口推导**）
- `Router` 相关错误 → SAP_ROUTER 配置错误或 VPN 未连接

→ 自动安装流程见 [SKILL.md 阶段 0](SKILL.md)

---

## 一句话总结

**DDIC 用 rfc_client.js --sql --env=.env.data 逐表串行，结果写文件不占上下文。部署走 deploy_rfc.js，代码字段从契约来不用猜。**
