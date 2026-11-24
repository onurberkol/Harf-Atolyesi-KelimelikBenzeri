from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
game = Path("game")
html = (game / "index.html").read_text()
bridge = """<script>window.FB_GAME_BUILD=true;</script>
<script src="https://connect.facebook.net/en_US/fbinstant.7.1.js"></script>
<script>
if (window.FBInstant) FBInstant.initializeAsync().then(() => {
  FBInstant.setLoadingProgress(100);
  return FBInstant.startGameAsync();
}).catch(error => console.warn('Facebook startup:', error.message));
</script>
"""
with ZipFile("builds/Harf-Atolyesi-Facebook-Games.zip", "w", ZIP_DEFLATED) as archive:
    archive.writestr("index.html", html.replace("<title>", bridge + "<title>", 1))
    archive.writestr("online.js", (game / "online.js").read_text().replace(
        "const enabled = ", "const enabled = !window.FB_GAME_BUILD && ", 1))
    archive.writestr("fbapp-config.json", json.dumps({
        "instant_games": {"platform_version": "RICH_GAMEPLAY", "orientation": "PORTRAIT",
                          "navigation_menu_version": "NAV_FLOATING"}
    }))
    for path in sorted(game.iterdir()):
        if path.name not in {"index.html", "online.js"} and path.suffix in {".css",".js",".png",".jpg",".wav",".mp3",".ttf",".txt"}:
            archive.write(path, path.name)
