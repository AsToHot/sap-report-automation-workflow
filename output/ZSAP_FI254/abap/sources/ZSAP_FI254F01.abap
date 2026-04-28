*&---------------------------------------------------------------------*
*&  包含                ZSAP_FI254F01
*&  科目余额表 - 逻辑与 ALV 显示
*&---------------------------------------------------------------------
CLASS lcl_handle_events IMPLEMENTATION.
  METHOD on_user_command.
    PERFORM handle_user_command USING e_salv_function.
  ENDMETHOD.

  METHOD on_double_click.
    PERFORM on_double_click USING row column.
  ENDMETHOD.
ENDCLASS.

*&---------------------------------------------------------------------*
*&      Form  GET_DATA
*&---------------------------------------------------------------------
FORM get_data.

  " 1. 读取 ZSAP_BUKRS
  SELECT SINGLE * FROM zsap_bukrs
    WHERE bukrs = @p_bukrs
    INTO @DATA(ls_zsap_bukrs).

  " 2. 确定 FAGLFLEXT 查询条件
  DATA: lv_rbukrs TYPE bukrs,
        lt_prctr  TYPE RANGE OF prctr.

  IF sy-subrc = 0.
    IF ls_zsap_bukrs-zfgs = ''.
      lv_rbukrs = ls_zsap_bukrs-bukrs.
    ELSE.
      lv_rbukrs = ls_zsap_bukrs-zzgs.
      SELECT prctr FROM cepc
        WHERE khinr = @ls_zsap_bukrs-prctr
          AND datbi = '99991231'
          AND kokrs = 'EEKA'
        INTO TABLE @DATA(lt_cepc_prctr).
      DATA: ls_prctr LIKE LINE OF lt_prctr.
      LOOP AT lt_cepc_prctr INTO DATA(ls_cepc_prctr).
        ls_prctr-sign   = 'I'.
        ls_prctr-option = 'EQ'.
        ls_prctr-low    = ls_cepc_prctr-prctr.
        APPEND ls_prctr TO lt_prctr.
      ENDLOOP.
    ENDIF.
  ENDIF.

  " 3. 查询 FAGLFLEXT
  DATA: lt_faglflext TYPE TABLE OF faglflext.

  IF lt_prctr IS NOT INITIAL.
    SELECT * FROM faglflext
      WHERE rbukrs = @lv_rbukrs
        AND ryear  = @p_gjahr
        AND racct  IN @s_racct
        AND prctr  IN @lt_prctr
      INTO TABLE @lt_faglflext.
  ELSE.
    SELECT * FROM faglflext
      WHERE rbukrs = @lv_rbukrs
        AND ryear  = @p_gjahr
        AND racct  IN @s_racct
      INTO TABLE @lt_faglflext.
  ENDIF.

  " 4. 查询辅助表
  SELECT * FROM skat
    WHERE ktopl = 'EEKA'
      AND spras = @sy-langu
      AND saknr IN @s_racct
    INTO TABLE @DATA(lt_skat).

  SELECT * FROM ska1
    WHERE ktopl = 'EEKA'
      AND saknr IN @s_racct
    INTO TABLE @DATA(lt_ska1).

  DATA: lt_tfkbt TYPE TABLE OF tfkbt.
  IF lt_faglflext IS NOT INITIAL.
    SELECT * FROM tfkbt
      FOR ALL ENTRIES IN @lt_faglflext
      WHERE spras = '1'
        AND fkber = @lt_faglflext-rfarea
      INTO TABLE @lt_tfkbt.
  ENDIF.

  " 5. 按 RACCT + DRCRK 汇总
  DATA: lt_sum TYPE TABLE OF ty_sum,
        ls_sum TYPE ty_sum.

  LOOP AT lt_faglflext INTO DATA(ls_fagl).
    READ TABLE lt_sum ASSIGNING FIELD-SYMBOL(<fs_sum>)
      WITH KEY racct = ls_fagl-racct drcrk = ls_fagl-drcrk.
    IF sy-subrc NE 0.
      CLEAR ls_sum.
      ls_sum-racct = ls_fagl-racct.
      ls_sum-drcrk = ls_fagl-drcrk.
      APPEND ls_sum TO lt_sum.
      READ TABLE lt_sum ASSIGNING <fs_sum>
        WITH KEY racct = ls_fagl-racct drcrk = ls_fagl-drcrk.
    ENDIF.

    <fs_sum>-hslvt = <fs_sum>-hslvt + ls_fagl-hslvt.
    <fs_sum>-tslvt = <fs_sum>-tslvt + ls_fagl-tslvt.

    DATA: lv_field TYPE c LENGTH 5,
          lv_idx    TYPE n LENGTH 2.
    DO 16 TIMES.
      lv_idx = sy-index.
      CONCATENATE 'HSL' lv_idx INTO lv_field.
      ASSIGN COMPONENT lv_field OF STRUCTURE ls_fagl TO FIELD-SYMBOL(<fs_src>).
      ASSIGN COMPONENT lv_field OF STRUCTURE <fs_sum> TO FIELD-SYMBOL(<fs_tgt>).
      <fs_tgt> = <fs_tgt> + <fs_src>.

      CONCATENATE 'TSL' lv_idx INTO lv_field.
      ASSIGN COMPONENT lv_field OF STRUCTURE ls_fagl TO <fs_src>.
      ASSIGN COMPONENT lv_field OF STRUCTURE <fs_sum> TO <fs_tgt>.
      <fs_tgt> = <fs_tgt> + <fs_src>.
    ENDDO.
  ENDLOOP.

  " 6. 构建输出表
  DATA: lv_low   TYPE i,
        lv_high  TYPE i.

  lv_low  = CONV i( s_rpmax-low ).
  lv_high = CONV i( s_rpmax-high ).
  IF lv_low IS INITIAL.
    lv_low = 1.
  ENDIF.
  IF lv_high IS INITIAL.
    lv_high = 16.
  ENDIF.

  DATA: lt_racct TYPE TABLE OF racct.
  LOOP AT lt_sum INTO DATA(ls_sum_racct).
    APPEND ls_sum_racct-racct TO lt_racct.
  ENDLOOP.
  SORT lt_racct.
  DELETE ADJACENT DUPLICATES FROM lt_racct.

  LOOP AT lt_racct INTO DATA(lv_racct).
    CLEAR gs_out.
    gs_out-racct = lv_racct.
    gs_out-zyjkm = lv_racct+0(4).

    " 科目描述
    READ TABLE lt_skat INTO DATA(ls_skat) WITH KEY saknr = lv_racct.
    IF sy-subrc = 0.
      gs_out-txt50 = ls_skat-txt50.
    ENDIF.

    " 辅助维度
    IF lv_racct CP '1002*'.
      READ TABLE lt_ska1 INTO DATA(ls_ska1) WITH KEY saknr = lv_racct.
      IF sy-subrc = 0.
        gs_out-zfzhs = ls_ska1-zfkyh.
        gs_out-zfztx = ls_ska1-zyhzh.
      ENDIF.
    ELSEIF lv_racct CP '6601*'.
      READ TABLE lt_faglflext INTO ls_fagl WITH KEY racct = lv_racct.
      IF sy-subrc = 0.
        gs_out-zfzhs = ls_fagl-rfarea.
        READ TABLE lt_tfkbt INTO DATA(ls_tfkbt) WITH KEY fkber = ls_fagl-rfarea.
        IF sy-subrc = 0.
          gs_out-zfztx = ls_tfkbt-fkbtx.
        ENDIF.
      ENDIF.
    ENDIF.

    " 查找 S 和 H 汇总
    READ TABLE lt_sum INTO DATA(ls_sum_s) WITH KEY racct = lv_racct drcrk = 'S'.
    READ TABLE lt_sum INTO DATA(ls_sum_h) WITH KEY racct = lv_racct drcrk = 'H'.

    " --- 本币计算 ---
    PERFORM calc_amount USING ls_sum_s ls_sum_h lv_low lv_high 'HSL'
      CHANGING gs_out-zqcjf gs_out-zqcdf gs_out-zbqjf gs_out-zbqdf
               gs_out-zbnjf gs_out-zbndf gs_out-zqmjf gs_out-zqmdf.

    " --- 外币计算 ---
    PERFORM calc_amount USING ls_sum_s ls_sum_h lv_low lv_high 'TSL'
      CHANGING gs_out-zqcjf1 gs_out-zqcdf1 gs_out-zbqjf1 gs_out-zbqdf1
               gs_out-zbnjf1 gs_out-zbndf1 gs_out-zqmjf1 gs_out-zqmdf1.

    APPEND gs_out TO gt_out.
  ENDLOOP.

  SORT gt_out BY racct.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  CALC_AMOUNT
