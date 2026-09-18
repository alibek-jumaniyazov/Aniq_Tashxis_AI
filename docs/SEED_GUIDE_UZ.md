# Hayotiy sintetik demo — realistic-v1

Bu seed klinikaning davom etayotgan ishini modellashtiradi. Barcha shaxslar va klinik epizodlar to‘qima. Manba fayllari, saqlangan faktlar, versiyalar, ruxsatlar va ish jarayonlari haqiqiy API orqali ishlaydi.

## Tarkibi

| Ma’lumot | Soni |
| --- | ---: |
| Klinik holatlar | 18 |
| Klinikadagi rollar / hisoblar | 7 |
| Manbalar, shu jumladan sintetik DMED yozuvi | 58 |
| Faktlar, eski tahrir bilan | 93 |
| Shifokor izohlari / shaxsiy qoralamalar | 33 / 3 |
| Saqlangan qoidaviy tahlillar | 18 |
| Ogohlantirishlar / ularga javoblar | 9 / 14 |
| Ekspert ko‘riklari | 13 |
| DICOM seriyalari / saqlangan ko‘riklar | 5 / 3 |
| Hisobot paketlari | 3 |
| Boshlang‘ich audit hodisalari | 277 |

Alohida tashkilotda yana bitta izolyatsiyalangan hisob va holat bor: boshqa tashkilot ma’lumotlari odatiy rollarga ko‘rinmasligi tekshiriladi. Jadvaldagi tahlillar qoidaviy natijalardir; seed MedGemma matnini to‘qimaydi. Haqiqiy AI chaqiruvlari bajarilganda tahlil va audit sonlari ortadi.

## Hisoblar va namoyish yo‘li

Umumiy demo parol: `AniqDemo!2026`.

| Hisob | Xodim | Tayyor ish oqimi |
| --- | --- | --- |
| doctor@demo.aniq | Aziza Karimova | 18 holat; tasdiqlanmagan faktlar, manbalar, tuzatishlar, izohlar, AI chaqiruvi |
| radiologist@demo.aniq | Timur Rahimov | Faqat 5 biriktirilgan holat; 2 kutilayotgan va 3 qayd etilgan ko‘rik |
| expert@demo.aniq | Malika Yusupova | 13 ko‘rik; ko‘rilayotgan, izoh kutilayotgan, tasdiqlangan va yopilgan qarorlar |
| quality@demo.aniq | Sardor Aliyev | Ekspert qarorlari, yangi hisobot tayyorlash va audit |
| sender@demo.aniq | Dilnoza Saidova | Qoralamani tasdiqlash; tasdiqlangan paketni mock qabul qiluvchiga yuborish |
| admin@demo.aniq | Bekzod Nurmatov | Jamoa ro‘yxati, rol taqsimoti, tizim holati va xodim nomlari bilan audit |
| analyst@demo.aniq | Nodira Usmanova | Faqat yuborilgan shaxssizlantirilgan agregat, PDF va JSON |

Login qilganda rolga mos bosh sahifa ochiladi. Ruxsat berilmagan URL interfeysda mos bo‘limga qaytaradi; API ham o‘z ruxsat tekshiruvini bajaradi. Administrator klinik holatlarni o‘qiy olmaydi; tahlilchi identifikatorlar, klinik matnlar va qoralama paketlarni olmaydi.

## Tavsiya etilgan epizodlar

Kodlar seed yaratilgan yil/oyga qarab `AT-YYMM-NNN` ko‘rinishida yaratiladi. Sana-vaqtlar ishga tushirish vaqtidan oldingi 12 kun bo‘ylab tarqatilgan.

