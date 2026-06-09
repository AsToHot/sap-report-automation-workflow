*&---------------------------------------------------------------------*
*&  包含                ZTEST102T01
*&  科目余额表 - 数据与类定义
*&---------------------------------------------------------------------
TABLES: faglflext, zsap_bukrs.

*&---------------------------------------------------------------------*
* ALV
*&---------------------------------------------------------------------*
DATA: gr_alv TYPE REF TO cl_salv_table.

*&---------------------------------------------------------------------*
* FAGLFLEXT 原始数据内表
*&---------------------------------------------------------------------*
TYPES: BEGIN OF ty_faglflext,
         racct  TYPE racct,
         rbukrs TYPE bukrs,
         prctr  TYPE prctr,
         rfare  TYPE fkber,
         ryear  TYPE gjahr,
         rpmax  TYPE rpmax,
         drcrk  TYPE shkzg,
         rTCUR  TYPE rTCUR,
         hslvt  TYPE hslvt12,
         hsl01  TYPE hslxx12,
         hsl02  TYPE hslxx12,
         hsl03  TYPE hslxx12,
         hsl04  TYPE hslxx12,
         hsl05  TYPE hslxx12,
         hsl06  TYPE hslxx12,
         hsl07  TYPE hslxx12,
         hsl08  TYPE hslxx12,
         hsl09  TYPE hslxx12,
         hsl10  TYPE hslxx12,
         hsl11  TYPE hslxx12,
         hsl12  TYPE hslxx12,
         hsl13  TYPE hslxx12,
         hsl14  TYPE hslxx12,
         hsl15  TYPE hslxx12,
         hsl16  TYPE hslxx12,
         tslvt  TYPE tslvt12,
         tsl01  TYPE tslxx12,
         tsl02  TYPE tslxx12,
         tsl03  TYPE tslxx12,
         tsl04  TYPE tslxx12,
         tsl05  TYPE tslxx12,
         tsl06  TYPE tslxx12,
         tsl07  TYPE tslxx12,
         tsl08  TYPE tslxx12,
         tsl09  TYPE tslxx12,
         tsl10  TYPE tslxx12,
         tsl11  TYPE tslxx12,
         tsl12  TYPE tslxx12,
         tsl13  TYPE tslxx12,
         tsl14  TYPE tslxx12,
         tsl15  TYPE tslxx12,
         tsl16  TYPE tslxx12,
       END OF ty_faglflext.

DATA: gt_faglflext TYPE TABLE OF ty_faglflext.

*&---------------------------------------------------------------------*
* 输出结构（本币 + 外币）
*&---------------------------------------------------------------------*
DATA: BEGIN OF gs_data,
        zyjkm  TYPE char4,          " 一级节点
        racct  TYPE racct,          " 科目编码
        txt50  TYPE txt50_skat,     " 科目描述
        zfzhs  TYPE char64,         " 核算维度编码
        zfztx  TYPE char50,         " 核算维度名称
        zqcjf  TYPE hslxx12,        " 期初余额借方
        zqcdf  TYPE hslxx12,        " 期初余额贷方
        zbqjf  TYPE hslxx12,        " 本期发生借方
        zbqdf  TYPE hslxx12,        " 本期发生贷方
        zbnjf  TYPE hslxx12,        " 本年累计借方
        zbndf  TYPE hslxx12,        " 本年累计贷方
        zqmjf  TYPE hslxx12,        " 期末余额借方
        zqmdf  TYPE hslxx12,        " 期末余额贷方
        zqcjf1 TYPE tslxx12,        " 期初余额借方(外币)
        zqcdf1 TYPE tslxx12,        " 期初余额贷方(外币)
        zbqjf1 TYPE tslxx12,        " 本期发生借方(外币)
        zbqdf1 TYPE tslxx12,        " 本期发生贷方(外币)
        zbnjf1 TYPE tslxx12,        " 本年累计借方(外币)
        zbndf1 TYPE tslxx12,        " 本年累计贷方(外币)
        zqmjf1 TYPE tslxx12,        " 期末余额借方(外币)
        zqmdf1 TYPE tslxx12,        " 期末余额贷方(外币)
      END OF gs_data.

DATA: gt_data LIKE TABLE OF gs_data.

*&---------------------------------------------------------------------*
* ZSAP_BUKRS 映射
*&---------------------------------------------------------------------*
DATA: BEGIN OF gs_bukrs,
        bukrs TYPE ze_bukrs,
        zfgs  TYPE ze_fgsbs,
        zzgs  TYPE bukrs,
        prctr TYPE prctr,
        ltext TYPE ltext,
      END OF gs_bukrs.

*&---------------------------------------------------------------------*
* 类定义 - 工具栏事件
*&---------------------------------------------------------------------*
CLASS lcl_handle_events DEFINITION.
  PUBLIC SECTION.
    METHODS:
      on_user_command FOR EVENT added_function OF cl_salv_events
        IMPORTING e_salv_function,
      on_double_click FOR EVENT double_click OF cl_salv_events_table
        IMPORTING row column.
ENDCLASS.

DATA: gr_events TYPE REF TO lcl_handle_events.

*&---------------------------------------------------------------------*
* 全局 — 期间范围（FORM 间共享）
*&---------------------------------------------------------------------*
DATA: gv_pfrom_i TYPE i,
      gv_pto_i   TYPE i.

*&---------------------------------------------------------------------*
* 全局 — 维度描述内表（FORM 间共享）
*&---------------------------------------------------------------------*
DATA: gt_skat TYPE TABLE OF skat WITH KEY saknr,
      gt_ska1 TYPE TABLE OF ska1 WITH KEY saknr,
      gt_tfkbt TYPE TABLE OF tfkbt WITH KEY fkber.
