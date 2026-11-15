# Arksus — 5 dakikada proje

> Bu dosya herkes için; yazılım bilmesen de anlaşılır olsun diye yazıldı. Ayrıntı `PLAN_MVP.md`'de, İngilizce tanıtım `../README.md`'de, tüm belgelerin listesi `README.md`'de.

## Tek cümlede

**Çiftçinin "Tarlamı bu yıl nadasa mı bırakayım, yoksa nohut ya da mercimek mi ekeyim?" sorusuna; su, toprak, verim ve çiftçinin kazancını birlikte tartıp, NASA'nın 24 yıllık iklim verisiyle **o arazi için en uygun seçeneği söyleyen** bir web sitesi. Sitede para gösterilmez.**

Yarışma: NASA Space Apps 2026 — *Field Shift: Adapting Farms with NASA Data*.

## Sorun ne?

İç Anadolu'da kuru tarımda çiftçi buğdaydan sonra tarlayı genelde **bir yıl boş bırakır (nadas)**.

- **İyi tarafı:** Boş tarla yağmuru toprağın içinde biriktirir, **kumbara gibi**. Ertesi yıl ekilen buğday bu suyu kullanır, kurak yılda daha güvenli olur.
- **Kötü tarafı 1 — para:** Nadas yılı hiç ürün yok, gelir yok. Tek yıla bakınca hep zarar gibi görünür.
- **Kötü tarafı 2 — toprak:** Tarla bir yıldan uzun süre çıplak ve sürülmüş kalır. Rüzgâr toprağı uçurur. Karapınar'da 1960'larda yaşanan büyük rüzgâr erozyonunun resmi nedenlerinden biri nadas–hububat sistemi ve diskaro ile sık toprak işlemedir.
- **Alternatif:** Nadas yerine **nohut** veya **mercimek** ekmek. Gelir getirir, havadan azot bağlar, toprağı daha kısa süre çıplak bırakır. Ama toprakta daha az su bırakır; buğday kurak yılda daha çok zorlanabilir.

2025 kuraklığı ve düşük 2026 hububat fiyatlarıyla çiftçiler bu soruyu yine soruyor. **Su, toprak, verim ve kazancı birlikte tartıp araziye göre seçenek söyleyen bir araç yok.** Biz onu yapıyoruz.

## Ne yapıyoruz?

Bir web sitesi. Kullanıcı şunları seçer:

| Seçim | Seçenekler |
|---|---|
| İlçe | 13 ilçe: İç Anadolu'nun her ilinden bir kuru tarım ilçesi (Karapınar, Develi, Polatlı, Eskişehir, Aksaray, Karaman, Niğde, Nevşehir, Kaman, Kırıkkale, Çankırı, Gemerek, Boğazlıyan) |
| Toprak derinliği | Sığ, orta, derin |
| Öncelik | Kazanç / buğday verimi / toprağı koru / su biriktir (kaydırıcılar) |

Site üç seçeneği yan yana gösterir ve önceliklere göre **bu arazi için en uygun** olanı söyler (fiyat sadece arka planda kazanç tahmini için kullanılır; buğdayı düşüren ya da çoğu yıl başarısız olan seçenek, kazançlı olsa bile önerilmez):

1. **Nadas → Buğday** (bugünkü uygulama, karşılaştırma noktası)
2. **Nohut → Buğday**
3. **Mercimek → Buğday**

Her biri için şunlar gösterilir: buğday ekiminde toprakta ne kadar su kaldı · tarla kaç gün çıplak kaldı, kaçı rüzgârlı ve kuruydu · buğday verimi (su yeterli olsaydı alınacak verimin yüzdesi) · iki yılda kaç hasat · öneri, gerekçesi ve sonuçların yakın olup olmadığı · hangi durumda hangisi öne geçiyor (kurak/normal/ıslak yıl × toprak derinliği) · neden bu seçenek, kanıtı ne, neyi bilmiyoruz.

