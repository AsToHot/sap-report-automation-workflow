*&---------------------------------------------------------------------*
*&  包含                ZTEST102SEL
*&  科目余额表 - 选择屏幕
*&---------------------------------------------------------------------
SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE TEXT-t00.

SELECT-OPTIONS:
  s_bukrs FOR zsap_bukrs-bukrs OBLIGATORY MATCHCODE OBJECT zsh_bukrs.

PARAMETERS:
  p_ryear TYPE gjahr OBLIGATORY DEFAULT sy-datum(4).

SELECT-OPTIONS:
  s_rpmax FOR faglflext-rpmax,
  s_racct FOR faglflext-racct.

PARAMETERS:
  p_forcur AS CHECKBOX.

SELECTION-SCREEN END OF BLOCK b1.
