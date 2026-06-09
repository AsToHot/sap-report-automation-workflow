*&---------------------------------------------------------------------*
*&  包含                ZTEST102F01
*&  科目余额表 - 逻辑与 ALV 显示
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
*       从 FAGLFLEXT 读取科目余额，按期间动态汇总
*&---------------------------------------------------------------------*
FORM get_data.

  DATA: lv_bukrs TYPE bukrs.

*--------------------------------------------------
*  1. 读取公司代码映射
*--------------------------------------------------
  SELECT SINGLE bukrs, zfgs, zzgs, prctr, ltext
    FROM zsap_bukrs
    INTO @gs_bukrs
    WHERE bukrs IN @s_bukrs.

  IF sy-subrc <> 0.
    MESSAGE '未找到所选公司代码的映射配置' TYPE 'E'.
    RETURN.
  ENDIF.

  IF gs_bukrs-zfgs = ''.
    lv_bukrs = gs_bukrs-bukrs.
  ELSE.
    lv_bukrs = gs_bukrs-zzgs.
  ENDIF.

*--------------------------------------------------
*  2. 读取 FAGLFLEXT 原始数据
*--------------------------------------------------
  SELECT racct, rbukrs, prctr, rfarea AS rfare, ryear, rpmax, drcrk, rTCUR,
         hslvt, hsl01, hsl02, hsl03, hsl04, hsl05, hsl06,
         hsl07, hsl08, hsl09, hsl10, hsl11, hsl12,
         hsl13, hsl14, hsl15, hsl16,
         tslvt, tsl01, tsl02, tsl03, tsl04, tsl05, tsl06,
         tsl07, tsl08, tsl09, tsl10, tsl11, tsl12,
         tsl13, tsl14, tsl15, tsl16
    FROM faglflext
    INTO TABLE @gt_faglflext
    WHERE rbukrs EQ @lv_bukrs
      AND ryear  EQ @p_ryear
      AND rpmax IN @s_rpmax
      AND racct IN @s_racct.

  IF sy-subrc <> 0.
    MESSAGE s000(oo) WITH '未找到符合条件的数据'.
    RETURN.
  ENDIF.

*--------------------------------------------------
*  3. 利润中心限制（仅 ZFGS ≠ '' 时）
*--------------------------------------------------
  IF gs_bukrs-zfgs <> '' AND gs_bukrs-prctr IS NOT INITIAL.

    SELECT prctr FROM cepc
      INTO TABLE @DATA(lt_cepc)
      WHERE khinr = @gs_bukrs-prctr
        AND datbi = '99991231'
        AND kokrs = 'EEKA'.

    IF sy-subrc = 0.
      SORT lt_cepc BY prctr.
      LOOP AT gt_faglflext ASSIGNING FIELD-SYMBOL(<gl_del>).
        READ TABLE lt_cepc TRANSPORTING NO FIELDS
          WITH KEY prctr = <gl_del>-prctr BINARY SEARCH.
        IF sy-subrc <> 0.
          DELETE gt_faglflext.
        ENDIF.
      ENDLOOP.
    ENDIF.

  ENDIF.

  IF gt_faglflext[] IS INITIAL.
    MESSAGE s000(oo) WITH '利润中心过滤后无数据'.
    RETURN.
  ENDIF.

*--------------------------------------------------
*  4. 确定期间范围
*--------------------------------------------------
  DATA: lv_pfrom TYPE rpmax,
        lv_pto   TYPE rpmax.

  IF s_rpmax[] IS INITIAL.
    lv_pfrom = '001'.
    lv_pto   = '016'.
  ELSE.
    lv_pfrom = s_rpmax-low.
    IF s_rpmax-high IS INITIAL.
      lv_pto = lv_pfrom.
    ELSE.
      lv_pto = s_rpmax-high.
    ENDIF.
  ENDIF.

  gv_pfrom_i = lv_pfrom.
  gv_pto_i   = lv_pto.

