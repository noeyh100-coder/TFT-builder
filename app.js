const D=window.TFT_DATA;
const ROWS=4,COLS=7,CELLS=28,MAXI=3,COSTS=[1,2,3,4,5,7];
const HIDE_TR=new Set(['Collab']); // 콜라보는 매판 무작위로 바뀌므로 표시하지 않음
const CH=D.champions.map((c,i)=>Object.assign({},c,{i,cs:c.cost[0],base:c.name.split(' (')[0],traits:c.traits.filter(t=>!HIDE_TR.has(t))}));
const TR={};D.traits.forEach(t=>TR[t.key]=t);
const isUnique=t=>t.styles.length===1&&t.styles[0].min===1;
const IT=D.items.map((x,i)=>Object.assign({},x,{i}));
const IK={};IT.forEach(x=>IK[x.key]=x);
const EMB={};IT.forEach(x=>{if(x.isEmblem){const k=x.key.replace(/Emblem$/,'');if(TR[k])EMB[x.key]=k}});
const COMPS=IT.filter(x=>x.isFromItem&&!x.isHidden);
const SC={scaleAP:'주문력',scaleAD:'공격력',scaleHealth:'체력',scaleArmor:'방어력',scaleMR:'마법 저항력',scaleAS:'공격 속도',scaleCrit:'치명타 확률',scaleCritMult:'치명타 피해',scaleDA:'피해 증폭',scaleDR:'내구력',scaleSV:'모든 피해 흡혈',scaleMana:'마나',TFTManaRegen:'마나 회복'};
const A='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const $=id=>document.getElementById(id);
const byName=(a,b)=>a.name.localeCompare(b.name,'ko');
const byCost=(a,b)=>a.cs-b.cs||byName(a,b);

let B={},hist=[],fut=[],sel=null,armed=null,held=null,tab='c',view='cost',full=false;

function fmt(s){if(!s)return'';return String(s).replace(/<(?!br\s*\/?>)[^>]*>/gi,'').replace(/%i:([A-Za-z0-9_]+)%/g,(m,k)=>TR[k]?`<img class="ti" src="${TR[k].img}" alt="">`:(SC[k]?`<span class="sc">${SC[k]}</span>`:''))}
function styleOf(t,n){let s=null;for(const st of TR[t].styles){if(n>=st.min)s=st}return s}

function unitTraits(u,first){const ch=CH[u.c],s=new Set(first?ch.traits:[]);u.i.forEach(j=>{const e=EMB[IT[j].key];if(e&&!ch.traits.includes(e))s.add(e)});return s}
function counts(){const cnt={},seen=new Set();Object.keys(B).sort((a,b)=>a-b).forEach(x=>{const u=B[x],k=CH[u.c].key,first=!seen.has(k);seen.add(k);unitTraits(u,first).forEach(t=>{if(TR[t])cnt[t]=(cnt[t]||0)+1})});return cnt}

function save(){try{localStorage.setItem('tftb19v2',enc())}catch(e){}}
function snap(){return JSON.stringify(B)}
function commit(fn){hist.push(snap());if(hist.length>80)hist.shift();fut=[];fn();save();render()}
function undo(){if(!hist.length)return;fut.push(snap());B=JSON.parse(hist.pop());sel=null;armed=null;save();render()}
function redo(){if(!fut.length)return;hist.push(snap());B=JSON.parse(fut.pop());sel=null;armed=null;save();render()}

let tt;function toast(m){const e=$('toast');e.textContent=m;e.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>e.classList.remove('on'),1600)}

function autoCell(ch){const front=/Tank|Fighter/.test(ch.role||'');const rows=front?[0,1,2,3]:[3,2,1,0];const order=[3,2,4,1,5,0,6];for(const r of rows)for(const c of order){const x=r*COLS+c;if(!B[x])return x}return -1}

const DR={p:null,on:false,sup:0,timer:0,tg:null,touch:false};
const sup=()=>Date.now()-DR.sup<400;

function tapChamp(ci){if(sup())return;let x=armed;if(x==null||B[x])x=autoCell(CH[ci]);if(x<0)return toast('보드가 가득 찼어요');commit(()=>{B[x]={c:ci,s:1,i:[]};armed=null});toast(CH[ci].name+' 배치')}

function tapCell(x){
  if(sup())return;
  const u=B[x];
  if(held!=null){if(u){const h=held;held=null;equip(x,h)}else toast('유닛이 있는 칸을 탭하세요');render();return}
  if(u){armed=null;render();champInfo(u.c,x);return}
  armed=armed===x?null:x;if(armed!=null&&tab!=='c')setTab('c');
  render();
}

