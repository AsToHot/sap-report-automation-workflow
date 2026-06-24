*&---------------------------------------------------------------------*
*&  包含                ZTEST003T01
*&  科目余额表 - 数据定义与类定义
*&---------------------------------------------------------------------
TABLES: ska1, cepc, tfkbt.

*&---------------------------------------------------------------------*
* 常量
*&---------------------------------------------------------------------*
CONSTANTS: gc_eeka   TYPE ktopl  VALUE 'EEKA',
           gc_kokrs  TYPE kokrs  VALUE 'EEKA',
           gc_rrcty  TYPE rrcty  VALUE '0',
           gc_rvers  TYPE rvers  VALUE '001',
           gc_datbi  TYPE datbi  VALUE '99991231',
           gc_spras  TYPE spras  VALUE '1'.

*&---------------------------------------------------------------------*
* 类型定义
*&---------------------------------------------------------------------*
TYPES: BEGIN OF ty_raw,
         ryear  TYPE gjahr,
         drcrk  TYPE shkzg,
         rpmax  TYPE rpmax,
         rbukrs TYPE bukrs,
         racct  TYPE racct,
         prctr  TYPE prctr,
         rfarea TYPE fkber,
         rtcur  TYPE rtcur,
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
       END OF ty_raw.

TYPES: BEGIN OF ty_aggr,
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
       END OF ty_aggr.

TYPES: BEGIN OF ty_out,
         zyjkm  TYPE char4,
         racct  TYPE racct,
         txt50  TYPE txt50_skat,
         zfzhs  TYPE ze_fkyh,
         zfztx  TYPE ze_yhzh,
         zqcjf  TYPE hslxx12,
         zqcdf  TYPE hslxx12,
         zbqjf  TYPE hslxx12,
         zbqdf  TYPE hslxx12,
         zbnjf  TYPE hslxx12,
         zbndf  TYPE hslxx12,
         zqmjf  TYPE hslxx12,
         zqmdf  TYPE hslxx12,
         zqcjf1 TYPE tslxx12,
         zqcdf1 TYPE tslxx12,
         zbqjf1 TYPE tslxx12,
         zbqdf1 TYPE tslxx12,
         zbnjf1 TYPE tslxx12,
         zbndf1 TYPE tslxx12,
         zqmjf1 TYPE tslxx12,
         zqmdf1 TYPE tslxx12,
       END OF ty_out.

TYPES: BEGIN OF ty_bukrs_map,
         bukrs TYPE bukrs,
         zfgs  TYPE ze_fgsbs,
         zzgs  TYPE bukrs,
         prctr TYPE prctr,
         ltext TYPE ltext,
       END OF ty_bukrs_map.

TYPES: BEGIN OF ty_cepc,
         khinr TYPE phinr,
         prctr TYPE prctr,
       END OF ty_cepc.

TYPES: BEGIN OF ty_ska1,
         saknr TYPE saknr,
         zfkyh TYPE ze_fkyh,
         zyhzh TYPE ze_yhzh,
       END OF ty_ska1.

TYPES: BEGIN OF ty_skat,
         saknr TYPE saknr,
         txt50 TYPE txt50_skat,
       END OF ty_skat.

TYPES: BEGIN OF ty_tfkbt,
         fkber TYPE fkber,
         fkbtx TYPE fkbtx,
       END OF ty_tfkbt.

TYPES: BEGIN OF ty_rfarea_map,
         racct  TYPE racct,
         rfarea TYPE fkber,
       END OF ty_rfarea_map.

TYPES: ty_racct_ht TYPE SORTED TABLE OF racct WITH UNIQUE KEY table_line.

*&---------------------------------------------------------------------*
* 数据定义
*&---------------------------------------------------------------------*
DATA: gt_raw   TYPE STANDARD TABLE OF ty_raw,
      gt_aggr  TYPE STANDARD TABLE OF ty_aggr,
      gt_out   TYPE STANDARD TABLE OF ty_out,
      gt_out_racct TYPE ty_racct_ht.

DATA: gt_bukrs_map   TYPE STANDARD TABLE OF ty_bukrs_map,
      gs_bukrs_map   TYPE ty_bukrs_map.

DATA: gt_cepc   TYPE STANDARD TABLE OF ty_cepc.

DATA: gt_ska1   TYPE SORTED TABLE OF ty_ska1 WITH UNIQUE KEY saknr.

DATA: gt_skat   TYPE SORTED TABLE OF ty_skat WITH UNIQUE KEY saknr.

DATA: gt_tfkbt  TYPE SORTED TABLE OF ty_tfkbt WITH UNIQUE KEY fkber.

DATA: gt_rfarea_map TYPE STANDARD TABLE OF ty_rfarea_map,
      gs_rfarea_map TYPE ty_rfarea_map.

DATA: gs_aggr TYPE ty_aggr,
      gs_out  TYPE ty_out.

DATA: gv_rpmax TYPE rpmax,
      gv_racct TYPE racct.

*&---------------------------------------------------------------------*
* SALV
*&---------------------------------------------------------------------*
DATA: gr_alv TYPE REF TO cl_salv_table.

*&---------------------------------------------------------------------*
* 类定义
*&---------------------------------------------------------------------*
CLASS lcl_handle_events DEFINITION.
  PUBLIC SECTION.
    METHODS:
      on_user_command FOR EVENT added_function OF cl_salv_events
        IMPORTING e_salv_function.
ENDCLASS.

DATA: gr_events TYPE REF TO lcl_handle_events.
