*&---------------------------------------------------------------------*
*& Include ZSAP_FI086AF01 — Form Include: 取数、计算、ALV展示
*& 程序: ZSAP_FI086A 科目余额表
*&---------------------------------------------------------------------*

*&---------------------------------------------------------------------*
*& Form get_data — 读取主数据
*&---------------------------------------------------------------------*
FORM get_data.
  DATA: lt_prctr TYPE RANGE OF prctr,
        ls_prctr LIKE LINE OF lt_prctr,
        lv_bukrs TYPE bukrs,
        lv_ryear TYPE gjahr.

  " 取选择屏单值
  READ TABLE s_bukrs INDEX 1 ASSIGNING FIELD-SYMBOL(<fs_bukrs>).
  IF sy-subrc = 0.
    lv_bukrs = <fs_bukrs>-low.
  ENDIF.
  READ TABLE s_ryear INDEX 1 ASSIGNING FIELD-SYMBOL(<fs_ryear>).
  IF sy-subrc = 0.
    lv_ryear = <fs_ryear>-low.
  ENDIF.

  " 读取 ZSAP_BUKRS
  SELECT SINGLE * FROM zsap_bukrs
    INTO gs_zsap_bukrs
    WHERE bukrs = lv_bukrs.

  IF sy-subrc <> 0.
    MESSAGE '公司代码在 ZSAP_BUKRS 中不存在' TYPE 'E'.
  ENDIF.

  " 读取 FAGLFLEXT
  IF gs_zsap_bukrs-zfgs IS INITIAL.
    " 简单模式：直接按 RBUKRS 筛选
    SELECT * FROM faglflext
      INTO TABLE gt_raw
      WHERE rbukrs = lv_bukrs
        AND ryear  = lv_ryear
        AND rpmax IN s_rpmax
        AND racct IN s_racct
      ORDER BY racct drck.
  ELSE.
    " 复杂模式：先读 CEPC，再按 PRCTR 筛选
    SELECT prctr FROM cepc
      INTO TABLE @DATA(lt_cepc_prctr)
      WHERE khinr = @gs_zsap_bukrs-prctr
        AND datbi = @gc_datbi
        AND kokrs = @gc_kokrs.
    LOOP AT lt_cepc_prctr INTO DATA(lv_cepc_prctr).
      ls_prctr-sign   = 'I'.
      ls_prctr-option = 'EQ'.
      ls_prctr-low    = lv_cepc_prctr.
      APPEND ls_prctr TO lt_prctr.
    ENDLOOP.

    SELECT * FROM faglflext
      INTO TABLE gt_raw
      WHERE prctr IN lt_prctr
        AND ryear  = lv_ryear
        AND rpmax IN s_rpmax
        AND racct IN s_racct
      ORDER BY racct drck.
  ENDIF.

  IF gt_raw IS INITIAL.
    MESSAGE '未查询到数据' TYPE 'S' DISPLAY LIKE 'W'.
    RETURN.
  ENDIF.

  " 预读 SKAT（科目描述）
  SELECT * FROM skat
    INTO TABLE gt_skat
    WHERE ktopl = gc_ktopl
      AND spras = gc_spras
      AND saknr IN ( SELECT DISTINCT racct FROM @gt_raw AS a ).

  " 预读 SKA1（辅助维度）
  SELECT * FROM ska1
    INTO TABLE gt_ska1
    WHERE ktopl = gc_ktopl
      AND saknr IN ( SELECT DISTINCT racct FROM @gt_raw AS a ).

  " 预读 TFKBT（功能范围文本）
  SELECT * FROM tfkbt
    INTO TABLE gt_tfkbt
    WHERE spras = gc_spras.
ENDFORM.

