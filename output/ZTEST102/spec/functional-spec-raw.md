# 功能说明书原始内容 - EE041 电子档案对接报表

> 来源: spec/EE041 - 电子档案对接报表_V1.0_20260417.docx
> 提取日期: 2026-06-01

## 基本信息

| 项目 | 内容 |
|------|------|
| 功能说明书编号 | EL-FS-FI-EE041 |
| 功能说明书名称 | 电子档案对接 |
| 模块 | FI |
| 版本 | 1.0 |
| 类型 | 报表 |
| 使用频度 | 日 |
| 处理方式 | 在线 |
| 使用语言 | 中文 |
| 开发优先度 | 高 |

## 选择屏幕

| 字段 | 选项 | 是否必填 | 表名 | 字段 |
|------|------|---------|------|------|
| 公司代码 | 多选 | 必填 | BKPF | BUKRS |
| 会计年度 | 单选 | 必填 | BKPF | GJAHR |
| 期间 | 单选 | 必填 | BKPF | MONAT |

## 涉及表与关联关系

主表: FAGLFLEXA

关联:
- FAGLFLEXA-RBUKRS = BKPF/BSEG/ZSAP_BUKRS-BUKRS
- FAGLFLEXA-DOCNR = BKPF/BSEG-BELNR
- FAGLFLEXA-RYEAR = BKPF/BSEG-GJAHR
- FAGLFLEXA-BUZEI = BSEG-BUZEI

新增配置表: ZSAP_FI180 (电子档案凭证字配置)
- ZSAP_BUKRS-BUKRS, ZSAP_BUKRS-LTEXT
- ZVOUTY (凭证字)

## ALV 输出字段

(完整字段列表见 functional-spec-ai.md)
