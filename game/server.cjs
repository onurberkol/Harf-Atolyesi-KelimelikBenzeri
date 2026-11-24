'use strict';

const http = require('node:http');
const {randomBytes, scrypt, timingSafeEqual, createHash, randomInt} = require('node:crypto');
const {promisify} = require('node:util');
const {DatabaseSync} = require('node:sqlite');
const {readFileSync, mkdirSync} = require('node:fs');
const path = require('node:path');
const E = require('./engine.js');
const Rules = require('./duel-rules.js');

const derive = promisify(scrypt);
const day = 86400000;
const lifetime = 30 * day;
const botWait = Number(process.env.BOT_WAIT_MS ?? 10000);
const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
mkdirSync(dataDir, {recursive:true,mode:0o700});
const db = new DatabaseSync(path.join(dataDir,'game.sqlite'));
db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA foreign_keys=ON;
  PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, handle TEXT UNIQUE NOT NULL, name TEXT NOT NULL, salt TEXT NOT NULL, secret TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS wallets(user INTEGER PRIMARY KEY REFERENCES users(id), coins INTEGER NOT NULL CHECK(coins>=0));
  CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS ratings(user INTEGER NOT NULL REFERENCES users(id), lang TEXT NOT NULL, rating INTEGER NOT NULL, played INTEGER NOT NULL, wins INTEGER NOT NULL, PRIMARY KEY(user,lang));
  CREATE TABLE IF NOT EXISTS queue(user INTEGER PRIMARY KEY REFERENCES users(id), lang TEXT NOT NULL, since INTEGER NOT NULL, seen INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS games(id TEXT PRIMARY KEY, state TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS active(user INTEGER PRIMARY KEY REFERENCES users(id), game TEXT NOT NULL REFERENCES games(id));
`);
const get = (sql,...args) => db.prepare(sql).get(...args);
const all = (sql,...args) => db.prepare(sql).all(...args);
const run = (sql,...args) => db.prepare(sql).run(...args);
function transaction(task) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const value = task();
    db.exec('COMMIT');
    return value;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
function fail(status,code,detail) {
  throw Object.assign(new Error(code),{status,code,detail});
}
function reply(res,data,status=200) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(data));
}
async function input(req) {
  if (req.headers['content-type']?.split(';')[0]!=='application/json') fail(415,'bad_request');
  let raw='';
  for await (const chunk of req) {
    raw+=chunk;
    if (Buffer.byteLength(raw)>8192) fail(413,'bad_request');
  }
  try {
    const value=JSON.parse(raw);
    if (!value || Array.isArray(value) || typeof value!=='object') fail(400,'bad_request');
    return value;
  } catch { fail(400,'bad_request'); }
}
const hash=token=>createHash('sha256').update(token).digest('hex');
function sessionKey(req) {
  return req.headers.cookie?.match(/(?:^|;\s*)workshop=([a-f0-9]{64})(?:;|$)/)?.[1];
}
function userFor(req) {
  const key=sessionKey(req);
  if (!key) return null;
  return get('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user WHERE token=? AND expires>?',hash(key),Date.now());
}
const walletFor = id => get('SELECT coins FROM wallets WHERE user=?',id)?.coins??60;
const profile = user => user ? {id:user.id,handle:user.handle,name:user.name,coins:walletFor(user.id)} : null;
function award(user,amount) {
  if (!user || !amount) return;
  run(`INSERT INTO wallets VALUES(?,60+?) ON CONFLICT(user) DO UPDATE SET coins=coins+excluded.coins-60`,user,amount);
}
function cookie(req,res,key,maxAge) {
  const secure = process.env.COOKIE_SECURE==='1' || req.socket.encrypted;
  res.setHeader('Set-Cookie',`workshop=${key}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure?'; Secure':''}`);
}
function startSession(req,res,user) {
  const key=randomBytes(32).toString('hex');
  run('DELETE FROM sessions WHERE expires<=?',Date.now());
  if (sessionKey(req)) run('DELETE FROM sessions WHERE token=?',hash(sessionKey(req)));
  run('INSERT INTO sessions VALUES(?,?,?)',hash(key),user,Date.now()+lifetime);
  cookie(req,res,key,lifetime/1000);
}
const throttles=new Map();
function limit(req,kind,max,window) {
  const key=kind+':'+req.socket.remoteAddress;
  const now=Date.now();
  if (throttles.size>5000) for (const [id,item] of throttles) if (item.until<=now) throttles.delete(id);
  const bucket=throttles.get(key);
  if (!bucket || bucket.until<=now) {
    throttles.set(key,{count:1,until:now+window});
  } else if (++bucket.count>max) fail(429,'slow_down');
}
function handleFor(value) {
  return typeof value==='string' ? value.trim().toLowerCase() : '';
}
function displayName(value) {
  const name=typeof value==='string' ? value.normalize('NFC').trim().replace(/ +/g,' ') : '';
  if (!/^[\p{L}\p{N}][\p{L}\p{M}\p{N} '-]{1,23}$/u.test(name)) fail(400,'bad_name');
  return name;
}
function validPassword(value) {
  return typeof value==='string' && value.length>=10 && Buffer.byteLength(value)<=128;
}
async function passwordHash(value,salt) {
  return (await derive(value,salt,64)).toString('hex');
}
async function passwordMatches(value,user) {
  const attempted=await passwordHash(validPassword(value)?value:'invalid password',user?.salt??'0'.repeat(32));
  return Boolean(user && timingSafeEqual(Buffer.from(attempted,'hex'),Buffer.from(user.secret,'hex')));
}
function language(value) {
  if (value!=='tr' && value!=='en') fail(400,'bad_request');
  return value;
}
const ratingFor = (user,lang) => get('SELECT rating,played,wins FROM ratings WHERE user=? AND lang=?',user,lang) ?? {rating:1000,played:0,wins:0};
function leaderboard(lang,user) {
  const rows=all(`
    WITH board AS (
      SELECT users.id, users.name, ratings.rating, ratings.played, ratings.wins,
      ROW_NUMBER() OVER (ORDER BY rating DESC, played DESC, users.id) AS rank
      FROM ratings JOIN users ON users.id=ratings.user WHERE ratings.lang=?
    ) SELECT * FROM board WHERE rank<=50 OR id=? ORDER BY rank`,lang,user?.id??-1);
  return rows.map(({id,...row})=>({...row,player:id===user?.id}));
}
function readGame(id) {
  const row=get('SELECT state FROM games WHERE id=?',id);
  return row ? JSON.parse(row.state) : null;
}
function current(user) {
  const active=get('SELECT game FROM active WHERE user=?',user);
  return active ? readGame(active.game) : null;
}
function store(g) {
  run('UPDATE games SET state=? WHERE id=?',JSON.stringify(g),g.id);
}
function newGame(player,opponent,lang,bot) {
  const bag=Rules.makeBag(lang);
  const {anchor,rack,botRack}=Rules.openingHands(bag,lang);
  const board=E.empty(E.gameWidth);
  board[(board.length-1)/2]=anchor;
  const turn=randomInt(2);
  const game={
    id:randomBytes(16).toString('hex'), lang, players:[player.id,opponent?.id??null],
    names:[player.name,opponent?.name??bot.name], board, racks:[rack,botRack], bag, scores:[0,0],
    bot, turn, version:0, updated:Date.now(), botDue:Date.now()+randomInt(2300,5201)
  };
  run('INSERT INTO games VALUES(?,?)',game.id,JSON.stringify(game));
  for (const id of game.players.filter(Boolean)) {
    run('INSERT INTO active VALUES(?,?) ON CONFLICT(user) DO UPDATE SET game=excluded.game',id,game.id);
    run('DELETE FROM queue WHERE user=?',id);
  }
  return game;
}
function end(g,reason,winner=null) {
  g.reason=reason;
  g.winner=winner ?? (g.scores[0]===g.scores[1] ? -1 : (g.scores[0]>g.scores[1]?0:1));
  const ratings=g.players.map(id=>id ? ratingFor(id,g.lang).rating : null);
  const expected=g.bot ? .5 : 1/(1+10**((ratings[1]-ratings[0])/400));
  const delta=g.bot ? 0 : Math.round(24*((g.winner<0?.5:Number(g.winner===0))-expected));
  g.deltas=[delta,-delta];
  g.ratings=ratings.map((rating,i)=>rating===null ? null : rating+g.deltas[i]);
  if (g.winner>=0 && !g.bot && reason!=='resigned' && reason!=='timeout') award(g.players[g.winner],10);
  g.players.forEach((id,i)=>{
    if (!id || g.bot) return;
    run(`INSERT INTO ratings VALUES(?,?,?,1,?)
      ON CONFLICT(user,lang) DO UPDATE SET rating=excluded.rating,played=played+1,wins=wins+excluded.wins`,
      id,g.lang,g.ratings[i],Number(g.winner===i));
  });
}
function move(g,tiles,result) {
  const actor=g.turn;
  if (result) {
    g.board=result.board;
    g.scores[actor]+=result.score;
    award(g.players[actor],tiles.length);
    for (const tile of tiles) g.racks[actor][tile.slot]=g.bag.pop()??'';
  }
  g.last={actor,tiles:tiles.map(({r,c,letter})=>({r,c,letter})),words:result?.wordScores??[],score:result?.score??0};
  g.version++;
  g.updated=Date.now();
  g.turn=1-actor;
  g.botDue=g.updated+randomInt(2300,5501);
  if (g.board.every(Boolean) ||
      (!E.findLegalMove(g.board,g.racks[0],g.lang) && !E.findLegalMove(g.board,g.racks[1],g.lang))) end(g,'moves');
  store(g);
}
function tick(g) {
  if (!g || g.reason) return g;
  if (Date.now()-g.updated>=day) {
    if (g.bot || g.version===0) {
      g.reason='expired';g.winner=-1;g.deltas=[0,0];g.ratings=g.players.map(id=>id?ratingFor(id,g.lang).rating:null);
    } else end(g,'timeout',1-g.turn);
    g.version++;store(g);
  } else if (g.bot && g.turn===1 && Date.now()>=g.botDue) {
    const result=E.choose(g.board,g.racks[1],g.lang,g.bot) ?? E.findLegalMove(g.board,g.racks[1],g.lang);
    move(g,result?.tiles??[],result);
  }
  return g;
}
function view(g,user) {
  if (!g) return null;
  const index=g.players.indexOf(user);
  if (index<0) fail(404,'missing_match');
  return {
    id:g.id,lang:g.lang,board:g.board,rack:g.racks[index],bag:g.bag.length,
    scores:g.scores,opponent:g.names[1-index],index,turn:g.turn,version:g.version,
    reason:g.reason,winner:g.winner,ratings:g.ratings,deltas:g.deltas,
    last:g.last,practice:Boolean(g.bot),coins:walletFor(user)
  };
}
function queue(user,lang) {
  const active=tick(current(user.id));
  if (active && !active.reason) return {game:view(active,user.id)};
  const now=Date.now();
  run('DELETE FROM queue WHERE seen<?',now-12000);
  run(`INSERT INTO queue VALUES(?,?,?,?)
    ON CONFLICT(user) DO UPDATE SET since=CASE WHEN lang=excluded.lang THEN since ELSE excluded.since END,
    lang=excluded.lang,seen=excluded.seen`,user.id,lang,now,now);
  const rival=get('SELECT users.id,users.name FROM queue JOIN users ON users.id=queue.user WHERE queue.lang=? AND queue.user<>? ORDER BY since,queue.user LIMIT 1',lang,user.id);
  if (rival) return {game:view(newGame(user,rival,lang,null),user.id)};
  const waiting=get('SELECT since FROM queue WHERE user=?',user.id);
  if (botWait>=0 && now-waiting.since>=botWait) {
    const roster=E.roster(lang);
    const bot=roster[randomInt(roster.length)];
    return {game:view(newGame(user,null,lang,bot),user.id)};
  }
  return {waiting:true};
}

const files=new Map();
for (const name of ['index.html','style.css','dictionary.js','engine.js','duel-rules.js','audio.js','online.js','app.js', ...require('node:fs').readdirSync(__dirname).filter(name=>/\.(png|jpg|ttf|wav|mp3)$/.test(name))]) {
  const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf','.wav':'audio/wav','.mp3':'audio/mpeg'}[path.extname(name)];
  files.set('/'+name,{mime,body:readFileSync(path.join(__dirname,name))});
}
async function handle(req,res) {
  const url=new URL(req.url,'http://localhost');
  const pathName=url.pathname;
  const method=req.method;
  if (!pathName.startsWith('/api/')) {
    const asset=files.get(pathName==='/'?'/index.html':pathName);
    if (!asset || !['GET','HEAD'].includes(method)) fail(404,'not_found');
    res.writeHead(200,{'Content-Type':asset.mime,'Content-Length':asset.body.length,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});
    return res.end(method==='HEAD'?undefined:asset.body);
  }
  if (method!=='GET') {
    const origin=req.headers.origin;
    const allowed=process.env.PUBLIC_ORIGIN || (req.socket.encrypted?'https://':'http://')+req.headers.host;
    if (origin && origin!==allowed) fail(403,'bad_request');
  }
  const user=userFor(req);
  if (method==='GET' && pathName==='/api/session') return reply(res,{user:profile(user)});
  if (method==='GET' && pathName==='/api/leaderboard') return reply(res,{entries:leaderboard(language(url.searchParams.get('lang')),user)});
  if (method==='POST' && ['/api/register','/api/login'].includes(pathName)) {
    limit(req,'auth',24,60000);
    const {handle,name,password}=await input(req);
    const account=handleFor(handle);
    if (pathName==='/api/login') {
      const found=get('SELECT * FROM users WHERE handle=?',account);
      if (!(await passwordMatches(password,found)) || get('SELECT secret FROM users WHERE id=?',found.id)?.secret!==found.secret) fail(401,'bad_login');
      startSession(req,res,found.id);
      return reply(res,{user:profile(found)});
    }
    if (!/^[a-z0-9_]{3,20}$/.test(account) || !validPassword(password)) fail(400,'bad_credentials');
    const label=displayName(name);
    const salt=randomBytes(16).toString('hex');
    const secret=await passwordHash(password,salt);
    if (get('SELECT id FROM users WHERE handle=?',account)) fail(409,'handle_taken');
    const {lastInsertRowid:id}=run('INSERT INTO users(handle,name,salt,secret) VALUES(?,?,?,?)',account,label,salt,secret);
    startSession(req,res,id);
    return reply(res,{user:profile({id,handle:account,name:label})},201);
  }
  if (!user) fail(401,'login_required');
  if (method==='POST' && pathName==='/api/logout') {
    run('DELETE FROM sessions WHERE token=?',hash(sessionKey(req)));
    run('DELETE FROM queue WHERE user=?',user.id);
    cookie(req,res,'',0);
    return reply(res,{user:null});
  }
  if (method==='POST' && pathName==='/api/profile') {
    const {name,currentPassword,password}=await input(req);
    const label=displayName(name);
    if (password) {
      limit(req,'auth',24,60000);
      if (!validPassword(password)) fail(400,'bad_credentials');
      if (!(await passwordMatches(currentPassword,user))) fail(401,'bad_login');
      const salt=randomBytes(16).toString('hex');
      const secret=await passwordHash(password,salt);
      transaction(()=>{
        if (get('SELECT secret FROM users WHERE id=?',user.id)?.secret!==user.secret) fail(409,'stale');
        run('UPDATE users SET name=?,salt=?,secret=? WHERE id=?',label,salt,secret,user.id);
        run('DELETE FROM sessions WHERE user=?',user.id);
        startSession(req,res,user.id);
      });
    } else run('UPDATE users SET name=? WHERE id=?',label,user.id);
    return reply(res,{user:{...profile(user),name:label}});
  }
  if (method==='POST' && pathName==='/api/delete-account') {
    limit(req,'auth',24,60000);
    const {password}=await input(req);
    if (!(await passwordMatches(password,user))) fail(401,'bad_login');
    transaction(()=>{
      if (get('SELECT secret FROM users WHERE id=?',user.id)?.secret!==user.secret) fail(409,'stale');
      const game=current(user.id);
      if (game && !game.reason) { end(game,'resigned',1-game.players.indexOf(user.id)); game.version++;store(game); }
      for (const row of all("SELECT state FROM games WHERE EXISTS(SELECT 1 FROM json_each(games.state, '$.players') WHERE value=?)",user.id)) {
        const played=JSON.parse(row.state);
        const player=played.players.indexOf(user.id);
        played.players[player]=null;
        played.names[player]=played.lang==='tr'?'Silinen oyuncu':'Deleted player';
        played.version++;store(played);
      }
      for (const table of ['queue','sessions','ratings','wallets','active']) run('DELETE FROM '+table+' WHERE user=?',user.id);
      run('DELETE FROM users WHERE id=?',user.id);
    });
    cookie(req,res,'',0);
    return reply(res,{user:null});
  }
  if (method==='POST' && pathName==='/api/queue') {
    limit(req,'queue',180,60000);
    const {lang}=await input(req);
    return reply(res,transaction(()=>queue(user,language(lang))));
  }
  if (method==='POST' && pathName==='/api/cancel') {
    run('DELETE FROM queue WHERE user=?',user.id);
    return reply(res,{});
  }
  if (method==='GET' && pathName==='/api/game') {
    return reply(res,{game:transaction(()=>view(tick(current(user.id)),user.id))});
  }
  if (method==='POST' && ['/api/move','/api/resign'].includes(pathName)) {
    const body=await input(req);
    const payload=transaction(()=>{
      const g=tick(current(user.id));
      if (!g || g.id!==body.id || g.reason || g.version!==body.version) return {stale:true,game:view(g,user.id)};
      const actor=g.players.indexOf(user.id);
      if (pathName==='/api/resign') {
        end(g,'resigned',1-actor);
        g.version++;store(g);
      } else {
        if (g.turn!==actor) fail(409,'not_turn');
        const tiles=body.tiles;
        if (!Array.isArray(tiles) || tiles.length>7 || (!tiles.length && body.pass!==true)) fail(400,'bad_move');
        const slots=new Set();
        for (const tile of tiles) {
          if (!tile || !Number.isInteger(tile.slot) || tile.slot<0 || tile.slot>=7 || slots.has(tile.slot) ||
              !tile.letter || g.racks[actor][tile.slot]!==tile.letter) fail(400,'bad_move');
          slots.add(tile.slot);
        }
        let invalid=[];
        const result=tiles.length?E.validate(g.board,tiles,g.lang,words=>{invalid=words;}):null;
        if (tiles.length && !result) fail(422,'bad_move',invalid);
        move(g,tiles,result);
      }
      return {game:view(g,user.id)};
    });
    return reply(res,payload,payload.stale?409:200);
  }
  fail(404,'not_found');
}

const server=http.createServer((req,res)=>{
  handle(req,res).catch(error=>{
    if (!error.status) console.error(error);
    if (!res.headersSent) reply(res,{error:error.code??'server_error',detail:error.detail},error.status??500);
    else res.end();
  });
});
const host=process.env.HOST||'127.0.0.1';
const port=Number(process.env.PORT||8787);
server.listen(port,host,()=>console.log('Letter Workshop listening at '+JSON.stringify(server.address())));