function equip(x,ii){
  const u=B[x],it=IT[ii];
  if(!u)return;
  if(u.i.length>=MAXI)return toast('아이템은 3개까지 장착할 수 있어요');
  const et=EMB[it.key];
  if(et&&(CH[u.c].traits.includes(et)||u.i.some(j=>EMB[IT[j].key]===et)))return toast('이미 '+TR[et].name+' 특성이 있어요');
  commit(()=>{B[x].i.push(ii)});
  toast(CH[u.c].name+' ← '+it.name);
}
function unequip(x,k){if(!B[x])return;commit(()=>{B[x].i.splice(k,1)});if(B[x])champInfo(B[x].c,x)}
function cycleStar(x){if(sup()||!B[x])return;commit(()=>{B[x].s=B[x].s%3+1})}
function cancel(){sel=null;armed=null;held=null;render()}

function renderBoard(){
  const wrap=$('boardWrap'),bd=$('board');
  const W=Math.min(wrap.clientWidth-12,480);
  const w=W/(COLS+.5),h=w*1.1547,rs=h*.75;
  bd.style.width=W+'px';bd.style.height=(rs*(ROWS-1)+h+4)+'px';
  let s='';
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const x=r*COLS+c,u=B[x],l=c*w+(r%2?w/2:0),tp=r*rs+2;
    let cls='cell',inner='<div class="hx"><div class="hi"></div></div>',dd='';
    if(u){const ch=CH[u.c];cls+=' u k'+ch.cs;dd=` data-drag="u:${x}"`;inner=`<div class="hx"><div class="hi" style="background-image:url('${ch.img}')"></div></div><span class="st" onclick="event.stopPropagation();cycleStar(${x})">${'★'.repeat(u.s)}</span>${ch.unlock?'<span class="ulb">해금</span>':''}<span class="trs">${[...unitTraits(u,true)].filter(t=>TR[t]).map(t=>`<img src="${TR[t].img}" alt=""${ch.traits.includes(t)?'':' class="em"'}>`).join('')}</span>${u.i.length?`<span class="its">${u.i.map(j=>`<img src="${IT[j].img}" alt="">`).join('')}</span>`:''}`}
    if(sel===x)cls+=' sel';
    if(armed===x)cls+=' armed';
    s+=`<div class="${cls}" data-cell="${x}"${dd} style="left:${l+1}px;top:${tp}px;width:${w-2}px;height:${h-2}px" onclick="tapCell(${x})">${inner}</div>`;
  }
  bd.innerHTML=s;
}

function renderTraits(){
  const cnt=counts();
  const rank={chromatic:4,gold:3,silver:2,bronze:1};
  const arr=Object.keys(cnt).map(t=>{const st=styleOf(t,cnt[t]);return{t,n:cnt[t],st:st?st.style:'',r:st?rank[st.style]||0:0}}).sort((a,b)=>b.r-a.r||b.n-a.n);
  if(!arr.length){$('traits').innerHTML='<span class="tc ph">챔피언을 배치하면 시너지가 여기 표시돼요</span>';return}
  $('traits').innerHTML=arr.map(o=>{const t=TR[o.t];const nx=t.styles.find(s=>s.min>o.n);return `<button class="tc ${o.st}" onclick="traitInfo('${o.t}')"><img src="${t.img}" alt=""><b>${o.n}</b>${t.name}<span class="nx">${nx?'/'+nx.min:''}</span></button>`}).join('');
}

function renderBar(){$('undo').disabled=!hist.length;$('redo').disabled=!fut.length}

function setTab(t){tab=t;document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('on',b.dataset.t===t));$('body').scrollTop=0;renderFlt();renderBody()}
function setView(v){view=v;$('body').scrollTop=0;renderFlt();renderBody()}
function toggleFull(){full=!full;$('drawer').classList.toggle('full',full)}

function renderFlt(){
  const f=$('flt'),f2=$('flt2');
  f.style.display='';
  if(tab==='c'){
    f.innerHTML=`<div class="seg">${[['cost','가격순'],['origin','계열별'],['class','직업별'],['unique','고유 특성']].map(([k,n])=>`<button class="${view===k?'on':''}" onclick="setView('${k}')">${n}</button>`).join('')}</div>`;
    f2.innerHTML='';f2.style.display='none';
  }else{
    f.innerHTML='';f.style.display='none';f2.innerHTML='';f2.style.display='none';
  }
}

