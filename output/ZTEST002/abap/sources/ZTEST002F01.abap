*&---------------------------------------------------------------------*
*&  包含                ZTEST002F01
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
FORM get_data.

  DATA: lv_rbukrs  TYPE faglflext-rbukrs,
        lv_prctr   TYPE zsap_bukrs-prctr,
        lv_zfgs    TYPE zsap_bukrs-zfgs,
        lv_from    TYPE i,
        lv_to      TYPE i,
        lv_opening TYPE hslvt12,
        lv_period_sum TYPE hslvt12,
        lv_ytd_sum    TYPE hslvt12,
        lv_opening_t  TYPE hslvt12,
        lv_period_sum_t TYPE hslvt12,
        lv_ytd_sum_t    TYPE hslvt12,
        lv_closing     TYPE hslvt12,
        lv_closing_t   TYPE hslvt12.


*--------------------------------------------------
* 1. 读取公司代码映射
*--------------------------------------------------
  SELECT SINGLE bukrs, zfgs, zzgs, prctr
    FROM zsap_bukrs
    INTO @gs_bukrs_map
    WHERE bukrs = @p_bukrs.

  IF sy-subrc <> 0.
    MESSAGE '公司代码映射表中无数据' TYPE 'E'.
    RETURN.
  ENDIF.

  lv_zfgs = gs_bukrs_map-zfgs.

  IF lv_zfgs = ''.
    lv_rbukrs = p_bukrs.
  ELSE.
    lv_rbukrs = gs_bukrs_map-zzgs.
  ENDIF.

*--------------------------------------------------
* 2. 若非公司代码，读取利润中心组
*--------------------------------------------------
  IF lv_zfgs <> ''.
    SELECT khinr, prctr
      FROM cepc
      INTO TABLE @gt_cepc
      WHERE khinr = @gs_bukrs_map-prctr
        AND datbi = '99991231'
        AND kokrs = 'EEKA'.

    IF gt_cepc IS INITIAL.
      MESSAGE '利润中心组中无匹配数据' TYPE 'E'.
      RETURN.
    ENDIF.

    SORT gt_cepc BY khinr prctr.
  ENDIF.

*--------------------------------------------------
* 3. 计算期间范围
*--------------------------------------------------
  DATA: ls_rpmax LIKE LINE OF s_rpmax.
  READ TABLE s_rpmax INDEX 1 INTO ls_rpmax.
  IF sy-subrc = 0.
    lv_from = ls_rpmax-low.
    lv_to   = ls_rpmax-high.
  ELSE.
    MESSAGE '期间范围必输' TYPE 'E'.
    RETURN.
  ENDIF.

  IF lv_from < 1 OR lv_to > 16 OR lv_from > lv_to.
    MESSAGE '期间范围必须在 001-016 内' TYPE 'E'.
    RETURN.
  ENDIF.

*--------------------------------------------------
* 4. 读取科目描述（SKAT）
*--------------------------------------------------
  IF s_racct[] IS NOT INITIAL.
    SELECT saknr, txt50
      FROM skat
      INTO TABLE @gt_skat_cache
      WHERE spras = '1'
        AND ktopl = 'EEKA'
        AND saknr IN @s_racct.
  ELSE.
    SELECT saknr, txt50
      FROM skat
      INTO TABLE @gt_skat_cache
      WHERE spras = '1'
        AND ktopl = 'EEKA'.
  ENDIF.

*--------------------------------------------------
* 5. 读取科目主数据（SKA1）用于 1002* 辅助维度
*--------------------------------------------------
  IF s_racct[] IS NOT INITIAL.
    SELECT saknr, zfkyh, zyhzh
      FROM ska1
      INTO TABLE @gt_ska1_cache
      WHERE ktopl = 'EEKA'
        AND saknr IN @s_racct.
  ELSE.
    SELECT saknr, zfkyh, zyhzh
      FROM ska1
      INTO TABLE @gt_ska1_cache
      WHERE ktopl = 'EEKA'.
  ENDIF.

*--------------------------------------------------
* 6. 读取功能范围描述（TFKBT）用于 6601* 辅助维度
*--------------------------------------------------
  SELECT fkber, fkbtx
    FROM tfkbt
    INTO TABLE @gt_tfkbt_cache
    WHERE spras = '1'.

