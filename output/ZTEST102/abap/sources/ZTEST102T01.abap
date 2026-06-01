*&---------------------------------------------------------------------*
*&  包含                ZTEST102T01
*&  电子档案对接 - 数据与类定义
*&---------------------------------------------------------------------
TABLES: bkpf, bseg, faglflexa, zsap_bukrs.

*&---------------------------------------------------------------------*
* ALV 引用
*&---------------------------------------------------------------------*
DATA: gr_alv TYPE REF TO cl_salv_table.

*&---------------------------------------------------------------------*
* 电子档案输出结构（对齐 ZSAP_FI179 字段）
*&---------------------------------------------------------------------*
TYPES: BEGIN OF ty_out,
         rbukrs      TYPE zsap_bukrs-bukrs,     " 机构代码
         rltext      TYPE zsap_bukrs-ltext,     " 机构名称
         bukrs       TYPE zsap_bukrs-bukrs,     " 分公司代码
         ltext       TYPE zsap_bukrs-ltext,     " 分公司名称
         ryear       TYPE gjahr,                " 会计年度
         poper       TYPE poper,                " 会计期间
         budat       TYPE budat,                " 过账日期
         cpudt       TYPE bkpf-cpudt,           " 记账日期
         aedat       TYPE bkpf-aedat,           " 修改日期
         reviewer    TYPE bkpf-usnam,           " 审核
         preparer    TYPE bkpf-usnam,           " 制单
         poster      TYPE bkpf-usnam,           " 过账
         approver    TYPE bkpf-usnam,           " 核准
         operator    TYPE bkpf-usnam,           " 经办
         usnam       TYPE bkpf-usnam,           " 用户名(内部)
         attchnum    TYPE i,                    " 附件数(保留)
         adjust_flg  TYPE c LENGTH 2,           " 是否调整期凭证
         vernum      TYPE c LENGTH 5,           " 引入版本号(保留)
         bustype     TYPE c LENGTH 8,           " 业务类型
         xreversal   TYPE bkpf-xreversal,       " 是否已冲销
         blart       TYPE bkpf-blart,           " 凭证类型
         docnr       TYPE belnr_d,              " 凭证号码
         zvouty      TYPE c LENGTH 20,          " 凭证字
         bktxt       TYPE bkpf-bktxt,           " 摘要
         docln       TYPE faglflexa-docln,      " 序号
         racct       TYPE racct,                " 会计科目编码
         racct_txt   TYPE skat-txt50,           " 会计科目描述
         waers       TYPE bkpf-waers,           " 币别
         tsl         TYPE faglflexa-tsl,        " 原币金额
         hsl_s       TYPE faglflexa-hsl,        " 借方金额
         hsl_h       TYPE faglflexa-hsl,        " 贷方金额
         kostl       TYPE bseg-kostl,           " 部门
         kostl_txt   TYPE c LENGTH 40,          " 部门名称
         prctr       TYPE faglflexa-prctr,      " 利润中心
         prctr_txt   TYPE c LENGTH 40,          " 利润中心描述
         sgtxt       TYPE bseg-sgtxt,           " 行项目文本
         matnr       TYPE bseg-matnr,           " 物料
         maktx       TYPE c LENGTH 40,          " 物料名称
         ktokd       TYPE kna1-ktokd,           " 客户分组
         ktokd_txt   TYPE c LENGTH 30,          " 客户分组名称
         zyhzh       TYPE c LENGTH 50,          " 银行名称
         orgname     TYPE c LENGTH 40,          " 组织机构名称(保留)
         matkl       TYPE mara-matkl,           " 物料组
         wgbez60     TYPE c LENGTH 60,          " 物料分组名称
         lifnr_fi    TYPE lifnr,                " 财务供应商
         name1_lif_fi TYPE c LENGTH 35,         " 财务供应商名称
         kunnr_fi    TYPE kunnr,                " 财务客户
         name1_kur_fi TYPE c LENGTH 35,         " 财务客户名称
         hkont_bkn   TYPE c LENGTH 50,          " 银行账号名称
         hkont_fdn   TYPE c LENGTH 50,          " 其他货币资金账号名称
         kunnr       TYPE kunnr,                " 客户
         name1_kur   TYPE c LENGTH 40,          " 客户名称
         lifnr       TYPE lifnr,                " 供应商
         name1_lif   TYPE c LENGTH 40,          " 供应商名称
         expense_name TYPE c LENGTH 50,         " 费用项目名称(保留)
         anlkl       TYPE anla-anlkl,           " 资产类别
         name1_anl   TYPE c LENGTH 50,          " 资产类别名称
         lifnr_pa    TYPE lifnr,                " 员工供应商
         name1_lif_pa TYPE c LENGTH 40,         " 员工名称
         meins       TYPE bseg-meins,           " 单位
         price       TYPE c LENGTH 13,          " 单价(保留)
         menge       TYPE bseg-menge,           " 数量
         paymethod   TYPE c LENGTH 10,          " 结算方式(保留)
         xblnr       TYPE bkpf-xblnr,           " 结算号
         kursf       TYPE bkpf-kursf,           " 汇率(内部)
         ref_field   TYPE c LENGTH 20,          " 参照字段(保留)
         rat_type    TYPE c LENGTH 8,           " 汇率类型
         rat         TYPE c LENGTH 10,          " 汇率
         busnum      TYPE c LENGTH 64,          " 业务编号
         abslib      TYPE c LENGTH 20,          " 摘要库(保留)
         zfkyh       TYPE c LENGTH 64,          " 银行账号
         acctdim     TYPE c LENGTH 10,          " 核算维度(保留)
       END OF ty_out.

