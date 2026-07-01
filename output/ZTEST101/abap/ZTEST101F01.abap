*&---------------------------------------------------------------------*
*&  包含                ZTEST101F01
*&  报税取数稽核报表 - 逻辑与 ALV 显示
*&---------------------------------------------------------------------*

*&---------------------------------------------------------------------*
*&      Form  GET_DATA
*&---------------------------------------------------------------------*
FORM get_data.

  PERFORM init_tax_list.
  PERFORM get_bukrs_mapping.
  PERFORM get_cepc_hierarchy.
  PERFORM build_period_list.
  PERFORM get_payable_amounts.
  PERFORM get_bank_mapping.
  PERFORM get_declared_amounts.
  PERFORM build_output.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  INIT_TAX_LIST
*&---------------------------------------------------------------------*
FORM init_tax_list.

  DATA: ls_tax TYPE tys_tax_def.

  ls_tax-racct = gc_tax-vat.    ls_tax-name = '增值税'.     APPEND ls_tax TO gt_tax_list.
  ls_tax-racct = gc_tax-city.   ls_tax-name = '城建税'.     APPEND ls_tax TO gt_tax_list.
  ls_tax-racct = gc_tax-edu.    ls_tax-name = '教育费附加'. APPEND ls_tax TO gt_tax_list.
  ls_tax-racct = gc_tax-local.  ls_tax-name = '地方教育费附加'. APPEND ls_tax TO gt_tax_list.
  ls_tax-racct = gc_tax-stamp.  ls_tax-name = '印花税'.     APPEND ls_tax TO gt_tax_list.
  ls_tax-racct = gc_tax-income. ls_tax-name = '企业所得税'. APPEND ls_tax TO gt_tax_list.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  GET_BUKRS_MAPPING
*&---------------------------------------------------------------------*
FORM get_bukrs_mapping.

  DATA: ls_map TYPE tys_bukrs_map,
        ls_r   TYPE tys_rbukrs.

  SELECT bukrs, ltext, zfgs, zzgs, prctr
    FROM zsap_bukrs
    INTO TABLE @gt_bukrs_map
    WHERE bukrs IN @s_bukrs.

  IF sy-subrc <> 0.
    MESSAGE '所选公司代码在 ZSAP_BUKRS 中无映射数据' TYPE 'W'.
    RETURN.
  ENDIF.

* 展开为 (screen_bukrs → rbukrs) 映射
  LOOP AT gt_bukrs_map INTO ls_map.
    ls_r-bukrs  = ls_map-bukrs.
    ls_r-ltext  = ls_map-ltext.
    ls_r-prctr  = ls_map-prctr.
    IF ls_map-zfgs IS INITIAL.
      ls_r-rbukrs = ls_map-bukrs.
    ELSE.
      ls_r-rbukrs = ls_map-zzgs.
    ENDIF.
    APPEND ls_r TO gt_rbukrs.
  ENDLOOP.

  SORT gt_rbukrs BY rbukrs.
  DELETE ADJACENT DUPLICATES FROM gt_rbukrs COMPARING rbukrs.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  GET_CEPC_HIERARCHY
*&---------------------------------------------------------------------*
FORM get_cepc_hierarchy.

  IF gt_bukrs_map[] IS INITIAL.
    RETURN.
  ENDIF.

  SELECT prctr, khinr
    FROM cepc
    INTO TABLE @gt_cepc
    FOR ALL ENTRIES IN @gt_bukrs_map
    WHERE khinr = @gt_bukrs_map-prctr
      AND datbi = '99991231'
      AND kokrs = @gc_kokrs.

  SORT gt_cepc BY prctr.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  BUILD_PERIOD_LIST
*&---------------------------------------------------------------------*
FORM build_period_list.

  DATA: lv_period TYPE rpmax.

  LOOP AT s_rpmax.
    lv_period = s_rpmax-low.
    WHILE lv_period <= s_rpmax-high.
      APPEND lv_period TO gt_periods.
      lv_period = lv_period + 1.
    ENDWHILE.
  ENDLOOP.

  SORT gt_periods.
  DELETE ADJACENT DUPLICATES FROM gt_periods.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  GET_PAYABLE_AMOUNTS