*&---------------------------------------------------------------------
FORM calc_amount USING    is_sum_s  TYPE ty_sum
                          is_sum_h  TYPE ty_sum
                          iv_low    TYPE i
                          iv_high   TYPE i
                          iv_prefix TYPE string
                 CHANGING cv_qc_jf  TYPE hslvt12
                          cv_qc_df  TYPE hslvt12
                          cv_bq_jf  TYPE hslxx12
                          cv_bq_df  TYPE hslxx12
                          cv_bn_jf  TYPE hslxx12
                          cv_bn_df  TYPE hslxx12
                          cv_qm_jf  TYPE hslvt12
                          cv_qm_df  TYPE hslvt12.

  DATA: lv_qc   TYPE p LENGTH 16 DECIMALS 2,
        lv_bq_s TYPE p LENGTH 16 DECIMALS 2,
        lv_bq_h TYPE p LENGTH 16 DECIMALS 2,
        lv_bn_s TYPE p LENGTH 16 DECIMALS 2,
        lv_bn_h TYPE p LENGTH 16 DECIMALS 2,
        lv_qm   TYPE p LENGTH 16 DECIMALS 2,
        lv_vt_s TYPE p LENGTH 16 DECIMALS 2,
        lv_vt_h TYPE p LENGTH 16 DECIMALS 2,
        lv_field TYPE c LENGTH 5,
        lv_idx   TYPE n LENGTH 2.

  " 读取期初余额（VT）
  IF iv_prefix = 'HSL'.
    lv_vt_s = is_sum_s-hslvt.
    lv_vt_h = is_sum_h-hslvt.
  ELSE.
    lv_vt_s = is_sum_s-tslvt.
    lv_vt_h = is_sum_h-tslvt.
  ENDIF.

  lv_qc = lv_vt_s + lv_vt_h.

  " 期初 = VT + 起始期间之前的累计
  DO iv_low - 1 TIMES.
    lv_idx = sy-index.
    CONCATENATE iv_prefix lv_idx INTO lv_field.
    ASSIGN COMPONENT lv_field OF STRUCTURE is_sum_s TO FIELD-SYMBOL(<fs_s>).
    ASSIGN COMPONENT lv_field OF STRUCTURE is_sum_h TO FIELD-SYMBOL(<fs_h>).
    lv_qc = lv_qc + <fs_s> + <fs_h>.
  ENDDO.

  " 本期和本年累计
  CLEAR: lv_bq_s, lv_bq_h, lv_bn_s, lv_bn_h.
  DO iv_high TIMES.
    DATA(lv_period) = sy-index.
    lv_idx = lv_period.
    CONCATENATE iv_prefix lv_idx INTO lv_field.
    ASSIGN COMPONENT lv_field OF STRUCTURE is_sum_s TO <fs_s>.
    ASSIGN COMPONENT lv_field OF STRUCTURE is_sum_h TO <fs_h>.

    lv_bn_s = lv_bn_s + <fs_s>.
    lv_bn_h = lv_bn_h + <fs_h>.

    IF lv_period >= iv_low.
      lv_bq_s = lv_bq_s + <fs_s>.
      lv_bq_h = lv_bq_h + <fs_h>.
    ENDIF.
  ENDDO.

  " 期末 = 期初 + 本期借方 - 本期贷方
  lv_qm = lv_qc + lv_bq_s - lv_bq_h.

  " 赋值到输出字段
  CLEAR: cv_qc_jf, cv_qc_df, cv_qm_jf, cv_qm_df.
  IF lv_qc >= 0.
    cv_qc_jf = lv_qc.
  ELSE.
    cv_qc_df = ABS( lv_qc ).
  ENDIF.

  cv_bq_jf = lv_bq_s.
  cv_bq_df = lv_bq_h.
  cv_bn_jf = lv_bn_s.
  cv_bn_df = lv_bn_h.

  IF lv_qm >= 0.
    cv_qm_jf = lv_qm.
  ELSE.
    cv_qm_df = ABS( lv_qm ).
  ENDIF.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  DISPLAY
