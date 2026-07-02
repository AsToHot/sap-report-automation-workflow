*&---------------------------------------------------------------------*
*& Report ZTEST102
*& 报税取数稽核报表（EE090）
*&---------------------------------------------------------------------*
REPORT ztest102.

*======================================================================*
* 数据类型、全局变量、常量定义
*======================================================================*

TYPES: BEGIN OF ty_bukrs_map,
         bukrs  LIKE zsap_bukrs-bukrs,
         zfgs   LIKE zsap_bukrs-zfgs,
         zzgs   LIKE zsap_bukrs-zzgs,
         prctr  LIKE zsap_bukrs-prctr,
         ltext  LIKE zsap_bukrs-ltext,
         rbukrs LIKE zsap_bukrs-bukrs,
       END OF ty_bukrs_map.

TYPES: BEGIN OF ty_gl_raw,
         rbukrs LIKE faglflext-rbukrs,
         racct  LIKE faglflext-racct,
         prctr  LIKE faglflext-prctr,
         drcrk  LIKE faglflext-drcrk,
         hsl01  LIKE faglflext-hsl01,
         hsl02  LIKE faglflext-hsl02,
         hsl03  LIKE faglflext-hsl03,
         hsl04  LIKE faglflext-hsl04,
         hsl05  LIKE faglflext-hsl05,
         hsl06  LIKE faglflext-hsl06,
         hsl07  LIKE faglflext-hsl07,
         hsl08  LIKE faglflext-hsl08,
         hsl09  LIKE faglflext-hsl09,
         hsl10  LIKE faglflext-hsl10,
         hsl11  LIKE faglflext-hsl11,
         hsl12  LIKE faglflext-hsl12,
         hsl13  LIKE faglflext-hsl13,
         hsl14  LIKE faglflext-hsl14,
         hsl15  LIKE faglflext-hsl15,
         hsl16  LIKE faglflext-hsl16,
       END OF ty_gl_raw.

TYPES: BEGIN OF ty_gl_agg,
         rbukrs  LIKE faglflext-rbukrs,
         racct   LIKE faglflext-racct,
         hsl_sum LIKE faglflext-hsl01,
       END OF ty_gl_agg.

TYPES: BEGIN OF ty_fi054_raw,
         ourbankaccountnumber LIKE zsap_fi054-ourbankaccountnumber,
         hkont_fy             LIKE zsap_fi054-hkont_fy,
         amount               LIKE zsap_fi054-amount,
       END OF ty_fi054_raw.

TYPES: BEGIN OF ty_fi054_agg,
         bukrs    LIKE zsap_bukrs-bukrs,
         hkont_fy LIKE zsap_fi054-hkont_fy,
         amount   LIKE zsap_fi054-amount,
       END OF ty_fi054_agg.

TYPES: BEGIN OF ty_ska1_map,
         zbukrs LIKE ska1-zbukrs,
         zfkyh  LIKE ska1-zfkyh,
       END OF ty_ska1_map.

TYPES: BEGIN OF ty_out,
         bukrs LIKE zsap_bukrs-bukrs,
         ltext LIKE zsap_bukrs-ltext,
         zyjzz LIKE faglflext-hsl01,
         zzzsb LIKE faglflext-hsl01,
         zzzjy LIKE faglflext-hsl01,
         zycj  LIKE faglflext-hsl01,
         zcjsb LIKE faglflext-hsl01,
         zcjjy LIKE faglflext-hsl01,
         zyjy  LIKE faglflext-hsl01,
         zjysb LIKE faglflext-hsl01,
         zjyjy LIKE faglflext-hsl01,
         zyjdf LIKE faglflext-hsl01,
         zdfsb LIKE faglflext-hsl01,
         zdfjy LIKE faglflext-hsl01,
         zyjyh LIKE faglflext-hsl01,
         zyhsb LIKE faglflext-hsl01,
         zyhjy LIKE faglflext-hsl01,
         zyjqy LIKE faglflext-hsl01,
         zqysb LIKE faglflext-hsl01,
         zqyjy LIKE faglflext-hsl01,
       END OF ty_out.

