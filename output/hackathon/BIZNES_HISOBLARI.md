# AniqTashxis.ai — pitch uchun tekshirilgan biznes mazmuni

Tayyorlangan sana: **2026-09-19**. Valyuta: **so‘m / UZS**. Quyida amaldagi mahsulot faktlari, tashqi manbalar va rejalashtirish farazlari alohida belgilangan. **MRR ssenariylari haqiqiy mijozlar, tushum, sof foyda yoki va’da qilingan prognoz emas.** Demo klinikalar, sintetik bemorlar va sinov to‘lovlari traction hisoblanmaydi. Haqiqiy pullik mijozlar soni, joriy MRR, retention va CAC bu tekshiruvda tasdiqlanmagan.

## 1. Slayd uchun asosiy biznes tezisi

**AniqTashxis.ai — bemor ma’lumoti, tibbiy tasvir va shifokor xulosasini birlashtiradigan klinik ish maydoni.** Mahsulotning qiymati — manbani topish, klinik ma’lumotni tartiblash, AI bilan solishtirish va qaror tarixini bir joyda yuritish. Xaridor: mustaqil shifokor yoki klinika egasi. Foydalanuvchi: shifokor, radiolog va ekspert.

Nutq uchun: “Shifokor bemorning ma’lumotlarini jamlaydi, o‘z xulosasini kiritadi va dalillarga bog‘langan AI tahlilini ko‘radi. Klinika esa jamoa, kirish huquqlari va obunani bitta kabinetda boshqaradi.”

## 2. Kodda mavjud tariflar va sotib olish yo‘li

