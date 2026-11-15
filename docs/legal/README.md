# docs/legal — KVKK metinleri (Gümüş)

Hesap girişi (Supabase, e-posta + şifre; Google kullanılmıyor, 15 Kas kararı) ve ilçe bazında ekim istatistiği için hazırlanan metinler. **İkisi de taslak; hukukçu kontrolünden geçmeden sitede yayınlanmaz.**

| Dosya | Sürüm kimliği | Kullanıcıdan ne alınır |
|---|---|---|
| `aydinlatma-metni.md` | `aydinlatma-v1` | Sadece "okudum ve anladım" (onay değil) |
| `acik-riza-metni.md` | `acik-riza-v1` | İki ayrı, bağımsız, isteğe bağlı izin: `district_stats`, `llm_training` |

Sürüm kimliği değişirse (metin değişirse) kullanıcıya yeni metin bir kez daha gösterilir ve veritabanına yeni sürümle kaydedilir.

## Uyulan kurallar

1. **Aydınlatma ile açık rıza ayrı** (KVKK Kurulu İlke Kararı 2026/347, 18.02.2026, RG 24.03.2026 / 33203): ayrı başlık, ayrı beyan; aydınlatmanın sonunda "okudum ve kabul ediyorum" değil "okudum ve anladım".
2. **Başka hukuki sebep varsa açık rıza istenmez** (aynı karar): hesap, giriş ve kayıtlı cevaplar md. 5/2-c (sözleşme) ile; güvenlik kayıtları md. 5/2-f ile. Sadece ilçe istatistiği ve dil modeli açık rızaya dayanır.
3. **Açık rıza hizmet şartı değil:** izin vermeyen kullanıcı siteyi aynı şekilde kullanır. Kayıt ekranında iki kutu da boş gelir.
4. **Her amaç kendi hukuki sebebiyle** yazıldı ("md. 5 ve 6 kapsamında" gibi genel ifade yok).
5. **Az veri:** sunucuda tarla sınırı, ada/parsel, GPS konumu yok; sadece il + ilçe. Bunlar zaten tarayıcıda (`localStorage`) kalıyor; bu durum kodda değişirse metin de değişmeli.
6. **Site kuralları:** metinde para, fiyat, kâr ve "kesin / mutlaka / yasak / garanti" kelimeleri yok. Kullanıcının istediği "çiftçinin kazancını artırmak" amacı, sitedeki para yasağı nedeniyle "tarlana uygun ekim önerisi" diye yazıldı.
7. Başka şirketin metni kopyalanmadı (Kurul da bunu istemiyor); Corteva Türkiye'nin aydınlatma metni sadece yapı için incelendi.

## Kullanıcının isteğinden farklı olan yer

İstek: "kayıt esnasında kullanıcı KVKK ve aydınlatma metnini onaylaması gerekiyor." 2026/347'ye göre aydınlatma metni **onaylanmaz**; kullanıcı sadece "okudum ve anladım" kutusunu işaretler (girişin şartı bu olabilir). Açık rıza ise **zorunlu tutulamaz**. Kayıt ekranı bu yüzden: aydınlatma (zorunlu "okudum ve anladım") + iki isteğe bağlı izin.

## Açık konular (yayından önce kapanmalı)

- [x] **Veri sorumlusu kim?** Ekip kararı (15 Kas, Gümüş): **Arksus ekibi**, tek bir kişiye indirgenmez; beş üye birlikte sorumlu, ortak başvuru e-postası. Doldurulacak: üyelerin adları, ortak e-posta, tebligat adresi.
- [ ] Ekip tüzel kişi olmadığı için "birlikte veri sorumlusu" yazımının KVKK'da yeterli olup olmadığı hukukçuya sorulacak (Kanun'da müşterek veri sorumluluğu açıkça düzenlenmemiş).
- [ ] **Yurt dışı aktarım (md. 9):** 2024 değişikliğinden (7499 sayılı Kanun, 1 Haziran 2024) beri düzenli aktarımda açık rıza tek başına yetmiyor. Supabase / Vercel için Kurul'un standart sözleşmesi imzalanıp 5 iş günü içinde Kurum'a bildirilmeli. Hukukçuya sorulacak; hackathon süresinde yapılamazsa metindeki köşeli parantez açık kalır ve gerçek kullanıcı verisi toplanmaz (sadece demo).
- [ ] **Vercel bölgesi:** fonksiyon/log bölgesi doğrulanacak (AB mi ABD mi).
- [ ] **Saklama süreleri:** 30 gün (hesap silme), 1 yıl (güvenlik kaydı), onay kayıtları için süre — ekip kararı / hukukçu.
- [ ] **İlçe eşiği:** 5'ten az kayıtlı ilçe gösterilmez (öneri; ekip kararı).
- [ ] **Dil modeli sağlayıcısı:** eğitim kim tarafından, nerede yapılacak? Bilinmeden İzin 2 yayınlanmamalı ya da kapalı tutulmalı.
- [ ] **VERBİS kaydı** gerekip gerekmediği (ölçeğe bağlı) — hukukçu.
- [ ] Aydınlatma metni giriş yapmadan da okunabiliyor (Profil → Aydınlatma metni, `/legal/aydinlatma-metni.md`); ayrı bir `/gizlilik` sayfası istenirse İsmail.

## Veritabanı için (Supabase, sonraki adım)

- `consents(user_id, kind, version, granted, at)` — `kind`: `notice_read` | `district_stats` | `llm_training`; her değişiklik yeni satır (geçmiş silinmez, ispat için).
- `profiles(user_id, prefs, answers, il, ilce, updated_at)` — RLS: sadece sahibi okur/yazar.
- `planting_intents(user_id, il, ilce, harvest_year, crop, irrigation)` — sadece `district_stats` izni varken yazılır; RLS: sahibi; dışarıya sadece eşiği geçen ilçe toplamlarını veren bir görünüm.
- Hesap silme: `auth.users` silinince bu tablolar `on delete cascade`.

## Kaynaklar

- KVKK Kurulu İlke Kararı 2026/347 (açık rıza ve aydınlatma metinleri ayrı düzenlenmeli), haber: https://www.alomaliye.com/2026/03/24/kvkkdan-yeni-ilke-karari-acik-riza-metni-ile-aydinlatma-metni-artik-ayri-duzenlenmeli/ — Kurum'un kendi metniyle doğrulanmalı.
- Yurt dışı aktarım ve standart sözleşme bildirimi (7499 sayılı Kanun): https://www.alomaliye.com/2024/10/30/kvkk-standart-sozlesme-bildirim-modulu/ , https://kvkk.gov.tr/Icerik/7998/Standart-Sozlesme-Metinlerinin-Ingilizce-Cevirisine-Iliskin-Duyuru
- Yapı örneği (tarım şirketi): Corteva Türkiye aydınlatma metni, https://www.corteva.com/tr/aydinlatma-metni.html