*--------------------------------------------------
* 7. 主数据查询 - FAGLFLEXT
*--------------------------------------------------
  SELECT racct, drcrk, rpmax, rbukrs, prctr, rfarea, rtcur,
         hslvt, hsl01, hsl02, hsl03, hsl04, hsl05, hsl06,
         hsl07, hsl08, hsl09, hsl10, hsl11, hsl12,
         hsl13, hsl14, hsl15, hsl16,
         tslvt, tsl01, tsl02, tsl03, tsl04, tsl05, tsl06,
         tsl07, tsl08, tsl09, tsl10, tsl11, tsl12,
         tsl13, tsl14, tsl15, tsl16
    FROM faglflext
    INTO CORRESPONDING FIELDS OF TABLE @gt_flex
    WHERE rldnr = '0L'
      AND rrcty = '0'
      AND rvers = '001'
      AND ryear  = @p_gjahr
      AND rbukrs = @lv_rbukrs
      AND racct  IN @s_racct.

  IF gt_flex IS INITIAL.
    MESSAGE '未找到符合条件的科目余额数据' TYPE 'S' DISPLAY LIKE 'W'.
    RETURN.
  ENDIF.

*--------------------------------------------------
* 8. 聚合处理：按 RACCT 汇总
*--------------------------------------------------
  SORT gt_flex BY racct rtcur drcrk.

  LOOP AT gt_flex ASSIGNING FIELD-SYMBOL(<fs_flex>).

    " 利润中心过滤（仅 lv_zfgs <> '' 时）
    IF lv_zfgs <> ''.
      READ TABLE gt_cepc TRANSPORTING NO FIELDS
        WITH KEY khinr = gs_bukrs_map-prctr prctr = <fs_flex>-prctr BINARY SEARCH.
      IF sy-subrc <> 0.
        CONTINUE.
      ENDIF.
    ENDIF.

    " 计算期初、本期、本年累计（本币 = HSL）
    PERFORM calc_amounts USING <fs_flex>
                               lv_from lv_to
                      CHANGING lv_opening lv_period_sum lv_ytd_sum.

    " 外币计算（仅当勾选外币时）
    IF p_fcur = 'X'.
      PERFORM calc_amounts_tsl USING <fs_flex>
                                      lv_from lv_to
                             CHANGING lv_opening_t lv_period_sum_t lv_ytd_sum_t.
    ENDIF.

    " 查找或创建输出行
    READ TABLE gt_out ASSIGNING FIELD-SYMBOL(<fs_out>)
      WITH KEY racct = <fs_flex>-racct.
    IF sy-subrc <> 0.
      APPEND INITIAL LINE TO gt_out ASSIGNING <fs_out>.
      <fs_out>-racct = <fs_flex>-racct.
      <fs_out>-zyjk  = <fs_flex>-racct(4).
      IF p_fcur = 'X'.
        <fs_out>-rtcur = <fs_flex>-rtcur.
      ENDIF.
    ENDIF.

    " 按 DRCRK 汇总
    IF <fs_flex>-drcrk = 'S'.
      ADD lv_period_sum TO <fs_out>-zbqjf.
      ADD lv_ytd_sum    TO <fs_out>-zbnjf.
      IF p_fcur = 'X'.
        ADD lv_period_sum_t TO <fs_out>-zbqjf1.
        ADD lv_ytd_sum_t    TO <fs_out>-zbnjf1.
      ENDIF.
    ELSE.
      " DRCRK='H' → 存储的 HSL 为负值，贷方列取绝对值
      ADD lv_period_sum TO <fs_out>-zbqdf.
      ADD lv_ytd_sum    TO <fs_out>-zbndf.
      IF p_fcur = 'X'.
        ADD lv_period_sum_t TO <fs_out>-zbqdf1.
        ADD lv_ytd_sum_t    TO <fs_out>-zbndf1.
      ENDIF.
    ENDIF.

    " 期初余额：汇总所有 DRCRK 行的期初净值
    ADD lv_opening TO <fs_out>-zqcjf.  " 临时存净值
    IF p_fcur = 'X'.
      ADD lv_opening_t TO <fs_out>-zqcjf1.
    ENDIF.

  ENDLOOP.

