Test 1 — Campaign Edit Panel Hydration

Steps:
	1.	Open admin panel.
	2.	Go to Campaigns tab.
	3.	Refresh the page.
	4.	Click Edit on a campaign.

Expected:
	•	alias field shows stored alias OK
	•	defaultSlug selector is visible OK
	•	correct slug is selected (NO - selectler option olarak slugları çekemiyor compile problem olma ihtimali var compile sonrası göreceğız)
	•	selector does not disappear after refresh OK

Pass condition:
selector visible PASS
correct slug selected NO not possible
no UI flicker PASS

Campaigns panelinde istedigim gibi olmayan - dogru uygulanmayan degisiklikler:

kampanyaya tıklayınca acilan slug index url'i: https://links.niluferormanli.studio//nilufer/campaign/bpre22-testb olmalı ve sadece admin gorebilmeli  (su an halaa https://links.niluferormanli.studio/campaign/bpre22-testb ve public)

bu compile meselesini su baglamda anlamam lazim, sadece deployement sonrasi bir kere yaparsam ortada bir sorun yok mu yoksa yeni slug ve veya kampanya olusturduktan sonra da bir problem cikarmasi mumkun mu? bu butonun bize faydasi ne zarari ne? biz bunu en basta test icin icat ettik simdi sanki isleri zorlastirmaya basladi

simdi defult slug testlerini yapmak icin compile'a tiklamak zorundayim cunku (sanirim baglantili) defult slug selectleri bos (hepsinde sadece first active slug secenegi var)

after compile now:
Result	✓ Success
Routes compiled	19
Routes written	19
Campaign aliases	9
Slug aliases	10
Errors	0
Skipped	0
Duration	913 ms
✓ Routing is now active.

ama compile sonrasi da compile + refresh sonrasi da defult redirect slug secenekleri gelmedi - demek ki baska bir sorun var

Test 2 — defaultSlug Persistence ve Test 3 — Alias Redirect Update

test gerceklestirilemiyor, sluglar select icine option olarak cekilemiyor

⸻

bu durumda yeni test adımi ekledim
create new:
campaign: p22-test-1 alias: p22t1
slug: p22-test-1-igbio alias: 22ibio
slug2: p22-test-1-fbpost alias: 22fp


campaign tab'da simdi sadece yeni kampanyaya ait Default redirect sluglar degil tümü çekilebildi. 

bu önemli bir bug. yeni kampanya üretilmeden bu özellik çalısmiyor.. cc'a bunu sadece duzelt demeyelim bunun sebebi neydi diye de soralim cunku ayni sebep baska sorunlara da yol acabilir ya da yakalamadigimiz sorunlara su an da yol aciyor olabilir.. 

simdi tekrar atladigim test adimlari 2-3'u deniyorum:

Test 2 — defaultSlug Persistence

Steps:
	1.	Edit campaign
	2.	change defaultSlug (once change degil set ediyorum: p22t1 defult:fb save \ p22tt zaten igbio olarak ayarli)
	3.	Save
	4.	refresh page

    sonuc: 
    admin panelde: gene tum optionlar kayboldu (select elementleri ui'de yerinda ancak içlerinde optionlar çekilemiyor hepsinde sadece ilk secenek olarak first active slug var)

    hard refreash, sonuc ayni no option


    son ayarlar gecerlimi diye bakıyorum 

    https://links.niluferormanli.studio/p22t1 ilk link: https://niluferormanli.com/?utm_campaign=p22-test-1&utm_content=primary_official *fb parametresi yok 
    
    https://links.niluferormanli.studio/p22tt link: https://niluferormanli.com/?utm_source=instagram&utm_medium=bio&utm_campaign=pre22-test&utm_content=primary_official *igbio parametresi yok 
⸻

Test 3 — Alias Redirect Update
optionlar kayboldu test gerceklestirilemiyor

⸻

Test 4 — Alias Change

Steps:
	1.	edit campaign 
	2.	change alias p22t1 to p22t1new
	3.	Save

    https://links.niluferormanli.studio/p22t1new link: https://niluferormanli.com/?utm_source=instagram&utm_medium=bio&utm_campaign=p22-test-1&utm_content=primary_official



alias works immediately. OK

⸻

Test 5 — Diagnostics Background Test
sonuçlanması 01:53.9 sürdü

Background test error: The string did not match the expected pattern. dedi

Total runtime should stay under ~120 seconds.

NOT unutma da bunun gibi baattıktan sonra bir zaman alan ve bir zaman bekledikten sonra sessizce sonuclanan testlere bittiklerinde sakin minimal rahatsiz etmeyen bir bip sesi koyalım. 

o arada insan yazı yazmaya filan dalıp ne zaman bittiğini ne kadar gectigini kacirabiliyor

timer güzel çalısiyor onu da test etmis oldum.
⸻

Test 6 — Telemetry Consistency
11 kere hellokitty alias url'ine tkladim 50sn'de
CLICKS BY ALIAS +1
recente gelen tek kayıt 
3/9/2026, 7:12:54 PM	hellokitty	hello-story-swipe	—	—

3.14 bekledim sonuc değismedi
⸻

Test 7 — Version Indicator

Steps:
	1.	deploy build
	2.	open admin panel

Expected:
Studio Panel vX · <commit> -> git commit değil ama claudflaire deploy yazmis (giti dinamik cekemedi herhalde ama it workss no matter.. im happy with it)

Version must match deployment metadata.
PASS
⸻