TYPES: ty_bukrs_map_t TYPE STANDARD TABLE OF ty_bukrs_map.
TYPES: ty_gl_raw_t   TYPE STANDARD TABLE OF ty_gl_raw.
TYPES: ty_gl_agg_t   TYPE SORTED TABLE OF ty_gl_agg WITH UNIQUE KEY rbukrs racct.
TYPES: ty_fi054_raw_t TYPE STANDARD TABLE OF ty_fi054_raw.
TYPES: ty_fi054_agg_t TYPE SORTED TABLE OF ty_fi054_agg WITH UNIQUE KEY bukrs hkont_fy.
TYPES: ty_ska1_map_t  TYPE SORTED TABLE OF ty_ska1_map WITH NON-UNIQUE KEY zfkyh.
TYPES: ty_out_t       TYPE STANDARD TABLE OF ty_out.

CONSTANTS: BEGIN OF gc_fi,
             zzs  LIKE faglflext-racct VALUE '2221100000',
             cjs  LIKE faglflext-racct VALUE '2221020000',
             jyf  LIKE faglflext-racct VALUE '2221030000',
             dfjy LIKE faglflext-racct VALUE '2221040000',
             yhs  LIKE faglflext-racct VALUE '2221070000',
             qys  LIKE faglflext-racct VALUE '2221060000',
           END OF gc_fi.

CONSTANTS: BEGIN OF gc_fi054,
             zzs  LIKE zsap_fi054-hkont_fy VALUE '221100000',
             cjs  LIKE zsap_fi054-hkont_fy VALUE '2221020000',
             jyf  LIKE zsap_fi054-hkont_fy VALUE '2221030000',
             dfjy LIKE zsap_fi054-hkont_fy VALUE '2221040000',
             yhs  LIKE zsap_fi054-hkont_fy VALUE '2221070000',
             qys  LIKE zsap_fi054-hkont_fy VALUE '2221060000',
           END OF gc_fi054.

CONSTANTS: gc_kokrs TYPE kokrs VALUE 'EEKA',
           gc_ktopl TYPE ktopl VALUE 'EEKA'.

DATA: gt_fi_acct_range    TYPE RANGE OF faglflext-racct,
      gt_fi054_acct_range TYPE RANGE OF zsap_fi054-hkont_fy.

DATA: gt_bukrs_map   TYPE ty_bukrs_map_t,
      gt_gl_raw      TYPE ty_gl_raw_t,
      gt_gl_agg      TYPE ty_gl_agg_t,
      gt_fi054_raw   TYPE ty_fi054_raw_t,
      gt_fi054_agg   TYPE ty_fi054_agg_t,
      gt_ska1        TYPE ty_ska1_map_t,
      gt_out         TYPE ty_out_t,
      gs_out         TYPE ty_out.

DATA: gv_period_from TYPE i,
      gv_period_to   TYPE i.

DATA: gv_date_from TYPE char10,
      gv_date_to   TYPE char10.

DATA: gv_bukrs_ref TYPE bukrs,
      gv_rpmax_ref TYPE rpmax.

DATA: go_alv TYPE REF TO cl_salv_table.

*======================================================================*
* 选择屏幕
*======================================================================*

SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME.
  SELECT-OPTIONS: s_bukrs FOR gv_bukrs_ref NO INTERVALS.
  PARAMETERS:     p_ryear TYPE gjahr OBLIGATORY.
  SELECT-OPTIONS: s_rpmax FOR gv_rpmax_ref DEFAULT '001' TO '016'.
SELECTION-SCREEN END OF BLOCK b1.

*======================================================================*
* INITIALIZATION
*======================================================================*
INITIALIZATION.
  p_ryear = sy-datum(4).

*======================================================================*
* AT SELECTION-SCREEN OUTPUT
*======================================================================*
AT SELECTION-SCREEN OUTPUT.
  %_s_bukrs_%_app_%-text = '公司代码'.
  %_p_ryear_%_app_%-text = '会计年度'.
  %_s_rpmax_%_app_%-text = '核对期间'.

*======================================================================*
* AT SELECTION-SCREEN
*======================================================================*
AT SELECTION-SCREEN.
  IF p_ryear IS INITIAL.
    MESSAGE '请输入会计年度' TYPE 'E'.
  ENDIF.
  IF s_bukrs[] IS INITIAL.
    MESSAGE '请选择至少一个公司代码' TYPE 'E'.
  ENDIF.