*--------------------------------------------------
* 9. 期初 & 期末余额拆分、贷方绝对值、描述回填
*--------------------------------------------------
  LOOP AT gt_out ASSIGNING <fs_out>.

    " 期初余额拆分：净值 >= 0 → 借方，< 0 → 贷方
    lv_opening = <fs_out>-zqcjf.
    IF lv_opening >= 0.
      <fs_out>-zqcjf = lv_opening.
      <fs_out>-zqcdf = 0.
    ELSE.
      <fs_out>-zqcjf = 0.
      <fs_out>-zqcdf = abs( lv_opening ).
    ENDIF.

    " 外币期初
    IF p_fcur = 'X'.
      lv_opening_t = <fs_out>-zqcjf1.
      IF lv_opening_t >= 0.
        <fs_out>-zqcjf1 = lv_opening_t.
        <fs_out>-zqcdf1 = 0.
      ELSE.
        <fs_out>-zqcjf1 = 0.
        <fs_out>-zqcdf1 = abs( lv_opening_t ).
      ENDIF.
    ENDIF.

    " 贷方取绝对值（H 行存负值）
    <fs_out>-zbqdf = abs( <fs_out>-zbqdf ).
    <fs_out>-zbndf = abs( <fs_out>-zbndf ).

    IF p_fcur = 'X'.
      <fs_out>-zbqdf1 = abs( <fs_out>-zbqdf1 ).
      <fs_out>-zbndf1 = abs( <fs_out>-zbndf1 ).
    ENDIF.

    " 期末余额 = 期初净值 + 本期借方 + 本期贷方(H为负)
    lv_closing = lv_opening + <fs_out>-zbqjf - <fs_out>-zbqdf.
    IF lv_closing >= 0.
      <fs_out>-zqmjf = lv_closing.
      <fs_out>-zqmdf = 0.
    ELSE.
      <fs_out>-zqmjf = 0.
      <fs_out>-zqmdf = abs( lv_closing ).
    ENDIF.

    IF p_fcur = 'X'.
      lv_closing_t = lv_opening_t + <fs_out>-zbqjf1 - <fs_out>-zbqdf1.
      IF lv_closing_t >= 0.
        <fs_out>-zqmjf1 = lv_closing_t.
        <fs_out>-zqmdf1 = 0.
      ELSE.
        <fs_out>-zqmjf1 = 0.
        <fs_out>-zqmdf1 = abs( lv_closing_t ).
      ENDIF.
    ENDIF.

    " 科目描述
    READ TABLE gt_skat_cache INTO DATA(ls_skat)
      WITH TABLE KEY saknr = <fs_out>-racct.
    IF sy-subrc = 0.
      <fs_out>-txt50 = ls_skat-txt50.
    ENDIF.

    " 辅助维度
    IF <fs_out>-racct(4) = '1002'.
      " 银行户
      READ TABLE gt_ska1_cache INTO DATA(ls_ska1)
        WITH TABLE KEY saknr = <fs_out>-racct.
      IF sy-subrc = 0.
        <fs_out>-zfzhs = ls_ska1-zfkyh.
        <fs_out>-zfztx = ls_ska1-zyhzh.
      ENDIF.
    ELSEIF <fs_out>-racct(4) = '6601'.
      " 功能范围
      READ TABLE gt_flex INTO DATA(ls_flex_first)
        WITH KEY racct = <fs_out>-racct.
      IF sy-subrc = 0.
        <fs_out>-zfzhs = ls_flex_first-rfarea.
        READ TABLE gt_tfkbt_cache INTO DATA(ls_tfkbt)
          WITH TABLE KEY fkber = ls_flex_first-rfarea.
        IF sy-subrc = 0.
          <fs_out>-zfztx = ls_tfkbt-fkbtx.
        ENDIF.
      ENDIF.
    ENDIF.

  ENDLOOP.

  SORT gt_out BY racct.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  CALC_AMOUNTS
