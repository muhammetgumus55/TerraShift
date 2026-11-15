# Arksus — Ekip Görevleri (4 kişi, ~24 saat)

Önce **`docs/PROJE_OZETI.md`** (herkes, 5 dk), sonra kendi dosyan: **`docs/team/<ADIN>.md`**.
Ayrıntı: `docs/PLAN_MVP.md` (tek doğru kaynak) · kod uyumu: `docs/ARAYUZLER.md` · sonra `docs/PLAN_EXPANSION.md`.
**T0** = herkesin repo'yu açtığı an. Saatler T0 = Cmt 15:00 ve teslim Paz 13:30 varsayımıyla yazıldı; resmi teslim saati farklıysa hepsini kaydırın.

**Kural:** Her milestone'da site çalışır durumda olmalı. M3 (`v0.2`) bitmeden genişletmeye geçilmez.

| Kişi | Rol | Rehber dosyası | Branch öneki |
|---|---|---|---|
| Muhammet | Araştırma, doğrulama, sunum (yazılım dışı) | `docs/team/MUHAMMET.md` | — (GitHub web) |
| İsmail | Web arayüzü | `docs/team/ISMAIL.md` | `ismail/` |
| Ömer | Rol A — Motor ve bilim (kritik yol) *(geçici)* | `docs/team/ROL_A_MOTOR.md` | `omer/` |
| Gümüş | Rol B — Veri, sözleşme, ekonomi, yayın *(geçici)* | `docs/team/ROL_B_VERI.md` | `gumus/` |

> Ömer ve Gümüş rolleri henüz kesinleştirmedi. Değiştirirseniz sadece bu tablodaki ve aşağıdaki iki başlıktaki isimleri (ve rehber dosyalarının başındaki "Kim:" satırını) değiştirin; görevler ve dosyalar aynı kalır.

### İşaretleme kuralı (insanlar ve AI ajanları için)

- Bir görev bitince, işi yapan kişi **ya da onun AI ajanı** **sadece kendi bölümündeki** satırı `- [ ]` → `- [x]` yapar ve satır sonuna saat + branch ekler. Örnek: `— ✅ 17:40 (omer/et0)`
- **"Bitti"** = testler geçti ve değişiklik commit edildi. Yarım iş işaretlenmez; istenirse satır sonuna `— ⏳ kalan: ...` yazılır.
- Başkasının bölümüne, satırların sırasına veya metnine dokunulmaz (git çakışması çıkmasın diye).
- İşaretleme, işin kendisiyle aynı branch'te gider; commit mesajı: `tick: <görevin kısa adı>`.
- Muhammet kendi kutularını GitHub web arayüzünden işaretler (bkz. `docs/team/MUHAMMET.md`); olmazsa Gümüş'e yazar.
- `docs/STATUS.md` ve `docs/AI_USE.md` içinde de herkes **sadece kendi başlığının altına** yazar.

---

## Ortak (herkes)

- [ ] **T+0 (15:00): 10 dk kickoff** — `docs/PROJE_OZETI.md` + PLAN_MVP §1, §2, §7; rolleri (Ömer/Gümüş kararı dahil) ve teslim saatini teyit edin
- [ ] **T+1 (16:00) M0: İskelet ve sözleşme donduruldu** — `docs/ARAYUZLER.md` + `types.ts` + mock JSON; bundan sonra değişiklik sadece Gümüş onayıyla
- [ ] **T+4 (19:00) M1 kontrolü (5 dk)** — herkes `docs/STATUS.md`'de kendi başlığına tek satır yazar: bitti / takıldı / ihtiyaç
- [ ] **T+9 (00:00) M2: Gerçek veriyle uçtan uca çalışıyor → `v0.1` etiketi** — güvenlik ağı
- [ ] **T+14 (05:00) M3: MVP tamam → `v0.2` etiketi** — demo sürümü; genişletmeye geçilebilir
- [ ] **T+19 (10:00): Özellik dondurma** — sadece hata düzeltme
- [ ] **T+22.5 (13:30): TESLİM** — tüm linkler gizli pencerede test edildi

---

## Muhammet — Araştırma, doğrulama, sunum (yazılım dışı)

