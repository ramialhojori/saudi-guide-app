/* قياس الاستخدام: التطبيق يرسل دفعات أحداث بسيطة كل شوي، ونخزنها عدّادات يومية.
   ما نخزن أي معلومة شخصية: معرّف الجهاز رقم عشوائي يولده التطبيق، والبحث نخزنه كلمات مجمّعة. */

const METRICS = new Set(['open', 'place', 'event', 'search', 'search_empty', 'coupon', 'share', 'directions', 'trip_add', 'city', 'article', 'screen']);
export const dayMk = (t = Date.now()) => new Date(t + 3 * 3600e3).toISOString().slice(0, 10);

export async function trackRoute(request, env, J) {
  const b = await request.json().catch(() => ({}));
  const dev = String(b.device || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40);
  const events = (Array.isArray(b.events) ? b.events : []).slice(0, 100);
  if (!dev || !events.length) return J({ ok: true });
  const day = dayMk();
  const platform = ['ios', 'android', 'web'].includes(b.platform) ? b.platform : 'other';
  const agg = new Map();
  const add = (m, k, n = 1) => { const key = m + '\u0000' + k; agg.set(key, (agg.get(key) || 0) + n); };
  for (const e of events) {
    const m = String(e?.e || '');
    if (!METRICS.has(m)) continue;
    let k = '';
    if (['place', 'event', 'coupon', 'article'].includes(m)) k = String(+e.id || '');
    else if (m === 'search' || m === 'search_empty') k = String(e.q || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 40);
    else if (m === 'city') k = String(e.id || '').slice(0, 30);
    else if (m === 'screen') k = String(e.id || '').replace(/[^a-z0-9/_-]/gi, '').slice(0, 40);
    else if (m === 'share' || m === 'directions' || m === 'trip_add') k = String(+e.id || '');
    if (['place', 'event', 'coupon', 'article'].includes(m) && !k) continue;
    if ((m === 'search' || m === 'search_empty') && k.length < 2) continue;
    add(m, k);
  }
  const stmts = [env.DB.prepare('INSERT OR IGNORE INTO active_devices (day,device,platform) VALUES (?,?,?)').bind(day, dev, platform)];
  if (b.version) stmts.push(env.DB.prepare('INSERT INTO stats_daily (day,metric,k,n) VALUES (?,?,?,0) ON CONFLICT(day,metric,k) DO NOTHING').bind(day, 'version', String(b.version).slice(0, 12)));
  for (const [key, n] of agg) {
    const [m, k] = key.split('\u0000');
    stmts.push(env.DB.prepare('INSERT INTO stats_daily (day,metric,k,n) VALUES (?,?,?,?) ON CONFLICT(day,metric,k) DO UPDATE SET n=n+excluded.n').bind(day, m, k, n));
  }
  await env.DB.batch(stmts.slice(0, 100));
  return J({ ok: true });
}

