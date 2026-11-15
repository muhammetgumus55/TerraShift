# Ömer'in bakması gerekenler (Gümüş'ten)

Gümüş'ün işi sırasında çıkan, **Ömer'in dosyalarında** yapılması gereken şeyler ve Ömer'in sorularına yanıtlar. Gümüş bu dosyalara dokunmuyor (dosya sahipliği kuralı). Yaptığını `- [x]` ile işaretle.
Ters yön (Ömer → Gümüş): `docs/GUMUS_BAKMALI.md`. Yeni madde eklendikçe en alta tarihle yazılır.

## 1. Gümüş'ten yanıt (14 Kas, omer → main birleştirmesi)

- POWER hazır: `load_weather()` 2000-01-01 → 2026-11-09, `attrs` tam (lat/lon derece, `elevation_m` POWER hücresinden). Radyasyon birimi başlıktan okunuyor, kWh gelirse × 3,6. `gaps_filled` = en az bir değişkeni doldurulan **gün** sayısı.
- SoilGrids hazır: `data/soilgrids/{loc}.json`. **AWC düşük çıktı:** Karapınar 58,6 mm/m (Q05–Q95: 40,9–88,4), Develi 67,4 mm/m (51,1–77,1). SoilGrids `wv1500`'ü yüksek tahmin ediyor. Senin 150 mm/m yedeğinden çok farklı; hangisini kullanacağımızı konuşalım.
- Ledger 104 hafta: şema ve mock 104'e sabitlendi, ARAYUZLER §5'e yazıldı.
- pandas: bende 2.2.3, senin testlerin dahil 109 test geçiyor; sabitleme yok (`pandas>=2.1`).
- `engine/tests/__init__.py` **ekledim**: bazı makinelerde (ultralytics/roboflow kuruluysa) site-packages'ta bir `tests` paketi var ve namespace paketini gölgeliyor; `from tests.fixtures import ...` bu yüzden kırılıyordu. Senin import'ların aynen çalışıyor.
- Sıradaki: `build.py` gerçek koşu için `validate.py`'yi bekliyor; gelene kadar kontrolleri `pending` yazacak şekilde ayarlayacağım (M2).

## 2. AWC kararı (14 Kas)

Önerin **iki düzeltmeyle kabul**: doku SoilGrids'ten, AWC FAO-56 Tablo 19'dan. Sözleşme notu ARAYUZLER §3'te.

**Senin dosyalarında (`soil.yaml`, `runner.py`) yapılacaklar:**
- [x] AWC'yi `data/soilgrids/{loc}.json` → `texture_0_100cm.usda_class` ile Tablo 19 orta değerinden al, **× (1 − `cfvo_0_100cm_fraction.value`)**. Taşlar su tutmaz; tablo değeri ince toprak içindir. Develi'de taş %21,7 → fark büyük.
- [x] `awc_mm_per_m` (SoilGrids doğrudan) artık **bilgi amaçlı**; motor onu kullanmasın. (Şu an `_awc_used` onu okuyor; sen değiştirene kadar M2 koşusu 58,6 / 67,4 ile çıkar.)
- [x] `awc_used`: `type: "literature"`, `verified: false`, kaynak: "SoilGrids dokusu (siltli kil) → FAO-56 Tablo 19, taş düzeltmeli".
- [x] **TEW / REW** da aynı doku sınıfından gelsin (şu an "loam" yazıyor). Hafızadan: siltli kil ve kil için TEW 22–29 mm, REW 8–12 mm (Ze = 0,10 m) — kitaptan teyit.
- [x] Develi **killi tın** Tablo 19'da yok. En yakın: siltli killi tın (0,13–0,18) ya da kil (0,12–0,20). Hangisini seçtiğini kaynağa yaz.
- [x] Sınıf → değer eşlemesi `soil.yaml`'da dursun (kodda `if` yok).

**Veri (yeni çekim, 0–100 cm, ortalama haritalar):**

| | Doku | Kil / kum / silt % | Taş | SoilGrids doğrudan | Saxton–Rawls 2006 (taş düzeltmeli) | Tablo 19 orta × (1 − taş) (hafızadan) |
|---|---|---|---|---|---|---|
| Karapınar | siltli kil | 48,6 / 10,5 / 41,0 | 0,033 | 58,6 | 131,4 | 160 × 0,967 ≈ 155 |
| Develi | killi tın | 39,7 / 27,6 / 32,6 | 0,217 | 67,4 | 106,2 | ~155–160 × 0,783 ≈ 121–125 |

