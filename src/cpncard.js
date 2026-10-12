// Adds an "العروض والكوبونات" entry card to the home page, right after the ask-locals card.
(function(){
var v=window.V;
var url='https://www.saudi-guide.com/coupons';
var tag='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M3 9V6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5V9a3 3 0 0 0 0 6v2.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5V15a3 3 0 0 0 0-6z"/><path d="M9.5 14.5l5-5"/><circle cx="9.7" cy="9.7" r=".9" fill="currentColor"/><circle cx="14.3" cy="14.3" r=".9" fill="currentColor"/></svg>';
var card='<a class="askc cpnc" id="cpnCard" href="'+url+'">'+
 '<span class="askc-i cpnc-i">'+tag+'</span>'+
 '<span class="askc-b"><b>العروض والكوبونات</b><span id="cpnLast">خصومات لمطاعم ومقاهي وفنادق في مدن المملكة</span></span>'+
 '<span class="askc-go cpnc-go">تصفّح</span></a>';
var css='<style id="cpncss">.cpnc{margin-top:10px}.cpnc:before{background:linear-gradient(#604C87,#8562A6)!important}.cpnc-i{background:#FDE8D6!important;color:#C9600F!important}.cpnc-go{background:#F89743!important;color:#2E1A07!important}</style>';
var js='<script>(function(){try{var K="sb_publishable_Ta_HT5_r1UPYj8y7MKozdg_VKLL_bwa";fetch("https://qnjixxctlwinglmhgijc.supabase.co/rest/v1/coupons?select=store_name,city&order=featured.desc,created_at.desc&limit=1",{headers:{apikey:K,Authorization:"Bearer "+K,Prefer:"count=exact"}}).then(function(r){var n=+(((r.headers.get("content-range")||"/0").split("/")[1])||0);return r.ok?r.json().then(function(a){return {n:n,a:a}}):null}).then(function(x){if(!x||!x.n)return;var el=document.getElementById("cpnLast");if(el)el.textContent=x.n+" عرض فعّال الحين"+(x.a[0]?"، منها "+x.a[0].store_name+" في "+x.a[0].city:"");}).catch(function(){});}catch(e){}})();<\/script>';
var anchor='<div id="evWrap">';
if(v.indexOf('id="cpnCard"')<0 && v.indexOf('id="askCard"')>=0 && v.split(anchor).length===2){
  v=v.replace(anchor,card+anchor);
  v=v.replace('</head>',css+'</head>');
  v=v.replace('</body>',js+'</body>');
}
window.NV=v;
})();
