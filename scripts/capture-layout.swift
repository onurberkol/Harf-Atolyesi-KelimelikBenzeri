import AppKit
import WebKit

let application = NSApplication.shared
let source = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)

struct Shot {
    let name: String
    let width: Int
    let height: Int
    let action: String
    let delay: Double
    let gameplay: Bool
    init(_ name: String, _ width: Int, _ height: Int, _ action: String, _ gameplay: Bool = false, _ delay: Double = 0.15) {
        self.name=name; self.width=width; self.height=height; self.action=action; self.gameplay=gameplay; self.delay=delay
    }
}
let allShots = [
    Shot("01-ana-menu",390,844,"changePage('home')"),
    Shot("02-tekil-tahta",390,844,"openPractice()",true),
    Shot("03-hamle-ve-altin",390,844,"openPractice();match.board=E.empty(13);match.board[84]='A';match.rack=[...'TŞERLİS'];render();match.slot=0;put(83);match.slot=1;put(85);submit()",true,0.9),
    Shot("04-antrenman-sonucu",390,844,"openPractice();match.points=48;match.movesPlayed=8;finishPractice()",true),
    Shot("05-duello",390,844,"openDuel(2)",true),
    Shot("06-eslesme",390,844,"changePage('duel')"),
    Shot("07-siralama",390,844,"changePage('ranks')"),
    Shot("08-magaza",390,844,"changePage('shop')"),
    Shot("09-ayarlar",390,844,"changePage('settings')"),
    Shot("10-english-home",430,932,"saved.lang='en';changePage('home')"),
    Shot("11-dar-kisa",320,568,"openPractice()",true),
    Shot("12-kapak-ekrani",280,510,"openPractice()",true),
    Shot("13-katlanabilir",600,840,"openPractice()",true),
    Shot("14-tablet",768,1024,"openPractice()",true),
    Shot("15-yatay",844,390,"openPractice()",true),
    Shot("16-masaustu",1366,768,"openPractice()",true),
    Shot("17-uzun-telefon",430,932,"openPractice()",true)
]
let selected = CommandLine.arguments.count > 3 ? CommandLine.arguments[3] : nil
let shots = selected == nil ? allShots : allShots.filter { $0.name == selected }
@MainActor final class Capture: NSObject, WKNavigationDelegate {
    var index=0
    var web: WKWebView!
    var window: NSWindow!
    var measurements:[[String:Any]]=[]
    func fail(_ message: String) { fputs(message+"\n",stderr); exit(2) }
    func next() {
        if index == shots.count {
            do {
                let data=try JSONSerialization.data(withJSONObject: measurements,options:[.prettyPrinted,.sortedKeys])
                try data.write(to:output.appendingPathComponent(selected.map { $0 + ".json" } ?? "layout.json"))
            } catch { fail(String(describing:error)) }
            exit(0)
        }
        let shot=shots[index]
        let frame=CGRect(x:0,y:0,width:shot.width,height:shot.height)
        let config=WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        web=WKWebView(frame:frame, configuration:config)
        web.navigationDelegate=self
        window=NSWindow(contentRect:frame,styleMask:[.borderless],backing:.buffered,defer:false)
        window.contentView=web;window.orderFrontRegardless()
        web.loadFileURL(source,allowingReadAccessTo:source.deletingLastPathComponent())
    }
    func webView(_ webView: WKWebView,didFinish navigation: WKNavigation!) {
        let shot=shots[index]
        webView.evaluateJavaScript("saved.sound=false; \(shot.action); void 0") { _,error in
            if let error { self.fail(String(describing:error)) }
            DispatchQueue.main.asyncAfter(deadline:.now()+shot.delay) { self.snapshot(shot) }
        }
    }
    func snapshot(_ shot: Shot) {
        let inspect="""
        (()=>{const sel=s=>document.querySelector(s), r=s=>sel(s)?.getBoundingClientRect(),
        b=r('.board-viewport'), u=r('.game-sound-toggle'), t=r('.control-tray'), v=document.documentElement;
        return {width:v.clientWidth,height:innerHeight,scrollWidth:v.scrollWidth,scrollHeight:v.scrollHeight,
          cells:document.querySelectorAll('.board .cell').length,boardWidth:b?.width??0,boardHeight:b?.height??0,
          boardFits:b?b.left>=0&&b.right<=v.clientWidth+1:true,controlsFit:t?t.left>=0&&t.right<=v.clientWidth+1:true,
          soundGap:b&&u?Math.round(b.top-u.bottom):0,soundSquare:u?u.width===u.height:true,coins:document.querySelectorAll('.score-coin').length};})()
        """
        web.evaluateJavaScript(inspect) { value,error in
            guard let data=value as? [String:Any], error==nil else { self.fail(String(describing:error)) ; return }
            var measurement=data; measurement["screen"]=shot.name
            self.measurements.append(measurement)
            print("\(shot.name): \(data)"); fflush(stdout)
            let config=WKSnapshotConfiguration();config.rect=self.web.bounds
            config.snapshotWidth=NSNumber(value:Double(shot.width)*1.5)
            self.web.takeSnapshot(with:config) { image,error in
                guard let tiff=image?.tiffRepresentation,let bmp=NSBitmapImageRep(data:tiff),
                      let png=bmp.representation(using:.png,properties:[:]) else {
                    self.fail(String(describing:error));return
                }
                do { try png.write(to:output.appendingPathComponent(shot.name+".png")) }
                catch { self.fail(String(describing:error)) }
                self.window.close();self.index+=1;self.next()
            }
        }
    }
}
MainActor.assumeIsolated {
    let runner=Capture();runner.next();application.run()
}
