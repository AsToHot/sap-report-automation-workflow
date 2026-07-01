*&---------------------------------------------------------------------*
*&  包含                ZTEST101T01
*&  报税取数稽核报表 - 数据与类定义
*&---------------------------------------------------------------------
TABLES: zsap_bukrs, faglflext.

*&---------------------------------------------------------------------*
* ALV
*&---------------------------------------------------------------------*
DATA: gr_alv TYPE REF TO cl_salv_table.

*&---------------------------------------------------------------------*
* 税种科目常量
*&---------------------------------------------------------------------*
CONSTANTS:
  BEGIN OF gc_tax,
    vat    TYPE racct VALUE '2221100000', " 增值税
    city   TYPE racct VALUE '2221020000', " 城建税
    edu    TYPE racct VALUE '2221030000', " 教育费附加
    local  TYPE racct VALUE '2221040000', " 地方教育费附加
    stamp  TYPE racct VALUE '2221070000', " 印花税
    income TYPE racct VALUE '2221060000', " 企业所得税
  END OF gc_tax.

CONSTANTS:
  gc_kokrs TYPE kokrs VALUE 'EEKA',
  gc_ktopl TYPE ktopl VALUE 'EEKA'.

*&---------------------------------------------------------------------*
* 公司代码映射结构
*&---------------------------------------------------------------------*
TYPES: BEGIN OF tys_bukrs_map,
         bukrs TYPE zsap_bukrs-bukrs,     " 屏幕公司代码
         ltext TYPE zsap_bukrs-ltext,     " 机构名称
         zfgs  TYPE zsap_bukrs-zfgs,      " 映射标记
         zzgs  TYPE zsap_bukrs-zzgs,      " 子公司码
         prctr TYPE cepc-khinr,           " 利润中心（对齐 CEPC-KHINR CHAR 12）
       END OF tys_bukrs_map.

TYPES: BEGIN OF tys_rbukrs,
         bukrs TYPE zsap_bukrs-bukrs,     " 屏幕公司代码
         ltext TYPE zsap_bukrs-ltext,
         rbukrs TYPE bukrs,               " 实际记账公司代码
         prctr  TYPE prctr,               " 利润中心
       END OF tys_rbukrs.

*&---------------------------------------------------------------------*
* CEPC 利润中心层次
*&---------------------------------------------------------------------*
TYPES: BEGIN OF tys_cepc,
         prctr TYPE prctr,
         khinr TYPE phinr,
       END OF tys_cepc.

*&---------------------------------------------------------------------*
* FAGLFLEXT 内表行
*&---------------------------------------------------------------------*
TYPES: BEGIN OF tys_fagl_row,
         ryear  TYPE gjahr,
         rbukrs TYPE bukrs,
         racct  TYPE racct,
         drcrk  TYPE shkzg,
         hsl01  TYPE hslxx12,
         hsl02  TYPE hslxx12,
         hsl03  TYPE hslxx12,
         hsl04  TYPE hslxx12,
         hsl05  TYPE hslxx12,
         hsl06  TYPE hslxx12,
         hsl07  TYPE hslxx12,
         hsl08  TYPE hslxx12,
         hsl09  TYPE hslxx12,
         hsl10  TYPE hslxx12,
         hsl11  TYPE hslxx12,
         hsl12  TYPE hslxx12,
         hsl13  TYPE hslxx12,
         hsl14  TYPE hslxx12,
         hsl15  TYPE hslxx12,
         hsl16  TYPE hslxx12,
       END OF tys_fagl_row.

*&---------------------------------------------------------------------*
* 应交金额中间汇总（按公司代码+科目）
*&---------------------------------------------------------------------*
TYPES: BEGIN OF tys_payable,
         bukrs TYPE bukrs,
         ltext TYPE zsap_bukrs-ltext,
         racct TYPE racct,
         hsl   TYPE hslxx12,
       END OF tys_payable.

*&---------------------------------------------------------------------*
* SKA1 银行账户映射
*&---------------------------------------------------------------------*
TYPES: BEGIN OF tys_bank,
         zbukrs TYPE bukrs,
         zfkyh  TYPE ze_fkyh,
       END OF tys_bank.

*&---------------------------------------------------------------------*
* ZSAP_FI054 内表行
*&---------------------------------------------------------------------*
TYPES: BEGIN OF tys_fi054_row,
         hkont_fy            TYPE racct,
         ourbankaccountnumber TYPE ze_fkyh,
         bukrs               TYPE bukrs,
         amount              TYPE hslxx12,
       END OF tys_fi054_row.

*&---------------------------------------------------------------------*
* 申报金额中间汇总（按公司代码+科目）
*&---------------------------------------------------------------------*
TYPES: BEGIN OF tys_declared,
         bukrs  TYPE bukrs,
         racct  TYPE racct,
         amount TYPE hslxx12,
       END OF tys_declared.

*&---------------------------------------------------------------------*
* 税种定义
*&---------------------------------------------------------------------*
TYPES: BEGIN OF tys_tax_def,
         racct TYPE racct,
         name  TYPE string,
       END OF tys_tax_def.

*&---------------------------------------------------------------------*
* ALV 输出结构
*&---------------------------------------------------------------------*
TYPES: BEGIN OF tys_output,
         bukrs TYPE zsap_bukrs-bukrs,
         ltext TYPE zsap_bukrs-ltext,
         zyjzz TYPE hslxx12,  " 应交增值税
         zzzsb TYPE hslxx12,  " 增值税申报金额
         zzzjy TYPE hslxx12,  " 增值税校验结果
         zyjcj TYPE hslxx12,  " 应交城建税
         zcjsb TYPE hslxx12,  " 城建税申报金额
         zcjjy TYPE hslxx12,  " 城建税校验结果
         zyjjy TYPE hslxx12,  " 应交教育费附加
         zjysb TYPE hslxx12,  " 教育费附加申报金额
         zjyjy TYPE hslxx12,  " 教育费附加校验结果
         zyjdf TYPE hslxx12,  " 应交地方教育费附加
         zdfsb TYPE hslxx12,  " 地方教育费申报金额
         zdfjy TYPE hslxx12,  " 地方教育费校验结果
         zyjyh TYPE hslxx12,  " 应交印花税
         zyhsb TYPE hslxx12,  " 印花税申报金额
         zyhjy TYPE hslxx12,  " 印花税校验结果
         zyjqy TYPE hslxx12,  " 应交企业所得税
         zqysb TYPE hslxx12,  " 企业所得税申报金额
         zqyjy TYPE hslxx12,  " 企业所得税校验结果
       END OF tys_output.

DATA: gs_output TYPE tys_output,
      gt_output TYPE TABLE OF tys_output.

*&---------------------------------------------------------------------*
* 工作变量
*&---------------------------------------------------------------------*
DATA:
  gt_bukrs_map  TYPE TABLE OF tys_bukrs_map,
  gt_rbukrs     TYPE TABLE OF tys_rbukrs,
  gt_cepc       TYPE TABLE OF tys_cepc,
  gt_fagl       TYPE TABLE OF tys_fagl_row,
  gt_payable    TYPE TABLE OF tys_payable,
  gt_bank_map   TYPE TABLE OF tys_bank,
  gt_fi054      TYPE TABLE OF tys_fi054_row,
  gt_declared   TYPE TABLE OF tys_declared,
  gt_tax_list   TYPE TABLE OF tys_tax_def,
  gt_periods    TYPE TABLE OF rpMAX.
