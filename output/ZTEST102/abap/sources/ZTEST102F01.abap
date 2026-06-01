*&---------------------------------------------------------------------*
*&  包含                ZTEST102F01
*&  电子档案对接 - 逻辑与 ALV 显示
*&---------------------------------------------------------------------
CLASS lcl_handle_events IMPLEMENTATION.
  METHOD on_user_command.
    PERFORM handle_user_command USING e_salv_function.
  ENDMETHOD.

  METHOD on_double_click .
    PERFORM on_double_click USING row column.
  ENDMETHOD.
ENDCLASS.

*&---------------------------------------------------------------------*
*&      Form  GET_DATA
*&---------------------------------------------------------------------*
FORM get_data.

  DATA: lv_flag_s TYPE c LENGTH 1 VALUE 'S',
        lv_flag_h TYPE c LENGTH 1 VALUE 'H'.

  SELECT fl~rbukrs,
         fl~ryear,
         fl~poper,
         fl~docnr,
         fl~docln,
         fl~racct,
         fl~prctr,
         fl~tsl,
         fl~hsl,
         fl~drcrk,
         bk~budat,
         bk~cpudt,
         bk~aedat,
         bk~usnam,
         bk~blart,
         bk~xreversal,
         bk~bktxt,
         bk~waers,
         bk~kursf,
         bk~xblnr,
         bs~buzei,
         bs~kostl,
         bs~sgtxt,
         bs~matnr,
         bs~lifnr,
         bs~kunnr,
         bs~meins,
         bs~menge,
         bs~anln1
    FROM faglflexa AS fl
   INNER JOIN bkpf AS bk ON bk~bukrs = fl~rbukrs
                        AND bk~belnr = fl~docnr
                        AND bk~gjahr = fl~ryear
    LEFT JOIN bseg AS bs ON bs~bukrs = fl~rbukrs
                        AND bs~belnr = fl~docnr
                        AND bs~gjahr = fl~ryear
                        AND bs~buzei = fl~buzei
   WHERE fl~rbukrs IN @s_bukrs
     AND fl~ryear   = @p_gjahr
     AND fl~poper   = @p_monat
    INTO TABLE @DATA(lt_raw).

  IF sy-subrc <> 0.
    MESSAGE '未找到数据' TYPE 'S'.
    RETURN.
  ENDIF.

  " 公司代码配置
  SELECT bukrs, ltext, zzgs FROM zsap_bukrs
    WHERE bukrs IN @s_bukrs
    INTO TABLE @lt_zsap_bukrs.
  SORT lt_zsap_bukrs BY bukrs.

  " 利润中心层次
  SELECT prctr, khinr FROM cepc
    WHERE datbi = '99991231'
      AND kokrs = 'EEKA'
    INTO TABLE @lt_cepc.
  SORT lt_cepc BY khinr.

  " 利润中心描述
  SELECT prctr, ltext FROM cepct
    WHERE spras = '1'
      AND datbi = '99991231'
      AND kokrs = 'EEKA'
    INTO TABLE @lt_cepct.
  SORT lt_cepct BY prctr.

  " 科目描述 (SKAT)
  SELECT saknr, txt50 FROM skat
    WHERE spras = '1'
      AND ktopl = 'EEKA'
    INTO TABLE @lt_skat.
  SORT lt_skat BY saknr.

  " 科目主数据 (SKA1)
  SELECT saknr, zyhzh, zfkyh FROM ska1
    INTO TABLE @lt_ska1.
  SORT lt_ska1 BY saknr.

  " 成本中心描述
  SELECT kostl, ktext FROM cskt
    WHERE spras = '1'
      AND datbi = '99991231'
      AND kokrs = 'EEKA'
    INTO TABLE @lt_cskt.
  SORT lt_cskt BY kostl.

  " 凭证字配置
  SELECT bukrs, zvouty FROM zsap_fi180
    INTO TABLE @lt_fi180.
  SORT lt_fi180 BY bukrs.

  IF lt_raw IS NOT INITIAL.

    SELECT lifnr, name1, ktokk FROM lfa1
      FOR ALL ENTRIES IN @lt_raw
      WHERE lifnr = @lt_raw-lifnr
      INTO TABLE @lt_lfa1.
    SORT lt_lfa1 BY lifnr.

    SELECT kunnr, name1, ktokd FROM kna1
      FOR ALL ENTRIES IN @lt_raw
      WHERE kunnr = @lt_raw-kunnr
      INTO TABLE @lt_kna1.
    SORT lt_kna1 BY kunnr.

    SELECT matnr, matkl FROM mara
      FOR ALL ENTRIES IN @lt_raw
      WHERE matnr = @lt_raw-matnr
      INTO TABLE @lt_mara.
    SORT lt_mara BY matnr.

    SELECT matnr, maktg FROM makt
      FOR ALL ENTRIES IN @lt_raw
      WHERE matnr = @lt_raw-matnr
        AND spras = '1'
      INTO TABLE @lt_makt.
    SORT lt_makt BY matnr.

    SELECT anln1, anlkl FROM anla
      FOR ALL ENTRIES IN @lt_raw
      WHERE anln1 = @lt_raw-anln1
      INTO TABLE @lt_anla.
    SORT lt_anla BY anln1.

  ENDIF.

  IF lt_kna1 IS NOT INITIAL.
    SELECT ktokd, txt30 FROM t077x
      FOR ALL ENTRIES IN @lt_kna1
      WHERE ktokd = @lt_kna1-ktokd
      INTO TABLE @lt_t077x.
    SORT lt_t077x BY ktokd.
  ENDIF.

  IF lt_mara IS NOT INITIAL.
    SELECT matkl, wgbez60 FROM t023t
      FOR ALL ENTRIES IN @lt_mara
      WHERE matkl = @lt_mara-matkl
      INTO TABLE @lt_t023t.
    SORT lt_t023t BY matkl.
  ENDIF.

  IF lt_anla IS NOT INITIAL.
    SELECT anlkl, txk50 FROM ankt
      FOR ALL ENTRIES IN @lt_anla
      WHERE anlkl = @lt_anla-anlkl
      INTO TABLE @lt_ankt.
    SORT lt_ankt BY anlkl.
  ENDIF.

  SELECT bukrs, belnr, gjahr, zcxflag, bankserialnumber, urid FROM zfi032_doc
    FOR ALL ENTRIES IN @lt_raw
    WHERE bukrs = @lt_raw-rbukrs
      AND belnr = @lt_raw-docnr
      AND gjahr = @lt_raw-ryear
    INTO TABLE @lt_fi032.
  SORT lt_fi032 BY bukrs belnr gjahr.

  SELECT bukrs, belnr, gjahr, bankserialnumber FROM zsap_fi054
    FOR ALL ENTRIES IN @lt_raw
    WHERE bukrs = @lt_raw-rbukrs
      AND belnr = @lt_raw-docnr
      AND gjahr = @lt_raw-ryear
    INTO TABLE @lt_fi054.
  SORT lt_fi054 BY bukrs belnr gjahr.

  LOOP AT lt_raw ASSIGNING FIELD-SYMBOL(<fs_raw>).

    CLEAR gs_out.

    gs_out-rbukrs = <fs_raw>-rbukrs.
    gs_out-ryear  = <fs_raw>-ryear.
    gs_out-poper  = <fs_raw>-poper.
    gs_out-docnr  = <fs_raw>-docnr.
    gs_out-docln  = <fs_raw>-docln.
    gs_out-racct  = <fs_raw>-racct.
    gs_out-prctr  = <fs_raw>-prctr.
    gs_out-tsl    = <fs_raw>-tsl.
    gs_out-budat  = <fs_raw>-budat.
    gs_out-cpudt  = <fs_raw>-cpudt.
    gs_out-aedat  = <fs_raw>-aedat.
    gs_out-usnam  = <fs_raw>-usnam.

    gs_out-reviewer = <fs_raw>-usnam.
    gs_out-preparer = <fs_raw>-usnam.
    gs_out-poster   = <fs_raw>-usnam.
    gs_out-approver = <fs_raw>-usnam.
    gs_out-operator = <fs_raw>-usnam.

    gs_out-blart     = <fs_raw>-blart.
    gs_out-xreversal = <fs_raw>-xreversal.
    gs_out-bktxt     = <fs_raw>-bktxt.
    gs_out-waers     = <fs_raw>-waers.
    gs_out-kursf     = <fs_raw>-kursf.
    gs_out-xblnr     = <fs_raw>-xblnr.

    gs_out-kostl = <fs_raw>-kostl.
    gs_out-sgtxt = <fs_raw>-sgtxt.
    gs_out-matnr = <fs_raw>-matnr.
    gs_out-lifnr = <fs_raw>-lifnr.
    gs_out-kunnr = <fs_raw>-kunnr.
    gs_out-meins = <fs_raw>-meins.
    gs_out-menge = <fs_raw>-menge.

    IF <fs_raw>-drcrk = lv_flag_s.
      gs_out-hsl_s = <fs_raw>-hsl.
    ELSEIF <fs_raw>-drcrk = lv_flag_h.
      gs_out-hsl_h = <fs_raw>-hsl * ( -1 ).
    ENDIF.

    IF <fs_raw>-poper = '13' OR <fs_raw>-poper = '14'
    OR <fs_raw>-poper = '15' OR <fs_raw>-poper = '16'.
      gs_out-adjust_flg = '是'.
    ELSE.
      gs_out-adjust_flg = '否'.
    ENDIF.

    IF <fs_raw>-blart = 'Z4'.
      gs_out-bustype = '期末调汇'.
    ELSE.
      gs_out-bustype = '手工录入'.
    ENDIF.

    READ TABLE lt_zsap_bukrs ASSIGNING FIELD-SYMBOL(<fs_bukrs>)
      WITH KEY bukrs = <fs_raw>-rbukrs BINARY SEARCH.
    IF sy-subrc = 0.
      gs_out-rltext = <fs_bukrs>-ltext.
    ENDIF.

    READ TABLE lt_cepc ASSIGNING FIELD-SYMBOL(<fs_cepc>)
      WITH KEY khinr = <fs_raw>-rbukrs BINARY SEARCH.
    IF sy-subrc = 0.
      READ TABLE lt_zsap_bukrs ASSIGNING <fs_bukrs>
        WITH KEY bukrs = <fs_cepc>-khinr BINARY SEARCH.
      IF sy-subrc = 0.
        gs_out-bukrs = <fs_bukrs>-bukrs.
        gs_out-ltext = <fs_bukrs>-ltext.
      ENDIF.
    ENDIF.

    READ TABLE lt_skat ASSIGNING FIELD-SYMBOL(<fs_skat>)
      WITH KEY saknr = <fs_raw>-racct BINARY SEARCH.
    IF sy-subrc = 0.
      gs_out-racct_txt = <fs_skat>-txt50.
    ENDIF.

    READ TABLE lt_cskt ASSIGNING FIELD-SYMBOL(<fs_cskt>)
      WITH KEY kostl = <fs_raw>-kostl BINARY SEARCH.
    IF sy-subrc = 0.
      gs_out-kostl_txt = <fs_cskt>-ktext.
    ENDIF.

    READ TABLE lt_cepct ASSIGNING FIELD-SYMBOL(<fs_cepct>)
      WITH KEY prctr = <fs_raw>-prctr BINARY SEARCH.
    IF sy-subrc = 0.
      gs_out-prctr_txt = <fs_cepct>-ltext.
    ENDIF.

    READ TABLE lt_makt ASSIGNING FIELD-SYMBOL(<fs_makt>)
      WITH KEY matnr = <fs_raw>-matnr BINARY SEARCH.
    IF sy-subrc = 0.
      gs_out-maktx = <fs_makt>-maktg.
    ENDIF.

    READ TABLE lt_mara ASSIGNING FIELD-SYMBOL(<fs_mara>)
      WITH KEY matnr = <fs_raw>-matnr BINARY SEARCH.
    IF sy-subrc = 0.
      gs_out-matkl = <fs_mara>-matkl.
      READ TABLE lt_t023t ASSIGNING FIELD-SYMBOL(<fs_t023t>)
        WITH KEY matkl = <fs_mara>-matkl BINARY SEARCH.
      IF sy-subrc = 0.
        gs_out-wgbez60 = <fs_t023t>-wgbez60.
      ENDIF.
    ENDIF.

    READ TABLE lt_lfa1 ASSIGNING FIELD-SYMBOL(<fs_lfa1>)
      WITH KEY lifnr = <fs_raw>-lifnr BINARY SEARCH.
    IF sy-subrc = 0.
      CASE <fs_lfa1>-ktokk.
        WHEN 'Z010'.
          gs_out-lifnr_fi     = <fs_lfa1>-lifnr.
          gs_out-name1_lif_fi = <fs_lfa1>-name1.
        WHEN 'Z011'.
          gs_out-lifnr_pa     = <fs_lfa1>-lifnr.
          gs_out-name1_lif_pa = <fs_lfa1>-name1.
        WHEN OTHERS.
          gs_out-lifnr     = <fs_lfa1>-lifnr.
          gs_out-name1_lif = <fs_lfa1>-name1.
      ENDCASE.
    ENDIF.

    READ TABLE lt_kna1 ASSIGNING FIELD-SYMBOL(<fs_kna1>)
      WITH KEY kunnr = <fs_raw>-kunnr BINARY SEARCH.
    IF sy-subrc = 0.
      IF <fs_kna1>-ktokd = 'Z006'.
        gs_out-kunnr_fi     = <fs_kna1>-kunnr.
        gs_out-name1_kur_fi = <fs_kna1>-name1.
      ELSE.
        gs_out-kunnr     = <fs_kna1>-kunnr.
        gs_out-name1_kur = <fs_kna1>-name1.
      ENDIF.
      READ TABLE lt_t077x ASSIGNING FIELD-SYMBOL(<fs_t077x>)
        WITH KEY ktokd = <fs_kna1>-ktokd BINARY SEARCH.
      IF sy-subrc = 0.
        gs_out-ktokd_txt = <fs_t077x>-txt30.
      ENDIF.
    ENDIF.

    READ TABLE lt_anla ASSIGNING FIELD-SYMBOL(<fs_anla>)
      WITH KEY anln1 = <fs_raw>-anln1 BINARY SEARCH.
    IF sy-subrc = 0.
      gs_out-anlkl = <fs_anla>-anlkl.
      READ TABLE lt_ankt ASSIGNING FIELD-SYMBOL(<fs_ankt>)
        WITH KEY anlkl = <fs_anla>-anlkl BINARY SEARCH.
      IF sy-subrc = 0.
        gs_out-name1_anl = <fs_ankt>-txk50.
      ENDIF.
    ENDIF.

    READ TABLE lt_fi180 ASSIGNING FIELD-SYMBOL(<fs_fi180>)
      WITH KEY bukrs = <fs_raw>-rbukrs BINARY SEARCH.
    IF sy-subrc = 0.
      gs_out-zvouty = <fs_fi180>-zvouty.
    ENDIF.

    READ TABLE lt_ska1 ASSIGNING FIELD-SYMBOL(<fs_ska1>)
      WITH KEY saknr = <fs_raw>-racct BINARY SEARCH.
    IF sy-subrc = 0.
      gs_out-zyhzh = <fs_ska1>-zyhzh.
      gs_out-zfkyh = <fs_ska1>-zfkyh.
    ENDIF.

    IF <fs_raw>-racct+0(4) = '1002'.
      gs_out-hkont_bkn = gs_out-racct_txt.
    ELSEIF <fs_raw>-racct+0(4) = '1012'.
      gs_out-hkont_fdn = gs_out-racct_txt.
    ENDIF.

    IF <fs_raw>-racct+0(4) = '1002' OR <fs_raw>-racct+0(4) = '1012'.
      READ TABLE lt_fi032 ASSIGNING FIELD-SYMBOL(<fs_fi032>)
        WITH KEY bukrs = <fs_raw>-rbukrs belnr = <fs_raw>-docnr gjahr = <fs_raw>-ryear BINARY SEARCH.
      IF sy-subrc = 0 AND <fs_fi032>-zcxflag <> 'X'.
        gs_out-busnum = <fs_fi032>-bankserialnumber.
      ELSE.
        READ TABLE lt_fi054 ASSIGNING FIELD-SYMBOL(<fs_fi054>)
          WITH KEY bukrs = <fs_raw>-rbukrs belnr = <fs_raw>-docnr gjahr = <fs_raw>-ryear BINARY SEARCH.
        IF sy-subrc = 0.
          gs_out-busnum = <fs_fi054>-bankserialnumber.
        ELSE.
          IF gs_out-racct_txt CS gc_hsbc.
            READ TABLE lt_fi032 ASSIGNING <fs_fi032>
              WITH KEY bukrs = <fs_raw>-rbukrs belnr = <fs_raw>-docnr gjahr = <fs_raw>-ryear BINARY SEARCH.
            IF sy-subrc = 0.
              gs_out-busnum = <fs_fi032>-urid.
            ENDIF.
          ENDIF.
        ENDIF.
      ENDIF.
    ENDIF.

    gs_out-attchnum = 0.
    gs_out-vernum   = ''.
    gs_out-orgname  = ''.
    gs_out-expense_name = ''.
    gs_out-price    = ''.
    gs_out-paymethod = ''.
    gs_out-ref_field = ''.
    gs_out-abslib   = ''.
    gs_out-acctdim  = ''.
    gs_out-rat_type = gc_fixed_rate.
    IF <fs_raw>-kursf IS INITIAL.
      gs_out-rat = gc_default_rat.
    ELSE.
      gs_out-rat = <fs_raw>-kursf.
    ENDIF.

    APPEND gs_out TO gt_out.
  ENDLOOP.

  SORT gt_out BY rbukrs ryear poper docnr docln.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  DISPLAY
