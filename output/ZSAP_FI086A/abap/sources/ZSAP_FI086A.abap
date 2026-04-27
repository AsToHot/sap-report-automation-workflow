*&---------------------------------------------------------------------*
*& Report ZSAP_FI086A
*& 科目余额表
*&---------------------------------------------------------------------*
REPORT zsap_fi086a.

INCLUDE zsap_fi086at01.
INCLUDE zsap_fi086asel.
INCLUDE zsap_fi086af01.

START-OF-SELECTION.
  PERFORM get_data.
  PERFORM process_data.
  PERFORM build_alv.
  PERFORM display_alv.
