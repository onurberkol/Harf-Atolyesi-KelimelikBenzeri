from pathlib import Path
from xml.sax.saxutils import escape
import os
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT/'docs'
SCREENS = DOCS/'screens'
FONTS = Path(os.environ.get('DOC_FONT_DIR','/System/Library/Fonts/Supplemental'))
for name, filename in [('Arial','Arial.ttf'),('ArialBold','Arial Bold.ttf'),('ArialCode','Courier New.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONTS/filename)))
W,H=595.28,841.89
INK='#202641'; SUB='#495673'; PURPLE='#55408f'; FAINT='#f0effa'; RULE='#dcdff0'; PAPER='#fafbff'
L=43
styles = {
    'body':ParagraphStyle('Body',fontName='Arial',fontSize=10.1,leading=15.3,textColor=colors.HexColor(INK)),
    'small':ParagraphStyle('Small',fontName='Arial',fontSize=8.3,leading=11.5,textColor=colors.HexColor(SUB)),
    'caption':ParagraphStyle('Caption',fontName='ArialBold',fontSize=8.5,leading=11.5,textColor=colors.HexColor(PURPLE)),
    'lead':ParagraphStyle('Lead',fontName='Arial',fontSize=11.4,leading=16.2,textColor=colors.HexColor(SUB)),
}
def color(value): return colors.HexColor(value)

def text(c,x,y,value,size=10,face='Arial',ink=INK):
    c.setFillColor(color(ink));c.setFont(face,size);c.drawString(x,y,value)

def para(c,x,y,value,width=W-2*L,kind='body'):
    p=Paragraph(escape(value),styles[kind]);_,height=p.wrap(width,H)
    p.drawOn(c,x,y-height)
    return y-height

def panel(c,x,y,width,height,fill=FAINT,outline=RULE,radius=9):
    c.setFillColor(color(fill));c.setStrokeColor(color(outline))
    c.roundRect(x,y,width,height,radius,fill=1,stroke=1)

def img(c,path,x,top,width,height):
    ra=ImageReader(str(path));iw,ih=ra.getSize()
    k=min(width/iw,height/ih)
    dw,dh=iw*k,ih*k
    c.drawImage(ra,x+(width-dw)/2,top-dh,dw,dh,mask='auto')
    return dh

def chrome(c,kind,page):
    c.setFillColor(color(PAPER));c.rect(0,0,W,H,fill=1,stroke=0)
    c.setStrokeColor(color(RULE));c.line(L,50,W-L,50)
    text(c,L,34,'HARF ATÖLYESİ  /  '+kind,8,'ArialBold',PURPLE)
    c.setFont('Arial',8);c.setFillColor(color(SUB));c.drawRightString(W-L,34,f'24 KASIM 2026   •   {page:02}')

def header(c,kind,page,title,lead):
    chrome(c,kind,page)
    text(c,L,H-57,f'{page-2:02}',10,'ArialBold',PURPLE)
    text(c,L,H-87,title,26,'ArialBold')
    return para(c,L,H-103,lead,kind='lead')-20

def cover(c,kind,title,subtitle,edition,screen):
    chrome(c,kind,1)
    c.setFillColor(color('#40326f'));c.roundRect(L,H-731,W-2*L,663,20,fill=1,stroke=0)
    text(c,L+28,H-108,'HARF ATÖLYESİ  /  LETTER WORKSHOP',11,'ArialBold','#e3d8ff')
    text(c,L+28,H-153,title,30,'ArialBold','#ffffff')
    p=Paragraph(escape(subtitle),ParagraphStyle('Cover',fontName='Arial',fontSize=13,leading=19,textColor=color('#efeaff')))
    _,hi=p.wrap(W-2*L-52,120);p.drawOn(c,L+28,H-178-hi)
    img(c,SCREENS/screen,L+32,H-245,W-2*L-64,382)
    text(c,L+28,H-699,edition,9,'ArialBold','#e3d8ff')
    c.showPage()

def toc(c,kind,sections,notes):
    chrome(c,kind,2)
    text(c,L,H-79,'İçindekiler',30,'ArialBold')
    y=H-122
    for i,(title,lead,*_) in enumerate(sections,3):
        text(c,L,y,f'{i-2:02}',9,'ArialBold',PURPLE)
        text(c,L+30,y,title,12,'ArialBold')
        c.setFont('ArialBold',10);c.setFillColor(color(PURPLE));c.drawRightString(W-L,y,f'{i:02}')
        c.setStrokeColor(color(RULE));c.line(L,y-10,W-L,y-10)
        y-=33
    y-=10
    panel(c,L,y-95,W-2*L,95)
    para(c,L+15,y-14,notes,W-2*L-30,'body')
    c.showPage()

def cards(c,y,items):
    for title,body in items:
        text(c,L,y,title,12,'ArialBold',PURPLE)
        y=para(c,L,y-8,body)-20
    return y

def visuals(c,y,figures):
    width=(W-2*L-16)/len(figures)
    height=328 if len(figures)==2 else 255
    for i,(name,caption) in enumerate(figures):
        x=L+i*(width+16)
        panel(c,x,y-height-35,width,height+35,'#f5f5fd',RULE)
        img(c,SCREENS/name,x+9,y-8,width-18,height-7)
        para(c,x+10,y-height-7,caption,width-20,'caption')
    return y-height-53

def diagram(c,y,steps):
    w=(W-2*L-48)/len(steps)
    for i,(name,detail) in enumerate(steps):
        x=L+i*(w+48/(len(steps)-1))
        panel(c,x,y-73,w,73)
        para(c,x+9,y-9,name,w-18,'caption')
        para(c,x+9,y-26,detail,w-18,'small')
        if i+1<len(steps):
            start=x+w+2; end=L+(i+1)*(w+48/(len(steps)-1))-2; middle=y-37
            c.setStrokeColor(color(PURPLE));c.line(start,middle,end,middle)
            c.line(end,middle,end-5,middle+3);c.line(end,middle,end-5,middle-3)
    return y-94

def codebox(c,y,label,body):
    lines=body.splitlines()
    height=37+11*len(lines)
    panel(c,L,y-height,W-2*L,height,'#202641','#202641')
    text(c,L+13,y-17,label,9,'ArialBold','#d9c8ff')
    for i,line in enumerate(lines):
        text(c,L+13,y-34-i*11,line,8,'ArialCode','#f0f5ff')
    return y-height-20

def make(path,kind,title,subtitle,cover_screen,sections,notes):
    c=canvas.Canvas(str(path),pagesize=(W,H),pageCompression=1)
    c.setTitle(title+' | Harf Atölyesi')
    cover(c,kind,title,subtitle,'ÜRÜN SÜRÜMÜ 1.0.0  /  24 KASIM 2026',cover_screen)
    toc(c,kind,sections,notes)
    for page,(heading,lead,figures,flow,code,items) in enumerate(sections,3):
        y=header(c,kind,page,heading,lead)
        if figures: y=visuals(c,y,figures)
        if flow: y=diagram(c,y,flow)
        if code: y=codebox(c,y,*code)
        y=cards(c,y,items)
        if y<65: raise ValueError(f'{kind} page {page} overflow {y}')
        c.showPage()
    c.save()

GDD=[
('Ürün ve oyun döngüsü','İki dilde oynanan bir kelime ve tahta oyunu. Harfleri yerleştir, kelimeyi doğrula, puanı topla ve tahtadaki yeni fırsatları değerlendir.',
 [('01-ana-menu.png','Türkçe ana menü'),('10-english-home.png','İngilizce giriş ekranı')],None,None,[
 ('Oyuncu seçimi','Tekil Oyun doğrudan antrenman tahtasını açar. Online Düello, sunuculu sürümde eşleşmeye yönlendirir. Alt kısım ana menü, sıralama, mağaza ve ayarları bir arada tutar.'),
 ('Ürün hedefi','Oyuncu hızlıca kelime kurabilmeli, hamlenin puanını anlayabilmeli ve ister tek başına ister rakibe karşı aynı 13 × 13 tahta dilini kullanabilmeli.')]),
('Tahta, harfler ve hamle','Ortadaki kilitli harf başlangıcı verir. Yeni harfler yatay veya dikey yerleştirilir ve mevcut taşlara bağlanır.',
 [('02-tekil-tahta.png','13 × 13 tahta ve harf rafı'),('03-hamle-ve-altin.png','Kabul edilen hamle ve altın akışı')],None,None,[
 ('Çarpanlar','K×2 kelime puanını, H×2 ve H×3 harf değerini çarpar. Yalnızca o hamlede üzerine yeni taş konan kareler çarpan verir. Birden fazla oluşan kelime ayrı hesaplanır.'),
 ('Geçerli hamle','Yerleşim doğrulanır, oluşan bütün kelimeler seçili dilin sözlüğünden geçirilir. Geçersiz hamlede bekleyen taşlar korunur ve oyuncu dizilimini düzeltebilir.')]),
('Tekil antrenman','Bölüm listesi, hamle limiti ve ilerlemek için puan eşiği yok. Oyuncu tahtayı kendi temposunda ilerletir.',
 [('02-tekil-tahta.png','Antrenman başlangıcı'),('04-antrenman-sonucu.png','Örnek antrenman sonucu')],None,None,[
 ('Devam ve bitiş','Geçerli hamlenin puanı mevcut skora eklenir. Kullanılan taşların yerine yenileri gelir. Tahta dolarsa sonuç gösterilir. Eldeki taşlarla hamle yoksa oyuncu yeni taş çekebilir veya antrenmanı bitirebilir.'),
 ('Yardım araçları','İpucu, Yerleştir ve Ek Puan tekil moda özeldir. Geri Al bekleyen taşları kaldırır. Karıştır, raftaki taşların sırasını değiştirir.')]),
('Düello ve derecelendirme','Çevrimiçi düello, aynı dil kuyruğundan rakip bulur. Her iki taraf aynı tahtayı görür ve hamleler sırayla yapılır.',
 [('06-eslesme.png','Eşleşme arayüzü, yerel görünüm'),('05-duello.png','Düello tahtası, yerel test rakibi')],None,None,[
 ('Rakip ve sıra','Hesapla girişten sonra sistem otomatik eşleştirir. Pas hakkı vardır. Bir oyuncu çekildiğinde, süre dolduğunda veya tahta ve eller oynanamaz olduğunda maç sonuçlanır.'),
 ('Antrenman ayrımı','Sunucuda gerçek oyuncu bulunmadığında tanımlı süre sonunda bilgisayar rakibiyle antrenman açılabilir. Bu maç Elo ve dereceli galibiyet istatistiğini değiştirmez.')]),
('Sıralama ve mağaza','Sıralama oyuncunun performansını, mağaza ise tekil oyunda kullanabileceği yardımcı araçları gösterir.',
 [('07-siralama.png','Yerel sıralama örneği'),('08-magaza.png','İpucu, Yerleştir ve Ek Puan')],None,None,[
 ('Sıralama','Canlı sürüm, gerçek oyuncuların tamamlanan maçlarını seçilen dile göre sıralar. Rekabet verisi az olduğunda antrenman rakipleri ayrı bir alanda gösterilebilir.'),
 ('Ekonomi','Hamle ile kazanılan altın animasyonla sayaca akar. Tekil mağaza cihazdaki altını ve güçlendirmeleri kullanır. Çevrimiçi cüzdan sunucuda ayrı tutulur.')]),
('Ses, ayarlar ve geri bildirim','Görsel hareket, ses ve açık durum metinleri, hamle sonucunun ve sıranın okunmasını kolaylaştırır.',
 [('09-ayarlar.png','Dil, genel ses ve parça seçimi'),('03-hamle-ve-altin.png','Ekrana sığan altın animasyonu')],None,None,[
 ('Ses seçenekleri','Oyun Müziği, Piyano ve Kapalı seçenekleri bulunur. Müzik düşük seviyede ve döngüde çalar. Oyun içi kare hoparlör düğmesi efektlerle birlikte genel sesi yönetir.'),
 ('Hareket ve erişim','Paralar ekran sınırı içinde hareket eder. Azaltılmış hareket tercihinde uçuş atlanır. Kare ve ses düğmesi erişilebilir etiketler taşır. Dil oyun içinden değiştirilebilir.')]),
('Ekranlar ve dağıtım','Aynı tahta ve istemci kodu farklı görünüm alanlarına uyarlanır. Paketler, platform gereksinimlerine göre aynı çekirdeği kullanır.',
 [('12-kapak-ekrani.png','Dar katlanabilir kapak benzetimi'),('14-tablet.png','Tablet görünümü')],None,None,[
 ('Ekran davranışı','Dar ve uzun ekranlarda tahta ve raf dikey dizilir. Kısa yatay ekranda raf ve kontroller tahtanın yanına geçer. En kısa portre boyutlarında dikey kaydırma kullanılabilir.'),
 ('Sürüm durumu','Android ve Huawei test APK’ları, imzasız iOS cihaz arşivi, iOS simülatör arşivi, bağımsız HTML ve Facebook Games paketi teslim edilir. Mağaza onayı ayrı süreçtir.')]),
]

TECH=[
('Bileşen mimarisi','Aynı JavaScript motoru tarayıcıda önizleme ve tekil oyun, Node.js üzerinde ise yetkili çevrimiçi hamle doğrulaması yapar.',None,
 [('Web / WebView','HTML, CSS, app.js ve audio.js'),('Oyun motoru','engine.js, sözlük ve duel-rules.js'),('Node HTTP','online.js ile aynı köken üzerinden JSON'),('SQLite','Kullanıcı, oturum, maç ve sıralama')],None,[
 ('İstemci sınırı','app.js ekranları ve yerel kayıtları yönetir. online.js oturum, kuyruk, bekleme ve maç görüntüsünü yönetir. Tahta ve puanın çevrimiçi nihai hali HTTP yanıtından gelir.'),
 ('Mobil kabuklar','Android Activity bir WebView açar. iOS UIKit sahnesi WKWebView kullanır. Çevrimdışı sürüm yerel HTML ile başlar. GAME_URL verilirse güvenli barındırılan sürüm yüklenir.'),
 ('Çalıştırma','Node.js 24 ile game/server.cjs çalıştırılır. HTTP varlıkları izinli dosya listesinden sunulur. Node’un yerleşik SQLite modülü kalıcı işlemleri yürütür.')]),
('Tahta ve puan motoru','13 × 13 tahta bir boyutlu dizide tutulur. Motor harf yerleşimini ve yeni oluşan tüm kelimelerin puanlarını aynı sonuçta döndürür.',None,
 [('Yerleşim','Koordinat, boşluk ve doğrultu'),('Bağlantı','Sabit taş veya merkez üzerinden'),('Kelime','TR / EN sözlük kontrolü'),('Puan','Harf ve kelime çarpanları')],('engine.js / doğrulama örneği','const result = Engine.validate(board, tiles, "tr");\nif (result) {\n  console.log(result.words, result.wordScores, result.score);\n}'),[
 ('Puan ayrıntısı','Her oluşan kelimenin harf puanları toplanır, yeni taşların harf ve kelime çarpanları uygulanır. Birden fazla kelimeye bağlantı bonusu eklenir. Dönen tahta, puan, kelimeler ve kelime puanları istemci geri bildirimini besler.'),
 ('Yasal hamle arama','findLegalMove, dil sözlüğünü önek ağacına dönüştürür. Tahta çizgilerinde eldeki harfleri yerleştirebilen ön ekleri izler, adayları aynı validate işleviyle doğrular.'),
 ('Sözlük','dictionary.js istemci ve sunucu ortak veri kaynağıdır. Ayrı SQLite kelime arşivi inceleme ve veri sorgusu içindir. Kaynak ve lisans notları paketlenmiştir.')]),
('Tekil akış ve yerel veri','Serbest antrenman için sunucu oturumu gerekmez. Oyun tahtası mevcut oturumda kalır, tercihler ve mağaza verisi tarayıcıda tutulur.',None,
 [('Başlat','openPractice ve açılış taşı'),('Hamle','validate, puan ve altın'),('Yenile','Kullanılmış slotlara taş çek'),('Sonuç','Dolu tahta veya Bitir')],('app.js / antrenman taş çekimi','function practiceDraw() {\n  if (!match.bag.length) match.bag = makeBag();\n  return match.bag.pop();\n}'),[
 ('Taş torbası','Tekil torba boşaldığında yeni torba hazırlanır. Elde geçerli hamle yoksa yeni taş çekme veya sonuç alma seçenekleri gösterilir. Tahta taşları otomatik silinmez.'),
 ('Kayıt kapsamı','Dil, ses, müzik seçimi ve tekil mağaza bakiyesi localStorage içindeki profil ile saklanır. Yerel veriler tarayıcı profiline ve uygulama deposuna bağlıdır.'),
 ('Yerel düello','Bağımsız paket, ağ hesabı olmadan seçili dilde yerel bilgisayar rakibiyle oynanabilir. Yerel sonuçlar canlı Elo listesine gönderilmez.')]),
('Hesap ve oturum yönetimi','Canlı sürümde hesap adı, görünen ad ve şifre kullanılır. Sunucu oturum kimliğini HTTP çereziyle yönetir.',None,
 [('İstemci','Kayıt veya giriş formu'),('Sunucu','Scrypt ile parola doğrulama'),('Oturum','Rastgele gizli değer, SHA-256 özeti'),('İstek','HttpOnly / SameSite=Strict')],('Örnek istek sırası','POST /api/register { handle, name, password }\nGET  /api/session\nPOST /api/profile { name, currentPassword, password }\nPOST /api/logout\nPOST /api/delete-account { password }'),[
 ('Parola saklama','Kullanıcı için ayrı salt ve scrypt çıktısı tutulur. Şifre doğrulaması sabit zamanlı karşılaştırma kullanır. Şifre değişiminde mevcut oturumlar iptal edilir ve yeni oturum açılır.'),
 ('Oturum ve izin','Çerez değeri veritabanına açık yazılmaz. Sunucu özetle eşleştirir ve son kullanım tarihini kontrol eder. HTTPS için COOKIE_SECURE=1 kullanılır. Hesap silme kimliği ve bağlantılı dereceleri kaldırır.'),
 ('Kapsam','E-posta ile sıfırlama veya üçüncü taraf giriş bu sürümde yoktur. Parola doğrulaması gereken işlemler mevcut şifreyi ister.')]),
('Çevrimiçi eşleşme','Kuyruk, sıra ve maç sürümü sunucu tarafından tutulur. İstemci kısa aralıkla yeniden sorgulayarak durum değişikliklerini alır.',None,
 [('Kuyruğa gir','POST /api/queue ve dil'),('Eşleş','Aynı dilde en eski aday'),('Sıra','GET /api/game ile güncelle'),('Bitiş','Sonuç, istatistik ve Elo')],('Tipik HTTP akışı','POST /api/queue { "lang": "tr" }\nGET  /api/game\nPOST /api/move { id, version, tiles, pass }\nPOST /api/resign { id, version }\nPOST /api/cancel'),[
 ('Eşzamanlılık','Kuyruk kaydı, rakip seçimi ve yeni maç tek veritabanı işlemi içinde yürür. 12 saniyeye kadar görülmeyen kuyruk kayıtları temizlenir. BOT_WAIT_MS varsayılan olarak 10 saniyedir.'),
 ('Maç görünümü','Sunucu yalnızca isteyen oyuncunun rafını, ortak tahtayı, puanları ve kalan taş sayısını gösterir. Rakibin rafı ve torbanın sırası sunucu tarafında kalır.'),
 ('Gecikme ve yenileme','Sürüm numarası eski veya yinelenen hamleyi ayırt eder. İstemci güncel maç durumunu yeniden uygular. Etkin olmayan maçlar sunucu sorgularında süre kuralına göre sonuçlanır.')]),
('Sunucuda hamle işlemi','Sunucu, istemciden puan kabul etmez. Oturum, sıra, maç sürümü, taş sahipliği ve sözlük kontrolü birlikte geçer.',None,None,
 ('server.cjs / yetkili hamle, özet','if (g.turn !== actor) fail(409, "not_turn");\nconst result = E.validate(g.board, tiles, g.lang);\nif (!result) fail(422, "bad_move");\nmove(g, tiles, result);'),[
 ('İşlem sınırı','Durum BEGIN IMMEDIATE ile kilitlenir. move, kabul edilen tahtayı ve puanı uygular, kullanılan slotları torbadan doldurur, sürümü artırır ve sırayı değiştirir. Hata halinde işlem geri alınır.'),
 ('Örnek gövde','id ve version maç görünümünden alınır. Her tiles öğesinde r, c, letter ve slot yer alır. Pas hamlesi boş tiles ve pass true ile gönderilir. Aynı slot iki kez kullanılamaz.'),
 ('Sonuç ve sıralama','Gerçek oyuncu maçında Elo farkı 24 katsayısıyla hesaplanır. Beraberlik yarım sonuçtur. Galibiyet ve maç sayısı dil bazında kayıt edilir. Bilgisayar antrenmanı sıralamayı değiştirmez.'),
 ('Hata anlamı','400 yapı veya slot sorunu, 401 oturum gereksinimi, 409 eski sürüm veya yanlış sıra, 422 kurala veya sözlüğe uymayan hamle anlamına gelir.')]),
('SQLite veri modeli','Hesap, maç, kuyruk, cüzdan ve derece verileri bir SQLite dosyasında tutulur. Sözlük arşivi ayrı bir veri ürünüdür.',None,
 [('users','Kimlik ve şifre özeti'),('active','Kullanıcı → etkin maç'),('games','Maç kimliği ve JSON durum'),('ratings','Kullanıcı + dil ve Elo')],('Veri sözlüğü / başlıca ilişkiler','users 1 -> N sessions\nusers 1 -> 1 wallets\nusers 1 -> N ratings (lang bazında)\nusers 1 -> 0..1 queue\nusers 1 -> 0..1 active -> games'),[
 ('Alanlar','sessions token özeti ve sona erme zamanını tutar. queue dil, ilk bekleme ve son görülme alanlarını taşır. games içinde tahta, iki raf, torba, sıra, puan ve version bulunur.'),
 ('Operasyon','WAL ve foreign_keys etkinleştirilir. Veri dizini web kökü dışında kalmalıdır. Yedekleme, SQLite WAL ile tutarlı bir anlık görüntü almalıdır.'),
 ('Gizlilik','Dağıtım arşivinde canlı kullanıcı tablosu, token, özel anahtar veya yerel hesap geçmişi bulunmaz. Paketlenen kelime veritabanı kullanıcı verileri içermez.')]),
('Paketleme ve platformlar','Tek kaynak ağacı, çevrimdışı tek dosyalı HTML ve farklı mağaza test biçimlerine dönüştürülür.',None,
 [('Kaynak','game/ ve mobil kabuklar'),('Derleme','HTML paketleyici, AAPT2/D8, Swift'),('Çıktı','HTML, APK, IPA ve Facebook ZIP'),('Dağıtım','HTTPS, imza ve platform incelemesi')],('Yeniden derleme','python3 scripts/package-standalone.py\npython3 scripts/package-facebook.py\nbash scripts/build-android.sh\nbash scripts/build-ios.sh iphoneos\nbash scripts/build-ios.sh iphonesimulator'),[
 ('Android ve Huawei','AAPT2, D8 ve apksigner ile Android 26+ test APK’sı üretilir. Huawei APK aynı WebView uygulamasıdır ve Google Play Services bağımlılığı yoktur. Üretim imzası ve mağaza incelemesi yayın sahibine aittir.'),
 ('iOS','Swift ve WKWebView kullanılır. arm64 cihaz IPA’sı imzasızdır. Simülatör arşivi ayrı üretilir. İmzalı cihaz yüklemesi için paket kimliğine uygun provisioning gerekir.'),
 ('Facebook ve HTML','Facebook ZIP kökünde index.html ve SDK başlatma köprüsü vardır. Paket yerel oyun modunu kullanır. Gerçek eşleşme, HTTPS sunucu entegrasyonu ve Meta uygulama yapılandırması gerektirir.')]),
('Güvenlik, test ve işletim','Yerel ve çevrimiçi davranış ayrı test edilir. Mağaza ve fiziksel cihaz kapsaması, derleme başarısından ayrı takip edilir.',None,None,
 ('Sunucu ve doğrulama','cd game\nDATA_DIR=../game-data node server.cjs\nnode tests/verify-engine.cjs\nnode tests/verify-server.cjs'),[
 ('Güvenlik kontrolleri','Yazma istekleri kaynak denetiminden geçer. İstek gövdesi boyutu sınırlıdır. Kimlik doğrulama ve kuyruk hız sınırı vardır. Sunucu varlıkları izin listesi ve CSP ile sınırlar.'),
 ('Yayın ayarları','HOST, PORT, DATA_DIR, PUBLIC_ORIGIN, COOKIE_SECURE ve BOT_WAIT_MS çevre değişkenleriyle çalışma şekli belirlenir. İnternet servisi için HTTPS ters vekil, düzenli yedekleme ve gözlemleme gerekir.'),
 ('Ekran testleri','qa/layout.json, WebKit ölçümlerini taşır. Kısa ve dar portrede dikey kaydırma normaldir. Ölçülen tüm tahta kareleri ve yatay sınırlar ayrıca doğrulanır.'),
 ('Ölçek sınırı','Mevcut tasarım tek süreç ve SQLite içindir. Çok örnekli dağıtım, ortak kuyruk, dağıtık kilitleme ve ayrı yük testi gerektirir.')]),
]
GDD_EXTRA=[
 [('İlk 30 saniye','Ana menüden Tekil Oyun seçilir. Kilitli harf ve yedi taş görünür. Oyuncu bir taşı seçip vurgulanan kareye yerleştirir ve Hamleyi oyna düğmesine basar.'),('Oturum biçimi','Tekil mod alıştırma ve puan denemesi içindir. Düello, karşılıklı sıra yönetimi ve dil bazında sıralama ekler. Ekranlar Türkçe ve İngilizce arasında ayarlardan değişebilir.')],
 [('Taş seçimi','Seçili taşın rafı ve uygun kareler belirtilir. Aynı hamlede henüz onaylanmamış taşı geri almak mümkündür. Kilitli ve daha önce oynanmış taşlar yerinden oynamaz.'),('Hamle geri bildirimi','Onaydan sonra yeni kelimeler ve puanları görünür. Oyuncu hamleyi göndermeden önce düğmenin üzerindeki puan öngörüsünden yararlanabilir.')],
 [('Tekrar oynama','Sonuç kartında toplam puan ve yeniden oynama eylemi yer alır. Yeni antrenman farklı bir başlangıç harfi ve yeni bir rafla açılabilir.'),('Taş seçimi tıkanırsa','Torbada taş kalmadığında tekil mod yeni torba oluşturur. Yeni taş çekme, tahtayı silmeden oyuncuya yeni kelime fırsatı verir.')],
 [('Maç görüntüsü','Üst sırada rakip ve oyuncu puanları, altın ve kısa sıra bildirimi bulunur. Alt sırada raf, hamle onayı, Geri Al, Karıştır ve Pas yer alır.'),('Sonuç ekranı','Gerçek oyuncu maçında kimin kazandığı ve güncellenen dereceler gösterilir. Bağımsız paketlerde aynı temel akış yerel rakiple denenebilir.')],
 [('Güçlendirme seçimleri','İpucu uygun kelimeyi ve başlangıç karesini gösterir. Yerleştir önerilen taştan birini tahtaya taşır. Ek Puan bir geçerli hamlede +3 puan ekler.'),('Altın akışı','Tekil oyunda harf kullanımı altın kazandırır. Satın alma ekranı fiyatı ve oyuncunun envanterini gösterir. Yetersiz bakiyede satın alma uygulanmaz.')],
 [('Müzik seçimi','İki parça aynı anda oynatılmaz. Seçim değiştiğinde önceki kaynak durur. Parça seviyesi metalik altın ve hamle efektlerinin altında tutulur.'),('Okunabilirlik','Açık mavi tahta, belirgin harf taşları ve daha ince çarpan etiketleri kullanılır. Tahta üstünde kalan kare hoparlör düğmesi oyun akışını bölmeden sese erişim verir.')],
 [('Doğrulanan ölçüler','WebKit testleri 280 × 510 ile 1366 × 768 arasında sekiz görünüm alanını kapsar. Tahta ve kontroller ölçülen boyutlarda yatay kaydırma olmadan yerleşmiştir.'),('Sürüm sınırları','Katlanabilir ekran örnekleri görünüm alanı benzetimidir. iOS cihaz yüklemesi imza, Facebook ortamı platform yapılandırması, canlı düello ise HTTPS sunucu gerektirir.')]
]
TECH_EXTRA=[
 [('Dosya akışı','Tarayıcı index.html ile açılır. Yükleme sırası sözlük, motor, düello kuralları, ses, bağlantı katmanı ve app.js şeklindedir. Böylece uygulama açılışında ortak çekirdek hazırdır.'),
  ('Paket sınırları','game/ çalışan web uygulamasını, mobile/ işletim sistemi kabuklarını, scripts/ tekrarlanabilir paket işlemlerini, docs/ ve qa/ doğrulama malzemelerini taşır.'),
  ('Dağıtım topolojisi','HTTPS sonlandırıcı dış istemci bağlantısını alır. Aynı köken üzerinden Node.js statik varlıkları ve API isteğini yanıtlar. Yalnızca Node, kalıcı SQLite alanına erişir.')],
 [('Örnek çarpan hesabı','Mevcut A karesi çarpan vermez. Yeni harfler T ve Ş’nin değerleri önce kendi geçerli harf çarpanlarıyla hesaplanır. Yeni yerleştirilen K×2 karesi varsa kelime toplamı ayrıca ikiyle çarpılır.'),
  ('Raf denetimi sınırı','Motor harflerin konumunu ve sözlüğü doğrular. Sanal raftaki slotun gerçekten oyuncuya ait olduğunu çevrimiçi uç ayrıca kontrol eder. Bu ayrım motorun istemci önizlemesinde de kullanılmasını sağlar.')],
 [('Ses ve yaşam döngüsü','audio.js efektleri ve müziği aynı AudioContext içinde ayrı gain seviyeleriyle çalar. Oyun Müziği ve Piyano tek BufferSource üzerinden döner. Kapalı seçimi önceki kaynak üzerinde stop çağırır.'),
  ('Animasyon kapsamı','Altın animasyonu sabit, kesilen bir katmanda çalışır. Görsel nesneler document akışına katılmaz. prefers-reduced-motion etkinse uçuşsuz güncelleme uygulanır.')],
 [('Yaşam döngüsü','Oturum süresi 30 gündür. Kullanıcının oturum anahtarını değiştiren işlemler eski anahtarları kaldırır. Kimlik denetimi başarısız olan API isteği 401 döndürür.'),
  ('Hesap silme','Etkilenen aktif maç sunucuda sonuçlandırılır, kayıt adları anonimleştirilir, oturumlar, kuyruk ve profil verileri temizlenir. Cihazın yerel mağaza verisi ayrı kapsamdır.')],
 [('Süre ve rakip seçimi','Düelloda ilk sıra sunucu tarafından seçilir. 24 saatlik süre kuralı tick ile uygulanır. Hamlesiz süresi dolan eşleşme derecesiz kapatılabilir.'),
  ('Bot kararları','Bot, puan ve oyun tarzını dikkate alan aday üretimini kullanır. Aday yoksa önek ağacından yasal hamle arar. Hamle yoksa pas geçer.')],
 [('Sıra numarası örneği','Sürüm 7 olan oyuncunun kabul edilen hamlesi sürümü 8 yapar. Bir ağ tekrarı aynı sürüm 7 ile gelirse sunucu 409 ve güncel durum döndürür. İstemci ikinci kez puan eklemez.'),
  ('Cüzdan ve ekran','Çevrimiçi altın sunucuda hesaplanır. Oyun sonu, cüzdan ve Elo değerleri aynı sunucu görünümünden istemciye aktarılır.')],
 [('İndeksleme','users.handle benzersizdir. ratings birincil anahtarı kullanıcı + dil birleşimidir. active ve queue kullanıcı başına bir kayıt tutar. Maç kimliği oyun tablosunun birincil anahtarıdır.'),
  ('Veri ayrımı','SQLite sözlük arşivi, oyun veritabanından bağımsız paketlenir. Canlı game.sqlite dizini DATA_DIR aracılığıyla ayrılır ve repoya yüklenmez.')],
 [('Yayın imzası','Test anahtarı ile üretilen APK ve imzasız IPA mağaza yüklemesi için son sürüm imzaları değildir. Uygun imza, mağaza uygulama kaydı ve dağıtım profili yayın aşamasında yapılandırılır.'),
  ('Çevrimiçi ortam','Android ve iOS kabuklarına GAME_URL verildiğinde aynı köken API’leri kullanan barındırılmış oyun açılır. Standalone ve test APK varsayılanında hesap ve gerçek rakip akışı kullanılmaz.')],
 [('Arıza tanısı','Bağlanma sorununda sunucu portu, PUBLIC_ORIGIN, HTTPS vekil ayarı ve SQLite dizininin yazma yetkisi incelenir. Bekleme durumunda dil ve kuyruk süresi kontrol edilir.'),
  ('Kabul sınırı','WebKit boyut ölçümleri fiziksel katlanabilir cihaz yerine geçmez. Meta, AppGallery ve iOS cihaz dağıtımı platform hesapları ve uygun imzalarla ayrıca sınanır.')]
]
for section,extra in zip(GDD,GDD_EXTRA): section[-1].extend(extra)
for section,extra in zip(TECH,TECH_EXTRA): section[-1].extend(extra)
TECH.append(('HTTP sözleşmesi ve hata ayıklama','İstek örnekleri, bir istemci veya entegrasyon testi yazarken kullanılabilecek temel alanları gösterir.',None,None,
 ('Örnek hareket / gerçek istekte oturum çerezi taşınır','POST /api/move\n{\n  "id": "<mac-kimligi>", "version": 7, "pass": false,\n  "tiles": [{ "r": 6, "c": 5, "letter": "T", "slot": 1 }]\n}'),
 [('Oturum ve profil','GET /api/session oturum görünümünü döndürür. POST /api/register ve /api/login hesap açar. POST /api/profile görünen adı ve isteğe bağlı parolayı değiştirir.'),
  ('Oyun ve kuyruk','POST /api/queue {lang} eşleşmeyi dener. POST /api/cancel kuyruktan çıkarır. GET /api/game geçerli maç görünümünü döndürür. POST /api/resign aynı id ve version kurallarını izler.'),
  ('Liderlik','GET /api/leaderboard?lang=tr gerçek oyuncu derece sırasını, oynanan ve kazanılan maç sayılarını sunar. Sunucu listede oyuncunun kendisini ayrıca döndürebilir.'),
  ('İstemciyle sözleşme','409 halinde dönen game alanı varsa yerel durum onunla değiştirilir. 422 yanıtında geçersiz kelimeler detail alanına eklenebilir. İstemci skoru kendi başına kalıcılaştırmaz.')]))

if __name__ == '__main__':
    make(DOCS/'Harf-Atolyesi-GDD.pdf','OYUN TASARIMI','Oyun Tasarım Dokümanı','Kurallar, arayüz, oyun akışları, ses, ekonomi ve platform paketleri.','01-ana-menu.png',GDD,'Ekran görüntüleri bu teslimin çalıştırılan web istemcisinden alınmıştır. Yerel test sahneleri, çevrimiçi mağaza onayı veya fiziksel cihaz ölçümü yerine geçmez.')
    make(DOCS/'Harf-Atolyesi-Teknik.pdf','TEKNİK MİMARİ','Teknik Mimari ve Uygulama','İstemci ve sunucu sınırları, HTTP sözleşmesi, SQLite modeli, mobil kabuklar ve dağıtım.','02-tekil-tahta.png',TECH,'Bu doküman mevcut uygulamayı tarif eder. Planlanan HTTPS barındırma ve mağaza imzalama adımları, çalışan yerel özelliklerden ayrı olarak belirtilmiştir.')
