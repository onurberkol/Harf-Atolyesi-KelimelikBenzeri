'use strict';
const Engine = (() => {
  const size = 7;
  const gameWidth = 13;
  const axes = [[0, 1], [1, 0]];
  const words = {
    tr: 'AT AL EL AR AS AK AY EV EK ET İŞ SU UN ON İN İL OK OT TAŞ TEL DAL BAL KAL SAL SEL BEL KEL KOL SOL YOL GÖL GÜL KUL TAÇ SAÇ KAÇ CAN CAM ÇAM KUM TAM DAM KAN HAN SAN YAN YAZ KAZ NAZ TUZ BUZ KUZ ARI KIR KAR KOR MOR ZOR NAR NAL VAR YAR DAR KAP SAP TAP KAT SAT YAT PAT KART KARA KARE KARA KASA MASA TASA SARI DARI YARI KARI KAPI YAPI SAPA PARA PARE SERA DERE KALE LALE ALEV KALEM KELAM KUMAL KANAL BALIK KALIP TARLA ÇAMUR ÇİÇEK KİTAP TOPRAK GÖLGE KÖPRÜ ŞEKER KESTANE BULUT DENİZ'.split(' '),
    en: 'AT AN AS IN IS IT ON OR TO UP US BE BY DO GO NO SO HE WE ME AM CAT BAT MAT RAT HAT FAT SAT PAT TAP CAP MAP LAP NAP SAP RAP PAN FAN TAN RAN MAN CAN CANE LANE LAKE CAKE TAKE BAKE WAKE MAKE RAKE FAKE LATE RATE MATE DATE GATE HATE FATE CATE CART PART DART TART MART ART BAR CAR FAR JAR TAR EAR EAT TEA ATE SEA SEAT MEAT HEAT BEAT BOAT COAT GOAT MOAT ROAD TOAD LOAD LEAD LEAF LIFE LIFT LEFT LENT BENT BEND SEND SAND BAND HAND LAND LAMP CAMP DAMP RAMP STAMP STAND BRAND GRAND GRANT PLANT PLANE PLAN TRAIN STAIN RAIN PAIN MAIN GRAIN PLAIN BRAIN CRANE'.split(' ')
  };
  const fullWords = typeof WordLists !== 'undefined' ? WordLists : require('./dictionary.js');
  const lexicons = Object.fromEntries(Object.entries(fullWords).map(([lang,list]) => [lang,new Set(list.split(' '))]));
  function isWord(word,lang) {
    const normalized = word.normalize('NFC').toLocaleUpperCase(lang==='tr'?'tr-TR':'en-US');
    const playable = lang === 'tr' ? normalized.replaceAll('Â','A').replaceAll('Î','I').replaceAll('Û','U') : normalized;
    return lexicons[lang]?.has(playable) ?? false;
  }
  const empty = (width=size) => Array(width * width).fill('');
  const inside = (r, c, width) => r >= 0 && c >= 0 && r < width && c < width;
  const index = (r, c, width=size) => r * width + c;
  const values = {
    tr: {B:2,C:3,Ç:5,D:2,F:4,G:3,Ğ:7,H:4,J:8,M:2,Ö:5,P:3,Ş:4,Ü:3,V:5,Y:2,Z:4},
    en: {B:2,C:3,D:2,F:4,G:2,H:3,J:7,K:5,M:2,P:3,Q:8,V:4,W:4,X:6,Y:3,Z:7}
  };
  const points = (letter,lang) => values[lang][letter] ?? 1;
  function readLine(board, r, c, dr, dc, width) {
    while (inside(r-dr,c-dc,width) && board[index(r-dr,c-dc,width)]) {
      r -= dr;
      c -= dc;
    }
    const cells = [];
    while (inside(r,c,width) && board[index(r,c,width)]) {
      cells.push(index(r,c,width));
      r += dr;
      c += dc;
    }
    return cells;
  }

  function validate(board, tiles, lang, reportInvalidWords) {
    const width = Math.sqrt(board.length);
    if (!Number.isInteger(width) || !tiles.length || !lexicons[lang]) return null;

    const next = board.slice();
    const placed = new Set();
    const alphabet = lang === 'tr' ? /^[ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ]$/u : /^[A-Z]$/;
    for (const {r, c, letter} of tiles) {
      if (!Number.isInteger(r) || !Number.isInteger(c) || !inside(r,c,width) ||
          typeof letter !== 'string' || !alphabet.test(letter)) return null;
      const id = index(r,c,width);
      if (next[id]) return null;
      next[id] = letter;
      placed.add(id);
    }

    const first = tiles[0];
    if (tiles.length > 1) {
      const horizontal = tiles.every(tile => tile.r === first.r);
      const vertical = tiles.every(tile => tile.c === first.c);
      if (!horizontal && !vertical) return null;
      const span = readLine(next,first.r,first.c,horizontal?0:1,horizontal?1:0,width);
      const covered = new Set(span);
      if ([...placed].some(id => !covered.has(id))) return null;
    }

    const lines = new Map();
    for (const {r,c} of tiles) {
      for (const [dr,dc] of axes) {
        const cells = readLine(next,r,c,dr,dc,width);
        if (cells.length >= 2) lines.set(dr * board.length + cells[0],cells);
      }
    }
    if (lines.size === 0) return null;
    if (board.some(Boolean)) {
      if (![...lines.values()].some(cells => cells.some(id => board[id]))) return null;
    } else {
      const middle = Math.floor(width/2);
      if (!placed.has(index(middle,middle,width))) return null;
    }

    const words = [...lines.values()].map(cells => cells.map(id => next[id]).join(''));
    const invalid = [...new Set(words.filter(word => !isWord(word,lang)))];
    if (invalid.length) {
      reportInvalidWords?.(invalid);
      return null;
    }

    const wordScores = [...lines.values()].map((cells,i) => {
      let letterTotal = 0;
      let multiplier = 1;
      for (const id of cells) {
        const premium = placed.has(id) ? bonus(id,width) : null;
        letterTotal += points(next[id],lang) * (premium?.letter ?? 1);
        multiplier *= premium?.word ?? 1;
      }
      return {word:words[i],score:letterTotal * multiplier};
    });
    const connectionBonus = 3 * (words.length - 1);
    return {
      board:next, words, wordScores, connectionBonus,
      score:wordScores.reduce((total, {score}) => total + score, connectionBonus)
    };
  }
  function bonus(id,width=size) {
    const middle = Math.floor(width/2);
    const row = Math.abs(Math.floor(id/width)-middle);
    const col = Math.abs(id%width-middle);
    const near = Math.min(row,col);
    const far = Math.max(row,col);
    if (row + col === 2) return {letter:2};
    if (near === 0 && far === middle) return {letter:3};
    if (near === 1 && far === middle-1) return {word:2};
    return null;
  }
  function moves(board, rack, lang) {
    const width = Math.sqrt(board.length);
    const results = [];
    for (const word of new Set(words[lang])) {
      for (const [dr,dc] of axes) {
        for (let r=0; r<width; r++) for (let c=0; c<width; c++) {
          if (!inside(r+dr*(word.length-1),c+dc*(word.length-1),width)) continue;
          const available = rack.slice();
          const tiles = [];
          let valid = true;
          for (const [offset, letter] of [...word].entries()) {
            const rr = r + offset*dr, cc = c + offset*dc;
            const existing = board[index(rr,cc,width)];
            if (existing === letter) continue;
            const slot = available.indexOf(letter);
            if (existing || slot < 0) { valid = false; break; }
            available[slot] = '';
            tiles.push({r:rr,c:cc,letter,slot});
          }
          if (!valid) continue;
          const result = validate(board,tiles,lang);
          if (result?.words.includes(word)) results.push({...result,tiles});
        }
      }
    }
    return results;
  }
  const tries = {};
  function wordTrie(lang) {
    if(tries[lang])return tries[lang];
    const root=Object.create(null);
    for(const word of lexicons[lang]){
      let branch=root;
      for(const letter of word)branch=branch[letter]??=Object.create(null);
      branch.$=true;
    }
    tries[lang]=root;
    return root;
  }
  function findLegalMove(board,rack,lang) {
    if(!rack.some(Boolean)||board.every(Boolean))return null;
    const width=Math.sqrt(board.length);
    const root=wordTrie(lang);
    const slots=rack.slice();
    const tiles=[];
    const firstMove=!board.some(Boolean);
    const middle=Math.floor(width/2);
    function walk(r,c,dr,dc,branch,linked) {
      const insideBoard=inside(r,c,width);
      const fixed=insideBoard?board[index(r,c,width)]:'';
      if(branch.$&&tiles.length&&linked&&!fixed){
        const result=validate(board,tiles,lang);
        if(result)return {...result,tiles:tiles.slice()};
      }
      if(!insideBoard)return null;
      if(fixed){
        return branch[fixed]?walk(r+dr,c+dc,dr,dc,branch[fixed],true):null;
      }
      const connectingTile=firstMove?r===middle&&c===middle:
        axes.some(([ar,ac])=>[-1,1].some(delta=>{
          const rr=r+ar*delta,cc=c+ac*delta;
          return inside(rr,cc,width)&&Boolean(board[index(rr,cc,width)]);
        }));
      const usedLetters=new Set();
      for(let slot=0;slot<slots.length;slot++){
        const letter=slots[slot];
        if(!letter||usedLetters.has(letter)||!branch[letter])continue;
        usedLetters.add(letter);
        slots[slot]='';
        tiles.push({r,c,letter,slot});
        const result=walk(r+dr,c+dc,dr,dc,branch[letter],linked||connectingTile);
        tiles.pop();
        slots[slot]=letter;
        if(result)return result;
      }
      return null;
    }
    for(const [dr,dc] of axes){
      for(let r=0;r<width;r++)for(let c=0;c<width;c++){
        if(inside(r-dr,c-dc,width)&&board[index(r-dr,c-dc,width)])continue;
        const result=walk(r,c,dr,dc,root,false);
        if(result)return result;
      }
    }
    return null;
  }
  const styles = ['novice','opportunist','balanced','defender','master'];
  const names = { tr:['Mercan','Toprak','Sedef','Lodos','Çınar','Neva','Ateş','Duru','Poyraz','Nil','Zümrüt','Bora','Işıl','Kuzey','Ekin'], en:['Ember','Flint','Sage','Hazel','Wren','Ash','Moss','Rue','Jasper','Ivy','Jade','Reed','Robin','Cove','Fern'] };
  const surnames = {'tr': ['Yalın', 'Erdem', 'Acar', 'Kaya', 'Uslu', 'Işık', 'Demir', 'Güneş', 'Aydın', 'Yüce', 'Yazıcı', 'Akan', 'Akın', 'Tan', 'Deniz'], 'en': ['Reed', 'Hale', 'Lane', 'Ford', 'Dale', 'Vale', 'Gray', 'Quinn', 'Bell', 'Dean', 'King', 'Cole', 'West', 'Lee', 'Blake']};
  function roster(lang) {
    return Array.from({length:60}, (_,id) => {
      const band = Math.floor(id/15);
      return {id, name:names[lang][id%15]+' '+surnames[lang][(id%15+band*4)%15], style:styles[Math.floor(id%15/3)], band, rating:760+band*145+(id%15)*9};
    });
  }
  function choose(board,rack,lang,profile,random=Math.random) {
    const width = Math.sqrt(board.length);
    const candidates = moves(board,rack,lang);
    const weights = {novice:[0.4,-2,0], opportunist:[1.7,0.4,0], balanced:[1,0.2,0.7], defender:[0.8,0,2.5], master:[1.4,0.5,0.5]}[profile.style];
    const variety = 4-profile.band;
    const ranked = candidates.map(move => {
      const exposed = move.tiles.reduce((sum,{r,c}) => sum + axes.reduce((count,[dr,dc]) =>
        count+[-1,1].filter(sign=>inside(r+dr*sign,c+dc*sign,width)&&bonus(index(r+dr*sign,c+dc*sign,width),width)&&!move.board[index(r+dr*sign,c+dc*sign,width)]).length,0),0);
      return {move, value:weights[0]*move.score+weights[1]*move.tiles.length-weights[2]*exposed+random()*variety};
    }).sort((a,b)=>b.value-a.value);
    return ranked[0]?.move ?? null;
  }
  return {size,gameWidth,empty,index,points,bonus,validate,moves,roster,choose,words,isWord,findLegalMove};
})();
if (typeof module !== 'undefined') module.exports = Engine;
