功能说明书-EEKA  
程序类型
推广单位
功能说明书编号
EL-FS-FI-EE086 
功能说明书名称
科目余额表
事务代码
业务流程
业务子流程
系统版本
1.0
模块
FI
业务负责人
功能设计者 
XXX
程序开发者 / 程序员
1、 设计维护记录
1.1、 版本信息
当前版本: 
1.0
最新更新日期:
2026-03-24
最新更新作者: 
蒲鑫鑫
作者: 
创建日期: 
2026-03-24
1.2、 修订历史
版本号
更新日期
修订作者
主要修订摘要
审核人
1.0
2026.3.24
蒲鑫鑫
文档创建
1.3、 报表/表单/增强概述
报表/表单/增强用途（描述编写报表/表单/增强的用途或目的）
按照需求查询科目余额表
类型（报表/表单/增强程序执行的功能描述）
报表
报表/表单/增强使用者
XX
使用频度（日、月、季度或年）
日
后台处理/在线处理
在线
打印机类型（激光 / 喷墨 / 针式）
N/A
纸张大小/方向
N/A
使用语言（中文 / 英文 / ……）
开发优先度（高/中/低）
高
注释
2、 程序开发需求
2.1 需求概述
-“基本需求” 责任人：应用组
涉及模块
涉及事务代码
现状描述
业务描述
 FICO
2.2 参考屏幕
2.3 业务逻辑流程
XXX
2.3.1业务流程图
     XXX
2.3.2文字描述：（结合业务流成图描写具体的业务需求）
2.4 相关文档
3、 开发设计
3.1、 报表/表单/增强实施流程
3.1.1 报表屏幕设计
字段名
表名
字段
定义
补充逻辑
公司代码
ZSAP_BUKRS
BUKRS
单选
搜索帮助取表ZSAP_BUKRS- BUKRS
必填
会计年度
FAGLFLEXT
RYEAR
单选
必填
期间
FAGLFLEXT
RPMAX
多选
科目编码
FAGLFLEXT
RACCT
多选
是否显示外币余额
按钮
3.3.2 状态栏设计
3.3.3标题栏设计
XXX
3.3.4 （实现增强的BADI/ CUSTOMER EXIT）
XXXX
3.3.5 表单设计
3.2、 程序实现描述
逻辑说明：
关联FAGLFLEXT表取值，可共用的限制条件如下
1-1：公司代码  关联ZSAP_BUKRS-BUKRS
 如屏幕选择公司代码=ZSAP_BUKRS-BUKRS，取ZSAP_BUKRS-ZFGS＝""，则取ZSAP_BUKRS-BUKRS=FAGLFLEXT-RBUKRS；
 如屏幕选择公司代码=ZSAP_BUKRS-BUKRS，取ZSAP_BUKRS-ZFGS≠""，则取ZSAP_BUKRS-ZZGS=FAGLFLEXT-RBUKRS，并取ZSAP_BUKRS- PRCTR=CEPC-KHINR，且CEPC-DATBI=99991231，CEPC- KOKRS=“EEKA”，取CEPC- PRCTR= FAGLFLEXT-PRCTR进行数据限制