*&---------------------------------------------------------------------*
*& Form process_data — 计算金额并构建输出内表
*&---------------------------------------------------------------------*
FORM process_data.
  DATA: lv_qc_jf   TYPE hslvt12,
        lv_qc_df   TYPE hslvt12,
        lv_bq_jf   TYPE hslvt12,
        lv_bq_df   TYPE hslvt12,
        lv_bn_jf   TYPE hslvt12,
        lv_bn_df   TYPE hslvt12,
        lv_qm_jf   TYPE hslvt12,
        lv_qm_df   TYPE hslvt12,
        lv_qc_jf1  TYPE tslvt12,
        lv_qc_df1  TYPE tslvt12,
        lv_bq_jf1  TYPE tslvt12,
        lv_bq_df1  TYPE tslvt12,
        lv_bn_jf1  TYPE tslvt12,
        lv_bn_df1  TYPE tslvt12,
        lv_qm_jf1  TYPE tslvt12,
        lv_qm_df1  TYPE tslvt12,
        lv_idx     TYPE i,
        lv_from    TYPE rpmax,
        lv_to      TYPE rpmax,
        lt_sorted  TYPE TABLE OF faglflext.

  " 确定期间范围
  READ TABLE s_rpmax INDEX 1 ASSIGNING FIELD-SYMBOL(<fs_rpmax>).
  IF sy-subrc = 0.
    lv_from = <fs_rpmax>-low.
    lv_to   = <fs_rpmax>-high.
    IF lv_to IS INITIAL.
      lv_to = lv_from.
    ENDIF.
  ELSE.
    " 未选择期间，默认全年度
    lv_from = '001'.
    lv_to   = '016'.
  ENDIF.

  " 按 RACCT 分组处理（先排序）
  lt_sorted = gt_raw.
  SORT lt_sorted BY racct drck.

  DATA(lv_prev_racct) = ''.
  CLEAR: lv_qc_jf, lv_qc_df, lv_bq_jf, lv_bq_df,
         lv_bn_jf, lv_bn_df, lv_qm_jf, lv_qm_df,
         lv_qc_jf1, lv_qc_df1, lv_bq_jf1, lv_bq_df1,
         lv_bn_jf1, lv_bn_df1, lv_qm_jf1, lv_qm_df1.

  LOOP AT lt_sorted INTO gs_raw.
    IF gs_raw-racct <> lv_prev_racct AND lv_prev_racct IS NOT INITIAL.
      " 新科目，先写旧科目结果
      PERFORM append_output USING lv_prev_racct
                                    lv_qc_jf lv_qc_df
                                    lv_bq_jf lv_bq_df
                                    lv_bn_jf lv_bn_df
                                    lv_qm_jf lv_qm_df
                                    lv_qc_jf1 lv_qc_df1
                                    lv_bq_jf1 lv_bq_df1
                                    lv_bn_jf1 lv_bn_df1
                                    lv_qm_jf1 lv_qm_df1.
      CLEAR: lv_qc_jf, lv_qc_df, lv_bq_jf, lv_bq_df,
             lv_bn_jf, lv_bn_df, lv_qm_jf, lv_qm_df,
             lv_qc_jf1, lv_qc_df1, lv_bq_jf1, lv_bq_df1,
             lv_bn_jf1, lv_bn_df1, lv_qm_jf1, lv_qm_df1.
    ENDIF.
    lv_prev_racct = gs_raw-racct.

    " --- 期初余额（HSL） ---
    IF gs_raw-drck = gc_drck_s.
      lv_qc_jf = lv_qc_jf + gs_raw-hslvt.
      lv_idx = 1.
      WHILE lv_idx < lv_from.
        PERFORM get_hsl_field USING lv_idx CHANGING lv_qc_jf.
        lv_idx = lv_idx + 1.
      ENDWHILE.
    ELSEIF gs_raw-drck = gc_drck_h.
      lv_qc_df = lv_qc_df + gs_raw-hslvt.
      lv_idx = 1.
      WHILE lv_idx < lv_from.
        PERFORM get_hsl_field USING lv_idx CHANGING lv_qc_df.
        lv_idx = lv_idx + 1.
      ENDWHILE.
    ENDIF.

    " --- 本期发生（HSL） ---
    lv_idx = lv_from.
    WHILE lv_idx <= lv_to.
      IF gs_raw-drck = gc_drck_s.
        PERFORM get_hsl_field USING lv_idx CHANGING lv_bq_jf.
      ELSEIF gs_raw-drck = gc_drck_h.
        PERFORM get_hsl_field USING lv_idx CHANGING lv_bq_df.
      ENDIF.
      lv_idx = lv_idx + 1.
    ENDWHILE.

    " --- 本年累计（HSL） ---
    lv_idx = 1.
    WHILE lv_idx <= lv_to.
      IF gs_raw-drck = gc_drck_s.
        PERFORM get_hsl_field USING lv_idx CHANGING lv_bn_jf.
      ELSEIF gs_raw-drck = gc_drck_h.
        PERFORM get_hsl_field USING lv_idx CHANGING lv_bn_df.
      ENDIF.
      lv_idx = lv_idx + 1.
    ENDWHILE.

    " --- 外币处理（TSL） ---
    IF p_waers = abap_true.
      " 期初
      IF gs_raw-drck = gc_drck_s.
        lv_qc_jf1 = lv_qc_jf1 + gs_raw-tslvt.
        lv_idx = 1.
        WHILE lv_idx < lv_from.
          PERFORM get_tsl_field USING lv_idx CHANGING lv_qc_jf1.
          lv_idx = lv_idx + 1.
        ENDWHILE.
      ELSEIF gs_raw-drck = gc_drck_h.
        lv_qc_df1 = lv_qc_df1 + gs_raw-tslvt.
        lv_idx = 1.
        WHILE lv_idx < lv_from.
          PERFORM get_tsl_field USING lv_idx CHANGING lv_qc_df1.
          lv_idx = lv_idx + 1.
        ENDWHILE.
      ENDIF.

      " 本期发生
      lv_idx = lv_from.
      WHILE lv_idx <= lv_to.
        IF gs_raw-drck = gc_drck_s.
          PERFORM get_tsl_field USING lv_idx CHANGING lv_bq_jf1.
        ELSEIF gs_raw-drck = gc_drck_h.
          PERFORM get_tsl_field USING lv_idx CHANGING lv_bq_df1.
        ENDIF.
        lv_idx = lv_idx + 1.
      ENDWHILE.

      " 本年累计
      lv_idx = 1.
      WHILE lv_idx <= lv_to.
        IF gs_raw-drck = gc_drck_s.
          PERFORM get_tsl_field USING lv_idx CHANGING lv_bn_jf1.
        ELSEIF gs_raw-drck = gc_drck_h.
          PERFORM get_tsl_field USING lv_idx CHANGING lv_bn_df1.
        ENDIF.
        lv_idx = lv_idx + 1.
      ENDWHILE.
    ENDIF.
  ENDLOOP.

  " 写入最后一个科目
  IF lv_prev_racct IS NOT INITIAL.
    PERFORM append_output USING lv_prev_racct
                                  lv_qc_jf lv_qc_df
                                  lv_bq_jf lv_bq_df
                                  lv_bn_jf lv_bn_df
                                  lv_qm_jf lv_qm_df
                                  lv_qc_jf1 lv_qc_df1
                                  lv_bq_jf1 lv_bq_df1
                                  lv_bn_jf1 lv_bn_df1
                                  lv_qm_jf1 lv_qm_df1.
  ENDIF.
