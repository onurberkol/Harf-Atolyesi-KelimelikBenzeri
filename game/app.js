'use strict';
const E = Engine;
const widthOf = board => Math.sqrt(board.length);
const $ = id => document.getElementById(id);
const copy = {
  tr:{title:'Harf Atölyesi', home:'Ana Menü', settings:'Ayarlar', language:'Dil', audioSetting:'Oyun sesi', solo:'Tekil Oyun', online:'Online Düello', localDuel:'Bu demoda eşleşme cihazda yapılır.', matching:'Rakip eşleştiriliyor…', cancel:'İptal', shuffle:'Karıştır', navigation:'Gezinme', duel:'Düello', ranks:'Sıralama', shop:'Mağaza', you:'Sen', coins:'Altın', place:'Bir taş seç, aydınlanan kareye dokun.', locked:'Kilitli taş', centerHint:'İlk taşı yıldızlı kareye koy.', linkHint:'Aydınlanan karelerden birini seç.', placeBtn:'Hamleyi oyna', undo:'Geri Al', hint:'İpucu', pass:'Pas', bad:'Geçersiz hamle. Taşları düzelt.', notInDictionary:'Sözlükte yok', retry:'Yeniden oyna', rating:'Puan', select:'Rakip seç', start:'Düelloya başla', seed:'Cihazdaki açılış sıralaması', thinking:' düşünüyor…', accepted:'kabul edildi', turn:'Sıra', yourTurn:'Sıra sende', noMove:'Oynanabilir hamle yok. Pas geç.', noMovesEnd:'İki oyuncunun da oynayabileceği hamle kalmadı.', draw:'Berabere', victory:'Kazandın', loss:'Rakip kazandı', left:'Tur', scored:'Puan', crossed:'Bağlantı bonusu', winner:'Kazanan', loser:'Kaybeden', bag:'Torbada', skip:'Beklemeyi atla', mute:'Sesi kapat', sound:'Sesi aç', buy:'Al', low:'Altın yetersiz.', owned:'İpucu hakkı', shopInfo:'Kelimeyi ve başlangıç karesini gösterir.', autoPlace:'Yerleştir', autoInfo:'Sıradaki doğru taşı oynar.', boost:'Ek Puan', boostInfo:'Geçerli hamleye +3 puan.', boostReady:'+3 puan takviyesi hazır.', noPlacement:'Bu dizilimde uygun taş yok. Önce taşları geri al.', inventory:'Elinde', purchased:'Eklendi', score:'puan', botPass:' pas geçti.', styles:['Çaylak','Fırsatçı','Dengeli','Savunmacı','Usta']},
  en:{title:'Letter Workshop', home:'Main Menu', settings:'Settings', language:'Language', audioSetting:'Game audio', solo:'Solo Play', online:'Online Duel', localDuel:'This demo matches you locally.', matching:'Finding an opponent…', cancel:'Cancel', shuffle:'Shuffle', navigation:'Navigation', duel:'Duel', ranks:'Ranking', shop:'Shop', you:'You', coins:'Coins', place:'Choose a tile, then tap a highlighted square.', locked:'Locked tile', centerHint:'Place your first tile on the star.', linkHint:'Choose a highlighted square.', placeBtn:'Play move', undo:'Recall', hint:'Hint', pass:'Pass', bad:'Invalid move. Adjust your tiles.', notInDictionary:'Not in dictionary', retry:'Play again', rating:'Rating', select:'Choose opponent', start:'Start duel', seed:'Local launch leaderboard', thinking:' is thinking…', accepted:'accepted', turn:'Turn', yourTurn:'Your turn', noMove:'No playable move. Pass to continue.', noMovesEnd:'Neither player has a legal move left.', draw:'Draw', victory:'You won', loss:'Opponent wins', left:'Round', scored:'Score', crossed:'Link bonus', winner:'Winner', loser:'Runner-up', bag:'Bag', skip:'Skip wait', mute:'Mute', sound:'Unmute', buy:'Buy', low:'Not enough coins.', owned:'Hints available', shopInfo:'Reveals the word and a starting square.', autoPlace:'Place Tile', autoInfo:'Places the next correct tile.', boost:'Bonus', boostInfo:'+3 points on a valid move.', boostReady:'+3 score boost ready.', noPlacement:'No tile fits this layout. Recall your tiles first.', inventory:'Owned', purchased:'Added', score:'points', botPass:' passed.', styles:['Novice','Opportunist','Balanced','Defender','Master']}
};
const storageKey = 'letter-atelier-v1';
function initial() {
  return {lang:'tr',coins:60,hints:2,sound:true,tr:{rating:1000,bots:{}},en:{rating:1000,bots:{}}};
}
let saved;
try { saved = JSON.parse(localStorage.getItem(storageKey)) ?? initial(); } catch { saved = initial(); }
saved.placements ??= 0;
saved.boosts ??= 0;
function musicPreference(settings) {
  return ['game','piano','off'].includes(settings.musicChoice) ? settings.musicChoice :
    settings.workshopMusic===true ? 'game' : 'off';
}
saved.musicChoice=musicPreference(saved);
let musicChange=0;
const t = key => copy[saved.lang][key];
const shopProducts = [
  {stock:'hints', title:'hint', detail:'shopInfo', icon:'hint', amount:3, price:30},
  {stock:'placements', title:'autoPlace', detail:'autoInfo', icon:'place', amount:2, price:25},
  {stock:'boosts', title:'boost', detail:'boostInfo', icon:'boost', amount:2, price:35}
];
const scoreBoost = 3;
function save() { try { localStorage.setItem(storageKey,JSON.stringify(saved)); } catch {} }
let matchingTimer = null;
let page = 'home', match = null, timer = null, notice = '';
const progress = () => saved[saved.lang];
function sound(notes) { if (saved.sound) GameAudio.notes(notes); }
const coinRecordingMs=2460;
function metallic(count,delay) {
  if (saved.sound) GameAudio.coins(count,delay);
}
function awardOrigins(tiles) {
  const width=widthOf(match.board);
  return tiles.map(({r,c})=>document.querySelector?.('[data-cell="'+E.index(r,c,width)+'"]')?.getBoundingClientRect()).filter(Boolean);
}
function animatePoints(origins,id,from,to,wordCount,lead=0) {
  const target=$(id);
  if (!target || !origins.length) return 0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const abundant=id==='game-wallet';
  const count=abundant?Math.min(42,Math.max(16,origins.length*7+wordCount*3)):origins.length+Math.max(0,wordCount-1);
  const duration=count>1?900:coinRecordingMs;
  const stagger=count>1?(coinRecordingMs-duration)/(count-1):0;
  metallic(count,reduced || !target.animate ? 0 : lead);
  if (reduced || !target.animate) return 0;
  const end=target.getBoundingClientRect();
  let awarded=0;
  target.textContent=String(from);
  target.setAttribute('aria-label',id==='game-wallet'?to+' '+t('coins'):String(to));
  const popup=node('span','+'+(to-from),id==='game-wallet'?'wallet-pop':'point-pop');
  target.parentElement?.append(popup);
  const layer=node('div','','score-coin-layer');
  layer.setAttribute('aria-hidden','true');
  document.body.append(layer);
  for(let i=0;i<count;i++){
    const origin=origins[i%origins.length];
    const coin=node('i','','score-coin');
    coin.setAttribute('aria-hidden','true');
    coin.style.left=(origin.x+origin.width/2)+'px';
    coin.style.top=(origin.y+origin.height/2)+'px';
    layer.append(coin);
    const x=end.x+end.width/2-origin.x-origin.width/2;
    const y=end.y+end.height/2-origin.y-origin.height/2;
    const sway=(i%2?1:-1)*(18+(i%11)*7);
    if(abundant)coin.style.width=(42+(i%5)*7)+'px';
    const animation=coin.animate([
      {transform:'translate(-50%,-50%) scale(.55)',opacity:0},
      {transform:'translate(calc(-50% + '+sway+'px),-130%) scale(1.12) rotate(-24deg)',opacity:1,offset:.32},
      {transform:'translate(calc(-50% + '+x+'px),calc(-50% + '+y+'px)) scale(.42) rotate(32deg)',opacity:1}
    ],{duration,delay:lead+i*stagger,easing:'cubic-bezier(.2,.6,.25,1)',fill:'both'});
    animation.onfinish=()=>{
      coin.remove();
      awarded++;
      if(awarded===count) {
        popup.remove();
        layer.remove();
      }
      target.textContent=String(from+Math.round((to-from)*awarded/count));
    };
  }
  return lead+coinRecordingMs;
}
const makeBag = () => DuelRules.makeBag(saved.lang);
const {openingHands} = DuelRules;
function changePage(next) {
  clearTimeout(timer);clearTimeout(matchingTimer);
  page=next;match=null;notice='';render();
}
function openPractice() {
  const bag=makeBag();
  const board=E.empty(E.gameWidth);
  const {anchor,rack,botRack}=openingHands(bag,saved.lang);
  board[(board.length-1)/2]=anchor;
  bag.unshift(...botRack);
  match={kind:'practice',board,rack,bag,points:0,movesPlayed:0,pending:[],slot:null,done:false};
  notice='';render();
}
function practiceDraw() {
  if (!match.bag.length) match.bag=makeBag();
  return match.bag.pop();
}
function refreshPracticeRack() {
  match.rack=match.rack.map(practiceDraw);
  match.noMove=!E.findLegalMove(match.board,match.rack,saved.lang);
  match.assist=null;match.slot=null;
  notice=match.noMove?(saved.lang==='tr'?'Bu taşlarla hamle yok':'No move with these tiles'):'';render();
}
function finishPractice() {
  match.done=true;
  notice=saved.lang==='tr'?'Antrenman bitti':'Practice finished';
  render();
}
function matchmakingDelay(random=Math.random) {
  return Math.round(1800+random()*3000);
}
function startMatchmaking() {
  if (Online.start()) return;
  changePage('duel');
  const rating=progress().rating;
  const candidates=E.roster(saved.lang).map(opponent=>({
    id:opponent.id,distance:Math.abs((progress().bots[opponent.id]??opponent.rating)-rating)
  })).sort((a,b)=>a.distance-b.distance).slice(0,12);
  const opponent=candidates[Math.floor(Math.random()*candidates.length)];
  matchingTimer=setTimeout(()=>{
    if(page!=='duel'||match)return;
    const playerProgress=progress();
    const opponentStarts=Boolean(playerProgress.opponentStartsNext);
    playerProgress.opponentStartsNext=!opponentStarts;
    openDuel(opponent.id,opponentStarts);
  },matchmakingDelay());
}
function openDuel(id,opponentStarts=false) {
  const bot=E.roster(saved.lang)[id];
  const bag=makeBag();
  const board=E.empty(E.gameWidth);
  const playerProgress=progress();
  const {anchor,rack,botRack}=openingHands(bag,saved.lang,playerProgress.lastOpeningTile);
  board[(board.length-1)/2]=anchor;
  playerProgress.lastOpeningTile=anchor;
  save();
  match={kind:'duel',board,rack,botRack,bot,bag,points:0,botPoints:0,pending:[],slot:null,busy:false,done:false};
  match.busy=opponentStarts;
  notice=opponentStarts?t('turn')+': '+bot.name:t('yourTurn');
  render();
  if(opponentStarts)timer=setTimeout(botTurn,opponentDelay());
}
function placementSquares(board,pending) {
  const width = widthOf(board);
  const capacity = match.rack.filter(Boolean).length;
  const occupied = board.some(Boolean);
  const center = Math.floor(width/2);
  const touchesBoard = board.map((letter,id) => {
    if (letter) return true;
    const row = Math.floor(id/width), column = id%width;
    return (row>0 && board[id-width]) || (row<width-1 && board[id+width]) ||
      (column>0 && board[id-1]) || (column<width-1 && board[id+1]);
  });
  const placed = new Set(pending.map(({r,c}) => E.index(r,c,width)));
  const reachable = new Set();
  for (const vertical of [false,true]) {
    for (let line=0;line<width;line++) {
      for (let start=0;start<width;start++) {
        let connected = false;
        let included = 0;
        const emptyCells = [];
        for (let end=start;end<width;end++) {
          const id = vertical ? E.index(end,line,width) : E.index(line,end,width);
          if (!board[id]) emptyCells.push(id);
          if (emptyCells.length>capacity) break;
          if (placed.has(id)) included++;
          connected ||= occupied ? Boolean(touchesBoard[id]) : id===E.index(center,center,width);
          if (!connected || included!==placed.size || end===start) continue;
          for (const cell of emptyCells) if (!placed.has(cell)) reachable.add(cell);
        }
      }
    }
  }
  return reachable;
}
function put(id) {
  if (!match || match.done || match.busy || match.accepting) return;
  const width=widthOf(match.board);
  const order=match.pending.findIndex(item=>E.index(item.r,item.c,width)===id);
  if(order>=0){
    const [returned]=match.pending.splice(order);
    match.slot=returned.slot;
  } else {
    if(match.slot===null||!placementSquares(match.board,match.pending).has(id))return;
    match.pending.push({r:Math.floor(id/width),c:id%width,slot:match.slot,letter:match.rack[match.slot]});
    match.slot=null;sound([330]);
  }
  notice='';render();
}
function consume(rack,tiles) {
  for (const {slot} of tiles) rack[slot]=match.bag.pop() ?? '';
}
function moveNotice(result) {
  const bonus=result.connectionBonus;
  return result.words.join(' · ')+' +'+result.score+(bonus?' · '+t('crossed')+' +'+bonus:'');
}
function rejectMove(reason,invalidWords=[]) {
  match.rejectedWords=invalidWords;
  notice=t(reason);
  render();
  if(reason==='bad'){
    globalThis.navigator?.vibrate?.(28);
    sound([162,116]);
  }
}
function submit(pass=false) {
  if (match.busy || match.done || match.accepting) return;
  if (match.online) { Online.submit(pass); return; }
  const balanceBefore=saved.coins;
  let invalidWords=[];
  const result=pass?null:E.validate(match.board,match.pending,saved.lang,words=>{invalidWords=words;});
  if (!pass&&!result){rejectMove('bad',invalidWords);return;}
  const origins=result?awardOrigins(match.pending):[];
  if (match.kind==='practice') {
    if (!result) return;
    if(match.boostArmed) { saved.boosts--;match.points+=scoreBoost;match.boostArmed=false; }
    match.board=result.board;
    match.points+=result.score;
    match.movesPlayed++;
    saved.coins+=match.pending.length;
    for(const {slot} of match.pending) match.rack[slot]=practiceDraw();
    match.pending=[];match.slot=null;match.assist=null;
    match.noMove=!E.findLegalMove(match.board,match.rack,saved.lang);
    acceptMove(result,origins,balanceBefore,()=>{
      if(match.board.every(Boolean)) finishPractice();
      else { notice=match.noMove?(saved.lang==='tr'?'Bu taşlarla hamle yok':'No move with these tiles'):'';render(); }
    });
    return;
  }
  if(result){
    match.board=result.board;match.points+=result.score;
    saved.coins+=match.pending.length;
    consume(match.rack,match.pending);
  }
  match.pending=[];match.slot=null;
  if(result)acceptMove(result,origins,balanceBefore,advanceDuel);
  else advanceDuel();
}
function acceptMove(result,origins,balanceBefore,complete) {
  match.accepting=true;
  const words=result.wordScores.length>1?
    result.wordScores.map(({word,score})=>word+' +'+score).join(', '):
    result.words[0];
  notice=words+' '+t('accepted');
  save();render();
  const duration=animatePoints(origins,'game-wallet',balanceBefore,saved.coins,result.words.length,220);
  timer=setTimeout(()=>{
    match.accepting=false;
    complete();
  },Math.max(600,duration+110));
}
function opponentDelay(random=Math.random) {
  const placed=match.board.reduce((count,letter)=>count+Number(Boolean(letter)),0);
  const complexity=Math.min(1950,placed*52);
  const pace=match.bot.band*105;
  const variation=2200+Math.min(1500,placed*38);
  return Math.round(2300+complexity+pace+random()*variation);
}
function advanceDuel() {
  if(match.board.every(Boolean)){finishDuel();return;}
  match.busy=true;
  notice=t('turn')+': '+match.bot.name;
  render();
  timer=setTimeout(botTurn,opponentDelay());
}
function botTurn() {
  clearTimeout(timer);
  if (!match?.busy || match.accepting || match.done) return;
  const lang=saved.lang;
  const move=E.choose(match.board,match.botRack,lang,match.bot) ??
    E.findLegalMove(match.board,match.botRack,lang);
  const origins=move?awardOrigins(move.tiles):[];
  const before=match.botPoints;
  if(move){
    match.board=move.board;match.botPoints+=move.score;
    consume(match.botRack,move.tiles);
  }
  match.busy=false;
  const playerCanPlay=Boolean(E.findLegalMove(match.board,match.rack,lang));
  if(!playerCanPlay&&(!move||!E.findLegalMove(match.board,match.botRack,lang))){
    finishDuel();return;
  }
  notice=t(playerCanPlay?'yourTurn':'noMove');
  render();
  if(move)animatePoints(origins,'opponent-score',before,match.botPoints,move.words.length);
}
function finishDuel() {
  if(match.done)return;
  match.done=true;match.busy=false;
  const p=progress();
  const botRating=p.bots[match.bot.id]??match.bot.rating;
  const result=match.points===match.botPoints ? .5 : Number(match.points>match.botPoints);
  const expected=1/(1+10**((botRating-p.rating)/400));
  const delta=Math.round(24*(result-expected));
  p.rating+=delta;p.bots[match.bot.id]=botRating-delta;
  if(result===1)saved.coins+=10;
  match.result=result;match.delta=delta;
  notice=t(result===1?'victory':result===0?'loss':'draw');
  save();render();
}
function button(label,action,classes='',disabled=false) {
  const el=document.createElement('button');el.type='button';el.textContent=label;
  el.className=classes;el.disabled=disabled;el.addEventListener('click',action);return el;
}
function toggleSound() {
  saved.sound=!saved.sound;
  GameAudio.activate(saved.sound,saved.musicChoice);
  save();
}
function updateGameSound(control) {
  const label=t(saved.sound?'mute':'sound');
  control.setAttribute('data-audio',saved.sound?'on':'off');
  control.title=label;
  control.setAttribute('aria-label',label);
}
function node(tag,text='',className='') {
  const el=document.createElement(tag);el.textContent=text;el.className=className;return el;
}
function status(panel,text) {
  const el=node('p',text,'status');el.setAttribute('role','status');panel.append(el);
}
function toolButton(label,icon,action,disabled=false,count) {
  const control=button('',action,'tool-button tool-'+icon,disabled);
  const graphic=node('span','','tool-icon');
  graphic.setAttribute('aria-hidden','true');
  if(icon==='place'||icon==='boost')graphic.textContent=icon==='place'?'✦':'+3';
  if(count!==undefined)graphic.append(node('span',String(count),'tool-count'));
  control.append(graphic,node('span',label,'tool-label'));
  return control;
}
function shuffleRack() {
  match.pending=[];
  match.slot=null;
  for(let i=match.rack.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [match.rack[i],match.rack[j]]=[match.rack[j],match.rack[i]];
    if(match.rackSlots) [match.rackSlots[i],match.rackSlots[j]]=[match.rackSlots[j],match.rackSlots[i]];
  }
  notice='';sound([480,590]);render();
}
function playPanel(panel) {
  const practice=match.kind==='practice';
  const top=node('div','','scoreline duel-scoreline');
  const width=widthOf(match.board);
  const scoreCard=(label,score,id,style='')=>{
    const card=node('div','','scorecard '+style);
    const value=node('strong',String(score));
    value.id=id;
    const caption=node('span',label,'score-caption');
    caption.title=label;
    card.append(caption,value);return card;
  };
  if(practice)top.append(node('h2',saved.lang==='tr'?'Antrenman':'Practice'),
    scoreCard(t('scored'),match.points,'player-score'));
  else top.append(scoreCard(t('you'),match.points,'player-score'),scoreCard(match.bot.name,match.botPoints,'opponent-score','rival'));
  const reachable=placementSquares(match.board,match.pending);
  const guide=node('div','','game-guide-row');
  const invalid=notice===t('bad');
  const moveWarning=invalid;
  const transition=match.accepting||match.busy;
  const missing=invalid?match.rejectedWords:[];
  const guideCopy=missing?.length?t('notInDictionary')+': '+missing.join(', '):
    match.done&&!match.accepting?'':notice;
  const feedback=node('p',guideCopy,
    'move-guide'+(moveWarning?' move-warning':match.accepting?' move-accepted':guideCopy?' turn-marker':''));
  feedback.setAttribute('role',moveWarning?'alert':'status');
  const soundControl=button('',()=>{
    toggleSound();
    updateGameSound(soundControl);
  },'game-sound-toggle');
  soundControl.id='game-sound-toggle';
  updateGameSound(soundControl);
  guide.append(feedback,soundControl);
  const coins=match.online?.coins??saved.coins;
  const balance=node('span',String(coins),'game-wallet');
  balance.id='game-wallet';
  balance.setAttribute('aria-label',coins+' '+t('coins'));
  top.append(balance);
  const viewport=node('div','','board-viewport');
  const board=node('div','','board'+(invalid?' invalid-move':''));
  board.style.setProperty('--width',width);
  match.board.forEach((fixed,id)=>{
    const tile=match.pending.find(item=>E.index(item.r,item.c,width)===id);
    const letter=fixed||tile?.letter;
    const bonus=E.bonus(id,width);
    const center=id===(match.board.length-1)/2;
    const available=reachable.has(id)&&match.slot!==null&&!match.done&&!match.busy&&!match.accepting;
    const multiplier = bonus?.word ?? bonus?.letter;
    const prefix = saved.lang === 'tr' ? (bonus?.word ? 'K' : 'H') : (bonus?.word ? 'W' : 'L');
    const premiumLabel = multiplier ? prefix+'×'+multiplier : '';
    const premiumName = saved.lang === 'tr' ? (bonus?.word ? 'Kelime puanı' : 'Harf puanı') :
      (bonus?.word ? 'Word score' : 'Letter score');
    const value=letter || (center?'★':premiumLabel||' ');
    const cell=button(value,()=>put(id),'cell'+(bonus?' bonus':'')+(bonus?.word?' word-bonus':'')+(bonus?.letter===3?' triple-bonus':'')+(center?' center':'')+(letter?' tile':'')+(tile?' pending':'')+(available?' available':'')+(fixed&&center?' anchor-tile':''),Boolean(fixed)||match.busy||match.done||match.accepting||(!tile&&!available));
    cell.setAttribute('data-cell',String(id));
    const spokenValue = !letter && multiplier ? premiumName+' ×'+multiplier : value.trim();
    cell.setAttribute('aria-label', (Math.floor(id/width)+1)+', '+(id%width+1)+' '+spokenValue+(fixed&&center?' · '+t('locked'):''));
    if (!letter && multiplier) cell.title=spokenValue;
    if(letter)cell.append(node('small',String(E.points(letter,saved.lang))));
    board.append(cell);
  });
  viewport.append(board);
  const rack=node('div','','rack');
  match.rack.forEach((letter,slot)=>{
    const used=match.pending.some(item=>item.slot===slot);
    const tile=button(letter,()=>{match.slot=slot;notice='';sound([520]);render();},'tile'+(used?' used':'')+(match.slot===slot?' selected':''),used||!letter||match.busy||match.done||match.accepting);
    tile.append(node('small',String(E.points(letter,saved.lang))));tile.setAttribute('aria-pressed',String(match.slot===slot));rack.append(tile);
  });
  const actions=node('div','','actions');
  const tools=node('div','','game-tools');
  const preview=E.validate(match.board,match.pending,saved.lang);
  const locked=transition||match.done;
  tools.append(
    toolButton(t('undo'),'undo',()=>{match.pending=[];match.slot=null;notice='';render();},locked||!match.pending.length),
    toolButton(t('shuffle'),'shuffle',shuffleRack,locked||Boolean(match.pending.length)),
    practice?toolButton(t('hint'),'hint',hint,locked||!saved.hints,saved.hints):toolButton(t('pass'),'pass',()=>submit(true),locked)
  );
  if(practice){
    tools.append(toolButton(t('autoPlace'),'place',placeNext,locked||!saved.placements,saved.placements));
    const boost=toolButton(t('boost'),'boost',toggleBoost,locked||!saved.boosts,saved.boosts);
    boost.setAttribute('aria-pressed',String(Boolean(match.boostArmed)));
    tools.append(boost);
  }
  const previewScore=preview?preview.score+(match.boostArmed?scoreBoost:0):0;
  actions.append(button(t('placeBtn')+(preview?' +'+previewScore:''),()=>submit(),'primary submit-action',locked||!match.pending.length));
  const boardTools=node('div','','board-tools');
  if(practice) {
    const caption=saved.lang==='tr'?'Hamle':'Moves';
    boardTools.append(node('span',caption+' '+match.movesPlayed));
    if (match.noMove && !locked) {
      boardTools.append(
        button(saved.lang==='tr'?'Yeni taş çek':'Draw new tiles',refreshPracticeRack,'online-resign'),
        button(saved.lang==='tr'?'Bitir':'Finish',finishPractice,'online-resign')
      );
    }
  } else boardTools.append(node('span',t('bag')+' · '+match.bag.length));
  if(match.online && !match.done) {
    if(match.online.practice) boardTools.append(node('span',Online.label('practice')));
    boardTools.append(button(Online.label('resign'),Online.resign,'online-resign'));
  }
  panel.classList.add('game-panel');
  const back=button('‹',()=>match?.online?Online.leave('home'):changePage('home'),'game-back',match.done&&!match.accepting);
  back.setAttribute('aria-label',t('home'));
  top.prepend(back);
  panel.append(top,guide,viewport);
  const tray=node('div','','control-tray');
  tray.append(boardTools,rack,actions,tools);
  panel.append(tray);
  if(!match.done||match.accepting)return;
  const overlay=node('div','','result-overlay');
  const resultCard=node('section','','level-reward');
  resultCard.setAttribute('role','dialog');
  resultCard.setAttribute('aria-modal','true');
  const resultTitle=node('h3',notice);
  resultTitle.id='match-result-title';
  resultCard.setAttribute('aria-labelledby',resultTitle.id);
  resultCard.append(resultTitle);
  const resultActions=node('div','','actions');
  if(practice){
    resultCard.append(node('strong','+'+match.points+' '+t('score'),'reward-score'));
    resultActions.append(button(t('home'),()=>changePage('home')),button(t('retry'),openPractice,'primary'));
  } else {
    const game=match.online;
    const endReason=game?.reason && game.reason!=='moves' ? Online.label(game.reason) : t('noMovesEnd');
    resultCard.append(node('p',endReason,'duel-end-reason'));
    const standings=[
      {name:t('you'),points:match.points,rating:game?game.ratings[game.index]:progress().rating,delta:game?game.deltas[game.index]:match.delta},
      {name:match.bot.name,points:match.botPoints,rating:game?game.ratings[1-game.index]:progress().bots[match.bot.id],delta:game?game.deltas[1-game.index]:-match.delta}
    ].sort((left,right)=>right.points-left.points);
    for(const side of standings){
      const row=node('div','','result-row');
      row.append(node('strong',side.name),node('strong',side.points+' '+t('score')));
      if(!game?.practice) row.append(node('span',t('ranks')+' '+side.rating+' ('+(side.delta>0?'+':'')+side.delta+')'));
      resultCard.append(row);
    }
    resultActions.append(button(t('home'),()=>game?Online.leave('home'):changePage('home')),button(t('retry'),()=>{if(game)Online.leave('home');startMatchmaking();},'primary'));
  }
  resultCard.append(resultActions);
  overlay.append(resultCard);panel.append(overlay);
}
function assistedMove() {
  const fits=tiles=>match.pending.every(tile=>tiles.some(
    candidate=>tile.r===candidate.r&&tile.c===candidate.c&&tile.letter===candidate.letter));
  if (match.assist && fits(match.assist.tiles)) return match.assist;
  const lang=saved.lang;
  if (!match.pending.length) return E.findLegalMove(match.board,match.rack,lang);
  return E.moves(match.board,match.rack,lang).find(move=>fits(move.tiles));
}
function hint() {
  if(!saved.hints)return;
  const plan=assistedMove();
  if(!plan){notice=t('noPlacement');render();return;}
  match.assist=plan;
  saved.hints--;save();
  const [first]=plan.tiles;
  notice=plan.words.join(' + ')+' · '+(first.r+1)+', '+(first.c+1);
  render();
}
function placeNext(){
  if(!saved.placements||match?.kind!=='practice'||match.done)return;
  const width=widthOf(match.board);
  const used=new Set(match.pending.map(tile=>tile.slot));
  const allowed=placementSquares(match.board,match.pending);
  const plan=assistedMove();
  const next=plan?.tiles.find(tile=>allowed.has(E.index(tile.r,tile.c,width))&&
    match.rack.some((letter,slot)=>letter===tile.letter&&!used.has(slot)));
  if(!next){notice=t('noPlacement');render();return;}
  match.assist=plan;
  match.slot=match.rack.findIndex((letter,slot)=>letter===next.letter&&!used.has(slot));
  saved.placements--;save();
  put(E.index(next.r,next.c,width));
}
function toggleBoost(){
  if(!saved.boosts||match?.kind!=='practice'||match.done)return;
  match.boostArmed=!match.boostArmed;
  notice=match.boostArmed?t('boostReady'):'';
  render();
}
function render() {
  document.documentElement.lang=saved.lang;
  document.documentElement.dataset.screen=match?'game':page;
  document.title=$('title').textContent=t('title');
  $('wallet').textContent=String(saved.coins);
  $('wallet').setAttribute('aria-label',saved.coins+' '+t('coins'));
  const navigation=$('navigation');
  navigation.hidden=Boolean(match)||page==='duel';
  navigation.setAttribute('aria-label',t('navigation'));
  const tabs=['home','ranks','shop','settings'];
  navigation.replaceChildren(...tabs.map(key=>{
    const item=button('',()=>{if(key==='ranks')Online.resetRanking();changePage(key);},'nav-tab nav-'+key);
    const icon=node('span','','nav-icon');
    icon.setAttribute('aria-hidden','true');
    item.append(icon,node('span',t(key),'nav-caption'));
    if(page===key)item.setAttribute('aria-current','page');
    return item;
  }));
  const panel=node('section','','panel screen-'+(match?'game':page));
  if(match){
    playPanel(panel);$('view').replaceChildren(panel);
    return;
  }
  if(page==='home'&&saved.lang==='tr'){
    const mark=node('img','','home-logo');
    mark.src='logo-tr.png';mark.alt='';mark.setAttribute('aria-hidden','true');panel.append(mark);
  } else if(page==='home'){
    const mark=node('div','','home-wordmark');
    const [first,...rest]=t('title').split(' ');
    mark.append(node('span',first,'mark-first'),node('span',rest.join(' '),'mark-last'));
    mark.setAttribute('aria-hidden','true');
    panel.append(mark);
  }
  panel.append(node('h2',t(page)));
  if(page==='home'){
    const modes=node('div','','mode-menu');
    const solo=button('',openPractice,'mode-choice mode-solo');
    solo.append(node('span','','mode-art'),node('strong',t('solo')));
    const duel=button('',startMatchmaking,'mode-choice mode-duel');
    duel.append(node('span','','mode-art'),node('strong',t('online')));
    modes.append(solo,duel);
    panel.classList.add('home-panel');
    panel.append(modes);
  }
  if(page==='duel'){
    const lobby=node('div','','matchmaking');
    const art=node('span','','mode-art');
    art.setAttribute('aria-hidden','true');
    lobby.append(art,node('strong',t('matching')),node('p',Online.enabled?Online.lobbyText():t('localDuel')),
      button(t('cancel'),()=>Online.enabled?Online.leave('home'):changePage('home')));
    panel.append(lobby);
  }
  if(page==='ranks'&&!Online.ranking(panel)){
    panel.append(node('p',t('seed')));
    const entries=E.roster(saved.lang).map(bot=>({...bot,rating:progress().bots[bot.id]??bot.rating}));
    entries.push({name:t('you'),rating:progress().rating,player:true});
    entries.sort((a,b)=>b.rating-a.rating);
    const list=node('ol','','ranks');
    entries.forEach((entry,i)=>{
      const li=node('li','',entry.player?'you':'');
      const label=node('span',entry.name);
      li.append(node('span',String(i+1)),label,node('strong',String(entry.rating)));list.append(li);
    });
    panel.append(list);
  }
  if(page==='settings'){
    const audioRow=node('div','','shoprow');
    const soundToggle=button(t(saved.sound?'mute':'sound'),()=>{
      toggleSound();render();
    });
    audioRow.append(node('span',t('audioSetting')),soundToggle);
    const languageRow=node('div','','shoprow');
    const languageChoice=node('select');
    languageChoice.setAttribute('aria-label',t('language'));
    for(const [value,label] of [['tr','Türkçe'],['en','English']]){
      const option=node('option',label);
      option.value=value;languageChoice.append(option);
    }
    languageChoice.value=saved.lang;
    languageChoice.addEventListener('change',()=>{
      saved.lang=languageChoice.value;Online.resetRanking();save();render();
    });
    languageRow.append(node('span',t('language')),languageChoice);
    panel.append(audioRow,languageRow);
    const musicRow=node('div','','shoprow');
    const musicLabel=saved.lang==='tr'?'Oyun müziği':'Game music';
    const musicChoice=node('select');
    musicChoice.setAttribute('aria-label',musicLabel);
    const tracks=saved.lang==='tr'?[['game','Oyun Müziği'],['piano','Piyano'],['off','Kapalı']]:
      [['game','Game Music'],['piano','Piano'],['off','Off']];
    for(const [value,label] of tracks) {
      const option=node('option',label);
      option.value=value;musicChoice.append(option);
    }
    musicChoice.value=saved.musicChoice;
    musicChoice.addEventListener('change',async()=>{
      const choice=musicChoice.value;
      const change=++musicChange;
      saved.musicChoice=choice;
      if (choice!=='off') saved.sound=true;
      const playback=GameAudio.activate(saved.sound,choice);
      notice='';save();render();
      if (choice!=='off' && !await playback && musicChange===change && saved.musicChoice===choice &&
          saved.sound && page==='settings' && !document.hidden && document.hasFocus()) {
        saved.musicChoice='off';
        notice=saved.lang==='tr'?'Müzik başlatılamadı. Tekrar dene.':'Music could not start. Try again.';
        save();render();
      }
    });
    musicRow.append(node('span',musicLabel),musicChoice);
    panel.append(musicRow);
    if (notice) status(panel,notice);
    Online.account(panel);
  }
  if(page==='shop'){
    panel.classList.add('market-stall');
    const catalog=node('div','','shop-catalog');
    for(const item of shopProducts){
      const row=node('article','','shoprow shop-product');
      const graphic=node('span',({place:'✦',boost:'+3'})[item.icon]??'','product-icon product-'+item.icon);
      graphic.setAttribute('aria-hidden','true');
      const description=node('div','','product-info');
      description.append(node('strong',item.amount+' × '+t(item.title)),node('span',t(item.detail)),
        node('small',t('inventory')+' · '+saved[item.stock]));
      const buy=button(String(item.price),()=>{
        if(saved.coins<item.price){notice=t('low');render();return;}
        saved.coins-=item.price;saved[item.stock]+=item.amount;
        notice=t('purchased')+' · '+item.amount+' × '+t(item.title);
        save();sound([660,880]);render();
      },'primary');
      buy.setAttribute('aria-label',t('buy')+' '+t(item.title)+' · '+item.price+' '+t('coins'));
      row.append(graphic,description,buy);catalog.append(row);
    }
    panel.append(catalog);status(panel,notice);
  }
  $('view').replaceChildren(panel);
}
if (typeof document.addEventListener==='function') {
  let interacted=false;
  const resume=()=>{ if(interacted && saved.sound) GameAudio.activate(true,saved.musicChoice); };
  const unlock=()=>{ if(!interacted) { interacted=true;resume(); } };
  document.addEventListener('pointerdown',unlock,{once:true});
  document.addEventListener('keydown',unlock,{once:true});
  window.addEventListener('focus',resume);
  window.addEventListener('storage',event=>{
    if(event.key!==storageKey || !event.newValue) return;
    try {
      const settings=JSON.parse(event.newValue);
      const choice=musicPreference(settings);
      const changed=saved.sound!==settings.sound || saved.musicChoice!==choice;
      if(!changed) return;
      saved.sound=settings.sound;
      saved.musicChoice=choice;
      if(!saved.sound) GameAudio.stop();
      else resume();
      const soundControl=$('game-sound-toggle');
      if(soundControl) updateGameSound(soundControl);
      if(page==='settings'&&!match) render();
    } catch {}
  });
  window.addEventListener('pagehide',GameAudio.stop);
  window.addEventListener('pageshow',resume);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)GameAudio.stop(); else resume();
  });
}
render();
Online.bootstrap();