*======================================================================*
* START-OF-SELECTION
*======================================================================*
START-OF-SELECTION.
  PERFORM authority_check.
  PERFORM parse_periods.
  PERFORM get_bukrs_map.
  PERFORM get_gl_data.
  PERFORM get_fi054_data.
  PERFORM fill_output.
  PERFORM display_alv.

*======================================================================*
* FORM 子程序
*======================================================================*

*&---------------------------------------------------------------------*
*& Form authority_check
*&---------------------------------------------------------------------*
FORM authority_check.
  AUTHORITY-CHECK OBJECT 'F_BKPF_BUK'
    ID 'BUKRS' FIELD p_ryear
    ID 'ACTVT' FIELD '03'.
  IF sy-subrc <> 0.
    MESSAGE '缺少总账科目数据显示权限' TYPE 'E'.
  ENDIF.
ENDFORM.

*&---------------------------------------------------------------------*
*& Form get_bukrs_map
*&---------------------------------------------------------------------*
FORM get_bukrs_map.
  SELECT bukrs, zfgs, zzgs, prctr, ltext
    FROM zsap_bukrs
    INTO TABLE @gt_bukrs_map
    WHERE bukrs IN @s_bukrs.
  IF sy-subrc <> 0.
    MESSAGE '所选公司代码在ZSAP_BUKRS中无映射' TYPE 'S' DISPLAY LIKE 'W'.
    RETURN.
  ENDIF.

  FIELD-SYMBOLS <fs_map> TYPE ty_bukrs_map.
  LOOP AT gt_bukrs_map ASSIGNING <fs_map>.
    IF <fs_map>-zfgs = ''.
      <fs_map>-rbukrs = <fs_map>-bukrs.
    ELSE.
      <fs_map>-rbukrs = <fs_map>-zzgs.
    ENDIF.
  ENDLOOP.
ENDFORM.

*&---------------------------------------------------------------------*
*& Form get_gl_data
*&---------------------------------------------------------------------*
FORM get_gl_data.
  IF gt_bukrs_map IS INITIAL.
    RETURN.
  ENDIF.

  DATA: lt_rbukrs TYPE RANGE OF faglflext-rbukrs,
        ls_rbukrs LIKE LINE OF lt_rbukrs.
  FIELD-SYMBOLS <fs_map> TYPE ty_bukrs_map.
  LOOP AT gt_bukrs_map ASSIGNING <fs_map>.
    ls_rbukrs-sign   = 'I'.
    ls_rbukrs-option = 'EQ'.
    ls_rbukrs-low    = <fs_map>-rbukrs.
    APPEND ls_rbukrs TO lt_rbukrs.
  ENDLOOP.

  DATA: lt_prctr_list TYPE RANGE OF faglflext-prctr,
        ls_prctr      LIKE LINE OF lt_prctr_list.

  LOOP AT gt_bukrs_map ASSIGNING <fs_map> WHERE prctr IS NOT INITIAL.
    ls_prctr-sign   = 'I'.
    ls_prctr-option = 'EQ'.
    ls_prctr-low    = <fs_map>-prctr.
    APPEND ls_prctr TO lt_prctr_list.
  ENDLOOP.

  " 从 CEPC 获取有效利润中心 → RANGE 表
  DATA: lt_cepc_range TYPE RANGE OF faglflext-prctr,
        ls_cepc_range LIKE LINE OF lt_cepc_range.

  IF lt_prctr_list IS NOT INITIAL.
    SELECT prctr INTO TABLE @DATA(lt_cepc_raw)
      FROM cepc
      WHERE khinr IN @lt_prctr_list
        AND datbi = '99991231'
        AND kokrs = @gc_kokrs.
    LOOP AT lt_cepc_raw INTO DATA(ls_cepc_raw).
      ls_cepc_range-sign   = 'I'.
      ls_cepc_range-option = 'EQ'.
      ls_cepc_range-low    = ls_cepc_raw-prctr.
      APPEND ls_cepc_range TO lt_cepc_range.
    ENDLOOP.
  ENDIF.

  IF gt_fi_acct_range IS INITIAL.
    DATA: ls_acct_range LIKE LINE OF gt_fi_acct_range.
    ls_acct_range-sign   = 'I'.
    ls_acct_range-option = 'EQ'.

    ls_acct_range-low = gc_fi-zzs.  APPEND ls_acct_range TO gt_fi_acct_range.
    ls_acct_range-low = gc_fi-cjs.  APPEND ls_acct_range TO gt_fi_acct_range.
    ls_acct_range-low = gc_fi-jyf.  APPEND ls_acct_range TO gt_fi_acct_range.
    ls_acct_range-low = gc_fi-dfjy. APPEND ls_acct_range TO gt_fi_acct_range.
    ls_acct_range-low = gc_fi-yhs.  APPEND ls_acct_range TO gt_fi_acct_range.
    ls_acct_range-low = gc_fi-qys.  APPEND ls_acct_range TO gt_fi_acct_range.
  ENDIF.

  SELECT rbukrs, racct, prctr, drcrk,
         hsl01, hsl02, hsl03, hsl04, hsl05, hsl06,
         hsl07, hsl08, hsl09, hsl10, hsl11, hsl12,
         hsl13, hsl14, hsl15, hsl16
    INTO TABLE @gt_gl_raw
    FROM faglflext
    WHERE ryear  = @p_ryear
      AND rbukrs IN @lt_rbukrs
      AND racct  IN @gt_fi_acct_range
      AND prctr  IN @lt_cepc_range.
  IF sy-subrc <> 0.
    MESSAGE 'FAGLFLEXT 未找到数据' TYPE 'S' DISPLAY LIKE 'W'.
    RETURN.
  ENDIF.

  PERFORM aggregate_gl_data.

