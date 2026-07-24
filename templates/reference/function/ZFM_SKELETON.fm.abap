FUNCTION zfm_skeleton.
*"----------------------------------------------------------------------
*"*"本地接口：
*"  IMPORTING
*"     VALUE(IV_KEY) TYPE CHAR10
*"  EXPORTING
*"     VALUE(ET_DATA) TYPE TABLE
*"     VALUE(EV_COUNT) TYPE I
*"  EXCEPTIONS
*"     NO_DATA_FOUND
*"     INVALID_INPUT
*"----------------------------------------------------------------------

  " ====== 输入校验 ======
  IF iv_key IS INITIAL.
    RAISE invalid_input.
  ENDIF.

  " ====== 数据读取（TODO: 替换为实际逻辑） ======
  " SELECT field1 field2
  "   FROM dbtab
  "   INTO TABLE @et_data
  "   WHERE key_field = @iv_key.
  "
  " IF sy-subrc <> 0.
  "   RAISE no_data_found.
  " ENDIF.

  DESCRIBE TABLE et_data LINES ev_count.

ENDFUNCTION.