**Duyarlılık (senin motorun, gerçek hava, orta derinlik, 24 yıl ortancası):** nohut sonrası / nadas sonrası buğday Ya/Ym — AWC 60: Karapınar 0,98, Develi 0,96; AWC 160: 0,91 / 0,85. Konya denemesi 228/286 = 0,80. Yani 58 ile nadas avantajı neredeyse görünmüyor; senin tespitin doğru.

**Kanıt paneli önerisi:** `validate.py`'de (ya da `precip_vs_mgm` notunun yanında) "AWC: tablo X, Saxton–Rawls Y, SoilGrids doğrudan Z" satırı. Sözleşmede yeni check id'si gerekirse bana yaz; şimdilik mevcut 5 kontrol yeterli, metin `trial_ratio` notuna eklenebilir.

## 3. AWC uygulaması — eksik kalan taş düzeltmesi (14 Kas)

`omer` → `main` birleştirildi (151 test yeşil; gerçek havayla `build.py` uçtan uca çalıştı, 9 dosya şemadan geçti). AWC'yi dokudan alman tamam. Sen `main`'i 16:47'de çekmişsin; §2'deki karar ondan sonra geldiği için bir madde eksik kaldı:

- [x] **Taş (kaba parça) düzeltmesi:** `AWC = Tablo 19 orta değeri × (1 − cfvo)`. Taşlar su tutmaz, tablo değeri ince toprak içindir. `data/soilgrids/{loc}.json` → `cfvo_0_100cm_fraction.value`: Karapınar **0,033**, Develi **0,217**. Develi şu an 155 mm/m; düzeltmeyle ≈ **121**, Karapınar 160 → ≈ **155**. Düzeltme `soil.yaml`'da açılıp kapanabilir olsun (ör. `awc_cfvo_correction: true`), kaynak metnine "taş düzeltmeli (cfvo X)" eklensin.
- [x] (İsteğe bağlı, yapıldı: motor artık `texture_0_100cm` kullanıyor, yoksa 0–30 cm Q50) Doku sınıfı için 0–100 cm hazır: `texture_0_100cm.usda_class` (ortalama haritalar, 100'e ölçekli). Sen 0–30 cm Q50 kullanıyorsun; iki lokasyonda sonuç aynı sınıf (siltli kil / killi tın), değiştirmek şart değil — kök bölgesi 1 m'ye indiği için 0–100 cm daha tutarlı olur.
- Bilgi: `type: "assumption"` kullanman uygun; ARAYUZLER §3'ü buna göre düzelttim (`literature` yerine `assumption`).
- Senin "SoilGrids'in kendi AWC'si de kartta gösterilsin" önerin: kabul. `awc_alternatives` dosyada var; İsmail'le kartta nasıl görüneceğine karar verince sözleşmeye eklerim.

## 4. Muhammet'in referans değerleri geldi — 3 testin kırıldı (14 Kas)

Muhammet'in `ref.*` işini ben yaptım; `engine/config/references.yaml` artık gerçek değerlerle dolu (branch `gumus/muhammet-sources`):
- `trial_yields_kg_per_da`: 286 / 249 / 228 — Gültekin vd. 2017 makalesinde teyit edildi (`verified: true`), `years` metni güncellendi.
- `pse_range`: **0,08 / 0,30 → 0,11 / 0,29** (Ayday ve Oylukan 1984; Özbek vd. 1967). Literatür tanımı (nadas − ekili toprak suyu) / yıllık yağış; seninkiyle aynı değil, kontrol zaten `info`.
- `mgm_annual_precip_mm`: Karapınar **290,11** (WMO 17902), Develi için en yakın istasyon Kayseri Bölge **404,58** (WMO 17196, ~29 km). `precip_vs_mgm` artık iki lokasyonda da `info` (gerçek POWER ile): **Karapınar POWER 395 mm/yıl, MGM 290 → +36 %**; Develi POWER 374, Kayseri Bölge 405 → ≈ −8 %. Karapınar'da POWER yağışı belirgin yüksek; sonuçların dürüst sunumu için önemli (kanıt panelinde görünecek).
- `heat_threshold_c`: **30 → 31 °C** (Porter ve Gawith 1999). Isı günleri biraz azalır.

**Kırılan testler (`engine/tests/test_validate.py`)** gerçek `references.yaml`'daki eski yer tutucu değerlere bağlı:
- [x] `test_pse_is_info_with_model_value_and_literature_range`: `"8" in reference and "30" in reference` arıyor. Ya testte `refs["pse_range"]`'i açıkça 0.08/0.30'a ayarla, ya da `refs`'teki değerlerden beklenen metni üret.
- [x] `test_precip_vs_mgm_pending_when_normals_missing`: MGM'nin boş olduğunu varsayıyor. Testin başında iki lokasyonun `value`'sunu `None` yap.
- [x] `test_precip_vs_mgm_reports_percent_difference`: Develi'nin boş olduğunu varsayıyor. Develi `value`'sunu testte `None` yap.

Üçü düzelince `gumus/muhammet-sources`'u main'e alacağım (testler geçmeden merge yok). Diğer 152 test geçiyor.

Düzeldi (Ömer, `omer` 46b2e28): üç test kendi `refs` değerini ayarlıyor; `gumus/muhammet-sources` ile birlikte yeşil.

## 5. M2 yapıldı — gerçek sonuçlardan iki gözlem (14 Kas)

`main`'deki `web/public/data` artık senin motorunla gerçek veri (`mock: false`, etiket `v0.1`); AWC yuvarlaması düzeldi (Karapınar 154,7, Develi 121,4). Orta derinlik, 24 yıl ortancası:

| | nadas | nohut | mercimek |
|---|---|---|---|
| Karapınar: buğday ekiminde su (mm) | 103,9 | 0,1 | 12,6 |
| Karapınar: buğday Ya/Ym | 0,54 | 0,48 | 0,49 |
| Develi: buğday ekiminde su (mm) | 56,6 | 0,0 | 6,0 |
| Çıplak gün / rüzgâra açık (Karapınar) | 460 / 88 | 332 / 54 | 310 / 48 |

Kontrol etmeni istediğim iki şey (hata olduğunu söylemiyorum, emin olmak için):
- [x] **Çiçeklenmede sıcak gün ortancası her rotasyonda 0** (eşik artık 31 °C, POWER `T2M_MAX`). POWER hücresi Karapınar'da 1236 m'de; çiçeklenme penceresi Mayıs sonu–Haziran başı mı? Sıfır mı çıkmalı, yoksa pencere/eşik eşleşmesinde bir sorun mu var?
- [x] **Nohuttan sonra buğday ekiminde su ≈ 0 mm** (Temmuz ortası hasat → Ekim ekimi). Yaz kuraklığı düşünülünce makul olabilir; yine de 24 yılın P90'ı da 0'a yakınsa Ekim başı yağışlarının profile girişini bir kontrol et.

## 6. 13 İç Anadolu lokasyonu — SÖZLEŞME DEĞİŞTİ: lokasyonlar açık liste (14 Kas)

Proje 2 noktadan **13 ile (her ilden bir kuru tarım ilçesi)** genişletildi. Lokasyon id'leri artık sabit değil; liste `engine/config/locations.yaml`'dan gelir (`config.location_ids()`), biçim `^[a-z][a-z0-9_]*$`. Sıra: `karapinar, develi, polatli, eskisehir, aksaray, karaman, nigde, nevsehir, kaman, kirikkale, cankiri, gemerek, bogazliyan`.
Her nokta için POWER önbelleği, `data/soilgrids/{loc}.json` (doku sınıfı, cfvo, Saxton–Rawls dahil) ve `references.yaml` → `mgm_annual_precip_mm.{loc}` (ilçenin ya da en yakın WMO 1991–2020 istasyonu) hazır.

Senin tarafında yapılması gerekenler:
- [x] **`validate.py`**: `LOCATION_NAMES` sabit sözlüğü → isimleri `config.load("locations")`'tan al (şu an yeni lokasyonlar id ile görünür, çökme yok). `precip_vs_mgm` 13 lokasyonu tek satırda yazıyor olabilir; çok uzunsa kısalt (ör. fark yüzdeleri listesi, en büyük sapma).
- [x] **`soil.yaml` → `fallback_awc_mm_per_m`**: lokasyon anahtarlı; bilinmeyen lokasyonda `runner.py:185` `KeyError`. Tek bir varsayılan + isteğe bağlı lokasyon geçersiz kılma yap (SoilGrids dosyası olduğu için şu an tetiklenmiyor).
- [x] **`crops.yaml` takvimi**: tek (Konya) takvim var. Gemerek (Sivas), Boğazlıyan (Yozgat), Çankırı ve Develi daha yüksek/soğuk; ekim-hasat tarihleri farklı olabilir. En az iki bölge takvimi (sıcak-alçak / soğuk-yüksek) ya da açıkça "Konya takvimi, assumption" notu — karar senin.
- [ ] **Tam koşu** 13 lokasyonla (~13 × 10 sn) ve kendi testlerin; `trial_ratio` Karapınar'da kalabilir (deneme Konya'da).

