const assert = require('node:assert/strict');
const Engine = require('../engine.js');
const lists = require('../dictionary.js');
const dictionary = Object.fromEntries(Object.entries(lists).map(([lang,list]) => [lang,new Set(list.split(' '))]));

function checkCross(lang, row, column, intersection, newColumns) {
  const board = Engine.empty(13);
  const tiles = [];
  [...row].forEach((letter,i) => {
    const entry = {r:6,c:5+i,letter};
    if (newColumns.includes(i)) tiles.push(entry);
    else board[6*13+5+i] = letter;
  });
  const pivot = row[intersection];
  const offset = column.indexOf(pivot);
  [...column].forEach((letter,i) => {
    if (i !== offset) board[(6+i-offset)*13+5+intersection] = letter;
  });
  for (const transpose of [false,true]) {
    const original = board.map((_,i) => transpose ? board[i%13*13+Math.floor(i/13)] : board[i]);
    const placement = transpose ? tiles.map(({r,c,letter}) => ({r:c,c:r,letter})) : tiles;
    const move = Engine.validate(original,placement,lang);
    assert(move, row+' + '+column);
    assert.deepEqual(move.words.slice().sort(),[row,column].sort());
    assert.equal(move.score,move.wordScores[0].score+move.wordScores[1].score+3);
    assert.equal(original.filter(Boolean).length,board.filter(Boolean).length);
  }
}

checkCross('tr','MİT','Sİ',1,[0,1]);
checkCross('tr','İT','SİM',0,[0]);
checkCross('tr','İT','SİZ',0,[0]);
checkCross('tr','PED','ER',1,[1]);
checkCross('tr','SAF','AF',2,[0,2]);
checkCross('en','CAT','AT',2,[0,2]);
assert(Engine.isWord('it','tr') && !Engine.isWord('IT','tr'));
assert(Engine.isWord('it','en') && !Engine.isWord('İT','en'));

for (const [lang, row, old, invalid] of [
  ['tr','TAT','I','TI'],
  ['en','CAT','Z','TZ']
]) {
  const board = Engine.empty(7);
  board[3*7+3] = row[1];
  board[4*7+4] = old;
  let rejected;
  const tiles = [{r:3,c:2,letter:row[0]}, {r:3,c:4,letter:row[2]}];
  assert.equal(Engine.validate(board,tiles,lang,words => { rejected = words; }),null);
  assert.deepEqual(rejected,[invalid]);
  assert.equal(board.filter(Boolean).length,2);
}

// Independent reference scans all rows and columns, including untouched ones,
// then selects the completed words that contain at least one newly placed tile.
function reference(board, tiles, lang) {
  const width = Math.sqrt(board.length);
  const next = board.slice();
  const ids = new Set();
  for (const {r,c,letter} of tiles) {
    if (r<0 || c<0 || r>=width || c>=width) return null;
    const id = r*width+c;
    if (next[id]) return null;
    ids.add(id);
    next[id] = letter;
  }
  const center = Math.floor(width/2);
  if (board.every(cell => !cell) && !ids.has(center*(width+1))) return null;
  const touching = (a,b) => Math.abs(a%width-b%width)+Math.abs(Math.floor(a/width)-Math.floor(b/width))===1;
  if (board.some(Boolean) && ![...ids].some(a => board.some((cell,b) => cell && touching(a,b)))) return null;
  const runs = [];
  for (const stride of [1,width]) {
    for (let line=0;line<width;line++) {
      let run = [];
      for (let offset=0;offset<=width;offset++) {
        const id = stride===1 ? line*width+offset : offset*width+line;
        if (offset<width && next[id]) run.push(id);
        else {
          if (run.length>1 && run.some(cell => ids.has(cell))) runs.push(run);
          run = [];
        }
      }
    }
  }
  if (!runs.some(run => [...ids].every(id => run.includes(id)))) return null;
  const scores = runs.map(run => {
    let letters = 0, factor = 1;
    for (const id of run) {
      const y = Math.abs(Math.floor(id/width)-center);
      const x = Math.abs(id%width-center);
      const premium = ids.has(id);
      letters += Engine.points(next[id],lang) * (premium && x+y===2 ? 2 : premium && Math.min(x,y)===0 && Math.max(x,y)===center ? 3 : 1);
      if (premium && x+y!==2 && Math.min(x,y)===1 && Math.max(x,y)===center-1) factor *= 2;
    }
    return {word:run.map(id => next[id]).join(''),score:letters*factor};
  });
  if (scores.some(({word}) => !dictionary[lang].has(word))) return null;
  return scores;
}

const sorted = scores => scores.map(({word,score}) => word+'='+score).sort();
let compared = 0;
let successful = 0;
for (const [lang, rack, initial] of [['tr','ASİT','ASİT'],['en','CATS','CATS']]) {
  for (const seeds of [[],[12],[11,12],[6,12,17],[0,4,12,24]]) {
    const board = Engine.empty(5);
    seeds.forEach((id,i) => { board[id] = initial[i]; });
    const tiles = board.flatMap((_,id) => [...rack].map(letter => ({r:Math.floor(id/5),c:id%5,letter})));
    const before = board.slice();
    let hasMove = false;
    function compare(placement) {
      const expected = reference(board,placement,lang);
      const actual = Engine.validate(board,placement,lang);
      assert.equal(Boolean(actual),Boolean(expected),JSON.stringify({lang,seeds,placement}));
      if (expected) {
        assert.deepEqual(sorted(actual.wordScores),sorted(expected));
        assert.equal(actual.score,expected.reduce((n,entry)=>n+entry.score,3*(expected.length-1)));
        successful++;
        hasMove = true;
      }
      compared++;
    }
    tiles.forEach((tile,i) => {
      compare([tile]);
      for (let j=i+1;j<tiles.length;j++) compare([tile,tiles[j]]);
    });
    assert.deepEqual(board,before);
    const found = Engine.findLegalMove(board,[...rack],lang);
    if (hasMove) assert(found);
    if (found) assert(reference(board,found.tiles,lang));
  }
}

for (const [lang, first, second, full, invalid] of [
  ['tr','A','T','AT','QA'],
  ['en','A','T','AT','QA']
]) {
  const board = Engine.empty(7);
  board[3*7+3] = first;
  assert.equal(Engine.validate(board,[{r:3,c:4,letter:second}],lang).words[0],full);
  for (const tiles of [
    [{r:3,c:3,letter:second}],
    [{r:3,c:4.5,letter:second}],
    [{r:3,c:4,letter:'AT'}],
    [{r:3,c:4,letter:second},{r:3,c:4,letter:second}],
    [{r:3,c:4,letter:second},{r:3,c:6,letter:second}],
    [{r:-1,c:3,letter:second}]
  ]) assert.equal(Engine.validate(board,tiles,lang),null);
  assert(!Engine.isWord(invalid,lang));
}
console.log(`Compared ${compared.toLocaleString('en-US')} placements against the reference (${successful} accepted), plus targeted crossing cases.`);
