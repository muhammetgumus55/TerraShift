# Arksus — Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni

> **TASLAK — sürüm `aydinlatma-v1`** · Hukukçu kontrolünden geçmedi. Köşeli parantezli `[…]` yerler doldurulmadan yayınlanmaz.
> Hazırlanırken uyulan kurallar ve açık konular: `docs/legal/README.md`.

---

## Kısaca

- **Hesap açarsan** e-posta adresini ve şifreni alırız. Şifren şifrelenmiş (geri çözülemeyen) halde saklanır; biz de göremeyiz. Adını sormayız.
- **Tarlanın sınırı, ada/parsel numarası ve telefonunun konumu sunucumuza gönderilmez;** sadece senin tarayıcında kalır.
- **Hesabına kaydettiğimiz:** sorulara verdiğin cevaplar, site ayarların ve tarlanın bulunduğu **il ve ilçe**. Böylece bir dahaki girişte kaldığın yerden devam edersin.
- **İlçe bazında ekim istatistiği** ve **dil modeli geliştirme** için verini **sadece ayrıca izin verirsen** kullanırız. İzin vermesen de site aynı şekilde çalışır.
- Hesabını istediğin zaman silebilirsin.

Aşağıda bunların ayrıntısı var.

---

## 1. Veri sorumlusu

