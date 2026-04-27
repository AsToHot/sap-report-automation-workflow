*&---------------------------------------------------------------------*
*& Include ZSAP_FI086ASEL — Selection Include: 选择屏幕
*& 程序: ZSAP_FI086A 科目余额表
*&---------------------------------------------------------------------*

SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE text-001.
  SELECT-OPTIONS: s_bukrs FOR gs_zsap_bukrs-bukrs OBLIGATORY NO INTERVALS.
  SELECT-OPTIONS: s_ryear FOR gs_raw-ryear OBLIGATORY NO INTERVALS.
  SELECT-OPTIONS: s_rpmax FOR gs_raw-rpmax.
  SELECT-OPTIONS: s_racct FOR gs_raw-racct.
SELECTION-SCREEN END OF BLOCK b1.

SELECTION-SCREEN BEGIN OF BLOCK b2 WITH FRAME TITLE text-002.
  PARAMETERS: p_waers AS CHECKBOX DEFAULT ''.
SELECTION-SCREEN END OF BLOCK b2.

INITIALIZATION.
  text-001 = '选择条件'.
  text-002 = '选项'.

AT SELECTION-SCREEN.
  IF s_bukrs[] IS INITIAL.
    MESSAGE '公司代码为必填项' TYPE 'E'.
  ENDIF.
  IF s_ryear[] IS INITIAL.
    MESSAGE '会计年度为必填项' TYPE 'E'.
  ENDIF.
  IF lines( s_bukrs[] ) > 1.
    MESSAGE '公司代码仅支持单选' TYPE 'E'.
  ENDIF.
  IF lines( s_ryear[] ) > 1.
    MESSAGE '会计年度仅支持单选' TYPE 'E'.
  ENDIF.
