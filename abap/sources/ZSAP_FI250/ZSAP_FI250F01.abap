*&---------------------------------------------------------------------*
*&  包含                ZSAP_FI250F01
*&  电子档案对接报表（EE041）- 取数逻辑与 ALV 展示
*&---------------------------------------------------------------------*
FORM get_data.
  SELECT a~rbukrs,
         z~ltext,
         a~ryear AS gjahr,
         a~poper,
         b~budat,
         b~cpudt,
         b~aedat,
         b~blart,
         a~docnr,
         b~bktxt,
         a~docln,
         a~racct AS hkont,
         k~txt50,
         b~waers,
         a~tsl,
         CASE WHEN a~drcrk = 'S' THEN a~hsl END AS dmbtr_s,
         CASE WHEN a~drcrk = 'H' THEN 0 - a~hsl END AS dmbtr_h,
         c~kostl,
         c~sgtxt,
         a~prctr,
         ct~ltext AS prctr_txt,
         b~xblnr,
         b~kursf
    FROM faglflexa AS a
    INNER JOIN bkpf AS b ON b~bukrs = a~rbukrs
                        AND b~belnr = a~docnr
                        AND b~gjahr = a~ryear
    LEFT JOIN bseg AS c ON c~bukrs = a~rbukrs
                       AND c~belnr = a~docnr
                       AND c~gjahr = a~ryear
                       AND c~buzei = a~buzei
    LEFT JOIN zsap_bukrs AS z ON z~bukrs = a~rbukrs
    LEFT JOIN skat AS k ON k~saknr = a~racct
                       AND k~spras = @sy-langu
                       AND k~ktopl = 'EEKA'
    LEFT JOIN cepct AS ct ON ct~prctr = a~prctr
                         AND ct~spras = '1'
                         AND ct~datbi = '99991231'
                         AND ct~kokrs = 'EEKA'
   WHERE a~rbukrs IN @s_bukrs
     AND a~ryear  IN @s_gjahr
     AND a~poper  IN @s_monat
   INTO CORRESPONDING FIELDS OF TABLE @gt_data.

  LOOP AT gt_data ASSIGNING FIELD-SYMBOL(<ls_data>).
    <ls_data>-dangh = 'EEKA'.
  ENDLOOP.
ENDFORM.

FORM display.
  IF gt_data IS INITIAL.
    MESSAGE '未查询到数据' TYPE 'S'.
    RETURN.
  ENDIF.

  TRY.
      cl_salv_table=>factory(
        IMPORTING r_salv_table = gr_alv
        CHANGING  t_table      = gt_data ).
    CATCH cx_salv_msg INTO DATA(lx_salv).
      MESSAGE lx_salv->get_text( ) TYPE 'S'.
      RETURN.
  ENDTRY.

  gr_alv->set_screen_status(
    pfstatus      = 'S1000'
    report        = sy-repid
    set_functions = gr_alv->c_functions_all ).

  gr_alv->get_columns( )->set_optimize( abap_true ).
  gr_alv->display( ).
ENDFORM.
