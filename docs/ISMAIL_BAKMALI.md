# İsmail'in bakması gerekenler (Gümüş'ten)

Web tarafına başlarken `main`'i çek; aşağıdakiler hazır. Gümüş'ün dosyalarına dokunma (sözleşme sahibi Gümüş); değişiklik gerekiyorsa buraya ya da gruba yaz. Yaptığını `- [x]` ile işaretle. Yeni madde en alta tarihle eklenir.

## 1. `main`'de seni bekleyenler (14 Kas)

| Ne | Nerede | Sahibi |
|---|---|---|
| 6 tür veri dosyası (9 JSON), **gerçek veri (`mock: false`, M2, `v0.1`)** | `web/public/data/` | Gümüş |
| Sözleşme tipleri | `web/src/lib/types.ts` | Gümüş |
| Para, aralık, flip ve öncelik hesabı | `web/src/lib/economics.ts` | Gümüş |
| Testler (22 vitest) | `web/src/lib/{economics,contract}.test.ts` | Gümüş |
| Dosya biçimlerinin tamamı | `docs/ARAYUZLER.md` §8–§10, `docs/contract/*.schema.json` | Gümüş |
| Sözlük metinleri (12 terim, EN + TR) | `docs/SOURCES.md` §10 → senin `strings.ts`'ine | Gümüş yazdı |

**Henüz yok, senin işin:** `web/package.json`, Vite + React + TS + Tailwind + shadcn/ui + Recharts + vitest iskeleti, `web/src/` altındaki her şey (lib hariç), Vercel bağlantısı (root = `web`).

## 2. İskeleti kurarken (benim testlerim de çalışsın diye)

- [x] `package.json`'da `"test": "vitest"` olsun. `make test`, `cd web && npm test -- --run` çağırıyor.
- [x] `devDependencies`: `vitest`, `typescript`, `@types/node`. Testler vitest 2.1.9 + TypeScript 5.6 `strict` ile geçti.
- [x] `contract.test.ts` dosyaları `node:fs` ile okuyor ve `__dirname` kullanıyor. `src/lib/*.test.ts` için vitest ortamı **`node`** olmalı (`jsdom` değil). Bileşen testlerin `jsdom` istiyorsa `environmentMatchGlobs` ile ayır.
- [x] `tsconfig`'te `strict: true` kalabilir; `types.ts` ve `economics.ts` sorunsuz derleniyor.
- [x] `web/src/lib/` altına kendi dosyanı koyma (çakışma olmasın); yardımcıların için `src/utils/` gibi başka bir klasör kullan.

## 3. Veriyi yükleme

> **Eskidi (14–15 Kas):** lokasyonlar artık 13 (§10), `defaults.json` karar parametreleri (§11), kontrol sayısı 6 (§12). Bu bölümdeki listeyi değil, onları kullan.

| Dosya | Ne zaman | Not |
|---|---|---|
| `/data/site_index.json` | açılışta | lokasyonlar, 3 rotasyon (**baz senaryo her zaman ilk**), derinlik sınıfları, strateji metinleri |
| `/data/defaults.json` | açılışta | fiyat, maliyet, destek, Ym (her biri V nesnesi) |
| `/data/validation.json` | açılışta | 5 kontrol (kanıt paneli) |
| `/data/results/{loc}.json` | lokasyon seçilince | toprak kartı + 216 satır (3 rotasyon × 3 derinlik × 24 yıl) |
| `/data/smap/{loc}.json` | lokasyon seçilince | her zaman var; `available: false` ise `latest: null`, listeler boş |
| `/data/ledger/{loc}.json` | Grafik B görünür olunca (lazy) | ~2 MB; 216 seri × **104 hafta** |

Tipler: `fetch(...).then(r => r.json()) as Promise<SiteIndex>` vb. (`types.ts`). Lokasyon id'leri `karapinar`, `develi`; rotasyon `fallow_wheat`, `chickpea_wheat`, `lentil_wheat`; derinlik `shallow`, `medium`, `deep`.

## 4. Para hesabı: sadece `economics.ts`'i çağır

