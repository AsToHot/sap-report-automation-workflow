*&---------------------------------------------------------------------*
*&  包含                ZSAP_FI250SEL
*&  电子档案对接报表（EE041）- 选择屏幕
*&---------------------------------------------------------------------*
SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE text-t00.
SELECT-OPTIONS:
  s_bukrs FOR bkpf-bukrs OBLIGATORY,
  s_gjahr FOR bkpf-gjahr OBLIGATORY,
  s_monat FOR bkpf-monat OBLIGATORY.
SELECTION-SCREEN END OF BLOCK b1.
