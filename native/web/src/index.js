/**
 * موقع دليل السعودية (saudi-guide.com)
 *  - يقدم نسخة التطبيق للمتصفح (ملفات Expo المبنية في dist)
 *  - يكتب لكل صفحة مكان/فعالية/خبر/مدينة: العنوان والوصف والصورة وبيانات قوقل (JSON-LD) قبل ما تفتح
 *  - يحوّل روابط موقع قودبابر القديم تحويل دائم 301 لصفحاتها الجديدة (نفس الأرقام)
 *  - خريطة الموقع وrobots، وملفات آبل وأندرويد اللي تخلي الروابط تفتح التطبيق
 */
const IOS_APP_ID = 'V8N7C973S7.com.saudiguide';
const APP_STORE_ID = '1595843013';
const ANDROID_PKG = 'carizmaapps.saudiguide';
const ANDROID_SHA256 = '02:48:0B:C0:B5:D1:42:CA:BA:1A:EA:1F:45:EB:38:F1:B0:40:85:7C:E9:12:A3:CD:B2:D2:2D:04:D6:BC:0D:30';
const SITE_NAME = 'دليل السعودية';
const DEFAULT_DESC = 'دليل السعودية: أماكن سياحية ومطاعم ومقاهي وفعاليات المواسم في كل مدن المملكة، مع نصايح أهل المدن وكوبونات وخطط رحلات.';

// صفحات قودبابر الثابتة → صفحاتنا
const OLD_PAGES = {
  '/trip': '/trip', '/asal-ahl-almdyn': '/community', '/guide-1': '/explore', '/cities': '/explore', '/visit-saudi': '/explore',
  '/events': '/events', '/coupons': '/coupons', '/rag-chatbot': '/ask-ai', '/profile': '/profile', '/my-spots': '/saved',
  '/add-place': '/suggest', '/submission': '/suggest', '/contact-us': '/contact', '/settings': '/settings',
  '/privacypolicy-termsofuse': '/legal?doc=privacy', '/privacy-policy': '/legal?doc=privacy', '/terms-and-conditions-sale': '/legal?doc=terms',
  '/advertise-us': '/contact?kind=ads', '/alablagh-aan-mhto-ghyr-layk': '/contact?kind=complaint',
  '/mn-nhn': '/', '/test1': '/', '/test3': '/', '/add-job': '/', '/mragaa-alasyl': '/',
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const strip = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trim() + '…' : s);
const redirect = (site, to) => new Response(null, { status: 301, headers: { Location: site + to, 'Cache-Control': 'public, max-age=86400' } });

async function api(env, path) {
  const req = new Request(env.API_URL + path, { headers: { Accept: 'application/json' } });
  let r = env.API ? await env.API.fetch(req).catch(() => null) : null;
  if (!r || r.status >= 500) r = await fetch(req, { cf: { cacheTtl: 300 } }).catch(() => null);
  if (!r || !r.ok) return null;
  return r.json().catch(() => null);
}