*&---------------------------------------------------------------------*
FORM get_payable_amounts.

  DATA: lt_rbukrs     TYPE RANGE OF bukrs,
        lt_racct      TYPE RANGE OF racct,
        lt_prctr      TYPE RANGE OF prctr,
        ls_rbukrs     LIKE LINE OF lt_rbukrs,
        ls_racct      LIKE LINE OF lt_racct,
        ls_prctr      LIKE LINE OF lt_prctr,
        ls_payable    TYPE tys_payable,
        lv_field      TYPE string,
        lv_sum        TYPE hslxx12.

  FIELD-SYMBOLS: <ls_fagl>  TYPE tys_fagl_row,
                 <fs_hsl>   TYPE ANY,
                 <ls_output> TYPE tys_output.

* 构造 RBUKRS 范围
  LOOP AT gt_rbukrs INTO DATA(ls_r).
    ls_rbukrs-sign   = 'I'.
    ls_rbukrs-option = 'EQ'.
    ls_rbukrs-low    = ls_r-rbukrs.
    APPEND ls_rbukrs TO lt_rbukrs.
  ENDLOOP.

* 构造 RACCT 范围（6 个税种）
  LOOP AT gt_tax_list INTO DATA(ls_tax).
    ls_racct-sign   = 'I'.
    ls_racct-option = 'EQ'.
    ls_racct-low    = ls_tax-racct.
    APPEND ls_racct TO lt_racct.
  ENDLOOP.

* 构造 PRCTR 范围
  LOOP AT gt_cepc INTO DATA(ls_cepc).
    ls_prctr-sign   = 'I'.
    ls_prctr-option = 'EQ'.
    ls_prctr-low    = ls_cepc-prctr.
    APPEND ls_prctr TO lt_prctr.
  ENDLOOP.

  IF lt_rbukrs[] IS INITIAL OR lt_racct[] IS INITIAL.
    RETURN.
  ENDIF.

* SELECT from FAGLFLEXT（仅当前有 CEPC 数据时才过滤 PRCTR）
  IF lt_prctr[] IS NOT INITIAL.
    SELECT ryear, rbukrs, racct, drcrk,
           hsl01, hsl02, hsl03, hsl04, hsl05, hsl06,
           hsl07, hsl08, hsl09, hsl10, hsl11, hsl12,
           hsl13, hsl14, hsl15, hsl16
      FROM faglflext
      INTO TABLE @gt_fagl
      WHERE ryear  = @p_ryear
        AND rbukrs IN @lt_rbukrs
        AND racct  IN @lt_racct
        AND prctr  IN @lt_prctr.
  ELSE.
    SELECT ryear, rbukrs, racct, drcrk,
           hsl01, hsl02, hsl03, hsl04, hsl05, hsl06,
           hsl07, hsl08, hsl09, hsl10, hsl11, hsl12,
           hsl13, hsl14, hsl15, hsl16
      FROM faglflext
      INTO TABLE @gt_fagl
      WHERE ryear  = @p_ryear
        AND rbukrs IN @lt_rbukrs
        AND racct  IN @lt_racct.
  ENDIF.

* 按期间汇总 + 反向映射 RBUKRS→屏幕 BUKRS + 按科目聚合
  LOOP AT gt_fagl ASSIGNING <ls_fagl>.

*   期间汇总
    CLEAR lv_sum.
    LOOP AT gt_periods INTO DATA(lv_p).
      " lv_p is NUMC 3 like '003'; lv_p+1(2) = '03'
      DATA(lv_p_str) = CONV char2( lv_p+1(2) ).
      CONCATENATE 'HSL' lv_p_str INTO lv_field.
      ASSIGN COMPONENT lv_field OF STRUCTURE <ls_fagl> TO <fs_hsl>.
      IF sy-subrc <> 0.
        CONTINUE.
      ENDIF.
      lv_sum = lv_sum + <fs_hsl>.
    ENDLOOP.

*   反向映射 RBUKRS→屏幕 BUKRS
    READ TABLE gt_rbukrs INTO ls_r WITH KEY rbukrs = <ls_fagl>-rbukrs BINARY SEARCH.
    IF sy-subrc <> 0.
      CONTINUE.
    ENDIF.

