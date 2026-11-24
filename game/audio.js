'use strict';

const GameAudio = (() => {
  const musicFiles={game:'workshop-background.mp3',piano:'workshop-piano.mp3'};
  const musicTracks=new Map();
  let context, effects, coinBuffer, musicSource;
  let musicWanted='off';
  let audible=false;
  const playing=new Set();

  function play(source,at,end) {
    playing.add(source);
    source.onended=()=>playing.delete(source);
    source.start(at);
    source.stop(end);
  }

  function init() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if(!Audio) return false;
    context ??= new Audio();
    if (!effects) {
      const limiter=context.createDynamicsCompressor();
      limiter.threshold.value=-14;
      limiter.connect(context.destination);
      effects=context.createGain(); effects.gain.value=0; effects.connect(limiter);
      fetch('tile-layers-coins.wav')
        .then(response=>{ if(!response.ok) throw Error('Coin recording unavailable'); return response.arrayBuffer(); })
        .then(bytes=>context.decodeAudioData(bytes))
        .then(buffer=>{coinBuffer=buffer;})
        .catch(()=>{});
    }
    return true;
  }
  function tone(at,hz,volume,release) {
    const oscillator=context.createOscillator();
    const envelope=context.createGain();
    oscillator.frequency.value=hz;
    envelope.gain.setValueAtTime(.0001,at);
    envelope.gain.exponentialRampToValueAtTime(volume,at+.007);
    envelope.gain.exponentialRampToValueAtTime(.0001,at+release);
    oscillator.connect(envelope).connect(effects);
    play(oscillator,at,at+release+.01);
  }
  async function startMusic(choice,resume) {
    if (!musicTracks.has(choice)) {
      const track=fetch(musicFiles[choice])
        .then(response=>{
          if (!response.ok) throw Error('Music recording unavailable');
          return response.arrayBuffer();
        })
        .then(bytes=>context.decodeAudioData(bytes))
        .catch(error=>{musicTracks.delete(choice);throw error;});
      musicTracks.set(choice,track);
    }
    try {
      const [buffer]=await Promise.all([musicTracks.get(choice),resume]);
      if (musicWanted!==choice || !audible || document.hidden) return false;
      if (!musicSource) {
        musicSource=context.createBufferSource();
        musicSource.buffer=buffer;
        musicSource.loop=true;
        const volume=context.createGain();
        volume.gain.value=.20;
        musicSource.connect(volume).connect(effects);
        musicSource.start();
      }
      return context.state==='running';
    } catch { return false; }
  }
  function activate(sound,choice='off') {
    if(!sound || document.hidden || !init()) { stop(); return Promise.resolve(false); }
    audible=true;
    if (musicWanted!==choice) pauseTheme();
    musicWanted=choice;
    const resume=context.resume();
    resume.catch(()=>{});
    effects.gain.setTargetAtTime(.65,context.currentTime,.025);
    return Object.hasOwn(musicFiles,choice) ? startMusic(choice,resume) : Promise.resolve(false);
  }
  function pauseTheme() {
    musicWanted='off';
    if (!musicSource) return;
    musicSource.disconnect();
    musicSource.stop();
    musicSource=null;
  }
  function stop() {
    pauseTheme();
    audible=false;
    if(!context) return;
    effects.gain.cancelScheduledValues(context.currentTime);
    effects.gain.setValueAtTime(0,context.currentTime);
    for (const source of playing) {
      source.disconnect();
      source.stop(context.currentTime);
    }
    playing.clear();
  }
  function notes(values) {
    if(!audible || context?.state!=='running') return;
    values.forEach((note,i)=>tone(context.currentTime+i*.085,note,.045,.14));
  }
  function coins(count,delay) {
    if(!audible || context?.state!=='running' || !coinBuffer || count<1) return;
    const now=context.currentTime;
    const first=now+delay/1000;
    const source=context.createBufferSource();
    source.buffer=coinBuffer;
    const gain=context.createGain();
    gain.gain.value=count>6?.86:.66;
    source.connect(gain).connect(effects);
    play(source,first,first+coinBuffer.duration);
  }
  return {activate,stop,notes,coins};
})();
