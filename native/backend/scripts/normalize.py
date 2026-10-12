#!/usr/bin/env python3
"""
تحويل محتوى قودبابر (أماكن + فعاليات + أخبار) لصيغة دليل السعودية الموحّدة.

المدخل: ملف JSON فيه {maps, events, articles} بنفس شكل واجهة قودبابر (cms_list_*).
المخرجات:
  seed/content.json   المحتوى كامل (للسيرفر)
  seed/seed.sql       أوامر إدخال لقاعدة D1 (أول تعبئة)
  ../app/src/data/snapshot.json  نسخة خفيفة مدمجة في التطبيق (تشتغل بدون نت ووقت التطوير)

الاستخدام:
  python3 scripts/normalize.py /path/to/raw.json
نفس منطق التحويل موجود في الوركر (src/sync.js) للمزامنة التلقائية — أي تعديل هنا يتعدّل هناك.
"""
import json
import os
import re
import sys
from html import unescape

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CDN = "https://cmsphoto.ww-cdn.com/"

# المدن والمناطق: المعرّف = رابط القسم في الموقع، section = رقم القسم في قودبابر
CITIES = [
    # id, name, gb section id, color, lat, lng, kind(city/region), cover image (relative to CDN)
    ("riyadh", "الرياض", 45404644, "#8E65AB", 24.7136, 46.6753, "city", "resizeapi/de20e8cafb949ee90e6cc4ccfdf83addf3ab0149/1200/"),
    ("medina", "المدينة المنورة", 45455682, "#F89743", 24.4672, 39.6111, "city", "superstatic/2892882/art/default/98094402-68305608.jpg"),
    ("makkah-region", "مكة المكرمة", 45702588, "#EB839B", 21.3891, 39.8579, "city", "resizeapi/887a593cecf56caf3fd828bc4b97ebc2a829db57/1200/"),
    ("alula", "العلا", 45486429, "#62B9E8", 26.6086, 37.9232, "city", "superstatic/2892882/art/default/98083021-68299170.jpg"),
    ("asir-region", "عسير", 45408972, "#604C87", 18.2164, 42.5053, "region", "resizeapi/03ab39b949bbf6f40c591740125b291c425b9165/1200/"),
    ("taif", "الطائف", 45485480, "#EFA56C", 21.2703, 40.4158, "city", "resizeapi/35da96072669af0065e9a563a444b090f1897b9e/1200/"),
    ("jeddah", "جدة", 45455674, "#BC77B2", 21.5433, 39.1728, "city", None),
    ("jizan", "جازان", 45455689, "#8E65AB", 16.8892, 42.5511, "region", None),
    ("abha", "أبها", 45603642, "#F89743", 18.2164, 42.5053, "city", None),
    ("diriyah", "الدرعية", 72083169, "#EB839B", 24.7343, 46.5747, "city", None),
    ("yanbu", "ينبع", 45455678, "#62B9E8", 24.0895, 38.0618, "city", None),
    ("albaha", "الباحة", 45455684, "#604C87", 20.0129, 41.4677, "region", None),
    ("riyadh-region", "منطقة الرياض", 46147884, "#EFA56C", 24.15, 47.31, "region", None),
    ("tabuk-region", "تبوك", 45455692, "#BC77B2", 28.3835, 36.5662, "region", None),
    ("qassim-region", "القصيم", 45603675, "#8E65AB", 26.326, 43.975, "region", None),
    ("eastern-region", "المنطقة الشرقية", 46559136, "#F89743", 26.4207, 50.0888, "region", None),
    ("umluj", "أملج والبحر الأحمر", 45603422, "#EB839B", 25.0213, 37.2685, "city", None),
    ("hail", "حائل", 45702293, "#62B9E8", 27.5114, 41.7208, "region", None),
    ("aljawf-region", "الجوف", 45483525, "#604C87", 29.9697, 40.2064, "region", None),
    ("najran", "نجران", 45702616, "#EFA56C", 17.4924, 44.1277, "region", None),
    ("northern-border", "الحدود الشمالية", 45991296, "#BC77B2", 30.9753, 41.0381, "region", None),
]
SECTION_TO_CITY = {c[2]: c[0] for c in CITIES}

