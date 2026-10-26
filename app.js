const TEMPOS={largo:{label:'Largo',ratio:1.6,hint:'충분히 생각하며 · 1.60×'},adagio:{label:'Adagio',ratio:1.35,hint:'천천히 정확하게 · 1.35×'},andante:{label:'Andante',ratio:1.15,hint:'기본보다 조금 여유롭게 · 1.15×'},allegro:{label:'Allegro',ratio:.9,hint:'빠른 계산 연습 · 0.90×'},presto:{label:'Presto',ratio:.7,hint:'최고 속도 도전 · 0.70×'}};
const MODES={decimal:{label:'소수 덧셈·뺄셈',seconds:12},multiply:{label:'한 자리 곱셈',seconds:8},mixed:{label:'혼합 계산',seconds:15},hess:{label:'헤스 법칙',seconds:75}};
const state={mode:'decimal',count:20,tempo:'andante',questions:[],index:0,score:0,combo:0,bestCombo:0,correct:0,attempted:0,mistakes:[],questionStart:0,sessionStart:0,timer:null,remaining:0,locked:false};
const $=id=>document.getElementById(id);
const screens=['setupScreen','quizScreen','resultScreen'];
function show(id){screens.forEach(x=>$(x).classList.toggle('hidden',x!==id));window.scrollTo({top:0,behavior:'smooth'})}
function oneDecimal(n){return Math.round(n*10)/10}
function formatTime(sec){sec=Math.max(0,Math.round(sec));return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`}
function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
function pick(a){return a[Math.floor(Math.random()*a.length)]}

function calcQuestion(mode){
  if(mode==='multiply'){const a=Math.floor(Math.random()*8)+2,b=Math.floor(Math.random()*91)+10;return {kind:'calc',html:`<div class="calc-expression">${b} × ${a}</div>`,answer:b*a,explanation:`${b}를 ${a}번 더하면 ${b*a}입니다.`}}
  const a=oneDecimal(100+Math.random()*850),b=oneDecimal(10+Math.random()*Math.min(500,a-1));
  if(mode==='decimal'){const plus=Math.random()>.48,answer=oneDecimal(plus?a+b:a-b);return {kind:'calc',html:`<div class="calc-expression">${a.toFixed(1)} ${plus?'+':'−'} ${b.toFixed(1)}</div>`,answer,explanation:`소수점을 맞춰 계산하면 ${answer.toFixed(1)}입니다.`}}
  if(Math.random()>.55){const k=Math.floor(Math.random()*8)+2;return {kind:'calc',html:`<div class="calc-expression">${a.toFixed(1)} × ${k}</div>`,answer:oneDecimal(a*k),explanation:`${a.toFixed(1)}을 ${k}배 하면 ${oneDecimal(a*k).toFixed(1)}입니다.`}}
  const c=oneDecimal(10+Math.random()*200),answer=oneDecimal(a-b+c);return {kind:'calc',html:`<div class="calc-expression">${a.toFixed(1)} − ${b.toFixed(1)} + ${c.toFixed(1)}</div>`,answer,explanation:`왼쪽부터 계산하면 ${answer.toFixed(1)}입니다.`}
}

const HESS_TEMPLATES=[
 {goal:'C(s) + O₂(g) → CO₂(g)',rows:['C(s) + ½O₂(g) → CO(g)|{a}','CO(g) + ½O₂(g) → CO₂(g)|{b}'],op:(a,b)=>a+b,ex:'두 반응식을 그대로 더하면 중간 생성물 CO가 소거됩니다.'},
 {goal:'N₂(g) + O₂(g) → 2NO(g)',rows:['N₂(g) + 2O₂(g) → 2NO₂(g)|{a}','2NO(g) + O₂(g) → 2NO₂(g)|{b}'],op:(a,b)=>a-b,ex:'두 번째 반응을 뒤집어 더하므로 ΔH₂의 부호를 바꿉니다.'},
 {goal:'2C(s) + 2H₂(g) → C₂H₄(g)',rows:['C(s) + O₂(g) → CO₂(g)|{a}','H₂(g) + ½O₂(g) → H₂O(l)|{b}','C₂H₄(g) + 3O₂(g) → 2CO₂(g) + 2H₂O(l)|{c}'],op:(a,b,c)=>2*a+2*b-c,ex:'앞의 두 반응은 각각 2배하고, 에틸렌 연소 반응은 뒤집어 합합니다.'},
 {goal:'2SO₂(g) + O₂(g) → 2SO₃(g)',rows:['S(s) + O₂(g) → SO₂(g)|{a}','2S(s) + 3O₂(g) → 2SO₃(g)|{b}'],op:(a,b)=>b-2*a,ex:'첫 반응을 2배한 뒤 뒤집고 두 번째 반응과 더합니다.'},
 {goal:'CH₄(g) + 2O₂(g) → CO₂(g) + 2H₂O(l)',rows:['C(s) + 2H₂(g) → CH₄(g)|{a}','C(s) + O₂(g) → CO₂(g)|{b}','H₂(g) + ½O₂(g) → H₂O(l)|{c}'],op:(a,b,c)=>b+2*c-a,ex:'CH₄ 생성 반응을 뒤집고, 물 생성 반응은 2배하여 더합니다.'},
 {goal:'H₂(g) + Cl₂(g) → 2HCl(g)',rows:['½H₂(g) + ½Cl₂(g) → HCl(g)|{a}'],op:a=>2*a,ex:'목표 반응의 계수가 2배이므로 ΔH도 2배합니다.'},
 {goal:'CaCO₃(s) → CaO(s) + CO₂(g)',rows:['Ca(s) + ½O₂(g) → CaO(s)|{a}','C(s) + O₂(g) → CO₂(g)|{b}','Ca(s) + C(s) + 3/2O₂(g) → CaCO₃(s)|{c}'],op:(a,b,c)=>a+b-c,ex:'CaCO₃ 생성 반응을 뒤집고 나머지 생성 반응과 더합니다.'},
 {goal:'2H₂O₂(l) → 2H₂O(l) + O₂(g)',rows:['H₂(g) + O₂(g) → H₂O₂(l)|{a}','H₂(g) + ½O₂(g) → H₂O(l)|{b}'],op:(a,b)=>2*(b-a),ex:'두 반응의 차로 H₂O₂ 1몰 분해 반응을 만든 뒤 전체를 2배합니다.'},
 {goal:'CO₂(g) + H₂(g) → CO(g) + H₂O(g)',rows:['CO(g) + ½O₂(g) → CO₂(g)|{a}','H₂(g) + ½O₂(g) → H₂O(g)|{b}'],op:(a,b)=>b-a,ex:'CO 연소 반응을 뒤집어 수소 연소 반응과 더합니다.'},
 {goal:'2NH₃(g) → N₂(g) + 3H₂(g)',rows:['N₂(g) + 3H₂(g) → 2NH₃(g)|{a}'],op:a=>-a,ex:'목표 반응은 주어진 반응의 역반응이므로 ΔH의 부호만 바꿉니다.'}
];
const HESS_VALUES=[[-111,-283],[-68,-114],[-394,-286,-1411],[-297,-792],[-75,-394,-286],[-92],[-635,-394,-1207],[-188,-286],[-283,-242],[-92]];
function createHessBank(){const bank=[];HESS_TEMPLATES.forEach((t,ti)=>{for(let v=0;v<4;v++){const vals=HESS_VALUES[ti].map((n,i)=>oneDecimal(n+(v*7*(i%2?1:-1))));const answer=oneDecimal(t.op(...vals));const rows=t.rows.map((r,i)=>{const [rx]=r.split('|');return `${rx}|${vals[i].toFixed(1)}`});bank.push({kind:'hess',goal:t.goal,rows,answer,explanation:`${t.ex} 따라서 ΔH = ${answer.toFixed(1)} kJ입니다.`})}});return bank}

function hessHtml(q){return `<div class="hess-question"><p class="hess-goal">목표: ${q.goal}</p><div class="reaction-list">${q.rows.map((r,i)=>{const [rx,h]=r.split('|');return `<div class="reaction"><span>${i+1}. ${rx}</span><span class="enthalpy">ΔH = ${h} kJ</span></div>`}).join('')}</div><p class="hess-prompt">목표 반응의 ΔH를 구하세요.</p></div>`}
function buildQuestions(){if(state.mode==='hess'){const bank=shuffle(createHessBank()),result=[];while(result.length<state.count)result.push(...shuffle(bank));return result.slice(0,state.count)}return Array.from({length:state.count},()=>calcQuestion(state.mode))}
function questionLimit(){return Math.round(MODES[state.mode].seconds*TEMPOS[state.tempo].ratio)}
function updateEstimate(){const total=state.count*questionLimit();$('timeEstimate').textContent=total<60?`${total}초`:`${Math.floor(total/60)}분 ${total%60}초`}
function selectButton(container,button){container.querySelectorAll('button').forEach(b=>b.classList.remove('active'));button.classList.add('active')}

function start(){state.questions=buildQuestions();state.index=0;state.score=0;state.combo=0;state.bestCombo=0;state.correct=0;state.attempted=0;state.mistakes=[];state.sessionStart=Date.now();show('quizScreen');renderQuestion()}
function renderQuestion(){clearInterval(state.timer);state.locked=false;const q=state.questions[state.index];$('questionContent').innerHTML=q.kind==='hess'?hessHtml(q):q.html;$('answerInput').value='';$('answerUnit').textContent=q.kind==='hess'?'kJ':'';$('feedback').textContent='';$('feedback').className='feedback';$('progressText').textContent=`${state.index+1} / ${state.count}`;$('progressBar').style.width=`${state.index/state.count*100}%`;$('modeLabel').textContent=MODES[state.mode].label;$('tempoLabel').textContent=TEMPOS[state.tempo].label;state.remaining=questionLimit();state.questionStart=Date.now();updateLive();state.timer=setInterval(()=>{state.remaining--;updateLive();if(state.remaining<=0)submit(true)},1000);setTimeout(()=>$('answerInput').focus(),50)}
function updateLive(){$('scoreText').textContent=state.score.toLocaleString();$('comboText').textContent=state.combo;$('correctText').textContent=`${state.correct} / ${state.attempted}`;$('timerText').textContent=formatTime(state.remaining)}
function submit(timeout=false){if(state.locked)return;const raw=$('answerInput').value.trim();if(!timeout&&(raw===''||raw==='-'||raw==='.'))return;state.locked=true;clearInterval(state.timer);const q=state.questions[state.index],value=Number(raw),correct=!timeout&&Number.isFinite(value)&&Math.abs(value-q.answer)<.051;state.attempted++;if(correct){state.correct++;state.combo++;state.bestCombo=Math.max(state.bestCombo,state.combo);const speed=Math.max(0,Math.round(100*(state.remaining/questionLimit())));const bonus=Math.min(100,state.combo*10);state.score+=100+speed+bonus;$('feedback').textContent=`정답 · +${100+speed+bonus}점`;$('feedback').className='feedback correct'}else{state.mistakes.push({...q,user:timeout?'시간 초과':raw||'미입력'});state.combo=0;$('feedback').textContent=timeout?`시간 초과 · 정답 ${q.answer.toFixed(1)}`:`정답은 ${q.answer.toFixed(1)}`;$('feedback').className='feedback wrong'}updateLive();setTimeout(next,correct?500:900)}
function next(){state.index++;if(state.index>=state.count)return finish();renderQuestion()}
function finish(){clearInterval(state.timer);const elapsed=Math.round((Date.now()-state.sessionStart)/1000);$('finalScore').textContent=state.score.toLocaleString();$('finalCorrect').textContent=`${state.correct} / ${state.count}`;$('finalAccuracy').textContent=`${Math.round(state.correct/state.count*100)}%`;$('finalCombo').textContent=state.bestCombo;$('finalTime').textContent=formatTime(elapsed);const review=$('reviewBox');review.classList.toggle('hidden',!state.mistakes.length);$('reviewCount').textContent=`${state.mistakes.length}문제`;$('reviewList').innerHTML=state.mistakes.map((q,i)=>`<div class="review-item"><p><b>${i+1}.</b> ${q.kind==='hess'?q.goal:q.html.replace(/<[^>]*>/g,'')}</p><p>내 답: ${q.user} · <span class="review-answer">정답: ${q.answer.toFixed(1)}</span></p><p class="review-explanation">${q.explanation}</p></div>`).join('');show('resultScreen')}

$('modeOptions').addEventListener('click',e=>{const b=e.target.closest('button[data-mode]');if(!b)return;selectButton($('modeOptions'),b);state.mode=b.dataset.mode;updateEstimate()});
$('countOptions').addEventListener('click',e=>{const b=e.target.closest('button[data-count]');if(!b)return;selectButton($('countOptions'),b);state.count=Number(b.dataset.count);updateEstimate()});
$('tempoOptions').addEventListener('click',e=>{const b=e.target.closest('button[data-tempo]');if(!b)return;selectButton($('tempoOptions'),b);state.tempo=b.dataset.tempo;$('tempoHint').textContent=TEMPOS[state.tempo].hint;updateEstimate()});
$('startButton').addEventListener('click',start);$('submitButton').addEventListener('click',()=>submit(false));$('answerInput').addEventListener('keydown',e=>{if(e.key==='Enter')submit(false)});$('quitButton').addEventListener('click',()=>{clearInterval(state.timer);show('setupScreen')});$('retryButton').addEventListener('click',start);$('homeButton').addEventListener('click',()=>show('setupScreen'));
$('mobileKeypad').addEventListener('click',e=>{const b=e.target.closest('button[data-key]');if(!b)return;const input=$('answerInput'),key=b.dataset.key;if(key==='submit')return submit(false);if(key==='backspace')input.value=input.value.slice(0,-1);else if(key==='-'&&!input.value.includes('-'))input.value='-'+input.value;else if(key==='.'&&!input.value.includes('.'))input.value+=key;else if(/^\d$/.test(key))input.value+=key});
const mobile=matchMedia('(max-width: 720px)');function adaptInput(){if(mobile.matches){$('answerInput').readOnly=true;$('answerInput').setAttribute('inputmode','none')}else{$('answerInput').readOnly=false;$('answerInput').setAttribute('inputmode','decimal')}}mobile.addEventListener?.('change',adaptInput);adaptInput();updateEstimate();