*&---------------------------------------------------------------------*
FORM display.

  DATA: ls_key TYPE salv_s_layout_key.
  DATA: lo_display TYPE REF TO cl_salv_display_settings.

  TRY.
      cl_salv_table=>factory(
        IMPORTING
          r_salv_table = gr_alv
        CHANGING
          t_table      = gt_out ).
    CATCH cx_salv_msg INTO DATA(lr_msg).
      MESSAGE lr_msg TYPE 'E'.
      RETURN.
  ENDTRY.

  DATA(lr_cols) = CAST cl_salv_columns( gr_alv->get_columns( ) ).
  lr_cols->set_optimize( 'X' ).

  DATA(lr_selections) = gr_alv->get_selections( ).
  lr_selections->set_selection_mode( 0 ).

  PERFORM set_column USING '' lr_cols 'RBUKRS'      '机构代码' ''.
  PERFORM set_column USING '' lr_cols 'RLTEXT'      '机构名称' ''.
  PERFORM set_column USING '' lr_cols 'BUKRS'       '分公司代码' ''.
  PERFORM set_column USING '' lr_cols 'LTEXT'       '分公司名称' ''.
  PERFORM set_column USING '' lr_cols 'RYEAR'       '会计年度' ''.
  PERFORM set_column USING '' lr_cols 'POPER'       '会计期间' ''.
  PERFORM set_column USING '' lr_cols 'BUDAT'       '过账日期' ''.
  PERFORM set_column USING '' lr_cols 'CPUDT'       '记账日期' ''.
  PERFORM set_column USING '' lr_cols 'AEDAT'       '修改日期' ''.
  PERFORM set_column USING '' lr_cols 'REVIEWER'    '审核' ''.
  PERFORM set_column USING '' lr_cols 'PREPARER'    '制单' ''.
  PERFORM set_column USING '' lr_cols 'POSTER'      '过账' ''.
  PERFORM set_column USING '' lr_cols 'APPROVER'    '核准' ''.
  PERFORM set_column USING '' lr_cols 'OPERATOR'    '经办' ''.
  PERFORM set_column USING '' lr_cols 'ATTCHNUM'    '附件数' ''.
  PERFORM set_column USING '' lr_cols 'ADJUST_FLG'  '是否调整期凭证' ''.
  PERFORM set_column USING '' lr_cols 'VERNUM'      '引入版本号' ''.
  PERFORM set_column USING '' lr_cols 'BUSTYPE'     '业务类型' ''.
  PERFORM set_column USING '' lr_cols 'XREVERSAL'   '是否已冲销' ''.
  PERFORM set_column USING '' lr_cols 'BLART'       '凭证类型' ''.
  PERFORM set_column USING '' lr_cols 'DOCNR'       '凭证号码' ''.
  PERFORM set_column USING '' lr_cols 'ZVOUTY'      '凭证字' ''.
  PERFORM set_column USING '' lr_cols 'BKTXT'       '摘要' ''.
  PERFORM set_column USING '' lr_cols 'DOCLN'       '序号' 'X'.
  PERFORM set_column USING '' lr_cols 'RACCT'       '会计科目编码' ''.
  PERFORM set_column USING '' lr_cols 'RACCT_TXT'   '会计科目描述' ''.
  PERFORM set_column USING '' lr_cols 'WAERS'       '币别' ''.
  PERFORM set_column USING '' lr_cols 'TSL'         '原币金额' ''.
  PERFORM set_column USING '' lr_cols 'HSL_S'       '借方金额' ''.
  PERFORM set_column USING '' lr_cols 'HSL_H'       '贷方金额' ''.
  PERFORM set_column USING '' lr_cols 'KOSTL'       '部门' ''.
  PERFORM set_column USING '' lr_cols 'KOSTL_TXT'   '部门名称' ''.
  PERFORM set_column USING '' lr_cols 'PRCTR'       '利润中心' ''.
  PERFORM set_column USING '' lr_cols 'PRCTR_TXT'   '利润中心描述' ''.
  PERFORM set_column USING '' lr_cols 'SGTXT'       '行项目文本' ''.
  PERFORM set_column USING '' lr_cols 'MAKTX'       '物料名称' ''.
  PERFORM set_column USING '' lr_cols 'KTOKD_TXT'   '客户分组名称' ''.
  PERFORM set_column USING '' lr_cols 'ZYHZH'       '银行名称' ''.
  PERFORM set_column USING '' lr_cols 'ORGNAME'     '组织机构名称' ''.
  PERFORM set_column USING '' lr_cols 'WGBEZ60'     '物料分组名称' ''.
  PERFORM set_column USING '' lr_cols 'NAME1_LIF_FI' '财务供应商名称' ''.
  PERFORM set_column USING '' lr_cols 'NAME1_KUR_FI' '财务客户名称' ''.
  PERFORM set_column USING '' lr_cols 'HKONT_BKN'   '银行账号名称' ''.
  PERFORM set_column USING '' lr_cols 'HKONT_FDN'   '其他货币资金账号名称' ''.
  PERFORM set_column USING '' lr_cols 'NAME1_KUR'   '客户名称' ''.
  PERFORM set_column USING '' lr_cols 'NAME1_LIF'   '供应商名称' ''.
  PERFORM set_column USING '' lr_cols 'EXPENSE_NAME' '费用项目名称' ''.
  PERFORM set_column USING '' lr_cols 'NAME1_ANL'   '资产类别名称' ''.
  PERFORM set_column USING '' lr_cols 'NAME1_LIF_PA' '员工名称' ''.
  PERFORM set_column USING '' lr_cols 'MEINS'       '单位' ''.
  PERFORM set_column USING '' lr_cols 'PRICE'       '单价' ''.
  PERFORM set_column USING '' lr_cols 'MENGE'       '数量' ''.
  PERFORM set_column USING '' lr_cols 'PAYMETHOD'   '结算方式' ''.
  PERFORM set_column USING '' lr_cols 'XBLNR'       '结算号' ''.
  PERFORM set_column USING '' lr_cols 'REF_FIELD'   '参照字段' ''.
  PERFORM set_column USING '' lr_cols 'RAT_TYPE'    '汇率类型' ''.
  PERFORM set_column USING '' lr_cols 'RAT'         '汇率' ''.
  PERFORM set_column USING '' lr_cols 'BUSNUM'      '业务编号' ''.
  PERFORM set_column USING '' lr_cols 'ABSLIB'      '摘要库' ''.
  PERFORM set_column USING '' lr_cols 'ZFKYH'       '银行账号' ''.
  PERFORM set_column USING '' lr_cols 'ACCTDIM'     '核算维度' ''.

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