*&---------------------------------------------------------------------*
*       显式字段求和（HSL）
*&---------------------------------------------------------------------*
FORM calc_amounts USING ps_flex TYPE ty_flex
                        i_from TYPE i
                        i_to   TYPE i
               CHANGING c_open  TYPE hslvt12
                        c_per   TYPE hslvt12
                        c_ytd   TYPE hslvt12.

  c_open = ps_flex-hslvt.
  CLEAR: c_per, c_ytd.

  IF i_from > 1.
    ADD ps_flex-hsl01 TO c_open.
    ADD ps_flex-hsl01 TO c_ytd.
  ELSEIF 1 <= i_to.
    ADD ps_flex-hsl01 TO c_per.
    ADD ps_flex-hsl01 TO c_ytd.
  ENDIF.

  IF i_from > 2.
    ADD ps_flex-hsl02 TO c_open.
    ADD ps_flex-hsl02 TO c_ytd.
  ELSEIF 2 <= i_to.
    ADD ps_flex-hsl02 TO c_per.
    ADD ps_flex-hsl02 TO c_ytd.
  ENDIF.

  IF i_from > 3.
    ADD ps_flex-hsl03 TO c_open.
    ADD ps_flex-hsl03 TO c_ytd.
  ELSEIF 3 <= i_to.
    ADD ps_flex-hsl03 TO c_per.
    ADD ps_flex-hsl03 TO c_ytd.
  ENDIF.

  IF i_from > 4.
    ADD ps_flex-hsl04 TO c_open.
    ADD ps_flex-hsl04 TO c_ytd.
  ELSEIF 4 <= i_to.
    ADD ps_flex-hsl04 TO c_per.
    ADD ps_flex-hsl04 TO c_ytd.
  ENDIF.

  IF i_from > 5.
    ADD ps_flex-hsl05 TO c_open.
    ADD ps_flex-hsl05 TO c_ytd.
  ELSEIF 5 <= i_to.
    ADD ps_flex-hsl05 TO c_per.
    ADD ps_flex-hsl05 TO c_ytd.
  ENDIF.

  IF i_from > 6.
    ADD ps_flex-hsl06 TO c_open.
    ADD ps_flex-hsl06 TO c_ytd.
  ELSEIF 6 <= i_to.
    ADD ps_flex-hsl06 TO c_per.
    ADD ps_flex-hsl06 TO c_ytd.
  ENDIF.

  IF i_from > 7.
    ADD ps_flex-hsl07 TO c_open.
    ADD ps_flex-hsl07 TO c_ytd.
  ELSEIF 7 <= i_to.
    ADD ps_flex-hsl07 TO c_per.
    ADD ps_flex-hsl07 TO c_ytd.
  ENDIF.

  IF i_from > 8.
    ADD ps_flex-hsl08 TO c_open.
    ADD ps_flex-hsl08 TO c_ytd.
  ELSEIF 8 <= i_to.
    ADD ps_flex-hsl08 TO c_per.
    ADD ps_flex-hsl08 TO c_ytd.
  ENDIF.

  IF i_from > 9.
    ADD ps_flex-hsl09 TO c_open.
    ADD ps_flex-hsl09 TO c_ytd.
  ELSEIF 9 <= i_to.
    ADD ps_flex-hsl09 TO c_per.
    ADD ps_flex-hsl09 TO c_ytd.
  ENDIF.

  IF i_from > 10.
    ADD ps_flex-hsl10 TO c_open.
    ADD ps_flex-hsl10 TO c_ytd.
  ELSEIF 10 <= i_to.
    ADD ps_flex-hsl10 TO c_per.
    ADD ps_flex-hsl10 TO c_ytd.
  ENDIF.

  IF i_from > 11.
    ADD ps_flex-hsl11 TO c_open.
    ADD ps_flex-hsl11 TO c_ytd.
  ELSEIF 11 <= i_to.
    ADD ps_flex-hsl11 TO c_per.
    ADD ps_flex-hsl11 TO c_ytd.
  ENDIF.

  IF i_from > 12.
    ADD ps_flex-hsl12 TO c_open.
    ADD ps_flex-hsl12 TO c_ytd.
  ELSEIF 12 <= i_to.
    ADD ps_flex-hsl12 TO c_per.
    ADD ps_flex-hsl12 TO c_ytd.
  ENDIF.

  IF i_from > 13.
    ADD ps_flex-hsl13 TO c_open.
    ADD ps_flex-hsl13 TO c_ytd.
  ELSEIF 13 <= i_to.
    ADD ps_flex-hsl13 TO c_per.
    ADD ps_flex-hsl13 TO c_ytd.
  ENDIF.

  IF i_from > 14.
    ADD ps_flex-hsl14 TO c_open.
    ADD ps_flex-hsl14 TO c_ytd.
  ELSEIF 14 <= i_to.
    ADD ps_flex-hsl14 TO c_per.
    ADD ps_flex-hsl14 TO c_ytd.
  ENDIF.

  IF i_from > 15.
    ADD ps_flex-hsl15 TO c_open.
    ADD ps_flex-hsl15 TO c_ytd.
  ELSEIF 15 <= i_to.
    ADD ps_flex-hsl15 TO c_per.
    ADD ps_flex-hsl15 TO c_ytd.
  ENDIF.

  IF i_from > 16.
    ADD ps_flex-hsl16 TO c_open.
    ADD ps_flex-hsl16 TO c_ytd.
  ELSEIF 16 <= i_to.
    ADD ps_flex-hsl16 TO c_per.
    ADD ps_flex-hsl16 TO c_ytd.
  ENDIF.