Her bulduğun değeri `docs/SOURCES.md`'deki hazır satıra yaz: **değer · birim · kaynak adı · link · tarih · tür (official / statistic / literature / assumption)**. Gümüş bunları koda geçirir.

- [ ] **T+0–1: Yarışma kuralları** — teslim saati, video/slayt kuralı, AI kullanım beyanı, proje sayfası alanları, jüri kriterleri; ekibe 5 satırlık özet at
- [x] **T+1–3: Fiyatlar** — TMO 2026 buğday alım fiyatı (resmi sayfadan teyit), nohut ve mercimek için TMO günlük bülten veya Konya Ticaret Borsası → SOURCES.md `price.*` — ✅ 17:55 — gümüş yaptı (nohut fiyatı Gönen TB'den; Konya borsası 2026 bulunamadı)
- [x] **T+1–3: Destekler** — Bakanlık destek hesaplayıcısı (destekhesaplama.tarimorman.gov.tr): Karapınar ve Develi × buğday, nohut, mercimek, nadas, kuru (sulu değil) → `support.*` — ✅ 17:55 — gümüş yaptı (2026 ulusal tutarlar; nadas tutarı katsayıdan hesaplandı)
- [x] **T+3 (sadece Gümüş "SoilGrids olmadı" derse): SoilGrids web haritasından iki koordinatın toprak değerleri** — kil/kum/silt, pH, organik karbon, azot, CEC; Q05/Q50/Q95 → `soil.*` — ✅ 17:55 — gümüş yaptı (gerek kalmadı: WCS ile çekildi)
- [x] **T+3–5: Maliyetler** — Konya / Kayseri ziraat odası 2026 dekar başı maliyet tabloları (kira hariç); nadas için toprak işleme maliyeti → `cost.*` — ✅ 23:27 — gümüş: 14 Kas kararıyla maliyet kullanılmıyor (sitede para yok)
- [x] **T+3–5: Verimler** — TÜİK ilçe bitkisel üretim: Karapınar ve Develi kuru buğday, nohut, mercimek verimi (kg/da), 2004–2025 → `ym.*` yıllık tablo — ✅ 23:27 — gümüş yaptı: ilçe tablosu yerine ulusal referans verim (TEPGE/TÜİK), iç parametre
- [x] **T+5–6: Ekim/hasat takvimi** — TAGEM / GKTAEM / Bahri Dağdaş: Konya ve Kayseri için buğday, nohut, mercimek ekim ve hasat tarihleri → `calendar.*` → **Ömer'e haber ver** — ✅ 17:53 (Ömer yaptı, omer: buğday Gültekin ve ark. 2017, nohut Topalak 2016, mercimek TTAE + FAO-56; Kayseri'ye özel kaynak yok)
- [x] **T+6–7: Karapınar rüzgâr erozyonu kaynağı** — Konya Toprak Su ve Çölleşme Araştırma Enstitüsü tarih sayfası (nadas–hububat + diskaro, 1960'lar) → `story.erosion` — ✅ 17:55 — gümüş yaptı
- [x] **T+6–7: Doğrulama kaynakları** — Konya kuru koşul ön bitki denemesi (286 / 249 / 228 kg/da ve yıllar); Orta Anadolu nadas su depolama verimi (%8–30); Karapınar ve Develi'ye en yakın MGM istasyonunun 1991–2020 yıllık yağış normali → `ref.*` — ✅ 17:55 — gümüş yaptı (PSE %11–29, MGM yerine WMO normalleri); Ömer de bağımsız buldu, aynı değerler — ✅ 17:53 (Ömer yaptı, omer; MGM için WMO değerleri tutuldu)
- [x] **T+7–9: Strateji açıklamaları + toprak özellikleri + sözlük** — 3 rotasyon × neden / kanıt / faydalar / bilgi boşlukları / yerel uzmana sorulacaklar; azot bağlama, nadas yılındaki toprak işleme sayısı; 12 sözlük terimi → `strategy.*`, `trait.*`, `glossary.*` → Gümüş ve İsmail'e haber ver — ✅ 17:55 — gümüş yaptı (baklagil yılı toprak işleme sayısı bulunamadı)
- [ ] **T+9–10: Hikâye ve slayt iskeleti (7 slayt)**
- [ ] **T+10–12: Proje sayfası İngilizce taslak + AI beyanı taslağı + jüri soru-cevap listesi** (PLAN_MVP §8)
- [ ] **T+12–14: Siteyi kullanıcı gibi test et** — anlaşılmayan her yeri İsmail'e yaz; mümkünse bir çiftçiden veya MUSTECH'ten 5 dk görüş (isim için izin iste)
- [ ] **T+14–16: Gerçek sonuçlardan "hero cümlesi" + video senaryosu (30 sn, İngilizce altyazı)**
- [ ] **T+16–19: Slaytları gerçek ekran görüntüleriyle doldur; E4 Türkçe metinlerini gözden geçir**
- [ ] **T+19–21: Video çekimi ve kurgu (altyazı dahil)**
- [ ] **T+21–22.5: Teslim kontrol listesi** — proje sayfası, demo linki, GitHub linki, video/slaytlar, AI beyanı, NASA verisi adı geçiyor; hepsini gizli pencerede aç → TESLİM ET

---

## İsmail — Web arayüzü

- [ ] **T+0–1: Web iskeleti** — `web/` içinde Vite + React + TS + Tailwind + shadcn/ui + Recharts + vitest; Vercel bağlantısı (root = `web`); boş sayfa Vercel'de açılıyor → M0 — ⏳ kalan: Vercel bağlantısı (root = `web`, `vercel.json` hazır); iskelet ve testler `ismail/web`'de
- [ ] **T+1–4: Mock veriyle tek sayfa** — başlık + lokasyon/derinlik seçimi + 3 rotasyon kartı + mock bandı + rozetler → Vercel'de → M1 — ⏳ kalan: Vercel; sayfa gerçek veriyle `ismail/web`'de (öneri kartı, kartlar, rozetler, 13 ilçe)
- [x] **T+4–6: Grafik A (24 iklim, 2 yıllık net, şerit grafik)** — ✅ 01:41 (ismail/web; 14 Kas kararıyla 2 yıllık net yerine buğday verim oranı); 15 Kas yeni sitede "Geçmiş iklimlerde buğday"
- [x] **T+6–8: Grafik B (haftalık su defteri, yıl seçici)** · ✅ 15 Kas (haritada oynatılan iki yıl, haftalık defterden; yıl seçicili)
- [x] **T+8–9: "Senin rakamların" giriş paneli economics.ts'e bağlı; gerçek veriye geçiş** → M2 · iptal: para gösterilmiyor; gerçek veriye geçildi
- [x] **T+9–10.5: Öncelik kaydırıcıları + "Neden bu strateji?" çekmecesi** — M3'te düşürülmez — ✅ 01:37 (ismail/web; 4 kaydırıcı, §11)
- [x] **T+10.5–12: Toprak sağlığı bölümü** — ilçe toprak kartı, "uydunun söyleyemedikleri" kutusu, toprak doluluk eğrisi, SMAP paneli (veri yoksa "yakında") — M3'te düşürülmez — ✅ 01:41 (ismail/web)
- [x] **T+12–13.5: Grafik C (tarla takvimi), flip ızgarası, kanıt paneli, sözlük ipuçları, footer** — zaman yetmezse önce flip ızgarası, sonra Grafik C düşer · ✅ 15 Kas (tarla takvimi, "Yıl nasıl geçerse", kanıt paneli, 12 terimlik sözlük)
- [x] **T+13.5–14: Telefon (375 px) geçişi, rozetler, metin cilası** → M3 · ✅ 15 Kas (375 px'te yatay taşma yok)
- [x] **T+14–15: Genişletme E4 (Türkçe dil düğmesi)** · ✅ (TR/EN düğmesi)
- [x] **T+15–17: Genişletme E2 senaryo seçici (Gümüş tipleri ekledikten sonra)** · ✅ ("İklim değişirse?" kartı)
- [x] **T+17–19: Genişletme E3 GRACE grafiği, sonra E7 (harita)** · E7 ✅ (harita, tarla seçimi, 3B arazi ve yağmur suyu); E3 atlandı: GRACE verisi yok
- [x] **T+19–21: Video için temiz ekran durumu; hata düzeltmeleri** · ✅ 15 Kas (`?demo=karapinar` gibi bir bağlantı, sabit cevaplarla temiz sonuç ekranını açar)

---

## Ömer — Rol A: Motor ve bilim (kritik yol) *(geçici atama)*

- [x] **T+0–2: ET₀ (FAO-56 Penman–Monteith) + Örnek 18 testi** — ±0,1 mm/gün (iskeleti beklemeden başlanabilir) — ✅ 16:09 (omer/et0)
- [x] **T+2–4: Su bütçesi motoru (iki katmanlı, dual-Kc) + motor testleri** — kütle dengesi < 0,01 mm; bir sekans çalışıyor (Karapınar, nadas→buğday, orta, 2010) → M1 — ✅ 16:20 (omer/waterbalance)
- [x] **T+4–6: rotations.py + runner.py** — spin-up buğdayı, nadas / nohut / mercimek takvimleri, 24 sekans; `run_location()` ARAYUZLER §5 biçiminde — ✅ 16:31 (omer/runner)
- [x] **T+6–7: yieldmodel.py** — sadece Ya/Ym oranı (önceki ürün çarpanı YOK) — ✅ 16:31 (omer/runner)
- [x] **T+7–7.5: Toprak ve hassasiyet göstergeleri (PLAN_MVP §5.8, §5.10)** — çıplak gün (aylık), rüzgâra açık çıplak gün, aylık stres günü, çiçeklenmede sıcak gün, aylık doluluk (%) — ✅ 16:31 (omer/runner)
- [x] **T+7.5–9: 2 lokasyon × 3 rotasyon × 3 derinlik tam koşu, Gümüş'ün `build.py`'sine bağla** → M2 — ✅ 17:35 (omer; gerçek JSON'un commit'i ve v0.1 Gümüş'te)
- [x] **T+9–12: validate.py** — mass_balance, et0_fao56_ex18, pse_literature, trial_ratio, precip_vs_mgm — ✅ 16:42 (omer)
- [x] **T+12–14: Muhammet'in TAGEM takvimlerini crops.yaml'a geçir, yeniden koş, sonuçları gözle kontrol et** → M3 (takvim erken gelirse erken geçir) — ✅ 17:53 (omer; takvimleri Ömer buldu, crops.yaml'da kaynaklı)
- [ ] **T+14–16.5: Genişletme E1 (SMAP anomali karşılaştırması)** — ⏳ kalan: motor tarafı hazır (exp/E1-smap); SMAP verisi ve 6. kontrol için sözleşme Gümüş'te
- [ ] **T+16.5–18.5: Genişletme E2 (kurak/sıcak senaryo koşuları)** — ⏳ kalan: motor tarafı hazır (exp/E2-scenarios); sözleşme, build.py ve UI Gümüş/İsmail'de
- [ ] **T+18.5–19: zaman kalırsa E5 (bu sezon) veya E10 başlangıcı — yeşil değilse merge etme**

---

## Gümüş — Rol B: Veri, sözleşme, ekonomi, yayın *(geçici atama)*

- [ ] **T+0–0:10: GitHub repo'yu aç, hazır dosyaları (`AGENTS.md`, `CLAUDE.md`, `TASKS.md`, `docs/`) push et, herkesi ekle** — ⏳ kalan: ekip üyelerini GitHub'da collaborator olarak ekle
- [x] **T+0:10–1: Sözleşme iskeleti** — `engine/` paket iskeleti (sadece kendi modüllerin), `Makefile`, `config.py`, `types.ts`, `docs/contract/*.schema.json`, `mock.py` ile 6 tür mock JSON, `economics.ts` imzaları → M0 — ✅ 16:29 (gumus/m0)
- [x] **T+0:30: Koordinatları `locations.yaml`'a yaz, Muhammet'e gönder** — ✅ 20:48 (gumus/13-iller; 13 nokta, ESA WorldCover ile tarla kontrolü, SOURCES.md §8'de)
- [x] **T+1: AppEEARS'a SMAP L4 nokta isteğini gönder (5 dk)** — sm_rootzone, sm_rootzone_wetness, sm_surface_wetness; iki nokta; 2015-04-01 → bugün — ✅ 20:48 (13 nokta + sm_rootzone_pctl; `data/smap/appeears_request.json`, `appeears_points.csv`)
- [x] **T+1–2: power.py** — iki lokasyon için 2000 → son tarih NASA POWER çekimi + önbellek + `load_weather()`; birimleri başlıktan oku (WS2M_MAX dahil) → **Ömer'e haber ver** — ✅ 16:34 (gumus/power)
- [x] **T+2–2.75: SoilGrids tek seferlik çekim (45 dk sınır)** → `data/soilgrids/{lokasyon}.json`; olmazsa Muhammet'e "elle oku" de — ✅ 16:45 (gumus/soilgrids)
- [x] **T+2.75–4: economics.ts + vitest testleri** — P10/P50/P90, zarar olasılığı, başabaş verimi, flip tablosu, öncelik puanı (§5.9) → M1 — ✅ 16:47 (gumus/economics)
- [x] **T+4–7: export.py + build.py** — mock runner ile uçtan uca, şema doğrulama testi — ✅ 16:29 (gumus/m0; düzeltmeler gumus/economics öncesi main'de)
- [ ] **T+7–9: `make data` → gerçek JSON → Vercel'de görünüyor, `mock:false`** → M2, `v0.1` etiketini at — ⏳ kalan: sadece Vercel'de görünmesi (İsmail'in web iskeleti yok). Gerçek JSON `mock:false` main'de, `v0.1` etiketi atıldı — 18:28 (gumus/m2)
- [ ] **T+9–14: Muhammet'in değerlerini defaults.yaml / references.yaml'a, strateji metinlerini rotations.yaml'a geçir (her 2 saatte bir); README teknik kısım** → M3, `v0.2` etiketi — ⏳ kalan: sadece `v0.2` (site çalışınca). Yapıldı: değer/metin aktarımı, README, karar modülü 23:27 (gumus/karar-sistemi)
- [ ] **SMAP verisi geldiğinde: `smap/{lokasyon}.json` üret** — T+12'ye kadar gelmezse `available:false`, E1'e kalır — ⏳ kalan: AppEEARS sonucu (%25, kuyrukta). `smap.py` hazır ve test edildi 00:17; veri gelince `python -m nobetsu.smap <csv>` + `make data`
- [ ] **T+14–16: Genişletme E1 veri tarafı + E2 için sözleşme (tipler, `scenarios` listesi)** — ⏳ kalan: E1 için SMAP verisi (AppEEARS). Yapıldı 00:10 (gumus/omer-imerg-e1-e2): E2 sözleşmesi + 5 senaryo × 13 ilçe veri, E1 `smap_anomaly` sözleşmesi ve build bağlantısı, IMERG devralındı
- [ ] **T+16–18: Genişletme E3 (GRACE havza su trendi)**
- [ ] **T+18–19: Genişletme E6 (kısıtlar) veya E9 (fiyat belirsizliği) — yeşil değilse merge etme**
- [ ] **T+19–22: Son build, link kontrolleri, repo temizliği, AI_USE.md**

---

## Bekleyenler

- [ ] **Resmi teslim saati** — öğrenilince tablo kaydırılacak (Muhammet)
- [ ] **Ömer / Gümüş rol kararı** — kickoff'ta kesinleşsin
- [ ] **SMAP isteği** — daha önce AppEEARS'a gönderildiyse sonuç E1'de kullanılır; gönderilmediyse E1 Earth Engine ile yapılır
- [ ] **MUSTECH isim kullanma izni**

## Sonra (etkinlik sonrası)

- [ ] MGM günlük veriyle yağış düzeltmesi
- [ ] İstenen koordinat için hesaplama (küçük API)
- [ ] Arpa, fiğ, aspir rotasyonları
- [ ] Çiftçi görüşmeleri (Konya, Kayseri)
- [ ] MUSTECH için ET₀ / toprak suyu veri akışı