DATA: gs_out TYPE ty_out,
      gt_out TYPE STANDARD TABLE OF ty_out.

*&---------------------------------------------------------------------*
* LOOKUP 内表
*&---------------------------------------------------------------------*
TYPES: BEGIN OF ty_zsap_bukrs,
         bukrs TYPE zsap_bukrs-bukrs,
         ltext TYPE zsap_bukrs-ltext,
         zzgs  TYPE zsap_bukrs-zzgs,
       END OF ty_zsap_bukrs.

TYPES: BEGIN OF ty_skat,
         saknr TYPE saknr,
         txt50 TYPE skat-txt50,
       END OF ty_skat.

TYPES: BEGIN OF ty_ska1,
         saknr TYPE saknr,
         zyhzh TYPE c LENGTH 50,
         zfkyh TYPE c LENGTH 64,
       END OF ty_ska1.

TYPES: BEGIN OF ty_cskt,
         kostl TYPE kostl,
         ktext TYPE c LENGTH 40,
       END OF ty_cskt.

TYPES: BEGIN OF ty_cepc,
         prctr TYPE prctr,
         khinr TYPE cepc-khinr,
       END OF ty_cepc.

TYPES: BEGIN OF ty_cepct,
         prctr TYPE prctr,
         ltext TYPE c LENGTH 40,
       END OF ty_cepct.

TYPES: BEGIN OF ty_lfa1,
         lifnr TYPE lifnr,
         name1 TYPE name1_gp,
         ktokk TYPE ktokk,
       END OF ty_lfa1.

TYPES: BEGIN OF ty_kna1,
         kunnr TYPE kunnr,
         name1 TYPE name1_gp,
         ktokd TYPE ktokd,
       END OF ty_kna1.

TYPES: BEGIN OF ty_mara,
         matnr TYPE matnr,
         matkl TYPE matkl,
       END OF ty_mara.

TYPES: BEGIN OF ty_makt,
         matnr TYPE matnr,
         maktg TYPE maktg,
       END OF ty_makt.

TYPES: BEGIN OF ty_t077x,
         ktokd TYPE ktokd,
         txt30 TYPE t077x-txt30,
       END OF ty_t077x.

TYPES: BEGIN OF ty_t023t,
         matkl TYPE matkl,
         wgbez60 TYPE wgbez60,
       END OF ty_t023t.

TYPES: BEGIN OF ty_ankt,
         anlkl TYPE anlkl,
         txk50 TYPE ankt-txk50,
       END OF ty_ankt.

TYPES: BEGIN OF ty_anla,
         anln1 TYPE anln1,
         anlkl TYPE anlkl,
       END OF ty_anla.

TYPES: BEGIN OF ty_fi180,
         bukrs TYPE bukrs,
         zvouty TYPE c LENGTH 20,
       END OF ty_fi180.

TYPES: BEGIN OF ty_fi032,
         bukrs TYPE bukrs,
         belnr TYPE belnr_d,
         gjahr TYPE gjahr,
         zcxflag TYPE zcxflag,
         bankserialnumber TYPE c LENGTH 64,
         urid TYPE zurid,
       END OF ty_fi032.

TYPES: BEGIN OF ty_fi054,
         bukrs TYPE bukrs,
         belnr TYPE belnr_d,
         gjahr TYPE gjahr,
         bankserialnumber TYPE c LENGTH 64,
       END OF ty_fi054.

DATA: lt_zsap_bukrs TYPE STANDARD TABLE OF ty_zsap_bukrs,
      lt_skat       TYPE STANDARD TABLE OF ty_skat,
      lt_ska1       TYPE STANDARD TABLE OF ty_ska1,
      lt_cskt       TYPE STANDARD TABLE OF ty_cskt,
      lt_cepc       TYPE STANDARD TABLE OF ty_cepc,
      lt_cepct      TYPE STANDARD TABLE OF ty_cepct,
      lt_lfa1       TYPE STANDARD TABLE OF ty_lfa1,
      lt_kna1       TYPE STANDARD TABLE OF ty_kna1,
      lt_mara       TYPE STANDARD TABLE OF ty_mara,
      lt_makt       TYPE STANDARD TABLE OF ty_makt,
      lt_t077x      TYPE STANDARD TABLE OF ty_t077x,
      lt_t023t      TYPE STANDARD TABLE OF ty_t023t,
      lt_ankt       TYPE STANDARD TABLE OF ty_ankt,
      lt_anla       TYPE STANDARD TABLE OF ty_anla,
      lt_fi180      TYPE STANDARD TABLE OF ty_fi180,
      lt_fi032      TYPE STANDARD TABLE OF ty_fi032,
      lt_fi054      TYPE STANDARD TABLE OF ty_fi054.

*&---------------------------------------------------------------------*
* 常量
*&---------------------------------------------------------------------*
CONSTANTS: gc_archive_id TYPE c LENGTH 4 VALUE 'EEKA',
           gc_fixed_rate TYPE c LENGTH 8 VALUE '固定汇率',
           gc_default_rat TYPE c LENGTH 10 VALUE 'HLTX01_SYS',
           gc_hsbc       TYPE c LENGTH 4 VALUE '汇丰'.

*&---------------------------------------------------------------------*
* 类定义 - 工具栏事件
*&---------------------------------------------------------------------*
CLASS lcl_handle_events DEFINITION.
  PUBLIC SECTION.
    METHODS:
      on_user_command FOR EVENT added_function OF cl_salv_events
        IMPORTING e_salv_function,
      on_double_click FOR EVENT double_click OF cl_salv_events_table
        IMPORTING row column.
ENDCLASS.

DATA: gr_events TYPE REF TO lcl_handle_events.
