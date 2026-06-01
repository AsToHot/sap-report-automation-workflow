*&---------------------------------------------------------------------*
*&  包含                ZTEST102SEL
*&  电子档案对接 - 选择屏幕
*&---------------------------------------------------------------------
SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE TEXT-t00.

SELECT-OPTIONS:
  s_bukrs FOR bkpf-bukrs OBLIGATORY.

PARAMETERS:
  p_gjahr TYPE gjahr OBLIGATORY,
  p_monat TYPE monat OBLIGATORY.

SELECTION-SCREEN END OF BLOCK b1.