> **Eskidi (14 Kas):** aşağıdaki kod örneği eski para API'si. Geçerli olan §11 (`decide`, `summarize(results, site, depthId)`, `flipTable`) ve §14 (`priceRobustness`). Bu bloğu kopyalama.

```ts
import { inputsFromDefaults, summarize, flipTable, rankByPriority } from './lib/economics';
const inp = inputsFromDefaults(defaults, 'karapinar');           // kullanıcı değiştirince bu nesneyi güncelle
const cards = summarize(results, site, 'medium', inp);           // 3 kart: aralıklar, zarar olasılığı, baza göre farklar
const flips = flipTable(results, site, inp);                      // 9 hücre (derinlik × kurak/normal/ıslak)
const ranked = rankByPriority(cards, { water: 34, income: 33, soil: 33 }); // kaydırıcılar (toplam 100)
```

- Bileşenlerde para formülü yazma; imzalar donmuş (ARAYUZLER §9).
- Kullanıcı bir değeri değiştirince o sayının rozeti `user` olur.
- Başabaş verimi kartta: `wheat_break_even_kg_per_da`.

## 5. Gösterim kuralları (önemli)

- [x] **Mock bandı:** yüklenen herhangi bir dosyada `mock: true` varsa görünür bant. **14 Kas'tan beri `main`'deki dosyalar gerçek veri** (`mock: false`). Bandı denemek ya da maliyet/Ym dolu sahte sayılarla çalışmak istersen yerelde `cd engine && python -m nobetsu.build --mock --out ../web/public/data` çalıştır, **ama bunu commit etme** (`git checkout web/public/data` ile geri al).
- [x] **`value: null` = "bekleniyor".** V nesnelerinde değer `null` olabilir; ekranda **0 değil**, "bekleniyor / pending" yaz. `economics.ts` null'ı 0 sayıyor, yani:
  - [x] **Gerçek veride şu an maliyetler ve Ym boş** (kaynak bulunamadı). Bunlar boşken para kartlarında "maliyet / verim verisi eksik, sonuç eksik" uyarısı göster; net kâr sayısını tek başına gösterme. (Mock'ta bu boşluklar `source: "MOCK…"` sahte sayılarla dolu, o yüzden mock'ta uyarı görünmez.) _(15 Kas: para kartları kaldırıldı, uyarıya gerek kalmadı)_
- [x] **Rozet:** her sayının `type`'ı var: `measured, model, official, statistic, literature, assumption, user`. `verified: false` olanlar en az "assumption" gibi görünmeli ya da yanında "doğrulanmadı" notu olmalı.
- [x] **Yasak kelimeler:** "recommended", "best choice", "banned", "profit guaranteed" / "önerilen", "en iyi", "yasak", "kâr garantili". Sıralama başlığı: "Ranking under your priorities" / "Önceliklerine göre sıralama".
- [x] Baz rotasyon "current practice / bugünkü uygulama" etiketli; diğerleri `delta_vs_baseline` ile fark olarak gösterilir.

## 6. Metinler nereden gelir

- **Strateji çekmecesi ("Neden bu strateji?"):** `site_index.rotations[].strategy` → `why`, `evidence[]` (metin + `source` + `source_url`), `benefits[]`, `gaps[]`, `local_review[]`. Hepsi `{en, tr}`.
- **Toprak özellikleri:** `rotations[].soil_traits` → `n_fixing` (bool), `tillage_passes` (V; nadas 3, baklagiller `null` = bekleniyor), `note`.
- **Lokasyon notu:** `locations[].note`.
- **Sözlük ipuçları:** `docs/SOURCES.md` §10 → kendi `strings.ts`'ine kopyala.
- **Toprak kartı:** `results.soil.properties[]` (kil, kum, silt, pH, organik karbon, azot, CEC, hacim ağırlığı, kaba parça; Q05 / Q50 / Q95, birim, `meaning`). Bunlar mock'ta bile **gerçek** SoilGrids değerleri. `meaning` metinleri şimdilik "[text pending]".
- **"Uydunun söyleyemedikleri" kutusu:** `results.soil.not_available_remotely` (fosfor, potasyum, mikro besinler, sıkışma).

## 7. Dikkat edilecek veri durumları