*--------------------------------------------------
*  5. 聚合：逐行计算期间金额，按科目汇总
*--------------------------------------------------
  DATA: BEGIN OF gs_agg,
          racct TYPE racct,
          prctr TYPE prctr,
          rfare TYPE fkber,
          open_s  TYPE hslxx12,
          open_h  TYPE hslxx12,
          per_s   TYPE hslxx12,
          per_h   TYPE hslxx12,
          ytd_s   TYPE hslxx12,
          ytd_h   TYPE hslxx12,
          open_s1 TYPE tslxx12,
          open_h1 TYPE tslxx12,
          per_s1  TYPE tslxx12,
          per_h1  TYPE tslxx12,
          ytd_s1  TYPE tslxx12,
          ytd_h1  TYPE tslxx12,
        END OF gs_agg.
  DATA: gt_agg LIKE TABLE OF gs_agg.

  LOOP AT gt_faglflext ASSIGNING FIELD-SYMBOL(<gl>).

    CLEAR gs_agg.
    gs_agg-racct = <gl>-racct.
    gs_agg-prctr = <gl>-prctr.
    gs_agg-rfare = <gl>-rfare.

    " 本币(HSL) — 期初 = HSLVT + 前序期间
    DATA(lv_open)  = <gl>-hslvt.
    DATA(lv_period) = CONV hslxx12( 0 ).
    DATA(lv_ytd)    = CONV hslxx12( 0 ).

    PERFORM sum_hsl_periods USING <gl> 1 16
      CHANGING lv_open lv_period lv_ytd.

    " 外币(TSL) — 同逻辑
    DATA(lv_open1)  = <gl>-tslvt.
    DATA(lv_period1) = CONV tslxx12( 0 ).
    DATA(lv_ytd1)    = CONV tslxx12( 0 ).

    PERFORM sum_tsl_periods USING <gl> 1 16
      CHANGING lv_open1 lv_period1 lv_ytd1.

    " 按借贷标识归类
    IF <gl>-drcrk = 'S'.
      gs_agg-open_s  = lv_open.
      gs_agg-per_s   = lv_period.
      gs_agg-ytd_s   = lv_ytd.
      gs_agg-open_s1 = lv_open1.
      gs_agg-per_s1  = lv_period1.
      gs_agg-ytd_s1  = lv_ytd1.
    ELSE.
      gs_agg-open_h  = lv_open.
      gs_agg-per_h   = lv_period.
      gs_agg-ytd_h   = lv_ytd.
      gs_agg-open_h1 = lv_open1.
      gs_agg-per_h1  = lv_period1.
      gs_agg-ytd_h1  = lv_ytd1.
    ENDIF.

    COLLECT gs_agg INTO gt_agg.

  ENDLOOP.