ENDFORM.

*&---------------------------------------------------------------------*
*&      Form  CALC_AMOUNTS_TSL
*&---------------------------------------------------------------------*
*       显式字段求和（TSL 外币版）
*&---------------------------------------------------------------------*
FORM calc_amounts_tsl USING ps_flex TYPE ty_flex
                             i_from TYPE i
                             i_to   TYPE i
                    CHANGING c_open  TYPE hslvt12
                             c_per   TYPE hslvt12
                             c_ytd   TYPE hslvt12.

  c_open = ps_flex-tslvt.
  CLEAR: c_per, c_ytd.

  IF i_from > 1.
    ADD ps_flex-tsl01 TO c_open.
    ADD ps_flex-tsl01 TO c_ytd.
  ELSEIF 1 <= i_to.
    ADD ps_flex-tsl01 TO c_per.
    ADD ps_flex-tsl01 TO c_ytd.
  ENDIF.

  IF i_from > 2.
    ADD ps_flex-tsl02 TO c_open.
    ADD ps_flex-tsl02 TO c_ytd.
  ELSEIF 2 <= i_to.
    ADD ps_flex-tsl02 TO c_per.
    ADD ps_flex-tsl02 TO c_ytd.
  ENDIF.

  IF i_from > 3.
    ADD ps_flex-tsl03 TO c_open.
    ADD ps_flex-tsl03 TO c_ytd.
  ELSEIF 3 <= i_to.
    ADD ps_flex-tsl03 TO c_per.
    ADD ps_flex-tsl03 TO c_ytd.
  ENDIF.

  IF i_from > 4.
    ADD ps_flex-tsl04 TO c_open.
    ADD ps_flex-tsl04 TO c_ytd.
  ELSEIF 4 <= i_to.
    ADD ps_flex-tsl04 TO c_per.
    ADD ps_flex-tsl04 TO c_ytd.
  ENDIF.

  IF i_from > 5.
    ADD ps_flex-tsl05 TO c_open.
    ADD ps_flex-tsl05 TO c_ytd.
  ELSEIF 5 <= i_to.
    ADD ps_flex-tsl05 TO c_per.
    ADD ps_flex-tsl05 TO c_ytd.
  ENDIF.

  IF i_from > 6.
    ADD ps_flex-tsl06 TO c_open.
    ADD ps_flex-tsl06 TO c_ytd.
  ELSEIF 6 <= i_to.
    ADD ps_flex-tsl06 TO c_per.
    ADD ps_flex-tsl06 TO c_ytd.
  ENDIF.

  IF i_from > 7.
    ADD ps_flex-tsl07 TO c_open.
    ADD ps_flex-tsl07 TO c_ytd.
  ELSEIF 7 <= i_to.
    ADD ps_flex-tsl07 TO c_per.
    ADD ps_flex-tsl07 TO c_ytd.
  ENDIF.

  IF i_from > 8.
    ADD ps_flex-tsl08 TO c_open.
    ADD ps_flex-tsl08 TO c_ytd.
  ELSEIF 8 <= i_to.
    ADD ps_flex-tsl08 TO c_per.
    ADD ps_flex-tsl08 TO c_ytd.
  ENDIF.

  IF i_from > 9.
    ADD ps_flex-tsl09 TO c_open.
    ADD ps_flex-tsl09 TO c_ytd.
  ELSEIF 9 <= i_to.
    ADD ps_flex-tsl09 TO c_per.
    ADD ps_flex-tsl09 TO c_ytd.
  ENDIF.

  IF i_from > 10.
    ADD ps_flex-tsl10 TO c_open.
    ADD ps_flex-tsl10 TO c_ytd.
  ELSEIF 10 <= i_to.
    ADD ps_flex-tsl10 TO c_per.
    ADD ps_flex-tsl10 TO c_ytd.
  ENDIF.

  IF i_from > 11.
    ADD ps_flex-tsl11 TO c_open.
    ADD ps_flex-tsl11 TO c_ytd.
  ELSEIF 11 <= i_to.
    ADD ps_flex-tsl11 TO c_per.
    ADD ps_flex-tsl11 TO c_ytd.
  ENDIF.

  IF i_from > 12.
    ADD ps_flex-tsl12 TO c_open.
    ADD ps_flex-tsl12 TO c_ytd.
  ELSEIF 12 <= i_to.
    ADD ps_flex-tsl12 TO c_per.
    ADD ps_flex-tsl12 TO c_ytd.
  ENDIF.

  IF i_from > 13.
    ADD ps_flex-tsl13 TO c_open.
    ADD ps_flex-tsl13 TO c_ytd.
  ELSEIF 13 <= i_to.
    ADD ps_flex-tsl13 TO c_per.
    ADD ps_flex-tsl13 TO c_ytd.
  ENDIF.

  IF i_from > 14.
    ADD ps_flex-tsl14 TO c_open.
    ADD ps_flex-tsl14 TO c_ytd.
  ELSEIF 14 <= i_to.
    ADD ps_flex-tsl14 TO c_per.
    ADD ps_flex-tsl14 TO c_ytd.
  ENDIF.

  IF i_from > 15.
    ADD ps_flex-tsl15 TO c_open.
    ADD ps_flex-tsl15 TO c_ytd.
  ELSEIF 15 <= i_to.
    ADD ps_flex-tsl15 TO c_per.
    ADD ps_flex-tsl15 TO c_ytd.
  ENDIF.

  IF i_from > 16.
    ADD ps_flex-tsl16 TO c_open.
    ADD ps_flex-tsl16 TO c_ytd.
  ELSEIF 16 <= i_to.
    ADD ps_flex-tsl16 TO c_per.
    ADD ps_flex-tsl16 TO c_ytd.
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
          t_table      = gt_out ).
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

  " 固定列
  PERFORM set_column USING '' lr_cols 'ZYJK'    '一级节点' ''.
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

  " 外币列
  IF p_fcur = 'X'.
    PERFORM set_column USING '' lr_cols 'RTCUR'   '外币币别' ''.
    PERFORM set_column USING '' lr_cols 'ZQCJF1'  '期初余额借方(外币)' ''.
    PERFORM set_column USING '' lr_cols 'ZQCDF1'  '期初余额贷方(外币)' ''.
    PERFORM set_column USING '' lr_cols 'ZBQJF1'  '本期发生借方(外币)' ''.
    PERFORM set_column USING '' lr_cols 'ZBQDF1'  '本期发生贷方(外币)' ''.
    PERFORM set_column USING '' lr_cols 'ZBNJF1'  '本年累计借方(外币)' ''.
    PERFORM set_column USING '' lr_cols 'ZBNDF1'  '本年累计贷方(外币)' ''.
    PERFORM set_column USING '' lr_cols 'ZQMJF1'  '期末余额借方(外币)' ''.
    PERFORM set_column USING '' lr_cols 'ZQMDF1'  '期末余额贷方(外币)' ''.
  ELSE.
    PERFORM set_column USING '' lr_cols 'RTCUR'   '外币币别' 'X'.
    PERFORM set_column USING '' lr_cols 'ZQCJF1'  '期初余额借方(外币)' 'X'.
    PERFORM set_column USING '' lr_cols 'ZQCDF1'  '期初余额贷方(外币)' 'X'.
    PERFORM set_column USING '' lr_cols 'ZBQJF1'  '本期发生借方(外币)' 'X'.
    PERFORM set_column USING '' lr_cols 'ZBQDF1'  '本期发生贷方(外币)' 'X'.
    PERFORM set_column USING '' lr_cols 'ZBNJF1'  '本年累计借方(外币)' 'X'.
    PERFORM set_column USING '' lr_cols 'ZBNDF1'  '本年累计贷方(外币)' 'X'.
    PERFORM set_column USING '' lr_cols 'ZQMJF1'  '期末余额借方(外币)' 'X'.
    PERFORM set_column USING '' lr_cols 'ZQMDF1'  '期末余额贷方(外币)' 'X'.
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
      READ TABLE gt_out INTO gs_out INDEX p_row.
      CHECK sy-subrc = 0.

      SET PARAMETER ID 'SAK' FIELD gs_out-racct.
      SET PARAMETER ID 'BUK' FIELD p_bukrs.

      CALL TRANSACTION 'FS10N' AND SKIP FIRST SCREEN.

    WHEN OTHERS.
  ENDCASE.

ENDFORM.