1-2：会计年度  
取选择屏幕会计年度= FAGLFLEXT-RYEAR
1-3：会计科目
如果屏幕选择科目，则选择屏幕科目= FAGLFLEXT-RACCT，如果未输则默认所有
其他字段说明
2-1：一级节点-ZYJKM=LEFT(FAGLFLEXT-RACCT，4)
2-2：辅助维度编码：
当FAGLFLEXT-RACCT=1002*时，取FAGLFLEXT-RACCT=SKA1-SAKNR，SKA1-KTOPL=EEKA，取SKA1-ZFKYH
当FAGLFLEXT-RACCT=6601*时，取FAGLFLEXT- RFAREA
2-3：辅助维度描述：
当FAGLFLEXT-RACCT=1002*时，取FAGLFLEXT-RACCT=SKA1-SAKNR，SKA1-KTOPL=EEKA，取SKA1- ZYHZH
当FAGLFLEXT-RACCT=6601*时，取FAGLFLEXT- RFAREA= TFKBT- FKBER，TFKBT- SPRAS=ZH，取TFKBT- FKBTX
3、金额取值
3-1期初余额借方：
3-1-1：若屏选期间（FAGLFLEXT-RPMAX）范围起始为01, 例如期间选择01~03，取科目（FAGLFLEXT-RACCT）时， FAGLFLEXT-HSLVT的累加值;
若屏选期间（FAGLFLEXT-RPMAX）范围起始不为01，取科目（FAGLFLEXT-RACCT），（FAGLFLEXT-HSLVT+HSL01~11）的累计值；例如期间选择03~06，期初余额=∑（FAGLFLEXT-HSLVT+HSL01+ HSL02）
3-1-2：且要求当汇总金额≥0展示此列
3-2期初余额贷方：
3-2-1：逻辑同3-1-1
3-2-2：且要求当汇总金额＜0展示此列
3-3 本期发生借方
3-3-1： 本期发生借方=取科目（FAGLFLEXT-RACCT），借贷标识（FAGLFLEXT-DRCRK）=S时，屏选期间汇总数（HSL01~16）；例如期间选择03~06，本期发生借方= FAGLFLEXT- HSL03+ HSL04+ HSL05+ HSL06；
3-4 本期发生贷方
3-4-1： 本期发生贷方=取科目（FAGLFLEXT-RACCT），借贷标识（FAGLFLEXT-DRCRK）=H时，屏选期间汇总数（HSL01~16）；例如期间选择03~06，本期发生借方= FAGLFLEXT- HSL03+ HSL04+ HSL05+ HSL06；
3-5 本年累计借方
3-5-1： 本年累计借方=取科目（FAGLFLEXT-RACCT），借贷标识（FAGLFLEXT-DRCRK）=S时，屏选截止期间汇总数（HSL01~16）；例如期间选择03~06，本期发生借方= FAGLFLEXT- HSL01+ HSL02+HSL03+ HSL04+ HSL05+ HSL06；
3-6 本年累计贷方
3-6-1： 本年累计借方=取科目（FAGLFLEXT-RACCT），借贷标识（FAGLFLEXT-DRCRK）=H时，屏选截止期间汇总数（HSL01~16）；例如期间选择03~06，本期发生借方= FAGLFLEXT- HSL01+ HSL02+HSL03+ HSL04+ HSL05+ HSL06；
3-7 期末余额借方
期初余额借方+期初余额贷方+本期发生借方+本期发生贷方，且要求公式计算金额≥0时
3-8 期末余额贷方
期初余额借方+期初余额贷方+本期发生借方+本期发生贷方，且要求公式计算金额＜0时
4、外币处理
当屏幕勾选“是否显示外币余额”，ALV展示如下：
期初余额借方（外币）：逻辑基本同3-1，变更原HSL部分为取TSL，同时增加限制FAGLFLEXT -RTCUR
期初余额贷方（外币）：逻辑基本同3-2，变更原HSL部分为取TSL，同时增加限制FAGLFLEXT -RTCUR
本期发生借方（外币）：逻辑基本同3-3，变更原HSL部分为取TSL，同时增加限制FAGLFLEXT -RTCUR
本期发生贷方（外币）：逻辑基本同3-4，变更原HSL部分为取TSL，同时增加限制FAGLFLEXT -RTCUR
本年累计借方（外币）：逻辑基本同3-5，变更原HSL部分为取TSL，同时增加限制FAGLFLEXT -RTCUR
本年累计贷方（外币）：逻辑基本同3-6，变更原HSL部分为取TSL，同时增加限制FAGLFLEXT -RTCUR
期末余额借方（外币）：逻辑基本同3-7，变更原HSL部分为取TSL，同时增加限制FAGLFLEXT -RTCUR
期末余额贷方（外币）：逻辑基本同3-8，变更原HSL部分为取TSL，同时增加限制FAGLFLEXT -RTCUR
输出字段要求：
字段描述
表名
字段
一级节点
ZYJKM
科目编码 
FAGLFLEXT
RACCT
科目描述
SKAT
TXT50
核算维度编码
ZFZHS
核算维度名称
ZFZTX
期初余额借方
FAGLFLEXT
ZQCJF
期初余额借方（外币）
FAGLFLEXT
ZQCJF1
仅当屏幕勾选外币时展示
期初余额贷方
FAGLFLEXT
ZQCDF
期初余额贷方（外币）
FAGLFLEXT
ZQCDF1
仅当屏幕勾选外币时展示
本期发生借方
FAGLFLEXT
ZBQJF
本期发生借方（外币）
FAGLFLEXT
ZBQJF1
仅当屏幕勾选外币时展示
本期发生贷方
FAGLFLEXT
ZBQDF
本期发生贷方（外币）
FAGLFLEXT
ZBQDF1
仅当屏幕勾选外币时展示
本年累计借方
FAGLFLEXT
ZBNJF
本年累计借方（外币）
FAGLFLEXT
ZBNJF1
仅当屏幕勾选外币时展示
本年累计贷方
FAGLFLEXT
ZBNDF
本年累计贷方（外币）
FAGLFLEXT
ZBNDF1
仅当屏幕勾选外币时展示
期末余额借方
FAGLFLEXT
ZQMJF
期末余额借方（外币）
FAGLFLEXT
ZQMJF1
仅当屏幕勾选外币时展示
期末余额贷方
FAGLFLEXT
ZQMDF
期末余额贷方（外币）
FAGLFLEXT
ZQMDF1
仅当屏幕勾选外币时展示
3.3.4，数据展示与跳转
按照科目号升序排列
以上字段均横向展示
展示界面参考如下：
3.3、 数据结构   
无。
3.4、 测试数据
无。
4、 用户权限设计
XXX。
5、 附录