function champTile(ch,onB){return `<div class="ct k${ch.cs}${onB.has(ch.key)?' in':''}" onclick="tapChamp(${ch.i})"><div class="pf"><img src="${ch.img}" alt="" draggable="false">${ch.unlock?'<span class="ul">해금</span>':''}<span class="tr">${ch.traits.filter(t=>TR[t]).map(t=>`<img src="${TR[t].img}" alt="">`).join('')}</span></div><div class="n">${ch.name}</div></div>`}

function champGroups(){
  const fit=()=>true;
  if(view==='cost')return COSTS.map(c=>({h:c+'코스트',list:CH.filter(ch=>ch.cs===c&&fit(ch)).sort(byName)}));
  const pick=view==='origin'?t=>t.type==='ORIGIN'&&!isUnique(t):view==='class'?t=>t.type==='CLASS'&&!isUnique(t):isUnique;
  return D.traits.filter(pick).sort(byName).map(t=>({t,list:CH.filter(ch=>ch.traits.includes(t.key)&&fit(ch)).sort(byCost)}));
}

function renderBody(){
  const body=$('body'),st=body.scrollTop;let s='';
  if(tab==='c'){
    const onB=new Set(Object.values(B).map(u=>CH[u.c].key));
    const gs=champGroups().filter(g=>g.list.length);
    s=gs.length?gs.map(g=>(g.t?`<div class="gh" onclick="traitInfo('${g.t.key}')"><img src="${g.t.img}" alt="">${g.t.name}<small>${g.t.styles.map(x=>x.min).join(' / ')}</small><span class="i">ⓘ</span></div>`:g.h?`<div class="gh">${g.h}</div>`:'')+`<div class="grid">${g.list.map(c=>champTile(c,onB)).join('')}</div>`).join(''):'<div class="empty">결과가 없어요</div>';
  }else{
    s=aiBody();
  }
  body.innerHTML=s;body.scrollTop=st;
}

function openSheet(h){$('sheetBody').innerHTML=h;$('sheet').classList.add('on');$('sheet').querySelector('.box').scrollTop=0}
function closeSheet(){$('sheet').classList.remove('on')}
function traitBtns(keys){return `<div class="tg">${keys.filter(k=>TR[k]).map(k=>`<button onclick="traitInfo('${k}')"><img src="${TR[k].img}" alt="">${TR[k].name}</button>`).join('')}</div>`}
function champInfo(ci,bx){
  const c=CH[ci],sk=c.skill||{};
  const st=[['체력',c.health],['공격력',c.attackDamage],['DPS',c.damagePerSecond]].filter(([,v])=>v&&v.some(n=>n)).map(([n,v])=>`<span>${n} <b>${v.join(' / ')}</b></span>`);
  [['사거리',c.attackRange],['공격 속도',c.attackSpeed],['방어력',c.armor],['마법 저항력',c.magicalResistance]].forEach(([n,v])=>{if(v)st.push(`<span>${n} <b>${v}</b></span>`)});
  if(sk.skillMana)st.push(`<span>마나 <b>${sk.startingMana||0} / ${sk.skillMana}</b></span>`);
  openSheet(`<div class="ih k${c.cs}"><img class="big" src="${c.img}" alt=""><div><h2>${c.name}${bx!=null&&B[bx]?` <span class="stx">${'★'.repeat(B[bx].s)}</span>`:''}</h2><div class="sub">${c.cs}코스트 · 골드 ${c.cost.join(' / ')}${c.role?' · '+c.role:''}</div></div></div>${traitBtns(c.traits)}${c.unlock?`<div class="ulbox"><b>해금 조건</b>${c.unlock.level?` · ${c.unlock.level}레벨 이상`:''}<br>${fmt(c.unlock.desc)}</div>`:''}${st.length?`<div class="stats">${st.join('')}</div>`:''}${sk.name?`<div class="ds"><b>${sk.name}</b><br>${fmt(sk.desc)}${sk.stats&&sk.stats.length?'<br><br>'+sk.stats.map(fmt).join('<br>'):''}</div>`:''}${bx!=null&&B[bx]?(B[bx].i.length?`<div class="sec">장착 아이템 · 탭하면 해제</div><div class="tg">${B[bx].i.map((j,k)=>`<button onclick="unequip(${bx},${k})"><img src="${IT[j].img}" alt="">${IT[j].name} ✕</button>`).join('')}</div>`:''):`<button class="pill on" style="width:100%;justify-content:center;padding:10px" onclick="closeSheet();tapChamp(${ci})">보드에 배치</button>`}`);
}
function traitInfo(k){
  const t=TR[k];if(!t)return;
  const n=counts()[k]||0;
  const lv=t.styles.map(s=>`<div class="lv"><b class="${s.style}">${s.min}${s.max&&s.max!==s.min?'-'+s.max:''}</b><div>${fmt((t.stats||{})[s.min]||'')}</div></div>`).join('');
  const us=CH.filter(c=>c.traits.includes(k)).sort(byCost);
  openSheet(`<div class="ih"><img class="ticon" src="${t.img}" alt=""><div><h2>${t.name}</h2><div class="sub">${t.type==='CLASS'?'직업':'계열'}${isUnique(t)?' · 고유 특성':''} · 현재 ${n}</div></div></div><div class="ds">${fmt(t.desc)}</div>${lv}<div class="sec">챔피언</div><div class="ulist">${us.map(c=>`<div class="ct k${c.cs}" onclick="champInfo(${c.i})"><div class="pf"><img src="${c.img}" alt="">${c.unlock?'<span class="ul">해금</span>':''}<span class="cs">${c.cs}</span></div><div class="n">${c.name}</div></div>`).join('')}</div>`);
}

