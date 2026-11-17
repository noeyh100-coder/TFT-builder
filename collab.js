// 콜라보 탭 — 시즌 11 '귀인'(Exalted) 선정 규칙을 시즌 19 기물에 적용해 콜라보 조합을 만든다.
//
// lolchess.gg 귀인 통계(60개 조합)를 분석한 규칙
//  1) 후보: 특성이 정확히 2개(계열 1 + 직업 1)인 기물만. 특성 3개짜리·고유 특성 보유 기물은 한 번도 귀인이 되지 않음
//  2) 한 조합 안의 기물끼리 계열·직업이 하나도 겹치지 않음 (57/60 조합)
//  3) 조합 크기는 5기(약 2/3) 또는 6기(약 1/3)
//  4) 코스트는 제한 없이 섞임 (5코는 최대 2기). 가끔 전원 같은 코스트인 조합(1코×6, 2코×6, 3코×6)도 나옴
// 시즌 19 적용: 해금 기물·7코는 상점에 나오지 않으므로 후보에서 제외. 소나는 조합과 별개로 항상 콜라보.

const colElig=c=>{
  if(c.unlock||c.cs>5||COL_FIX.has(c.key)||c.t0.length!==2)return false;
  const t=c.t0.map(k=>TR[k]);
  if(t.some(x=>!x||isUnique(x)))return false;
  return t.some(x=>x.type==='ORIGIN')&&t.some(x=>x.type==='CLASS');
};
const COL_POOL=CH.filter(colElig);
const COL_EX=CH.filter(c=>c.col0).sort(byCost).map(c=>c.key); // 데이터에 실려 온 실제 콜라보 조합 (lolchess 표본)
const CK={};CH.forEach(c=>CK[c.key]=c);
const COLS_N=24;
const CO={seed:1,need:[],list:null,open:false};
(function(){try{const o=JSON.parse(localStorage.getItem('tftb19colui')||'null');if(o){CO.seed=o.seed||1;CO.need=(o.need||[]).filter(k=>COL_POOL.some(c=>c.key===k))}}catch(e){}})();
function colSave(){try{localStorage.setItem('tftb19colui',JSON.stringify({seed:CO.seed,need:CO.need}))}catch(e){}}

function rng32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const clash=(a,b)=>a.t0.some(t=>b.t0.includes(t));
function colValid(keys){const l=keys.map(k=>CK[k]);for(let i=0;i<l.length;i++)for(let j=i+1;j<l.length;j++)if(clash(l[i],l[j]))return false;return l.filter(c=>c.cs>=5).length<=2}

function colGen(){
  const r=rng32(CO.seed*7919+CO.need.join().length*31+CO.need.reduce((a,k)=>a+CK[k].i*13,0));
  const need=CO.need.map(k=>CK[k]);
  if(!colValid(CO.need))return{err:'고른 기물끼리 시너지가 겹쳐서 같은 콜라보 조합이 될 수 없어요'};
  const out=[],seen=new Set();
  for(let tries=0;out.length<COLS_N&&tries<COLS_N*60;tries++){
    const size=r()<.35?6:5;
    let pool=COL_POOL;
    if(r()<.07){const c=[1,2,3][Math.floor(r()*3)];if(need.every(x=>x.cs===c))pool=COL_POOL.filter(x=>x.cs===c)}
    const team=need.slice();
    const cand=pool.filter(c=>!team.includes(c));
    for(let i=cand.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[cand[i],cand[j]]=[cand[j],cand[i]]}
    for(const c of cand){if(team.length>=size)break;if(team.some(x=>clash(x,c)))continue;if(c.cs>=5&&team.filter(x=>x.cs>=5).length>=2)continue;team.push(c)}
    if(team.length<size)continue;
    const keys=team.sort((a,b)=>a.cs-b.cs||byName(a,b)).map(c=>c.key),id=keys.join();
    if(seen.has(id))continue;seen.add(id);out.push(keys);
  }
  return{list:out};
}

