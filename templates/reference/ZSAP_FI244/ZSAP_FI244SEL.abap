*&---------------------------------------------------------------------*
*&  包含                ZSAP_FI244SEL
*&  序时账 - 选择屏幕（文本元素语言：中文）
*&---------------------------------------------------------------------
*& 请在 SE32/SE80 中维护程序 ZSAP_FI244 的文本元素（中文）：
*&   TEXT-T00 = 查询条件
*&   TEXT-001 = 公司代码    TEXT-002 = 过账日期    TEXT-003 = 凭证编号
*&   TEXT-004 = 凭证类型    TEXT-005 = 总账科目    TEXT-006 = 参考
*&   TEXT-007 = 会计年度
*&---------------------------------------------------------------------
SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE TEXT-t00.

SELECT-OPTIONS:
  s_bukrs FOR bkpf-bukrs OBLIGATORY MATCHCODE OBJECT zsh_bukrs,
  s_gjahr FOR bkpf-gjahr OBLIGATORY,
  s_monat FOR bkpf-monat,
  s_budat FOR bkpf-budat,
  s_cpudt FOR bkpf-cpudt,
  s_belnr FOR bkpf-belnr,
  s_blart FOR bkpf-blart,
  s_usnam FOR bkpf-usnam,
  s_bktxt FOR bkpf-bktxt.

PARAMETERS:
  p_xrevr TYPE bkpf-xreversal AS CHECKBOX.

SELECT-OPTIONS:
  s_tcode FOR bkpf-tcode,
  s_hkont FOR bseg-hkont,
  s_kunnr FOR bseg-kunnr,
  s_lifnr FOR bseg-lifnr,
  s_fkber FOR bseg-fkber,
  s_kostl FOR bseg-kostl,
  s_rstgr FOR bseg-rstgr,
  s_aufnr FOR bseg-aufnr,
  s_dmbtr FOR bseg-dmbtr,
  s_prctr FOR bseg-prctr,
  s_gsber FOR bseg-gsber,
  s_sgtxt FOR bseg-sgtxt,
  s_anln1 FOR bseg-anln1,
  s_ebeln FOR bseg-ebeln,
  s_vbel2 FOR bseg-vbel2,
  s_matnr FOR bseg-matnr.

SELECTION-SCREEN END OF BLOCK b1.