# Sintetik klinika — realistic-workspace-v2

Bu seed ishlayotgan klinikaning o‘quv namoyishini modellashtiradi. Barcha ismlar, klinik epizodlar, klinikalar va to‘lov arizalari to‘qima. Telefon maydonlari bo‘sh: o‘ylab topilgan haqiqiy formatdagi raqam boshqa kishiga tegishli bo‘lishi mumkin.

## Tekshirilgan tarkib

Quyidagi sonlar yangi seed uchun. Login va keyingi amallar audit sonini oshiradi; saqlab qolingan qo‘shimcha developer hisoblari reset manifestida alohida sanaladi.

| Ma’lumot | Soni |
| --- | ---: |
| Asosiy klinikadagi ismli katta yoshli bemorlar | 18 |
| Boshqa tashkilotdagi izolyatsiyalangan bemor | 1 |
| Hisoblar / klinikalar | 12 / 4 |
| Subyektiv, obyektiv, laborator, instrumental, shifokor xulosasi yozuvlari | 90 |
| Manbalar / faktlar (eski tahrir bilan) | 143 / 93 |
| Saqlangan mualliflik solishtirishlari | 45: RU 15, UZ 15, EN 15 |
| Qoidaviy tekshiruvlar | 18 |
| Shifokor izohlari / qoralamalar | 33 / 3 |
| Ogohlantirishlar / javoblar | 9 / 14 |
| Ekspert ko‘riklari | 13 |
| DICOM fantom tadqiqotlari / texnik xulosalar / ko‘riklar | 5 / 5 / 3 |
| Agregat hisobot paketlari | 3 |
| Sintetik obuna arizalari | 3: tasdiqlangan, kutilayotgan, rad etilgan |
| Dastlabki audit hodisalari | 507 |

15 bemorning besh bo‘limi tasdiqlangan va har biri uchun uch tilda joriy versiyaga mos solishtirish saqlangan. Uch bemorda yangi qabul yoki DMED importini tekshirish kutiladi. Izolyatsiyalangan kabinetdagi bemor yangi qabul holatida.

Saqlangan solishtirishlar **MedGemma hisoblamagan, muallif tayyorlagan o‘quv misollari**. API natijasida `provenance=synthetic_seed`, `engine=synthetic_seed/template`, `demo_only=true`, `model_id=synthetic-demo` bor. `language` so‘rovda, snapshotda va natijada saqlanadi. Interfeys ayni tilga mos natijani tanlaydi. Manba iqtiboslari asl ruscha matnda qoladi; sharh tanlangan tilda. Model mavjud bo‘lsa haqiqiy yangi AI tekshiruvi alohida ishga tushiriladi.

Har bir natija manba/xulosa identifikatorlariga bog‘langan. Yetishmayotgan davolash tafsilotlari savol sifatida ko‘rsatiladi. Besh yillik bo‘lim shartli kuzatuv ssenariysi: individual foiz, kafolatli natija yoki tasdiqlangan prognoz berilmaydi. Qoidaviy tarixda laborator birlik tahriridan oldingi eskirgan run ataylab saqlangan; asosiy solishtirishlar joriy bemor versiyasiga tegishli.

## Hisoblar

Yangi seed paroli: `AniqDemo!2026`. Reset mavjud shu email hisobining o‘zgartirilgan parolini va faollik holatini saqlaydi; unda avvalgi parol ishlatiladi. Qo‘shimcha developer parollari o‘zgarmaydi. Eski sessiyalar ko‘chirilmaydi: qayta kirish kerak.

