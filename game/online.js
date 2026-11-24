'use strict';

const Online = (() => {
  const enabled = /^https?:$/.test(window.location?.protocol ?? '');
  const messages = {
    tr:{
      account:'Hesap', signIn:'Giriş yap', register:'Hesap oluştur', logout:'Çıkış yap', save:'Kaydet',
      handle:'Kullanıcı adı', name:'Görünen ad', password:'Şifre', currentPassword:'Mevcut şifre',
      newPassword:'Yeni şifre (isteğe bağlı)', credentials:'Kullanıcı adı 3–20 karakter (a–z, 0–9, _), şifre en az 10 karakter.',
      practice:'Antrenman', practiceInfo:'Bilgisayar rakibiyle antrenman. Sıralama puanını etkilemez.',
      search:'Aynı dilde oyuncu aranıyor…', cancel:'İptal', connection:'Sunucuya bağlanılamadı. Tekrar dene.',
      login_required:'Çevrimiçi oynamak için giriş yap.', bad_login:'Kullanıcı adı veya şifre hatalı.',
      bad_name:'Görünen ad 2–24 karakter olmalı.', bad_credentials:'Kullanıcı adı veya şifre kurallara uymuyor.',
      handle_taken:'Bu kullanıcı adı kullanımda.', slow_down:'Çok fazla deneme. Bir dakika sonra tekrar dene.',
      not_turn:'Rakibin sırası.', stale:'Maç güncellendi.', bad_move:'Geçersiz hamle.',
      empty:'Bu dilde henüz dereceli maç sonucu yok.', stats:'Maç / galibiyet', rating:'Derece puanı',
      resigned:'Maç çekilme ile sona erdi.', timeout:'Hamle süresi doldu.', expired:'Etkin olmayan maç kapatıldı.',
      resign:'Maçtan çekil', resignPrompt:'Maçtan çekilmek istediğine emin misin?', updated:'Hesap güncellendi.',
      resume:'Maça dön', delete:'Hesabı sil', deletePrompt:'Hesap ve derece bilgilerin silinsin mi?', seeded:'Antrenman rakipleri'
    },
    en:{
      account:'Account', signIn:'Sign in', register:'Create account', logout:'Sign out', save:'Save',
      handle:'Username', name:'Display name', password:'Password', currentPassword:'Current password',
      newPassword:'New password (optional)', credentials:'Username: 3–20 characters (a–z, 0–9, _). Password: at least 10 characters.',
      practice:'Practice', practiceInfo:'Practice against a computer opponent. Your ranking is unaffected.',
      search:'Looking for a player in your language…', cancel:'Cancel', connection:'Could not reach the server. Try again.',
      login_required:'Sign in to play online.', bad_login:'Incorrect username or password.',
      bad_name:'Display name must contain 2–24 characters.', bad_credentials:'Username or password does not meet the requirements.',
      handle_taken:'This username is taken.', slow_down:'Too many attempts. Try again in a minute.',
      not_turn:'It is your opponent’s turn.', stale:'The match was updated.', bad_move:'Invalid move.',
      empty:'No ranked matches have finished in this language.', stats:'Matches / wins', rating:'Rating',
      resigned:'The match ended by resignation.', timeout:'The turn expired.', expired:'The inactive match was closed.',
      resign:'Resign match', resignPrompt:'Are you sure you want to resign?', updated:'Account updated.',
      resume:'Resume match', delete:'Delete account', deletePrompt:'Delete your account and rating data?', seeded:'Practice opponents'
    }
  };
  let user = null;
  let rows = null;
  let error = '';
  let accountMode = 'login';
  let afterLogin = false;
  let request = null;
  let interval = null;
  let generation = 0;
  let queued = false;
  let searchRequest = null;
  let onlineNotice = '';
  let previousLang = null;

  const label = key => messages[saved.lang][key];
  async function api(route,body) {
    const options=body===undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
    const response=await fetch('/api/'+route,{...options,cache:'no-store',signal:AbortSignal.timeout(8000)});
    const result=await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error),result);
    return result;
  }
  function acceptUser(data) {
    user=data.user;
    if (!user && match?.online) leave('home');
  }
  function stop() {
    generation++;
    clearTimeout(interval);
    request=null;
    if(queued) {
      const cancelledGeneration=generation;
      Promise.resolve(searchRequest).catch(()=>{}).then(()=>{
        if(cancelledGeneration===generation && !queued) return api('cancel',{});
      }).catch(()=>{});
    }
    queued=false;
  }
  function leave(target) {
    stop();
    if(previousLang) saved.lang=previousLang;
    previousLang=null;
    changePage(target);
  }
  function schedule(task,delay=1500) {
    clearTimeout(interval);
    interval=setTimeout(task,delay);
  }
  function showGame(g, highlight=false) {
    if (!g) return;
    if (previousLang===null) previousLang=saved.lang;
    saved.lang=g.lang;
    const old=match?.online && match.online.id===g.id ? match : null;
    const unchanged=old?.online.version===g.version;
    const rival=1-g.index;
    const result=g.reason ? (g.winner<0?.5:Number(g.winner===g.index)) : undefined;
    const before=old?.botPoints;
    queued=false;
    if(user) user={...user,coins:g.coins};
    match={
      kind:'duel',online:g,board:g.board,rack:unchanged?old.rack:g.rack.slice(),bag:{length:g.bag},
      rackSlots:unchanged?old.rackSlots:g.rack.map((_,i)=>i),
      bot:{name:g.opponent},points:g.scores[g.index],botPoints:g.scores[rival],
      pending:unchanged?old.pending:[],slot:unchanged?old.slot:null,
      busy:g.turn!==g.index,done:Boolean(g.reason),result
    };
    notice=g.reason ? t(result===1?'victory':result===0?'loss':'draw') : g.turn===g.index ? t('yourTurn') : t('turn')+': '+g.opponent;
    render();
    if (highlight && old && g.last?.actor===rival && g.last.words.length && !g.reason) {
      animatePoints(awardOrigins(g.last.tiles),'opponent-score',before,match.botPoints,g.last.words.length);
    }
  }
  async function poll(token) {
    if (token!==generation || !match?.online || match.done) return;
    try {
      const {game}=await api('game');
      if (token!==generation) return;
      if (game && game.id===match.online.id && game.version>match.online.version && !match.accepting && !request) showGame(game,true);
    } catch(error) {
      if (token!==generation) return;
      if (error.error==='login_required') {
        user=null;leave('settings');onlineNotice=label('login_required');render();return;
      }
    }
    if (token===generation) schedule(()=>poll(token));
  }
  async function search(token,lang) {
    try {
      searchRequest=api('queue',{lang});
      const {game}=await searchRequest;
      if (token!==generation) return;
      if (game) {
        showGame(game);
        schedule(()=>poll(token));
        return;
      }
    } catch (failure) {
      if(token!==generation) return;
      if(failure.error==='login_required') { user=null; start(); return; }
      error=label(failure.error??'connection')??label('connection');render();
    }
    if(token===generation) schedule(()=>search(token,lang));
  }
  function start() {
    if (!enabled) return false;
    stop();
    error='';
    if (!user) {
      afterLogin=true;
      changePage('settings');
      return true;
    }
    changePage('duel');
    queued=true;
    search(generation,saved.lang);
    return true;
  }
  async function submit(pass, resign=false) {
    if (!match?.online || request) return;
    const current=match;
    const {id,version}=current.online;
    const token=generation;
    const tiles=resign||pass?[]:current.pending;
    const origins=tiles.length?awardOrigins(tiles):[];
    request={id};
    try {
      const {game}=await api(resign?'resign':'move',{id,version,tiles:tiles.map(tile=>({...tile,slot:current.rackSlots[tile.slot]})),pass});
      if (token!==generation) return;
      showGame(game);
      if (tiles.length && game.last?.words.length && !resign) {
        const words=game.last.words;
        if(!game.reason) {
          notice=words.map(({word,score})=>word+' +'+score).join(', ')+' '+t('accepted');
          render();
        }
        animatePoints(origins,'game-wallet',current.online.coins,game.coins,words.length,180);
      }
    } catch (failure) {
      if (token!==generation) return;
      if (failure.game) showGame(failure.game);
      else if (failure.error==='bad_move') rejectMove('bad',failure.detail??[]);
      else { notice=label(failure.error??'connection')??label('connection');render(); }
    } finally {
      if(token===generation) request=null;
    }
  }
  function addField(form,key,options={}) {
    const field=node('label',label(key),'account-field');
    const input=node('input');
    input.type=options.type??'text';
    input.autocomplete=options.autocomplete??'off';
    input.required=options.required??true;
    input.maxLength=options.max??128;
    if (options.value) input.value=options.value;
    field.append(input);
    form.append(field);
    return input;
  }
  function account(panel) {
    if (!enabled) return;
    const section=node('section','','account-section');
    section.append(node('h3',label('account')));
    if(afterLogin&&!user) section.append(node('p',label('login_required')));
    const form=node('form','','account-form');
    if(!user) {
      const register=accountMode==='register';
      const handle=addField(form,'handle',{autocomplete:'username',max:20});
      const name=register?addField(form,'name',{autocomplete:'nickname',max:24}):null;
      const password=addField(form,'password',{type:'password',autocomplete:register?'new-password':'current-password'});
      if(register) form.append(node('small',label('credentials')));
      const send=node('button',label(register?'register':'signIn'),'primary');
      send.type='submit';
      form.append(send);
      const switchMode=button(label(register?'signIn':'register'),()=>{
        accountMode=register?'login':'register';onlineNotice='';render();
      });
      form.append(switchMode);
      form.addEventListener('submit',async event=>{
        event.preventDefault();
        send.disabled=true;
        try {
          acceptUser(await api(accountMode,{handle:handle.value,name:name?.value,password:password.value}));
          onlineNotice='';
          if(afterLogin) { afterLogin=false; start(); return; }
        } catch(failure) { onlineNotice=label(failure.error??'connection')??label('connection'); }
        render();
      });
    } else {
      section.append(node('p','@'+user.handle));
      const name=addField(form,'name',{value:user.name,autocomplete:'nickname',max:24});
      const current=addField(form,'currentPassword',{type:'password',required:false,autocomplete:'current-password'});
      const password=addField(form,'newPassword',{type:'password',required:false,autocomplete:'new-password'});
      const saveButton=node('button',label('save'),'primary');
      saveButton.type='submit';
      form.append(saveButton,button(label('logout'),async()=>{
        try { acceptUser(await api('logout',{}));onlineNotice=''; }
        catch { onlineNotice=label('connection'); }
        render();
      }));
      form.append(button(label('delete'),async()=>{
        if(!current.value) { onlineNotice=label('currentPassword');status(section,onlineNotice);current.focus();return; }
        if(!window.confirm(label('deletePrompt'))) return;
        try { acceptUser(await api('delete-account',{password:current.value}));onlineNotice=''; }
        catch(failure) { onlineNotice=label(failure.error??'connection')??label('connection'); }
        render();
      },'account-delete'));
      form.addEventListener('submit',async event=>{
        event.preventDefault();
        saveButton.disabled=true;
        try {
          acceptUser(await api('profile',{name:name.value,currentPassword:current.value,password:password.value}));
          onlineNotice=label('updated');
        } catch(failure) { onlineNotice=label(failure.error??'connection')??label('connection'); }
        render();
      });
    }
    section.append(form);
    if(onlineNotice) status(section,onlineNotice);
    panel.append(section);
  }
  function ranking(panel) {
    if(!enabled) return false;
    if(rows===null) {
      status(panel,'…');
      const lang=saved.lang;
      api('leaderboard?lang='+lang).then(data=>{
        if(page==='ranks' && saved.lang===lang) { rows=data.entries;render(); }
      }).catch(()=>{
        if(page==='ranks' && saved.lang===lang) { rows=false;render(); }
      });
      return true;
    }
    if(rows===false) {
      status(panel,label('connection'));
      panel.append(button(t('retry'),()=>{rows=null;render();}));
    } else if (!rows.length) status(panel,label('empty'));
    else {
      const list=node('ol','','ranks online-ranks');
      list.setAttribute('aria-label',label('rating'));
      for (const entry of rows) {
        const item=node('li','',entry.player?'you':'');
        const stat=node('small',entry.played+' / '+entry.wins);
        stat.title=label('stats');
        item.append(node('span',String(entry.rank)),node('span',entry.name),node('strong',String(entry.rating)),stat);
        list.append(item);
      }
      panel.append(list);
    }
    if (Array.isArray(rows) && rows.length<8) {
      panel.append(node('h3',label('seeded')));
      const list=node('ol','','ranks');
      const bots=E.roster(saved.lang).slice().sort((a,b)=>b.rating-a.rating).slice(0,8-rows.length);
      bots.forEach((bot,index)=>{
        const item=node('li');item.append(node('span',String(index+1)),node('span',bot.name),node('strong',String(bot.rating)));list.append(item);
      });
      panel.append(list);
    }
    return true;
  }
  function bootstrap() {
    if(enabled) api('session').then(acceptUser).then(()=>{
      if(user && !match && page!=='duel') render();
    }).catch(()=>{});
  }
  return {
    enabled,bootstrap,start,leave,submit,account,ranking,label,
    lobbyText:()=>error||label('search'),
    resetRanking:()=>{rows=null;},
    resign:()=>{ if(window.confirm(label('resignPrompt'))) submit(false,true); }
  };
})();