/** لوحة القيادة: كل اللي يحتاجه مدير التطبيق في صفحة وحدة */
export async function dashboard(env) {
  const t = Math.floor(Date.now() / 1000), D = 86400;
  const today = dayMk(), d7 = dayMk(Date.now() - 6 * D * 1000), d14 = dayMk(Date.now() - 13 * D * 1000), d30 = dayMk(Date.now() - 29 * D * 1000);
  const q = (sql, ...a) => env.DB.prepare(sql).bind(...a);
  const [k, act, series, opens, topPlaces, topSearch, emptySearch, topCities, platforms, upcoming, endingDrafts, recent, lastSync] = await env.DB.batch([
    q(`SELECT
      (SELECT COUNT(*) FROM users WHERE deleted=0) users,
      (SELECT COUNT(*) FROM users WHERE deleted=0 AND created>=?1) users7, (SELECT COUNT(*) FROM users WHERE deleted=0 AND created>=?2 AND created<?1) usersPrev7,
      (SELECT COUNT(*) FROM places WHERE deleted=0) places, (SELECT COUNT(*) FROM places WHERE deleted=2) placeDrafts,
      (SELECT COUNT(*) FROM events WHERE deleted=0 AND COALESCE(NULLIF("end",''),start)>=?3) events, (SELECT COUNT(*) FROM events WHERE deleted=2) eventDrafts,
      (SELECT COUNT(*) FROM events WHERE deleted=2 AND (thumb IS NULL OR thumb='')) eventDraftsNoImg,
      (SELECT COUNT(*) FROM places WHERE deleted=0 AND (thumb IS NULL OR thumb='')) noPhoto, (SELECT COUNT(*) FROM places WHERE deleted=0 AND (lat IS NULL OR lat=0)) noGeo,
      (SELECT COUNT(*) FROM posts WHERE status='visible' AND created>=?1) posts7, (SELECT COUNT(*) FROM answers WHERE status='visible' AND created>=?1) answers7,
      (SELECT COUNT(*) FROM posts p WHERE p.status='visible' AND p.kind='question' AND p.answers=0) unanswered,
      (SELECT COUNT(*) FROM reviews WHERE created>=?1) reviews7, (SELECT COUNT(*) FROM visits WHERE created>=?1) visits7, (SELECT COUNT(*) FROM redemptions WHERE created>=?1) redeems7,
      (SELECT COUNT(*) FROM posts WHERE reports>0 AND hidden_by IS NOT 'admin') + (SELECT COUNT(*) FROM answers WHERE reports>0 AND hidden_by IS NOT 'admin') reported,
      (SELECT COUNT(*) FROM merchants WHERE status='pending') merchantsPending, (SELECT COUNT(*) FROM coupons WHERE status='pending') couponsPending,
      (SELECT COUNT(*) FROM coupon_reports WHERE status='pending') creports, (SELECT COUNT(*) FROM place_photos WHERE status='pending') photosPending,
      (SELECT COUNT(*) FROM suggestions WHERE status='pending') suggPending, (SELECT COUNT(*) FROM guide_requests WHERE status='pending') guidesPending,
      (SELECT COUNT(*) FROM devices) pushDevices`, t - 7 * D, t - 14 * D, new Date().toISOString()),
    q(`SELECT (SELECT COUNT(*) FROM active_devices WHERE day=?1) today, (SELECT COUNT(DISTINCT device) FROM active_devices WHERE day>=?2) d7,
      (SELECT COUNT(DISTINCT device) FROM active_devices WHERE day>=?3 AND day<?2) prev7, (SELECT COUNT(DISTINCT device) FROM active_devices WHERE day>=?4) d30,
      (SELECT COUNT(DISTINCT device) FROM active_devices) all_time`, today, d7, d14, d30),
    q('SELECT day, COUNT(*) n FROM active_devices WHERE day>=? GROUP BY day', d30),
    q("SELECT day, SUM(n) n FROM stats_daily WHERE metric='open' AND day>=? GROUP BY day", d30),
    q(`SELECT s.k id, SUM(s.n) n, p.title, p.city FROM stats_daily s LEFT JOIN places p ON p.id=CAST(s.k AS INTEGER) WHERE s.metric='place' AND s.day>=? GROUP BY s.k ORDER BY n DESC LIMIT 8`, d7),
    q("SELECT k, SUM(n) n FROM stats_daily WHERE metric='search' AND day>=? GROUP BY k ORDER BY n DESC LIMIT 10", d30),
    q("SELECT k, SUM(n) n FROM stats_daily WHERE metric='search_empty' AND day>=? GROUP BY k ORDER BY n DESC LIMIT 10", d30),
    q("SELECT k, SUM(n) n FROM stats_daily WHERE metric='city' AND day>=? GROUP BY k ORDER BY n DESC LIMIT 8", d30),
    q('SELECT platform k, COUNT(DISTINCT device) n FROM active_devices WHERE day>=? GROUP BY platform', d30),
    q(`SELECT id, title, city, start, thumb FROM events WHERE deleted=0 AND start>=?1 AND start<?2 ORDER BY start LIMIT 6`, new Date().toISOString(), new Date(Date.now() + 7 * D * 1000).toISOString()),
    q(`SELECT id, title, city, start FROM events WHERE deleted=2 AND start>=?1 AND start<?2 ORDER BY start LIMIT 6`, new Date().toISOString(), new Date(Date.now() + 10 * D * 1000).toISOString()),
    q(`SELECT p.id, p.kind, p.text, p.created, u.name FROM posts p JOIN users u ON u.id=p.user_id WHERE p.status='visible' ORDER BY p.id DESC LIMIT 5`),
    q('SELECT * FROM sync_log ORDER BY id DESC LIMIT 1'),
  ]);
  const fill = (rows) => { const m = Object.fromEntries(rows.map((r) => [r.day, r.n])); return Array.from({ length: 30 }, (_, i) => m[dayMk(Date.now() - (29 - i) * D * 1000)] || 0); };
  return {
    kpi: k.results[0], active: act.results[0], series: { active: fill(series.results), opens: fill(opens.results), from: d30 },
    topPlaces: topPlaces.results, topSearch: topSearch.results, emptySearch: emptySearch.results, topCities: topCities.results, platforms: platforms.results,
    upcoming: upcoming.results, draftsSoon: endingDrafts.results, recent: recent.results, lastSync: lastSync.results[0] || null,
  };
}