**Neden bu ürün?** Önerilen seçeneğin neden öne çıktığı kısa, sade cümlelerle yazılır. Bu cümleler sadece sitenin kendi sayılarından üretilir. Çiftçi maskotu bu açıklamayı Türkçe ya da İngilizce sesli okur; ses dosyaları ücretsiz, yerel bir seslendirme aracıyla (Piper) önceden hazırlanır.

Bunların yanında gübre planı (TAGEM toprak analizi tabloları), ekim önerisi (zaman, tohum miktarı, derinlik) ve toprak koruma uygulamaları da gösterilir. Ayrıntı: `GUBRE.md`.

**Tek bir yıl değil, geçmiş 24 yılın her biri için ayrı ayrı hesaplıyoruz** (2001–2024 başlangıçlı). Böylece "ortalama" değil, **aralık** görünür: kötü yılda ne olur, iyi yılda ne olur.

## Nasıl çalışıyor? (4 adım)

```
1. NASA POWER        2. Su hesabı (motor)        3. Verim oranı           4. Öneri (sitede)
günlük hava    ──►   toprağı bir su deposu  ──►  "su yeterse en       ──►  kazanç (iç hesap) + buğday
(yağmur, sıcaklık,   gibi her gün hesaplar:      yüksek verimin           verimi + toprak + su puanı;
rüzgâr, güneş)       yağmur girer, buharlaşma    yüzde kaçı?"             verimi bozan seçenek engellenir
24+ yıl              ve bitki çıkarır            (0 ile 1 arası)          → "bu arazi için en uygun"
                     (FAO-56 yöntemi)
```

- **1–3. adımlar** bilgisayarda bir kez çalışır (Python), sonuçları dosyaya yazar.
- **4. adım** sitede çalışır. Çiftçi öncelik kaydırıcılarını değiştirdiği an öneri yeniden hesaplanır. Fiyat ve destek sadece arka planda kullanılır; ekranda para yok. Sunucu yok, veritabanı yok; site çok basit ve sağlam.

Kullandığımız veriler:

