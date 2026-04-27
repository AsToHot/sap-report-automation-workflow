*&---------------------------------------------------------------------*
*& Include ZSAP_FI086AT01 — Top Include: 类型定义与全局变量
*& 程序: ZSAP_FI086A 科目余额表
*&---------------------------------------------------------------------*

*----------------------------------------------------------------------*
* 常量定义
*----------------------------------------------------------------------*
CONSTANTS: gc_kokrs  TYPE kokrs  VALUE 'EEKA',
           gc_datbi  TYPE datbi  VALUE '99991231',
           gc_ktopl  TYPE ktopl  VALUE 'EEKA',
           gc_spras  TYPE spras  VALUE '1', " ZH = 1 in SAP
           gc_drck_s TYPE shkzg  VALUE 'S',
           gc_drck_h TYPE shkzg  VALUE 'H'.

*----------------------------------------------------------------------*
* 输出内表行类型
*----------------------------------------------------------------------*
TYPES: BEGIN OF ty_out,
         zyjkm   TYPE char4,        " 一级节点
         racct   TYPE racct,        " 科目编码
         txt50   TYPE txt50_skat,   " 科目描述
         zfzhs   TYPE char20,       " 核算维度编码
         zfztx   TYPE char40,       " 核算维度名称
         zqcjf   TYPE hslvt12,      " 期初余额借方
         zqcdf   TYPE hslvt12,      " 期初余额贷方
         zbqjf   TYPE hslvt12,      " 本期发生借方
         zbqdf   TYPE hslvt12,      " 本期发生贷方
         zbnjf   TYPE hslvt12,      " 本年累计借方
         zbndf   TYPE hslvt12,      " 本年累计贷方
         zqmjf   TYPE hslvt12,      " 期末余额借方
         zqmdf   TYPE hslvt12,      " 期末余额贷方
         zqcjf1  TYPE tslvt12,      " 期初余额借方(外币)
         zqcdf1  TYPE tslvt12,      " 期初余额贷方(外币)
         zbqjf1  TYPE tslvt12,      " 本期发生借方(外币)
         zbqdf1  TYPE tslvt12,      " 本期发生贷方(外币)
         zbnjf1  TYPE tslvt12,      " 本年累计借方(外币)
         zbndf1  TYPE tslvt12,      " 本年累计贷方(外币)
         zqmjf1  TYPE tslvt12,      " 期末余额借方(外币)
         zqmdf1  TYPE tslvt12,      " 期末余额贷方(外币)
         rtcur   TYPE rtcur,        " 币种（仅外币模式）
       END OF ty_out.

*----------------------------------------------------------------------*
* 全局变量
*----------------------------------------------------------------------*
DATA: gt_out        TYPE TABLE OF ty_out,
      gs_out        TYPE ty_out,
      gt_raw        TYPE TABLE OF faglflext,
      gs_raw        TYPE faglflext,
      gt_zsap_bukrs TYPE TABLE OF zsap_bukrs,
      gs_zsap_bukrs TYPE zsap_bukrs,
      gt_ska1       TYPE TABLE OF ska1,
      gs_ska1       TYPE ska1,
      gt_skat       TYPE TABLE OF skat,
      gs_skat       TYPE skat,
      gt_cepc       TYPE TABLE OF cepc,
      gs_cepc       TYPE cepc,
      gt_tfkbt      TYPE TABLE OF tfkbt,
      gs_tfkbt      TYPE tfkbt.

* ALV 相关
DATA: gt_fieldcat   TYPE lvc_t_fcat,
      gs_fieldcat   TYPE lvc_s_fcat,
      gs_layout     TYPE lvc_s_layo,
      gt_sort       TYPE lvc_t_sort,
      gs_sort       TYPE lvc_s_sort.
