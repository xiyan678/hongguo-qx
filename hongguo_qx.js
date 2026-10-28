/*
 * hongguo_qx.js — 红果短剧 Quantumult X 通用改写脚本
 * 用法：script-response-body
 * 适用：圈X 3.x+ / Loon / Surge（Surge 需改成 http-response）
 *
 * 功能：
 *   1. 广告配置/广告位接口 → 返回空对象（无填充，SDK 静默跳过）
 *   2. 用户信息类接口 → VIP / 会员 / 权限字段强制为真，到期时间拉满
 *   3. 剧集类接口 → 锁定 / 付费 / 试看标记强制解除
 *
 * 注意：付费片源的播放地址由服务端按账号签发，本脚本无法伪造。
 */

(function () {
  var url = (typeof $request !== 'undefined' && $request.url) ? $request.url : '';
  var raw = (typeof $response !== 'undefined' && $response.body) ? $response.body : '';

  var tag = '[HG] ' + url;

  // ---------- 0. 空响应直接放行 ----------
  if (!raw) { $done({}); return; }

  // ---------- 1. 广告接口：回空 ----------
  if (/(pangle|pangolin|gromore|adslot|ad_slot|ad-config|ad_config|adn\/|csj_|reward.?video.?cfg)/i.test(url)) {
    console.log('[HG-AD] dropped: ' + url);
    $done({ body: JSON.stringify({ code: 0, message: 'ok', data: {}, ads: [], ad_list: [], adList: [] }) });
    return;
  }

  // ---------- 2. 非 JSON 不碰 ----------
  var obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    $done({});
    return;
  }

  // ---------- 3. 键名规则 ----------
  var RE_VIP_TRUE = /^(is[_-]?vip|is[_-]?svip|is[_-]?member|is[_-]?privilege|is[_-]?subscribed|is[_-]?premium|is[_-]?paid|has[_-]?vip|has[_-]?pay|vip[_-]?status|vip[_-]?type|member[_-]?type|user[_-]?type|pay[_-]?status)$/i;
  var RE_VIP_NUM = /^(vip[_-]?level|svip[_-]?level|member[_-]?level|privilege[_-]?level)$/i;
  var RE_VIP_EXPIRE = /((vip|svip|member|premium|privilege)[_-]?(expire|end|deadline|due|invalid)[_-]?(time|at|date)?)|((expire|end|deadline)[_-]?(time|at|date))/i;

  var RE_LOCK_OFF = /^(is[_-]?lock|is[_-]?locked|need[_-]?pay|need[_-]?unlock|is[_-]?pay|is[_-]?trial|is[_-]?purchase|locked|paywall|is[_-]?charge)$/i;
  var RE_LOCK_OFF_NUM = /^(lock[_-]?status|pay[_-]?status|trial[_-]?status|charge[_-]?status|unlock[_-]?status|free[_-]?type|lock[_-]?type)$/i;
  var RE_FREE_ON = /^(is[_-]?free|is[_-]?unlock|can[_-]?play|can[_-]?watch|is[_-]?playable|allow[_-]?play|free)$/i;

  var EXPIRE_MS = 4102444800000; // 2100-01-01

  function walk(node) {
    if (node === null || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) walk(node[i]);
      return;
    }

    for (var k in node) {
      if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
      var v = node[k];

      if (v !== null && typeof v === 'object') { walk(v); continue; }

      // VIP 字段 → 真
      if (RE_VIP_TRUE.test(k)) {
        if (typeof v === 'boolean')      node[k] = true;
        else if (typeof v === 'number')  node[k] = 1;
        else if (typeof v === 'string')  node[k] = '1';
        else                             node[k] = true;
        continue;
      }

      // VIP 等级 → 1
      if (RE_VIP_NUM.test(k) && typeof v === 'number') {
        node[k] = v < 1 ? 1 : v;
        continue;
      }

      // VIP 到期时间 → 拉满
      if (RE_VIP_EXPIRE.test(k) && typeof v === 'number') {
        node[k] = v > 1e12 ? EXPIRE_MS : Math.floor(EXPIRE_MS / 1000);
        continue;
      }

      // 锁定 / 付费 / 试看 → 关
      if (RE_LOCK_OFF.test(k)) {
        if (typeof v === 'boolean')     node[k] = false;
        else if (typeof v === 'number') node[k] = 0;
        else if (typeof v === 'string') node[k] = '0';
        continue;
      }

      if (RE_LOCK_OFF_NUM.test(k)) {
        if (typeof v === 'number')      node[k] = 0;
        else if (typeof v === 'string') node[k] = '0';
        continue;
      }

      // 可播放 / 免费 / 已解锁 → 开
      if (RE_FREE_ON.test(k)) {
        if (typeof v === 'boolean')     node[k] = true;
        else if (typeof v === 'number') node[k] = 1;
        else if (typeof v === 'string') node[k] = '1';
        continue;
      }
    }
  }

  walk(obj);

  // ---------- 4. 顶层常见包装兜底 ----------
  var root = obj.data || obj.result || obj.user || obj.user_info || obj;
  if (root && typeof root === 'object' && !Array.isArray(root)) {
    ['vip', 'is_vip', 'isVip', 'member', 'svip', 'is_svip', 'privilege'].forEach(function (k) {
      if (k in root) {
        if (typeof root[k] === 'boolean')     root[k] = true;
        else if (typeof root[k] === 'number') root[k] = 1;
        else if (typeof root[k] === 'string') root[k] = '1';
      }
    });
  }

  console.log('[HG] patched ' + (url.split('?')[0] || ''));
  $done({ body: JSON.stringify(obj) });
})();