- [x] **SMAP:** mock'ta **Karapınar `available: true`**, **Develi `available: false`**; iki ekran durumunu da kur ("yakında" yer tutucusu).
- [x] **AWC (toprağın su tutma kapasitesi):** `results.soil.awc_mm_per_m` motorun **kullandığı** değer (doku → FAO-56 tablosu, taş düzeltmeli, `assumption`). SoilGrids'in kendi tahmini (58–67 mm/m) daha düşük ve kullanılmıyor; Ömer bunun da kartta "SoilGrids estimate (not used)" diye gösterilmesini önerdi. İstersen yaz, sözleşmeye eklerim (şu an JSON'da yok).
- [ ] **Kanıt paneli:** gerçek veride `precip_vs_mgm` şunu gösterecek: Karapınar'da NASA POWER yağışı yer istasyonundan **~%36 yüksek**, Develi'de ≈ −%8. Panelin altına "uydu/model verisi ile yer istasyonu" notu (PLAN_MVP §5.7) mutlaka girsin.
- [x] Aylık diziler (24 eleman) 1 Temmuz `y`'den başlıyor: eleman 0 = Temmuz, eleman 23 = Haziran `y+2`.
- [x] Birim notu: 1 mm su = 1 m³/da.

## 8. Senden beklediklerim

- [ ] Web iskeleti + Vercel linki gelince gruba yaz; `make test` web testlerini de çalıştırmaya başlar.
- [ ] Sözleşmede eksik ya da garip bir alan görürsen **kendi tipini yazma**, bana yaz (aynı saat içinde düzeltirim).

## 9. M2 yapıldı (14 Kas)