*&---------------------------------------------------------------------
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

  gr_alv->set_screen_status(
    pfstatus      = 'S1000'
    report        = sy-repid
    set_functions = gr_alv->c_functions_all
  ).

  DATA(lr_selections) = gr_alv->get_selections( ).
  lr_selections->set_selection_mode( 0 ).

  PERFORM set_column USING '' lr_cols 'ZYJKM'   '一级节点' ''.
  PERFORM set_column USING '' lr_cols 'RACCT'   '科目编码' ''.
  PERFORM set_column USING '' lr_cols 'TXT50'   '科目描述' ''.
  PERFORM set_column USING '' lr_cols 'ZFZHS'   '核算维度编码' ''.
  PERFORM set_column USING '' lr_cols 'ZFZTX'   '核算维度名称' ''.
  PERFORM set_column USING '' lr_cols 'ZQCJF'   '期初余额借方' ''.
  PERFORM set_column USING '' lr_cols 'ZQCDF'   '期初余额贷方' ''.
  PERFORM set_column USING '' lr_cols 'ZBQJF'   '本期发生借方' ''.
  PERFORM set_column USING '' lr_cols 'ZBQDF'   '本期发生贷方' ''.
  PERFORM set_column USING '' lr_cols 'ZBNJF'   '本年累计借方' ''.
  PERFORM set_column USING '' lr_cols 'ZBNDF'   '本年累计贷方' ''.
  PERFORM set_column USING '' lr_cols 'ZQMJF'   '期末余额借方' ''.
  PERFORM set_column USING '' lr_cols 'ZQMDF'   '期末余额贷方' ''.

  IF p_waers = 'X'.
    PERFORM set_column USING '' lr_cols 'ZQCJF1'  '期初余额借方（外币）' ''.
    PERFORM set_column USING '' lr_cols 'ZQCDF1'  '期初余额贷方（外币）' ''.
    PERFORM set_column USING '' lr_cols 'ZBQJF1'  '本期发生借方（外币）' ''.
    PERFORM set_column USING '' lr_cols 'ZBQDF1'  '本期发生贷方（外币）' ''.
    PERFORM set_column USING '' lr_cols 'ZBNJF1'  '本年累计借方（外币）' ''.
    PERFORM set_column USING '' lr_cols 'ZBNDF1'  '本年累计贷方（外币）' ''.
    PERFORM set_column USING '' lr_cols 'ZQMJF1'  '期末余额借方（外币）' ''.
    PERFORM set_column USING '' lr_cols 'ZQMDF1'  '期末余额贷方（外币）' ''.
  ELSE.
    PERFORM set_column USING 'X' lr_cols 'ZQCJF1' '' ''.
    PERFORM set_column USING 'X' lr_cols 'ZQCDF1' '' ''.
    PERFORM set_column USING 'X' lr_cols 'ZBQJF1' '' ''.
    PERFORM set_column USING 'X' lr_cols 'ZBQDF1' '' ''.
    PERFORM set_column USING 'X' lr_cols 'ZBNJF1' '' ''.
    PERFORM set_column USING 'X' lr_cols 'ZBNDF1' '' ''.
    PERFORM set_column USING 'X' lr_cols 'ZQMJF1' '' ''.
    PERFORM set_column USING 'X' lr_cols 'ZQMDF1' '' ''.
  ENDIF.

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
*&---------------------------------------------------------------------
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
*&---------------------------------------------------------------------
FORM handle_user_command USING i_ucomm TYPE salv_de_function.

  CASE i_ucomm.
    WHEN OTHERS.
  ENDCASE.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  ON_DOUBLE_CLICK
*&---------------------------------------------------------------------
FORM on_double_click USING p_row TYPE i p_column TYPE lvc_fname.

  CASE p_column.
    WHEN OTHERS.
  ENDCASE.

ENDFORM.
