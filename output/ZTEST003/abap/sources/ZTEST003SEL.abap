*&---------------------------------------------------------------------*
*&  包含                ZTEST003SEL
*&  科目余额表 - 选择屏幕
*&---------------------------------------------------------------------
SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE TEXT-t00.

PARAMETERS:
  p_bukrs TYPE bukrs OBLIGATORY MATCHCODE OBJECT zsh_bukrs,
  p_gjahr TYPE gjahr OBLIGATORY DEFAULT sy-datum(4).

SELECT-OPTIONS:
  s_rpmax FOR gv_rpmax DEFAULT '001' TO '016',
  s_racct FOR gv_racct.

PARAMETERS:
  p_fwaers AS CHECKBOX.

SELECTION-SCREEN END OF BLOCK b1.
