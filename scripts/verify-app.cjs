const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const dir='game/';
class Element {
  constructor(){this.children=[];this.attributes={};this.style={setProperty(){}};this.classList={add(){}};}
  append(...items){this.children.push(...items);}
  prepend(...items){this.children.unshift(...items);}
  replaceChildren(...items){this.children=items;}
  setAttribute(k,v){this.attributes[k]=v;}
  addEventListener(event,fn){this["on"+event]=fn;}
}
const elements=Object.fromEntries(['title','wallet','language','sound','navigation','view'].map(k=>[k,new Element()]));
const store={};
let pendingTimer;
const ctx=vm.createContext({
  document:{getElementById:k=>elements[k],createElement:()=>new Element(),documentElement:{dataset:{}}},
  localStorage:{getItem:k=>store[k],setItem:(k,v)=>store[k]=v},
  window:{},clearInterval(){},matchMedia:()=>({matches:true}),setTimeout:fn=>{pendingTimer=fn;return 1;},clearTimeout:()=>{pendingTimer=null;}
});
const run=s=>vm.runInContext(s,ctx);
run(fs.readFileSync(dir+'dictionary.js','utf8'));
run(fs.readFileSync(dir+'engine.js','utf8'));
for (const file of ['duel-rules.js','audio.js','online.js','app.js']) run(fs.readFileSync(dir+file,'utf8'));
for(const lang of ['tr','en']){
  run(`saved.lang='${lang}';openPractice()`);
  assert.equal(run('match.board.length'),169);
  assert.equal(run('match.board.filter(Boolean).length'),1);
  assert(run('E.findLegalMove(match.board,match.rack,saved.lang)'));
}
run("saved.lang='tr';changePage('home')");
assert.equal(elements.view.children[0].children[1].textContent,'Ana Menü');
assert.equal(elements.navigation.hidden,false);
elements.view.children[0].children[2].children[1].onclick();
assert.equal(run('page'),'duel');
assert.equal(run('match'),null);
pendingTimer();
assert.equal(run('match.kind'),'duel');
assert.equal(run('match.board.length'),169);
const firstOpening=run('match.board[84]');
assert(firstOpening);
assert.equal(run('progress().lastOpeningTile'),firstOpening);
assert.equal(run('match.busy'),false);
assert.equal(run('notice'),'Sıra sende');
assert.equal(run('progress().opponentStartsNext'),true);
run("startMatchmaking()");
assert.equal(run('match'),null);
elements.view.children[0].children[1].children[3].onclick();
assert.equal(run('page'),'home');
assert.equal(pendingTimer,null);
assert.equal(run('progress().opponentStartsNext'),true);
assert.equal(run('progress().lastOpeningTile'),firstOpening);
run('startMatchmaking()');
pendingTimer();
assert.equal(run('match.busy'),true);
assert.equal(run('progress().opponentStartsNext'),false);
assert.notEqual(run('match.board[84]'),firstOpening);
assert(run('matchmakingDelay(()=>0)===1800 && matchmakingDelay(()=>.9)===4500'));
run("changePage('home')");