| Tarif | Bir kalendar oy | Limit | Limit to‘liq ishlatilganda bir shifokorga / oy |
|---|---:|---:|---:|
| Doctor | **150 000 so‘m** | 1 shifokor | 150 000 so‘m |
| Clinic 10 | **1 390 000 so‘m** | 10 shifokorgacha | 139 000 so‘m |
| Clinic 25 | **2 390 000 so‘m** | 25 shifokorgacha | 95 600 so‘m |
| Individual | Alohida kelishiladi | Kelishuv asosida | [@avilab_uz_support](https://t.me/avilab_uz_support) |

“1 390 000 ming” deb yozilmasin: to‘g‘ri narx **1 390 000 so‘m**. Klinik limit — sotib olingan o‘rinlar sig‘imi; bu faol shifokorlar yoki real mijozlar soni emas. Klinik hisobdagi doctor/radiologist/expert rollari limitga kiradi. Individual tarif ssenariy daromadiga kiritilmagan, chunki narxi kelishilmagan.

**Ishlaydigan sotuv oqimi:** tarif tanlash → hisob → ko‘rsatilgan rekvizitga o‘tkazma → chek yuklash → ariza → developer tekshiruvi → tasdiqdan keyin bir kalendar oylik kirish → klinika jamoasi. To‘lov hozir qo‘lda tekshiriladi; avtomatik ekvayring yoki avtomatik yechish sifatida taqdim etilmasin. Chekning o‘zi bankdagi tushumni isbotlamaydi.

Ichki manbalar: [billing.py — standart tariflar](C:/Users/Lokaydo/Documents/GitHub/Aniq_Tashxis_AI/backend/app/billing.py:26), [obuna qo‘llanmasi](C:/Users/Lokaydo/Documents/GitHub/Aniq_Tashxis_AI/docs/SUBSCRIPTION_GUIDE_UZ.md:5), [billing API](C:/Users/Lokaydo/Documents/GitHub/Aniq_Tashxis_AI/docs/BILLING_API.md:7). Narxlar koddagi default katalog va foydalanuvchi talabi bilan tekshirildi; platforma administratori keyinchalik katalogni o‘zgartira oladi.

## 3. O‘zbekiston bozoridan ikkita rasmiy tayanch raqam

**Slaydda davri aniq yozilsin: “O‘zbekiston, 2024-yil yakuni”. Bu 2026-yil holati yoki mahsulotning TAM hisob-kitobi emas.**

| Ko‘rsatkich | Raqam va davr | Nashr sanasi | Aniq mazmuni |
|---|---|---|---|
| Xususiy shifoxonalar | **1 301 ta**, 2025-01-01 holatiga | 2025-09-12 | Milliy statistika qo‘mitasi xabari aynan xususiy shifoxonalarni sanaydi; barcha ambulator klinika va kabinetlarni emas. |
| Barcha mutaxassislikdagi shifokorlar | **107,5 ming nafar**, 2024-yil yakuni | 2025-09-29 | Oliy tibbiy ma’lumotli, tibbiyot va boshqa tegishli tashkilotlarda ishlovchi shifokorlar; ilmiy, o‘quv va boshqaruv tashkilotlari ham ta’rifga kiradi. |

Manbalar: [Milliy statistika qo‘mitasi — xususiy shifoxonalar](https://stat.uz/en/press-center/news-of-committee/63870-zbekistonda-khususij-shifokhonalar-soni-k-pajmo-da-4), [Healthcare in the Republic of Uzbekistan by the end of 2024 — 5-betdagi shifokorlar ta’rifi va soni](https://stat.uz/img/images/healthcare_p40170.pdf). Ikkalasi 2026-09-19 kuni ochib tekshirildi. PDFdagi 1 301 ko‘rsatkichi “kichik tadbirkorlik subyekti sifatida ishlovchi shifoxonalar” deb berilgan; slayddagi “xususiy” atamasi alohida rasmiy yangilikdan olingan.

Ushbu raqamlar bozor kontekstini beradi. Shifokorlarning hammasi mos xaridor emas; shifoxona soni va shifokor sonini qo‘shib bo‘lmaydi. Narxni 107,5 mingga ko‘paytirib tayyor TAM da’vosi qilinmasin. Hozirgi boshlang‘ich segment — 5–25 shifokorli xususiy klinika jamoalari hamda individual shifokorlar; segmentning aniq soni mijoz intervyusi va tekshirilgan katalog orqali keyin aniqlanadi. Rasmiy katalogdagi ayrim sahifalar 2026-yil sanasini ko‘rsatsa ham, bu paketda ishonchli ochilgan, davri aniq 2024 ko‘rsatkichlari ishlatildi.

## 4. MRR — tahrirlanadigan ssenariylar

**Slayd sarlavhasi:** “Obuna modeli: ssenariy bo‘yicha oylik tushum”. **Slaydda ko‘rinadigan izoh:** “Faraziy mijozlar aralashmasi; amaldagi tushum emas.”

MRR formulasi: `150000 × Doctor soni + 1390000 × Clinic10 soni + 2390000 × Clinic25 soni`. Barcha hisoblar faol va to‘liq to‘lagan obunalar, bir oy va amaldagi katalog narxi farazida. Chegirma, churn, qarzdorlik, qaytarish va soliq ta’siri kiritilmagan. Bu to‘lovlar tarkibidagi QQS yoki buxgalteriya daromadini tasdiqlovchi hisob emas.

| Ssenariy | Doctor soni | Clinic 10 soni | Clinic 25 soni | Pullik hisoblar, jami | O‘rinlar sig‘imi | Faraziy MRR |
|---|---:|---:|---:|---:|---:|---:|
| Boshlang‘ich | 20 | 3 | 1 | 24 | 75 | **9 560 000 so‘m** |
| O‘sish | 100 | 20 | 10 | 130 | 550 | **66 700 000 so‘m** |
| Kengayish | 300 | 60 | 30 | 390 | 1 650 | **200 100 000 so‘m** |

Arifmetika: `3 000 000 + 4 170 000 + 2 390 000 = 9 560 000`; `15 000 000 + 27 800 000 + 23 900 000 = 66 700 000`; `45 000 000 + 83 400 000 + 71 700 000 = 200 100 000`.

Tahrirlanadigan ustunli grafik uchun CSV; pul miqdorlari integer UZS, jadvalni million so‘mda ko‘rsatish uchun 1 000 000 ga bo‘ling:

```csv
scenario,solo_accounts,clinic10_accounts,clinic25_accounts,solo_mrr_uzs,clinic10_mrr_uzs,clinic25_mrr_uzs,total_mrr_uzs
Boshlangich,20,3,1,3000000,4170000,2390000,9560000
Osish,100,20,10,15000000,27800000,23900000,66700000
Kengayish,300,60,30,45000000,83400000,71700000,200100000
```

Grafik uchun tavsiya: uchta to‘plangan ustun, ranglar tariflarga mos. X o‘qi — ssenariy; Y o‘qi — mln so‘m/oy. Oylar yoki sanalar o‘qiga qo‘yilmasin: bu o‘sish prognozi emas.

## 5. Xarajat sezgirligi: foyda qaysi farazga bog‘liq?

**O‘sish ssenariyi uchun rejalashtirish farazlari; haqiqiy sarflar o‘lchanmagan va yetkazib beruvchi taklifi olinmagan.**

- MRR = 66 700 000 so‘m; sig‘im = 550 o‘rin; ulardan 60% faol = **330 shifokor**.
- Har faol shifokorga oyiga 40 ta yakunlangan AI tahlili → **13 200 tahlil/oy**. Bitta “tahlil” — tugallangan klinik yoki tasvir javobi; kadr soni/takroriy urinishlar haqiqiy sarfni o‘zgartiradi.
- Hisoblashning bir tahlilga taqsimlangan xarajati uchun 200 / 500 / 1 500 / 3 500 so‘m variantlari. Bular narx kotirovkasi emas; bandlik, GPU va tahlil uzunligi bo‘yicha sinash uchun qiymatlar.
- Ma’lumot saqlash va zaxira nusxa uchun 10 000 so‘m × 330 faol o‘rin = **3 300 000 so‘m/oy** farazi.
- To‘lov/bank xarajati uchun tushumning 1%i = **667 000 so‘m/oy** farazi. Hozirgi qo‘lda Humo o‘tkazmasi uchun tekshirilgan komissiya sifatida ko‘rsatilmasin.
- Doimiy oylik operatsion budjet = **25 000 000 so‘m** farazi: muhandislik 16 mln, yordam 4 mln, savdo/ma’muriy 4 mln, GPUdan tashqari bazaviy infratuzilma 1 mln. Bular bozor ish haqi statistikasi emas.

| Bir AI tahliliga faraziy xarajat | AI hisoblash / oy | Barcha modelga kiritilgan xarajatlar / oy | Xarajatlardan keyingi shartli qoldiq | MRRga nisbatan |
|---:|---:|---:|---:|---:|
| 200 so‘m | 2 640 000 | 31 607 000 | **35 093 000** | 52,61% |
| 500 so‘m | 6 600 000 | 35 567 000 | **31 133 000** | 46,68% |
| 1 500 so‘m | 19 800 000 | 48 767 000 | **17 933 000** | 26,89% |
| 3 500 so‘m | 46 200 000 | 75 167 000 | **−8 467 000** | −12,69% |

**Bu sof foyda emas.** Soliqlar, ish beruvchi to‘lovlari, klinik validatsiya, huquqiy va axborot xavfsizligi ekspertizasi, apparat xaridi/amortizatsiyasi, kredit/kapital xarajati, qaytarishlar va ayrim bir martalik integratsiyalar alohida budjet talab qiladi. Bir xil xarajat GPU birligi narxida ham, doimiy budjetda ham ikki marta hisoblanmasin. Mahalliy modelda tashqi API to‘lovi bo‘lmasligi hisoblash tekin degani emas.

Hisob: `qoldiq = MRR − 25 000 000 − 3 300 000 − 667 000 − (13 200 × tahlil birligi xarajati)`. Faqat shu farazlar doirasida qoldiq nolga yaqinlashadigan chegara ≈ **2 858,56 so‘m/tahlil**. Bu haqiqiy biznesning break-even nuqtasi emas: kiritilmagan xarajatlar ham qoplanishi kerak.

```csv
cost_per_ai_review_uzs,monthly_ai_cost_uzs,total_modeled_cost_uzs,modeled_residual_uzs
200,2640000,31607000,35093000
500,6600000,35567000,31133000
1500,19800000,48767000,17933000
3500,46200000,75167000,-8467000
```

Slaydga qisqa xulosa: **“Obuna narxi aniq. Keyingi isbot — tahlil tannarxi, yuklama va pullik yangilanish.”** Cheksiz AI tahlili yoki barcha klinikalarga bitta hozirgi kompyuter yetishini va’da qilmang. Tarifga resurs limitini o‘zgartirish hozirgi kod faktlari orasida emas; bu keyingi yuklama o‘lchovi va biznes qarori.

## 6. Mijoz qiymati va qanday o‘lchanadi

| Kim uchun | Mavjud mahsulot qiymati | Pilotda o‘lchanadigan natija |
|---|---|---|
| Shifokor | Qo‘lda yoki hujjatdan klinik ma’lumot; manbalar va shifokor xulosasi; AI bilan solishtirish | Bir holatni tahlilga tayyorlash median vaqti; manbani topish vaqti; qo‘lda tuzatishlar |
| Radiolog | DICOM ZIP, seriya/kadr ko‘rigi, hisobot bilan tasvir tahlili va qamrov ko‘rsatkichi | Yuklash muvaffaqiyati; tasvir ochilish vaqti; tahlil qamrovi; rad etish va tafovutlarni ekspert baholashi |
| Klinika egasi | Jamoa/rollar, obuna holati, nazoratli kirish | Faol foydalanuvchi ulushi; klinika bo‘yicha davomli foydalanish; to‘lovdan keyingi yangilanish |
| Sifat mas’uli/ekspert | Qaror tarixi, dalil va manbaga qaytish | Tekshiruv uchun kerakli materialning to‘liqligi; qayta tekshirish vaqti |

Tejalgan vaqt, xatolar kamayishi yoki aniq tashxis foizi hozircha e’lon qilinmaydi. AI bilan shifokorning mos kelish foizi klinik aniqlikning o‘zi emas. Rasmiy klinik baholash mustaqil etalon va belgilangan qo‘llanish doirasini talab qiladi.

## 7. 90 kunlik GTM/pilot rejasi — taklif, bajarilgan natija emas

| Muddat | Taklif qilinayotgan ish | Qaror uchun dalil |
|---|---|---|
| 1–14 kun | 10 shifokor/klinika egasi intervyusi; 3 pilot nomzodni aniqlash; muammo va to‘lashga tayyorlikni tekshirish | Intervyu xulosalari; ixtisos va ma’lumot formati; hamkorning roziligi; mos qo‘llanish doirasi |
| 15–45 kun | 2 klinikada jami 10 shifokor bilan nazoratli pilot; huquqlar kelishilgan, shaxssizlantirilgan retrospektiv holatlar; maqsad 200 holat | AI ishlatmasdan/ishlatib tayyorlash vaqti; muvaffaqiyatli import; natijadagi dalil havolalari; mustaqil ekspert belgilagan jiddiy xatolar |
| 46–60 kun | Topilgan xatolarni tuzatish; yuklama va tahlil tannarxini o‘lchash; cheklangan doiradagi qayta baholash | p50/p95 javob vaqti; har tahlilga hisoblash sarfi; rad etishlar; xavfsizlik va qo‘llash bo‘yicha qaror |
| 61–90 kun | Tegishli tekshiruvlardan so‘ng rozilik bergan hamkorlarga pullik paket taklifi; o‘qitish va yordam; birinchi yangilanishni kuzatish | Pullik konversiya, haqiqiy MRR, faol shifokorlar, qo‘llab-quvvatlash vaqti, yangilanish sabablari |

200 retrospektiv holat — taklif qilingan dastlabki ish jarayoni piloti hajmi; kam uchraydigan xatolar uchun klinik xavfsizlikni yoki umumiy aniqlikni isbotlamaydi. Real davolash qaroriga avtomatik tatbiq qilish pilot maqsadi sifatida qo‘yilmaydi.

Boshlang‘ich sotuv kanallari: jamoa tomonidan klinikaga bevosita demo, shifokor tavsiyasi, professional hamjamiyatdagi amaliy ko‘rsatish. Bu hujjat hech kimga xabar yubormaydi va hamkorlik tuzilganini anglatmaydi. Pullik reklamaga katta budjet ajratishdan oldin konversiya, yangilanish va xizmat xarajati o‘lchanadi.

Pitch yakuni uchun so‘rov: **“Bizga ikki pilot klinika, mustaqil klinik ekspertlar va xavfsiz hisoblash infratuzilmasi bo‘yicha hamkorlik kerak.”** Bu mavjud hamkorlar haqidagi da’vo emas.

## 8. MedGemma: tijorat va qo‘llash shartlari

Google rasmiy FAQsi HAI-DEF modellarini tijorat mahsuloti yaratishda ishlatish mumkinligini bildiradi; foydalanish Terms of Use va Prohibited Use Policyga bog‘liq. Modellar **open-weight**; barcha model huquqlarini oddiy “Apache 2.0 open-source” deb atash noto‘g‘ri. Apache 2.0 hamroh kodga tegishli. [Rasmiy FAQ](https://developers.google.com/health-ai-developer-foundations/faqs), tekshirildi 2026-09-19.

Shartlarning Distribution ta’rifiga web/API orqali model funksiyasini taqdim etish ham kiradi. 3.1-band keyingi foydalanuvchilarga shartlar nusxasini taqdim etish, foydalanish cheklovlarini tegishli kelishuvlarga kiritish va zarur bo‘lganda sog‘liqni saqlash ruxsatlarini olishni ko‘zda tutadi. Google nomidan tasdiqlangan mahsulot taassuroti yaratilmasin. Tijoriy foydalanishga ruxsat klinik samaradorlik sertifikati emas. [HAI-DEF Terms of Use, 1.1(b), 3.1, 4.2](https://developers.google.com/health-ai-developer-foundations/terms); sahifadagi “Last modified”: 2024-11-15; tekshirildi 2026-09-19.

Mahsulotni real klinik qo‘llashdan oldin tegishli yurisdiksiya, bemor ma’lumoti va ko‘zlangan tibbiy qo‘llanish doirasi mutaxassis bilan tekshiriladi. Yuqoridagilar manba mazmunining qisqa bayoni, huquqiy xulosa emas.

## 9. Slayd muallifi uchun aniq chegaralar

- **Ko‘rsatish mumkin:** ishlaydigan obuna oqimi, uch tarif, rollar, bemor ish jarayoni, lokal MedGemma, tasvir ko‘rigi, qamrov va manbalar; texnik demo natijalari alohida.
- **Faraz deb ko‘rsatish:** ssenariy MRR, xarajatlar, 90 kunlik reja, mijoz tarkibi, kelajakdagi vaqt tejash maqsadi.
- **Tasdiqlanmagan deb aytish:** real traction, aniqlik foizi, klinik sertifikat, barcha DICOM kadrlarini to‘liq tahlil, rasmiy DMED sinxronlash, investitsiya yoki hamkorlar.
- Market kontekstidagi 2024 sana har bir raqam yonida tursin. Hisoblar so‘mda, grafik esa zarur bo‘lsa million so‘mda.

Mashina uchun tayyor ma’lumot: [business-data.json](C:/Users/Lokaydo/Documents/GitHub/Aniq_Tashxis_AI/work/pitch/business-data.json). Barcha summa va ssenariylar dasturiy hisoblanib tekshirildi.
