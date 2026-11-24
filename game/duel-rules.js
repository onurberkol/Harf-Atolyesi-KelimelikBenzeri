'use strict';
const DuelRules = (engine => {
function drawTile(bag,letter) {
  return bag.splice(bag.indexOf(letter),1)[0];
}
function freshRack(bag,starter) {
  const rack=starter.slice();
  while(rack.length<7&&bag.length)rack.push(bag.pop());
  for(let i=rack.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [rack[i],rack[j]]=[rack[j],rack[i]];
  }
  return rack;
}
function openingHands(bag,lang,previous) {
  const stock=Object.create(null);
  for(const letter of bag)stock[letter]=(stock[letter]??0)+1;
  const words=[...new Set(engine.words[lang])].filter(word=>word.length===4&&engine.isWord(word,lang));
  const candidates=[];
  const canDraw=letters=>{
    const counts=Object.create(null);
    for(const letter of letters){
      counts[letter]=(counts[letter]??0)+1;
      if(counts[letter]>(stock[letter]??0))return false;
    }
    return true;
  };
  for(const anchor of Object.keys(stock)){
    const starters=words.filter(word=>word.includes(anchor)).map(word=>word.replace(anchor,''));
    const pairs=[];
    for(const first of starters)for(const second of starters){
      if(canDraw(anchor+first+second))pairs.push([first,second]);
    }
    if(pairs.length)candidates.push({anchor,pairs});
  }
  const fresh=candidates.filter(item=>item.anchor!==previous);
  const available=fresh.length?fresh:candidates;
  const {anchor,pairs}=available[Math.floor(Math.random()*available.length)];
  const pair=pairs[Math.floor(Math.random()*pairs.length)];
  drawTile(bag,anchor);
  const [playerTiles,rivalTiles]=pair.map(word=>[...word].map(letter=>drawTile(bag,letter)));
  return {anchor,rack:freshRack(bag,playerTiles),botRack:freshRack(bag,rivalTiles)};
}
function makeBag(lang) {
  const letters=lang==='tr'?'AAAAAAABBCÇDDEEEEEEFFGGĞHIIIİİİİKKKKLLLMMNNNOOÖPPRRRSSŞTTTUÜVYYZ':'AAAAAAAABBCCDDDEEEEEEEEEFFGGHHIIIIIIIJKLLLLMMNNNNNNOOOOOOOPPQRRRRRSSSSSTTTTTTUUUVVWWXYYZ';
  const bag=[...letters];
  for(let i=bag.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [bag[i],bag[j]]=[bag[j],bag[i]];
  }
  return bag;
}
return {makeBag,openingHands};
})(typeof Engine !== 'undefined' ? Engine : require('./engine.js'));
if (typeof module !== 'undefined') module.exports = DuelRules;