*   累积到应交汇总表
    READ TABLE gt_payable ASSIGNING FIELD-SYMBOL(<ls_pay>)
      WITH KEY bukrs = ls_r-bukrs racct = <ls_fagl>-racct.
    IF sy-subrc <> 0.
      ls_payable-bukrs = ls_r-bukrs.
      ls_payable-ltext = ls_r-ltext.
      ls_payable-racct = <ls_fagl>-racct.
      ls_payable-hsl   = lv_sum.
      APPEND ls_payable TO gt_payable.
    ELSE.
      <ls_pay>-hsl = <ls_pay>-hsl + lv_sum.
    ENDIF.

  ENDLOOP.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  GET_BANK_MAPPING
*&---------------------------------------------------------------------*
FORM get_bank_mapping.

  DATA: lt_zbukrs TYPE RANGE OF bukrs,
        ls_zbukrs LIKE LINE OF lt_zbukrs.

* 从屏幕选择的公司代码
  LOOP AT gt_bukrs_map INTO DATA(ls_map).
    ls_zbukrs-sign   = 'I'.
    ls_zbukrs-option = 'EQ'.
    ls_zbukrs-low    = ls_map-bukrs.
    APPEND ls_zbukrs TO lt_zbukrs.
  ENDLOOP.

  IF lt_zbukrs[] IS INITIAL.
    RETURN.
  ENDIF.

  SELECT zbukrs, zfkyh
    FROM ska1
    INTO TABLE @gt_bank_map
    WHERE zbukrs IN @lt_zbukrs
      AND ktopl = @gc_ktopl
      AND zfkyh NE ''.

  SORT gt_bank_map BY zfkyh.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  GET_DECLARED_AMOUNTS
*&---------------------------------------------------------------------*
FORM get_declared_amounts.

  DATA: lt_bank_acc TYPE RANGE OF ze_fkyh,
        lt_racct    TYPE RANGE OF racct,
        ls_bank     LIKE LINE OF lt_bank_acc,
        ls_racct    LIKE LINE OF lt_racct,
        lv_date_fr  TYPE string,
        lv_date_to  TYPE string,
        lv_month_fr TYPE rpmax,
        lv_month_to TYPE rpmax,
        ls_declared TYPE tys_declared.

  IF gt_bank_map[] IS INITIAL.
    RETURN.
  ENDIF.

* 构造银行账户范围
  LOOP AT gt_bank_map INTO DATA(ls_bank_map).
    ls_bank-sign   = 'I'.
    ls_bank-option = 'EQ'.
    ls_bank-low    = ls_bank_map-zfkyh.
    APPEND ls_bank TO lt_bank_acc.
  ENDLOOP.

* 构造科目范围
  LOOP AT gt_tax_list INTO DATA(ls_tax).
    ls_racct-sign   = 'I'.
    ls_racct-option = 'EQ'.
    ls_racct-low    = ls_tax-racct.
    APPEND ls_racct TO lt_racct.
  ENDLOOP.

* 构造日期范围（YYYYMMDD 字符串）
  DATA(lv_year) = |{ p_ryear }|.
* 取最小期间
  SORT gt_periods ASCENDING.
  READ TABLE gt_periods INTO lv_month_fr INDEX 1.
  DATA(lv_period_idx) = lines( gt_periods ).
  READ TABLE gt_periods INTO lv_month_to INDEX lv_period_idx.

  lv_date_fr = lv_year && lv_month_fr+1(2) && '01'.
* 月末日期简化处理：取当月最后一天（各月天数不同，此处简化取 27~31）
  IF lv_month_to+1(2) = '02'.
    lv_date_to = lv_year && '0228'.
  ELSEIF lv_month_to+1(2) = '04' OR lv_month_to+1(2) = '06'
      OR lv_month_to+1(2) = '09' OR lv_month_to+1(2) = '11'.
    lv_date_to = lv_year && lv_month_to+1(2) && '30'.
  ELSE.
    lv_date_to = lv_year && lv_month_to+1(2) && '31'.
  ENDIF.