ENDFORM.

*&---------------------------------------------------------------------*
*& Form get_hsl_field — 动态获取 HSLxx 字段值
*&---------------------------------------------------------------------*
FORM get_hsl_field USING    iv_idx TYPE i
                     CHANGING cv_val TYPE hslvt12.
  CASE iv_idx.
    WHEN 1.  cv_val = cv_val + gs_raw-hsl01.
    WHEN 2.  cv_val = cv_val + gs_raw-hsl02.
    WHEN 3.  cv_val = cv_val + gs_raw-hsl03.
    WHEN 4.  cv_val = cv_val + gs_raw-hsl04.
    WHEN 5.  cv_val = cv_val + gs_raw-hsl05.
    WHEN 6.  cv_val = cv_val + gs_raw-hsl06.
    WHEN 7.  cv_val = cv_val + gs_raw-hsl07.
    WHEN 8.  cv_val = cv_val + gs_raw-hsl08.
    WHEN 9.  cv_val = cv_val + gs_raw-hsl09.
    WHEN 10. cv_val = cv_val + gs_raw-hsl10.
    WHEN 11. cv_val = cv_val + gs_raw-hsl11.
    WHEN 12. cv_val = cv_val + gs_raw-hsl12.
    WHEN 13. cv_val = cv_val + gs_raw-hsl13.
    WHEN 14. cv_val = cv_val + gs_raw-hsl14.
    WHEN 15. cv_val = cv_val + gs_raw-hsl15.
    WHEN 16. cv_val = cv_val + gs_raw-hsl16.
  ENDCASE.
