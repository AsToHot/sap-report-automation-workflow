*&---------------------------------------------------------------------*
*&  包含                ZSAP_FI250T01
*&  电子档案对接报表（EE041）- 数据定义
*&---------------------------------------------------------------------*
TABLES: bkpf, bseg.

DATA: gr_alv TYPE REF TO cl_salv_table.

TYPES: BEGIN OF ty_data,
         dangh        TYPE char4,
         rbukrs       TYPE bukrs,
         ltext        TYPE zsap_bukrs-ltext,
         gjahr        TYPE gjahr,
         poper        TYPE poper,
         budat        TYPE budat,
         cpudt        TYPE bkpf-cpudt,
         aedat        TYPE bkpf-aedat,
         blart        TYPE bkpf-blart,
         docnr        TYPE belnr_d,
         zvouty       TYPE zsap_fi179-zvouty,
         bktxt        TYPE bkpf-bktxt,
         docln        TYPE faglflexa-docln,
         hkont        TYPE saknr,
         txt50        TYPE skat-txt50,
         waers        TYPE bkpf-waers,
         tsl          TYPE faglflexa-tsl,
         dmbtr_s      TYPE dmbtr,
         dmbtr_h      TYPE dmbtr,
         kostl        TYPE bseg-kostl,
         kostl_ltext  TYPE cskt-ltext,
         prctr        TYPE prctr,
         prctr_txt    TYPE cepct-ltext,
         sgtxt        TYPE bseg-sgtxt,
         matkl_text   TYPE t023t-wgbez60,
         xblnr        TYPE bkpf-xblnr,
         kursf        TYPE bkpf-kursf,
         busnum       TYPE char64,
       END OF ty_data.

DATA: gt_data TYPE STANDARD TABLE OF ty_data.
