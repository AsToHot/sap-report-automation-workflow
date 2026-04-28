*&---------------------------------------------------------------------*
*&  包含                ZSAP_FI254T01
*&  科目余额表 - 数据与类定义
*&---------------------------------------------------------------------
TABLES: faglflext, zsap_bukrs, ska1, skat, tfkbt.

*&---------------------------------------------------------------------*
* 全局类型
*&---------------------------------------------------------------------*
TYPES: BEGIN OF ty_sum,
         racct  TYPE racct,
         drcrk  TYPE shkzg,
         hslvt  TYPE hslvt12,
         hsl01  TYPE hslxx12, hsl02 TYPE hslxx12, hsl03 TYPE hslxx12,
         hsl04  TYPE hslxx12, hsl05 TYPE hslxx12, hsl06 TYPE hslxx12,
         hsl07  TYPE hslxx12, hsl08 TYPE hslxx12, hsl09 TYPE hslxx12,
         hsl10  TYPE hslxx12, hsl11 TYPE hslxx12, hsl12 TYPE hslxx12,
         hsl13  TYPE hslxx12, hsl14 TYPE hslxx12, hsl15 TYPE hslxx12,
         hsl16  TYPE hslxx12,
         tslvt  TYPE tslvt12,
         tsl01  TYPE tslxx12, tsl02 TYPE tslxx12, tsl03 TYPE tslxx12,
         tsl04  TYPE tslxx12, tsl05 TYPE tslxx12, tsl06 TYPE tslxx12,
         tsl07  TYPE tslxx12, tsl08 TYPE tslxx12, tsl09 TYPE tslxx12,
         tsl10  TYPE tslxx12, tsl11 TYPE tslxx12, tsl12 TYPE tslxx12,
         tsl13  TYPE tslxx12, tsl14 TYPE tslxx12, tsl15 TYPE tslxx12,
         tsl16  TYPE tslxx12,
       END OF ty_sum.

*&---------------------------------------------------------------------*
* ALV
*&---------------------------------------------------------------------*
DATA: gr_alv TYPE REF TO cl_salv_table.

*&---------------------------------------------------------------------*
* 科目余额表显示结构
*&---------------------------------------------------------------------*
DATA: BEGIN OF gs_out,
        zyjkm   TYPE char4,          " 一级节点
        racct   TYPE racct,           " 科目编码
        txt50   TYPE txt50_skat,      " 科目描述
        zfzhs   TYPE char64,          " 核算维度编码
        zfztx   TYPE char50,          " 核算维度名称
        zqcjf   TYPE hslvt12,         " 期初余额借方
        zqcdf   TYPE hslvt12,         " 期初余额贷方
        zbqjf   TYPE hslxx12,         " 本期发生借方
        zbqdf   TYPE hslxx12,         " 本期发生贷方
        zbnjf   TYPE hslxx12,         " 本年累计借方
        zbndf   TYPE hslxx12,         " 本年累计贷方
        zqmjf   TYPE hslvt12,         " 期末余额借方
        zqmdf   TYPE hslvt12,         " 期末余额贷方
        zqcjf1  TYPE tslvt12,         " 期初余额借方（外币）
        zqcdf1  TYPE tslvt12,         " 期初余额贷方（外币）
        zbqjf1  TYPE tslxx12,         " 本期发生借方（外币）
        zbqdf1  TYPE tslxx12,         " 本期发生贷方（外币）
        zbnjf1  TYPE tslxx12,         " 本年累计借方（外币）
        zbndf1  TYPE tslxx12,         " 本年累计贷方（外币）
        zqmjf1  TYPE tslvt12,         " 期末余额借方（外币）
        zqmdf1  TYPE tslvt12,         " 期末余额贷方（外币）
      END OF gs_out.

DATA: gt_out LIKE TABLE OF gs_out.

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