ENDFORM.

*&---------------------------------------------------------------------*
*& Form aggregate_gl_data
*&---------------------------------------------------------------------*
FORM aggregate_gl_data.
  FIELD-SYMBOLS <fs_gl>  TYPE ty_gl_raw.
  FIELD-SYMBOLS <fs_agg> TYPE ty_gl_agg.
  DATA: lv_hsl_sum LIKE faglflext-hsl01,
        lv_idx     TYPE i,
        lv_period  TYPE n LENGTH 2,
        lv_fname   TYPE string.

  FIELD-SYMBOLS <fs_hsl> TYPE any.

  LOOP AT gt_gl_raw ASSIGNING <fs_gl>.
    lv_hsl_sum = 0.
    lv_idx = gv_period_from.
    WHILE lv_idx <= gv_period_to.
      lv_period = lv_idx.
      CONCATENATE 'HSL' lv_period INTO lv_fname.
      ASSIGN COMPONENT lv_fname OF STRUCTURE <fs_gl> TO <fs_hsl>.
      IF sy-subrc = 0.
        lv_hsl_sum = lv_hsl_sum + <fs_hsl>.
      ENDIF.
      lv_idx = lv_idx + 1.
    ENDWHILE.

    READ TABLE gt_gl_agg ASSIGNING <fs_agg>
      WITH TABLE KEY rbukrs = <fs_gl>-rbukrs racct = <fs_gl>-racct.
    IF sy-subrc = 0.
      <fs_agg>-hsl_sum = <fs_agg>-hsl_sum + lv_hsl_sum.
    ELSE.
      DATA ls_gl_agg TYPE ty_gl_agg.
      ls_gl_agg-rbukrs  = <fs_gl>-rbukrs.
      ls_gl_agg-racct   = <fs_gl>-racct.
      ls_gl_agg-hsl_sum = lv_hsl_sum.
      INSERT ls_gl_agg INTO TABLE gt_gl_agg.
    ENDIF.
  ENDLOOP.
ENDFORM.