| Hisob | Vazifa |
| --- | --- |
| doctor@demo.aniq | 18 bemor, klinik bo‘limlar, manbalar, uch tilli o‘quv solishtirish va yangi AI so‘rovi |
| radiologist@demo.aniq | 5 biriktirilgan DICOM fantom, 3 tayyor va 2 kutilayotgan ko‘rik |
| expert@demo.aniq | 13 ekspert ko‘rigi va qarorlar tarixi |
| quality@demo.aniq | Sifat ko‘rigi, hisobotlar, audit |
| sender@demo.aniq | Paketni tasdiqlash va mock qabul qiluvchiga yuborish |
| admin@demo.aniq | Klinikadagi 8 a’zo, tizim va audit |
| analyst@demo.aniq | Faqat yuborilgan shaxssizlantirilgan agregat, PDF va JSON |
| owner@demo.aniq | Clinic 10: 3/10 klinik o‘rin, jamoa va obuna |
| owner.pending@demo.aniq | Developer tasdig‘ini kutayotgan klinika/ariza |
| owner.expired@demo.aniq | Obunasi tugagan klinika va rad etilgan ariza |
| developer@demo.aniq | Klinikalar, hisoblar, tariflar, rekvizitlar va arizalarni boshqarish |
| other@demo.aniq | Boshqa tashkilotdagi bitta alohida bemor |

Klinika egasi boshqaruv hisobidir; bemor bilan ishlash uchun shifokor hisobiga kiriladi. Administrator bemor tarixini, tahlilchi esa klinik matnlar va qoralama paketlarni ko‘ra olmaydi. Til va kamaytirilgan animatsiya sozlamalari brauzerda saqlanadi: baza reseti bu tanlovlarni o‘chirmaydi.

## Namoyish yo‘li

Kodlar seed yaratilgan oyga qarab `AT-YYMM-NNN` ko‘rinishida; vaqtlar yaratishdan oldingi kunlarga nisbatan hisoblanadi.

- `001`, `007`, `018`: allergiya va faol buyurishda bir xil modda. Manba iqtiboslari, davolash sharhi va aniqlashtiruvchi savolni oching.
- `002`, `003`, `008`, `011`, `014`: matnli radiologik hujjatlarda tomon farqi; DICOM oynasida geometrik fantom, kesimlar va texnik ko‘rik ishlaydi.
- `004`, `016`: yangi qabul; bo‘limlar qoralama, shifokor tekshirib tasdiqlaydi.
- `005`: gipertenziyani kuzatish, yozilgan amlodipin dozasi, faol qabul, ko‘tara olish va arterial bosim kundaligi mavjud. Davolash sharhi shu kuzatuvlarga mos. Kaliy birligining eski va tuzatilgan versiyalari ham saqlangan.
- `006`: laborator javob dastlabki qarordan keyin kelgan; tarixiy tekshiruv uni avvaldan ma’lum deb hisoblamaydi.
- `009` — Nigora Abdullayeva: musbat MTB/KUM natijalari sil xulosasini qo‘llab-quvvatlaydi. Rifampitsinga chidamlilik topilmagan; to‘liq sezgirlik hali tayyor emas.
- `015` — Kamol Rahmonov: musbat natija allaqachon mavjud bo‘lgandan keyin yozilgan “sil chiqarib tashlandi” xulosasi ataylab zid. Natija laborator manba va shifokor xulosasiga havola qiladi. Natijadan oldingi dastlabki pnevmoniya taxmini xato deb belgilanmaydi.
- `010`: bekor qilingan buyurish amaldagi dori deb talqin qilinmaydi.
- `012`: diabetni kuzatish, metformin dozasi/qabul tartibi, ko‘tara olish, HbA1c dinamikasi va buyrak ko‘rsatkichi mavjud; davolash sharhi ularga tayangan. Alohida tashqi kaliy javobining qachon mavjud bo‘lgani noma’lum, retrospektiv cheklov saqlanadi.
- `017`: DMEDning besh bo‘limli sintetik importi tekshirishni kutadi. Haqiqiy DMED ulanishi yo‘q.
- Developer → arizalar: `owner.pending` klinikasining sintetik chekini oching va tasdiqlang. Egasi hisobida obuna faollashadi; haqiqiy tushum ko‘rsatkichi o‘zgarmaydi.

DICOM — **geometrik fantom**, bemor anatomiyasi yoki patologiyasi emas. Texnik xulosalar buni ochiq aytadi. Matnli KT tavsiflari alohida o‘quv hujjatlari; mos haqiqiy KT yuklangan deb aytilmaydi. Cheklar `SYNTHETIC DEMO - NOT A BANK RECEIPT` va `NO MONEY WAS TRANSFERRED` yozuvli rasmlardir, real to‘lov dalili emas.

