// Adds an "اسأل أهل المدينة" entry card to the home page, after the weekly picks slider.
(function(){
var v=window.V;
var url='https://www.saudi-guide.com/asal-ahl-almdyn';
var bubble='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M20 12.5a7.5 7.5 0 0 1-11 6.6L4 20l1-4.3A7.5 7.5 0 1 1 20 12.5z"/><path d="M10 10.2a2.2 2.2 0 1 1 3 2c-.6.3-1 .8-1 1.4v.3"/><circle cx="12" cy="16.6" r=".6" fill="currentColor"/></svg>';
var card='<a class="askc" id="askCard" href="'+url+'">'+
 '<span class="askc-i">'+bubble+'</span>'+
 '<span class="askc-b"><b>اسأل أهل المدينة</b><span id="askLast">عندك سؤال عن مدينة؟ أهلها يجاوبونك</span></span>'+
 '<span class="askc-go">اسأل</span></a>';
var css='<style id="askcss">'+
'.askc{display:flex;align-items:center;gap:12px;margin:18px 16px 4px;padding:14px;border-radius:20px;background:#fff;text-decoration:none;color:#373D63;border:1px solid #E7E0F1;position:relative;overflow:hidden}'+
'.askc:before{content:"";position:absolute;inset-inline-start:0;top:0;bottom:0;width:5px;background:linear-gradient(#F89743,#EB839B)}'+
'.askc-i{flex:none;width:48px;height:48px;border-radius:15px;display:grid;place-items:center;background:#EEE6F8;color:#604C87}'+
'.askc-i svg{width:26px;height:26px}'+
'.askc-b{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}'+
'.askc-b b{font:700 16px/1.3 "Readex Pro","IBM Plex Sans Arabic",sans-serif;color:#373D63}'+
'.askc-b span{font-size:13px;line-height:1.45;color:#5A5F80;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}'+
'.askc-go{flex:none;background:#604C87;color:#fff;font-weight:700;font-size:13px;padding:9px 14px;border-radius:12px}'+
'.askc:focus-visible{outline:2px solid #F89743;outline-offset:2px}'+
'</style>';
var js='<script>(function(){try{fetch("https://qnjixxctlwinglmhgijc.supabase.co/rest/v1/questions?select=body,city&status=eq.approved&order=created_at.desc&limit=1",{headers:{apikey:"sb_publishable_Ta_HT5_r1UPYj8y7MKozdg_VKLL_bwa",Authorization:"Bearer sb_publishable_Ta_HT5_r1UPYj8y7MKozdg_VKLL_bwa"}}).then(function(r){return r.ok?r.json():[]}).then(function(a){if(a&&a[0]&&a[0].body){var el=document.getElementById("askLast");if(el)el.textContent="آخر سؤال من "+(a[0].city||"")+": «"+String(a[0].body).slice(0,90)+"»";}}).catch(function(){});}catch(e){}})();<\/script>';
var anchor='<div id="evWrap">';
if(v.indexOf('id="askCard"')<0 && v.split(anchor).length===2){
  v=v.replace(anchor,card+anchor);
  v=v.replace('</head>',css+'</head>');
  v=v.replace('</body>',js+'</body>');
}
window.NV=v;
})();
