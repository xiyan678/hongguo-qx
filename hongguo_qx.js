/*
 * hongguo_qx.js  v2.0
 * 保守版：只动"用户身份对象"里的 VIP 白名单字段，
 * 绝不碰 is_free / can_play / lock / trial 这类业务开关——上一版白屏就是死在这。
 *
 * MODE = 'log'   只记录不改（排查用）
 * MODE = 'patch' 正常改写
 */
(function () {
  var MODE = 'patch';

  var url = (typeof $request !== 'undefined' && $request.url) ? $request.url : '';
  var raw = (typeof $response !== 'undefined' && $response.body) ? $response.body : '';
  if (!raw) { $done({}); return; }

  var obj;
  try { obj = JSON.parse(raw); } catch (e) { $done({}); return; }

  // ---- 严格白名单：只改这些键 ----
  var VIP_KEYS = ['is_vip', 'isVip', 'isVIP', 'vip_status', 'vipStatus', 'is_member', 'isMember',
                  'is_svip', 'isSVip', 'vip_type', 'vipType', 'member_type', 'memberType'];
  var EXP_KEYS = ['vip_expire', 'vipExpire', 'vip_expire_time', 'vipExpireTime',
                  'vip_end_time', 'vipEndTime', 'member_expire', 'memberExpire'];
  var EXP_MS = 4102444800000;

  // ---- 只在"用户对象"上动手，找不到就不改 ----
  var cand = null;
  var holders = [obj.data, obj.result, obj.user, obj.user_info, obj.userInfo, obj];
  for (var i = 0; i < holders.length; i++) {
    var h = holders[i];
    if (h && typeof h === 'object' && !Array.isArray(h)) {
      var keys = Object.keys(h);
      var looksUser = keys.some(function (k) {
        return /^(uid|user_?id|nickname|avatar|avatar_?url|sec_?uid|open_?id)$/i.test(k) ||
               VIP_KEYS.indexOf(k) >= 0;
      });
      if (looksUser) { cand = h; break; }
    }
  }

  if (!cand) {
    console.log('[HG] no user object, skip ' + url);
    $done({});
    return;
  }

  var changed = [];
  if (MODE === 'patch') {
    VIP_KEYS.forEach(function (k) {
      if (!(k in cand)) return;
      var v = cand[k];
      if (typeof v === 'boolean')      cand[k] = true;
      else if (typeof v === 'number')  cand[k] = 1;
      else if (typeof v === 'string')  cand[k] = '1';
      changed.push(k);
    });
    EXP_KEYS.forEach(function (k) {
      if (!(k in cand) || typeof cand[k] !== 'number') return;
      cand[k] = cand[k] > 1e12 ? EXP_MS : Math.floor(EXP_MS / 1000);
      changed.push(k);
    });
  }

  console.log('[HG] ' + (MODE === 'log' ? 'LOG' : 'PATCH') + ' ' + url.split('?')[0] +
              ' keys=' + (changed.join(',') || 'none'));

  if (MODE === 'log' || changed.length === 0) { $done({}); return; }
  $done({ body: JSON.stringify(obj) });
})();