*--------------------------------------------------
*  6. 结果拆分 → 输出内表 + 补充描述
*--------------------------------------------------
  " 预加载 SKAT 描述
  SELECT saknr, txt50 FROM skat
    INTO TABLE @gt_skat
    WHERE spras = '1'
      AND ktopl = 'EEKA'.
  SORT gt_skat BY saknr.

  " 预加载 SKA1（1002* 科目取维度）
  SELECT saknr, zfkyh, zyhzh FROM ska1
    INTO TABLE @gt_ska1
    WHERE ktopl = 'EEKA'.
  SORT gt_ska1 BY saknr.

  " 预加载 TFKBT（6601* 科目取功能范围描述）
  SELECT fkber, fkbtx FROM tfkbt
    INTO TABLE @gt_tfkbt
    WHERE spras = '1'.
  SORT gt_tfkbt BY fkber.

  LOOP AT gt_agg INTO gs_agg.

    CLEAR gs_data.

    gs_data-zyjkm = gs_agg-racct(4).
    gs_data-racct = gs_agg-racct.

    " 科目描述
    READ TABLE gt_skat INTO DATA(ls_skat) WITH KEY saknr = gs_agg-racct BINARY SEARCH.
    IF sy-subrc = 0.
      gs_data-txt50 = ls_skat-txt50.
    ENDIF.

    " 核算维度编码/名称
    PERFORM get_dimension USING gs_agg-racct gs_agg-rfare
      CHANGING gs_data-zfzhs gs_data-zfztx.

    " 期初余额（本币）= open_s - open_h
    DATA(lv_open_net) = gs_agg-open_s - gs_agg-open_h.
    IF lv_open_net >= 0.
      gs_data-zqcjf = lv_open_net.
    ELSE.
      gs_data-zqcdf = - lv_open_net.
    ENDIF.

    " 本期发生
    gs_data-zbqjf = gs_agg-per_s.
    gs_data-zbqdf = gs_agg-per_h.

    " 本年累计
    gs_data-zbnjf = gs_agg-ytd_s.
    gs_data-zbndf = gs_agg-ytd_h.

    " 期末余额 = opening_net + period_s - period_h
    DATA(lv_close_net) = lv_open_net + gs_agg-per_s - gs_agg-per_h.
    IF lv_close_net >= 0.
      gs_data-zqmjf = lv_close_net.
    ELSE.
      gs_data-zqmdf = - lv_close_net.
    ENDIF.

    " 外币（同逻辑）
    DATA(lv_open_net1) = gs_agg-open_s1 - gs_agg-open_h1.
    IF lv_open_net1 >= 0.
      gs_data-zqcjf1 = lv_open_net1.
    ELSE.
      gs_data-zqcdf1 = - lv_open_net1.
    ENDIF.
    gs_data-zbqjf1 = gs_agg-per_s1.
    gs_data-zbqdf1 = gs_agg-per_h1.
    gs_data-zbnjf1 = gs_agg-ytd_s1.
    gs_data-zbndf1 = gs_agg-ytd_h1.
    DATA(lv_close_net1) = lv_open_net1 + gs_agg-per_s1 - gs_agg-per_h1.
    IF lv_close_net1 >= 0.
      gs_data-zqmjf1 = lv_close_net1.
    ELSE.
      gs_data-zqmdf1 = - lv_close_net1.
    ENDIF.

    APPEND gs_data TO gt_data.

  ENDLOOP.

  SORT gt_data BY racct.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  SUM_HSL_PERIODS
*&---------------------------------------------------------------------*
*       对一条 FAGLFLEXT 行，遍历16个期间，将金额归入期初/本期/累计
*       p_begin/p_end: 循环范围 (1~16)
*       CHANGING: cv_open 包含 HSLVT 初始值，会叠加上前序期间
*                 cv_period / cv_ytd 在本 FORM 中累加
*&---------------------------------------------------------------------*
FORM sum_hsl_periods USING ps_gl  TYPE ty_faglflext
                           p_begin TYPE i
                           p_end   TYPE i
                  CHANGING cv_open   TYPE hslxx12
                           cv_period TYPE hslxx12
                           cv_ytd    TYPE hslxx12.

  DATA: lv_p  TYPE i,
        lv_hsl TYPE hslxx12.

  DO p_end - p_begin + 1 TIMES.
    lv_p = p_begin + sy-index - 1.

    PERFORM get_hsl_field USING ps_gl lv_p CHANGING lv_hsl.

    " 期初 = 前序期间（< p_from）
    IF lv_p < gv_pfrom_i.
      cv_open = cv_open + lv_hsl.
    ENDIF.

    " 本期 = [p_from, p_to]
    IF lv_p >= gv_pfrom_i AND lv_p <= gv_pto_i.
      cv_period = cv_period + lv_hsl.
    ENDIF.

    " 本年累计 = [001, p_to]
    IF lv_p <= gv_pto_i.
      cv_ytd = cv_ytd + lv_hsl.
    ENDIF.

  ENDDO.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  GET_HSL_FIELD