/* ——— بيانات كل صفحة لقوقل والمشاركة ——— */
async function pageMeta(env, path, site) {
  let m;
  if ((m = path.match(/^\/place\/(\d+)$/))) {
    const d = await api(env, `/v1/places/${m[1]}`);
    const p = d?.place; if (!p) return null;
    const desc = clip(strip(p.summary || p.body) || DEFAULT_DESC, 160);
    return {
      title: `${p.title} | ${SITE_NAME}`, desc, image: p.images?.[0] || p.thumb, url: `${site}/place/${p.id}`, h1: p.title, body: strip(p.body).slice(0, 1500),
      ld: { '@context': 'https://schema.org', '@type': 'TouristAttraction', name: p.title, description: desc, image: p.images?.slice(0, 5), url: `${site}/place/${p.id}`,
        ...(p.address ? { address: p.address } : {}), ...(p.lat && p.lng ? { geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng } } : {}), ...(p.phone ? { telephone: p.phone } : {}) },
      deep: `place/${p.id}`,
    };
  }
  if ((m = path.match(/^\/event\/(\d+)$/))) {
    const d = await api(env, `/v1/events/${m[1]}`);
    const e = d?.event; if (!e) return null;
    const desc = clip(strip(e.summary || e.body) || DEFAULT_DESC, 160);
    return {
      title: `${e.title} | فعاليات ${SITE_NAME}`, desc, image: e.images?.[0] || e.thumb, url: `${site}/event/${e.id}`, h1: e.title, body: strip(e.body).slice(0, 1500),
      ld: { '@context': 'https://schema.org', '@type': 'Event', name: e.title, description: desc, image: e.images?.slice(0, 3), startDate: e.start, ...(e.end ? { endDate: e.end } : {}),
        eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: { '@type': 'Place', name: e.address || 'السعودية', address: e.address || 'المملكة العربية السعودية', ...(e.lat && e.lng ? { geo: { '@type': 'GeoCoordinates', latitude: e.lat, longitude: e.lng } } : {}) },
        url: `${site}/event/${e.id}` },
      deep: `event/${e.id}`,
    };
  }
  if ((m = path.match(/^\/article\/(\d+)$/))) {
    const d = await api(env, `/v1/articles/${m[1]}`);
    const a = d?.article; if (!a) return null;
    const desc = clip(strip(a.summary || a.body) || DEFAULT_DESC, 160);
    return {
      title: `${a.title} | ${SITE_NAME}`, desc, image: a.images?.[0] || a.thumb, url: `${site}/article/${a.id}`, h1: a.title, body: strip(a.body).slice(0, 2000),
      ld: { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: a.title, description: desc, image: a.images?.slice(0, 3), datePublished: a.date, publisher: { '@type': 'Organization', name: SITE_NAME } },
      deep: `article/${a.id}`,
    };
  }
  if ((m = path.match(/^\/city\/([a-z0-9-]+)$/))) {
    const d = await api(env, '/v1/cities');
    const c = d?.cities?.find((x) => x.id === m[1]); if (!c) return null;
    const desc = `أفضل الأماكن السياحية والمطاعم والمقاهي والفعاليات في ${c.name}${c.count ? ` — أكثر من ${c.count} مكان` : ''} في ${SITE_NAME}.`;
    return { title: `${c.name}: وين تروح ووش تسوي | ${SITE_NAME}`, desc, image: c.cover, url: `${site}/city/${c.id}`, h1: `دليل ${c.name}`, body: desc, deep: `city/${c.id}` };
  }
  const STATIC = {
    '/': [`${SITE_NAME} | أماكن سياحية ومطاعم وفعاليات المواسم`, DEFAULT_DESC],
    '/events': [`فعاليات السعودية ومواسمها | ${SITE_NAME}`, 'كل فعاليات المواسم والحفلات والمعارض في السعودية بمواعيدها وأماكنها، مع تذكير قبلها.'],
    '/explore': [`استكشف مدن السعودية | ${SITE_NAME}`, 'تصفح مدن ومناطق المملكة وأماكنها السياحية على القائمة والخريطة.'],
    '/news': [`أخبار السعودية والمشاريع | ${SITE_NAME}`, 'آخر أخبار مشاريع السعودية والسياحة والفعاليات ورؤية 2030.'],
    '/community': [`اسأل أهل المدينة | ${SITE_NAME}`, 'اسأل أهل الديرة عن أي مكان في السعودية وخذ نصايحهم من تجربتهم.'],
    '/coupons': [`كوبونات وعروض | ${SITE_NAME}`, 'خصومات وعروض من مطاعم ومقاهي ومحلات المدن السعودية.'],
  };
  if (STATIC[path]) return { title: STATIC[path][0], desc: STATIC[path][1], url: site + (path === '/' ? '' : path) };
  return null;
}

/* ——— نحقن البيانات في صفحة التطبيق ——— */
function inject(res, meta, site) {
  const img = meta?.image || `${site}/og-default.jpg`;
  const head = [
    meta ? `<meta name="description" content="${esc(meta.desc)}">` : `<meta name="description" content="${esc(DEFAULT_DESC)}">`,
    meta?.url ? `<link rel="canonical" href="${esc(meta.url)}">` : '',
    `<meta property="og:site_name" content="${SITE_NAME}"><meta property="og:locale" content="ar_SA"><meta property="og:type" content="website">`,
    `<meta property="og:title" content="${esc(meta?.title || SITE_NAME)}"><meta property="og:description" content="${esc(meta?.desc || DEFAULT_DESC)}">`,
    `<meta property="og:image" content="${esc(img)}">${meta?.url ? `<meta property="og:url" content="${esc(meta.url)}">` : ''}`,
    `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@SAUDIA_GUIDE">`,
    // شريط آبل الرسمي «افتح في التطبيق» على سفاري الآيفون
    `<meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}${meta?.deep ? `, app-argument=saudiguide://${meta.deep}` : ''}">`,
    `<meta name="theme-color" content="#604C87">`,
    meta?.ld ? `<script type="application/ld+json">${JSON.stringify(meta.ld).replace(/</g, '\\u003c')}</script>` : '',
  ].join('');
  const noscript = meta?.h1 ? `<noscript><main dir="rtl" lang="ar"><h1>${esc(meta.h1)}</h1><p>${esc(meta.body || meta.desc)}</p><p><a href="https://apps.apple.com/app/id${APP_STORE_ID}">حمّل تطبيق دليل السعودية</a></p></main></noscript>` : '';
  return new HTMLRewriter()
    .on('html', { element(e) { e.setAttribute('lang', 'ar'); e.setAttribute('dir', 'rtl'); } })
    .on('title', { element(e) { e.setInnerContent(meta?.title || `${SITE_NAME} | أماكن سياحية ومطاعم وفعاليات المواسم`); } })
    .on('head', { element(e) { e.append(head, { html: true }); } })
    .on('body', { element(e) { if (noscript) e.prepend(noscript, { html: true }); } })
    .transform(res);
}