* SELECT from ZSAP_FI054
  SELECT hkont_fy, ourbankaccountnumber, bukrs, amount
    FROM zsap_fi054
    INTO TABLE @gt_fi054
    FOR ALL ENTRIES IN @gt_bank_map
    WHERE ourbankaccountnumber = @gt_bank_map-zfkyh
      AND hkont_fy IN @lt_racct
      AND tradedate >= @lv_date_fr
      AND tradedate <= @lv_date_to.

  IF sy-subrc <> 0.
    RETURN.
  ENDIF.

* 按公司代码+科目汇总
  LOOP AT gt_fi054 INTO DATA(ls_fi054).

*   通过银行账户反向映射到屏幕公司代码
    READ TABLE gt_bank_map INTO ls_bank_map
      WITH KEY zfkyh = ls_fi054-ourbankaccountnumber BINARY SEARCH.
    IF sy-subrc <> 0.
      CONTINUE.
    ENDIF.

    READ TABLE gt_declared ASSIGNING FIELD-SYMBOL(<ls_dec>)
      WITH KEY bukrs = ls_bank_map-zbukrs racct = ls_fi054-hkont_fy.
    IF sy-subrc <> 0.
      ls_declared-bukrs  = ls_bank_map-zbukrs.
      ls_declared-racct  = ls_fi054-hkont_fy.
      ls_declared-amount = ls_fi054-amount.
      APPEND ls_declared TO gt_declared.
    ELSE.
      <ls_dec>-amount = <ls_dec>-amount + ls_fi054-amount.
    ENDIF.

  ENDLOOP.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  BUILD_OUTPUT
*&---------------------------------------------------------------------*
FORM build_output.

  DATA: ls_out     TYPE tys_output,
        lv_payable TYPE hslxx12,
        lv_decl    TYPE hslxx12.

* 为每个屏幕公司代码生成一行
  LOOP AT gt_bukrs_map INTO DATA(ls_map).

    CLEAR ls_out.
    ls_out-bukrs = ls_map-bukrs.
    ls_out-ltext = ls_map-ltext.

*   遍历 6 个税种
    LOOP AT gt_tax_list INTO DATA(ls_tax).

*     应交金额
      READ TABLE gt_payable INTO DATA(ls_pay)
        WITH KEY bukrs = ls_map-bukrs racct = ls_tax-racct.
      IF sy-subrc = 0.
        lv_payable = ls_pay-hsl.
      ELSE.
        lv_payable = 0.
      ENDIF.

*     申报金额
      READ TABLE gt_declared INTO DATA(ls_dec)
        WITH KEY bukrs = ls_map-bukrs racct = ls_tax-racct.
      IF sy-subrc = 0.
        lv_decl = ls_dec-amount.
      ELSE.
        lv_decl = 0.
      ENDIF.

*     按税种填入对应列
      CASE ls_tax-racct.
        WHEN gc_tax-vat.
          ls_out-zyjzz = lv_payable.
          ls_out-zzzsb = lv_decl.
          ls_out-zzzjy = lv_payable - lv_decl.
        WHEN gc_tax-city.
          ls_out-zyjcj = lv_payable.
          ls_out-zcjsb = lv_decl.
          ls_out-zcjjy = lv_payable - lv_decl.
        WHEN gc_tax-edu.
          ls_out-zyjjy = lv_payable.
          ls_out-zjysb = lv_decl.
          ls_out-zjyjy = lv_payable - lv_decl.
        WHEN gc_tax-local.
          ls_out-zyjdf = lv_payable.
          ls_out-zdfsb = lv_decl.
          ls_out-zdfjy = lv_payable - lv_decl.
        WHEN gc_tax-stamp.
          ls_out-zyjyh = lv_payable.
          ls_out-zyhsb = lv_decl.
          ls_out-zyhjy = lv_payable - lv_decl.
        WHEN gc_tax-income.
          ls_out-zyjqy = lv_payable.
          ls_out-zqysb = lv_decl.
          ls_out-zqyjy = lv_payable - lv_decl.
      ENDCASE.

    ENDLOOP.

    APPEND ls_out TO gt_output.

  ENDLOOP.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  DISPLAY