function colApply(keys){
  keys=typeof keys==='string'?keys.split(','):keys;
  const same=keys.length===COL.size&&keys.every(k=>COL.has(k));
  setCollab(same?[]:keys);save();render();
  toast(same?'콜라보 해제':'콜라보 적용: '+keys.map(k=>CK[k].name).join(', '));
}
function colClear(){setCollab([]);save();render();toast('콜라보 해제')}
function colReroll(){CO.seed=(CO.seed%99991)+1;CO.list=null;colSave();$('body').scrollTop=0;renderBody()}
function colTogNeed(k){CO.need=CO.need.includes(k)?CO.need.filter(x=>x!==k):CO.need.concat(k);CO.list=null;colSave();renderBody()}
function colRule(){
  openSheet(`<div class="ttl">콜라보 조합 규칙</div><div class="ds">시즌 11 <b>귀인</b> 통계(lolchess.gg, 조합 60개)를 분석해 찾은 규칙을 시즌 19 기물에 그대로 적용했어요.<br><br>
  <b>1. 후보 기물</b> — 특성이 계열 1개 + 직업 1개, 딱 2개인 기물만 후보예요. 시즌 11에서 특성이 3개이거나 고유 특성을 가진 기물(아트록스, 니코, 일라오이, 오공, 자야·라칸 등)은 한 번도 귀인이 되지 않았어요. 해금 기물·7코스트도 상점에 나오지 않으니 제외했어요.<br><br>
  <b>2. 시너지 겹침 없음</b> — 한 조합 안에서는 계열도 직업도 서로 겹치지 않아요(60개 중 57개). 그래서 콜라보 기물만 모으면 다른 시너지는 거의 켜지지 않아요.<br><br>
  <b>3. 5~6기</b> — 5기 조합이 약 2/3, 6기 조합이 약 1/3이에요.<br><br>
  <b>4. 코스트 무관</b> — 1~5코스트가 섞이고(5코는 최대 2기), 가끔 전원 같은 코스트(1코만, 2코만, 3코만)인 조합도 나와요.<br><br>
  <b>소나</b>는 이 규칙과 별개로 항상 콜라보 특성을 가지고 있어요. 조합 후보에는 들어가지 않지만 콜라보 시너지 수에는 더해져요.<br><br>
  후보 기물 ${COL_POOL.length}개: ${COL_POOL.slice().sort(byCost).map(c=>c.name).join(', ')}</div>`);
}

function colCard(keys,label,cls){
  const on=keys.length===COL.size&&keys.every(k=>COL.has(k));
  const onB=new Set(Object.values(B).map(u=>CH[u.c].key));
  const nb=keys.filter(k=>onB.has(k)).length;
  const ts=keys.flatMap(k=>CK[k].t0);
  return `<div class="aicard colc ${on?'on':''} ${cls||''}" onclick="colApply('${keys.join(',')}')"><div class="aih"><b>${label}</b><span>${keys.length}기 · ${keys.map(k=>CK[k].cs).join('·')}코${nb?` · 보드 위 ${nb}`:''}</span>${on?'<em>적용됨</em>':''}</div>
  <div class="aiu c6">${keys.map(k=>{const c=CK[k];return `<div class="k${c.cs}${onB.has(k)?' cb':''}"><img src="${c.img}" alt=""><span>${c.name}</span></div>`}).join('')}</div>
  <div class="ait">${ts.map(t=>`<span class="cot"><img src="${TR[t].img}" alt="">${TR[t].name}</span>`).join('')}</div></div>`;
}

function colBody(){
  if(!CO.list)CO.list=colGen();
  const cur=[...COL];
  const sona=CH.find(c=>COL_FIX.has(c.key));
  let s=`<div class="ai">
  <div class="aisec">현재 콜라보 <small><a href="#" onclick="event.preventDefault();colRule()">규칙 보기 ⓘ</a></small></div>
  <div class="aisel">${cur.length?cur.map(k=>CK[k]).sort(byCost).map(c=>`<button class="k${c.cs}" onclick="colApply('${cur.join(',')}')"><img class="cimg" src="${c.img}" alt="">${c.name}</button>`).join('')+`<button class="add" onclick="colClear()">해제</button>`:'<span class="colnone">적용된 조합 없음 · 아래에서 조합을 탭하세요</span>'}</div>
  ${sona?`<div class="colfix"><img src="${sona.img}" alt=""><span><b>${sona.name}</b>는 조합과 별개로 항상 콜라보예요</span></div>`:''}
  <div class="aisec colft" onclick="CO.open=!CO.open;renderBody()">기물로 찾기 ${CO.open?'▴':'▾'} <small>${CO.need.length?CO.need.map(k=>CK[k].name).join(', ')+' 포함':'고른 기물이 모두 들어간 조합만 만들어요'}</small></div>
  <div class="colpk" style="${CO.open?'':'display:none'}">${COL_POOL.slice().sort(byCost).map(c=>`<button class="k${c.cs} ${CO.need.includes(c.key)?'on':''}" onclick="colTogNeed('${c.key}')"><img src="${c.img}" alt=""><span>${c.name}</span></button>`).join('')}</div>
  <div class="colbar"><span>콜라보 조합 목록 · 탭하면 적용</span><button class="ib" onclick="colReroll()">새로 뽑기</button></div>`;
  if(CO.list.err)return s+`<div class="ainote">${CO.list.err}</div></div>`;
  if(COL_EX.length&&CO.need.every(k=>COL_EX.includes(k)))s+=colCard(COL_EX,'데이터 예시','ex');
  s+=CO.list.list.map((k,i)=>colCard(k,'조합 '+(i+1))).join('');
  if(!CO.list.list.length)s+='<div class="empty">조건에 맞는 조합이 없어요</div>';
  return s+'</div>';
}
