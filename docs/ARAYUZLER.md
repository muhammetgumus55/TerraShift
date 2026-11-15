# Arayüzler — kimin kodu kime ne verir (M0'da donar)

Bu dosya, Ömer, Gümüş ve İsmail'in **birbirini beklemeden** kod yazıp sonra branch'leri sorunsuz birleştirmesi için var.
PLAN_MVP §4 dışarıya giden JSON'u tanımlar; bu dosya ayrıca **içerideki** bağlantıları (Python fonksiyonları, ara dosyalar, TypeScript API) tanımlar.

**Değişiklik kuralı.** Aşağıdaki fonksiyon adları, alan adları ve dosya yolları T+1'de (M0) donar. Bir şey değişmesi gerekirse:
1. Gümüş'e (sözleşme sahibi) yaz.
2. Gümüş aynı saat içinde **tek PR'da** bu dosyayı + `web/src/lib/types.ts` + `docs/contract/*.schema.json` + mock JSON'u günceller.
3. Gruba `SÖZLEŞME DEĞİŞTİ: <ne>` mesajı atar. Herkes `main`'i kendi branch'ine çeker.

Kimse "geçici olarak" yeni bir alan adı uydurmaz. AI ajanları da uydurmaz.

---

## 1. Büyük resim

```
                 Gümüş                         Ömer                           Gümüş                     İsmail
┌──────────────────────────┐   ┌───────────────────────────────┐   ┌──────────────────────┐   ┌─────────────────────┐
│ power.load_weather()     │──►│ runner.run_location()         │──►│ export.write_all()   │──►│ web/public/data/*.json
│ data/soilgrids/{loc}.json│──►│   et0 → waterbalance →        │   │  (+ şema doğrulama)  │   │   ↓ types.ts (Gümüş)
│ config: locations,       │   │   rotations → yield →         │   │                      │   │   ↓ economics.ts     │
│   rotations, defaults,   │   │   indicators                  │   │                      │   │     (Gümüş)          │
│   references             │   │ validate.run_checks()  ───────┼──►│                      │   │   ↓ React UI (İsmail)│
└──────────────────────────┘   └───────────────────────────────┘   └──────────────────────┘   └─────────────────────┘
                       build.py (Gümüş) hepsini sırayla çağırır:  make data   |   make mock (sahte runner ile)
```

Akış tek yönlü: kimse kendinden sonraki adımın koduna bakmak zorunda değil, sadece bu dosyadaki biçime uyar.

---

## 2. Hava verisi — `power.py` (Gümüş) → motor (Ömer)

```python
# engine/nobetsu/power.py
def load_weather(location_id: str) -> pd.DataFrame: ...
```

- **İndeks:** günlük, kesintisiz `DatetimeIndex` (adı `date`), 2000-01-01 → POWER'ın son tarihi.
- **Sütunlar (adlar ve birimler sabit):**

| Sütun | POWER parametresi | Birim |
|---|---|---|
| `precip_mm` | PRECTOTCORR | mm/gün |
| `tmax_c` | T2M_MAX | °C |
| `tmin_c` | T2M_MIN | °C |
| `tdew_c` | T2MDEW | °C |
| `rh_pct` | RH2M | % |
| `u2_ms` | WS2M | m/s |
| `u2max_ms` | WS2M_MAX | m/s |
| `rs_mj_m2` | ALLSKY_SFC_SW_DWN | MJ/m²/gün (başlıkta başka birim yazıyorsa Gümüş çevirir) |

- **`df.attrs`:** `location_id`, `lat`, `lon`, `elevation_m` (POWER başlığından), `first_date`, `last_date` (ISO), `gaps_filled` (int), `source` = `"NASA POWER daily, community=AG"`.
- `-999` → NaN; ≤ 3 günlük boşluklar doğrusal doldurulur. **Doldurulamayan NaN kalırsa `load_weather` hata verir** (motor NaN görmez).
- API'ye sadece önbellek yoksa gidilir: `data/raw/power_{location_id}.json`.

**Ömer beklerken:** testlerde kendi sentetik `DataFrame`'ini aynı sütun adlarıyla üretir (`engine/tests/fixtures.py`).

---