*&---------------------------------------------------------------------*
*& Form get_fi054_data
*&---------------------------------------------------------------------*
FORM get_fi054_data.
  SELECT zbukrs, zfkyh
    INTO TABLE @gt_ska1
    FROM ska1
    WHERE zbukrs IN @s_bukrs
      AND ktopl = @gc_ktopl
      AND zfkyh IS NOT NULL.
  IF sy-subrc <> 0.
    MESSAGE '未找到银行账户映射 (SKA1)' TYPE 'S' DISPLAY LIKE 'W'.
    RETURN.
  ENDIF.

  DATA: lt_zfkyh TYPE RANGE OF ska1-zfkyh,
        ls_zfkyh LIKE LINE OF lt_zfkyh.
  FIELD-SYMBOLS <fs_ska1> TYPE ty_ska1_map.
  LOOP AT gt_ska1 ASSIGNING <fs_ska1>.
    ls_zfkyh-sign   = 'I'.
    ls_zfkyh-option = 'EQ'.
    ls_zfkyh-low    = <fs_ska1>-zfkyh.
    APPEND ls_zfkyh TO lt_zfkyh.
  ENDLOOP.

  IF gt_fi054_acct_range IS INITIAL.
    DATA: ls_fi054_range LIKE LINE OF gt_fi054_acct_range.
    ls_fi054_range-sign   = 'I'.
    ls_fi054_range-option = 'EQ'.

    ls_fi054_range-low = gc_fi054-zzs.  APPEND ls_fi054_range TO gt_fi054_acct_range.
    ls_fi054_range-low = gc_fi054-cjs.  APPEND ls_fi054_range TO gt_fi054_acct_range.
    ls_fi054_range-low = gc_fi054-jyf.  APPEND ls_fi054_range TO gt_fi054_acct_range.
    ls_fi054_range-low = gc_fi054-dfjy. APPEND ls_fi054_range TO gt_fi054_acct_range.
    ls_fi054_range-low = gc_fi054-yhs.  APPEND ls_fi054_range TO gt_fi054_acct_range.
    ls_fi054_range-low = gc_fi054-qys.  APPEND ls_fi054_range TO gt_fi054_acct_range.
  ENDIF.

  SELECT ourbankaccountnumber, hkont_fy, SUM( amount ) AS amount
    INTO TABLE @gt_fi054_raw
    FROM zsap_fi054
    WHERE hkont_fy             IN @gt_fi054_acct_range
      AND tradedate            BETWEEN @gv_date_from AND @gv_date_to
      AND ourbankaccountnumber IN @lt_zfkyh
    GROUP BY ourbankaccountnumber, hkont_fy.
  IF sy-subrc <> 0.
    MESSAGE 'ZSAP_FI054 未找到申报数据' TYPE 'S' DISPLAY LIKE 'W'.
    RETURN.
  ENDIF.

  PERFORM aggregate_fi054_data.

ENDFORM.

*&---------------------------------------------------------------------*
*& Form aggregate_fi054_data
*&---------------------------------------------------------------------*
FORM aggregate_fi054_data.
  FIELD-SYMBOLS <fs_raw> TYPE ty_fi054_raw.
  FIELD-SYMBOLS <fs_ska1> TYPE ty_ska1_map.
  FIELD-SYMBOLS <fs_agg>  TYPE ty_fi054_agg.

  LOOP AT gt_fi054_raw ASSIGNING <fs_raw>.
    READ TABLE gt_ska1 ASSIGNING <fs_ska1>
      WITH KEY zfkyh = <fs_raw>-ourbankaccountnumber BINARY SEARCH.
    IF sy-subrc <> 0.
      CONTINUE.
    ENDIF.

    READ TABLE gt_fi054_agg ASSIGNING <fs_agg>
      WITH TABLE KEY bukrs = <fs_ska1>-zbukrs hkont_fy = <fs_raw>-hkont_fy.
    IF sy-subrc = 0.
      <fs_agg>-amount = <fs_agg>-amount + <fs_raw>-amount.
    ELSE.
      DATA ls_fi054_agg TYPE ty_fi054_agg.
      ls_fi054_agg-bukrs    = <fs_ska1>-zbukrs.
      ls_fi054_agg-hkont_fy = <fs_raw>-hkont_fy.
      ls_fi054_agg-amount   = <fs_raw>-amount.
      INSERT ls_fi054_agg INTO TABLE gt_fi054_agg.
    ENDIF.
  ENDLOOP.
ENDFORM.

