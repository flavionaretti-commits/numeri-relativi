(() => {
  'use strict';
  const MIN=-10, MAX=10;
  let currentScreen='homeScreen', elevatorValue=0, lineValue=0, answerValue=0;
  let lineFacing=1;
  let exStart=0, exMove=0, exTarget=0, soundOn=true, toastTimer=null, audioUnlocked=false;

  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const screens=$$('.screen');
  const audio={
    up:new Audio('assets/salgo.mp3'),
    down:new Audio('assets/scendi.mp3')
  };
  Object.values(audio).forEach(a=>{a.preload='auto';a.volume=.9});

  function signed(n){return n>0?`+${n}`:`${n}`}
  function klass(n){return n>0?'positive':n<0?'negative':'zero'}
  function clamp(v){return Math.max(MIN,Math.min(MAX,v))}
  function pct(v){return ((v-MIN)/(MAX-MIN))*90+5}
  function labelBottom(v){return ((v-MIN)/(MAX-MIN))*90+5}
  function separatorBottom(v){return (((v+.5)-MIN)/(MAX-MIN))*90+5}

  function showToast(msg){
    const el=$('#toast'); el.textContent=msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),1500);
  }

  function play(name){
    if(!soundOn) return;
    if(name==='intro'){ chime(); return; }
    const a=audio[name]; if(!a) return;
    try{a.currentTime=0;a.play().catch(()=>{});}catch(_){ }
  }
  function chime(){
    if(!soundOn) return;
    try{
      const ctx=new (window.AudioContext||window.webkitAudioContext)();
      [523.25,659.25,783.99].forEach((f,i)=>{
        const o=ctx.createOscillator(),g=ctx.createGain(),t=ctx.currentTime+i*.09;
        o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.12,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+.22);
        o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.24);
      });
      setTimeout(()=>ctx.close(),700);
    }catch(_){ }
  }
  function footstep(dir){
    if(!soundOn) return;
    try{
      const ctx=new (window.AudioContext||window.webkitAudioContext)();
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type='triangle';o.frequency.setValueAtTime(dir>0?210:170,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(90,ctx.currentTime+.08);
      g.gain.setValueAtTime(.0001,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.18,ctx.currentTime+.008);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.1);
      o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.11);setTimeout(()=>ctx.close(),250);
    }catch(_){ }
  }

  function setBadge(el,n){el.textContent=signed(n);el.className=`value-badge ${klass(n)}`}

  function showScreen(id,{playIntro=false}={}){
    screens.forEach(s=>s.classList.toggle('active',s.id===id)); currentScreen=id;
    const subtitles={homeScreen:'Scegli una rappresentazione',elevatorScreen:'Ascensore: positivo ↑ · negativo ↓',lineScreen:'Retta: positivo → · negativo ←',exerciseScreen:'Metti alla prova quello che hai capito'};
    $('#screenSubtitle').textContent=subtitles[id]||'';
    if(id==='elevatorScreen') updateElevator(false);
    if(id==='lineScreen') updateLine(false);
    if(playIntro && id!=='homeScreen') play('intro');
  }

  function buildElevator(){
    const scale=$('#floorScale'); scale.innerHTML='';
    for(let v=MIN;v<MAX;v++){
      const separator=document.createElement('div');
      separator.className='floor-separator';
      separator.style.bottom=`${separatorBottom(v)}%`;
      scale.appendChild(separator);
    }
    for(let v=MIN;v<=MAX;v++){
      const marker=document.createElement('div');
      marker.className='floor-marker';
      marker.style.bottom=`${labelBottom(v)}%`;
      const label=document.createElement('span');
      label.className=`floor-label ${klass(v)}`;
      label.textContent=signed(v);
      marker.appendChild(label);
      scale.appendChild(marker);
    }
  }
  function updateElevator(animate=true,dir=0){
    $('#liftCabin').style.bottom=`${labelBottom(elevatorValue)}%`;
    setBadge($('#elevatorValue'),elevatorValue);
    $('#elevatorPlus').disabled=elevatorValue>=MAX; $('#elevatorMinus').disabled=elevatorValue<=MIN;
    if(dir){
      const vector=$('#elevatorVector'); vector.className=`move-vector show ${dir>0?'positive':'negative'}`; vector.textContent=dir>0?'+1 ↑':'−1 ↓';
      const solly=$('#sollyElevator'); solly.classList.toggle('moving-up',dir>0); solly.classList.toggle('moving-down',dir<0);
      setTimeout(()=>{vector.classList.remove('show');solly.classList.remove('moving-up','moving-down')},520);
    }
  }
  function moveElevator(dir){
    const next=clamp(elevatorValue+dir); if(next===elevatorValue){showToast('Hai raggiunto il limite della scala.');return}
    elevatorValue=next; play(dir>0?'up':'down'); updateElevator(true,dir);
  }

  function buildNumberLine(container=$('#numberLine')){
    container.innerHTML='';
    for(let v=MIN;v<=MAX;v++){
      const x=pct(v);
      const tick=document.createElement('span');
      tick.className='number-tick';
      tick.style.left=`${x}%`;
      tick.dataset.value=v;
      const lab=document.createElement('span');
      lab.className=`number-label ${klass(v)}`;
      lab.style.left=`${x}%`;
      lab.dataset.value=v;
      lab.textContent=signed(v);
      container.append(tick,lab);
    }
  }

  function updateGabbyPointer(){
    const stage=$('#lineStage'), walker=$('#gabbyWalker'), pointer=$('#gabbyPointer');
    if(!stage || !walker || !pointer) return;
    const label=[...document.querySelectorAll('#lineStage .number-label')].find(el=>Number(el.dataset.value)===lineValue);
    if(!label) return;
    const stageRect=stage.getBoundingClientRect();
    const walkerRect=walker.getBoundingClientRect();
    const labelRect=label.getBoundingClientRect();
    const facingLeft=lineFacing<0;
    const startX=walkerRect.left-stageRect.left + walkerRect.width*(facingLeft ? .18 : .82);
    const startY=walkerRect.top-stageRect.top + walkerRect.height*.5;
    const rawTargetX=labelRect.left-stageRect.left + labelRect.width/2;
    const rawTargetY=labelRect.top-stageRect.top + labelRect.height/2;
    const dx=rawTargetX-startX, dy=rawTargetY-startY;
    const dist=Math.hypot(dx,dy)||1;
    const gap=10;
    const length=Math.max(10,dist-gap);
    const angle=Math.atan2(dy,dx)*180/Math.PI;
    pointer.style.left=`${startX}px`;
    pointer.style.top=`${startY}px`;
    pointer.style.width=`${length}px`;
    pointer.style.transform=`rotate(${angle}deg)`;
    pointer.className=`gabby-pointer ${klass(lineValue)}`;
  }

  function updateLine(animate=true,dir=0){
    const walker=$('#gabbyWalker');
    walker.style.left=`${pct(lineValue)}%`;
    walker.classList.toggle('faces-left', lineFacing<0);
    setBadge($('#lineValue'),lineValue); $('#linePlus').disabled=lineValue>=MAX;$('#lineMinus').disabled=lineValue<=MIN;
    requestAnimationFrame(updateGabbyPointer);
    setTimeout(updateGabbyPointer, 170);
    setTimeout(updateGabbyPointer, 340);
    if(dir){
      footstep(dir);
      const vector=$('#lineVector');vector.className=`line-vector show ${dir>0?'positive':'negative'}`;vector.textContent=dir>0?'+1 →':'−1 ←';
      setTimeout(()=>vector.classList.remove('show'),520);
    }
  }
  function moveLine(dir){
    const next=clamp(lineValue+dir);if(next===lineValue){showToast('Hai raggiunto il limite della retta.');return}
    lineFacing=dir;
    lineValue=next;updateLine(true,dir);
  }

  function newExercise(){
    let tries=0;
    do{
      exStart=Math.floor(Math.random()*17)-8;
      exMove=Math.floor(Math.random()*11)-5;
      tries++;
    }while((exMove===0 || exStart+exMove<MIN || exStart+exMove>MAX) && tries<100);
    exTarget=exStart+exMove;answerValue=0;
    $('#exStart').textContent=signed(exStart);$('#exOp').textContent=exMove>=0?'+':'−';$('#exMove').textContent=Math.abs(exMove);$('#exAnswer').textContent='?';$('#answerValue').textContent='0';
    $('#exercisePrompt').textContent=`Parti da ${signed(exStart)} e spostati di ${signed(exMove)}. Dove arrivi?`;
    $('#exerciseFeedback').textContent='';$('#exerciseFeedback').className='feedback';$('#exerciseMiniLine').classList.remove('show');
  }
  function adjustAnswer(dir){answerValue=clamp(answerValue+dir);$('#answerValue').textContent=signed(answerValue);footstep(dir)}
  function checkExercise(){
    const f=$('#exerciseFeedback');$('#exAnswer').textContent=signed(answerValue);
    if(answerValue===exTarget){f.textContent='Esatto! Hai seguito correttamente la direzione e lo spostamento.';f.className='feedback ok';footstep(1)}
    else{f.textContent='Non ancora. Guarda il segno dello spostamento e riprova.';f.className='feedback no'}
  }
  function showExerciseLine(){
    const box=$('#exerciseMiniLine');box.innerHTML='';box.classList.add('show');
    const line=document.createElement('div');line.className='number-line';line.style.top='55%';line.style.left='3%';line.style.right='3%';box.appendChild(line);buildNumberLine(line);
    const start=document.createElement('div');start.className='ex-marker start';start.style.cssText=`position:absolute;left:${pct(exStart)}%;top:6px;transform:translateX(-50%);font-weight:950;color:var(--zero)`;start.textContent=`PARTO ${signed(exStart)}`;box.appendChild(start);
    const target=document.createElement('div');target.className='ex-marker target';target.style.cssText=`position:absolute;left:${pct(exTarget)}%;bottom:2px;transform:translateX(-50%);font-weight:950;color:${exMove>0?'var(--positive)':'var(--negative)'}`;target.textContent=`ARRIVO ${signed(exTarget)}`;box.appendChild(target);
    $('#exAnswer').textContent=signed(exTarget);
  }

  function reset(which){
    if(which==='elevator'){elevatorValue=0;updateElevator();showToast('Ascensore riportato allo zero.')}
    if(which==='line'){lineValue=0;lineFacing=1;updateLine();showToast('Gabby è tornata allo zero.')}
  }

  function toggleTheme(){
    const dark=document.body.classList.toggle('dark');localStorage.setItem('nr-theme',dark?'dark':'light');$('#themeBtn').textContent=dark?'☀':'☾';
    document.querySelector('meta[name="theme-color"]').setAttribute('content',dark?'#081625':'#0d2847');
  }
  function toggleSound(){soundOn=!soundOn;localStorage.setItem('nr-sound',soundOn?'1':'0');$('#soundBtn').textContent=soundOn?'🔊':'🔇';showToast(soundOn?'Suoni attivi':'Suoni disattivati')}
  async function toggleFullscreen(){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch(_){showToast('Tutto schermo non disponibile su questo dispositivo.') }}

  $$('.mode-card,.switch-mode').forEach(b=>b.addEventListener('click',()=>showScreen(b.dataset.screen,{playIntro:b.classList.contains('mode-card')})));
  $('#homeBtn').addEventListener('click',()=>showScreen('homeScreen'));
  $('#elevatorPlus').addEventListener('click',()=>moveElevator(1));$('#elevatorMinus').addEventListener('click',()=>moveElevator(-1));
  $('#linePlus').addEventListener('click',()=>moveLine(1));$('#lineMinus').addEventListener('click',()=>moveLine(-1));
  $$('.reset-btn').forEach(b=>b.addEventListener('click',()=>reset(b.dataset.reset)));
  $('#newExercise').addEventListener('click',newExercise);$('#answerMinus').addEventListener('click',()=>adjustAnswer(-1));$('#answerPlus').addEventListener('click',()=>adjustAnswer(1));$('#checkExercise').addEventListener('click',checkExercise);$('#showExercise').addEventListener('click',showExerciseLine);
  $('#themeBtn').addEventListener('click',toggleTheme);$('#soundBtn').addEventListener('click',toggleSound);$('#fullscreenBtn').addEventListener('click',toggleFullscreen);$('#infoBtn').addEventListener('click',()=>$('#infoDialog').showModal());
  document.addEventListener('keydown',e=>{
    if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if(currentScreen==='elevatorScreen'){if(e.key==='ArrowUp'||e.key==='+'){e.preventDefault();moveElevator(1)}if(e.key==='ArrowDown'||e.key==='-'){e.preventDefault();moveElevator(-1)}if(e.key==='0')reset('elevator')}
    if(currentScreen==='lineScreen'){if(e.key==='ArrowRight'||e.key==='+'){e.preventDefault();moveLine(1)}if(e.key==='ArrowLeft'||e.key==='-'){e.preventDefault();moveLine(-1)}if(e.key==='0')reset('line')}
  });

  buildElevator();buildNumberLine();newExercise();
  const savedTheme=localStorage.getItem('nr-theme');if(savedTheme==='dark')toggleTheme();
  const savedSound=localStorage.getItem('nr-sound');if(savedSound==='0')toggleSound();
  updateElevator(false);updateLine(false);

  window.addEventListener('resize',()=>{updateElevator(false);updateLine(false)});
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
})();
