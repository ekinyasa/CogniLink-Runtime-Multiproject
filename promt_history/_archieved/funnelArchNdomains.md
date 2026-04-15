1. Domain mimari

niluferormanli.com      → authority / brand site  
niluferormanli.studio   → campaign router traffic entry point

traffic
→ .studio (router) traffic entry point
→ kartra landing 
→ email capture
→ checkout


2. GA4
1 property
2 stream


Property:
GA4 Property
Name: Nilufer Ormanli

stream 1
Web stream
domain: niluferormanli.com

Stream2
Web stream
domain: niluferormanli.studio


User Movement:
instagram → niluferormanli.studio/nb → kartra page (niluferormanli.com)

1. User visits niluferormanli.studio (campaign entry point)
2. User is redirected to kartra landing page
3. User captures email
4. User proceeds to checkout

GA bunu tek kullanıcı olarak görür.

3. Cross-domain tracking gerekir
Admin
→ Data Streams
→ Web
→ Configure tag settings
→ Configure your domains
niluferormanli.com
niluferormanli.studio

_router → kartra geçişinde session kırılmaz.

4. Meta Pixel (tek pixel)

hem .studio .com domainlerinde tek pixel kullanılır.
Meta attribution şöyle çalışır: click → pixel → conversion

Eğer iki pixel kullanırsan:
router click
conversion
eşleşmeyebilir


5. Domain verification (Meta)
Meta Business Manager > domain
niluferormanli.com
niluferormanli.studio

primary domain > niluferormanli.com -> çünkü checkout orada.

6. Analytics perspektifinden router
Şu önemli:
.studio sadece redirect yapıyorsa: pageview sayılmaz
Ama senin router: hub render ediyor (yani .studio pageview)
Çünkü artık şunu ölçebilirsin: alias performance

7. Campaign OS + GA

Bu noktada GA eventleri şöyle olacak:
page_view
alias_click
hub_click

ve UTM zaten geliyor:
utm_source
utm_medium
utm_campaign
Bu çok güçlü attribution verir.


8. Stream sayısı Benim önerim:
Property: 1
Streams: 2

niluferormanli.com
niluferormanli.studio

9. İleri seviye (sonra)

Senin sistem büyüdüğünde şu olur:
campaignOS analytics
+
GA
+
Meta

CampaignOS şunu ölçer:
alias performance
experiment routing
traffic weighting

GA:
session
user
conversion

10. Küçük ama kritik öneri

Router’a şu event’i ekle: alias_resolved
Event parametreleri: 
alias
campaign
slug
modifier

11. Kartra tarafı

Kartra’da zaten olacak:
checkout
email capture
membership

yani funnel:
router (.studio)
↓
kartra landing (.com)
↓
checkout

12. En kritik soru
Sen şu anda çok doğru bir noktaya geldin.

Asıl soru şu:

Hub mı kullanacaksın yoksa direct funnel mı?


Şimdi biraz büyüteci çıkaralım. Funnel mimarisi dediğin şey aslında “insanı nereye indirdiğin” değil, insanın o linke tıkladığında zihinsel olarak nerede olduğu ile ilgili. Aynı /nb linki bazen doğrudan satışa gönderilmelidir, bazen de bir hub’a. Tek doğru cevap yok; doğru cevap trafik kaynağı + niyet kombinasyonuna bağlıdır.

İnsan niyeti (intent) katmanı

Bir kişi linke tıkladığında üç olası zihinsel durumdan birindedir:
	1.	Merak / keşif
“Bu kişi kim? Ne yapıyor?”
	2.	İlgi / değerlendirme
“Belki bana faydalı olabilir, bakayım.”
	3.	Karar / aksiyon
“Bunu almak veya katılmak istiyorum.”

Funnel mimarisi bu üç seviyeyi hesaba katmadan kurulursa dönüşüm düşer. O yüzden tek bir akış yerine, niyete göre ayrışan akış kurmak gerekir.

Hub vs Direct landing

Hub sayfası şu durumda işe yarar:
	•	Trafik soğuksa (IG bio, podcast dinleyicisi, Spotify, YouTube açıklaması)
	•	İnsan seni ilk kez görüyorsa
	•	Tek bir teklif yerine birkaç farklı giriş kapın varsa

Direct landing ise şu durumda daha güçlüdür:
	•	Trafik niş ve sıcaksa (reklam, belirli içerik sonrası CTA)
	•	İnsan zaten “bu eğitimi görmek istiyorum” gibi net bir beklentiyle geliyorsa
	•	Tek bir ürün / kampanya satılıyorsa

Bu yüzden çoğu growth ekibi şöyle bir model kurar:
IG bio → hub
ads → direct landing
email → direct landing

Aynı kampanyanın farklı girişleri olur.