## 3. Toprak verisi — SoilGrids (Gümüş) → motor (Ömer) ve export (Gümüş)

Gümüş her lokasyon için `data/soilgrids/{location_id}.json` yazar:

```jsonc
{
  "location_id": "karapinar",
  "how_obtained": "wcs | gee | manual_viewer",
  "properties": [ /* PLAN_MVP §4.2 soil.properties öğeleriyle birebir aynı */ ],
  "awc_mm_per_m": { "value": 0, "unit": "mm/m",
                    "source": "SoilGrids 2.0 wv0033−wv1500, cfvo düzeltmeli, 0–100 cm ağırlıklı",
                    "type": "model", "verified": false }
}
```

- **AWC kararı (14 Kas, Gümüş + Ömer):** SoilGrids'in doğrudan `wv0033 − wv1500` değeri bu killi topraklarda tarla kapasitesini düşük tahmin ediyor (Karapınar 58,6, Develi 67,4 mm/m; Saxton–Rawls ile solma noktası uyuşuyor, tarla kapasitesi ~0,31'e karşı ~0,40). Bu yüzden motor AWC'yi **dokudan** alır:
  `AWC = FAO-56 Tablo 19 [texture_0_100cm.usda_class] orta değeri × (1 − cfvo_0_100cm_fraction)`, `type: "assumption"`, `verified: false`, kaynakta "SoilGrids dokusu → FAO-56 Tablo 19, taş düzeltmeli" (Ömer uyguladı; taş düzeltmesi OMER_BAKMALI §3). Tablo değerleri ve sınıf eşlemesi `soil.yaml`'da (Ömer). Tabloda olmayan sınıf (ör. killi tın) için hangi sınıfın kullanıldığı kaynakta yazılır.
