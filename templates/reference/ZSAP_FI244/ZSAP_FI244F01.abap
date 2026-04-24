*&---------------------------------------------------------------------*
*&  包含                ZSAP_FI244F01
*&  序时账 - 逻辑与 ALV 显示
*&---------------------------------------------------------------------*
CLASS lcl_handle_events IMPLEMENTATION.
  METHOD on_user_command.
    PERFORM handle_user_command USING e_salv_function.
  ENDMETHOD.

  METHOD on_double_click .
    PERFORM on_double_click USING row column.
  ENDMETHOD.
ENDCLASS.

FORM get_data.

  DATA:BEGIN OF ls_zsap_bukrs,
         bukrs TYPE zsap_bukrs-bukrs,
         zfgs  TYPE zsap_bukrs-zfgs,
         zzgs  TYPE zsap_bukrs-zzgs,
         prctr TYPE cepc-khinr,
         ltext TYPE zsap_bukrs-ltext,
       END OF ls_zsap_bukrs.
  DATA:lt_zsap_bukrs LIKE TABLE OF ls_zsap_bukrs.

  SELECT zsap_bukrs~bukrs,
         zsap_bukrs~ltext,
         bkpf~gjahr,
         bkpf~monat,
         bkpf~budat,
         bkpf~cpudt,
         bkpf~blart,
         bkpf~belnr,
         bkpf~bktxt,
         faglflexa~docln,
         faglflexa~buzei,
         faglflexa~racct AS hkont,
         skat~txt50,
         bkpf~waers,
         faglflexa~tsl AS wrbtr,
         CASE WHEN faglflexa~drcrk = 'S'
              THEN faglflexa~hsl
         END AS dmbtr_s,
         CASE WHEN faglflexa~drcrk = 'H'
              THEN 0 - faglflexa~hsl
         END AS dmbtr_h,
         bseg~xnegp,
         bkpf~usnam,
         bkpf~tcode,
         faglflexa~rfarea AS fkber,
         faglflexa~rcntr AS kostl,
         CASE WHEN faglflexa~prctr NE ' ' THEN faglflexa~prctr ELSE bseg~prctr END AS prctr,
         bseg~aufnr,
         bseg~rstgr,
         t053s~txt40,
         bseg~gsber,
         bseg~sgtxt,
         bseg~ebeln,
         bseg~vbel2,
         bseg~matnr,
         bkpf~xreversal,
         zsap_bukrs~zfgs,
         zsap_bukrs~prctr AS prctr_zfgs
         FROM faglflexa
    INNER JOIN bkpf ON bkpf~bukrs = faglflexa~rbukrs
                   AND bkpf~belnr = faglflexa~docnr
                   AND bkpf~gjahr = faglflexa~gjahr
    INNER JOIN zsap_bukrs ON ( zsap_bukrs~zfgs = '' AND zsap_bukrs~bukrs = bkpf~bukrs )
                          OR ( zsap_bukrs~zfgs NE '' AND zsap_bukrs~zzgs = bkpf~bukrs )
     LEFT JOIN bseg ON faglflexa~rldnr  = '0L'
                   AND faglflexa~gjahr  = bseg~gjahr
                   AND faglflexa~docnr  = bseg~belnr
                   AND faglflexa~rbukrs = bseg~bukrs
                   AND faglflexa~buzei  = bseg~buzei
     LEFT JOIN skat ON skat~saknr = faglflexa~racct
                   AND skat~spras = @sy-langu
                   AND skat~ktopl = 'EEKA'
     LEFT JOIN t053s ON t053s~spras = @sy-langu
                    AND t053s~bukrs = bkpf~bukrs
                    AND t053s~rstgr = bseg~rstgr
    WHERE zsap_bukrs~bukrs IN @s_bukrs
      AND bkpf~gjahr IN @s_gjahr
      AND bkpf~monat IN @s_monat
      AND bkpf~budat IN @s_budat
      AND bkpf~cpudt IN @s_cpudt
      AND bkpf~belnr IN @s_belnr
      AND bkpf~blart IN @s_blart
      AND bkpf~usnam IN @s_usnam
      AND bkpf~bktxt IN @s_bktxt
      AND bkpf~tcode IN @s_tcode
      AND faglflexa~racct IN @s_hkont
      AND bseg~kunnr IN @s_kunnr
      AND bseg~lifnr IN @s_lifnr
      AND faglflexa~rfarea IN @s_fkber
      AND faglflexa~rcntr IN @s_kostl
      AND faglflexa~prctr IN @s_prctr
      AND bseg~aufnr IN @s_aufnr
      AND abs( faglflexa~hsl ) IN @s_dmbtr
      AND bseg~rstgr IN @s_rstgr
      AND faglflexa~rbusa IN @s_gsber
      AND bseg~sgtxt IN @s_sgtxt
      AND bseg~anln1 IN @s_anln1
      AND bseg~ebeln IN @s_ebeln
      AND bseg~vbel2 IN @s_vbel2
      AND bseg~matnr IN @s_matnr
   INTO CORRESPONDING FIELDS OF TABLE @gt_data.

  SORT gt_data BY budat belnr docln.
  DELETE ADJACENT DUPLICATES FROM gt_data COMPARING budat belnr docln.

  IF p_xrevr = 'X'.
    DELETE gt_data WHERE xreversal NE ''.
  ENDIF.