- `004`, `016`: yangi qabul. Tasdiqlanmagan faktni manba bilan tekshirib tasdiqlang. Izoh oynasida avvalgi shaxsiy qoralama tiklanadi.
- `001`, `007`, `018`: allergiya va tayinlovdagi bir xil modda. Manba havolalari, ogohlantirish holati va shifokor javoblarini oching.
- `002`, `003`, `008`, `011`, `014`: tomon haqidagi ikki matn farqlanadi. Rentgenologda DICOM oynasi avtomatik ochiladi; mavjud ko‘riklar tarixi va yangi izoh saqlash ishlaydi.
- `005`: laboratoriya birligi tuzatilgan. Eski fakt saqlangan, yangi fakt unga `supersedes` bilan bog‘langan; eski tahlil eskirgan deb belgilanadi.
- `006`: laboratoriya natijasi qaror vaqtidan keyin kelgan. Joriy va tarixiy tahlilda tekshiruv qamrovi farq qiladi.
- `010`: tayinlov bekor qilingan; faol tayinlovga oid ogohlantirish chiqarilmaydi.
- `012`: manbaning qachon ma’lum bo‘lgani noma’lum; tarixiy tekshiruv cheklovni saqlaydi.
- `017`: sintetik DMED importi va tasdiqlash kutilayotgan ma’lumotlar.

Yuborilgan paketda beshta ekspert tasdiqlagan holat agregati bor. Qolgan ikki paketda kichik guruh soni yashirilgan. Qoralama va tasdiqlangan paketlar joriy holat versiyalariga bog‘langan, ularni davom ettirish mumkin. Holatni o‘zgartirsangiz, eski paketni yuborish bloklanishi — versiya himoyasining kutilgan ishlashi.

DICOM fayllari geometrik sintetik fantom: bemor anatomiyasi yoki klinik KT xulosasi sifatida ko‘rsatilmaydi. Matnli rentgenologik manbalar alohida hujjat ssenariysi hisoblanadi. DMED va tashqi qabul qiluvchi demo bo‘lib qoladi.

## Tozalash va qayta yaratish

API, Vite va workerlarni to‘xtatib, loyiha ildizida:

```powershell
.\.venv\Scripts\python.exe scripts/reset_demo.py --reset-demo
powershell -ExecutionPolicy Bypass -File scripts/start.ps1
```

Skript faqat standart `runtime/aniq.db` + `runtime/files` va `DEMO_MODE=true` profilida ishlaydi. Avval alohida staging bazada seed yaratadi va manba SHA-256, bog‘lanishlar, versiyalar hamda hisobot xeshlarini tekshiradi. So‘ng SQLite yaxlitligi va WAL checkpointini tekshirib, mavjud baza/fayllarni birgalikda zaxiraga ko‘chiradi. Aktivlashtirish xatosida eski fayllarni joyiga qaytaradi. Model vaznlari, lokal model kaliti va `.env` o‘zgarmaydi.

Zaxira manzili terminalda va `runtime/seed-manifest.json` da saqlanadi. Tiklashda barcha API/workerlarni to‘xtating, joriy `aniq.db`, mavjud `aniq.db-wal`, `aniq.db-shm` va `files` ni boshqa xavfsiz papkaga o‘tkazing; tanlangan zaxiradagi `aniq.db` va `files` ni juft holda `runtime/` ga qaytaring. Turli zaxiralarning bazasi va fayllarini aralashtirmang. Qayta ishga tushirgandan keyin login qiling.

Oddiy server ishga tushishi mavjud foydalanuvchilarni aniqlasa, seedni takrorlamaydi. `SEED_PROFILE=minimal` faqat kichik regressiya testlari uchun; odatiy qiymat `realistic`.

## Tekshiruv

`backend/tests/test_realistic_seed.py` barcha rol chegaralari, tashkilot izolyatsiyasi, haqiqiy fayllar va iqtiboslar, o‘zgarmas eski faktlar, retrospektiv tahlil, ekspert qarori, sender tasdig‘i/yuborishi, PDF/JSON xeshlari va DICOM ko‘riklarining saqlanishini tekshiradi. Bu muhandislik tekshiruvlari; klinik sifat da’vosi emas.

Asosiy ilova ishga tushganda `frontend/` ichida `npm.cmd run test:seed` yetti rolni real brauzerda ochadi: Uzbek interfeys, rol bosh sahifasi, tayyor ma’lumot, DICOM ko‘rigi, agregatning maxfiyligi va 390 px telefon ko‘rinishi tekshiriladi. Bu testlar klinik yozuvlarni o‘zgartirmaydi; login va kirish auditi yoziladi. Oddiy `npm.cmd run test:e2e` esa izolyatsiyalangan kichik test bazasida yaratish/tasdiqlash/yuborish amallarini bajaradi.