- `web/public/data/` artık gerçek NASA POWER + motor çıktısı, `mock: false`, etiket `v0.1`.
- [x] Gerçek veride **maliyet ve Ym `null`** (kaynak bulunamadı) → para kartlarında "veri eksik" durumu şimdiden görünecek; §5'teki uyarıyı ilk sürümde kur. _(15 Kas: para kartları kaldırıldı)_
- [x] SMAP iki lokasyonda da `available: false` (mock'taki Karapınar örneği artık yok; "yakında" durumu ile başla).

## 10. SÖZLEŞME DEĞİŞTİ: 13 İç Anadolu lokasyonu (14 Kas)

Proje 2 noktadan **13 ile** genişledi (her ilden bir kuru tarım ilçesi): Karapınar (Konya), Develi (Kayseri), Polatlı (Ankara), Eskişehir, Aksaray, Karaman, Niğde, Nevşehir, Kaman (Kırşehir), Kırıkkale, Çankırı, Gemerek (Sivas), Boğazlıyan (Yozgat).

- [x] **Sabit lokasyon listesi yazma.** `LocationId` artık `string`; liste `site_index.locations`'tan gelir (id, name, district, province, lat, lon, note). `defaults.values[id]` her lokasyon için var.
- [ ] **Lokasyon seçici:** 13 ilçe, ile göre gruplu açılır liste (`province` alanı).
- [x] **Harita (E7, zaman kalırsa):** `lat/lon` ile 13 nokta; kullanıcı haritada bir yere tıklarsa **en yakın hesaplanmış ilçe** ve mesafe: "Bölgesel sonuç: en yakın hesaplanmış ilçe Kaman (23 km). Tarlanız değil, ilçenin tipik bir tarlası." Canlı hesap yok; her şey önceden hesaplı.
- [x] Dosya yükleme aynı: `results/{id}.json`, `smap/{id}.json` lokasyon seçilince; `ledger/{id}.json` lazy (~2 MB her biri, 13 lokasyonda toplam ~26 MB; sadece seçilen yüklenir).
- **`main`'de 13 lokasyonlu gerçek veri var** (`mock: false`). Ömer'in bölge takvimi ve yağış düzeltmesi gelince aynı dosyalar yeniden üretilecek; biçim değişmeyecek.
- [x] **Yağış uyarısı:** `validation.json` → `precip_vs_mgm` her ilçe için uydu (POWER) ile yer istasyonu farkını verir. Karaman **+83 %**, Eskişehir +39 %, Karapınar +36 %. Lokasyon kartında bu fark ±%20'yi aşıyorsa görünür bir not göster: "Bu ilçede uydu yağışı istasyondan %X yüksek; su sonuçları iyimser olabilir." Ömer düzeltme eklerse bu not küçülür.

## 11. SÖZLEŞME DEĞİŞTİ: sitede para yok, öneri var (14 Kas) — §4, §5'teki para maddelerinin yerine geçer

Ekip kararı: çiftçiye "şu kadar kâr ettin" denmeyecek. Site, arazi için **en uygun rotasyonu önerecek**; fiyat sadece arka planda "hangisi daha çok kazandırır" tahmininde kullanılacak, verimliliği bozan seçenekler engellenecek.

- [x] **Hiçbir yerde TL, fiyat, gelir, maliyet, kâr gösterme.** "Senin rakamların" (fiyat/maliyet giriş) paneli **kaldırıldı**. `defaults.json`'daki fiyat/destek değerlerini ekrana basma.
- [x] **Öneri kartı (sayfanın en üstü):** `decide(results, site, depthId, inputsFromDefaults(defaults), weights)` →
  - `recommended`: "Önceliklerine göre bu arazi için en uygun: Mercimek → Buğday" / "Most suitable for this land under your priorities: …"
  - `driver` (önerilen rotasyonun): "en çok etki eden: kazanç / buğday verimi / toprak koruma / su"
  - `close_call: true` ise: "Sonuçlar yakın: {runner_up} de neredeyse aynı uygun."
  - `recommended === null` ise (her şey engelli): "Bu koşullarda hiçbir seçenek verimlilik eşiklerini geçmiyor."
- [x] **Engellenen seçenekler** (`eligible: false`): kartta soluk göster + neden: `wheat_yield_below_baseline` → "Sonraki buğdayı nadas sonrasının %85'inin altına düşürüyor"; `first_crop_fails` → "İlk yıl ürünü çoğu yıl başarısız (ortanca verim %30'un altında)". Kazançlı olsa bile önerilmediğini açıkça yaz.
- [x] **Kaydırıcılar (4):** kazanç / buğday verimi / toprak / su; başlangıç değerleri `defaults.decision.weights` (0,40 / 0,30 / 0,20 / 0,10). Değişince `decide` ve `flipTable` yeniden çağrılır. Her ölçütün çubuğu: `parts` (0–1, "en iyiye göre"). _(15 Kas: Ömer'in yeniden yapımında kaydırıcıların yerine öncelik sorusu; kullanılan ağırlıklar "Ayrıntılar"da)_
- [x] **Rotasyon kartları:** `summarize(results, site, depthId)` → su (mm ve m³/da), **buğday verimi yüzde olarak** ("su yeterli olsaydı alınabilecek verimin %54'ü"), ilk yıl ürünü yüzdesi, 2 yılda hasat sayısı (nadas 1, baklagil 2), çıplak / rüzgâra açık gün, azot bağlama. Para satırı yok.
- [x] **Flip ızgarası:** `flipTable(...)` artık her hücrede **önerilen rotasyonu** verir (`rotation_id` null olabilir), `close_call` hücrede işaretlenir.
- [x] `economics.ts`'te `sequenceMoney`, `breakEvenYield`, `rankByPriority` ve `Priorities` **yok**; yerine `decide`, `sequenceValue` (iç, gösterme) var. Tam imzalar: ARAYUZLER §9.

## 12. SÖZLEŞME DEĞİŞTİ: senaryolar, 6. kontrol, toprak açıklamaları (15 Kas)

- [x] **Senaryo seçici (E2):** `site_index.scenarios` → `[{id, label, precip_factor, temp_shift_c}]`, ilk eleman `baseline`. Kullanıcı başka bir senaryo seçerse `results/{loc}__{id}.json`'ı yükle (aynı biçim) ve aynı `decide / summarize / flipTable` fonksiyonlarına ver. Başlık: "Aynı 24 yıl daha kurak ya da sıcak olsaydı?" / "What if the same 24 years were drier or warmer?". Mutlaka not: **"Projeksiyon değil, duyarlılık testi; ekim tarihleri sabit tutuldu."** Ledger (Grafik B) ve kanıt paneli sadece baseline için.
- [x] **Kanıt paneli artık 6 kontrol:** yeni `smap_anomaly` (SMAP ile modelin aylık anomalileri). SMAP verisi gelene kadar `pending` → "bekleniyor" göster.
- [x] `precip_vs_mgm` değeri artık IMERG (ikinci uydu tahmini) sütununu da içeriyor; metni olduğu gibi gösterebilirsin.
- [x] **Toprak kartı:** `results.soil.properties[].meaning` artık dolu (EN + TR, her özellik için tek cümle); kartta kullan.
- `ResultsFile` tipine `scenario_id` eklendi.

## 13. Toprak kartı: kullanılmayan AWC tahminleri (15 Kas)

- [x] `results.soil.awc_mm_per_m` = motorun **kullandığı** AWC (doku sınıfı → FAO-56 tablosu, taş düzeltmeli). Yanına isteğe bağlı `results.soil.awc_alternatives` ile karşılaştırma göster: "SoilGrids'in kendi tahmini: 58,6 mm/m · Saxton–Rawls: 131,4 mm/m (kullanılmadı; SoilGrids bu killi toprak için tarla kapasitesini düşük tahmin ediyor)". `results.soil.texture_class` (ör. "silty clay") kartın başlığında kullanılabilir. Alanlar yoksa gösterme.

## 14. Öneri ne kadar sağlam? `priceRobustness` (15 Kas)

- [x] Öneri kartının altına küçük bir satır: `priceRobustness(results, site, depthId, inp, weights)` →
  - `stable: true` → "Bu öneri fiyatlar ±%20 değişse de değişmiyor." / "This holds if prices move ±20 %."
  - `stable: false` → her `sensitive_to` için: "Nohut fiyatı %20 artarsa öneri Nohut → Buğday olur." (fiyat ya da TL yazma; sadece ürün, yön ve yüzde). Nohut fiyatı en belirsiz parametre olduğu için bu satır önemli.

## 15. Gübre önerisi: yeni dosya ve fonksiyonlar (15 Kas)

- [x] `docs/GUBRE.md`'yi oku: simülasyonda gübre kartı için tüm akış, alanlar ve gösterim kuralları orada.
- [x] `fertilizer.json` + `fertilizer.ts` (`soilFromResults`, `recommend`); bileşende hesap yok, sadece çağrı.
- [x] Para yok, `null` sayı değildir, her sayının rozeti `source.type`; pancar/patates/soğanda kuru tarım seçeneğini gri göster.

**Güncelleme (15 Kas, Gümüş — senin dosyalarında, Gümüş'ün isteğiyle):** gübre kartı siteye eklendi; gözden geçir, istediğin gibi değiştir.
- `web/src/sections/FertilizerPlan.tsx` (yeni): tarla sayfasında önerinin altında. Önerilen rotasyonun ürünleri çip olarak (fallow hariç), "Başka ürün" listesi, sulama seçimi, aşılı tohum (baklagil) ve kombine mibzer kutuları. Plan: ne zaman → hangi gübre → dekara kg + tüm tarla kg (dönüm × kg/da). "Neden bu miktarlar?": saf besin, yöntem, kullanılan toprak değerleri ve rozetleri, hedef verim, toprak bayrakları, Toros karşılaştırması. Öneriler listesi ve "Toprak analizim" formu (değerler tarlaya kaydedilir, rozet `senin değerin`).
- `web/src/utils/fertilizerView.ts` + test (yeni): gruplama, toprak birleştirme, tarla toplamı, sayı okuma.
- `web/src/auth/accounts.ts`: `Field`'a isteğe bağlı `soilTest?` ve `water?` eklendi (eski tarlalar etkilenmez).
- `web/src/pages/FieldDetail.tsx`: karta tek satırlık bağlantı. `web/src/strings.ts`: `fert*`, `water_*`, `nutrient_*`, `basis_*`, `flag_*`, `soil_*` anahtarları.
- `.claude/launch.json`: `web` dev sunucusu (port 5174).
- [ ] Pancar/patates/soğanda kuru tarım hâlâ seçilebiliyor (plan "kaynak bekleniyor" der); istersen gri yap.

## 16. "Nasıl ekilir" kartı (15 Kas, Gümüş — yeni sitede, Gümüş'ün isteğiyle)

- [x] `web/src/screens/result/Sowing.tsx` (yeni): sonuç ekranında gübre kartının altında. Önce rotasyonun ürünleri, sonra diğerleri (kesik çizgili düğme); tip seçimi; tarla durumu (tohum yatağı, toprak nemi, ekim makinesi, geç ekim); ne zaman / tohum / derinlik / sıra arası; "Kendi tohumunla hesapla" (bin tane ağırlığı, saflık, çimlenme → kg/da ve tüm tarla).
- `Result.tsx`'e tek satır; `data/api.ts` ve `data/hooks.ts`'e `loadSowing` / `useSowing`; `i18n/strings.ts`'e `sow*`, `seedbed_*`, `soil_*`, `drill_*` anahtarları.
- Hesap `lib/sowing.ts`'te (Gümüş); ayrıntı `docs/GUBRE.md` §9.

## 17. Toprak sağlığı kartı (15 Kas, Gümüş — yeni sitede, Gümüş'ün isteğiyle)

- [ ] `web/src/screens/result/SoilHealth.tsx` (yeni): sonuç ekranında "Nasıl ekilir"in altında. Organik madde ve derinlik kutucukları, "Bu tarlada model ne buluyor?" tablosu (çıplak gün, rüzgâra açık gün, sonraki buğday / nadas ve %85 eşiği), koşula göre uygulama kartları ve her birinde "Kanıt".
- `Result.tsx`'e tek satır; `data/api.ts` ve `data/hooks.ts`'e `loadSoilHealth` / `useSoilHealth`; `i18n/strings.ts`'e `sh*` anahtarları.
- Hesap `lib/soilhealth.ts`'te (Gümüş); ayrıntı `docs/GUBRE.md` §10.
- [ ] (15 Kas, Gümüş) Gübre kartına geri gelenler: "Tohum Rhizobium ile aşılı" (sadece baklagil) ve "Kombine mibzer" kutuları; analiz yokken "sadece azot" uyarısı ve buğdayda Toros rehberinin dozunu gösteren "Analizin yoksa" kutusu (`screens/result/Fertilizer.tsx`, `i18n/strings.ts` `fertInoculated`, `fertBanding`, `fertOnlyN`, `fertGuideTitle`, `fertGuideSub`).- [ ] (15 Kas, Gümüş) Gübre kartında buğday için "Bölgede çiftçi ne yapıyor?" kutusu (Cihanbeyli 2023 anketi; `practiceNutrients`), `i18n/strings.ts` `fertPractice*` anahtarları.



## 18. Canlı site ve TKGM günlük sınırı (15 Kas, Gümüş — Gümüş'ün isteğiyle)

Site canlıda: https://arksus.vercel.app (Vercel projesi `nobetsu`, kök `web/`; şimdilik CLI ile deploy, GitHub bağlantısı Vercel uygulamasına repo izni bekliyor). Canlıda TKGM `arksus.vercel.app`'ten gelen isteklere ilk istekte bile 403 "Günlük sorgu limitini aştınız" diyor; site adresini gizleyerek sınırı aşmıyoruz.
- [ ] `services/tkgm.ts`: 403/429 gelince "bugün sınırlı" diye hatırlanır (`localStorage` `nobetsu.tkgm-limited` = tarih); TKGM normal cevap verince silinir. `tkgmLimited()`, `onTkgmLimited()` (useSyncExternalStore için). Test: `tkgm.test.ts` "daily limit memory".
- [ ] `screens/FindField.tsx`: sınır varken menüde bilgi notu (`tkgmBusyNote`), "Haritada elle çiz" en üste çıkar; "Tarlanın üstüne dokun" ve "Ada / parsel" soluk görünür (`tkgmBusySub`) ama tıklanabilir kalır. Konum ve arama sonrası `tap` yerine doğrudan `draw` açılır.
- [ ] `screens/find/ParcelNumber.tsx`: il/ilçe/mahalle listeleri sınırda `tkgmFail` yerine `tkgmLimit` yazar, il kutusu "Yükleniyor…"da takılı kalmaz, hata notunda "Haritada elle çiz" düğmesi (`onDraw`).
- Ayrıca canlıda: `web/.env.local` ve Vercel'de `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` var (Supabase projesi `nobetsu`, Frankfurt); kodda henüz kullanılmıyor. Giriş ekranı için `package.json`'a `@supabase/supabase-js` gerekecek.
- [ ] (15 Kas, Gümüş — `biar` ve `omer` muhammet'e alınırken) `Result.tsx` çakışması: Biar'ın `SectionId` tipi + Toprak sağlığı bölümü birlikte. `domain/sections.ts` `SECTION_IDS`'e `soilHealth` eklendi (sade modda da görünür), `shell/Profile.tsx` ayar listesine `secSoilHealth`. Biar'ın branch'inde zaten kırık olan iki test düzeltildi: `askNote` metninde "gelir" (para kelimesi testi) → "dayanır"; `domain/assistant.ts` alternatiflere `'baska ne'` (yoksa "başka ne ekebilirim" ekim önerisine gidiyordu).

## 19. Hesap girişi (Supabase e-posta + şifre) ve KVKK onayı (15 Kas, Gümüş — Gümüş'ün isteğiyle; sözleşme: ARAYUZLER §16)

- [ ] `package.json`: `@supabase/supabase-js@^2` eklendi.
- [ ] Yeni: `services/cloud.ts`, `state/cloud.ts`, `domain/consent.ts` (+test), `ui/Markdown.tsx` (+test, hukuk metinleri için küçük okuyucu), `shell/CloudAccount.tsx`, `shell/ConsentDialog.tsx`, `screens/result/PlantingIntent.tsx`, `public/legal/*.md` (docs/legal kopyası; test eşitliği kontrol eder), `vite-env.d.ts`'e iki env tipi.
- [ ] Biar'ın dosyalarına küçük dokunuş: `shell/Profile.tsx` Supabase varsa deneme girişi yerine `CloudAccount`; `shell/TopBar.tsx` Google kullanıcısını gösterir; `App.tsx` `ConsentDialog`'u bağlar; `Result.tsx` öneri bölümünde `OtherChoices`'tan sonra `PlantingIntent`. Deneme girişi (`domain/auth.ts`) silinmedi; env yoksa hâlâ o çalışır.
- [ ] `i18n/strings.ts`: `g*`, `cd*`, `pi*` anahtarları.
- Not (15 Kas, ikinci karar): Google OAuth kullanılmıyor; giriş Supabase'in kendi e-posta + şifre girişiyle (`CloudAccount` içindeki `EmailForm`). Supabase'de "Confirm email" kapalı olmalı (ücretsiz e-posta gönderimi ekip dışına mail atmıyor).
- [ ] (15 Kas, Gümüş) Öneri bölümünde `PlantingIntent`'in altına `DistrictPlan` kartı (ilçe toplamları; eşik altında "yeterli kayıt yok" + "Örnek veriyle göster"). Yeni: `domain/districtPlan.ts` (+test), `public/demo/district_plans.json`, `i18n` `dp*` anahtarları. Giriş formuna aydınlatma (zorunlu) ve açık rıza (isteğe bağlı) kutucukları; metinler portal ile ayrı pencerede.

## 20. Ad değişikliği: NöbetSu → Arksus (15 Kas, Gümüş — Gümüş'ün isteğiyle)

- [ ] Sitede görünen her yer: `appName`, `farmerName`, sayfa başlığı (`App.tsx`, `index.html`), paylaşım metni (`Result.tsx`), çiftçi SVG başlığı, hukuk metinleri. Haritada (Biar) `index.html` başlığı ve marka, `strings.ts` tanıtım ve "Pilot ilçe · Arksus".
- [ ] İç adlar **değişmedi**: tarayıcı hafıza anahtarları (`nobetsu.v2`, `nobetsu.users`, `nobetsu.session`, `nobetsu.tkgm-limited`; değişirse kayıtlı cevaplar kaybolur), haritanın `/data/nobetsu` yolu ve `VITE_NOBETSU_DATA`, Python paketi.
- [ ] Yeni adres: https://arksus.vercel.app (aynı Vercel projesi; eski nobetsu.vercel.app de çalışıyor).