*&---------------------------------------------------------------------*
*& Form fill_output
*&---------------------------------------------------------------------*
FORM fill_output.
  FIELD-SYMBOLS <fs_map>  TYPE ty_bukrs_map.
  FIELD-SYMBOLS <fs_gl>   TYPE ty_gl_agg.
  FIELD-SYMBOLS <fs_fi>   TYPE ty_fi054_agg.

  LOOP AT gt_bukrs_map ASSIGNING <fs_map>.
    CLEAR gs_out.
    gs_out-bukrs = <fs_map>-bukrs.
    gs_out-ltext = <fs_map>-ltext.

    " 增值税
    READ TABLE gt_gl_agg ASSIGNING <fs_gl>
      WITH TABLE KEY rbukrs = <fs_map>-rbukrs racct = gc_fi-zzs.
    IF sy-subrc = 0.
      gs_out-zyjzz = <fs_gl>-hsl_sum.
    ENDIF.
    READ TABLE gt_fi054_agg ASSIGNING <fs_fi>
      WITH TABLE KEY bukrs = <fs_map>-bukrs hkont_fy = gc_fi054-zzs.
    IF sy-subrc = 0.
      gs_out-zzzsb = <fs_fi>-amount.
    ENDIF.
    gs_out-zzzjy = gs_out-zyjzz - gs_out-zzzsb.

    " 城建税
    READ TABLE gt_gl_agg ASSIGNING <fs_gl>
      WITH TABLE KEY rbukrs = <fs_map>-rbukrs racct = gc_fi-cjs.
    IF sy-subrc = 0.
      gs_out-zycj = <fs_gl>-hsl_sum.
    ENDIF.
    READ TABLE gt_fi054_agg ASSIGNING <fs_fi>
      WITH TABLE KEY bukrs = <fs_map>-bukrs hkont_fy = gc_fi054-cjs.
    IF sy-subrc = 0.
      gs_out-zcjsb = <fs_fi>-amount.
    ENDIF.
    gs_out-zcjjy = gs_out-zycj - gs_out-zcjsb.

    " 教育费附加
    READ TABLE gt_gl_agg ASSIGNING <fs_gl>
      WITH TABLE KEY rbukrs = <fs_map>-rbukrs racct = gc_fi-jyf.
    IF sy-subrc = 0.
      gs_out-zyjy = <fs_gl>-hsl_sum.
    ENDIF.
    READ TABLE gt_fi054_agg ASSIGNING <fs_fi>
      WITH TABLE KEY bukrs = <fs_map>-bukrs hkont_fy = gc_fi054-jyf.
    IF sy-subrc = 0.
      gs_out-zjysb = <fs_fi>-amount.
    ENDIF.
    gs_out-zjyjy = gs_out-zyjy - gs_out-zjysb.

    " 地方教育费附加
    READ TABLE gt_gl_agg ASSIGNING <fs_gl>
      WITH TABLE KEY rbukrs = <fs_map>-rbukrs racct = gc_fi-dfjy.
    IF sy-subrc = 0.
      gs_out-zyjdf = <fs_gl>-hsl_sum.
    ENDIF.
    READ TABLE gt_fi054_agg ASSIGNING <fs_fi>
      WITH TABLE KEY bukrs = <fs_map>-bukrs hkont_fy = gc_fi054-dfjy.
    IF sy-subrc = 0.
      gs_out-zdfsb = <fs_fi>-amount.
    ENDIF.
    gs_out-zdfjy = gs_out-zyjdf - gs_out-zdfsb.

    " 印花税
    READ TABLE gt_gl_agg ASSIGNING <fs_gl>
      WITH TABLE KEY rbukrs = <fs_map>-rbukrs racct = gc_fi-yhs.
    IF sy-subrc = 0.
      gs_out-zyjyh = <fs_gl>-hsl_sum.
    ENDIF.
    READ TABLE gt_fi054_agg ASSIGNING <fs_fi>
      WITH TABLE KEY bukrs = <fs_map>-bukrs hkont_fy = gc_fi054-yhs.
    IF sy-subrc = 0.
      gs_out-zyhsb = <fs_fi>-amount.
    ENDIF.
    gs_out-zyhjy = gs_out-zyjyh - gs_out-zyhsb.

    " 企业所得税
    READ TABLE gt_gl_agg ASSIGNING <fs_gl>
      WITH TABLE KEY rbukrs = <fs_map>-rbukrs racct = gc_fi-qys.
    IF sy-subrc = 0.
      gs_out-zyjqy = <fs_gl>-hsl_sum.
    ENDIF.
    READ TABLE gt_fi054_agg ASSIGNING <fs_fi>
      WITH TABLE KEY bukrs = <fs_map>-bukrs hkont_fy = gc_fi054-qys.
    IF sy-subrc = 0.
      gs_out-zqysb = <fs_fi>-amount.
    ENDIF.
    gs_out-zqyjy = gs_out-zyjqy - gs_out-zqysb.

    APPEND gs_out TO gt_out.
  ENDLOOP.

  IF gt_out IS INITIAL.
    MESSAGE '无数据输出' TYPE 'S' DISPLAY LIKE 'W'.
  ENDIF.
ENDFORM.