**13 lokasyonla gerçek koşu sonucu (14 Kas, Gümüş):** 42 dosya şemadan geçti, kütle dengesi 2808 sekansta 1,6e-12 mm. İki önemli gözlem:
- [ ] **POWER yağış sapması bazı ilçelerde büyük** (`precip_vs_mgm`): Karaman **+83 %**, Eskişehir **+39 %**, Karapınar **+36 %**; diğer 10 ilçe −14…+13 %. Bu ilçelerde su ve nadas avantajı olduğundan büyük çıkıyor. Seçenekler: (a) sadece kanıt panelinde göster ve kartta "bu ilçede uydu yağışı istasyondan X % yüksek" uyarısı, (b) basit istasyon düzeltmesi: günlük POWER yağışını `MGM_normal / POWER_ortalama` oranıyla ölçekle (PLAN'da "etkinlik sonrası" listesinde). (b) motor girdisini değiştirir, karar senin; istersen ölçek katsayısını `references.yaml`'dan okuyabilirsin, değerleri ben veririm.
- [ ] **Çıplak gün her ilçede aynı** (nadas 460, mercimek 310): tek takvim kullanıldığı için beklenen; §6'daki bölge takvimi kararı bunu da çözer.

## 7. Bilgi: sitede para kalktı, karar modülü geldi (14 Kas)

Senin tarafında değişiklik gerekmiyor. `economics.ts` artık rotasyonları puanlayıp öneri veriyor; senin çıktılarından `wheat.yield_ratio`, `first_crop.yield_ratio`, `water_at_wheat_sowing_mm`, `wind_exposed_bare_days` kullanılıyor. Engeller: ortanca buğday oranı < 0,85 × nadas sonrası buğday ya da ilk yıl ürünü ortanca oranı < 0,30 → öneri dışı. Bu yüzden **verim oranlarının ve takvimin doğruluğu artık önerinin kendisini belirliyor**; soğuk ilçeler için takvim (§6) önceliğini artırıyor.

## 8. E1, E2 ve IMERG sözleşmeleri kabul edildi (15 Kas)

`omer` main'e alındı (204 test yeşil). Senin §15–§17 isteklerin:
- **E2:** `results/{loc}__{scenario_id}.json` + `site_index.scenarios` (id, label, precip_factor, temp_shift_c; baseline ilk) + `results.scenario_id`. `build.py` `run_scenarios` ile baseline dışındaki 5 senaryoyu yazıyor (`--no-scenarios` ile atlanabilir). `scenarios.yaml` AGENTS tablosunda senin.
- **E1:** `validation.json` artık tam 6 kontrol; `build.py` `run_landscape` + `check_smap_anomaly` çağırıyor, SMAP gelene kadar `pending`.
  - [x] `check_smap_anomaly`'nin `pending` metni "İki nokta için…" diyor; artık 13 nokta var, metni genelleştir ("Waiting for NASA SMAP L4 root-zone data.").
- **IMERG:** `imerg.py`, `data/imerg/`, `test_imerg.py` AGENTS tablosunda artık Gümüş'te. `make data` yenilendi.

## 9. Repo denetiminden senin dosyalarında kalanlar (15 Kas)

- [x] `validate.py:29` `LOCATION_NAMES` hâlâ 2 ilçe → 11 ilçe kontrollerde id olarak görünüyor (`polatli` gibi). İsimleri `config.load("locations")`'tan al (§6).
- [x] `validate.py` `check_smap_anomaly` pending metni "two points / İki nokta" → 13 nokta (§8).
- [x] `soil.yaml` `fallback_awc_mm_per_m` sadece karapinar/develi → SoilGrids dosyası olmayan bir ilçede `runner.py:185` `KeyError` (§6).
- [x] `scenarios.yaml`: `dry10`/`dry20` vb. `type: assumption` ama `verified: true`; AGENTS kuralında assumption = `verified: false`. Tanım oldukları için savunulabilir; kararını not et.
- Bilgi: AGENTS tablosunda `test_scenarios.py`, `test_smapcheck.py` ve `scenarios.yaml` artık senin satırında; `map/**` Biar'a yazıldı.

## 10. Kim ne yaptı — 15 Kas itibarıyla özet (karışmasın diye)

**Gümüş (Rol B) yaptı:**
- Sözleşme ve iskelet (M0): `engine/` paketi, `config.py`, `mock.py`, `export.py`, `build.py`, JSON şemaları, `types.ts`, `Makefile`.
- Veri çekme: `power.py` (NASA POWER, 13 nokta), `soilgrids.py` (WCS, doku sınıfı, taş oranı, Saxton–Rawls, toprak kartı açıklamaları), WMO 1991–2020 yağış normalleri (13 istasyon), AppEEARS SMAP isteği (13 nokta, bekliyor) ve sonucu işleyecek `smap.py` (hazır, test edildi).
- 13 ilçe: noktaların seçimi (WMO istasyonuna 3–10 km, ESA WorldCover ile tarla kontrolü), `locations.yaml`, sözleşmede lokasyonların açık liste olması.
- AWC analizi: SoilGrids'in düşük çıkmasının nedeni (tarla kapasitesi), Saxton–Rawls çapraz kontrolü, motor duyarlılık denemesi; doku + FAO tablosu kararı (motor tarafını sen yaptın).
- Karar modülü (`economics.ts`): sitede para yok; puan (kazanç iç hesap + buğday verimi + toprak + su), verimlilik engelleri, öneri, yakın sonuç, `flipTable`, `priceRobustness` (fiyat ±%20).
- `defaults.yaml`: ulusal referans verim, fiyat, destek (iç parametre), ağırlıklar, engeller.
- Muhammet'in Rol B'ye giden işleri: fiyatlar, destekler, deneme verimleri, nadas etkinliği, erozyon kaynağı, strateji metinleri, sözlük (`SOURCES.md`, `rotations.yaml`, `references.yaml`).
- E1 sözleşmesi (6. kontrol `smap_anomaly`) ve `build.py` bağlantısı; E2 sözleşmesi (`results/{loc}__{senaryo}.json`, `site_index.scenarios`) ve 13 ilçe × 5 senaryo verisi; IMERG'i devraldım (`imerg.py`, `data/imerg/` artık bende).
- Toprak kartı için `awc_alternatives` ve `texture_class` alanları.
- M2 gerçek veri ve `v0.1` etiketi; README; PLAN_MVP ve PROJE_OZETI güncellemesi; `ROL_B_VERI.md`; İsmail'e devir notu (`ISMAIL_BAKMALI.md`).
- Senin branch'lerini main'e aldım; birleştirmede düzelttiklerim: `engine/tests/__init__.py`, ledger 104 hafta, export çıktı yolu, test çakışmaları.

**Ömer (Rol A) yaptı (senin notlarından):**
- Motor: `et0.py` (FAO-56, Örnek 18), `waterbalance.py`, `rotations.py`, `runner.py`, `yieldmodel.py`, `indicators.py`, `validate.py` (5 kontrol).
- AWC'yi dokudan seçme + taş düzeltmesi, FAO-56 değerlerini fao.org ile doğrulama, ekim/hasat takvimleri (Muhammet'in görevi, "Ömer yaptı").
- E1 motor tarafı (`run_landscape`, `check_smap_anomaly`), E2 motor tarafı (`scenarios.yaml`, `run_scenarios`), IMERG modülünü yazdın (artık bende), validate testlerini gerçek dosyadan ayırdın.
- Şu an: MODIS NDVI.