function dragImg(v){const [k,id]=v.split(':');const n=+id;if(k==='c')return[CH[n].img,'k'+CH[n].cs];if(k==='u')return B[n]?[CH[B[n].c].img,'k'+CH[B[n].c].cs]:null;return[IT[n].img,'']}
function startDrag(x,y){
  const p=DR.p;if(!p)return;const im=dragImg(p.v);if(!im){DR.p=null;return}
  DR.on=true;
  if(full){full=false;$('drawer').classList.remove('full')}
  const g=$('ghost');g.className=im[1];g.style.backgroundImage=`url('${im[0]}')`;g.style.display='block';
  if(p.v[0]==='u'){document.body.classList.add('dragU');const c=document.querySelector(`[data-cell="${p.v.slice(2)}"]`);if(c)c.classList.add('src')}
  moveDrag(x,y);
}
function targetAt(x,y){const el=document.elementFromPoint(x,y);if(!el)return null;const c=el.closest('[data-cell]');if(c)return{cell:+c.dataset.cell};if(el.closest('#drawer'))return{trash:true};return null}
function moveDrag(x,y){
  const gx=x,gy=y;
  const g=$('ghost');g.style.left=gx+'px';g.style.top=gy+'px';
  const tg=targetAt(gx,gy);DR.tg=tg;
  document.querySelectorAll('.cell.drop').forEach(e=>e.classList.remove('drop'));
  $('drawer').classList.toggle('trash',!!(tg&&tg.trash));
  if(tg&&tg.cell!=null){const c=document.querySelector(`[data-cell="${tg.cell}"]`);if(c)c.classList.add('drop')}
}
function clearDrag(){DR.on=false;DR.p=null;DR.tg=null;$('ghost').style.display='none';document.body.classList.remove('dragU');$('drawer').classList.remove('trash');document.querySelectorAll('.cell.drop,.cell.src').forEach(e=>e.classList.remove('drop','src'))}
function endDrag(){
  const v=DR.p.v,tg=DR.tg;clearDrag();if(!DR.touch)DR.sup=Date.now();
  const k=v[0],n=+v.slice(2);
  if(k==='c'){if(tg&&tg.cell!=null){const x=tg.cell;commit(()=>{B[x]={c:n,s:1,i:[]};armed=null;sel=null});toast(CH[n].name+' 배치')}}
  else if(k==='u'){
    if(!B[n])return;
    if(tg&&tg.cell!=null&&tg.cell!==n){const x=tg.cell;sel=null;commit(()=>{const a=B[n],b=B[x];B[x]=a;if(b)B[n]=b;else delete B[n]})}
    else if(tg&&tg.trash){const nm=CH[B[n].c].name;sel=null;commit(()=>{delete B[n]});toast(nm+' 제거')}
  }
  else if(k==='i'){if(tg&&tg.cell!=null){if(B[tg.cell])equip(tg.cell,n);else toast('유닛이 있는 칸에 놓으세요')}}
}

