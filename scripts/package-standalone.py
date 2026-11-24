from pathlib import Path
from base64 import b64encode
p=Path('game')
html=(p/'index.html').read_text()
style=(p/'style.css').read_text()
script_names=('dictionary.js','engine.js','duel-rules.js','audio.js','online.js','app.js')
scripts=[(p/name).read_text() for name in script_names]
for name in ('coin.png','crown.png','wordmark.png','solo-art.png','duel-art.png','hint-art.png','shop-art.png','atolye-scene.jpg','logo-tr.png','fredoka.ttf','dock-home.png','dock-ranks.png','dock-shop.png','dock-settings.png','mode-solo.png','mode-duel.png','tool-undo.png','tool-shuffle.png','tool-pass.png','tool-send.png','sound-speaker.png','tile-layers-coins.wav','workshop-background.mp3','workshop-piano.mp3'):
    mime={'.jpg':'image/jpeg','.png':'image/png','.ttf':'font/ttf','.wav':'audio/wav','.mp3':'audio/mpeg'}[Path(name).suffix]
    uri='data:'+mime+';base64,'+b64encode((p/name).read_bytes()).decode()
    style=style.replace(f'url({name})',f'url({uri})')
    scripts=[script.replace(f"'{name}'",f"'{uri}'") for script in scripts]
html=html.replace('<link rel="stylesheet" href="style.css">','<style>\n'+style+'</style>')
for name,script in zip(script_names,scripts):
    html=html.replace(f'<script defer src="{name}"></script>','')
    html=html.replace('</body>','<script>\n'+script+'</script>\n</body>')
html=html.replace('</head>','<!--\n'+(p/'Fredoka-OFL.txt').read_text()+'\n'+(p/'Dictionary-notices.txt').read_text().replace('-->','—>')+'\n-->\n</head>')
Path('builds/Harf-Atolyesi-Standalone.html').write_text(html)