*&---------------------------------------------------------------------*
*& Form display_alv
*&---------------------------------------------------------------------*
FORM display_alv.
  IF gt_out IS INITIAL.
    MESSAGE '无输出数据' TYPE 'S'.
    RETURN.
  ENDIF.

  TRY.
      cl_salv_table=>factory(
        IMPORTING r_salv_table = go_alv
        CHANGING  t_table      = gt_out ).
    CATCH cx_salv_msg INTO DATA(lx_msg).
      MESSAGE lx_msg TYPE 'E'.
  ENDTRY.

  go_alv->get_columns( )->set_optimize( abap_true ).
  go_alv->get_display_settings( )->set_striped_pattern( cl_salv_display_settings=>true ).
  go_alv->get_display_settings( )->set_list_header( '报税取数稽核报表' ).

  DATA lo_cols TYPE REF TO cl_salv_columns.
  lo_cols = go_alv->get_columns( ).

  TRY.
      CAST cl_salv_column_table( lo_cols->get_column( 'BUKRS' ) )->set_short_text( '公司代码' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'BUKRS' ) )->set_medium_text( '公司代码' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'LTEXT' ) )->set_short_text( '机构名称' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'LTEXT' ) )->set_medium_text( '机构名称' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'ZYJZZ' ) )->set_short_text( '应交增值税' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'ZZZSB' ) )->set_short_text( '申报增值税' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'ZZZJY' ) )->set_short_text( '增值税校验' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'ZYCJ' ) )->set_short_text( '应交城建税' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'ZCJSB' ) )->set_short_text( '申报城建税' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'ZCJJY' ) )->set_short_text( '城建税校验' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'ZYJY' ) )->set_short_text( '应交教育费' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'ZJYSB' ) )->set_short_text( '申报教育费' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'ZJYJY' ) )->set_short_text( '教育费校验' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'ZYJDF' ) )->set_short_text( '应交地方教育' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'ZDFSB' ) )->set_short_text( '申报地方教育' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'ZDFJY' ) )->set_short_text( '地方教育校验' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'ZYJYH' ) )->set_short_text( '印花税' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'ZYHSB' ) )->set_short_text( '申报印花税' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'ZYHJY' ) )->set_short_text( '印花税校验' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'ZYJQY' ) )->set_short_text( '企业所得税' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'ZQYSB' ) )->set_short_text( '申报所得税' ).
      CAST cl_salv_column_table( lo_cols->get_column( 'ZQYJY' ) )->set_short_text( '所得税校验' ).
    CATCH cx_salv_not_found.
  ENDTRY.

  go_alv->display( ).
ENDFORM.

*&---------------------------------------------------------------------*
*& Form parse_periods
*&---------------------------------------------------------------------*
FORM parse_periods.
  DATA: ls_rpmax LIKE LINE OF s_rpmax.
  READ TABLE s_rpmax INTO ls_rpmax INDEX 1.
  IF sy-subrc <> 0.
    gv_period_from = 1.
    gv_period_to   = 16.
  ELSE.
    gv_period_from = ls_rpmax-low.
    gv_period_to   = ls_rpmax-high.
  ENDIF.

  IF gv_period_from < 1.  gv_period_from = 1.  ENDIF.
  IF gv_period_to   > 16. gv_period_to   = 16. ENDIF.
  IF gv_period_to   < gv_period_from.
    gv_period_to = gv_period_from.
  ENDIF.

  DATA: lv_year_str   TYPE char4,
        lv_from_month TYPE n LENGTH 2,
        lv_to_month   TYPE n LENGTH 2,
        lv_last_day   TYPE char2.

  lv_year_str   = p_ryear.
  lv_from_month = gv_period_from.
  lv_to_month   = gv_period_to.

  CONCATENATE lv_year_str lv_from_month '01' INTO gv_date_from.

  CASE lv_to_month.
    WHEN '01' OR '03' OR '05' OR '07' OR '08' OR '10' OR '12'.
      lv_last_day = '31'.
    WHEN '04' OR '06' OR '09' OR '11'.
      lv_last_day = '30'.
    WHEN '02'.
      lv_last_day = '28'.
    WHEN OTHERS.
      lv_last_day = '31'.
  ENDCASE.
  CONCATENATE lv_year_str lv_to_month lv_last_day INTO gv_date_to.

ENDFORM.