6698 sayılı Kişisel Verilerin Korunması Kanunu ("Kanun") kapsamında veri sorumlusu **Arksus ekibidir**. Arksus, NASA Space Apps 2026 kapsamında geliştirilen ve çiftçiye tarlası için ekim önerisi veren bir internet sitesidir (https://arksus.vercel.app). Ekip bir şirket değildir; aşağıdaki ekip üyeleri verilerin işlenmesinden birlikte sorumludur ve başvurunu hangisine yaparsan yap birlikte cevaplanır.

- **Ekip üyeleri:** [Ad Soyad], [Ad Soyad], [Ad Soyad], [Ad Soyad], [Ad Soyad]
- **Ortak başvuru e-postası:** [kvkk@… — ekibin ortak adresi]
- **Tebligat adresi:** [Ekip adına yazılı başvuruların gönderileceği adres]

## 2. Hangi kişisel verilerini işliyoruz?

| Veri türü | Ne | Nereden |
|---|---|---|
| İletişim | E-posta adresin | Hesap açarken sen yazarsın |
| Hesap bilgisi | Şifren (sadece şifrelenmiş, geri çözülemeyen hali), hesabına verilen numara, hesabın açılış ve son giriş tarihi | Hesap açarken sen yazarsın, otomatik |
| Tarla ve tercih bilgisi | Tarlanın bulunduğu il ve ilçe; sulama durumu, toprak derinliği, öncelikler gibi sorulara verdiğin cevaplar; girersen toprak analizi değerlerin; sitenin sana önerdiği ekim sırası ve seçtiğin ürün; site ayarların | Sitede kendin girersin |
| İşlem güvenliği | IP adresi, tarayıcı bilgisi, giriş ve hata kayıtları | Otomatik (barındırma ve veritabanı hizmeti) |
| Onay kayıtları | Hangi metni, hangi sürümüyle, ne zaman okuduğun ya da hangi izni verdiğin/geri aldığın | Sitede kendin işaretlersin |

**İşlemediklerimiz:** Tarlanın sınırı ve haritadaki şekli, ada/parsel numarası, telefonunun konumu, T.C. kimlik numaran, telefon numaran. Tarla sınırını haritada seçtiğinde ya da çizdiğinde bu bilgi sadece tarayıcında kalır; TKGM'den parsel sorgusu da doğrudan senin tarayıcından yapılır ve sonucu bize gelmez.

Özel nitelikli kişisel veri (sağlık, din, biyometrik vb.) işlemeyiz.

## 3. Hangi amaçla ve hangi hukuki sebeple?

| Amaç | Kullanılan veri | Hukuki sebep (Kanun md. 5) |
|---|---|---|
| Hesabını açmak ve giriş yapmanı sağlamak | İletişim, hesap bilgisi | Bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması (md. 5/2-c): sitenin kullanım koşulları |
| Cevaplarını ve ayarlarını saklayıp bir sonraki girişte geri getirmek | Tarla ve tercih bilgisi | md. 5/2-c |
| Siteyi güvenli çalıştırmak, kötüye kullanımı önlemek, hataları bulmak | İşlem güvenliği | Temel hak ve özgürlüklerine zarar vermemek kaydıyla meşru menfaatimiz (md. 5/2-f) |
| Hangi metni okuduğunu ve hangi izni verdiğini kanıtlayabilmek | Onay kayıtları | Hukuki yükümlülük (md. 5/2-ç) ve bir hakkın tesisi, kullanılması veya korunması (md. 5/2-e) |
| Yetkili kurumların kanuna dayanan taleplerine cevap vermek | Talep edilen kadarı | Kanunlarda açıkça öngörülmesi ve hukuki yükümlülük (md. 5/2-a, 5/2-ç) |
| **İlçe bazında ekim istatistiği** (ürün planlamasına katkı) | İl, ilçe, sezon, ekmeyi planladığın ürün, sulama durumu | **Açık rıza (md. 5/1)** — sadece ayrı "Açık Rıza Metni"nde izin verirsen |
| **Dil modeli geliştirme** | Asistana yazdığın sorular, sitedeki cevapların ve sonuçların (adın ve e-postan silinerek) | **Açık rıza (md. 5/1)** — sadece ayrı "Açık Rıza Metni"nde izin verirsen |

Açık rıza gerektiren iki amaç için izin vermezsen ya da izni sonradan geri alırsan siteyi aynı şekilde kullanmaya devam edersin.

## 4. Verilerini nasıl topluyoruz?

Elektronik ortamda, üç yoldan:

1. **Hesap açma:** E-posta adresini ve şifreni hesap açma formuna sen yazarsın.
2. **Site formları:** Sorulara verdiğin cevaplar ve ayarlar, sen kaydettiğinde hesabına yazılır.
3. **Otomatik:** Siteyi kullanırken barındırma ve veritabanı hizmetleri güvenlik için IP adresi ve tarayıcı bilgisini kayda alır.

## 5. Verilerini kimlere aktarıyoruz?

| Alıcı | Neden | Nerede |
|---|---|---|
| Supabase Inc. | Veritabanı ve giriş (kimlik doğrulama) hizmeti; verilerin burada saklanır | Sunucu: Almanya (Frankfurt, AB) |
| Vercel Inc. | Sitenin barındırılması ve sunulması; güvenlik kayıtları | [Bölge doğrulanacak: AB / ABD] |
| Yetkili kamu kurum ve kuruluşları | Kanuna dayanan talep olursa, talep kadarı | Türkiye |

**İlçe istatistikleri:** Açık rıza verdiysen, ekim tercihin başka çiftçilerinkiyle birlikte **ilçe toplamı** olarak sayılır (örnek: "Kaman, 2027 hasadı: buğday 120 tarla, nohut 45 tarla"). Bu toplu sayılar kişiye bağlanamaz; sitede herkese açık gösterilebilir, Tarım ve Orman Bakanlığı, kooperatifler ve araştırmacılarla paylaşılabilir. Bir ilçede [5]'ten az kayıt varsa o ilçenin sayısı gösterilmez. E-postan ya da tek tek kayıtların bu kişilerle paylaşılmaz.

**Yurt dışına aktarım (Kanun md. 9):** Supabase ve Vercel'in sunucuları Türkiye dışındadır; bu nedenle verilerin yurt dışına aktarılır. Bu aktarım için [Kurul'un ilan ettiği standart sözleşme imzalanıp imzadan sonraki 5 iş günü içinde Kişisel Verileri Koruma Kurumu'na bildirilecektir — hukukçu onayıyla tamamlanacak].

## 6. Ne kadar süre saklıyoruz?

| Veri | Süre |
|---|---|
| Hesap, tarla ve tercih bilgisi | Hesabın açık kaldığı sürece. Hesabını silersen [30] gün içinde silinir ya da anonim hale getirilir. |
| İşlem güvenliği kayıtları | [En fazla 1 yıl] |
| Onay kayıtları | İspat için gerektiği sürece, [ilgili zamanaşımı süresi boyunca] |
| İlçe toplamları (anonim) | Kişisel veri değildir; süresiz tutulabilir. |

Süre dolunca veriler, Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik'e göre silinir ya da anonim hale getirilir.

## 7. Hakların

Kanun'un 11. maddesi kapsamındaki haklarına sahipsin. Kısaca: verinin işlenip işlenmediğini ve nasıl işlendiğini öğrenebilir, yanlışsa düzeltilmesini, silinmesini isteyebilir, aktarıldığı kişileri öğrenebilir, otomatik işlemeyle aleyhine bir sonuç çıkmasına itiraz edebilir ve kanuna aykırı işleme nedeniyle zarara uğrarsan giderilmesini isteyebilirsin.

**Nasıl başvurursun?**

- Sitede: **Profil → Hesabımı sil** ile hesabını ve verilerini kendin silebilirsin; **Profil → İzinlerim** ile açık rızanı geri alabilirsin.
- Diğer talepler için: [kvkk@… adresine] e-posta ya da [tebligat adresine] yazılı başvuru. Başvurunda hesabındaki e-posta adresini ve talebini yazman yeterli. Başvurular Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'e göre değerlendirilir.
- Başvurunu en geç **30 gün** içinde ücretsiz yanıtlarız.

---

☐ **Bu aydınlatma metnini okudum ve anladım.**

*Bu kutu bir onay ya da izin değildir; metni okuduğunu kayda almak içindir. İzin gerektiren işlemler için ayrı "Açık Rıza Metni"ne bakınız.*
