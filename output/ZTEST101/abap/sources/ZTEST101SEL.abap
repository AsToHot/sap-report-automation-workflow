*&---------------------------------------------------------------------*
*&  包含                ZTEST101SEL
*&  报税取数稽核报表 - 选择屏幕
*&---------------------------------------------------------------------

SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME.

SELECT-OPTIONS:
  s_bukrs FOR zsap_bukrs-bukrs OBLIGATORY MATCHCODE OBJECT zsh_bukrs.

PARAMETERS:
  p_ryear TYPE gjahr OBLIGATORY.

SELECT-OPTIONS:
  s_rpmax FOR faglflext-rpmax OBLIGATORY.

SELECTION-SCREEN END OF BLOCK b1.

*&---------------------------------------------------------------------*
* 选择屏幕文本（运行时设置）
*&---------------------------------------------------------------------*
AT SELECTION-SCREEN OUTPUT.
  %_s_bukrs_%_app_%-text  = '公司代码'.
  %_p_ryear_%_app_%-text  = '会计年度'.
  %_s_rpmax_%_app_%-text  = '核对期间'.