| Veri | Ne için |
|---|---|
| **NASA POWER** | günlük hava, motorun ana verisi; yağış en yakın istasyonun 30 yıllık normaline göre düzeltilir |
| **NASA GPM IMERG** | ikinci uydu yağış tahmini, yağışı kontrol için |
| **NASA MERRA-2** | toprak nemi; modelin toprak suyunu kontrol için (NASA SMAP verisi gelmediği için onun yerine) |
| **NASA MODIS NDVI** | bitkinin yeşerme takvimi; sulanan tarlaları ayıklamak için (13 noktadan 9'u sulu tarlaya düşüyordu, kuru tarlaya taşındı) |
| **SoilGrids** (ISRIC) | toprak dokusu ve taşlılık |
| **ESA WorldCover** | noktanın gerçekten tarla olduğunu kontrol için |

## Ne DEĞİL?

- Senin tarlanın kesin verim tahmini değil → "bölgedeki tipik bir tarla, geçmiş 24 yılın iklimi".
- Fiyat tahmini değil → fiyat ve destek sadece arka planda, hangi seçeneğin daha çok kazandırdığını tartmak için kullanılır; ekranda para yok.
- Gübre danışmanı değil → fosfor, potasyum gibi şeyler uydudan ölçülemez, toprak analizi gerekir; bunu açıkça yazıyoruz.
- Son sözü söyleyen bir sistem değil → önceliklere göre en uygun seçeneği, gerekçesini ve engellenen seçenekleri dürüstçe gösterir; kararı çiftçi ve yerel uzman verir.

## Kim ne yapıyor?

| Kişi | Ne yapıyor | Basitçe |
|---|---|---|
| **Muhammet** | Araştırma, doğrulama, sunum | Fiyat, maliyet, destek, verim, ekim tarihlerini resmi kaynaklardan bulur; strateji metinlerini yazar; slayt, video, proje sayfası, teslim |
| **İsmail** | Web sitesi | Kullanıcının gördüğü her şey: kartlar, grafikler, kaydırıcılar, telefon uyumu |
| **Ömer** | Motor (Rol A) | Toprak su hesabını yapan Python kodu: "her gün toprakta ne kadar su var, bitki ne kadar zorlandı" |
| **Gümüş** | Veri ve bağlantı (Rol B) | NASA verisini indirir, motorun çıktısını siteye uygun dosyalara çevirir, karar (öneri) modülü, repo ve yayın |
| **Biar** | 3B harita | Türkiye'nin üç boyutlu arazi haritası; ilçe, tarla ve parsel seçimi |

**Herkes nasıl birbirini beklemeden çalışıyor?**

```
Muhammet ──(rakamlar, metinler)──► Gümüş ──(hava verisi)──► Ömer ──(su sonuçları)──► Gümüş ──(JSON dosyaları)──► İsmail ──► SİTE
```

İlk saatte Gümüş **sahte (mock) ama doğru biçimli** dosyalar koyar. İsmail siteyi bu sahte verilerle yapar. Ömer motoru kendi test verisiyle yazar. Gece yarısına doğru sahte veri gerçek veriyle değişir; dosyaların biçimi aynı olduğu için hiçbir şey bozulmaz. Bu biçim `docs/ARAYUZLER.md`'de yazılı ve **ilk saatten sonra değişmez**.

## Çalışma kuralları (5 madde)

1. **Uydurma sayı yok.** Her sayının kaynağı var. Bulamadıysak "varsayım" diye yazarız.
2. **Herkes kendi dosyasında.** Başkasının dosyasına dokunmadan önce sor.
3. **Her yazılımcı kendi branch'inde.** En az 2 saatte bir birleştirir; ana dal her zaman çalışır.
4. **Biten görev `TASKS.md`'de işaretlenir** (AI ajanı da kendi işaretler, sadece senin bölümünde).
5. **Her milestone'da site çalışır olmalı.** Küçük ama çalışan > büyük ama bozuk.

## Zaman çizelgesi (T0 = Cumartesi 15:00)

> Yarışma sırasında kullanılan plan; kayıt için duruyor.

| Saat | Ne olmalı |
|---|---|
| 16:00 (M0) | Repo, sözleşme, sahte veriler hazır; boş site yayında |
| 19:00 (M1) | Her parça tek başına çalışıyor |
| 00:00 (M2) | Gerçek NASA verisiyle uçtan uca çalışıyor → `v0.1` (güvenlik ağı) |
| 05:00 (M3) | MVP tamam → `v0.2` (demo sürümü) |
| 05:00–10:00 | Zaman kalırsa ekstralar (toprak nemi karşılaştırması, kurak/sıcak senaryolar, Türkçe dil...) |
| 10:00 | Özellik dondurma; sadece hata düzeltme |
| 10:00–13:30 | Video, slayt, proje sayfası, teslim |

## Mini sözlük

| Terim | Anlamı |
|---|---|
| Nadas | Tarlayı bir sezon ekmeden bırakmak |
| Rotasyon | İki yıllık ürün sırası (ör. nohut → buğday) |
| ET / ET₀ | Topraktan ve bitkiden havaya giden su (buharlaşma + terleme). ET₀ = "referans" değer, hava koşullarından hesaplanır |
| FAO-56 | BM Gıda ve Tarım Örgütü'nün bu hesap için standart yöntemi |
| Su bütçesi | Toprağa giren su − çıkan su = depoda kalan su |
| Tarla kapasitesi | Toprağın süzüldükten sonra tutabildiği su ("depo dolu") |
| P10 / P50 / P90 | 24 yılın kötü / orta / iyi ucu. P50 = ortanca |
| Mock | Sahte ama doğru biçimli veri; site erken yapılabilsin diye |
| Sözleşme | Dosyaların ve alanların adları; herkesin kodu buna uyar |
| Branch / merge | Herkesin kendi kopyası / kopyaları ana dala birleştirmek |
| Milestone | Kontrol noktası; o saatte belli şeyler çalışıyor olmalı |
| NDVI | Uydudan ölçülen bitki yeşilliği; 0'a yakın çıplak toprak, 1'e yakın gür bitki |
| Nadas etkinliği | Nadas yılında düşen yağmurun yüzde kaçının toprakta kaldığı |