Campaign OS burada ne sağlar?

Normalde platformlar bunu yapmakta zorlanır çünkü her şey tek sayfaya bağlıdır. Ama sen router yazdığın için link davranışını kontrol edebilirsin.

Mesela: /nb

router şunu yapabilir:
	•	Instagram → hub
	•	reklam → direct landing
	•	email → webinar sayfası

Yani link aynı kalır, routing değişir. Bu Campaign OS’un en büyük gücü.

Pratik mimari örneği

Nilüfer’in işine uyarlayalım. Diyelim ki ana teklif:
	•	Voice Architecture programı
	•	retreat
	•	1-1 session

Hub sayfası şöyle olabilir:

/nb
→ voice architecture
→ free meditation
→ retreat
→ newsletter

Ama reklam kampanyası:
/nb/vsl
→ video sales letter
→ checkout

email kampanyası:
/nb/waitlist
→ waitlist page

İnsanlar farklı niyetle gelir; router onları uygun sayfaya indirir.

Doğrudan satış ne zaman mantıklı?

Eğer trafik şu kaynaktan geliyorsa:
	•	hedefli Meta reklamı
	•	belirli bir YouTube videosu
	•	email sequence

o zaman:/nb
→ direct sales page

daha iyi çalışır. Çünkü kişi zaten “ürün” bağlamında gelmiştir.

Hub’ın gerçek görevi

Hub aslında bir micro-homepage’dir. Ama sadece kampanya bağlamında.

Yani:
brand homepage = otorite
hub = conversion gateway

Homepage insanlar için; hub trafik için.

Senin kurduğun sistemin avantajı

Campaign OS sayesinde şu mümkün oluyor:
	•	linki değiştirmeden funnel değiştirmek
	•	farklı trafik kaynaklarına farklı sayfa göstermek
	•	experiment yapmak (A/B routing)

Bu çoğu platformda yoktur; o yüzden router katmanı büyüme ekipleri için altın değerindedir.

O yüzden doğru cevap

“/nb direkt satışa mı gitmeli?” sorusunun cevabı:

Bazen evet, bazen hayır.

Ama iyi mimaride şöyle olur:


/nb → hub (default)
/nb/offer → sales
/nb/vsl → sales video
/nb/waitlist → lead capture

Sonra router gerekirse /nb’yi de satış sayfasına yönlendirebilir.

Küçük stratejik not

Bir marka büyürken genelde şu evreleri geçer:
	1.	hub ağırlıklı (keşif)
	2.	funnel ağırlıklı (satış)
	3.	routing + experiment (optimizasyon)

Sen şu anda 3. evreyi kuruyorsun.

İstersen bir sonraki adımda sana Nilüfer için gerçekten çalışan bir somut funnel haritası çizebilirim:
trafik kaynakları → router → sayfa tipleri → email sequence. Bu noktada Campaign OS’un gücü daha net görünür.






Başlangıç noktası: Nilüfer’in markası çok katmanlı bir değer sunuyor. İnsanlar tek bir nedenle gelmiyor. Bazıları sesi merak ediyor, bazıları meditasyon, bazıları terapi yaklaşımı, bazıları eğitmenlik programı. Bu yüzden klasik tek ürün funnel’ı çoğu zaman dar kalır.

O yüzden sistem şu mantıkla kurulur:

Trafik kaynakları → Campaign OS router → uygun giriş sayfası → email / topluluk → satış.

İlk katman trafik kaynaklarıdır. İnsanlar farklı niyetlerle gelir. Bu niyetleri dört ana gruba ayırabilirsin.

Instagram bio ve sosyal medya profil linkleri.
YouTube ve podcast içerikleri.
Reklam kampanyaları.
Email listesi veya mevcut takipçiler.

Bu dört kaynak aynı sayfaya gitmemelidir çünkü niyetleri farklıdır.

Instagram bio ve sosyal medya genelde “merak” seviyesindedir. İnsan seni yeni keşfetmiştir. Onları doğrudan satış sayfasına göndermek çoğu zaman dönüşümü düşürür çünkü bağ kurma fırsatı yoktur. Bu trafik için en doğru giriş bir “campaign hub” sayfasıdır. Bu sayfa mini bir ana sayfa gibidir ama sadece kampanya bağlamında çalışır. Burada üç ya da dört net giriş olur: program hakkında bilgi, ücretsiz bir deneyim (meditasyon veya kısa pratik), retreat veya etkinlikler ve email listesine katılma. Bu sayfa insanın kendi yolunu seçmesini sağlar.

YouTube veya podcast gibi içerik trafiği genelde biraz daha sıcak olur. İnsan seni en az birkaç dakika dinlemiştir. Bu durumda hub sayfası yerine çoğu zaman tek bir “derin içerik sayfası” daha iyi çalışır. Bu bir video sales letter, bir workshop sayfası veya bir program tanıtım sayfası olabilir. Yani burada kullanıcı zaten belirli bir temaya gelmiştir.