Ikki to‘liq davolash tarixi yangi tavsiya emas, sintetik shifokor qaydidir. Doza shakllarining mantiqiyligi AQSh DailyMed rasmiy yorliqlaridagi [amlodipin](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f18148f9-42b2-43dc-9cf8-212d9121dc5f) va [metformin](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=239834b0-121a-4903-b3ee-90bb4db4753b) ma’lumotlari bilan tekshirildi (2026-09-19). Bu O‘zbekiston klinik protokoli yoki individual bemorga buyurish da’vosi emas.

Yuborilgan agregatda beshta ekspert tasdiqlagan holat bor; boshqa ikki paket kichik guruh sonini yashiradi. Paketlar joriy versiyalarga bog‘langan: bemor o‘zgarsa eski paketni yuborish bloklanishi kutilgan himoya.

## Staging, zaxira va reset

Ishlayotgan ilovani o‘zgartirmasdan staging nusxasi yaratish:

```powershell
.\.venv\Scripts\python.exe scripts/reset_demo.py --build-only
```

Almashtirishdan oldin API, Vite va workerlarni to‘xtating:

```powershell
.\.venv\Scripts\python.exe scripts/reset_demo.py --reset-demo
powershell -ExecutionPolicy Bypass -File scripts/start.ps1
```

Skript faqat standart `runtime/aniq.db`, `runtime/files`, `DEMO_MODE=true` profili bilan ishlaydi. Avval staging baza/fayllari yaratiladi. Manba SHA-256, iqtiboslar, versiyalar, solishtirish sxemasi/havolalari, hisobot xeshlari, chek fayllari va tashqi kalitlar tekshiriladi.

Mavjud demo email hisoblarining parol xeshlari/faolligi, qo‘shimcha developer hisoblari, tariflar va ochiq to‘lov konfiguratsiyasi stagingga saqlanadi. Zarur developerga tegishli klinika konteynerigina ko‘chishi mumkin. Boshqa eski klinikalar, mijoz/shifokor hisoblari, tarix, sessiyalar va arizalar faqat zaxirada qoladi.

Keyin SQLite yaxlitligi va WAL checkpoint tekshiriladi. Eski baza/fayllar birga `runtime/backups/<UTC-vaqt>/` ga ko‘chiriladi, yangi juftlik aktivlashtiriladi. Aktivlashtirish xatosida eski juftlik qaytariladi. Manifest `counts` va `preserved` sonlarini saqlaydi; parol/token chiqarmaydi. Model fayllari, lokal model kaliti va `.env` o‘zgarmaydi.

Tiklash: xizmatlarni to‘xtating, joriy `aniq.db`, mavjud WAL/SHM va `files`ni xavfsiz boshqa papkaga o‘tkazing; tanlangan bitta zaxiradagi `aniq.db` va `files`ni birga qaytaring. Turli zaxiralarning bazasi/fayllarini aralashtirmang.

Oddiy start mavjud hisobni topsa, seedni takrorlamaydi. `SEED_PROFILE=minimal` kichik regressiya testlari uchun, odatiy demo esa `realistic`.

## Tekshiruv

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests/test_realistic_seed.py -q
```

12 izolyatsiyalangan test manba/versiyalar, barcha rollar, tashkilot izolyatsiyasi, besh klinik bo‘lim, uch tilli joriy solishtirish, to‘liq yozilgan ikki davolash sxemasiga mos sharh, TB natijasi xulosadan oldin mavjudligi, DICOM fayllari, ekspert/sender jarayoni, egasi/developer obuna tasdig‘i, resetning kirish/configuratsiyani tarixsiz saqlashi va yangi subprocessda barcha jadvallar yaratilishini tekshiradi. Ular vaqtinchalik bazada ishlaydi; real xizmatga tegmaydi. Bu dasturiy izchillik tekshiruvi, klinik samaradorlik isboti emas.