# تصنيفات قودبابر كثيرة ومتشابهة (91 تصنيف) — نجمعها في 8 أنواع ثابتة للتطبيق
KIND_OF = {
    "معالم إسلامية": "islamic",
    "التراث والثقافة": "heritage", "التاريخ والثقافة": "heritage",
    "الشلالات والأودية": "nature", "مزارع": "nature", "آبار ومزارع": "nature",
    "أماكن سياحية": "sights", "أماكن للزيارة": "sights", "سياحة وترفيه": "sights",
    "ترفيه واستجمام": "fun", "موسم الرياض": "fun",
    "مطاعم": "food", "إفطار": "food", "المطاعم والمقاهي": "food", "مطاعم وكافيهات": "food",
    "كافيهات": "cafe", "مقاهي": "cafe", "مخبوزات": "cafe", "مقاهي ومخبوزات": "cafe",
    "أسواق": "shopping", "أسواق شعبية": "shopping", "المولات": "shopping", "التسوق": "shopping",
}
KINDS = [
    ("sights", "أماكن سياحية"), ("heritage", "تراث وثقافة"), ("islamic", "معالم إسلامية"),
    ("nature", "طبيعة وأودية"), ("fun", "ترفيه"), ("food", "مطاعم"), ("cafe", "مقاهي"), ("shopping", "تسوق"),
]


def hires(u, w=1200):
    """أعلى جودة متاحة من صور قودبابر (الصورة المصغّرة 314 بكسل فقط)"""
    if not u:
        return ""
    u = re.sub(r"(resizeapi/[0-9a-f]{40}/)\d+/-?\d+/", r"\g<1>%d/" % w, u)
    u = u.replace("/art/large_16_9/", "/art/default/").replace("/art/large_x2_16_9/", "/art/default/")
    return u


def thumb(u):
    return hires(u, 480) if "resizeapi" in (u or "") else (u or "").replace("/art/default/", "/art/large_16_9/")


def split_title(t):
    """«English - عربي» → (عربي, English)"""
    parts = [p.strip() for p in re.split(r"\s[-|–]\s|\s?\|\s?", t or "") if p.strip()]
    ar = [p for p in parts if re.search(r"[؀-ۿ]", p)]
    en = [p for p in parts if not re.search(r"[؀-ۿ]", p)]
    return (" - ".join(ar) if ar else (t or "").strip()), (" - ".join(en))


def plain(html):
    t = re.sub(r"<br\s*/?>|</p>", "\n", html or "")
    t = re.sub(r"<[^>]+>", "", t)
    t = unescape(t)
    return re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n", t)).strip()


def clean_body(html):
    """نخلي النص وروابطه ونشيل الصور (تنعرض في المعرض فوق)"""
    h = re.sub(r'<div class="photo[^"]*"[^>]*>.*?</div>', "", html or "", flags=re.S)
    h = re.sub(r'<br class="clear"\s*/?>', "", h)
    h = re.sub(r'\sstyle="[^"]*"', "", h)
    return h.strip()


def images_of(x):
    out = []
    for im in x.get("images") or []:
        u = im.get("url") or ""
        if u:
            out.append(hires(u))
    if not out and x.get("largeThumbnail"):
        out.append(hires(x["largeThumbnail"]))
    if not out and x.get("thumbnail"):
        out.append(hires(x["thumbnail"]))
    return out