document.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;const el=e.target.closest('[data-drag]');if(!el)return;DR.touch=false;DR.p={v:el.dataset.drag,x:e.clientX,y:e.clientY,mouse:true}});
document.addEventListener('pointermove',e=>{if(!DR.p||!DR.p.mouse)return;if(!DR.on){if(Math.hypot(e.clientX-DR.p.x,e.clientY-DR.p.y)<6)return;startDrag(e.clientX,e.clientY)}if(DR.on){e.preventDefault();moveDrag(e.clientX,e.clientY)}});
document.addEventListener('pointerup',e=>{if(!DR.p||!DR.p.mouse)return;if(DR.on)endDrag();DR.p=null});
document.addEventListener('dragstart',e=>{if(e.target.closest&&e.target.closest('[data-drag]'))e.preventDefault()});
document.addEventListener('contextmenu',e=>{if(e.target.closest('[data-drag]'))e.preventDefault()});
document.addEventListener('touchstart',e=>{
  if(e.touches.length>1){clearTimeout(DR.timer);if(DR.on)clearDrag();DR.p=null;return}
  const el=e.target.closest('[data-drag]');if(!el)return;
  const t=e.touches[0];DR.touch=true;
  DR.p={v:el.dataset.drag,x:t.clientX,y:t.clientY,board:!!el.closest('#board')};
  clearTimeout(DR.timer);
  if(!DR.p.board)DR.timer=setTimeout(()=>{if(DR.p&&!DR.on){startDrag(DR.p.x,DR.p.y);try{navigator.vibrate&&navigator.vibrate(15)}catch(_){}}},220);
},{passive:true});
document.addEventListener('touchmove',e=>{
  if(!DR.p)return;const t=e.touches[0];
  if(DR.on){e.preventDefault();moveDrag(t.clientX,t.clientY);return}
  const d=Math.hypot(t.clientX-DR.p.x,t.clientY-DR.p.y);
  if(DR.p.board){if(d>6){e.preventDefault();startDrag(t.clientX,t.clientY)}}
  else if(d>10){clearTimeout(DR.timer);DR.p=null}
},{passive:false});
document.addEventListener('touchend',e=>{clearTimeout(DR.timer);if(DR.on){e.preventDefault();endDrag()}DR.p=null},{passive:false});
document.addEventListener('touchcancel',()=>{clearTimeout(DR.timer);if(DR.on)clearDrag();DR.p=null});

const e2=n=>A[Math.floor(n/62)]+A[n%62];
const d2=s=>A.indexOf(s[0])*62+A.indexOf(s[1]);
function enc(){return 'b-'+Object.keys(B).map(x=>{const u=B[x];return A[+x]+u.s+e2(u.c)+u.i.map(e2).join('')}).join('-')}
function dec(s){
  s=(s||'').trim().replace(/^.*#/,'');
  if(!s.startsWith('b-'))return null;
  const b={};
  for(const p of s.slice(2).split('-')){
    if(!p)continue;
    if(p.length<4)return null;
    const x=A.indexOf(p[0]),st=+p[1],c=d2(p.slice(2,4));
    if(x<0||x>=CELLS||!CH[c]||!(st>=1&&st<=3))return null;
    const it=[];for(let q=4;q+1<p.length;q+=2){const ii=d2(p.slice(q,q+2));if(IT[ii])it.push(ii)}
    b[x]={c,s:st,i:it.slice(0,MAXI)};
  }
  return b;
}
function openShare(){const c=enc();$('code').value=c;$('paste').value='';try{history.replaceState(null,'','#'+c)}catch(e){}$('modal').classList.add('on')}
function closeShare(){$('modal').classList.remove('on')}
function copyCode(){const c=$('code').value;const fb=()=>{const t=$('code');t.focus();t.select();toast('선택됐어요. 길게 눌러 복사하세요')};try{navigator.clipboard.writeText(c).then(()=>toast('복사했어요'),fb)}catch(e){fb()}}
function loadCode(){const b=dec($('paste').value);if(!b)return toast('올바른 코드가 아니에요');sel=null;armed=null;held=null;commit(()=>{B=b});closeShare();toast('불러왔어요')}

let rt;function resetB(){const r=$('reset');if(r.classList.contains('warn')){clearTimeout(rt);r.classList.remove('warn');r.textContent='초기화';sel=null;armed=null;held=null;commit(()=>{B={}});toast('초기화했어요');return}r.classList.add('warn');r.textContent='확인';rt=setTimeout(()=>{r.classList.remove('warn');r.textContent='초기화'},2500)}

function render(){renderBoard();renderTraits();renderBar();renderBody()}

(function init(){
  let b=null;
  try{b=dec(location.hash)}catch(e){}
  if(!b){try{b=dec(localStorage.getItem('tftb19v2'))}catch(e){}}
  if(b)B=b;
  renderFlt();render();
  window.addEventListener('resize',renderBoard);
})();
