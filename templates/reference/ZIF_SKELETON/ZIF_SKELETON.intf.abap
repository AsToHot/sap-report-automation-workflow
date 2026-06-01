INTERFACE zif_skeleton
  PUBLIC.

  " ====== 类型定义（实现类可复用） ======
  TYPES: BEGIN OF ty_result,
           key   TYPE char10,
           value TYPE string,
         END OF ty_result.
  TYPES ty_result_t TYPE STANDARD TABLE OF ty_result WITH EMPTY KEY.

  " ====== 常量 ======
  CONSTANTS gc_version TYPE string VALUE '1.0.0'.

  " ====== 实例方法签名 ======
  METHODS get_by_key
    IMPORTING iv_key          TYPE char10
    RETURNING VALUE(rs_data)  TYPE ty_result
    RAISING   cx_static_check.

  METHODS get_list
    IMPORTING iv_filter       TYPE string OPTIONAL
    RETURNING VALUE(rt_data)  TYPE ty_result_t
    RAISING   cx_static_check.

  METHODS save
    IMPORTING is_data          TYPE ty_result
    RAISING   cx_static_check.

  METHODS delete
    IMPORTING iv_key          TYPE char10
    RAISING   cx_static_check.

  " ====== 静态方法签名 ======
  CLASS-METHODS get_instance_count
    RETURNING VALUE(rv_count) TYPE i.

  " ====== 事件 ======
  EVENTS data_changed
    EXPORTING VALUE(iv_key) TYPE char10.

ENDINTERFACE.
