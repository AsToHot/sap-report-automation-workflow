/**
 * 部署脚本共享工具函数
 *
 * 被 deploy_report.js / deploy_report_include.js / deploy_fugr.js / deploy_clas.js / deploy_intf.js 引用
 */
const { lockObject } = require("./lock-object");
const { unlockObject } = require("./unlock-object");
const lockStore = require("./lock-store");

/**
 * 执行 fn(lockHandle) 且保证 finally 中释放锁
 */
async function withLock(client, uri, fn) {
  const handle = await lockObject(client, uri);
  lockStore.save(uri, handle);
  try {
    return await fn(handle);
  } finally {
    try {
      await unlockObject(client, uri, handle);
    } finally {
      lockStore.remove(uri);
    }
  }
}

/**
 * 检查 body 中是否包含 "已存在" 或 "AlreadyExists"
 */
function isAlreadyExists(body) {
  return body && (body.includes("已存在") || body.includes("AlreadyExists"));
}

/**
 * 检查 statusCode 是否表示资源已存在
 */
function isConflict(statusCode) {
  return statusCode === 409 || statusCode === 405;
}

module.exports = { withLock, isAlreadyExists, isConflict };
