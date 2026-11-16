// AI 공책롤체 — 브라우저 안에서 도는 규칙 기반 덱 빌더 (외부 API 없음)
// 1) 사용자의 옵션·선택·문장을 해석하고 2) 담금질(simulated annealing)로 조합을 탐색한 뒤 3) 보드에 배치한다.

const AI_OPTS=[
  ['clean','깔끔','버림 없이'],
  ['many','많이','시너지 최대'],
  ['balance','균형','앞뒤 비율'],
  ['high','고코스트','4·5코 위주'],
  ['low','저코스트','1~3코 위주']
];
const AI={opts:['clean'],lv:8,traits:[],champs:[],unlock:false,text:'',res:null,pick:0,info:null};
(function(){try{const o=JSON.parse(localStorage.getItem('tftb19ai')||'null');if(o){['opts','lv','traits','champs','unlock','text'].forEach(k=>{if(o[k]!=null)AI[k]=o[k]})}}catch(e){}
  AI.traits=AI.traits.filter(k=>TR[k]);AI.champs=AI.champs.filter(i=>CH[i])})();
function aiSave(){try{localStorage.setItem('tftb19ai',JSON.stringify({opts:AI.opts,lv:AI.lv,traits:AI.traits,champs:AI.champs,unlock:AI.unlock,text:AI.text}))}catch(e){}}

const isFront=ch=>/Tank|Fighter/.test(ch.role||'');
const isTank=ch=>/Tank/.test(ch.role||'');
const RANK={bronze:1,silver:2,gold:3,chromatic:4};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PICK_TR=D.traits.filter(t=>!isUnique(t)&&CH.some(c=>c.traits.includes(t.key))).sort(byName);

/* ───────────── 문장 해석 ───────────── */
const ALIAS={
  MissFortune:['미포','미스포츈'],TwistedFate:['트페','트위스티드페이트'],NunuWillump:['누누','누누와윌럼프'],DrMundo:['문도','문도박사'],
  LeeSin:['리신'],RenataGlasc:['레나타','레나타글라스크'],BaronNashor:['내셔','바론','내셔남작'],KSante:['크산테'],KaiSa:['카이사'],
  SeraphineRisingStar:['라이징스타세라핀'],SeraphineSuperstar:['슈퍼스타세라핀'],Tibbers:['티버스'],Kobuko:['코부코']
};
const TALIAS={Heartsteel:['하트스틸','heartsteel'],IonicSpark:['아이오닉','아이오닉스파크','ionicspark','ionic spark'],TrueDamage:['트루데미지','truedamage','true damage','트루뎀'],
  KDA:['kda','k/da','케이다','카다'],OneMonsterBand:['원몬스터밴드','onemonsterband'],EDM:['edm','이디엠'],RnB:['r&b','알앤비','rnb'],'8Bit':['8비트','8bit'],Rock:['락']};