*&---------------------------------------------------------------------*
*&      Form  SET_COLUMN
*&---------------------------------------------------------------------*
FORM set_column USING i_hotspot TYPE xfeld
                      pr_cols TYPE REF TO cl_salv_columns
                      VALUE(fname)
                      VALUE(text)
                      p_noout.

  DATA: lr_column TYPE REF TO cl_salv_column_table.
  TRY.
      lr_column ?= pr_cols->get_column( fname ).
      lr_column->set_long_text( CONV #( text ) ).
      lr_column->set_medium_text( CONV #( text ) ).
      lr_column->set_short_text( CONV #( text ) ).
      IF p_noout = 'X'.
        lr_column->set_visible( 'X' ).
        lr_column->set_technical( 'X' ).
      ENDIF.
      IF i_hotspot = abap_true.
        lr_column->set_cell_type( if_salv_c_cell_type=>hotspot ).
      ENDIF.
    CATCH cx_salv_not_found.
  ENDTRY.
ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  HANDLE_USER_COMMAND
*&---------------------------------------------------------------------*
FORM handle_user_command USING i_ucomm TYPE salv_de_function.

  CASE i_ucomm.
    WHEN OTHERS.
  ENDCASE.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  ON_DOUBLE_CLICK
*&---------------------------------------------------------------------*
FORM on_double_click USING p_row TYPE i p_column TYPE lvc_fname.

  CASE p_column.
    WHEN 'DOCNR'.
      READ TABLE gt_out INTO gs_out INDEX p_row.
      CHECK sy-subrc = 0.

      SET PARAMETER ID 'BLN' FIELD gs_out-docnr.
      SET PARAMETER ID 'BUK' FIELD gs_out-rbukrs.
      SET PARAMETER ID 'GJR' FIELD gs_out-ryear.

      CALL TRANSACTION 'FB03' AND SKIP FIRST SCREEN.

    WHEN OTHERS.
  ENDCASE.

ENDFORM.