async function sitemap(env, site) {
  const d = await api(env, '/v1/web/sitemap');
  const day = (t) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : '');
  const u = (loc, last, pr) => `<url><loc>${site}${loc}</loc>${last ? `<lastmod>${last}</lastmod>` : ''}<priority>${pr}</priority></url>`;
  const rows = [u('/', '', '1.0'), u('/events', '', '0.9'), u('/explore', '', '0.8'), u('/community', '', '0.7'), u('/news', '', '0.7'), u('/coupons', '', '0.6')];
  (d?.cities || []).forEach((c) => rows.push(u(`/city/${c}`, '', '0.8')));
  (d?.places || []).forEach((p) => rows.push(u(`/place/${p.id}`, day(p.updated), '0.7')));
  (d?.events || []).forEach((e) => rows.push(u(`/event/${e.id}`, day(e.updated), '0.7')));
  (d?.articles || []).forEach((a) => rows.push(u(`/article/${a.id}`, day(a.updated), '0.5')));
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.join('')}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // الدومين الرسمي يستخدم www.saudi-guide.com، والرابط التجريبي يستخدم نفسه (وما يفهرسه قوقل)
    const prod = url.hostname === 'saudi-guide.com' || url.hostname.endsWith('.saudi-guide.com');
    const site = prod ? (env.SITE || 'https://www.saudi-guide.com') : url.origin;
    const path = url.pathname.replace(/\/+$/, '') || '/';

    // الدومين بدون www (أو أي اسم ثاني) → www بنفس المسار
    if (url.hostname === 'saudi-guide.com') return redirect(site, url.pathname + url.search);

    // ملفات آبل وأندرويد: الروابط تفتح التطبيق مباشرة لو كان منزّل
    if (path === '/.well-known/apple-app-site-association' || path === '/apple-app-site-association') {
      const paths = ['/place/*', '/event/*', '/article/*', '/city/*', '/question/*', '/coupon/*', '/season/*', '/*/i/*'];
      return Response.json({ applinks: { apps: [], details: [{ appIDs: [IOS_APP_ID], appID: IOS_APP_ID, paths, components: paths.map((p) => ({ '/': p })) }] }, webcredentials: { apps: [IOS_APP_ID] } });
    }
    if (path === '/.well-known/assetlinks.json') {
      return Response.json([{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: ANDROID_PKG, sha256_cert_fingerprints: [ANDROID_SHA256] } }]);
    }
    // رابط التحميل الموحد (رمز QR): يودي كل جوال لمتجره
    if (path === '/app' || path === '/download') {
      const ua = request.headers.get('User-Agent') || '';
      if (/android/i.test(ua)) return Response.redirect(`https://play.google.com/store/apps/details?id=${ANDROID_PKG}`, 302);
      if (/iphone|ipad|ipod/i.test(ua)) return Response.redirect(`https://apps.apple.com/app/id${APP_STORE_ID}`, 302);
      return Response.redirect(`${site}/`, 302);
    }
    if (path === '/robots.txt') return new Response(prod ? `User-agent: *\nAllow: /\nDisallow: /panel\n\nSitemap: ${site}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    if (path === '/sitemap.xml' || path === '/index-sitemap.xml') return sitemap(env, site);
    if (path === '/privacy' || path === '/terms') return redirect(site, `/legal?doc=${path.slice(1)}`);

    // روابط قودبابر القديمة: /{القسم}/i/{الرقم}/{الاسم} → صفحتنا الجديدة
    let m = path.match(/^\/[^/]+\/i\/(\d+)(\/|$)/);
    if (m) {
      const r = await api(env, `/v1/web/resolve/${m[1]}`);
      if (r?.type) return redirect(site, `/${r.type}/${m[1]}`);
      return redirect(site, '/');
    }
    if (OLD_PAGES[path]) return redirect(site, OLD_PAGES[path]);
    // صفحة مدينة قديمة (/medina) → /city/medina
    if ((m = path.match(/^\/([a-z]+(?:-[a-z]+)*)$/)) && !['events', 'explore', 'community', 'trip', 'profile', 'search', 'coupons', 'saved', 'map', 'planner', 'plus', 'contact', 'legal', 'login', 'inbox', 'settings', 'more', 'passport', 'guide', 'ask', 'ask-ai', 'suggest', 'welcome'].includes(m[1])) {
      const d = await api(env, '/v1/cities');
      if (d?.cities?.some((c) => c.id === m[1])) return redirect(site, `/city/${m[1]}`);
    }

    // الملفات الثابتة (js, css, صور) مباشرة
    if (/\.[a-z0-9]{2,5}$/i.test(path)) return env.ASSETS.fetch(request);

    // صفحات التطبيق: نجيب index.html ونحقن فيها بيانات الصفحة
    const shell = await env.ASSETS.fetch(new Request(new URL('/', url), { headers: request.headers }));
    const meta = await pageMeta(env, path, site).catch(() => null);
    const res = inject(shell, meta, site);
    const h = new Headers(res.headers);
    h.set('Content-Type', 'text/html; charset=utf-8');
    h.set('Cache-Control', 'public, max-age=300');
    if (!prod) h.set('X-Robots-Tag', 'noindex');
    return new Response(res.body, { status: 200, headers: h });
  },
};