*&---------------------------------------------------------------------*
FORM get_hsl_field USING ps_gl TYPE ty_faglflext
                         p_period TYPE i
                CHANGING cv_hsl TYPE hslxx12.

  CASE p_period.
    WHEN 1.  cv_hsl = ps_gl-hsl01.
    WHEN 2.  cv_hsl = ps_gl-hsl02.
    WHEN 3.  cv_hsl = ps_gl-hsl03.
    WHEN 4.  cv_hsl = ps_gl-hsl04.
    WHEN 5.  cv_hsl = ps_gl-hsl05.
    WHEN 6.  cv_hsl = ps_gl-hsl06.
    WHEN 7.  cv_hsl = ps_gl-hsl07.
    WHEN 8.  cv_hsl = ps_gl-hsl08.
    WHEN 9.  cv_hsl = ps_gl-hsl09.
    WHEN 10. cv_hsl = ps_gl-hsl10.
    WHEN 11. cv_hsl = ps_gl-hsl11.
    WHEN 12. cv_hsl = ps_gl-hsl12.
    WHEN 13. cv_hsl = ps_gl-hsl13.
    WHEN 14. cv_hsl = ps_gl-hsl14.
    WHEN 15. cv_hsl = ps_gl-hsl15.
    WHEN 16. cv_hsl = ps_gl-hsl16.
    WHEN OTHERS. cv_hsl = 0.
  ENDCASE.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  SUM_TSL_PERIODS
*&---------------------------------------------------------------------*
FORM sum_tsl_periods USING ps_gl  TYPE ty_faglflext
                           p_begin TYPE i
                           p_end   TYPE i
                  CHANGING cv_open   TYPE tslxx12
                           cv_period TYPE tslxx12
                           cv_ytd    TYPE tslxx12.

  DATA: lv_p  TYPE i,
        lv_tsl TYPE tslxx12.

  DO p_end - p_begin + 1 TIMES.
    lv_p = p_begin + sy-index - 1.

    PERFORM get_tsl_field USING ps_gl lv_p CHANGING lv_tsl.

    IF lv_p < gv_pfrom_i.
      cv_open = cv_open + lv_tsl.
    ENDIF.

    IF lv_p >= gv_pfrom_i AND lv_p <= gv_pto_i.
      cv_period = cv_period + lv_tsl.
    ENDIF.

    IF lv_p <= gv_pto_i.
      cv_ytd = cv_ytd + lv_tsl.
    ENDIF.

  ENDDO.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  GET_TSL_FIELD
*&---------------------------------------------------------------------*
FORM get_tsl_field USING ps_gl TYPE ty_faglflext
                         p_period TYPE i
                CHANGING cv_tsl TYPE tslxx12.

  CASE p_period.
    WHEN 1.  cv_tsl = ps_gl-tsl01.
    WHEN 2.  cv_tsl = ps_gl-tsl02.
    WHEN 3.  cv_tsl = ps_gl-tsl03.
    WHEN 4.  cv_tsl = ps_gl-tsl04.
    WHEN 5.  cv_tsl = ps_gl-tsl05.
    WHEN 6.  cv_tsl = ps_gl-tsl06.
    WHEN 7.  cv_tsl = ps_gl-tsl07.
    WHEN 8.  cv_tsl = ps_gl-tsl08.
    WHEN 9.  cv_tsl = ps_gl-tsl09.
    WHEN 10. cv_tsl = ps_gl-tsl10.
    WHEN 11. cv_tsl = ps_gl-tsl11.
    WHEN 12. cv_tsl = ps_gl-tsl12.
    WHEN 13. cv_tsl = ps_gl-tsl13.
    WHEN 14. cv_tsl = ps_gl-tsl14.
    WHEN 15. cv_tsl = ps_gl-tsl15.
    WHEN 16. cv_tsl = ps_gl-tsl16.
    WHEN OTHERS. cv_tsl = 0.
  ENDCASE.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  GET_DIMENSION
