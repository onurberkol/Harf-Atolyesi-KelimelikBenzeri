'use strict';
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const Engine=require('../engine.js');
const data=mkdtempSync(join(tmpdir(),'letter-workshop-test-'));
let child;
let address;

async function start(wait='-1') {
  child=spawn(process.execPath,[join(__dirname,'../server.cjs')],{
    env:{...process.env,HOST:'127.0.0.1',PORT:'0',DATA_DIR:data,BOT_WAIT_MS:wait},
    stdio:['ignore','pipe','inherit']
  });
  const output=await Promise.race([once(child.stdout,'data').then(([chunk])=>String(chunk)),once(child,'exit').then(([code])=>{throw Error('server exited: '+code);})]);
  address='http://127.0.0.1:'+JSON.parse(output.slice(output.indexOf('{'))).port;
}
async function stop() {
  const finished=once(child,'exit');
  child.kill();
  await finished;
  child=null;
}
function client() {
  let cookie='';
  return async (route,body,status=200)=>{
    const request=await fetch(address+'/api/'+route,{
      headers:{Cookie:cookie,...(body===undefined?{}:{'Content-Type':'application/json'})},
      ...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)})
    });
    const next=request.headers.get('set-cookie');
    if(next) cookie=next.split(';')[0];
    const response=await request.json();
    assert.equal(request.status,status,JSON.stringify({route,response}));
    return response;
  };
}
const password='correct horse 123';
async function main() {
  await start();
  const anonymous=client(), a=client(), b=client();
  const index=await fetch(address+'/');
  assert.equal(index.status,200);
  assert.match(await index.text(),/online\.js/);
  assert.equal((await fetch(address+'/data/game.sqlite')).status,404);
  assert.equal((await anonymous('game',undefined,401)).error,'login_required');
  assert.equal((await fetch(address+'/api/queue',{
    method:'POST',headers:{Origin:'https://example.invalid','Content-Type':'application/json'},body:'{}'
  })).status,403);
  const left=(await a('register',{handle:'left_player',name:'Sol Oyuncu',password},201)).user;
  const right=(await b('register',{handle:'right_player',name:'Sağ Oyuncu',password},201)).user;
  assert.equal((await a('session')).user.id,left.id);
  assert.equal((await b('session')).user.id,right.id);
  await anonymous('register',{handle:'left_player',name:'Duplicate',password},409);
  await anonymous('login',{handle:'left_player',password:'wrong password'},401);

  for(const lang of ['tr','en']) {
    assert.equal((await a('queue',{lang})).waiting,true);
    const rightView=(await b('queue',{lang})).game;
    const leftView=(await a('game')).game;
    assert.equal(leftView.id,rightView.id);
    assert.notEqual(leftView.index,rightView.index);
    assert.equal(leftView.opponent,right.name);
    assert(!('racks' in leftView) && !('players' in leftView) && typeof leftView.bag==='number');
    assert.equal(leftView.board.filter(Boolean).length,1);
    const mover=leftView.turn===leftView.index?a:b;
    const other=mover===a?b:a;
    const start=mover===a?leftView:rightView;
    const {id,version}=start;
    await other('move',{id,version,tiles:[],pass:true},409);
    let tiles=Engine.findLegalMove(start.board,start.rack,lang).tiles;
    await mover('move',{id,version,tiles:[{...tiles[0],letter:'?'}]},400);
    await mover('move',{id,version,tiles:[{...tiles[0],r:99}]},422);
    const expected=Engine.validate(start.board,tiles,lang);
    const played=(await mover('move',{id,version,tiles,score:999999})).game;
    assert.equal(played.scores[start.index],expected.score);
    assert.equal(played.coins,start.coins+tiles.length);
    assert.deepEqual(played.board,expected.board);
    await mover('move',{id,version,tiles},409);
    assert.equal((await other('game')).game.version,played.version);
    let latest=played;
    let next=other;
    for(let turn=0;turn<180 && !latest.reason;turn++) {
      const state=(await next('game')).game;
      const selected=Engine.findLegalMove(state.board,state.rack,lang)?.tiles??[];
      latest=(await next('move',{id,version:state.version,tiles:selected,pass:!selected.length})).game;
      next=next===other?mover:other;
    }
    assert.equal(latest.reason,'moves');
    const expectedWinner=latest.scores[0]===latest.scores[1]?-1:Number(latest.scores[1]>latest.scores[0]);
    assert.equal(latest.winner,expectedWinner);
    const rows=(await a('leaderboard?lang='+lang)).entries;
    assert.equal(rows.length,2);
    assert.equal(rows[0].played,1);
    assert.equal(rows[0].wins,Number(expectedWinner>=0));
    assert.equal(rows[0].rating,expectedWinner>=0?1012:1000);
    assert.equal(rows[1].rating,expectedWinner>=0?988:1000);
    assert.equal(rows[1].rank,2);
  }

  await a('profile',{name:'Yeni Oyuncu',currentPassword:password,password:'another passphrase'});
  await anonymous('login',{handle:'left_player',password},401);
  await stop();
  await start('0');
  assert.equal((await a('session')).user.name,'Yeni Oyuncu');
  assert((await a('leaderboard?lang=tr')).entries.some(entry=>entry.name==='Yeni Oyuncu'));
  const practice=(await a('queue',{lang:'tr'})).game;
  assert(practice.practice);
  await a('resign',{id:practice.id,version:practice.version});
  assert.equal((await a('leaderboard?lang=tr')).entries.reduce((sum,row)=>sum+row.played,0),2);
  await a('logout',{});
  assert.equal((await a('session')).user,null);
  assert.equal((await a('login',{handle:'left_player',password:'another passphrase'})).user.name,'Yeni Oyuncu');
  await a('delete-account',{password:'another passphrase'});
  assert.equal((await a('session')).user,null);
  assert(!(await b('leaderboard?lang=tr')).entries.some(entry=>entry.name==='Yeni Oyuncu'));
  assert.equal((await b('game')).game.opponent,'Deleted player');
  console.log('Two real accounts, both languages, server scores and wallets, Elo, practice, profile updates, deletion and persistence passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(child && child.exitCode===null) await stop();
  rmSync(data,{recursive:true,force:true});
});
