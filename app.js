const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
async function api(path,opt={}){const r=await fetch('/api/'+path,{credentials:'same-origin',...opt,headers:{'content-type':'application/json',...(opt.headers||{})}});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.error||'Request failed');return d}
function autoTrans(s){
 const map={
 'अ':'a','आ':'aa','इ':'i','ई':'ee','उ':'u','ऊ':'oo','ऋ':'ri','ए':'e','ऐ':'ai','ओ':'o','औ':'au',
 'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'ng','च':'ch','छ':'chh','ज':'j','झ':'jh','ञ':'ny',
 'ट':'t','ठ':'th','ड':'d','ढ':'dh','ण':'n','त':'t','थ':'th','द':'d','ध':'dh','न':'n',
 'प':'p','फ':'ph','ब':'b','भ':'bh','म':'m','य':'y','र':'r','ल':'l','व':'v',
 'श':'sh','ष':'sh','स':'s','ह':'h','ळ':'l',
 'क्ष':'ksh','त्र':'tr','ज्ञ':'gy','श्र':'shr',
 'ा':'aa','ि':'i','ी':'ee','ु':'u','ू':'oo','ृ':'ri','े':'e','ै':'ai','ो':'o','ौ':'au',
 'ं':'n','ँ':'n','ः':'h','ऽ':'','्':'','।':' '
 };
 let out='';
 const chars=[...String(s||'')];
 for(let i=0;i<chars.length;i++){
   const c=chars[i], pair=c+(chars[i+1]||'');
   if(map[pair] && ['क्ष','त्र','ज्ञ','श्र'].includes(pair)){out+=map[pair]+'a';i++;continue}
   if(map[c]!==undefined){
     const v=map[c];
     if('ािीुूृेैोौ'.includes(c)){
       out=out.replace(/a$/,'')+v;
     }else if(c==='्'){
       out=out.replace(/a$/,'');
     }else if(/[क-हळ]/.test(c)){
       out+=v+'a';
     }else{
       out+=v;
     }
   }else out+=c;
 }
 return out.toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function searchForms(s){
 const raw=String(s||'').toLowerCase().trim();
 const tr=autoTrans(s);
 const compact=v=>v.replace(/aa/g,'a').replace(/ee/g,'i').replace(/oo/g,'u').replace(/([a-z])a$/,'$1');
 const forms=new Set([raw,tr,compact(tr),compact(raw)]);
 [...forms].forEach(v=>{if(v.endsWith('a'))forms.add(v.slice(0,-1));});
 return [...forms].filter(Boolean);
}
function match(q,x){
 q=String(q||'').toLowerCase().trim();
 if(!q)return true;
 const fields=[x.title,x.excerpt,x.content,x.category,x.tags].filter(Boolean);
 const raw=fields.join(' ').toLowerCase();
 const forms=searchForms(fields.join(' '));
 const qForms=searchForms(q);
 if(raw.includes(q))return true;
 if(qForms.some(qf=>forms.some(f=>f.includes(qf))))return true;
 const words=q.split(/\s+/).filter(Boolean);
 return words.every(w=>{
   const wf=searchForms(w);
   return wf.some(qf=>forms.some(f=>f.includes(qf))) || raw.includes(w);
 });
}
function card(x){return `<article class="card" data-id="${esc(x.id)}"><div class="thumb">${x.image_url?`<img src="${esc(x.image_url)}" alt="${esc(x.title)}">`:`<span>${esc(x.emoji||'📖')}</span>`}</div><div class="body"><span class="pill">${esc(x.category||'कहानी')}</span><h2>${esc(x.title)}</h2><p>${esc(x.excerpt||'हिंदी कहानी पढ़ें।')}</p><div class="meta">👁️ ${Number(x.views||0)} views</div><span class="btn">पूरी कहानी →</span></div></article>`}
function bindCards(){document.querySelectorAll('.card[data-id]').forEach(c=>c.onclick=()=>location.href='story.html?id='+encodeURIComponent(c.dataset.id))}
async function track(path,story_id=''){try{await api('analytics',{method:'POST',body:JSON.stringify({path,story_id})})}catch{}}