def search_key(*parts):
    t = " ".join(parts).lower()
    t = re.sub(r"[\u064B-\u0652\u0640]", "", t)
    t = re.sub(r"[أإآٱ]", "ا", t).replace("ة", "ه").replace("ى", "ي")
    t = re.sub(r"(^|\s)ال", r"\1", t)
    t = re.sub(r"[-|_,.،]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def km(a, b, c, d):
    import math
    R = 6371
    x = math.radians(c - a); y = math.radians(d - b)
    h = math.sin(x / 2) ** 2 + math.cos(math.radians(a)) * math.cos(math.radians(c)) * math.sin(y / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(h), math.sqrt(1 - h))


def nearest_city(lat, lng):
    if not lat or not lng:
        return None
    cands = [c for c in CITIES if c[0] not in ("diriyah", "riyadh-region", "asir-region")]  # الفعاليات تُنسب للمدينة الكبيرة
    best = min(cands, key=lambda c: km(lat, lng, c[4], c[5]))
    return best[0] if km(lat, lng, best[4], best[5]) < 150 else None


def norm_place(x):
    sec = (x.get("sections") or [{}])[0]
    city = SECTION_TO_CITY.get(sec.get("id"))
    if not city:
        return None
    cats = [c["title"] for c in sec.get("categories", []) if c["title"] != "الكل"]
    kinds = sorted({KIND_OF[c] for c in cats if c in KIND_OF})
    ar, en = split_title(x.get("title"))
    imgs = images_of(x)
    summary = (x.get("meta") or {}).get("description") or plain(x.get("summary"))[:200]
    return {
        "id": x["id"], "city": city, "title": ar, "title_en": en, "slug": x.get("slug") or "",
        "cats": cats, "kinds": kinds, "summary": summary, "body": clean_body(x.get("content")),
        "images": imgs, "thumb": thumb(x.get("thumbnail") or (imgs[0] if imgs else "")),
        "lat": x.get("latitude") or None, "lng": x.get("longitude") or None,
        "address": x.get("address") or "", "phone": x.get("phoneNumber") or "",
        "website": x.get("website") or "", "email": x.get("email") or "",
        "url": x.get("url") or "", "comments": bool(x.get("commentsEnabled")),
        "premium": x.get("accessTier") == "premium",
        "search": search_key(ar, en, " ".join(cats)),
    }


def utc(d):
    """كل التواريخ UTC موحّدة (قودبابر يرسلها بتوقيت باريس)"""
    if not d:
        return ""
    from datetime import datetime, timezone
    try:
        return datetime.fromisoformat(d).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    except ValueError:
        return ""


def norm_event(x):
    sec = (x.get("sections") or [{}])[0]
    cats = [c["title"] for c in sec.get("categories", []) if c["title"] != "الكل"]
    imgs = images_of(x)
    return {
        "id": x["id"], "title": x.get("title") or "", "summary": (x.get("meta") or {}).get("description") or plain(x.get("summary"))[:200],
        "body": clean_body(x.get("content")), "images": imgs, "thumb": thumb(x.get("thumbnail") or (imgs[0] if imgs else "")),
        "start": utc(x.get("sortDate") or x.get("date")), "end": utc(x.get("endDate")), "all_day": bool(x.get("allDay")),
        "cats": cats, "city": nearest_city(x.get("latitude"), x.get("longitude")),
        "lat": x.get("latitude") or None, "lng": x.get("longitude") or None, "address": x.get("address") or "",
        "tickets": x.get("urlShop") or "", "link": x.get("urlEvent") or "", "url": x.get("url") or "",
    }


def norm_article(x):
    sec = (x.get("sections") or [{}])[0]
    cats = [c["title"] for c in sec.get("categories", []) if c["title"] != "الكل"]
    imgs = images_of(x)
    return {
        "id": x["id"], "title": x.get("title") or "", "author": x.get("author") or "", "date": utc(x.get("date")),
        "summary": (x.get("meta") or {}).get("description") or plain(x.get("summary"))[:200],
        "body": clean_body(x.get("content")), "images": imgs, "thumb": thumb(x.get("thumbnail") or (imgs[0] if imgs else "")),
        "cats": cats, "section": sec.get("title") or "", "url": x.get("url") or "",
    }


def city_rows(places):
    by = {}
    for p in places:
        by.setdefault(p["city"], []).append(p)
    rows = []
    for i, (cid, name, sec, color, lat, lng, kind, cover) in enumerate(CITIES):
        ps = by.get(cid, [])
        img = (CDN + cover) if cover else next((p["images"][0] for p in ps if p["images"]), "")
        rows.append({"id": cid, "name": name, "gb_section": sec, "color": color, "lat": lat, "lng": lng,
                     "kind": kind, "cover": img, "count": len(ps), "order": i})
    return rows


def sql_str(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (list, dict)):
        v = json.dumps(v, ensure_ascii=False)
    return "'" + str(v).replace("'", "''") + "'"


def main(src):
    raw = json.load(open(src, encoding="utf-8"))
    places = [p for p in (norm_place(x) for x in raw.get("maps", [])) if p]
    events = [norm_event(x) for x in raw.get("events", [])]
    articles = [norm_article(x) for x in raw.get("articles", [])]
    cities = city_rows(places)
    content = {"cities": cities, "kinds": [{"id": k, "name": n} for k, n in KINDS],
               "places": places, "events": events, "articles": articles}

    os.makedirs(os.path.join(ROOT, "seed"), exist_ok=True)
    json.dump(content, open(os.path.join(ROOT, "seed", "content.json"), "w", encoding="utf-8"), ensure_ascii=False)

    lines = ["-- تعبئة أولى لقاعدة دليل السعودية من محتوى قودبابر (مولّد تلقائياً — لا تعدّله يدوياً)"]
    for c in cities:
        lines.append("INSERT OR REPLACE INTO cities (id,name,gb_section,color,lat,lng,kind,cover,sort) VALUES (%s);" % ",".join(
            sql_str(c[k]) for k in ["id", "name", "gb_section", "color", "lat", "lng", "kind", "cover", "order"]))
    pk = ["id", "city", "title", "title_en", "slug", "cats", "kinds", "summary", "body", "images", "thumb", "lat", "lng",
          "address", "phone", "website", "email", "url", "comments", "premium", "search"]
    for p in places:
        lines.append("INSERT OR REPLACE INTO places (%s,updated) VALUES (%s,strftime('%%s','now'));" % (",".join(pk), ",".join(sql_str(p[k]) for k in pk)))
    ek = ["id", "title", "summary", "body", "images", "thumb", "start", "end", "all_day", "cats", "city", "lat", "lng", "address", "tickets", "link", "url"]
    for e in events:
        lines.append("INSERT OR REPLACE INTO events (%s,updated) VALUES (%s,strftime('%%s','now'));" % (",".join('"end"' if k == "end" else k for k in ek), ",".join(sql_str(e[k]) for k in ek)))
    ak = ["id", "title", "author", "date", "summary", "body", "images", "thumb", "cats", "section", "url"]
    for a in articles:
        lines.append("INSERT OR REPLACE INTO articles (%s,updated) VALUES (%s,strftime('%%s','now'));" % (",".join(ak), ",".join(sql_str(a[k]) for k in ak)))
    open(os.path.join(ROOT, "seed", "seed.sql"), "w", encoding="utf-8").write("\n".join(lines) + "\n")

    # نسخة خفيفة للتطبيق: بدون نصوص كاملة
    lite = {
        "v": 1,
        "cities": cities,
        "kinds": content["kinds"],
        "places": [{"id": p["id"], "c": p["city"], "t": p["title"], "k": p["kinds"], "cat": (p["cats"] or [""])[0],
                    "th": p["thumb"], "img": (p["images"] or [""])[0], "s": p["summary"][:160],
                    "lat": p["lat"], "lng": p["lng"]} for p in places],
        "events": [{k: e[k] for k in ["id", "title", "summary", "thumb", "start", "end", "address", "tickets", "cats", "city", "lat", "lng"]} for e in events],
        "articles": [{k: a[k] for k in ["id", "title", "author", "date", "summary", "thumb", "section"]} for a in articles[:60]],
    }
    app_data = os.path.join(os.path.dirname(ROOT), "app", "src", "data")
    os.makedirs(app_data, exist_ok=True)
    json.dump(lite, open(os.path.join(app_data, "snapshot.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

    print("cities", len(cities), "places", len(places), "events", len(events), "articles", len(articles))
    print("no image:", sum(1 for p in places if not p["images"]))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/home/claude/gbexport/raw.json")