- Dosyadaki ek alanlar (Gümüş yazar): `texture_0_100cm {clay, sand, silt, usda_class, source}` (ortalama haritalar, 100'e ölçekli), `cfvo_0_100cm_fraction` (V), `awc_alternatives {soilgrids_wv0033_wv1500, saxton_rawls_2006}` (V). `awc_mm_per_m` = SoilGrids doğrudan değeri, **sadece bilgi amaçlı** (kanıt panelinde karşılaştırma için).
- **Dosya yoksa** motor `soil.yaml`'daki yedek değeri kullanır ve `type: "assumption"` yapar.
- **15 Kas (şeffaflık):** export, `results.soil` altına isteğe bağlı `awc_alternatives` (motorun kullanmadığı AWC tahminleri: `soilgrids_wv0033_wv1500`, `saxton_rawls_2006`; V benzeri nesne, `range_q05_q95` olabilir) ve `texture_class` (USDA, 0–100 cm) ekler. Toprak kartı "SoilGrids'in kendi tahmini … (kullanılmadı)" diye gösterebilir.
- Motorun **gerçekte kullandığı** AWC, `run_location` çıktısında `awc_used` olarak döner (§5); export bunu `results.soil.awc_mm_per_m`'ye yazar.

---

## 4. Config dosyaları ve değer nesnesi (V)

Tüm YAML'lar `engine/config/` altında. Okuma: `nobetsu.config.load("crops")` → `dict` (Gümüş yazar, 10 satır).

| Dosya | Sahibi | İçerik |
|---|---|---|
| `locations.yaml` | Gümüş | id, name, district, province, lat, lon, note |
| `rotations.yaml` | Gümüş (metin: Muhammet) | id, is_baseline, crops, label, soil_traits, strategy |
| `defaults.yaml` | Gümüş | **Karar parametreleri (14 Kas):** ürün başına referans verim, fiyat, destek (ulusal, iç parametre) + öncelik ağırlıkları, verimlilik engelleri. Maliyet yok. |
| `references.yaml` | Gümüş (değer: Muhammet) | deneme verimleri, PSE aralığı, MGM normalleri, sıcak gün eşiği |
| `crops.yaml` | Ömer (takvim: Muhammet) | ekim, evre süreleri, Kcb, p, Zr_max, h_max, Ky |
| `soil.yaml` | Ömer | derinlik sınıfları (id, depth_m, label), Ze, TEW/REW, yedek AWC |

Her sayısal parametre **değer nesnesi (V)** biçimindedir (PLAN_MVP §4.4 ile aynı):

```yaml
ref_yield_kg_per_da:
  value: 296
  unit: "kg/da"
  source: "TEPGE Buğday Durum-Tahmin Raporu 2025 (TÜİK)"
  source_url: "https://..."
  type: official | statistic | literature | assumption
  verified: false
  as_of: "2026-11-14"
```

**M0 netleştirmeleri (Gümüş):**
- `value: null` = değer henüz kaynaklı değil (**pending**). Sitede sayı yerine "bekleniyor" gösterilir.
- `soil.yaml` (Ömer) derinlik sınıflarını `depth_classes: [{id, depth_m, label: {en, tr}}]` olarak tutar (`depth_m` sayı veya V). Dosya yoksa export PLAN_MVP §4.1'deki 0.6 / 0.9 / 1.2 m değerlerini kullanır.
- `references.yaml` anahtarları (Ömer `validate.py`'de bunları okur): `trial_yields_kg_per_da.{after_fallow, after_lentil, after_chickpea}`, `pse_range.{low, high}` (oran, 0–1), `mgm_annual_precip_mm.{karapinar, develi}` (+ `station`), `heat_threshold_c`. Hepsi V.

Derinlik sınıfı id'leri sabit: `shallow`, `medium`, `deep`. Rotasyon id'leri sabit: `fallow_wheat`, `chickpea_wheat`, `lentil_wheat`. **Lokasyon id'leri sabit değil (14 Kas, SÖZLEŞME DEĞİŞTİ):** liste `engine/config/locations.yaml`'dan gelir (13 İç Anadolu ilçesi; `karapinar` ve `develi` korunur). Biçim `^[a-z][a-z0-9_]*$`. Web listeyi `site_index.locations`'tan okur, sabit liste yazmaz; `defaults.values` her lokasyon için bir anahtar taşır. Ürün id'leri sabit: `wheat`, `chickpea`, `lentil`, `fallow`.

---

## 5. Motor çıktısı — `runner.py` (Ömer) → `export.py` (Gümüş)

```python
# engine/nobetsu/runner.py
def run_location(location_id: str, weather: pd.DataFrame, soilgrids: dict | None) -> dict: ...
```

Dönüş (`EngineOutput`):

```python
{
  "location_id": "karapinar",
  "awc_used": { "value": ..., "unit": "mm/m", "source": "...", "type": "model|assumption", "verified": False },
  "sequences": [ ... ],   # 216 satır = 3 rotasyon × 3 derinlik × 24 yıl; her satır PLAN_MVP §4.2 'sequences' öğesiyle BİREBİR aynı anahtarlar
  "ledger":    [ ... ],   # 216 seri; her biri PLAN_MVP §4.3 'series' öğesiyle BİREBİR aynı
  "diagnostics": { "max_mass_balance_error_mm": 0.0, "n_sequences": 216 }
}
```

Kurallar:
- `start_year` 2001…2024 (dahil). Ay listeleri (`bare_by_month`, `stress_by_month`, `fullness_by_month`) **tam 24 eleman**, eleman 0 = y yılının Temmuzu.
- `fallow_wheat` için `first_crop: None`; diğerlerinde `fallow_storage_efficiency: None`.
- `ledger.weeks[].week_start`: 1 Temmuz y'den başlayan 7 günlük bloklar (ISO tarih); **her seride tam 104 hafta** (24 aylık pencereye tam sığan bloklar, Haziran y+2'nin son 2–3 günü dışarıda). `crop` alanı haftadaki günlerin çoğunluğu: `"fallow" | "bare" | "wheat" | "chickpea" | "lentil"` (nadas rotasyonundaki boş dönem `fallow`, baklagil rotasyonlarındaki boş dönem `bare`).
- Sayılar ham `float`/`int` döner; **yuvarlamayı export yapar** (§10).
- Para, fiyat, TL **yok**. Motor sadece fizik ve oran üretir.

---

## 6. Doğrulama — `validate.py` (Ömer) → `export.py` (Gümüş)

```python
# engine/nobetsu/validate.py
def run_checks(outputs: dict[str, dict], weather: dict[str, pd.DataFrame], refs: dict) -> list[dict]: ...
```

- `outputs`: `{location_id: EngineOutput}`; `refs`: `config.load("references")`.
- Dönüş: PLAN_MVP §4.5 `checks` listesi; `run_checks` 5 kontrolü bu sırayla verir: `mass_balance`, `et0_fao56_ex18`, `pse_literature`, `trial_ratio`, `precip_vs_mgm`; `validation.json` toplam **6** kontrol (6. `smap_anomaly`, aşağıda). **15 Kas (E1, SÖZLEŞME DEĞİŞTİ):** `build.py` 6. kontrolü ekler: `smap_anomaly` = `validate.check_smap_anomaly(run_landscape(...), smap)`; SMAP verisi yoksa `pending`. `validation.json` artık tam **6** kontrol. `precip_vs_mgm` değerinde NASA GPM IMERG sütunu da var (`data/imerg/`, `imerg.py`, sahibi Gümüş).
- Referans değeri henüz yoksa (`refs` içinde boş) o kontrol `status: "pending"` döner, hata vermez.

---

## 7. Export ve build — Gümüş

```python
# engine/nobetsu/export.py
def write_all(outputs: dict[str, dict], checks: list[dict], mock: bool, out_dir: str = "web/public/data",
              weather_meta: dict[str, dict] | None = None) -> None: ...
# weather_meta = {loc: load_weather(loc).attrs} → site_index.locations[].elevation_m ve power_range

# engine/nobetsu/build.py   →  make data  /  make mock
#   for loc in locations: w = load_weather(loc); s = soilgrids json; out[loc] = run_location(loc, w, s)
#   checks = run_checks(out, weathers, refs); write_all(out, checks, mock=False)
#   --mock: run_location yerine mock.fake_run_location (aynı biçim) kullanılır, mock=True
```

`mock.fake_run_location()` §5'teki biçimi sahte sayılarla üretir. Böylece **export ve web ilk saatten gerçek kod yoluyla test edilir**; Ömer'in motoru gelince sadece fonksiyon değişir.

---

## 8. JSON sözleşmesi — export (Gümüş) → web (İsmail)

Biçim: PLAN_MVP §4. Dosyalar `web/public/data/` altında:

| Dosya | Ne zaman yüklenir |
|---|---|
| `site_index.json` | sayfa açılınca |
| `results/{location_id}.json` | lokasyon seçilince (`scenario_id: "baseline"`) |
| `results/{location_id}__{scenario_id}.json` | **E2 (15 Kas):** senaryo seçilince; aynı şema, `scenario_id` dolu. Senaryolar `site_index.scenarios` (`id, label, precip_factor, temp_shift_c`; baseline ilk). Ledger ve validation sadece baseline'dan. |
| `defaults.json` | sayfa açılınca — karar parametreleri; **fiyat/destek asla ekranda gösterilmez** |
| `validation.json` | sayfa açılınca |
| `soil_health.json` | **15 Kas:** toprak sağlığı kartı açılınca — uygulamalar, kanıtları ve organik madde sınıfları; hesap tarayıcıda `soilhealth.ts` ile (§15) |
| `sowing.json` | **15 Kas:** "nasıl ekilir" kartı açılınca — ekim penceresi, tohum, derinlik, sıra arası kuralları ve ilçelerin yıllık yağış normali; hesap tarayıcıda `sowing.ts` ile (§14) |
| `fertilizer.json` | **15 Kas:** gübre ekranı açılınca — gübre kuralları (TAGEM tabloları, ürünler, uyarılar); hesap tarayıcıda `fertilizer.ts` ile (§13) |
| `smap/{location_id}.json` | lokasyon seçilince (**her zaman vardır**; veri yoksa `available: false`, `latest: null`, listeler boş). Mock'ta Karapınar `available: true`, Develi `false` (iki UI durumu da denenebilsin) |
| `ledger/{location_id}.json` | Grafik B görünür olunca (lazy) |

Netleştirmeler:
- `site_index.start_years: [2001, 2024]` = **[ilk, son]**, ikisi dahil.
- `rotations` dizisinde baz senaryo (`is_baseline: true`) **her zaman ilk** sırada.
- `source_url` her yerde isteğe bağlıdır (boş olabilir); `source` zorunludur.
- Her dosyada `schema_version: "1.0"`, `mock`, `generated_at`.
- Şema dosyaları: `docs/contract/*.schema.json` (Gümüş). `pytest` hem mock hem gerçek çıktıyı bunlarla doğrular. `web/src/lib/contract.test.ts` mock JSON'u `types.ts` tiplerine atayarak tip kaymasını yakalar.

---

## 9. Karar API'si — `economics.ts` (Gümüş) → web (İsmail)  — SÖZLEŞME DEĞİŞTİ 14 Kas

**Sitede para yok.** İsmail hiçbir TL, fiyat, gelir ya da maliyet göstermez ve puan hesabı yazmaz; sadece bu fonksiyonları çağırır.
Fiyat, destek ve referans verim yalnızca `sequenceValue` içinde "hangi rotasyon çiftçiye daha çok kazandırır" tahmini için kullanılır.
Bu tahmin, buğday verimi, toprak koruma ve su ile ağırlıklı puanda dengelenir; verimlilik engeline takılan rotasyon önerilmez.

```ts
// web/src/lib/economics.ts
export interface DecisionInputs { crops: LocationInputs; weights: Weights; guardrails: Guardrails; close_call_margin: number }
export interface Weights { value: number; yield: number; soil: number; water: number }   // kaydırıcılar; toplam 1'e ölçeklenir
export function inputsFromDefaults(d: DefaultsFile): DecisionInputs;                       // defaults.json → girdiler (ulusal)

export interface Range { p10: number; p50: number; p90: number }
export function percentile(values: number[], p: number): number;   // §10
export function range(values: number[]): Range;

/** İÇ: 2 yıllık piyasa değeri (TL/da). ASLA gösterme. */
export function sequenceValue(row: SequenceRow, rotation: Rotation, crops: LocationInputs): number;

export interface RotationSummary {                 // kart: sadece tarım göstergeleri
  rotation_id: string; depth_id: string; is_baseline: boolean;
  harvests_in_two_years: number;                   // nadas 1, baklagil 2
  water_at_wheat_sowing_mm: Range;
  wheat_yield_ratio: Range;                        // 0–1: su sıkıntısı olmasa alınacak verimin payı
  first_crop_yield_ratio: Range | null;            // nadasta null
  bare_days_p50: number; wind_exposed_bare_days_p50: number; wheat_stress_days_p50: number;
  delta_vs_baseline: { water_p50: number; wheat_yield_ratio_p50: number; bare_days_p50: number; wind_exposed_p50: number } | null;
}
export function summarize(results: ResultsFile, site: SiteIndex, depthId: string): RotationSummary[];

export type BlockReason = 'wheat_yield_below_baseline' | 'first_crop_fails';
export interface RankedRotation {
  rotation_id: string; eligible: boolean; blocked: BlockReason[];
  score: number;                                   // 0–1
  parts: Weights;                                  // her biri 0–1, o ölçütte en iyiye göre
  driver: keyof Weights;                           // puanı en çok belirleyen ölçüt ("neden?")
}
export interface Decision {
  depth_id: string;
  recommended: string | null;                      // "Önceliklerine göre bu arazi için en uygun"
  runner_up: string | null;
  close_call: boolean;                             // ilk iki uygun seçenek arasındaki fark < close_call_margin
  ranking: RankedRotation[];                       // uygunlar (puan sırasıyla), sonra engellenenler
}
export function decide(results: ResultsFile, site: SiteIndex, depthId: string, inp: DecisionInputs, weights?: Weights, years?: Set<number>): Decision;

export type Tercile = 'dry' | 'normal' | 'wet';
export interface FlipCell { depth_id: string; tercile: Tercile; rotation_id: string | null; close_call: boolean; n_years: number }
export function flipTable(results: ResultsFile, site: SiteIndex, inp: DecisionInputs, weights?: Weights): FlipCell[]; // 9 hücre

/** 15 Kas: öneri fiyatlar ±%20 değişince de aynı kalıyor mu? (±%20 ekip seçimi, fiyat tahmini değil) */
export interface PriceRobustness {
  depth_id: string; recommended: string | null; stable: boolean;
  sensitive_to: { crop: 'wheat' | 'chickpea' | 'lentil'; change: number; recommended: string | null }[];
  tested_changes: number[];
}
export function priceRobustness(results: ResultsFile, site: SiteIndex, depthId: string, inp: DecisionInputs,
  weights?: Weights, changes?: number[]): PriceRobustness;     // TL içermez
```

Puan kuralı: her ölçüt 24 yılın ortancası; `value` = ortanca `sequenceValue` (Σ oran × referans verim × fiyat + Σ destek; **maliyet yok**), `yield` = ortanca buğday verim oranı, `water` = ortanca ekimde su, `soil` = ortanca rüzgâra açık çıplak gün (az olan iyi). Her ölçüt en iyi rotasyona oranlanır (`x / en iyi`; toprakta `en iyi / x`), ağırlıklarla toplanır.
Engeller (`defaults.yaml` → `decision.guardrails`): ortanca buğday oranı < 0,85 × nadas sonrası buğday → `wheat_yield_below_baseline`; ilk yıl ürünü ortanca oranı < 0,30 → `first_crop_fails`.

## 10. Ortak tanımlar (Python ve TypeScript aynı sonucu versin)

- **Yüzdelik:** doğrusal ara değer, numpy varsayılanı (`np.percentile(x, p)`, "type 7"). TS'de aynısı yazılır ve aynı örnek dizi ile test edilir.
- **Tercile (kurak/normal/ıslak):** her lokasyonda 24 başlangıç yılı, `fallow_wheat` + `medium` satırlarındaki `pre_sowing_precip_mm`'e göre sıralanır: en düşük 8 = `dry`, orta 8 = `normal`, en yüksek 8 = `wet`. (Yağış rotasyona ve derinliğe göre değişmez; bu sadece hangi satırdan okunacağını sabitler.)
- **Yuvarlama (export'ta):** mm → 1 ondalık; oranlar ve verimlilik → 3 ondalık; `fullness` → 1 ondalık; gün sayıları → tam sayı.
- **Tarihler:** ISO `YYYY-MM-DD`, yerel saat (POWER `time-standard=LST`).
- **Birim notu (UI):** 1 mm su = 1 m³/da.

---

## 11. Mock stratejisi — herkes ilk dakikadan çalışabilsin

| Kim | Neyi beklemeden ne ile çalışır |
|---|---|
| İsmail | `web/public/data/` altındaki JSON + `economics.ts` karar API'si |
| Gümüş | `mock.fake_run_location()` ile export/build; Ömer'in motoru gelince tek satır değişir |
| Ömer | Sentetik hava `DataFrame`'i (§2 sütunları) ile testler; POWER önbelleği gelince gerçek sekans |
| Muhammet | Hiçbir koda bağlı değil; `docs/SOURCES.md` satırlarını doldurur |

Mock sayılar "makul ama belli ki sahte" olur (ör. tüm yıllar düzgün bir eğri), `mock: true` ve sitede bant görünür.

---

## 12. Teslim takvimi — kim, kime, ne, ne zaman

| Saat | Kimden → Kime | Ne | Gecikirse |
|---|---|---|---|
| T+0:10 | Gümüş → herkes | Repo + AGENTS.md + bu dosya | — |
| T+0:30 | Gümüş → Muhammet | İki lokasyonun koordinatları | Muhammet ilçe merkezini kullanır, not düşer |
| T+1 | İsmail → herkes | Web iskeleti + Vercel linki | — |
| T+1 | Gümüş → İsmail | `types.ts`, mock JSON, `economics.ts` imzaları | İsmail PLAN §4'ten geçici yerel tip yazmaz, bekler; bu arada layout yapar |
| T+2 | Gümüş → Ömer | POWER önbelleği + `load_weather()` | Ömer sentetik havayla devam eder |
| T+2:45 | Gümüş → Ömer | `data/soilgrids/*.json` (AWC) | FAO-56 Tablo 19 yedek AWC (`assumption`) |
| T+3 → T+5 | Muhammet → Gümüş | Fiyat, destek, referans verim (`SOURCES.md`; iç parametre) | yapıldı (14 Kas) |
| T+6 | Muhammet → Ömer | Ekim/hasat takvimleri | FAO-56 başlangıç değerleri |
| T+7 | Muhammet → Gümüş → Ömer | Deneme verimleri, PSE aralığı, MGM normalleri (`references.yaml`) | İlgili kontrol `pending` |
| T+7:30 | Ömer → Gümüş | `run_location()` gerçek çıktı | M2 mock ile değil, kısmi gerçek veriyle |
| T+9 | Muhammet → Gümüş / İsmail | Strateji metinleri → `rotations.yaml`; sözlük → `strings.ts` | "metin bekleniyor" yer tutucusu |
| T+9 | Gümüş → İsmail | Gerçek JSON (`mock: false`) | mock kalır, bant görünür |
| T+12–14 | Muhammet → İsmail | Kullanıcı testi notları | — |

---

## 13. Gübre API'si — `fertilizer.ts` (Gümüş) → web (İsmail) — SÖZLEŞME EKLENDİ 15 Kas

Ek dosya, mevcut dosyalar değişmedi. Ayrıntı ve ekran akışı: `docs/GUBRE.md`.
Kurallar `engine/config/fertilizer.yaml` → `web/public/data/fertilizer.json` (şema `docs/contract/fertilizer.schema.json`, tipler `types.ts` §4.6 `FertilizerFile`).
Ana yöntem TAGEM Orta Anadolu toprak analizi çizelgeleri (N organik maddeye, P2O5 Olsen'e, K2O yarayışlı K'ye göre; Kuru = `rainfed`, Sulu = `limited`/`irrigated`).
Sitede para yok; çıktı kg/da saf besin ve kg/da ürün.

```ts
// web/src/lib/fertilizer.ts
export interface SoilTest { om_pct?; p2o5_kg_per_da?; k2o_kg_per_da?; olsen_p_ppm?; k_ppm?; total_n_pct?; ph?; lime_pct?; ec_ds_m?; zn_ppm? }
export function soilFromResults(results: ResultsFile, f: FertilizerFile): { soil: SoilTest; badges; needs_lab: (keyof SoilTest)[] };
export interface FertRequest { crop: FertCropId; water: WaterRegime; target_yield_kg_per_da?: number; soil: SoilTest;
  inoculated?: boolean; drip?: boolean; banding?: boolean }
export function recommend(f: FertilizerFile, req: FertRequest): FertPlan;   // atmaz; bilinmeyen besin = null + basis
// FertPlan: nutrients[{nutrient, fertilizer_kg_per_da|null, basis, source, capped, need/soil_supply/balance (çapraz kontrol)}],
//           doses[{product, timing, kg_per_da, supplies}], flags, advice, guide, missing, better_for_salinity, derived
```

Kurallar: bileşende gübre hesabı yok. `fertilizer_kg_per_da: null` → "toprak analizi gerekli" / "kaynak bekleniyor", asla 0. Her sayının rozeti `source.type`. Gübre planı rotasyon puanına girmez.

---

## 14. Ekim API'si — `sowing.ts` (Gümüş) → web — SÖZLEŞME EKLENDİ 15 Kas

Ek dosya; mevcut dosyalar değişmedi. Ayrıntı: `docs/GUBRE.md` §9. Kurallar `engine/config/sowing.yaml` → `web/public/data/sowing.json` (şema `docs/contract/sowing.schema.json`, tipler `types.ts` §4.7 `SowingFile`).

```ts
// web/src/lib/sowing.ts
export function sowingPlan(f: SowingFile, req: SowRequest): SowPlan;
// SowRequest: crop ('wheat'|'barley'|'lentil'|'chickpea'), typeId?, water, locationId?, late?, seedbed? ('good'|'normal'|'poor'),
//             soil? ('moist'|'dry'), drill? ('separate_band'|'same_band'|'broadcast'), tkw_g?, purity_pct?, germination_pct?
// SowPlan: window {from, to (MM-DD), source} | window_text, window_notes, seeds {range, chosen, rule}, plants,
//          guide {range, extras, min, max}, calc {per_m2, kg_per_da} | null + calc_missing, depth, rows, annual_precip, advice
export function seedKgPerDa(perM2: number, tkwG: number, purityPct: number, germinationPct: number): number;
export function windowStatus(from: string, to: string, today: Date): 'before' | 'open' | 'after';
```

Kurallar: bileşende hesap yok. Kaynağın tarih vermediği yerde `window_text` gösterilir, tarih uydurulmaz. Ekim bilgisi rotasyon puanına girmez.

---

## 15. Toprak sağlığı API'si — `soilhealth.ts` (Gümüş) → web — SÖZLEŞME EKLENDİ 15 Kas

Ek dosya; mevcut dosyalar değişmedi. Ayrıntı: `docs/GUBRE.md` §10. Kurallar `engine/config/soil_health.yaml` → `web/public/data/soil_health.json` (şema `docs/contract/soil_health.schema.json`, tipler `types.ts` §4.8 `SoilHealthFile`).

```ts
// web/src/lib/soilhealth.ts
export function soilHealthPlan(f: SoilHealthFile, ctx: SoilHealthContext, summaries?: RotationSummary[], minRatio?: number): SoilHealthPlan;
// SoilHealthContext: location_id?, depth, depth_known, water?, om_pct?, ec_ds_m?, practice?
// SoilHealthPlan: om {value, label} | null, practices (koşula uyanlar, sırasıyla), model RotationFact[]
export function modelFacts(summaries: RotationSummary[], minRatio: number): RotationFact[];
// RotationFact: rotation_id, is_baseline, wheat_vs_fallow, passes_guardrail, bare_days, wind_days
export function omClass(f: SoilHealthFile, om: number): Text;
```

Kurallar: bileşende hesap yok. Ceza ve destek tutarı gösterilmez. Organik madde artış hızı verilmez.


## 16. Hesap girişi (Supabase e-posta + şifre), onay ve ilçe ekim kaydı — Supabase (Gümüş) → web — SÖZLEŞME EKLENDİ 15 Kas

İlk kez sunucuya kullanıcı verisi yazılıyor. Ne yazılabileceğini `docs/legal/` belirler: **sadece il + ilçe; tarla sınırı, ada/parsel, GPS sunucuya gitmez.**

- Supabase projesi `nobetsu` (eu-central-1). Tablolar ve erişim kuralları: `supabase/migrations/20261115084930_consent_profiles_intents.sql`.
  - `consents(user_id, kind, version, granted, created_at)` — sadece eklenir; `kind`: `notice_read` | `district_stats` | `llm_training`.
  - `profiles(user_id, answers, prefs, location_id, il, ilce)` — sadece sahibi.
  - `planting_intents(user_id, harvest_year, il, ilce, crop, irrigation)` — kullanıcı başına yılda bir satır; sadece `district_stats` izni varken yazılır; izin geri alınınca silinir.
  - `rpc district_totals(year)` — herkese açık; sadece en az 5 kaydı olan ilçelerin ürün toplamları, kullanıcı kimliği yok.
  - `rpc delete_my_account()` — giriş yapmış kullanıcının hesabını ve tüm satırlarını siler.
- Web: `services/cloud.ts` (Supabase çağrıları), `state/cloud.ts` (oturum, onaylar, profil eşitleme), `domain/consent.ts` (sürümler: `NOTICE_VERSION = 'aydinlatma-v1'`, `CONSENT_VERSION = 'acik-riza-v1'`; `LLM_CONSENT_OPEN = false`).
- Ortam: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (Vercel + `web/.env.local`). Yoksa site Biar'ın cihaz içi deneme girişiyle çalışır.
- Kurallar: aydınlatma metni okunmadan hiçbir kullanıcı verisi yazılmaz; açık rıza hizmet şartı değildir; metin değişirse sürüm kimliği değişir (`docs/legal/README.md`). `web/public/legal/*.md`, `docs/legal/*.md` ile aynı kalır (test: `domain/consent.test.ts`).
- (15 Kas) Sitede "İlçende bu sezon ne ekiliyor?" kartı (`screens/result/DistrictPlan.tsx`, hesap `domain/districtPlan.ts`): `district_totals` çağrılır, giriş gerekmez. Eşik altındaysa "yeterli kayıt yok" yazar; isteyene `public/demo/district_plans.json` (`mock: true`, `verified: false`, uydurma örnek) sarı "Örnek veri — gerçek kayıt değil" etiketiyle gösterilir. Demo dosyası `public/data` dışında tutulur (sözleşme verisi değildir).
