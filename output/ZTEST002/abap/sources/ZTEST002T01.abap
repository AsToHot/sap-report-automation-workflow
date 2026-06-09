*&---------------------------------------------------------------------*
*&  包含                ZTEST002T01
*&  科目余额表 - 数据与类定义
*&---------------------------------------------------------------------
TABLES: faglflext, zsap_bukrs, skat, ska1, cepc, tfkbt.

*&---------------------------------------------------------------------*
* ALV
*&---------------------------------------------------------------------*
DATA: gr_alv TYPE REF TO cl_salv_table.

*&---------------------------------------------------------------------*
* 科目余额表输出结构
*&---------------------------------------------------------------------*
TYPES: BEGIN OF ty_out,
         zyjk   TYPE c LENGTH 4,    " 一级节点
         racct  TYPE faglflext-racct, " 科目编码
         txt50  TYPE skat-txt50,    " 科目描述
         zfzhs  TYPE ska1-zfkyh,    " 核算维度编码
         zfztx  TYPE ska1-zyhzh,    " 核算维度名称
         zqcjf  TYPE hslvt12, " 期初余额借方
         zqcdf  TYPE hslvt12, " 期初余额贷方
         zbqjf  TYPE hslvt12, " 本期发生借方
         zbqdf  TYPE hslvt12, " 本期发生贷方
         zbnjf  TYPE hslvt12, " 本年累计借方
         zbndf  TYPE hslvt12, " 本年累计贷方
         zqmjf  TYPE hslvt12, " 期末余额借方
         zqmdf  TYPE hslvt12, " 期末余额贷方
         zqcjf1 TYPE hslvt12, " 期初余额借方(外币)
         zqcdf1 TYPE hslvt12, " 期初余额贷方(外币)
         zbqjf1 TYPE hslvt12, " 本期发生借方(外币)
         zbqdf1 TYPE hslvt12, " 本期发生贷方(外币)
         zbnjf1 TYPE hslvt12, " 本年累计借方(外币)
         zbndf1 TYPE hslvt12, " 本年累计贷方(外币)
         zqmjf1 TYPE hslvt12, " 期末余额借方(外币)
         zqmdf1 TYPE hslvt12, " 期末余额贷方(外币)
         rtcur  TYPE faglflext-rtcur, " 外币币别
       END OF ty_out.

DATA: gs_out TYPE ty_out,
      gt_out TYPE STANDARD TABLE OF ty_out.

*&---------------------------------------------------------------------*
* FAGLFLEXT 原始数据暂存
*&---------------------------------------------------------------------*
TYPES: BEGIN OF ty_flex,
         racct  TYPE faglflext-racct,
         drcrk  TYPE faglflext-drcrk,
         rpmax  TYPE faglflext-rpmax,
         rbukrs TYPE faglflext-rbukrs,
         prctr  TYPE faglflext-prctr,
         rfarea TYPE faglflext-rfarea,
         rtcur  TYPE faglflext-rtcur,
         hslvt  TYPE faglflext-hslvt,
         hsl01  TYPE faglflext-hsl01,
         hsl02  TYPE faglflext-hsl02,
         hsl03  TYPE faglflext-hsl03,
         hsl04  TYPE faglflext-hsl04,
         hsl05  TYPE faglflext-hsl05,
         hsl06  TYPE faglflext-hsl06,
         hsl07  TYPE faglflext-hsl07,
         hsl08  TYPE faglflext-hsl08,
         hsl09  TYPE faglflext-hsl09,
         hsl10  TYPE faglflext-hsl10,
         hsl11  TYPE faglflext-hsl11,
         hsl12  TYPE faglflext-hsl12,
         hsl13  TYPE faglflext-hsl13,
         hsl14  TYPE faglflext-hsl14,
         hsl15  TYPE faglflext-hsl15,
         hsl16  TYPE faglflext-hsl16,
         tslvt  TYPE faglflext-tslvt,
         tsl01  TYPE faglflext-tsl01,
         tsl02  TYPE faglflext-tsl02,
         tsl03  TYPE faglflext-tsl03,
         tsl04  TYPE faglflext-tsl04,
         tsl05  TYPE faglflext-tsl05,
         tsl06  TYPE faglflext-tsl06,
         tsl07  TYPE faglflext-tsl07,
         tsl08  TYPE faglflext-tsl08,
         tsl09  TYPE faglflext-tsl09,
         tsl10  TYPE faglflext-tsl10,
         tsl11  TYPE faglflext-tsl11,
         tsl12  TYPE faglflext-tsl12,
         tsl13  TYPE faglflext-tsl13,
         tsl14  TYPE faglflext-tsl14,
         tsl15  TYPE faglflext-tsl15,
         tsl16  TYPE faglflext-tsl16,
       END OF ty_flex.

DATA: gt_flex TYPE STANDARD TABLE OF ty_flex.

*&---------------------------------------------------------------------*
* 公司代码映射
*&---------------------------------------------------------------------*
TYPES: BEGIN OF ty_bukrs_map,
         bukrs TYPE zsap_bukrs-bukrs,
         zfgs  TYPE zsap_bukrs-zfgs,
         zzgs  TYPE zsap_bukrs-zzgs,
         prctr TYPE zsap_bukrs-prctr,
       END OF ty_bukrs_map.

DATA: gs_bukrs_map TYPE ty_bukrs_map.

*&---------------------------------------------------------------------*
* CEPC 利润中心组
*&---------------------------------------------------------------------*
TYPES: BEGIN OF ty_cepc,
         khinr TYPE cepc-khinr,
         prctr TYPE cepc-prctr,
       END OF ty_cepc.

DATA: gt_cepc TYPE STANDARD TABLE OF ty_cepc.

*&---------------------------------------------------------------------*
* SKAT 科目描述缓存
*&---------------------------------------------------------------------*
TYPES: BEGIN OF ty_skat_cache,
         saknr TYPE skat-saknr,
         txt50 TYPE skat-txt50,
       END OF ty_skat_cache.

DATA: gt_skat_cache TYPE SORTED TABLE OF ty_skat_cache WITH NON-UNIQUE KEY saknr.

*&---------------------------------------------------------------------*
* SKA1 辅助维度缓存（1002*）
*&---------------------------------------------------------------------*
TYPES: BEGIN OF ty_ska1_cache,
         saknr TYPE ska1-saknr,
         zfkyh TYPE ska1-zfkyh,
         zyhzh TYPE ska1-zyhzh,
       END OF ty_ska1_cache.

DATA: gt_ska1_cache TYPE SORTED TABLE OF ty_ska1_cache WITH NON-UNIQUE KEY saknr.

*&---------------------------------------------------------------------*
* TFKBT 功能范围描述缓存（6601*）
*&---------------------------------------------------------------------*
TYPES: BEGIN OF ty_tfkbt_cache,
         fkber TYPE tfkbt-fkber,
         fkbtx TYPE tfkbt-fkbtx,
       END OF ty_tfkbt_cache.

DATA: gt_tfkbt_cache TYPE SORTED TABLE OF ty_tfkbt_cache WITH NON-UNIQUE KEY fkber.

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
