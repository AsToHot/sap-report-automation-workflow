*&---------------------------------------------------------------------*
*&  包含                ZTEST002SEL
*&  科目余额表 - 选择屏幕
*&  请在 SE32/SE80 中维护文本元素（中文）：
*&   TEXT-T00 = 查询条件
*&   TEXT-001 = 公司代码    TEXT-002 = 会计年度    TEXT-003 = 期间
*&   TEXT-004 = 科目编码    TEXT-005 = 显示外币余额
*&---------------------------------------------------------------------
SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE TEXT-t00.

PARAMETERS:
  p_bukrs TYPE zsap_bukrs-bukrs OBLIGATORY MATCHCODE OBJECT zsh_bukrs,
  p_gjahr TYPE faglflext-ryear OBLIGATORY DEFAULT sy-datum(4).

SELECT-OPTIONS:
  s_rpmax FOR faglflext-rpmax OBLIGATORY,
  s_racct FOR faglflext-racct.

PARAMETERS:
  p_fcur AS CHECKBOX.

SELECTION-SCREEN END OF BLOCK b1.