ENDFORM.

*&---------------------------------------------------------------------*
*& Form get_tsl_field — 动态获取 TSLxx 字段值
*&---------------------------------------------------------------------*
FORM get_tsl_field USING    iv_idx TYPE i
                     CHANGING cv_val TYPE tslvt12.
  CASE iv_idx.
    WHEN 1.  cv_val = cv_val + gs_raw-tsl01.
    WHEN 2.  cv_val = cv_val + gs_raw-tsl02.
    WHEN 3.  cv_val = cv_val + gs_raw-tsl03.
    WHEN 4.  cv_val = cv_val + gs_raw-tsl04.
    WHEN 5.  cv_val = cv_val + gs_raw-tsl05.
    WHEN 6.  cv_val = cv_val + gs_raw-tsl06.
    WHEN 7.  cv_val = cv_val + gs_raw-tsl07.
    WHEN 8.  cv_val = cv_val + gs_raw-tsl08.
    WHEN 9.  cv_val = cv_val + gs_raw-tsl09.
    WHEN 10. cv_val = cv_val + gs_raw-tsl10.
    WHEN 11. cv_val = cv_val + gs_raw-tsl11.
    WHEN 12. cv_val = cv_val + gs_raw-tsl12.
    WHEN 13. cv_val = cv_val + gs_raw-tsl13.
    WHEN 14. cv_val = cv_val + gs_raw-tsl14.
    WHEN 15. cv_val = cv_val + gs_raw-tsl15.
    WHEN 16. cv_val = cv_val + gs_raw-tsl16.
  ENDCASE.
ENDFORM.

