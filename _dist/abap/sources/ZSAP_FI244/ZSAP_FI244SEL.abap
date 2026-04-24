*&---------------------------------------------------------------------*
*&  包含                ZSAP_FI244SEL
*&  序时账 - 选择屏幕（文本元素语言：中文）
*&---------------------------------------------------------------------*
*& 请在 SE32/SE80 中维护程序 ZSAP_FI244 的文本元素（中文）：
*&   TEXT-T00 = 查询条件
*&   TEXT-001 = 公司代码    TEXT-002 = 过账日期    TEXT-003 = 凭证编号
*&   TEXT-004 = 凭证类型    TEXT-005 = 总账科目    TEXT-006 = 参考
*&   TEXT-007 = 会计年度
*&---------------------------------------------------------------------*
SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE TEXT-t00.

SELECT-OPTIONS:
  s_bukrs FOR bkpf-bukrs OBLIGATORY MATCHCODE OBJECT zsh_bukrs,   " 公司代码
  s_gjahr FOR bkpf-gjahr OBLIGATORY,    "会计年度
  s_monat FOR bkpf-monat,    "期间
  s_budat FOR bkpf-budat,   " 过账日期
  s_cpudt FOR bkpf-cpudt,   " 输入日期
  s_belnr FOR bkpf-belnr,   " 凭证编号
  s_blart FOR bkpf-blart,   " 凭证类型
  s_usnam FOR bkpf-usnam,   " 用户名
  s_bktxt FOR bkpf-bktxt.   " 凭证抬头文本

PARAMETERS:
  p_xrevr TYPE bkpf-xreversal AS CHECKBOX.   " 冲销

SELECT-OPTIONS:
  s_tcode FOR bkpf-tcode,   " 冲销
  s_hkont FOR bseg-hkont,   " 会计科目
  s_kunnr FOR bseg-kunnr,   " 客户
  s_lifnr FOR bseg-lifnr,   " 供应商
  s_fkber FOR bseg-fkber,   " 功能范围
  s_kostl FOR bseg-kostl,   " 成本中心
  s_rstgr FOR bseg-rstgr,   " 利润中心
  s_aufnr FOR bseg-aufnr,   " 订单
  s_dmbtr FOR bseg-dmbtr,   " 金额
  s_prctr FOR bseg-prctr,   " 原因代码
  s_gsber FOR bseg-gsber,   " 业务范围
  s_sgtxt FOR bseg-sgtxt,   " 行项目文本
  s_anln1 FOR bseg-anln1,   " 资产
  s_ebeln FOR bseg-ebeln,   " 采购订单
  s_vbel2 FOR bseg-vbel2,   " 销售订单
  s_matnr FOR bseg-matnr.   " 物料

SELECTION-SCREEN END OF BLOCK b1.
