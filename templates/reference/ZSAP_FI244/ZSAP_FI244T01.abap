*&---------------------------------------------------------------------*
*&  包含                ZSAP_FI244T01
*&  序时账 - 数据与类定义
*&---------------------------------------------------------------------
TABLES: bkpf, bseg,zsap_bukrs.

*&---------------------------------------------------------------------*
* ALV
*&---------------------------------------------------------------------*
DATA: gr_alv TYPE REF TO cl_salv_table.

*&---------------------------------------------------------------------*
* 序时账显示结构（BKPF + BSEG 关键字段）
*&---------------------------------------------------------------------*
DATA: BEGIN OF gs_data,
        bukrs      TYPE zsap_bukrs-bukrs,
        ltext      TYPE zsap_bukrs-ltext,
        gjahr      TYPE gjahr,
        monat      TYPE monat,
        budat      TYPE budat,
        cpudt      TYPE bkpf-cpudt,
        blart      TYPE bkpf-blart,
        belnr      TYPE belnr_d,
        bktxt      TYPE bkpf-bktxt,
        docln      TYPE faglflexa-docln,
        buzei      TYPE buzei,
        hkont      TYPE saknr,
        txt50      TYPE skat-txt50,
        waers      TYPE bkpf-waers,
        wrbtr      TYPE wrbtr,
        dmbtr_s    TYPE dmbtr,
        dmbtr_h    TYPE dmbtr,
        xnegp      TYPE bseg-xnegp,
        usnam      TYPE bkpf-usnam,
        tcode      TYPE bkpf-tcode,
        fkber      TYPE tfkbt-fkber,
        fkbtx      TYPE tfkbt-fkbtx,
        kostl      TYPE bseg-kostl,
        ktext      TYPE cskt-ktext,
        prctr      TYPE bseg-prctr,
        prctr_txt  TYPE cepct-ltext,
        aufnr      TYPE bseg-aufnr,
        rstgr      TYPE bseg-rstgr,
        txt40      TYPE t053s-txt40,
        gsber      TYPE bseg-gsber,
        gtext      TYPE tgsbt-gtext,
        sgtxt      TYPE bseg-sgtxt,
        ebeln      TYPE bseg-ebeln,
        vbel2      TYPE bseg-vbel2,
        matnr      TYPE bseg-matnr,
        xreversal  TYPE bkpf-xreversal,
        zfgs       TYPE zsap_bukrs-zfgs,
        prctr_zfgs TYPE cepc-khinr,
      END OF gs_data.

DATA: gt_data LIKE TABLE OF gs_data.

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