*&---------------------------------------------------------------------*
*& Form append_output — 将计算结果写入输出内表
*&---------------------------------------------------------------------*
FORM append_output USING    iv_racct  TYPE racct
                              iv_qc_jf  TYPE hslvt12
                              iv_qc_df  TYPE hslvt12
                              iv_bq_jf  TYPE hslvt12
                              iv_bq_df  TYPE hslvt12
                              iv_bn_jf  TYPE hslvt12
                              iv_bn_df  TYPE hslvt12
                              iv_qm_jf  TYPE hslvt12
                              iv_qm_df  TYPE hslvt12
                              iv_qc_jf1 TYPE tslvt12
                              iv_qc_df1 TYPE tslvt12
                              iv_bq_jf1 TYPE tslvt12
                              iv_bq_df1 TYPE tslvt12
                              iv_bn_jf1 TYPE tslvt12
                              iv_bn_df1 TYPE tslvt12
                              iv_qm_jf1 TYPE tslvt12
                              iv_qm_df1 TYPE tslvt12.
  DATA: lv_qc    TYPE hslvt12,
        lv_qm    TYPE hslvt12,
        lv_qc1   TYPE tslvt12,
        lv_qm1   TYPE tslvt12,
        lv_zfzhs TYPE char20,
        lv_zfztx TYPE char40.

  CLEAR gs_out.

  " 一级节点
  gs_out-zyjkm = iv_racct(4).

  " 科目编码
  gs_out-racct = iv_racct.

  " 科目描述
  READ TABLE gt_skat INTO gs_skat
    WITH KEY saknr = iv_racct
             ktopl = gc_ktopl
             spras = gc_spras.
  IF sy-subrc = 0.
    gs_out-txt50 = gs_skat-txt50.
  ENDIF.

  " 辅助维度
  PERFORM get_aux_dim USING iv_racct CHANGING lv_zfzhs lv_zfztx.
  gs_out-zfzhs = lv_zfzhs.
  gs_out-zfztx = lv_zfztx.

  " --- 期初余额 ---
  lv_qc = iv_qc_jf - iv_qc_df.
  IF lv_qc >= 0.
    gs_out-zqcjf = lv_qc.
    gs_out-zqcdf = 0.
  ELSE.
    gs_out-zqcjf = 0.
    gs_out-zqcdf = abs( lv_qc ).
  ENDIF.

  " --- 本期发生 ---
  gs_out-zbqjf = iv_bq_jf.
  gs_out-zbqdf = iv_bq_df.

  " --- 本年累计 ---
  gs_out-zbnjf = iv_bn_jf.
  gs_out-zbndf = iv_bn_df.

  " --- 期末余额 ---
  lv_qm = lv_qc + iv_bq_jf - iv_bq_df.
  IF lv_qm >= 0.
    gs_out-zqmjf = lv_qm.
    gs_out-zqmdf = 0.
  ELSE.
    gs_out-zqmjf = 0.
    gs_out-zqmdf = abs( lv_qm ).
  ENDIF.

  " --- 外币 ---
  IF p_waers = abap_true.
    lv_qc1 = iv_qc_jf1 - iv_qc_df1.
    IF lv_qc1 >= 0.
      gs_out-zqcjf1 = lv_qc1.
      gs_out-zqcdf1 = 0.
    ELSE.
      gs_out-zqcjf1 = 0.
      gs_out-zqcdf1 = abs( lv_qc1 ).
    ENDIF.

    gs_out-zbqjf1 = iv_bq_jf1.
    gs_out-zbqdf1 = iv_bq_df1.
    gs_out-zbnjf1 = iv_bn_jf1.
    gs_out-zbndf1 = iv_bn_df1.

    lv_qm1 = lv_qc1 + iv_bq_jf1 - iv_bq_df1.
    IF lv_qm1 >= 0.
      gs_out-zqmjf1 = lv_qm1.
      gs_out-zqmdf1 = 0.
    ELSE.
      gs_out-zqmjf1 = 0.
      gs_out-zqmdf1 = abs( lv_qm1 ).
    ENDIF.

    gs_out-rtcur = gs_raw-rtcur.
  ENDIF.

  APPEND gs_out TO gt_out.
ENDFORM.

*&---------------------------------------------------------------------*
*& Form get_aux_dim — 辅助维度编码与名称
*&---------------------------------------------------------------------*
FORM get_aux_dim USING    iv_racct  TYPE racct
                   CHANGING cv_zfzhs TYPE char20
                            cv_zfztx TYPE char40.
  IF iv_racct CP '1002*'.
    " 银行科目：取 SKA1 增强字段
    READ TABLE gt_ska1 INTO gs_ska1
      WITH KEY saknr = iv_racct
               ktopl = gc_ktopl.
    IF sy-subrc = 0.
      cv_zfzhs = gs_ska1-zfkyh.
      cv_zfztx = gs_ska1-zyhzh.
    ENDIF.
  ELSEIF iv_racct CP '6601*'.
    " 费用科目：取功能范围
    cv_zfzhs = gs_raw-rfarea.
    READ TABLE gt_tfkbt INTO gs_tfkbt
      WITH KEY fkber = gs_raw-rfarea
               spras = gc_spras.
    IF sy-subrc = 0.
      cv_zfztx = gs_tfkbt-fkbtx.
    ENDIF.
  ELSE.
    cv_zfzhs = ''.
    cv_zfztx = ''.
  ENDIF.
