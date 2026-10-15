/**
 * مساعدات موقع الويب (saudi-guide.com):
 *  GET /v1/web/config        إعدادات الدخول بقوقل/آبل للمتصفح (معرّفات عامة، مو أسرار)
 *  GET /v1/web/resolve/:id   رقم من رابط قودبابر القديم → مكان أو فعالية أو خبر (للتحويل 301)
 *  GET /v1/web/sitemap       كل الصفحات المنشورة لخريطة الموقع
 */
export async function webApiRoute(p, env, J) {
  if (!p.startsWith('/v1/web/')) return null;
  if (p === '/v1/web/config') {
    return J({
      googleWebClientId: env.GOOGLE_WEB_CLIENT_ID || '',
      appleServiceId: env.APPLE_SERVICE_ID || '',
      appStoreId: '1595843013',
      androidPackage: 'carizmaapps.saudiguide',
    }, 200, 300);
  }
  let m = p.match(/^\/v1\/web\/resolve\/(\d+)$/);
  if (m) {
    const id = +m[1];
    const pl = await env.DB.prepare('SELECT id FROM places WHERE id=? AND deleted=0').bind(id).first();
    if (pl) return J({ type: 'place', id }, 200, 3600);
    const ev = await env.DB.prepare('SELECT id FROM events WHERE id=? AND deleted=0').bind(id).first();
    if (ev) return J({ type: 'event', id }, 200, 3600);
    const ar = await env.DB.prepare('SELECT id FROM articles WHERE id=? AND deleted=0').bind(id).first();
    if (ar) return J({ type: 'article', id }, 200, 3600);
    return J({ type: null }, 404, 600);
  }
  if (p === '/v1/web/sitemap') {
    const [pl, ev, ar, ci] = await Promise.all([
      env.DB.prepare('SELECT id, updated FROM places WHERE deleted=0').all(),
      env.DB.prepare("SELECT id, updated FROM events WHERE deleted=0 AND COALESCE(NULLIF(\"end\",''),start) >= ?").bind(new Date(Date.now() - 30 * 86400e3).toISOString()).all(),
      env.DB.prepare('SELECT id, updated FROM articles WHERE deleted=0 ORDER BY date DESC LIMIT 500').all(),
      env.DB.prepare('SELECT id FROM cities').all(),
    ]);
    return J({ places: pl.results, events: ev.results, articles: ar.results, cities: ci.results.map((c) => c.id) }, 200, 3600);
  }
  return null;
}