const PART='(?:이랑|이가|이는|이를|이나|이고|이도|에게|으로|하고|이|가|은|는|을|를|와|과|랑|도|만|의|로|나)?';
function rx(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s*')}
const ENT=(()=>{const L=[];const seen=new Set();
  const add=(n,type,key)=>{const k=type+key+n;if(seen.has(k))return;seen.add(k);L.push({n,type,key})};
  CH.forEach(c=>{if(/\(/.test(c.name))return;add(c.name,'c',c.i)});
  CH.forEach(c=>{if(/\(/.test(c.name)){const b=c.name.replace(/\s*\(.*\)/,'');if(!CH.some(o=>o.name===b))add(b,'c',c.i)}});
  Object.entries(ALIAS).forEach(([k,a])=>{const c=CH.find(x=>x.key===k);if(c)a.forEach(n=>add(n,'c',c.i))});
  D.traits.forEach(t=>{if(CH.some(c=>c.traits.includes(t.key)))add(t.name,'t',t.key)});
  Object.entries(TALIAS).forEach(([k,a])=>{if(TR[k])a.forEach(n=>add(n,'t',k))});
  L.sort((a,b)=>b.n.replace(/\s/g,'').length-a.n.replace(/\s/g,'').length);
  L.forEach(e=>e.re=new RegExp('(^|[^가-힣a-z0-9])('+rx(e.n.toLowerCase())+')(?='+PART+'(?:[^가-힣a-z0-9]|$))','g'));
  return L})();

function aiParse(text){
  const s=' '+(text||'').toLowerCase()+' ';
  const r={champs:[],carry:[],exC:[],traits:{},exT:[],only:null,min:null,max:null,exCost:[],pref:[],lv:null,ratio:null,bias:0,opts:[],unlock:null,said:[]};
  const used=new Array(s.length).fill(false);
  for(const e of ENT){
    e.re.lastIndex=0;let m;
    while((m=e.re.exec(s))){
      const st=m.index+m[1].length,en=st+m[2].length;
      if(used.slice(st,en).some(Boolean))continue;
      for(let i=st;i<en;i++)used[i]=true;
      const after=s.slice(en,en+14),before=s.slice(Math.max(0,st-10),st);
      const neg=/^\s*(?:은|는|을|를|이|가|도)?\s*(?:빼|제외|없이|말고|금지|싫|넣지|쓰지|안\s*넣|안\s*쓰)/.test(after);
      if(e.type==='c'){
        if(neg){r.exC.push(e.key);continue}
        if(!r.champs.includes(e.key))r.champs.push(e.key);
        if(/^\s*(?:이|가|을|를|은|는|로|으로|의)?\s*(?:캐리|메인|주력|핵심|딜러|에이스)/.test(after)||/(?:캐리|메인|주력|에이스)\s*(?:는|은|로|으로|가)?\s*$/.test(before))r.carry.push(e.key);
      }else{
        if(neg){r.exT.push(e.key);continue}
        let n=null;const a=after.match(/^\s*(\d{1,2})(?!\s*(?:코|레벨|렙|lv|:|레))/),b=before.match(/(\d{1,2})\s*$/);
        if(a)n=+a[1];else if(b)n=+b[1];
        r.traits[e.key]=Math.max(r.traits[e.key]||0,n||0);
      }
    }
  }
  const C='([1-57])\\s*(?:코스트|코|cost)';
  let m;
  if((m=s.match(/((?:[1-57]\s*(?:코스트|코)?\s*(?:,|\/|와|과|랑|이랑|및|하고|or|\+)?\s*)+)\s*(?:코스트|코|cost)\s*(?:짜리|기물|챔피언|유닛)?\s*(?:로만|으로만|만|only|뿐)/)))r.only=[...new Set(m[1].match(/[1-57]/g).map(Number))];
  if((m=s.match(new RegExp(C+'\\s*(?:이상|부터|초과)'))))r.min=+m[1];
  if((m=s.match(new RegExp(C+'\\s*(?:이하|까지|미만)'))))r.max=+m[1];
  for(const x of s.matchAll(new RegExp(C+'\\s*(?:은|는|을|를|짜리는)?\\s*(?:빼|제외|없이|말고|금지)','g')))r.exCost.push(+x[1]);
  for(const x of s.matchAll(new RegExp(C+'\\s*(?:을|를|가|이)?\\s*(?:위주|중심|많이|많은|여러|다수)','g')))r.pref.push(+x[1]);
  if((m=s.match(/(\d{1,2})\s*(?:레벨|렙|lv|level)/))||(m=s.match(/(?:레벨|렙|lv|level)\s*(\d{1,2})/))||(m=s.match(/(\d{1,2})\s*인\s*(?:덱|조합|구성|으로|기준|$|\s)/)))r.lv=Math.max(1,Math.min(10,+m[1]));
  if((m=s.match(/([1-9])\s*(?::|：|\s대\s)\s*([1-9])/)))r.ratio=[+m[1],+m[2]];
  if(/(탱커|앞\s*라인|전방|탱)\s*(?:을|를|가|이)?\s*(많이|위주|두껍|튼튼|많은|든든|빵빵)/.test(s))r.bias=1;
  if(/(딜러|뒷\s*라인|후방)\s*(?:을|를|가|이)?\s*(많이|위주|많은|빵빵)/.test(s))r.bias=-1;
  if(/깔끔|버리는\s*시너지|버림\s*없|낭비\s*없/.test(s))r.opts.push('clean');
  if(/시너지\s*(?:를|가)?\s*(?:최대한\s*)?많|최대한\s*많은\s*시너지|많은\s*시너지|시너지\s*최대/.test(s))r.opts.push('many');
  if(/균형|밸런스|밸런싱/.test(s))r.opts.push('balance');
  if(/고\s*코|고밸류|하이\s*코스트|비싼/.test(s))r.opts.push('high');
  if(/저\s*코|리롤|저밸류|싼\s*기물|싸게/.test(s))r.opts.push('low');
  if(/해금\s*(?:기물|챔피언|유닛)?\s*(?:도|을|를)?\s*(?:포함|넣|허용|써|사용)/.test(s))r.unlock=true;
  if(/해금\s*(?:기물|챔피언|유닛)?\s*(?:은|는|을|를)?\s*(?:빼|제외|없이|말고)/.test(s))r.unlock=false;
  return r;
}

/* ───────────── 평가 함수 ───────────── */
function traitEval(cnt){
  let act=0,tier=0,dead=0,deadU=0,over=0,uniq=0;const det={};
  for(const t in cnt){
    const T=TR[t];if(!T)continue;const n=cnt[t];
    if(isUnique(T)){uniq++;det[t]={n,st:T.styles[0].style,k:0};continue}
    let k=-1;T.styles.forEach((x,i)=>{if(n>=x.min)k=i});
    if(k<0){dead++;deadU+=n;det[t]={n,st:'',k:-1};continue}
    act++;tier+=RANK[T.styles[k].style]+k*.35;
    const nx=T.styles[k+1];if(nx)over+=n-T.styles[k].min;
    det[t]={n,st:T.styles[k].style,k};
  }
  return{act,tier,dead,deadU,over,uniq,det};
}
function countOf(team){const cnt={};for(const i of team)for(const t of CH[i].traits)cnt[t]=(cnt[t]||0)+1;return cnt}

function score(team,X){
  const cnt=countOf(team),e=traitEval(cnt),N=team.length,o=X.opts;
  let S=e.tier*1.2+e.act*1.0+e.uniq*.5-e.deadU*.7-e.over*.3;
  if(o.has('clean'))S+=-e.dead*5-e.deadU*1.5-e.over*1.4+e.act*.5;
  if(o.has('many'))S+=e.act*3.5-e.uniq*.5-e.tier*.3; // 고유 시너지(1인 특성)는 개수에 넣지 않음
  let f=0;for(const i of team)if(isFront(CH[i]))f++;
  const ff=f/N;
  if(X.ratio){S-=Math.abs(ff-X.ratio)*28}
  else if(o.has('balance')){let d=1;for(const r of [.6,.7,.8,.9])d=Math.min(d,Math.abs(ff-r));S-=d*30+(ff<.55?6:0)}
  else{if(f<Math.round(N*.3))S-=(Math.round(N*.3)-f)*3;if(N-f<Math.round(N*.25))S-=(Math.round(N*.25)-(N-f))*3}
  if(X.bias)S+=X.bias*f*1.4;
  let cs=0;
  for(const i of team){const c=CH[i].cs;cs+=c;
    if(o.has('high'))S+=c>=4?2.2+(c>=5?.6:0):c===3?-.4:-1.6;
    if(o.has('low'))S+=c<=3?1.6-(c===3?.3:0):-2.2;
    if(X.pref.length&&X.pref.includes(c))S+=1.8;
    if(!o.has('high')&&!o.has('low'))S+=c*X.pw;
    if(X.lv<=6&&c>=5&&!o.has('high'))S-=2.5;
  }
  if(!o.has('high')&&X.lv<=8){let f5=0;for(const i of team)if(CH[i].cs>=5)f5++;if(f5>2)S-=(f5-2)*2.5}
  for(const t in X.want){const tgt=X.want[t],n=cnt[t]||0;S+=Math.min(n,tgt)*6-(n<tgt?(tgt-n)*5:0)+(n>=tgt?8:0)}
  for(const c of X.carry)for(const t of CH[c].traits){const d=e.det[t];if(d&&d.k>=0)S+=2+d.k*1.2}
  return S;
}

/* ───────────── 탐색 ───────────── */
function buildCtx(){
  const p=aiParse(AI.text);
  const opts=new Set([...AI.opts,...p.opts]);
  if(p.opts.includes('high'))opts.delete('low');if(p.opts.includes('low'))opts.delete('high');
  const lv=p.lv||AI.lv;
  const unlock=p.unlock!=null?p.unlock:AI.unlock;
  const exC=new Set(p.exC);
  const base=i=>CH[i].base;
  const req=[];const addReq=i=>{if(!exC.has(i)&&!req.some(j=>base(j)===base(i)))req.push(i)};
  p.carry.forEach(addReq);AI.champs.forEach(addReq);p.champs.forEach(addReq);
  const want={},capNotes=[];
  const costOk=c=>(!p.only||p.only.includes(c))&&(p.min==null||c>=p.min)&&(p.max==null||c<=p.max)&&!p.exCost.includes(c);
  const usable=c=>!exC.has(c.i)&&(req.includes(c.i)||costOk(c.cs))&&((unlock||!c.unlock)&&!(c.unlock&&c.unlock.level>lv)||req.includes(c.i));
  const tgtFor=(t,n)=>{const T=TR[t],mins=T.styles.map(s=>s.min),avail=new Set(CH.filter(c=>c.traits.includes(t)&&usable(c)).map(c=>c.base)).size;
    if(n){if(n>avail)capNotes.push(`${T.name}은(는) 지금 조건에서 최대 ${avail}까지만 가능해요`);return Math.min(n,avail)}let g=mins[0];for(const m of mins)if(m<=Math.max(2,Math.ceil(lv*.6))&&m<=avail)g=m;return Math.min(g,avail)};
  AI.traits.forEach(t=>{if(!p.exT.includes(t))want[t]=tgtFor(t,0)});
  Object.entries(p.traits).forEach(([t,n])=>{want[t]=Math.max(want[t]&&!n?want[t]:0,tgtFor(t,n))});
  const exT=new Set(p.exT);
  const pool=CH.filter(c=>!req.includes(c.i)&&!exC.has(c.i)&&costOk(c.cs)&&!c.traits.some(t=>exT.has(t))&&(unlock||!c.unlock)&&!(c.unlock&&c.unlock.level>lv)).map(c=>c.i);
  let N=lv;const notes=capNotes;
  if(req.length>N){notes.push(`고정 기물이 ${req.length}개라 레벨 ${N}보다 많아요. ${req.length}기로 구성했어요`);N=req.length}
  const bases=new Set(pool.filter(i=>!req.some(j=>base(j)===base(i))).map(base));
  if(req.length+bases.size<N){notes.push(`조건에 맞는 기물이 ${req.length+bases.size}개뿐이라 ${req.length+bases.size}기로 구성했어요`);N=req.length+bases.size}
  const ratio=p.ratio?p.ratio[0]/(p.ratio[0]+p.ratio[1]):null;
  const pw=lv>=9?.4:lv>=7?.22:.1;
  return{p,opts,lv,N,req,pool,want,carry:p.carry.filter(i=>req.includes(i)),ratio,bias:p.bias,pref:p.pref,pw,unlock,notes,costOk,exT};
}

function solve(X){
  const {req,pool,N}=X;
  const free=N-req.length;
  if(free<=0)return[{team:req.slice(),s:score(req,X)}];
  const byT={};pool.forEach(i=>CH[i].traits.forEach(t=>(byT[t]=byT[t]||[]).push(i)));
  const rnd=a=>a[Math.floor(Math.random()*a.length)];
  const out=[];const R=22,IT=1100;
  for(let r=0;r<R;r++){
    let team=req.slice();const bs=new Set(team.map(i=>CH[i].base));
    while(team.length<N){
      let best=null,sc=-1e9,k=r%2?5:12;
      for(let q=0;q<k*3&&q<200;q++){const i=rnd(pool);if(bs.has(CH[i].base))continue;const v=score(team.concat(i),X)+Math.random()*3;if(v>sc){sc=v;best=i}if(--k<=0)break}
      if(best==null){best=pool.find(i=>!bs.has(CH[i].base));if(best==null)break}
      team.push(best);bs.add(CH[best].base);
    }
    let cur=score(team,X),bestT=team.slice(),bestS=cur;
    for(let it=0;it<IT;it++){
      const T=2.5*Math.pow(.02/2.5,it/IT);
      const pos=req.length+Math.floor(Math.random()*(team.length-req.length));
      let ni;
      if(Math.random()<.6){const src=team[Math.floor(Math.random()*team.length)];const l=byT[rnd(CH[src].traits)];ni=l?rnd(l):rnd(pool)}else ni=rnd(pool);
      const nb=CH[ni].base;
      if(ni===team[pos]||team.some((j,k)=>k!==pos&&CH[j].base===nb))continue;
      const nt=team.slice();nt[pos]=ni;
      const ns=score(nt,X);
      if(ns>=cur||Math.random()<Math.exp((ns-cur)/T)){team=nt;cur=ns;if(ns>bestS){bestS=ns;bestT=nt.slice()}}
    }
    out.push({team:bestT,s:bestS});
  }
  out.sort((a,b)=>b.s-a.s);
  const res=[];
  for(const o of out){
    const key=new Set(o.team);
    if(res.some(x=>x.team.filter(i=>key.has(i)).length>N-2))continue;
    res.push(o);if(res.length>=3)break;
  }
  return res;
}

/* ───────────── 배치 ───────────── */
function layout(team,carry){
  const b={};
  const ord=[3,2,4,1,5,0,6];
  const fr=team.filter(i=>isFront(CH[i])).sort((a,c)=>(carry.includes(c)-carry.includes(a))||(isTank(CH[c])-isTank(CH[a]))||CH[c].cs-CH[a].cs);
  const bk=team.filter(i=>!isFront(CH[i])).sort((a,c)=>(carry.includes(c)-carry.includes(a))||CH[c].cs-CH[a].cs);
  const fCells=[...ord.map(c=>c),...ord.map(c=>COLS+c)];
  const bCells=[...[0,6,1,5,2,4,3].map(c=>3*COLS+c),...[0,6,1,5,2,4,3].map(c=>2*COLS+c)];
  // 앞라인: 캐리 → 탱커 → 나머지 순으로 첫 줄 중앙부터, 뒷라인: 캐리를 맨 뒷줄 구석부터
  fr.forEach(i=>{const x=fCells.find(x=>!b[x]);if(x!=null)b[x]={c:i,s:1,i:[]}});
  bk.forEach(i=>{const x=bCells.find(x=>!b[x])??[...Array(CELLS).keys()].find(x=>!b[x]);if(x!=null)b[x]={c:i,s:1,i:[]}});
  return b;
}
function aiApply(k){
  const r=AI.res&&AI.res.list[k];if(!r)return;
  AI.pick=k;sel=null;armed=null;held=null;
  commit(()=>{B=layout(r.team,AI.res.carry)});
  if(full){full=false;$('drawer').classList.remove('full')}
  toast(`${r.team.length}기 배치 완료`);
}

/* ───────────── 실행 & 설명 ───────────── */
function aiRun(){
  const ta=$('aiText');if(ta)AI.text=ta.value;aiSave();
  const X=buildCtx();
  if(!X.N){toast('조건에 맞는 기물이 없어요');AI.res={list:[],notes:['조건에 맞는 기물이 없어요. 조건을 조금 풀어 주세요'],chips:aiChips(X),carry:[]};renderBody();return}
  const list=solve(X).map(o=>Object.assign(o,{why:explain(o.team,X)}));
  AI.res={list,notes:X.notes,chips:aiChips(X),carry:X.carry};
  AI.pick=0;renderBody();
  if(list.length)aiApply(0);
}
function aiChips(X){
  const c=[];const p=X.p;
  c.push(`레벨 ${X.lv} · ${X.N}기`);
  [...X.opts].forEach(o=>{const f=AI_OPTS.find(x=>x[0]===o);if(f)c.push(f[1])});
  X.carry.forEach(i=>c.push('캐리 '+CH[i].name));
  X.req.filter(i=>!X.carry.includes(i)).forEach(i=>c.push('고정 '+CH[i].name));
  Object.entries(X.want).forEach(([t,n])=>c.push(`${TR[t].name} ${n}+`));
  if(p.only)c.push(p.only.join('·')+'코만');
  if(p.min!=null)c.push(p.min+'코 이상');if(p.max!=null)c.push(p.max+'코 이하');
  p.exCost.forEach(n=>c.push(n+'코 제외'));p.pref.forEach(n=>c.push(n+'코 위주'));
  p.exC.forEach(i=>c.push(CH[i].name+' 제외'));p.exT.forEach(t=>c.push(TR[t].name+' 제외'));
  if(p.ratio)c.push(`앞:뒤 ${p.ratio[0]}:${p.ratio[1]}`);
  if(X.bias>0)c.push('앞라인 두껍게');if(X.bias<0)c.push('뒷라인 많이');
  c.push(X.unlock?'해금 포함':'해금 제외');
  return c;
}
function explain(team,X){
  const cnt=countOf(team),e=traitEval(cnt);
  const f=team.filter(i=>isFront(CH[i])).length;
  const avg=team.reduce((a,i)=>a+CH[i].cs,0)/team.length;
  const act=Object.entries(e.det).filter(([t,d])=>d.k>=0&&!isUnique(TR[t])).sort((a,b)=>RANK[b[1].st]-RANK[a[1].st]||b[1].n-a[1].n);
  const top=act.slice(0,3).map(([t,d])=>`${TR[t].name} ${d.n}`).join(' · ');
  const bits=[];
  if(X.carry.length)bits.push(X.carry.map(i=>CH[i].name).join('·')+' 캐리');
  if(top)bits.push(top+' 중심');
  if(e.dead===0&&e.over===0)bits.push('버리는 시너지 0');else if(e.dead===0)bits.push('비활성 시너지 없음');
  return{text:bits.join(', '),act:e.act,dead:e.dead,f,b:team.length-f,avg,det:e.det};
}

/* ───────────── UI ───────────── */
function aiToggleOpt(o){const s=new Set(AI.opts);if(s.has(o))s.delete(o);else{s.add(o);if(o==='high')s.delete('low');if(o==='low')s.delete('high')}AI.opts=[...s];aiSave();renderBody()}
function aiSetLv(n){AI.lv=n;aiSave();renderBody()}
function aiToggleUnlock(){AI.unlock=!AI.unlock;aiSave();renderBody()}
function aiTxt(v){AI.text=v;aiSave()}
function aiDelT(t){AI.traits=AI.traits.filter(x=>x!==t);aiSave();renderBody()}
function aiDelC(i){AI.champs=AI.champs.filter(x=>x!==i);aiSave();renderBody()}
function aiTogT(t){AI.traits=AI.traits.includes(t)?AI.traits.filter(x=>x!==t):AI.traits.concat(t);aiSave();aiPickT();renderBody()}
function aiTogC(i){AI.champs=AI.champs.includes(i)?AI.champs.filter(x=>x!==i):AI.champs.concat(i);aiSave();aiPickC();renderBody()}
function aiPickT(){
  const sc=$('sheet').classList.contains('on')?$('sheet').querySelector('.box').scrollTop:0;
  openSheet(`<div class="ttl">원하는 시너지 선택</div><div class="aitg">${PICK_TR.map(t=>`<button class="${AI.traits.includes(t.key)?'on':''}" onclick="aiTogT('${t.key}')"><img src="${t.img}" alt="">${t.name}<small>${t.styles.map(s=>s.min).join('/')}</small></button>`).join('')}</div>`);
  $('sheet').querySelector('.box').scrollTop=sc;
}
function aiPickC(){
  const sc=$('sheet').classList.contains('on')?$('sheet').querySelector('.box').scrollTop:0;
  openSheet(`<div class="ttl">원하는 기물 선택</div>${COSTS.map(c=>{const l=CH.filter(ch=>ch.cs===c).sort(byName);return l.length?`<div class="sec">${c}코스트</div><div class="grid">${l.map(ch=>`<div class="ct k${ch.cs} ${AI.champs.includes(ch.i)?'pk':''}" onclick="aiTogC(${ch.i})"><div class="pf"><img src="${ch.img}" alt="">${ch.unlock?'<span class="ul">해금</span>':''}</div><div class="n">${ch.name}</div></div>`).join('')}</div>`:''}).join('')}`);
  $('sheet').querySelector('.box').scrollTop=sc;
}

function aiResult(){
  const R=AI.res;if(!R)return'';
  let s=`<div class="aisec">AI가 이해한 조건</div><div class="aichips">${R.chips.map(c=>`<span>${esc(c)}</span>`).join('')}</div>`;
  if(R.notes.length)s+=R.notes.map(n=>`<div class="ainote">${esc(n)}</div>`).join('');
  if(!R.list.length)return s;
  s+=`<div class="aisec">추천 덱 · 탭하면 배치</div>`;
  s+=R.list.map((r,k)=>{const w=r.why;
    const trs=Object.entries(w.det).filter(([t,d])=>TR[t]).sort((a,b)=>(b[1].k>=0)-(a[1].k>=0)||(RANK[b[1].st]||0)-(RANK[a[1].st]||0)||b[1].n-a[1].n);
    return `<div class="aicard ${AI.pick===k?'on':''}" onclick="aiApply(${k})"><div class="aih"><b>${k===0?'최적':'대안 '+k}</b><span>${esc(w.text)}</span>${AI.pick===k?'<em>배치됨</em>':''}</div>
    <div class="aiu">${r.team.slice().sort((a,b)=>CH[a].cs-CH[b].cs||byName(CH[a],CH[b])).map(i=>`<div class="k${CH[i].cs}${R.carry.includes(i)?' cr':''}"><img src="${CH[i].img}" alt=""><span>${CH[i].name}</span></div>`).join('')}</div>
    <div class="ait">${trs.map(([t,d])=>`<span class="${d.st||'off'}"><img src="${TR[t].img}" alt="">${d.n}</span>`).join('')}</div>
    <div class="aim">활성 시너지 ${w.act} · 비활성 ${w.dead} · 앞:뒤 ${w.f}:${w.b} · 평균 ${w.avg.toFixed(1)}코</div></div>`}).join('');
  return s;
}

function aiBody(){
  return `<div class="ai">
  <div class="aisec">빌드 방식 <small>중복 선택 가능</small></div>
  <div class="aiopt">${AI_OPTS.map(([k,n,d])=>`<button class="${AI.opts.includes(k)?'on':''}" onclick="aiToggleOpt('${k}')"><b>${n}</b><small>${d}</small></button>`).join('')}</div>
  <div class="aisec">레벨 <small>= 기물 수</small></div>
  <div class="seg">${[5,6,7,8,9,10].map(n=>`<button class="${AI.lv===n?'on':''}" onclick="aiSetLv(${n})">${n}</button>`).join('')}</div>
  <div class="aisec">원하는 시너지</div>
  <div class="aisel">${AI.traits.map(t=>`<button onclick="aiDelT('${t}')"><img src="${TR[t].img}" alt="">${TR[t].name} ✕</button>`).join('')}<button class="add" onclick="aiPickT()">+ 시너지</button></div>
  <div class="aisec">원하는 기물</div>
  <div class="aisel">${AI.champs.map(i=>`<button class="k${CH[i].cs}" onclick="aiDelC(${i})"><img class="cimg" src="${CH[i].img}" alt="">${CH[i].name} ✕</button>`).join('')}<button class="add" onclick="aiPickC()">+ 기물</button></div>
  <label class="aiun"><input type="checkbox" ${AI.unlock?'checked':''} onchange="aiToggleUnlock()"> 해금 기물도 사용 <small>(직접 고른 기물은 항상 포함)</small></label>
  <div class="aisec">AI에게 부탁하기</div>
  <textarea id="aiText" class="aita" placeholder="예) 진이 캐리 기물로 있는 4코스트로만 구성된 덱을 만들어줘" oninput="aiTxt(this.value)">${esc(AI.text)}</textarea>
  <button class="aigo" onclick="aiRun()">${AI.res?'다시 돌리기':'AI 덱 짜기'}</button>
  ${aiResult()}
  </div>`;
}