run("changePage('home')");
elements.view.children[0].children[2].children[0].onclick();
assert.equal(run('match.kind'),'practice');
assert.equal(run('match.board.length'),169);
const fixture="match.board=E.empty(13);match.board[84]='A';match.rack=[...'TŞERLİS'];";
run(fixture);
run('match.slot=match.rack.indexOf("T");put(84);put(0)');
assert.equal(run('match.pending.length'),0);
run('put(83)');
assert.equal(run('match.pending[0].letter'), 'T');
run('match.slot=match.rack.indexOf("Ş");put(85);submit()');
assert.equal(run('match.board.slice(83,86).join("")'),'TAŞ');
assert.equal(run('saved.coins'),62);
assert.equal(run('match.movesPlayed'),1);
assert.equal(run('notice'),'TAŞ kabul edildi');
assert(run('match.accepting'));
pendingTimer();
assert.equal(run('match.accepting'),false);
assert.equal(run('match.rack.filter(Boolean).length'),7);
for(let i=0;i<8;i++) {
  if(run('match.noMove')) run('refreshPracticeRack()');
  run(`{
    const candidate=E.findLegalMove(match.board,match.rack,saved.lang);
    if(candidate) { match.pending=candidate.tiles;submit(); }
  }`);
  if(pendingTimer) pendingTimer();
  assert(!run('match.done'));
}
assert(run('match.movesPlayed>3'));
assert.equal(run('match.board.slice(83,86).join("")'),'TAŞ');
run('match.bag=[]; refreshPracticeRack()');
assert.equal(run('match.rack.filter(Boolean).length'),7);
assert(run('match.bag.length>0'));
run("changePage('duel');openDuel(2);submit(true);botTurn();");
assert(run('!match.done && !match.busy && match.botPoints>0'));
assert.equal(run('Object.keys(progress().bots).length'),0);
run("match.rack.fill('');match.botRack.fill('');match.busy=true;botTurn()");
assert(run('match.done'));
assert.equal(run('Object.keys(progress().bots).length'),1);
run('openDuel(3,true)');
assert(run('match.busy'));
assert(run('opponentDelay(()=>0)>=2300'));
assert(run('opponentDelay(()=>.9)>opponentDelay(()=>.1)'));
run('botTurn()');
assert(run('!match.done&&!match.busy'));
run("changePage('ranks')");
assert.equal(elements.view.children[0].children[2].children.length,61);
run("changePage('home')");
elements.navigation.children[3].onclick();
assert.equal(run('page'),'settings');
elements.view.children[0].children[1].children[1].onclick();
assert.equal(run('saved.sound'),false);
const language=elements.view.children[0].children[2].children[1];
language.value='en';
language.onchange();
assert.equal(elements.title.textContent,'Letter Workshop');
run("changePage('home')");
elements.navigation.children[2].onclick();
assert.equal(run('page'),'shop');
run('saved.coins=90;render()');
for(let i=0;i<3;i++)elements.view.children[0].children[1].children[i].children[2].onclick();
assert.equal(run('saved.hints'),5);
assert.equal(run('saved.placements'),2);
assert.equal(run('saved.boosts'),2);
assert.equal(run('saved.coins'),0);
elements.view.children[0].children[1].children[0].children[2].onclick();
assert.equal(run('saved.hints'),5);
run("saved.lang='tr';openPractice();"+fixture+"toggleBoost();submit();");
assert.equal(run('saved.boosts'),2);
run('match.assist={tiles:[{r:6,c:5,letter:"T"},{r:6,c:7,letter:"Ş"}],words:["TAŞ"]};placeNext();placeNext();submit()');
assert(run('!match.done && match.movesPlayed===1'));
assert.equal(run('saved.placements'),0);
assert.equal(run('saved.boosts'),1);
assert.equal(run('match.points'),9);
const crossEngine=require('../'+dir+'engine.js');
for(const [vertical,adjacent] of [['FA',7],['AF',5]]){
  const board=crossEngine.empty(13);
  board[6*13+6]='A';
  board[adjacent*13+7]='A';
  const placement=[{r:6,c:5,letter:'S'},{r:6,c:7,letter:'F'}];
  const result=crossEngine.validate(board,placement,'tr');
  assert.deepEqual(new Set(result.words),new Set(['SAF',vertical]));
  assert.equal(result.score,result.wordScores.reduce((sum,entry)=>sum+entry.score,3));
  let invalid;
  placement[0].letter='Ş';
  assert.equal(crossEngine.validate(board,placement,'tr',words=>{invalid=words;}),null);
  assert.deepEqual(invalid,['ŞAF']);
}
const fullDictionary=require('../'+dir+'dictionary.js');
assert(fullDictionary.tr.split(' ').length>=50000);
assert(fullDictionary.en.split(' ').length>=50000);
assert(run("E.isWord('öğretmenler','tr') && E.isWord('çalışıyorum','tr') && !E.isWord('İstanbul','tr')"));
assert(run("E.isWord('workshops','en') && E.isWord('colour','en') && !E.isWord('zzzzzz','en')"));
run("openDuel(1);match.board[84]='A';match.rack[0]='T';match.rack[1]='Ş';match.slot=0;put(83);match.slot=1;put(85);submit()");
assert(run("match.accepting && !match.busy && !match.done"));
assert.equal(run('notice'),'TAŞ kabul edildi');
pendingTimer();
assert(run("!match.accepting && match.busy && notice.startsWith('Sıra')"));
pendingTimer();
assert(run('!match.done && !match.busy'));
const firstScore=run('match.points');
const firstBoardSize=run('match.board.filter(Boolean).length');
run('match.pending=E.findLegalMove(match.board,match.rack,saved.lang).tiles;submit()');
assert(run('match.points')>firstScore);
assert(run('match.board.filter(Boolean).length')>firstBoardSize);
pendingTimer();
pendingTimer();
assert(run('!match.done'));
assert.equal(run('Object.keys(progress().bots).length'),1);
run("match.rack.fill('');match.botRack.fill('');match.busy=true;botTurn()");
assert(run('match.done'));
assert.equal(run('Object.keys(progress().bots).length'),2);
assert(Object.values(store).length);
console.log('OK: open-ended solo practice, tile refills and rewards, full duel, ratings, leaderboard rows, language switch and shop.');
for(const lang of ['tr','en']){
  run(`saved.lang='${lang}';changePage('duel');openDuel(7)`);
  let turns=0;
  while(!run('match.done')&&turns<90){
    run('{const next=E.findLegalMove(match.board,match.rack,saved.lang);match.pending=next?.tiles??[];submit(!next)}');
    if(run('match.accepting'))pendingTimer();
    if(run('match.busy'))pendingTimer();
    turns++;
  }
  assert(run('match.done'));
  assert(turns>3);
  assert(run('match.board.every(Boolean)||(!E.findLegalMove(match.board,match.rack,saved.lang)&&!E.findLegalMove(match.board,match.botRack,saved.lang))'));
  console.log(lang,turns,'rounds',run('match.points'),run('match.botPoints'));
}
for(const language of ['tr','en']){
  run(`saved.lang='${language}'`);
  const anchors=new Set();
  let previous;
  for(let attempt=0;attempt<25;attempt++){
    run('openDuel(1)');
    const next=run('match.board[84]');
    assert.notEqual(next,previous);
    assert(run('match.rack.length===7 && match.botRack.length===7'));
    assert(run('E.findLegalMove(match.board,match.rack,saved.lang) && E.findLegalMove(match.board,match.botRack,saved.lang)'));
    anchors.add(next);previous=next;
  }
  assert(anchors.size>=4);
  console.log(language,anchors.size,'different opening tiles across 25 launches');
}
for (const [language, oldTiles, newTiles, expected] of [
  ['tr', [[5,6,'S'],[6,7,'T']], [[6,5,'M'],[6,6,'İ']], 'MİT + Sİ'],
  ['en', [[5,7,'A'],[6,6,'A']], [[6,5,'C'],[6,7,'T']], 'CAT + AT']
]) {
  run(`saved.lang=${JSON.stringify(language)};openDuel(1);match.board=E.empty(13);match.busy=false;`);
  run(`for(const [r,c,letter] of ${JSON.stringify(oldTiles)}) match.board[r*13+c]=letter;`);
  run(`for(const [slot,[r,c,letter]] of ${JSON.stringify(newTiles)}.entries()){
    match.rack[slot]=letter;match.slot=slot;put(r*13+c);
  } submit();`);
  const [across,down]=expected.split(' + ');
  assert(run('match.accepting'));
  assert(run('notice').includes(across) && run('notice').includes(down),run('notice'));
  const score=run(`E.validate(match.board.map((cell,id)=>${JSON.stringify(newTiles.map(([r,c])=>r*13+c))}.includes(id)?'':cell),${JSON.stringify(newTiles.map(([r,c,letter])=>({r,c,letter})))},saved.lang).score`);
  assert.equal(run('match.points'),score);
  run("changePage('home')");
}
for (const [language, word, letter, wordTitle] of [
  ['tr','K×2','H×3','Kelime puanı ×2'],
  ['en','W×2','L×3','Word score ×2']
]) {
  run(`saved.lang='${language}';openDuel(1);`);
  const ui = elements.view;
  const descendants = root => [root,...root.children.flatMap(descendants)];
  const nodes = descendants(ui);
  const bonus = nodes.find(el => el.textContent===word && el.attributes['data-cell']);
  assert(bonus);
  assert(bonus.attributes['aria-label'].endsWith(wordTitle));
  assert(nodes.some(el => el.textContent===letter && el.attributes['data-cell']));
  const name = run('match.bot.name');
  assert(nodes.some(el => el.className==='score-caption' && el.textContent===name));
  run("changePage('home')");
}
run("saved.lang='tr';openDuel(1)");
const duelHeader=elements.view.children[0].children[0];
assert.equal(duelHeader.className,'scoreline duel-scoreline');
assert.equal(duelHeader.children.length,4);
assert.equal(duelHeader.children[0].className,'game-back');
assert.equal(duelHeader.children[1].children[1].id,'player-score');
assert.equal(duelHeader.children[2].children[1].id,'opponent-score');
assert.equal(duelHeader.children[3].id,'game-wallet');
run("openPractice()");
assert.equal(elements.view.children[0].children[0].children[0].className,'game-back');
for (const mode of ['openPractice()','openDuel(1)']) {
  run("saved.sound=true;"+mode);
  const panel=elements.view.children[0];
  const guide=panel.children.find(element=>element.className==='game-guide-row');
  const toggle=guide.children[1];
  const before=run('match');
  assert.equal(toggle.attributes['aria-label'],'Sesi kapat');
  toggle.onclick();
  assert.equal(run('saved.sound'),false);
  assert.equal(toggle.attributes['aria-label'],'Sesi aç');
  assert.equal(run('match'),before);
  assert.equal(elements.view.children[0],panel);
  toggle.onclick();
  assert.equal(run('saved.sound'),true);
}
