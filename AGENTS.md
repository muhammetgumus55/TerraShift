# AGENTS.md — Arksus (NASA Space Apps 2026, "Field Shift")

Tek doğru kaynak: `docs/PLAN_MVP.md`. Kod bağlantıları: `docs/ARAYUZLER.md`. Görev listesi: `TASKS.md`.

## Başlamadan
1. Kullanıcı hangi `.md` dosyalarını verdiyse sadece onları oku (bkz. CLAUDE.md "Dosya okuma kuralı"); otomatik okuma yok.
2. Tüm repoyu tarama. `data/raw/**` okuma.
3. Çok dosyalı değişiklikten önce plan çıkar; önce test, sonra kod.

## Sert kurallar (PLAN_MVP §2)
- **Uydurma sayı yok.** Her parametre YAML'da `value, unit, source, type, verified` ile durur. Doğrulanmamışsa `verified: false`, UI'da "assumption".
- **Sözleşme donmuş.** `docs/ARAYUZLER.md` ve PLAN_MVP §4'teki ad, alan ve yolları değiştirme. Gerekirse DUR ve kullanıcıya "Gümüş'e sözleşme değişikliği sorulmalı" de.
- **Mock bayrağı.** Her JSON'da `"mock": true|false`; site mock varken bant gösterir.
- **Para gösterilmez (14 Kas kararı).** Sitede TL, fiyat, gelir, kâr, maliyet hiçbir yerde görünmez. Fiyat, destek ve referans verim sadece `economics.ts` içinde, "hangi rotasyon çiftçiye daha çok kazandırır" tahmininde **iç parametre** olarak kullanılır; çıktılar 0–1 puandır.
- **Öneri dili.** Site arazi için öneri verir: "Önceliklerine göre bu arazi için en uygun: …" / "Most suitable for this land under your priorities: …". Gerekçe (en çok etki eden ölçüt), engellenen seçenekler ve "sonuçlar yakın" durumu her zaman gösterilir. "kâr garantili" / "profit guaranteed", "kesin" / "certain", "yasak" / "banned" yazılmaz.
- **Verimlilik engeli.** Sonraki buğdayı nadas sonrasının %85'inin altına düşüren ya da ilk yıl ürünü ortanca yılda %30'un altında kalan rotasyon, kazancı ne olursa olsun önerilmez (eşikler `engine/config/defaults.yaml` → `decision.guardrails`).
- **Rozet.** Gösterilen her sayının türü var: measured, model, official, statistic, literature, assumption, user.
- **Ürüne özel `if` yok** (motor). Parametreler sadece `engine/config/*.yaml`'dan.
- Testler geçmeden merge yok. `main` her zaman build alır.

## Dosya sahipliği (sadece kendi dosyanı düzenle)
| Sahip | Dosyalar |
|---|---|
| Ömer (Rol A) | `engine/config/{crops,soil,scenarios}.yaml`, `engine/nobetsu/{et0,waterbalance,rotations,yieldmodel,indicators,runner,validate}.py`, bunların testleri `engine/tests/test_{et0,waterbalance,rotations,yieldmodel,indicators,runner,validate,scenarios,smapcheck}.py`, `engine/tests/fixtures.py` |
| Gümüş (Rol B) | `AGENTS.md`, `CLAUDE.md`, `Makefile`, `README.md`, `.gitignore`, `.claude/settings.json`, `docs/ARAYUZLER.md`, `docs/team/ROL_B_VERI.md`, `docs/GUBRE.md`, `docs/contract/**`, `engine/pyproject.toml`, `engine/config/{locations,rotations,defaults,references,fertilizer,sowing,soil_health}.yaml`, `engine/nobetsu/{__init__,config,power,soilgrids,smap,imerg,mock,export,build}.py`, `engine/tests/test_{power,export,contract,soilgrids,imerg,smap,fertilizer,sowing,soil_health}.py`, `data/**`, `web/public/data/**`, `web/src/lib/{types,economics,economics.test,contract.test,fertilizer,fertilizer.test,sowing,sowing.test,soilhealth,soilhealth.test}.ts` |
| İsmail | `web/` altındaki diğer her şey (`package.json`, Vite/Tailwind ayarları, `src/**`, `vercel.json`) |
| Muhammet | `docs/SOURCES.md`, `docs/pitch/**` |
| Biar | `map/**` (3B ilçe haritası, ayrı Vite uygulaması) |
| Herkes | `TASKS.md`, `docs/STATUS.md`, `docs/AI_USE.md` — **sadece kendi başlığının altı** |
| Ekip (değişiklik ekipçe, uygulayan Gümüş) | `docs/PLAN_MVP.md`, `docs/PLAN_EXPANSION.md`, `docs/PROJE_OZETI.md` |

Başkasının dosyasında değişiklik gerekiyorsa kendin yapma; kullanıcıya hangi değişikliğin kime sorulacağını yaz.
Ömer ↔ Gümüş notları: Ömer'in Gümüş'e yazdıkları `docs/GUMUS_BAKMALI.md`, Gümüş'ün Ömer'e yazdıkları `docs/OMER_BAKMALI.md`. Karşı tarafın not dosyasına yazma, sadece kendinde ona ait maddeleri `- [x]` ile işaretle.
İsmail için hazır olanlar ve gösterim kuralları: `docs/ISMAIL_BAKMALI.md` (Gümüş yazar, İsmail işaretler). İsmail web'e başlarken önce bunu okusun.
Yeni bir paket gerekiyorsa: Python → Gümüş (`pyproject.toml`), web → İsmail (`package.json`).

## Görev bitince: TASKS.md'yi işaretle (zorunlu)
Bir `TASKS.md` görevi bittiğinde (testler geçti, kod commit edildi):
1. `TASKS.md`'de **sadece kullanıcının kendi bölümündeki** o satırı `- [ ]` → `- [x]` yap; satır sonuna ` — ✅ HH:MM (<branch>)` ekle.
2. Başka satırları, başka bölümleri, satır sırasını değiştirme.
3. Değişikliği aynı branch'te `tick: <görev kısa adı>` mesajıyla commit et.
4. Yarım kaldıysa işaretleme; satır sonuna ` — ⏳ kalan: <kısa not>` ekle.
5. Hangi AI aracıyla ne yazıldığını `docs/AI_USE.md`'de kullanıcının başlığı altına bir satırla ekle.

## Komutlar
- `make test` — pytest + vitest
- `make mock` — sahte runner ile tüm mock JSON'u üretir
- `make data` — NASA POWER önbelleğinden gerçek JSON'u üretir
- `make web` — web build

## Git
- Branch: `omer/<iş>`, `gumus/<iş>`, `ismail/<iş>`. Küçük PR, en az 2 saatte bir `main`'e merge.
- Merge'den önce `main`'i kendi branch'ine çek, `make test` çalıştır.