ENDFORM.

FORM display.
  DATA: ls_key TYPE salv_s_layout_key.
  DATA: lo_display TYPE REF TO cl_salv_display_settings.

  TRY.
      cl_salv_table=>factory(
        IMPORTING
          r_salv_table = gr_alv
        CHANGING
          t_table      = gt_data ).
    CATCH cx_salv_msg INTO DATA(lr_msg).
      MESSAGE lr_msg TYPE 'E'.
      RETURN.
  ENDTRY.

  DATA(lr_cols) = CAST cl_salv_columns( gr_alv->get_columns( ) ).
  lr_cols->set_optimize( 'X' ).

  gr_alv->set_screen_status(
    pfstatus      = 'S1000'
    report        = sy-repid
    set_functions = gr_alv->c_functions_all
  ).

  DATA(lr_selections) = gr_alv->get_selections( ).
  lr_selections->set_selection_mode( 0 ).

  PERFORM set_column USING '' lr_cols 'BUKRS'    '公司代码' ''.
  PERFORM set_column USING '' lr_cols 'LTEXT'    '公司名称' ''.
  PERFORM set_column USING '' lr_cols 'GJAHR'     '会计年度' ''.
  PERFORM set_column USING '' lr_cols 'MONAT'     '期间' ''.
  PERFORM set_column USING '' lr_cols 'BUDAT'     '过账日期' ''.
  PERFORM set_column USING '' lr_cols 'CPUDT'     '输入日期' ''.
  PERFORM set_column USING '' lr_cols 'BLART'     '凭证类型' ''.
  PERFORM set_column USING '' lr_cols 'BELNR'     '凭证编号' ''.
  PERFORM set_column USING '' lr_cols 'BKTXT'     '抬头摘要' ''.
  PERFORM set_column USING '' lr_cols 'DOCLN'     '行项目' 'X'.
  PERFORM set_column USING '' lr_cols 'BUZEI'     '行项目' ''.
  PERFORM set_column USING '' lr_cols 'HKONT'     '科目编码' ''.
  PERFORM set_column USING '' lr_cols 'TXT50'     '科目描述' ''.
  PERFORM set_column USING '' lr_cols 'WAERS'     '交易币别' ''.
  PERFORM set_column USING '' lr_cols 'WRBTR'     '原币金额' ''.
  PERFORM set_column USING '' lr_cols 'DMBTR_S'     '借方金额' ''.
  PERFORM set_column USING '' lr_cols 'DMBTR_H'     '贷方金额' ''.
  PERFORM set_column USING '' lr_cols 'XNEGP'     '负过账' ''.
  PERFORM set_column USING '' lr_cols 'USNAM'     '用户名' ''.
  PERFORM set_column USING '' lr_cols 'TCODE'     '事务代码' ''.
  PERFORM set_column USING '' lr_cols 'FKBER'     '功能范围' ''.
  PERFORM set_column USING '' lr_cols 'FKBTX'     '功能范围描述' ''.
  PERFORM set_column USING '' lr_cols 'KOSTL'     '成本中心' ''.
  PERFORM set_column USING '' lr_cols 'KTEXT'     '成本中心描述' ''.
  PERFORM set_column USING '' lr_cols 'PRCTR'     '利润中心' ''.
  PERFORM set_column USING '' lr_cols 'PRCTR_TXT'     '利润中心描述' ''.
  PERFORM set_column USING '' lr_cols 'AUFNR'     '订单' ''.
  PERFORM set_column USING '' lr_cols 'RSTGR'     '原因代码' ''.
  PERFORM set_column USING '' lr_cols 'TXT40'     '原因代码描述' ''.
  PERFORM set_column USING '' lr_cols 'GSBER'     '业务范围' ''.
  PERFORM set_column USING '' lr_cols 'GTEXT'     '业务范围描述' ''.
  PERFORM set_column USING '' lr_cols 'SGTXT'     '行项目文本' ''.
  PERFORM set_column USING '' lr_cols 'EBELN'     '采购订单' ''.
  PERFORM set_column USING '' lr_cols 'VBEL2'     '销售订单' ''.
  PERFORM set_column USING '' lr_cols 'MATNR'     '物料' ''.

  ls_key-report = sy-repid.
  ls_key-handle = '1'.
  DATA(lo_layout) = gr_alv->get_layout( ).
  lo_layout->set_key( ls_key ).
  lo_layout->set_save_restriction( if_salv_c_layout=>restrict_none ).
  lo_layout->set_default( abap_true ).

  DATA(lr_events) = gr_alv->get_event( ).
  SET HANDLER gr_events->on_user_command FOR lr_events.
  SET HANDLER gr_events->on_double_click FOR lr_events.

  lo_display = gr_alv->get_display_settings( ).
  lo_display->set_striped_pattern( 'X' ).

  gr_alv->display( ).
ENDFORM.