*&---------------------------------------------------------------------*
FORM display.

  TRY.
      cl_salv_table=>factory(
        IMPORTING
          r_salv_table = gr_alv
        CHANGING
          t_table      = gt_output ).
    CATCH cx_salv_msg INTO DATA(lr_msg).
      MESSAGE lr_msg TYPE 'E'.
      RETURN.
  ENDTRY.

* 优化列宽
  DATA(lr_cols) = CAST cl_salv_columns( gr_alv->get_columns( ) ).
  lr_cols->set_optimize( 'X' ).

* 设置金额列格式
  PERFORM set_amount_column USING lr_cols 'ZYJZZ' '应交增值税'.
  PERFORM set_amount_column USING lr_cols 'ZZZSB' '申报增值税'.
  PERFORM set_amount_column USING lr_cols 'ZZZJY' '增值税校验结果'.
  PERFORM set_amount_column USING lr_cols 'ZYJCJ' '应交城建税'.
  PERFORM set_amount_column USING lr_cols 'ZCJSB' '申报城建税'.
  PERFORM set_amount_column USING lr_cols 'ZCJJY' '城建税校验结果'.
  PERFORM set_amount_column USING lr_cols 'ZYJJY' '应交教育费附加'.
  PERFORM set_amount_column USING lr_cols 'ZJYSB' '申报教育费附加'.
  PERFORM set_amount_column USING lr_cols 'ZJYJY' '教育费附加校验结果'.
  PERFORM set_amount_column USING lr_cols 'ZYJDF' '应交地方教育费附加'.
  PERFORM set_amount_column USING lr_cols 'ZDFSB' '申报地方教育费'.
  PERFORM set_amount_column USING lr_cols 'ZDFJY' '地方教育费校验结果'.
  PERFORM set_amount_column USING lr_cols 'ZYJYH' '应交印花税'.
  PERFORM set_amount_column USING lr_cols 'ZYHSB' '申报印花税'.
  PERFORM set_amount_column USING lr_cols 'ZYHJY' '印花税校验结果'.
  PERFORM set_amount_column USING lr_cols 'ZYJQY' '应交企业所得税'.
  PERFORM set_amount_column USING lr_cols 'ZQYSB' '申报企业所得税'.
  PERFORM set_amount_column USING lr_cols 'ZQYJY' '企业所得税校验结果'.

  PERFORM set_text_column USING lr_cols 'BUKRS' '公司代码'.
  PERFORM set_text_column USING lr_cols 'LTEXT' '机构名称'.

* 斑马纹
  DATA(lo_display) = gr_alv->get_display_settings( ).
  lo_display->set_striped_pattern( 'X' ).

* 布局保存
  DATA: ls_key TYPE salv_s_layout_key.
  ls_key-report = sy-repid.
  DATA(lo_layout) = gr_alv->get_layout( ).
  lo_layout->set_key( ls_key ).
  lo_layout->set_save_restriction( if_salv_c_layout=>restrict_none ).

  gr_alv->display( ).

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  SET_TEXT_COLUMN
*&---------------------------------------------------------------------*
FORM set_text_column USING pr_cols TYPE REF TO cl_salv_columns
                           VALUE(fname)
                           VALUE(text).

  DATA: lr_column TYPE REF TO cl_salv_column_table.
  TRY.
      lr_column ?= pr_cols->get_column( fname ).
      lr_column->set_long_text( CONV #( text ) ).
      lr_column->set_medium_text( CONV #( text ) ).
      lr_column->set_short_text( CONV #( text ) ).
    CATCH cx_salv_not_found.
  ENDTRY.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  SET_AMOUNT_COLUMN
*&---------------------------------------------------------------------*
FORM set_amount_column USING pr_cols TYPE REF TO cl_salv_columns
                             VALUE(fname)
                             VALUE(text).

  DATA: lr_column TYPE REF TO cl_salv_column_table.
  TRY.
      lr_column ?= pr_cols->get_column( fname ).
      lr_column->set_long_text( CONV #( text ) ).
      lr_column->set_medium_text( CONV #( text ) ).
      lr_column->set_short_text( CONV #( text ) ).
      lr_column->set_zero( 'X' ).
    CATCH cx_salv_not_found.
  ENDTRY.

ENDFORM.
