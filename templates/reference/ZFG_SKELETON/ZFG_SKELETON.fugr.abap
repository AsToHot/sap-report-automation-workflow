FUNCTION-POOL zfg_skeleton.

" ====== 函数组全局数据定义 ======
" 以下数据在此函数组内所有 Function Module 之间共享

* DATA gv_counter TYPE i.
* DATA gt_buffer TYPE TABLE OF bkpf.

" ====== 公共类型定义（可选：放在独立的 TOP Include 中） ======
* INCLUDE zfg_skeleton_top.
