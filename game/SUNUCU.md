# Harf Atölyesi çevrimiçi sürüm

Node.js 24 ile, paket kurulumu gerektirmeden çalışır. Kaynak arşivini açıp `harf-atolyesi` klasöründe çalıştırın.

```sh
node server.cjs
```

Oyunu [localhost:8787](http://127.0.0.1:8787/) adresinde açın. Ayarlar içinden hesap oluşturun. İki oyuncuyu aynı cihazda denemek için biri normal, biri gizli tarayıcı oturumu kullanabilir. İki hesap da aynı dili seçip Çevrimiçi Düello’ya girdiğinde eşleşir. Oyundan çıkıp yeniden Düello’yu seçerek aktif maça dönebilirsiniz.

- Sunucu, torba ve taşları saklar. İstemciye kendi taşlarınız, ortak tahta, puan ve torbadaki taş sayısı gönderilir. Her hamle sunucuda hem yerleşim hem sözlük açısından doğrulanır.
- Türkçe ve İngilizce dereceler ayrıdır. İlk derece 1000’dir. Gerçek oyuncuların tamamlanan maçları Elo, maç ve galibiyet sayılarını günceller. Az oyuncu varken görünen antrenman rakipleri ayrı başlıkta listelenir.
- Tahtanın dolması veya her iki oyuncunun da geçerli hamlesinin kalmaması maçı bitirir. Pas vermek sırayı değiştirir. Maç başladıktan sonra 24 saat hamle gelmezse sıra kimdeyse o oyuncu süre nedeniyle kaybeder. Hamle yapılmamış maç derecesiz kapanır.
- Yaklaşık 10 saniye sonra bilgisayar rakibiyle derecesiz antrenman açılır. Bunu kapatmak için `BOT_WAIT_MS=-1` ayarlayın.
- Hesap, gösterilen ad, şifre, oturum, maç, dereceler ve çevrimiçi altın bakiyesi SQLite’ta saklanır. Tekil mağaza bakiyesi cihazda saklanır. Tekil oyun, 13×13 tahtada bölüm ve puan eşiği olmadan oynanan serbest antrenmandır.
- Hesap adı ve şifreyle giriş yapılır. Hesap e-posta adresi toplamaz. E-posta ile şifre sıfırlama bu sürümde yoktur. Ayarlar içinden mevcut şifreyle hesap silinebilir.
- Ses efektleri ilk etkileşimden sonra etkinleşir ve Ayarlar’dan kapatılabilir.

## İnternette barındırma

Tek bir Node.js süreci çalıştırın. `DATA_DIR` kalıcı ve erişimi kısıtlı bir disk dizini olmalıdır. Uygulamayı HTTPS sonlandıran bir ters vekil üzerinden yayımlayın ve test edilmiş bir veritabanı yedekleme akışı kullanın.

```sh
HOST=0.0.0.0 PORT=8787 DATA_DIR=/srv/letter-workshop/data \
  PUBLIC_ORIGIN=https://oyun.example COOKIE_SECURE=1 node server.cjs
```

`PUBLIC_ORIGIN` gerçek HTTPS kökeniyle değiştirilir. Uygulama veri dizinini HTTP üzerinden sunmaz. Birden fazla sunucu örneği ve üretim yük testi bu paketin kapsamı dışındadır.

## Doğrulama

```sh
node tests/verify-engine.cjs
node tests/verify-server.cjs
```

İkinci test geçici bir localhost portu ve ayrı bir SQLite veritabanı kullanır. Kullanıcı verilerine dokunmaz.