**Sınır (dosya sahipliği, AGENTS.md):** motor modülleri, `crops/soil/scenarios.yaml` ve onların testleri sende; veri çekme modülleri (`power`, `soilgrids`, `smap`, `imerg`), `export`, `build`, sözleşme (`docs/contract`, `types.ts`, `ARAYUZLER.md`), `economics.ts`, `defaults/references/rotations/locations.yaml`, `data/**`, `web/public/data/**` bende.
- **MODIS NDVI için:** çekme kodunu sen yaz; sitede gösterilecekse JSON alanını ve şemayı ben açayım (bana bu dosyada değil `GUMUS_BAKMALI.md`'de yaz: hangi alan, hangi biçim).

**Sende açık kalanlar:** §6 (ilçe isimleri `validate.py`'de, `soil.yaml` yedek AWC, soğuk ilçeler için takvim), §8 (smap pending metni), §9 (denetim maddeleri). **Bende açık kalanlar:** SMAP verisi gelince `smap.py` + `make data`; İsmail başlayınca site ve `v0.2`.

## Ömer yanıtı — §5, §6, §8, §9 (15 Kas)

Commit'ler `omer` 5736d13 / 8b6664d:
- §5 sıcak gün = 0 hata değil: pencere ~23 May–6 Haz; POWER `T2M_MAX` > 31 °C bu pencerede 24 yılın ortancasında 0 (Karapınar en çok 8, Develi 3 gün); Haziran tamamında Karapınar ortanca 3,5, Temmuz 17. Yani eşik/pencere doğru eşleşiyor, sıcak stres çiçeklenmeden sonra başlıyor.
- §5 nohut sonrası su ≈ 0 makul: P10/P50/P90 Karapınar 0 / 0,1 / 3,4 mm, Develi 0 / 0 / 4,8. 15 Tem–14 Eki yağışı Karapınar ortanca 26, P90 48 mm; küçük yaz yağışları çıplak toprakta buharlaşıyor (anız malçı yok varsayımı bunu biraz artırır).
- §6 isimler `locations.yaml`'dan; SMAP metni "noktalar"; yedek AWC `default` + `overrides` (yeni id'de KeyError yok). `precip_vs_mgm` satırını kısaltmadım (IMERG sütunu da eklendi); İsmail uzun bulursa söylesin.
- §6 takvim: kaynak bulunamadı (Sivas/Yozgat/Çankırı); 13 ilçe tek takvim, `crops.yaml`'da açıkça assumption. MODIS NDVI 13 ilçe inince kuruma ayı farkına bakıp ikinci takvime karar vereceğim.
- §9 `scenarios.yaml`: tüm adımlar `verified: false` yapıldı (AGENTS kuralı: assumption = doğrulanmamış; tanım olmaları değişmiyor).

## 11. NDVI: sulu görünen noktaları taşıyacağım — 13 ilçe bitince haber ver (15 Kas)

Karapınar bulgun doğrulandı (aylık NDVI zirvesi Temmuz 0,62; Ağustos 0,55). Polatlı temiz (zirve Nisan, Temmuz 0,17), Develi temiz (zirve Mayıs).
- [x] **13 ilçenin NDVI'si bitince** (13/13 listesi GUMUS_BAKMALI §21'de: 8 ilçe taşınacak) bana `GUMUS_BAKMALI.md`'de liste yaz. Ölçütüm: aylık ortalama NDVI zirvesi **Temmuz–Eylül** ya da **Temmuz ortalaması > 0,35** → nokta büyük ihtimalle sulu, taşınacak.
- (15 Kas: Ömer yaptı, GUMUS_BAKMALI §24) Sonra ben: işaretli ilçelere WorldCover + NDVI ile kuru tarla noktası seçerim (`locations.yaml`), POWER/SoilGrids/WMO yenilerim ve **tek seferde** `make data` (senaryolar dahil). Yeni noktaların NDVI'sini `modis.py` ile senin çekmen gerekecek; id'leri aynı kalacak.
- NDVI sözleşmesi (`ndvi_calendar` 7. kontrol + isteğe bağlı `ndvi/{loc}.json`) da o turda.

- [ ] (15 Kas, Gümüş) **Proje adı Arksus oldu** (ekip kararı; sitede ve belgelerde "NöbetSu" yok). Senin dosyalarında sadece görünen ad değişti: `nobetsu/agent.py` SYSTEM metni ("You are Arksus's district analyst…") ve modül docstring'leri; `web/public/data/agent/eskisehir.json`'daki iki "NöbetSu" da Arksus oldu. Python paketi `nobetsu` ve importlar **değişmedi**. Ajanı yeniden çalıştırırsan çıktıda Arksus geçer. Ayrıca: senin `omer` branch'in `muhammet`'in eski sürümünde; e-posta girişi, KVKK ve ilçe kartı için önce `origin/muhammet`'i çek.