*&---------------------------------------------------------------------*
FORM get_dimension USING p_racct  TYPE racct
                         p_rfare  TYPE fkber
                CHANGING cv_zfzhs TYPE char64
                         cv_zfztx TYPE char50.

  IF p_racct CP '1002*'.
    READ TABLE gt_ska1 INTO DATA(ls_ska1) WITH KEY saknr = p_racct BINARY SEARCH.
    IF sy-subrc = 0.
      cv_zfzhs = ls_ska1-zfkyh.
      cv_zfztx = ls_ska1-zyhzh.
    ENDIF.

  ELSEIF p_racct CP '6601*'.
    cv_zfzhs = p_rfare.
    READ TABLE gt_tfkbt INTO DATA(ls_tfkbt) WITH KEY fkber = p_rfare BINARY SEARCH.
    IF sy-subrc = 0.
      cv_zfztx = ls_tfkbt-fkbtx.
    ENDIF.

  ENDIF.

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
          t_table      = gt_data ).
    CATCH cx_salv_msg INTO DATA(lr_msg).
      MESSAGE lr_msg TYPE 'E'.
      RETURN.
  ENDTRY.

  DATA(lr_cols) = CAST cl_salv_columns( gr_alv->get_columns( ) ).
  lr_cols->set_optimize( 'X' ).

  gr_alv->set_screen_status(
    pfstatus      = 'STANDARD'
    report        = 'SAPLKKBL'
    set_functions = gr_alv->c_functions_all
  ).

  DATA(lr_selections) = gr_alv->get_selections( ).
  lr_selections->set_selection_mode( 0 ).

  PERFORM set_column USING 'X' lr_cols 'ZYJKM'   '一级节点' ''.
  PERFORM set_column USING 'X' lr_cols 'RACCT'   '科目编码' ''.
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

  " 外币列
  PERFORM set_column USING '' lr_cols 'ZQCJF1'  '期初余额借方(外币)' ''.
  PERFORM set_column USING '' lr_cols 'ZQCDF1'  '期初余额贷方(外币)' ''.
  PERFORM set_column USING '' lr_cols 'ZBQJF1'  '本期发生借方(外币)' ''.
  PERFORM set_column USING '' lr_cols 'ZBQDF1'  '本期发生贷方(外币)' ''.
  PERFORM set_column USING '' lr_cols 'ZBNJF1'  '本年累计借方(外币)' ''.
  PERFORM set_column USING '' lr_cols 'ZBNDF1'  '本年累计贷方(外币)' ''.
  PERFORM set_column USING '' lr_cols 'ZQMJF1'  '期末余额借方(外币)' ''.
  PERFORM set_column USING '' lr_cols 'ZQMDF1'  '期末余额贷方(外币)' ''.

  IF p_forcur IS INITIAL.
    PERFORM hide_foreign_col USING lr_cols.
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
*&      Form  HIDE_FOREIGN_COL
*&---------------------------------------------------------------------*
FORM hide_foreign_col USING pr_cols TYPE REF TO cl_salv_columns.

  DATA: lr_col TYPE REF TO cl_salv_column_table.

  PERFORM try_hide_col USING pr_cols 'ZQCJF1'.
  PERFORM try_hide_col USING pr_cols 'ZQCDF1'.
  PERFORM try_hide_col USING pr_cols 'ZBQJF1'.
  PERFORM try_hide_col USING pr_cols 'ZBQDF1'.
  PERFORM try_hide_col USING pr_cols 'ZBNJF1'.
  PERFORM try_hide_col USING pr_cols 'ZBNDF1'.
  PERFORM try_hide_col USING pr_cols 'ZQMJF1'.
  PERFORM try_hide_col USING pr_cols 'ZQMDF1'.

ENDFORM.

FORM try_hide_col USING pr_cols TYPE REF TO cl_salv_columns VALUE(fname).

  DATA: lr_col TYPE REF TO cl_salv_column_table.
  TRY.
      lr_col ?= pr_cols->get_column( fname ).
      lr_col->set_visible( abap_false ).
      lr_col->set_technical( abap_true ).
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
    WHEN 'RACCT'.
      READ TABLE gt_data INTO gs_data INDEX p_row.
      CHECK sy-subrc = 0.

      SET PARAMETER ID 'SAK' FIELD gs_data-racct.
      SET PARAMETER ID 'BUK' FIELD gs_bukrs-bukrs.
      SET PARAMETER ID 'GJR' FIELD p_ryear.

      CALL TRANSACTION 'FS10N' AND SKIP FIRST SCREEN.

    WHEN OTHERS.
  ENDCASE.

ENDFORM.
