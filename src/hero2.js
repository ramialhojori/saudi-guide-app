// Builds the redesigned home hero (top area + quick actions) and slider restyle, previews it in an iframe.
(function(){
var v=window.V, H=window.HREF;
var a=v.indexOf('<header class="hdr"'), n=v.indexOf('<nav class="qa"'), b=v.indexOf('</nav>',n)+6;
var I={
 sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
 search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
 near:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21 3 3 10.5l7.5 3 3 7.5z"/></svg>',
 dice:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/></svg>',
 heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/></svg>',
 cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none"/></svg>',
 news:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>'
};
var esc=function(s){return String(s).replace(/"/g,'&quot;');};
var html=
'<header class="g2" id="top2">'+
 '<button class="tbtn" id="themeBtn" type="button" aria-hidden="true" tabindex="-1" hidden></button>'+
 '<div class="g2-meta"><small class="g2-date" id="dateTxt"></small><span class="g2-wx" id="wx">'+I.sun+'<span id="wxTxt">—</span></span></div>'+
 '<p class="g2-hi"><span id="greet">أهلًا</span></p>'+
 '<h1>وين وجهتك الجاية؟</h1>'+
 '<div class="g2-s"><a class="g2-search" href="'+esc(H.search)+'" aria-label="افتح صفحة البحث">'+I.search+'<span class="ph">ابحث عن مكان، مدينة، مطعم…</span><span class="ct">+1500 مكان</span></a><div class="sug" id="sug"></div></div>'+
 '<div class="g2-sadu" aria-hidden="true"></div>'+
'</header>'+
'<nav class="g2-qa" aria-label="اختصارات">'+
 '<button class="g2-qb" type="button" id="aNear" style="--t:#FDE8D6;--c:#C9600F"><span class="i">'+I.near+'</span><span id="nearTxt">قريب مني</span></button>'+
 '<button class="g2-qb" type="button" data-surprise style="--t:#FBE2EA;--c:#B83F60"><span class="i">'+I.dice+'</span>فاجئني</button>'+
 '<a class="g2-qb" id="aFav" href="'+esc(H.fav)+'" style="--t:#EEE6F8;--c:#604C87"><span class="i">'+I.heart+'</span>رحلتي</a>'+
 '<a class="g2-qb" href="'+esc(H.ev)+'" style="--t:#E5E7F2;--c:#373D63"><span class="i">'+I.cal+'</span>فعاليات</a>'+
 '<a class="g2-qb" href="'+esc(H.news)+'" style="--t:#DFF0F9;--c:#1B6E9B"><span class="i">'+I.news+'</span>الأخبار</a>'+
'</nav>';
var dia="data:image/svg+xml,"+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='56' height='12' viewBox='0 0 56 12'><path d='M14 2l4 4-4 4-4-4z' fill='#F89743'/><path d='M42 2l4 4-4 4-4-4z' fill='#EB839B'/><path d='M0 5.4h7M21 5.4h14M49 5.4h7' stroke='#7E68A6' stroke-width='1.2'/></svg>");
var teeth="data:image/svg+xml,"+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='28' height='12' viewBox='0 0 28 12'><path d='M0 0h28L14 12z' fill='#604C87'/></svg>");
var css='<style id="g2css">@import url("https://fonts.googleapis.com/css2?family=Readex+Pro:wght@500;600;700&display=swap");'+
'.g2{position:relative;background:#604C87;color:#fff;padding:4px 16px 0;margin-top:-1px}'+
'.g2-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:30px}'+
'.g2-date{font-size:13px;color:#D8D0EA;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
'.g2-wx{flex:none;display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;background:rgba(255,255,255,.1);font:600 13px/1.2 "IBM Plex Sans Arabic",sans-serif;color:#fff}'+
'.g2-wx svg{width:16px;height:16px;color:#FFC27A}'+
'.g2-hi{margin:20px 0 4px;font:500 17px/1.4 "Readex Pro","IBM Plex Sans Arabic",sans-serif;color:#F9B57C}'+
'.g2 h1{margin:0;font:700 31px/1.22 "Readex Pro","IBM Plex Sans Arabic",sans-serif;color:#fff;letter-spacing:0}'+
'.g2-s{position:relative;margin-top:20px}'+
'.g2-search{display:flex;align-items:center;gap:10px;height:54px;padding-inline:16px 8px;background:#fff;border-radius:16px;text-decoration:none;box-shadow:0 10px 24px -12px rgba(28,14,60,.55)}'+
'.g2-search svg{width:22px;height:22px;flex:none;color:#604C87}'+
'.g2-search .ph{flex:1;min-width:0;font-size:15px;color:#6B6F8E;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
'.g2-search .ct{flex:none;background:#F2ECF9;color:#604C87;font-weight:700;font-size:12px;padding:8px 10px;border-radius:11px}'+
'.g2-sadu{position:relative;height:12px;margin:24px -16px 0;background:#604C87 url("'+dia+'") repeat-x center/56px 12px}'+
'.g2-sadu:after{content:"";position:absolute;left:0;right:0;top:100%;height:12px;background:url("'+teeth+'") repeat-x center top/28px 12px}'+
'.g2-qa{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;padding:28px 10px 4px}'+
'.g2-qb{display:flex;flex-direction:column;align-items:center;gap:8px;background:none;border:0;padding:0;margin:0;font:600 12.5px/1.25 "IBM Plex Sans Arabic",sans-serif;color:#373D63;text-decoration:none;cursor:pointer;-webkit-tap-highlight-color:transparent}'+
'.g2-qb .i{width:58px;height:58px;border-radius:19px;display:grid;place-items:center;background:var(--t);color:var(--c);transition:transform .15s}'+
'.g2-qb:active .i{transform:scale(.92)}'+
'.g2-qb svg{width:26px;height:26px}'+
'.g2-qb:focus-visible{outline:none}.g2-qb:focus-visible .i,.g2-search:focus-visible{outline:2px solid #F89743;outline-offset:2px}'+
'#hero,#hero .slide{height:380px!important}'+
'#hero .slide:after{background:linear-gradient(180deg,rgba(28,18,52,.25) 0,rgba(28,18,52,0) 22%,rgba(28,18,52,0) 42%,rgba(36,24,66,.92) 100%)!important}'+
'#hero .hlabel{background:#F89743!important;color:#2E1A07!important;font:700 12px/1 "IBM Plex Sans Arabic",sans-serif!important;padding:7px 11px!important;border-radius:10px!important;backdrop-filter:none!important;border:0!important}'+
'#hero .cap h2{font-family:"Readex Pro","IBM Plex Sans Arabic",sans-serif!important;font-weight:700!important;letter-spacing:0!important}'+
'#hero .cap small{color:#F9B57C!important}'+
'#hero .go{background:#fff!important;color:#4D3B70!important;border:0!important;box-shadow:none!important}'+
'@media (prefers-reduced-motion:reduce){.g2-qb .i{transition:none}}'+
'</style>';
var nv=v.slice(0,a)+html+v.slice(b);
nv=nv.replace('</head>',css+'</head>');
nv=nv.replace("h<12?'صباح الخير'","(h>=4&&h<12)?'صباح الخير'");
window.NV=nv;
})();