Reklam trafiği en net olandır. Reklam her zaman belirli bir teklif üzerine kurulur. O yüzden reklamdan gelen insanı hub’a göndermek çoğu zaman gereksizdir. Reklam → doğrudan landing page → email capture veya satış sayfası şeklinde çalışır. Reklam funnel’ı mümkün olduğunca kısa olmalıdır.

Email trafiği en sıcak trafiktir. Bu kişiler zaten seni tanıyordur. Onları hub sayfasına göndermek genelde anlamsızdır çünkü seçim yapmaya ihtiyaçları yoktur. Email linkleri çoğu zaman doğrudan program sayfasına, webinar sayfasına veya checkout’a gider.

Campaign OS burada devreye girer çünkü tüm bu akışı tek link üzerinden kontrol etmeyi mümkün kılar.

Mesela Instagram bio’daki link /nb olabilir. Bu link Campaign OS tarafından yönetilir. Varsayılan durumda bu link hub sayfasına gider çünkü Instagram trafiği çoğunlukla keşif aşamasındadır. Ama aynı link farklı bağlamlarda farklı sayfalara yönlendirilebilir. Örneğin bir kampanya döneminde /nb doğrudan program sayfasına yönlendirilebilir. Ya da bir lansman haftasında /nb bir webinar kayıt sayfasına gidebilir.

Modifier routing burada önemli hale gelir. Aynı kampanya için farklı giriş kapıları oluşturabilirsin. Örneğin /nb ana hub sayfasına gider. /nb/vsl video satış sayfasına gider. /nb/waitlist bekleme listesi sayfasına gider. /nb/retreat retreat sayfasına gider. Bu sayede tüm kampanya tek bir kökten yönetilir ama farklı yolları vardır.

Nilüfer için pratik bir yapı şöyle olabilir.

Ana marka sitesi niluferormanli.com olur. Bu site daha çok marka ve hikaye tarafıdır. İnsanlar burada Nilüfer’i tanır, yazıları okur, yaklaşımı öğrenir. Bu site SEO ve güven katmanı gibi çalışır.

Campaign OS domaini niluferormanli.studio olur. Bu domain tüm trafik girişlerini yönetir. Instagram bio, podcast açıklamaları, YouTube linkleri ve diğer tüm kampanya linkleri buradan geçer.

Instagram bio’daki link niluferormanli.studio/nb olur. Bu link hub sayfasını açar. Hub sayfasında dört ana seçenek vardır: Voice Architecture programı, ücretsiz meditasyon veya pratik, retreat veya etkinlikler ve email listesine katılma. Bu sayfa insanın Nilüfer dünyasına girdiği kapıdır.

Program sayfası kartra üzerinde olabilir çünkü Kartra email otomasyonu ve checkout tarafında güçlüdür. Yani hub → Kartra landing page → email capture veya checkout akışı kurulabilir.

Reklam kampanyaları ise doğrudan belirli landing sayfalarına gider. Örneğin bir reklam kampanyası /nb/vsl linkini kullanabilir. Bu link doğrudan video sales letter sayfasına yönlendirir. Böylece reklamdan gelen kişi hub ile oyalanmaz.

Email listesine gönderilen linkler genelde /nb/offer veya doğrudan program sayfasına gider. Çünkü email trafiği zaten sıcak trafiktir.

Bu sistemin büyük avantajı şudur: linkleri değiştirmeden funnel’ı değiştirebilirsin. Diyelim ki Instagram bio’daki /nb linki şu anda hub sayfasına gidiyor. Ama bir lansman haftasında bunu doğrudan satış sayfasına yönlendirebilirsin. Ya da bir süre sonra ücretsiz meditasyon sayfasına yönlendirebilirsin. Bu tamamen router seviyesinde değişir.

Campaign OS’un gerçek gücü burada ortaya çıkar. Linkler sabit kalır ama arkasındaki funnel değişebilir. Trafik kaynağına göre farklı sayfalar gösterilebilir. Hatta ileride A/B routing eklediğinde aynı link farklı kullanıcılara farklı sayfalar gösterebilir.

Bu yüzden doğru funnel mimarisi şu şekilde özetlenebilir: brand site güven ve hikaye için vardır, campaign router tüm trafiğin giriş kapısıdır, hub sayfası keşif trafiğini karşılar, direct landing sayfaları sıcak trafiği yakalar, email ve checkout sistemleri Kartra gibi platformlarda çalışır.

Yani kısaca: homepage marka içindir, hub trafik içindir, funnel satış içindir ve router hepsini yöneten katmandır.