ENDFORM.

*&---------------------------------------------------------------------*
*& Form build_alv — 构建 ALV 字段目录
*&---------------------------------------------------------------------*
FORM build_alv.
  DATA: lt_fcat TYPE lvc_t_fcat.

  DEFINE add_fcat.
    CLEAR gs_fieldcat.
    gs_fieldcat-fieldname = &1.
    gs_fieldcat-coltext   = &2.
    gs_fieldcat-outputlen = &3.
    gs_fieldcat-decimals  = &4.
    IF &5 IS NOT INITIAL.
      gs_fieldcat-cfieldname = &5.
    ENDIF.
    APPEND gs_fieldcat TO lt_fcat.
  END-OF-DEFINITION.

  add_fcat 'ZYJKM'  '一级节点'        8   0 ''.
  add_fcat 'RACCT'  '科目编码'        10  0 ''.
  add_fcat 'TXT50'  '科目描述'        30  0 ''.
  add_fcat 'ZFZHS'  '核算维度编码'    20  0 ''.
  add_fcat 'ZFZTX'  '核算维度名称'    40  0 ''.
  add_fcat 'ZQCJF'  '期初余额借方'    23  2 ''.
  add_fcat 'ZQCDF'  '期初余额贷方'    23  2 ''.
  add_fcat 'ZBQJF'  '本期发生借方'    23  2 ''.
  add_fcat 'ZBQDF'  '本期发生贷方'    23  2 ''.
  add_fcat 'ZBNJF'  '本年累计借方'    23  2 ''.
  add_fcat 'ZBNDF'  '本年累计贷方'    23  2 ''.
  add_fcat 'ZQMJF'  '期末余额借方'    23  2 ''.
  add_fcat 'ZQMDF'  '期末余额贷方'    23  2 ''.

  IF p_waers = abap_true.
    add_fcat 'ZQCJF1' '期初余额借方(外币)' 23 2 ''.
    add_fcat 'ZQCDF1' '期初余额贷方(外币)' 23 2 ''.
    add_fcat 'ZBQJF1' '本期发生借方(外币)' 23 2 ''.
    add_fcat 'ZBQDF1' '本期发生贷方(外币)' 23 2 ''.
    add_fcat 'ZBNJF1' '本年累计借方(外币)' 23 2 ''.
    add_fcat 'ZBNDF1' '本年累计贷方(外币)' 23 2 ''.
    add_fcat 'ZQMJF1' '期末余额借方(外币)' 23 2 ''.
    add_fcat 'ZQMDF1' '期末余额贷方(外币)' 23 2 ''.
    add_fcat 'RTCUR'  '币种'              5  0 ''.
  ENDIF.

  gt_fieldcat = lt_fcat.

  " 排序：按科目编码升序
  CLEAR gs_sort.
  gs_sort-fieldname = 'RACCT'.
  gs_sort-up        = 'X'.
  gs_sort-subtot    = ''.
  APPEND gs_sort TO gt_sort.

  " 布局
  gs_layout-zebra      = 'X'.
  gs_layout-cwidth_opt = 'X'.
ENDFORM.

*&---------------------------------------------------------------------*
*& Form display_alv — 显示 ALV
*&---------------------------------------------------------------------*
FORM display_alv.
  IF gt_out IS INITIAL.
    MESSAGE '无数据可显示' TYPE 'S' DISPLAY LIKE 'W'.
    RETURN.
  ENDIF.

  CALL FUNCTION 'REUSE_ALV_GRID_DISPLAY'
    EXPORTING
      i_callback_program = sy-repid
      it_fieldcat        = gt_fieldcat
      is_layout          = gs_layout
      it_sort            = gt_sort
    TABLES
      t_outtab           = gt_out
    EXCEPTIONS
      program_error      = 1
      OTHERS             = 2.
  IF sy-subrc <> 0.
    MESSAGE 'ALV 显示失败' TYPE 'E'.
  ENDIF.
ENDFORM.
