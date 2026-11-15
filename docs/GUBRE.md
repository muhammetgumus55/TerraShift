# GUBRE.md — Gübre önerisi: ne yapar, nasıl çağrılır, simülasyonda nasıl gösterilir

Sahibi: Gümüş (Rol B). Okuyucu: İsmail (web, simülasyon). 15 Kas 2026.
Sözleşme: `docs/ARAYUZLER.md` §13 · Kod: `web/src/lib/fertilizer.ts` · Kurallar: `engine/config/fertilizer.yaml` → `web/public/data/fertilizer.json`

## 1. Bir cümlede

Kullanıcı ürünü, sulama durumunu ve toprak analizini (ya da SoilGrids'ten gelen ön değerleri) verir. Modül de dekara kaç kg saf N, P2O5 ve K2O gerektiğini, bunun hangi gübreden kaç kg olduğunu ve ne zaman verileceğini söyler. Uyarıları, eksik analizleri ve her sayının kaynağını da ekler.

## 2. Hesap nasıl yapılıyor (sistem neye bakarak önerir)

| Adım | Ne | Kaynak (rozet) |
|---|---|---|
| 1. Saf besin | **TAGEM "Gübre Tavsiyeleri", Orta Anadolu çizelgeleri.** Organik madde (%) → N; Olsen P (kg P2O5/da) → P2O5; yarayışlı K (kg K2O/da) → K2O. Değer bir sınıfa düşer, sınıf dekara saf besini verir. "Kuru" satırları `rainfed`, "Sulu" satırları `limited` ve `irrigated` için kullanılır. | official ✓ |
| 1b. Baklagil | Tohum Rhizobium ile **aşılıysa** azot tablodan değil, başlangıç dozundan gelir: nohut 3 kg N/da (GKGM 2–4), mercimek 2,3 kg N/da (GKGM 12–14 kg DAP). Aşısızsa TAGEM tablosu kullanılır ve "aşılayın" uyarısı çıkar. | official ✓ |
| 1c. Tablo yoksa | Önce verim eğrisi (soğan, Albayrak ve Elmacı 2017: tepe noktası 13 kg N/da), o da yoksa raporun **besin dengesi**: hedef verim × birim alım − topraktan alınan, sonuç gübre etkinliğine bölünür. Hiçbiri yoksa `pending` döner. | literature / **assumption** |
| 2. Gübre seçimi | Taban gübre fosforu karşılar (N ve K'sı da sayılır). Kalan K için potasyum sülfat, kalan N üst gübreye gider ve dönemlere bölünür (buğday sulu %60 kardeşlenme, %40 sapa kalkma). | YAML'daki koşullar |
| 3. Toprak bayrakları | pH > 7,5 alkali · kireç > %15 yüksek · organik madde < %1 çok az · toplam N < %0,09 az · EC > ürün eşiği tuzlu · Zn < 0,5 mg/kg eksik · çinko analizi yoksa ve toprak alkali/kireçliyse "çinko muhtemelen eksik" | OGM, Başar 2001, FAO 29, Cakmak 1996 ✓ |
| 4. Uyarılar | Bayraklara ve isteğe göre: çinkolu kompoze, CAN mı üre mi, bant uygulama, tuzlulukta arpa, patateste pH > 7,7 ise kükürt, damla tankında kalsiyum nitrat karıştırma vb. | her uyarının kendi kaynağı |
| 5. Karşılaştırma | Buğdayda Toros rehberinin hedef verime göre ürün dozları (`guide`) yan yana gösterilir. Besin dengesi sonucu da (`balance_kg_per_da`) "çapraz kontrol" olarak durur. | literature ✓ / assumption |

Örnek: buğday, kuru tarım, organik madde %1,5, P2O5 3,5 kg/da, K2O 22 kg/da, pH 8,0, kireç %18.
- TAGEM'e göre gereken saf besin: N 8, P2O5 6, K2O 4 kg/da.
- Çinko analizi yok ve toprak kireçli, bu yüzden taban gübre 30 kg/da çinkolu 20-20-0 (6 kg N'yi de karşılar).
- Potasyum için 8 kg/da potasyum sülfat.
- Kalan 2 kg N için kardeşlenmede 7,7 kg/da CAN.
- Toros rehberinin 250–300 kg/da satırı yanında gösterilir: 12 kg DAP ya da 26 kg çinkolu 20-20-0, üstüne 14 kg CAN.

## 3. Kapsanan ürünler

| id | Ürün | Rotasyonda mı? | TAGEM satırları |
|---|---|---|---|
| `wheat` | Buğday | evet | N, P, K: Kuru + Sulu |
| `barley` | Arpa | hayır | N, P: Kuru + Sulu (K satırı yok → denge, ABD alım değeri) |
| `chickpea` | Nohut | evet | N, P: Kuru; kısıtlı/sulu su seçilirse aynı Kuru satırı `assumption` rozetiyle (TAGEM'de sulu satır yok) (K yok → `pending`) |
| `lentil` | Mercimek | evet | N, P: Kuru; kısıtlı/sulu için aynı Kuru satırı `assumption` rozetiyle (K yok → denge, zayıf kaynak) |
| `sugar_beet` | Şeker pancarı | hayır | N, P, K: Sulu (N tavanı 15) |
| `potato` | Patates | hayır | N, P, K: Sulu |
| `onion` | Kuru soğan | hayır | N, P: Sulu; K: "Sebze" satırı (**kabul**) |

Pancar, patates ve soğan kuru tarımda yetiştirilmez. `rainfed` seçilirse tablo yoktur, plan `pending` ya da verim eğrisi gösterir. Simülasyonda bu üç ürün için kuru tarım seçeneğini gri gösterin ya da hiç sunmayın.

## 4. API (İsmail sadece bunları çağırır; bileşende gübre hesabı yok)

```ts
import type { FertilizerFile, ResultsFile } from './lib/types';
import { soilFromResults, recommend, type SoilTest, type FertPlan } from './lib/fertilizer';

const fert: FertilizerFile = await (await fetch('/data/fertilizer.json')).json();

// 1) İlçe seçildi → SoilGrids'ten ön değer (pH, toplam N, organik madde). Rozet: model
const pre = soilFromResults(results, fert);   // { soil, badges, needs_lab }

// 2) Kullanıcı analiz raporundan girer (rozet: user). Boş bırakılan alan undefined kalır.
const soil: SoilTest = { ...pre.soil, p2o5_kg_per_da: 3.5, k2o_kg_per_da: 22, lime_pct: 18 };

// 3) Plan
const plan: FertPlan = recommend(fert, {
  crop: 'wheat', water: 'rainfed', soil,
  target_yield_kg_per_da: undefined,   // boşsa YAML varsayılanı (buğday kuru 296, TÜİK); tablolar hedef istemez
  inoculated: false,                   // sadece baklagil
  banding: false,                      // kombine mibzer: kompoze −2, DAP −1 kg/da (Toros)
  drip: false,                         // sadece uyarı ekler
});
```

`SoilTest` alanları Türk laboratuvar raporundaki gibidir: `om_pct`, `p2o5_kg_per_da`, `k2o_kg_per_da`, `total_n_pct`, `ph`, `lime_pct`, `ec_ds_m`, `zn_ppm`. Rapor ppm veriyorsa `olsen_p_ppm` / `k_ppm` da girilebilir. Bunlar 0–20 cm ve 250 000 kg toprak/da kabulüyle kg/da'ya çevrilir ve `plan.derived` listesine düşer; rozeti **assumption** olur.

`FertPlan` içinde gösterilecekler:

| Alan | Ne göster |
|---|---|
| `nutrients[]` | N, P2O5, K2O için `fertilizer_kg_per_da` + `source.type` rozeti. `basis`: `soil_table` "Resmi tablo (TAGEM)"; `fixed_starter` "Baklagil başlangıç dozu"; `response_curve` "Verim eğrisi"; `balance` "Hesap (doğrulanmamış katsayılar)"; `needs_soil_test` "Toprak analizi gerekli"; `pending` "Kaynak bekleniyor" (sayı değil). |
| `doses[]` | Gübre adı (`fert.products[id].label`), kg/da, zaman (`timing`: `base` ekimle/taban, `top_1`, `top_2` → etiket `fert.crops[crop].n_split[water][i].label`). |
| `flags[]` | Rozet chip'leri: alkali, kireçli, organik madde çok az, tuzlu, çinko eksik / muhtemelen eksik. |
| `advice[]` | `text.tr` / `text.en` + kaynak + rozet. Sıra: önce ürüne ait, sonra genel. |
| `missing[]` | "Bu değerleri analiz ettirirsen plan netleşir: …" |
| `better_for_salinity[]` | Tuzluysa: "Bu tuzlulukta daha dayanıklı: arpa, şeker pancarı". |
| `guide` | Buğday için "Toros rehberi bu verim sınıfında: …" karşılaştırma satırı. |
| `need_kg_per_da`, `soil_supply_kg_per_da`, `balance_kg_per_da` | İsteğe bağlı "çapraz kontrol" açılır kutusu, rozet **assumption** (rapor katsayıları kaynakta bulunamadı). |

## 5. Simülasyon akışı (öneri)

1. **İlçe seç:** `results/{loc}.json` → `soilFromResults`. pH, organik madde ve toplam N **model** rozetiyle dolu gelir. P, K, kireç, EC ve Zn boş kalır (`needs_lab`). Yanlarına "uydu ölçemez, analiz gerekir" yazın.
2. **Ürün ve sulama seç:** 7 ürün; `water` kuru / kısıtlı sulu / sulu. Rotasyon ekranından gelindiyse ürün `wheat`, `chickpea` ya da `lentil`, sulama `rainfed` olur.
3. **Toprak analizini gir (isteğe bağlı):** her alan ayrı bir kaydırıcı ya da kutu. Değiştikçe `recommend` yeniden çağrılır (hesap anlık, ağ isteği yok).
4. **Sonuç kartı:**
   - Üstte cümle: "Bu tarla ve ürün için önerilen gübre planı: …"
   - Altta zaman çizelgesi: ekimle, kardeşlenme, sapa kalkma.
   - Her satırda gübre adı, kg/da ve rozet.
5. **"Neden?" bölümü:** hangi tablo sınıfına düşüldü (ör. "organik madde %1,5 → 1,1–2,0 sınıfı → 8 kg N/da"), bayraklar ve uyarılar.
6. **Rotasyon bağlantısı:** "Nohut → Buğday" seçildiyse önce nohut planını (aşılı varsayılan), sonra buğday planını gösterin. Gübre kararı rotasyon puanına **girmez**; sadece bilgi olarak durur.

## 6. Gösterim kuralları (AGENTS.md)

- **Para yok:** TL, fiyat, maliyet ya da tasarruf yazılmaz. Sadece kg/da gösterilir. "Gübreden tasarruf" yerine "daha az gübre yeter" denir.
- **Öneri dili:** "önerilir", "önerilen plan". "Kesin", "mutlaka", "yasak" ya da "garanti" yazılmaz.
- **Rozet:** her sayının yanında `source.type` olur (official, literature, statistic, model, assumption, user). `verified: false` olanlar "doğrulanmadı" olarak işaretlenir.
- **`null` sayı değildir:** `fertilizer_kg_per_da: null` ise "toprak analizi gerekli" ya da "kaynak bekleniyor" yazın, asla 0 yazmayın.
- **Yuvarlama:** modül 0,1 kg/da'ya yuvarlar. Arayüzde tam sayı göstermek serbest, ama hesapta modülün değeri kullanılır.

## 7. Rapordan alınmayanlar ve neden

15 Kasım'daki ekip raporunun (yapay zekâ destekli özet) sayıları kaynaklarında tek tek arandı:

| Rapordaki iddia | Durum |
|---|---|
| Toros buğday tablosu (DAP 13–14 / CAN 28–32 …) | **Yanlış**: Toros sayfası farklı (kuru 300–400: DAP 14, CAN 16). Gerçek değerler `guide_table`'da. |
| Pancar için topraktaki P2O5'e göre tablo (altinkukurt) | Sayfada **yok**; yerine TAGEM Çizelge 22 kullanıldı. |
| Pancar "4–5 kg N/da kaldırır" | Kaynak bulunamadı. TAGEM'de N en çok 15, bu tavan olarak kullanıldı. |
| Patates damla sulama takvimi (25.–85. günler) | Kaynak bulunamadı; Toros "uzmana danışın" diyor. Takvim yerine bu uyarı veriliyor. |
| Patateste 60–70 kg/da kükürt (uyuz) | Bulunamadı. Toros: pH > 7,7 ise dikimden bir ay önce toz kükürt (doz yok). |
| Patates 55–60 kg 15.15.15 / 40–45 kg 20.20.0 | Bulunamadı; TAGEM tablosu kullanılıyor. |
| Soğanda "ekonomik optimum 12,91 kg N" | 12,91 makalede **fiyatla** hesaplanmış ekonomik doz, bu yüzden kullanılmadı. Verimin tepe noktası 13 kg N/da (Yalova denemesi). |
| Bant uygulamada %10–15 azaltma | Toros: kompoze −2 kg, DAP −1 kg/da. Bu kullanıldı. |
| Toprak kütlesi 250 000 kg/da; %5, %40 yarayışlılık; %60/30/50 gübre etkinliği | Kaynakta bulunamadı. Sadece ppm çevirisinde ve çapraz kontrolde, **assumption** rozetiyle. |
| Nohut "aşılıysa 2–3 kg N" | GKGM 2–4 diyor; orta değer 3 kullanıldı. |
| Hava durumu API'si ile üre ya da yaprak gübresi zamanlaması | Yok. Sadece metin uyarısı var: "sıcakta ve 5–10 gün yağışsız dönemde üre kaybı"; yaprak gübresini sabah ya da akşam uygulayın. |

## 8. Değiştirmek gerekirse

- Sayı ya da kural değişikliği: `engine/config/fertilizer.yaml` (Gümüş). Ardından `cd engine && python -m nobetsu.build --out ../web/public/data` ya da sadece export.
- Testler: `engine/tests/test_fertilizer.py` (YAML bütünlüğü, TAGEM spot değerleri, para ve yasak kelime yok) ve `web/src/lib/fertilizer.test.ts` (elle hesaplanmış planlar).
- Yeni ürün eklemek için kod yazılmaz; YAML'a yeni bir `crops.<id>` girilir. Yalnız ürün `FertCropId` tipine ve şemanın `crops` listesine de eklenmeli (sözleşme değişikliği, Gümüş).

## 9. Nasıl ekilir (15 Kas)

Gübre kartının altında ikinci bir kart: **ne zaman, dekara ne kadar tohum, ne derine, hangi sıra aralığıyla**. Kurallar `engine/config/sowing.yaml` → `web/public/data/sowing.json`, hesap `web/src/lib/sowing.ts` (`sowingPlan`, `seedKgPerDa`, `windowStatus`), kart `web/src/screens/result/Sowing.tsx`. Araştırma: `docs/research/fertilizer-sowing-soil-health-report.md`.

| Ne | Kural | Kaynak (rozet) |
|---|---|---|
| Ekim penceresi | Buğday kuru 15 Eylül–10 Ekim, sulu 1–10 Ekim; arpa 21 Eylül–19 Ekim; kışlık mercimek Ekim; yazlık mercimek "Şubat sonu–Mart başı"; nohut "ilkbaharda tarlaya girilebilen ilk günler, son dondan 7–10 gün önce" (kaynağın tarih vermediği yerde tarih uydurulmaz, kaynağın sözü yazılır) | TİGEM Bölüm 4 (literature ✓), GKGM Yemeklik Baklagil (official ✓) |
| İl penceresi yok | Konya dışındaki ilçelerde "Orta Anadolu/Konya penceresi en yakın kaynaklı değer" notu; Gemerek, Boğazlıyan ve Develi'de "soğuk ilçe: pencerenin başına kayar" (sayı yok) | assumption |
| Tohum/m² | Ekmeklik çok kardeşlenen 500–550, az kardeşlenen 550–600, makarnalık 550–600, kışlık arpa 450–550, kışlık mercimek 300–350, nohut 100 bitki/m² | TİGEM, Adak 1999, GKGM |
| Aralıkta hangi nokta | İyi tohum yatağı ve zamanında ekim → alt sınır; geç ekim ya da kötü yatak → üst sınır; aksi halde orta (TİGEM'in kuralı) | TİGEM |
| kg/da | **Formül:** tohum/m² × bin tane ağırlığı (g) × 10 ÷ (saflık % × çimlenme %), çiftçinin etiket değerleriyle (rozet `user`). Kaynağın kg/da aralığı da yanında: ekmeklik 18–19, makarnalık 20–21, arpa 20–22; serpme ekimde ya da kötü yatakta +3–5; kışlık mercimekte kış zararı payı +1–2 | TİGEM, GKGM |
| Derinlik | Tahıl 4–6 cm (kuru toprakta en az 5–6, 8 cm'den derin ekim riskli), yazlık arpa 3–4, mercimek 4–5, nohut 5–6 | TİGEM, GKGM |
| Sıra arası | Tahıl 15–20 cm (**doğrulanmadı**); mercimek 15–20, yıllık yağış normali 350 mm'nin altındaysa 30 cm (ilçenin MGM/WMO normali, `sowing.json → annual_precip_mm`); nohut 45 (makineli çapa) ya da 30–35 (el çapası) | GKGM; tahıl yalnız arama özeti |
| Uyarılar | Kuru toprakta derin örtme (ala tav), geç ekimde derinliği artırmama, gübre tohumla aynı bantta ise ayrı bant ya da ekimden önce serpip karıştırma (Konya'da +%14–23), çiftçinin 30 kg/da'ya çıkmasının nedeni, kışa 1–3 kardeşle girme, ilaçlı ve sertifikalı tohum, yazlık arpada %83'e kadar kayıp, nohutta ot ve aşılama | TİGEM, GKGM |

Kaynaklardaki iki hata koda yansıtılmadı:
- TİGEM'in Gerek-79 örneği "20 kg/da" yazıyor, formül **21,4** veriyor (kalite düzeltmesi atlanmış). Site kendisi hesaplıyor; `sowing.test.ts` 21,4'ü kontrol ediyor.
- GKGM nohut kitapçığındaki 8–10 kg/da ile 100 bitki/m² hedefi iri taneli nohutta birlikte tutmuyor. Kart ikisini de gösteriyor ve "kaynak içi tutarsızlık" uyarısı veriyor; bin tane ağırlığı girilirse hedefe göre hesaplıyor.

## 10. Toprak sağlığı (15 Kas)

"Nasıl ekilir" kartının altında: **gübrenin ötesinde toprağı korumak için yapılabilecekler**, en güçlü kanıttan başlayarak. Kurallar `engine/config/soil_health.yaml` → `web/public/data/soil_health.json`, hesap `web/src/lib/soilhealth.ts` (`soilHealthPlan`, `modelFacts`, `omClass`), kart `web/src/screens/result/SoilHealth.tsx`.

Kartın üç parçası:
1. **Toprağın iki bilgisi:** organik madde (çiftçinin analizi ya da SoilGrids tahmini) ve Başar 2001 sınıfı (çok az / az / orta / iyi / yüksek); toprak derinliği (çiftçinin cevabı; bilinmiyorsa "orta kabul edildi").
2. **Bu tarlada model ne buluyor?** Motorun kendi sonucu, çiftçinin derinliğinde 24 yılın ortancası: her rotasyon için 2 yılda çıplak gün, rüzgâra açık çıplak gün, sonraki buğdayın nadas sonrasına oranı ve %85 eşiğini geçip geçmediği (`defaults.yaml → decision.guardrails`).
3. **Uygulamalar** (koşula göre), her birinin altında kaynaklı "Kanıt" listesi:

| Uygulama | Ne zaman | Kaynak |
|---|---|---|
| Anızı yakma, tarlada bırak | her zaman | Çevre Kanunu 2872 (ceza tutarı gösterilmez), Gerek 1968 (Akkaya 2016) |
| Sığ toprakta nadas az su biriktirir | derinlik sığ | Başkan ve Ünver 2000 (Akkaya 2016): 90 cm'de ~%18, 40 cm'de etkisiz |
| Nadas su biriktirir ama toprağı açık bırakır | derinlik orta/derin | Akkaya 2016 |
| Nadasın yerine baklagil | her zaman (motor sonucu tabloda) | Gültekin 2017 Konya: mercimek %87, nohut %80, fiğ %78; kışlık baklagil notu doğrulanmadı |
| Az toprak işleme ve doğrudan ekim | her zaman | Gültekin 2017 (241 / 226 kg/da, yıllar arası büyük fark), Küçükçongar 2014 (%2 benimsenme) |
| Organik madde düşük | organik madde < %2 | Akkaya 2016 (Konya örnekleri); yıllık artış rakamı **verilmez** |
| Karapınar rüzgâr erozyonu | yalnız Karapınar | Konya Toprak Su Enstitüsü (perdeler, şeritler, ağaç şeritleri) |
| Tuzluluk | analizde EC ≥ 4 dS/m | Başar 2001 |
| Destek ve kurallar | her zaman, en sonda | ÇATAK sayfası (güncel durumu doğrulanmadı), 5403; tutar gösterilmez |

Not: motorun nohut ve mercimek sonrası buğday oranı bazı ilçelerde Konya denemesinden yüksek çıkıyor (ör. Develi orta derinlikte %94–95; deneme %80–87). Kart ikisini ayrı gösteriyor: tablo modelin sonucu, "Kanıt" denemenin sonucu.

## 11. Çiftçi pratiğiyle karşılaştırma (15 Kas)

Buğdayda gübre kartı, planın yanında bölgedeki tipik uygulamayı gösterir: Konya-Cihanbeyli 2023 anketi, 70 buğday işletmesi (36 sulu, 34 kuru; Tapkı ve Göz 2025). Ekimle 21 kg/da DAP, ilkbaharda 11,1 kg/da üre; yani dekara yaklaşık 8,9 kg azot ve 9,7 kg P₂O₅ (`practiceNutrients`). Bu değerler hesaba girmez, sadece karşılaştırma içindir (`fertilizer.yaml → crops.wheat.farmer_practice`, rozet `statistic`). Diğer ürünler için bölgesel anket bulunamadı.

