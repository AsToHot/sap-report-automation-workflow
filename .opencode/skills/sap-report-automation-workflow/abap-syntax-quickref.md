# ABAP 语法速查（报表开发 · 多版本兼容）

> 本速查覆盖 **ECC 6.0 → S4HANA → Cloud** 全谱系。每个模式标注最低版本要求。
> 图标：🔵 = ABAP 7.00+（全系可用）  🟢 = 7.40+（ECC EHP7/8、S4HANA）  🟠 = 7.50+（S4HANA 1709+）  🔴 = Cloud only
> 阶段 4 写代码时：打开本文件对照，禁止凭记忆写语法。完整语法追查 [SAP-samples/abap-cheat-sheets](https://github.com/SAP-samples/abap-cheat-sheets)。

---

## 1. 数据声明

### 基本类型
```abap
" 🔵 全系
DATA gv_count   TYPE i.
DATA gv_amount  TYPE p LENGTH 16 DECIMALS 2.
DATA gv_text    TYPE string.
DATA gv_date    TYPE d.

" 🟢 7.40+ 内联声明（简化：推荐在 S4HANA 中使用）
DATA(ls_bkpf) = ls_bkpf_raw.             " 从已有变量推导类型
SELECT * FROM bkpf INTO TABLE @DATA(lt_bkpf). " SELECT 内联

" 🔵 全系 — 基于 DDIC 类型
DATA gs_bkpf TYPE bkpf.
DATA gt_bkpf TYPE STANDARD TABLE OF bkpf.

" 🔵 全系 — 常量
CONSTANTS: gc_x TYPE c LENGTH 1 VALUE 'X',
           gc_e TYPE c LENGTH 1 VALUE 'E'.
```

### 自定义结构
```abap
" 🔵 全系
TYPES: BEGIN OF ty_out,
         bukrs TYPE bkpf-bukrs,
         gjahr TYPE bkpf-gjahr,
         dmbtr TYPE bseg-dmbtr,
       END OF ty_out.
TYPES ty_out_t TYPE STANDARD TABLE OF ty_out.

DATA gt_out TYPE ty_out_t.
DATA gs_out TYPE ty_out.
```

### DDIC 类型映射

| DDIC | ABAP | 说明 |
|------|------|------|
| CHAR | c LENGTH n | 定长字符 |
| NUMC | n LENGTH n | 数字文本 |
| DEC/CURR/QUAN | p LENGTH n DECIMALS m | 压缩数 |
| INT4 | i | 4 字节整数 |
| DATS | d | 日期 |
| TIMS | t | 时间 |
| STRG | string | 可变字符串 |
| FLTP | f | 浮点 |

---

## 2. 内表操作

### 声明
```abap
" 🔵 全系 — 标准表（ALV 输出）
DATA gt_out TYPE STANDARD TABLE OF ty_out.

" 🔵 全系 — 排序表 / 哈希表
DATA gt_data TYPE SORTED TABLE OF ty_struct WITH NON-UNIQUE KEY bukrs gjahr.
DATA gt_hash TYPE HASHED TABLE OF ty_struct WITH UNIQUE KEY bukrs gjahr belnr.

" 🟢 7.40+ — 内联 + 显式键（S4HANA 推荐）
DATA(gt_out) = VALUE ty_out_t( ).
```

### 填充
```abap
" 🔵 全系
APPEND gs_out TO gt_out.
INSERT gs_out INTO TABLE gt_data.

" 🔵 全系 — SELECT 直接填充
SELECT bukrs gjahr belnr FROM bkpf INTO TABLE gt_bkpf WHERE gjahr = p_gjahr.

" 🟢 7.40+ — VALUE 批量
gt_out = VALUE #( ( bukrs = '1000' dmbtr = 100 )
                  ( bukrs = '2000' dmbtr = 200 ) ).

" 🟢 7.40+ — CORRESPONDING 映射
gt_out = CORRESPONDING #( gt_raw MAPPING bukrs = comp_code ).
```

### 读取单行
```abap
" 🔵 全系 — READ TABLE（必须检查 sy-subrc）
READ TABLE gt_data INTO gs_data WITH TABLE KEY bukrs = '1000' gjahr = '2024'.
IF sy-subrc = 0. ... ENDIF.

" 🔵 全系 — BINARY SEARCH（SORTED TABLE）
READ TABLE gt_data INTO gs_data WITH KEY bukrs = '1000' BINARY SEARCH.

" 🔵 全系 — 字段符号（大结构避免拷贝；显式声明 + ASSIGN）
FIELD-SYMBOLS <fs> TYPE ty_out.
READ TABLE gt_out ASSIGNING <fs> WITH TABLE KEY bukrs = '1000'.
IF sy-subrc = 0. <fs>-dmbtr = <fs>-dmbtr + 100. ENDIF.

" 🟢 7.40+ — 表表达式（简洁；不存在抛 CX_SY_ITAB_LINE_NOT_FOUND）
DATA(ls_row) = gt_data[ bukrs = '1000' gjahr = '2024' ].

" 🟢 7.40+ — 安全取值
DATA(ls_safe) = VALUE #( gt_data[ key = 'X' ] OPTIONAL ).   " 不存在返回 INITIAL
IF line_exists( gt_data[ bukrs = '1000' ] ). ... ENDIF.     " 检查存在性
```

### 遍历
```abap
" 🔵 全系 — 工作区 LOOP
LOOP AT gt_out INTO gs_out. ... ENDLOOP.

" 🔵 全系 — 字段符号 LOOP（高频修改场景推荐）
LOOP AT gt_out ASSIGNING <fs_out>. <fs_out>-amount = <fs_out>-amount + 1. ENDLOOP.

" 🔵 全系 — 条件遍历
LOOP AT gt_out INTO gs_out WHERE bukrs = '1000'. ... ENDLOOP.

" 🔵 全系 — 排序
SORT gt_out BY bukrs gjahr.
SORT gt_out BY bukrs ASCENDING gjahr DESCENDING.

" 🟢 7.40+ — FOR 迭代（构造新内表）
DATA(lt_filtered) = VALUE ty_out_t( FOR row IN gt_out WHERE ( bukrs = '1000' ) ( row ) ).
```

### 修改 / 删除
```abap
" 🔵 全系
MODIFY gt_out FROM gs_out INDEX 5.
MODIFY TABLE gt_data FROM gs_out.          " 按键（SORTED/HASHED）
DELETE TABLE gt_data FROM gs_key.
DELETE gt_out WHERE amount = 0.

" 🟢 7.40+ — 表表达式赋值
gt_data[ bukrs = '1000' ] = gs_new.
```

---

## 3. Open SQL

### 基础 SELECT
```abap
" 🔵 全系 — 多行
SELECT bukrs gjahr belnr FROM bkpf INTO TABLE gt_bkpf WHERE gjahr = p_gjahr.

" 🔵 全系 — 单行
SELECT SINGLE * FROM bkpf INTO gs_bkpf WHERE bukrs = p_bukrs AND gjahr = p_gjahr AND belnr = p_belnr.

" 🔵 全系 — CORRESPONDING（列名匹配时使用）
SELECT * FROM bkpf INTO CORRESPONDING FIELDS OF TABLE gt_bkpf WHERE bukrs = p_bukrs.

" 🔵 全系 — APPENDING（追加到已有内表）
SELECT * FROM bseg APPENDING CORRESPONDING FIELDS OF TABLE gt_result
  FOR ALL ENTRIES IN gt_bkpf WHERE bukrs = gt_bkpf-bukrs AND gjahr = gt_bkpf-gjahr AND belnr = gt_bkpf-belnr.

" 🟢 7.40+ — 内联 SELECT（推荐）
SELECT bukrs, gjahr, belnr FROM bkpf INTO TABLE @DATA(lt_bkpf) WHERE gjahr = @p_gjahr.
```

### JOIN
```abap
" 🔵 全系 — INNER JOIN
SELECT a~bukrs a~gjahr a~belnr b~buzei b~hkont b~dmbtr
  FROM bkpf AS a INNER JOIN bseg AS b ON a~bukrs = b~bukrs AND a~gjahr = b~gjahr AND a~belnr = b~belnr
  INTO TABLE gt_joined WHERE a~bukrs = p_bukrs.

" 🔵 全系 — LEFT OUTER JOIN
SELECT a~bukrs a~belnr c~lifnr FROM bkpf AS a
  LEFT OUTER JOIN lfa1 AS c ON a~bukrs = c~bukrs
  INTO TABLE gt_left WHERE a~bukrs = p_bukrs.
```

### FOR ALL ENTRIES（🔵 全系）
```abap
" 硬规则：驱动表必须判非空 + 结果去重
IF gt_driver IS NOT INITIAL.
  SELECT bukrs gjahr belnr buzei hkont dmbtr FROM bseg
    INTO TABLE gt_bseg FOR ALL ENTRIES IN gt_driver
    WHERE bukrs = gt_driver-bukrs AND gjahr = gt_driver-gjahr AND belnr = gt_driver-belnr.
  SORT gt_bseg BY bukrs gjahr belnr buzei.
  DELETE ADJACENT DUPLICATES FROM gt_bseg COMPARING bukrs gjahr belnr buzei.
ENDIF.
```

### 聚合 / 分组（🔵 全系）
```abap
SELECT bukrs gjahr COUNT(*) AS cnt SUM( dmbtr ) AS sum_dmbtr
  FROM bseg INTO TABLE gt_agg WHERE bukrs = p_bukrs GROUP BY bukrs gjahr.
```

### 🟢 7.50+ 高级特性（仅在 S4HANA 1709+ 使用）
```abap
" 内表作为数据源
SELECT bukrs gjahr belnr FROM @gt_bkpf AS a
  INNER JOIN @gt_bseg AS b ON a~bukrs = b~bukrs AND a~gjahr = b~gjahr AND a~belnr = b~belnr
  INTO TABLE @DATA(lt_result).

" CTE (WITH)
WITH +agg AS ( SELECT bukrs gjahr SUM( dmbtr ) AS total FROM bseg GROUP BY bukrs gjahr )
  SELECT a~bukrs a~belnr +agg~total FROM bkpf AS a INNER JOIN +agg ON a~bukrs = +agg~bukrs AND a~gjahr = +agg~gjahr
  INTO TABLE @DATA(lt_cte) WHERE a~bukrs = @p_bukrs.
```

---

## 4. WHERE 条件速查

| 运算符 | 含义 | 示例 | 版本 |
|--------|------|------|------|
| `=`, `EQ` | 等于 | `bukrs = '1000'` | 🔵 |
| `<>`, `NE` | 不等于 | `bukrs <> '1000'` | 🔵 |
| `<`, `>`, `<=`, `>=` | 比较 | `gjahr >= '2024'` | 🔵 |
| `BETWEEN` | 区间 | `budat BETWEEN '20240101' AND '20241231'` | 🔵 |
| `LIKE` | 模式匹配 | `belnr LIKE '01%'` | 🔵 |
| `IN` | 值列表/范围表 | `bukrs IN @s_bukrs` | 🔵 |
| `IS INITIAL` | 初始值 | `xreversal IS INITIAL` | 🔵 |
| `IS NULL` | 空值 | `c~lifnr IS NULL` | 🔵 |

### Ranges / SELECT-OPTIONS（🔵 全系）
```abap
SELECT-OPTIONS: s_bukrs FOR bkpf-bukrs, s_budat FOR bkpf-budat.
" SQL 中直接用：WHERE bukrs IN @s_bukrs
" LOOP 中直接用：LOOP AT gt_out INTO gs_out WHERE bukrs IN s_bukrs.
```

---

## 5. 选择屏幕（🔵 全系）

```abap
PARAMETERS: p_bukrs TYPE bukrs OBLIGATORY DEFAULT '1000',
            p_gjahr TYPE gjahr OBLIGATORY DEFAULT sy-datum(4),
            p_xrev  AS CHECKBOX DEFAULT 'X',
            p_r1    RADIOBUTTON GROUP gr1 DEFAULT 'X'.

SELECT-OPTIONS: s_bukrs FOR bkpf-bukrs NO INTERVALS,
                s_budat FOR bkpf-budat DEFAULT sy-datum.

SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE TEXT-001.
  PARAMETERS p_bukrs TYPE bukrs OBLIGATORY.
SELECTION-SCREEN END OF BLOCK b1.

INITIALIZATION.
AT SELECTION-SCREEN OUTPUT.
AT SELECTION-SCREEN.            " 输入校验
START-OF-SELECTION.             " 主逻辑
```

---

## 6. ALV 输出

### CL_SALV_TABLE（🟢 7.40+，推荐）
```abap
DATA go_alv TYPE REF TO cl_salv_table.

TRY.
    cl_salv_table=>factory( IMPORTING r_salv_table = go_alv CHANGING t_table = gt_out ).
  CATCH cx_salv_msg INTO DATA(lx_msg).
    MESSAGE lx_msg TYPE 'E'.
ENDTRY.

go_alv->get_columns( )->set_optimize( abap_true ).
go_alv->get_display_settings( )->set_striped_pattern( cl_salv_display_settings=>true ).
go_alv->display( ).
```

### 列设置
```abap
DATA(lo_cols) = go_alv->get_columns( ).
TRY.
    CAST cl_salv_column_table( lo_cols->get_column( 'BUKRS' ) )->set_short_text( '公司代码' ).
    lo_cols->get_column( 'BUKRS' )->set_cell_type( if_salv_c_cell_type=>hotspot ).
    lo_cols->get_column( 'TEMP' )->set_visible( abap_false ).
  CATCH cx_salv_not_found.
ENDTRY.
```

### 双击穿透（🟢 7.40+）
```abap
CLASS lcl_events DEFINITION.
  PUBLIC SECTION.
    CLASS-METHODS on_double_click FOR EVENT double_click OF cl_salv_events_table IMPORTING row column.
ENDCLASS.
CLASS lcl_events IMPLEMENTATION.
  METHOD on_double_click.
    READ TABLE gt_out INTO DATA(ls) INDEX row.
    IF sy-subrc = 0 AND column = 'BELNR'.
      SET PARAMETER ID 'BLN' FIELD ls-belnr.
      CALL TRANSACTION 'FB03' AND SKIP FIRST SCREEN.
    ENDIF.
  ENDMETHOD.
ENDCLASS.
" 注册：SET HANDLER lcl_events=>on_double_click FOR go_alv->get_event( ).
```

> **GUI Status**：CL_SALV_TABLE **自带工具栏**，无需自定义 GUI 状态，不要尝试 SE41。选择屏幕文本用 `%_xxx_%_app_%-text` 或 `SELECTION_TEXTS_MODIFY` 运行时设置，详见 SKILL.md §选择屏幕文本元素处理。

---

## 7. 字符串与数值
```abap
" 🔵 全系
CONCATENATE lv_a lv_b INTO lv_c SEPARATED BY space.
lv_len = strlen( lv_text ).
lv_sub = lv_text+0(10).          " 子串：偏移+长度
TRANSLATE lv_text TO UPPER CASE.
CONDENSE lv_text NO-GAPS.
WRITE lv_total TO lv_text CURRENCY 'CNY'.  " 数值格式化

" 🟢 7.40+ 字符串模板
lv_result = |{ lv_a } { lv_b }|.
```

---

## 8. 程序骨架（REPORT + INCLUDE 分层）
```abap
" 主程序 <name>.abap
REPORT zsap_fixxx.
INCLUDE zsap_fixxxt01.  " TOP: 类型/数据
INCLUDE zsap_fixxxsel.  " 选择屏幕
INCLUDE zsap_fixxxf01.  " FORM 子程序

INITIALIZATION.
AT SELECTION-SCREEN OUTPUT.
AT SELECTION-SCREEN.
START-OF-SELECTION.
  PERFORM get_data.
  PERFORM display_alv.
```

**INCLUDE 分工**：
| Include | 内容 | 禁止 |
|---------|------|------|
| T01 | TYPES、DATA、CONSTANTS、FIELD-SYMBOLS | 不放可执行代码 |
| SEL | PARAMETERS、SELECT-OPTIONS | 不放数据处理 |
| F01 | FORM 子程序（get_data / fill_output / authority_check） | 不放 REPORT 顶层事件 |

---

## 9. FORM 子程序（🔵 全系）
```abap
FORM get_data.
  SELECT bukrs gjahr belnr FROM bkpf INTO TABLE gt_bkpf WHERE bukrs = p_bukrs.
  IF sy-subrc <> 0. MESSAGE '未找到数据' TYPE 'S'. RETURN. ENDIF.
ENDFORM.

FORM fill_output USING pv_bukrs TYPE bukrs CHANGING ct_out TYPE ty_out_t.
  " ... ct_out 直接修改 ...
ENDFORM.

" 调用
PERFORM fill_output USING p_bukrs CHANGING gt_out.
```

---

## 10. Function Module 调用（🔵 全系）
```abap
CALL FUNCTION 'BAPI_COMPANYCODE_GETDETAIL'
  EXPORTING companycodeid = p_bukrs
  IMPORTING companycode_detail = gs_detail
  EXCEPTIONS not_found = 1 OTHERS = 2.
IF sy-subrc <> 0. MESSAGE ID sy-msgid TYPE sy-msgty NUMBER sy-msgno WITH sy-msgv1 sy-msgv2 sy-msgv3 sy-msgv4. ENDIF.
```

---

## 11. 全局类（OO 模式）

### 骨架（🔵 全系）
```abap
CLASS zcl_xxx DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS constructor IMPORTING iv_key TYPE char10 OPTIONAL.
    METHODS get_data RETURNING VALUE(rt_out) TYPE ty_out_t RAISING cx_static_check.
    CLASS-METHODS create IMPORTING iv_key TYPE char10 RETURNING VALUE(ro) TYPE REF TO zcl_xxx.
  PRIVATE SECTION.
    DATA mv_key TYPE char10.
ENDCLASS.

CLASS zcl_xxx IMPLEMENTATION.
  METHOD constructor. mv_key = iv_key. ENDMETHOD.
  METHOD create. CREATE OBJECT ro EXPORTING iv_key = iv_key. ENDMETHOD.
  METHOD get_data. SELECT * FROM dbtab INTO TABLE rt_out WHERE key = mv_key. ENDMETHOD.
ENDCLASS.

" 调用
DATA lo TYPE REF TO zcl_xxx. CREATE OBJECT lo EXPORTING iv_key = '1000'.
DATA(lt) = lo->get_data( ).
```

### 🟢 7.40+ 简写
```abap
DATA(lo) = NEW zcl_xxx( iv_key = '1000' ).        " NEW 实例化
DATA(lo2) = zcl_xxx=>create( iv_key = '1000' ).    " 静态工厂
```

### 设计模式速查（🔵 全系基础，🟢 语法更简洁）
- **Singleton**：`CREATE PRIVATE` + 静态 `go_instance` + `get_instance( )` 懒加载
- **DAO**：封装单表 CRUD，方法 `get_by_key( )`、`get_list( )`
- **Factory**：`CLASS-METHODS create_dao RETURNING VALUE(ro) TYPE REF TO zif_dao`
- **链式调用**（🟢）：`METHOD add_field RETURNING VALUE(ro) TYPE REF TO zcl_builder. ro = me. ENDMETHOD.`

---

## 12. 接口（🔵 全系）
```abap
INTERFACE zif_dao PUBLIC.
  CONSTANTS gc_active TYPE c LENGTH 1 VALUE 'A'.
  METHODS get_by_key IMPORTING iv_bukrs TYPE bukrs iv_gjahr TYPE gjahr RETURNING VALUE(rs) TYPE ty_result RAISING cx_static_check.
  METHODS save IMPORTING is_data TYPE ty_result RAISING cx_static_check.
ENDINTERFACE.

" 实现
CLASS zcl_dao DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION. INTERFACES zif_dao. ALIASES get_data FOR zif_dao~get_by_key.
ENDCLASS.
CLASS zcl_dao IMPLEMENTATION.
  METHOD zif_dao~get_by_key. SELECT SINGLE * FROM dbtab INTO rs WHERE bukrs = iv_bukrs AND gjahr = iv_gjahr. ENDMETHOD.
  METHOD zif_dao~save. MODIFY dbtab FROM is_data. ENDMETHOD.
ENDCLASS.
```

---

## 13. Function Module（🔵 全系）
```abap
FUNCTION zfm_get_data.
*" IMPORTING VALUE(IV_BUKRS) TYPE BUKRS
*" EXPORTING VALUE(ET_DATA) TYPE TY_OUT_T
*" EXCEPTIONS NO_DATA_FOUND INVALID_INPUT
  IF iv_bukrs IS INITIAL. RAISE invalid_input. ENDIF.
  SELECT * FROM bkpf INTO TABLE et_data WHERE bukrs = iv_bukrs.
  IF sy-subrc <> 0. RAISE no_data_found. ENDIF.
ENDFUNCTION.

" RFC 模式
FUNCTION zfm_rfc_get_data REMOTE. ... ENDFUNCTION.
```

---

## 14. 性能反模式（全版本通用，必须自查）

> 来源：SAP 官方性能指南 + 柏玺 ABAP 开发标准 V2.1 §5。

### 14.1 数据库访问

| 反模式 | 正确做法 |
|--------|---------|
| `SELECT *` 无 WHERE | 指定字段 + WHERE（利用索引） |
| LOOP 内 SELECT（嵌套 DB 访问） | JOIN / FOR ALL ENTRIES / 先取到内表再处理 |
| 逐行 INSERT/UPDATE/DELETE | 批量操作（`INSERT ... FROM TABLE` / `MODIFY ... FROM TABLE`） |
| `EXEC SQL ... END-EXEC` 直接访问数据库 | 禁止：绕过 DDIC 检查，破坏系统完整性 |
| 聚合值手动 LOOP 累加 | SELECT 中用 `MAX`/`MIN`/`SUM`/`AVG` 函数 |
| SELECT 后不检查 sy-subrc | 每条 SELECT 后必须检查 |

### 14.2 WHERE 条件

| 反模式 | 正确做法 |
|--------|---------|
| WHERE 中 `LIKE` / `NOT` / `<>` | 避免否定条件；优先使用 `EQ` / `IN` / `BETWEEN` |
| WHERE 条件排列无序 | 排列顺序匹配目标表索引/主键字段顺序 |
| 已知完整主键仍用 `SELECT ... UP TO 1 ROWS` | `SELECT SINGLE`（更高效） |
| `FOR ALL ENTRIES` 驱动表可能空 | `IF gt_driver IS NOT INITIAL` 判非空 + 驱动表提前 `SORT` + 结果 `DELETE ADJACENT DUPLICATES` |
| `FOR ALL ENTRIES`（大驱动表） | 7.50+ 优先用 `INNER JOIN @itab` 代替（去重） |

### 14.3 内表操作

| 反模式 | 正确做法 |
|--------|---------|
| `READ TABLE ... WITH KEY`（线性搜索，O(n)） | `WITH TABLE KEY`（HASHED）或 `BINARY SEARCH`（SORTED） |
| **`READ TABLE ... BINARY SEARCH` 但未先 SORT** | **必须**先 `SORT itab BY key_fields`；否则二分法结果不可预测 |
| LOOP 用工作区（大结构逐行拷贝） | 用 `FIELD-SYMBOL` (`ASSIGNING <fs>`) |
| **LOOP 内嵌套 LOOP（N:M 关联）** | SORT + READ TABLE BINARY SEARCH 替代内层 LOOP；或使用 SORTED TABLE / HASHED TABLE |
| LOOP 全表 + `CHECK` 条件过滤 | `LOOP ... WHERE ...` 直接过滤（更快） |
| 条件满足后继续无意义循环 | 用 `EXIT` 跳出（如已找到唯一匹配行） |
| `COLLECT`（数值累加场景不需要去重时） | `APPEND` 代替；`COLLECT` 有隐式比较开销 |
| `MOVE-CORRESPONDING`（大结构字段映射） | 逐字段手动赋值 或 同构内表直接 `APPEND LINES OF` |
| `FREE itab` 后立即重新填充 | `CLEAR` / `REFRESH` |
| 字符比较用 IN | 用 `EQ`；长串匹配用 `CO`/`CA` 特殊操作符 |

### 14.4 控制流

| 反模式 | 正确做法 |
|--------|---------|
| 重复 `IF ... ELSEIF ...` 链（变体 > 3） | 用 `CASE ... WHEN ... ENDCASE` |
| `CASE` 缺少 `WHEN OTHERS` | 所有 CASE 必须有 `WHEN OTHERS` 兜底 |
| WHEN 分支概率无序 | 按出现概率由高到低排列 WHEN 分支 |
| FORM 超过 200 行 | 拆分为多个小 FORM，每个职责单一 |
| LOOP/IF/CASE 深层嵌套 (>3 层) | 拆解为独立子程序或使用提前 `EXIT`/`CONTINUE` 减少嵌套 |

### 14.5 其他

| 反模式 | 正确做法 |
|--------|---------|
| Hard Coding（写死变量值） | 用配置表（`TVARVC`）或选择屏参数 |
| 程序中无权限检查 | `AUTHORITY-CHECK` 必须整合进所有开发程序 |
| Z 表物理删除无日志 | 物理删除前记录 log 表（时间、删除人、数据） |
| 选择屏 PARAMETERS/SELECT-OPTIONS 无默认值 | 提供默认值或必输约束，减少无效全表扫描 |

### 嵌套 LOOP 替代标准模式（新增）

**模式**：SORT + READ TABLE BINARY SEARCH 替代内层 LOOP

```abap
" ❌ 反模式：嵌套 LOOP（O(N*M)）
LOOP AT gt_header ASSIGNING <fs_h>.
  LOOP AT gt_items ASSIGNING <fs_i> WHERE bukrs = <fs_h>-bukrs
                                      AND gjahr = <fs_h>-gjahr
                                      AND belnr = <fs_h>-belnr.
    " 处理匹配行...
  ENDLOOP.
ENDLOOP.

" ✅ 正确：SORT + BINARY SEARCH（O(N*logM)）
SORT gt_items BY bukrs gjahr belnr.
LOOP AT gt_header ASSIGNING <fs_h>.
  READ TABLE gt_items TRANSPORTING NO FIELDS
    WITH KEY bukrs = <fs_h>-bukrs gjahr = <fs_h>-gjahr belnr = <fs_h>-belnr
    BINARY SEARCH.
  IF sy-subrc = 0.
    DATA(lv_index) = sy-tabix.
    LOOP AT gt_items ASSIGNING <fs_i> FROM lv_index.
      IF <fs_i>-bukrs <> <fs_h>-bukrs
      OR <fs_i>-gjahr <> <fs_h>-gjahr
      OR <fs_i>-belnr <> <fs_h>-belnr.
        EXIT.
      ENDIF.
      " 处理匹配行...
    ENDLOOP.
  ENDIF.
ENDLOOP.
```

```abap
" ✅ 更优：SORTED TABLE / HASHED TABLE（声明时定义键）
DATA gt_items TYPE SORTED TABLE OF ty_item
  WITH NON-UNIQUE KEY bukrs gjahr belnr.

LOOP AT gt_header ASSIGNING <fs_h>.
  READ TABLE gt_items ASSIGNING <fs_i>
    WITH TABLE KEY bukrs = <fs_h>-bukrs gjahr = <fs_h>-gjahr belnr = <fs_h>-belnr.
  IF sy-subrc = 0.
    DATA(lv_idx) = sy-tabix.
    LOOP AT gt_items ASSIGNING <fs_i> FROM lv_idx.
      IF <fs_i>-bukrs <> <fs_h>-bukrs OR <fs_i>-gjahr <> <fs_h>-gjahr OR <fs_i>-belnr <> <fs_h>-belnr.
        EXIT.
      ENDIF.
      " 处理匹配行...
    ENDLOOP.
  ENDIF.
ENDLOOP.
```

### 代码生成后逐项自查（阶段 4 末强制）

**DB 层**：
- [ ] 所有 `SELECT` 都有 WHERE 条件且字段列表明确（非 `*` 除非确需全字段）
- [ ] 无 LOOP 内 SELECT
- [ ] 无 `EXEC SQL ... END-EXEC`
- [ ] 聚合使用了 SQL 函数（MAX/MIN/SUM/AVG），非手动 LOOP 累加
- [ ] 每条 SELECT 后检查 `sy-subrc`

**WHERE 层**：
- [ ] `FOR ALL ENTRIES` 前有 `IF ... IS NOT INITIAL`，驱动表已 SORT，结果已去重
- [ ] WHERE 字段排列匹配索引/主键顺序
- [ ] 避免 `LIKE` / `NOT` / `<>`（确需时标注理由）
- [ ] 已知完整主键优先使用 `SELECT SINGLE`

**内表层**：
- [ ] 无嵌套 LOOP（如有 → 已替换为 SORT + READ TABLE BINARY SEARCH 或 SORTED/HASHED TABLE）
- [ ] 大结构 LOOP 使用 `ASSIGNING <fs>`（非 `INTO`）
- [ ] 无条件满足后的无效循环（有 `EXIT` 退出）
- [ ] `READ TABLE ... BINARY SEARCH` 前有对应的 `SORT`
- [ ] `READ TABLE` 优先使用 `WITH TABLE KEY`（SORTED/HASHED）或 `BINARY SEARCH`
- [ ] 无 `MOVE-CORRESPONDING` 滥用（大结构时手动赋值）
- [ ] 无 `COLLECT` 用于不需去重的场景

**控制流与规范**：
- [ ] 所有 `CASE` 有 `WHEN OTHERS`
- [ ] 无 Hard Coding（动态值来自配置表 TVARVC 或选择屏参数）
- [ ] 有 `AUTHORITY-CHECK` 权限检查
- [ ] Z 表物理删除有 log 表记录
- [ ] 每个 FORM ≤ 200 行

---

## 外部参考

本速查覆盖工作流最高频模式。未覆盖的完整语法追查：

| 主题 | 官方 Cheat Sheet |
|------|------------------|
| 内表完整语法 | [01_Internal_Tables](https://github.com/SAP-samples/abap-cheat-sheets/blob/main/01_Internal_Tables.md) |
| Open SQL 完整语法 | [03_ABAP_SQL](https://github.com/SAP-samples/abap-cheat-sheets/blob/main/03_ABAP_SQL.md) |
| OO 面向对象 | [04_ABAP_Object_Orientation](https://github.com/SAP-samples/abap-cheat-sheets/blob/main/04_ABAP_Object_Orientation.md) |
| OO 设计模式 | [34_OO_Design_Patterns](https://github.com/SAP-samples/abap-cheat-sheets/blob/main/34_OO_Design_Patterns.md) |
| 选择屏幕与列表 | [20_Selection_Screens_Lists](https://github.com/SAP-samples/abap-cheat-sheets/blob/main/20_Selection_Screens_Lists.md) |
| WHERE 条件大全 | [31_WHERE_Conditions](https://github.com/SAP-samples/abap-cheat-sheets/blob/main/31_WHERE_Conditions.md) |
| 性能优化 | [32_Performance_Notes](https://github.com/SAP-samples/abap-cheat-sheets/blob/main/32_Performance_Notes.md) |
| 异常处理 | [27_Exceptions](https://github.com/SAP-samples/abap-cheat-sheets/blob/main/27_Exceptions.md) |
