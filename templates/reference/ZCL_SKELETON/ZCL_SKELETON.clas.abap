CLASS zcl_skeleton DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    " ====== 类型定义 ======
    TYPES: BEGIN OF ty_output,
             key_field TYPE char10,
             value     TYPE string,
           END OF ty_output.
    TYPES ty_output_t TYPE STANDARD TABLE OF ty_output WITH EMPTY KEY.

    " ====== 常量 ======
    CONSTANTS gc_version TYPE string VALUE '1.0.0'.

    " ====== 构造器 ======
    METHODS constructor
      IMPORTING iv_key TYPE char10 OPTIONAL.

    " ====== 实例方法 ======
    METHODS get_data
      IMPORTING iv_filter     TYPE string OPTIONAL
      RETURNING VALUE(rt_out) TYPE ty_output_t
      RAISING   cx_static_check.

    METHODS save_data
      IMPORTING is_data        TYPE ty_output
      RAISING   cx_static_check.

    " ====== 静态方法 ======
    CLASS-METHODS create_instance
      IMPORTING iv_key         TYPE char10
      RETURNING VALUE(ro_obj)  TYPE REF TO zcl_skeleton.

  PROTECTED SECTION.
    DATA mv_key TYPE char10.

  PRIVATE SECTION.
    " 内部缓冲
    DATA mt_buffer TYPE ty_output_t.
    DATA mv_dirty  TYPE abap_bool.

    " 内部校验
    METHODS _validate
      IMPORTING iv_value       TYPE clike
      RETURNING VALUE(rv_ok)   TYPE abap_bool.

ENDCLASS.


CLASS zcl_skeleton IMPLEMENTATION.

  METHOD constructor.
    mv_key = iv_key.
  ENDMETHOD.

  METHOD create_instance.
    ro_obj = NEW #( iv_key ).
  ENDMETHOD.

  METHOD get_data.
    " TODO: 替换为实际数据源（透明表 / CDS View / API）
    " SELECT field1, field2
    "   FROM dbtab
    "   INTO TABLE @mt_buffer
    "   WHERE key_field = @mv_key.

    IF iv_filter IS SUPPLIED AND iv_filter IS NOT INITIAL.
      rt_out = VALUE #( FOR row IN mt_buffer
                        WHERE ( value CS iv_filter ) ( row ) ).
    ELSE.
      rt_out = mt_buffer.
    ENDIF.
  ENDMETHOD.

  METHOD save_data.
    _validate( is_data-value ).
    " TODO: 替换为实际持久化逻辑
    " MODIFY dbtab FROM @is_data.
    mv_dirty = abap_false.
  ENDMETHOD.

  METHOD _validate.
    rv_ok = xsdbool( iv_value IS NOT INITIAL ).
  ENDMETHOD.

ENDCLASS.
