# Kod refaktori va ekspert tekshiruvi

2026-09-19 kungi refaktorning birinchi mezoni — mavjud bemor, AI, radiologiya va obuna oqimlarini saqlash. Ikkinchi mezon — kodning mas’uliyatlari tushunarli ajratilishi va bir xil avtomatik sifat nazoratidan o‘tishi. Bu hujjat ekspertga o‘zgarishlarni tekshirish uchun yo‘l xaritasini beradi.

## Nima o‘zgardi va nima uchun

| Qism | Yakuniy tuzilma | Amaliy foyda |
| --- | --- | --- |
| Bemor oynasi | `CasePage.tsx` sahifani yig‘adi; `patient/` forma, hujjat importi, manba oynasi, tarix va natijani ajratadi | Bitta forma tuzatishida butun bemor sahifasini o‘qish talab qilinmaydi |
| AI solishtirish | `useClinicalComparison` tayyorlik, so‘rov, til, tanlangan natija, retry/cancel va umumiy blokirovkani boshqaradi | Yuqori tugma va bo‘limdagi tugma bir xil amaldan foydalanadi; ikki marta yuborishdan himoya umumiy |
| Klinik AI backend | `clinical_comparison/models.py`, `prompts.py`, `grounding.py`; `patient_workspace_ai.py` orkestratsiyani saqlaydi | Natija sxemasi, vazifa matni va dalil validatsiyasi transport bilan aralashmaydi |
| Obuna backend | `billing_checkout.py`, `billing_registration.py`, `billing_team.py`, `billing_developer.py` | Mijoz arizasi, klinika jamoasi va developer vakolatlari alohida ko‘rinadi |
| Developer interfeysi | `developer/` ichida arizalar, klinikalar, foydalanuvchilar, tariflar, to‘lov rekvizitlari va chek preview modullari | Har bir boshqaruv oynasining formasi va so‘rovlari yonma-yon, sahifa esa navigatsiyani yig‘adi |
| Kod uslubi | Ruff + Prettier + EditorConfig + LF qoidalari | Katta bir qatorli JSX/Python bloklari o‘qiladigan shaklga keldi; keyingi o‘zgarishlar avtomatik tekshiriladi |
| API nazorati | `export_openapi.py --check` | Tekshiruv saqlangan API shartnomasini qayta yozmaydi; kutilmagan o‘zgarishda xato beradi |
| Tekshiruv tartibi | `scripts/verify.ps1` va GitHub Actions | Test, formatter, lint va build bir xil mezonlarga ega |

`billing.py` va `patient_workspace_ai.py`dagi ochiq compatibility eksportlari ataylab saqlangan: mavjud importlar ishlashda davom etadi, amalga oshirish esa bitta joyda qoladi. Runtime kutubxonalari bu refaktorda yangilanmagan; faqat rivojlantirish vositasi sifatida Prettier `3.9.8` qo‘shilgan.

Generatsiyalangan TypeScript build keshi `node_modules/.cache/`ga yo‘naltirildi. Eski kuzatilgan build keshi va testning vaqtinchalik natija fayli manba kodidan chiqarildi. Taqdimotlar, Word hujjatlari, model vaznlari va bemor fayllari ilova kodidan alohida saqlanadi.

## Saqlangan xatti-harakatlar

- Bemor URLlari, navigatsiya va RU/UZ/EN matnlari.
- Shifokorning qo‘lda kiritishi, hujjat importi, manbani ko‘rish va tasdiqlash tartibi.
- AI so‘rovida joriy bemor versiyasi va interfeys tili; asl dalil iqtibosining o‘z tili.
- Headerdagi tezkor solishtirish: tayyorlikni yangidan tekshirish, so‘rov yuborish va aynan yangi natijani tanlash.
- Solishtirish va prognoz uchun mustaqil tarix tanlovi; qayta urinish, bekor qilish va eskirgan natija belgisi.
- Haqiqiy AI provayderi, model va tasvir qamrovi haqidagi ma’lumotlar.
- Rol, tashkilot, bemorga kirish, versiya tekshiruvi, idempotency va chek ruxsatlari.
- Tarif, ariza va chekni developer tasdiqlashi; mavjud klinika va jamoani boshqarish.

## Kodning bir xilligini tekshirish

Refaktordan oldingi ish holati `764b613899307cdda409e09b91d1073b4ce8e33f` commitiga nisbatan tekshirildi. Faol lokal bazaning izchil SQLite nusxasi olingan; yangi seed yaratish yoki joriy bazani reset qilish bajarilmadi.

| Tekshiruv | Dalil |
| --- | --- |
| To‘liq OpenAPI taqqoslash | 85 ta API yo‘li; butun shartnoma refaktordan oldingi server bilan bir xil |
| Python formatlash | 85 ta modulning formatlashdan oldingi/keyingi AST xeshlari bir xil |
| Frontend formatlash | Qayta tuzilgan 4 komponentdan tashqari 74 TypeScript modulining runtime ASTsi mos; butun manba ham eski kodga qo‘llangan Prettier natijasi bilan mos |
| Billingni ajratish | 25 endpointning tartibi va shartnomasi; 33 handler/yordamchi funksiyaning ASTsi saqlangan |
| Klinik AI modullarini ajratish | 16 model/funksiya tuzilishi va 5 prompt qiymati saqlangan; ichki import manzili yangi papkaga moslashtirilgan |
| Developer UI ajratilishi | 18 runtime deklaratsiya, 10 interfeys va 142 import bog‘lanishi solishtirilgan; `Request` domen turi `SubscriptionRequest` deb nomlangan |
| Joriy lokal ma’lumotlar | 25 bemor, 13 foydalanuvchi, 70 job, 523 yozuv; refaktor nazorat nusxasi bilan taqqoslangan |

AST — kodning sintaktik tuzilmasi. Bunday taqqoslash formatlash va ko‘chirishda qo‘shimcha dalil beradi; u test yoki brauzer tekshiruvining o‘rnini bosmaydi. JSXdagi yonma-yon matn bo‘laklarining formatlashdan kelgan bo‘linishi yakuniy ko‘rinadigan matn bo‘yicha tekshirildi.

## Takrorlanadigan tekshiruv

Loyiha ildizida:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify.ps1
```

Bu buyruq backend testlari, Python lint/format, OpenAPI mosligi, frontend format/lint/test/build va Playwright ssenariylarini bajaradi. Playwright `8001/5174` portlari, alohida `runtime/e2e.db` va AI generatsiyasi o‘chirilgan test konfiguratsiyasidan foydalanadi. Ishlayotgan `8000` ilovasining bemor bazasi test bazasi emas.

Testlar to‘lov arizasi va chek ruxsatlari, klinik dalillar, versiya mojarolari, til, AI javobi sxemasi, DICOM importi, rollar va interfeys harakatlarini tekshiradi. Yangi regressiya testlari umumiy solishtirish blokirovkasi, to‘g‘ri yangi natijani tanlash, joriy til bilan retry va chek maxfiyligi kabi chegaralarni qamrab oladi.

GitHub Actions sozlangan; masofaviy CI run bu ishning bir qismi sifatida bajarilmagan.

### Mahalliy tekshiruv natijalari — 2026-09-19

| Tekshiruv | Natija |
| --- | --- |
| Backend: to‘liq pytest | **419 passed**; mavjud kutubxonalardan 3 deprecation warning |
| Frontend: to‘liq Vitest | **104 passed**, 15 fayl |
| Playwright | 29 noyob ssenariy tekshirildi: birinchi to‘liq ishga tushirishda 27 passed, 2 eski kutilma moslashtirildi; tegishli fayllarning qayta tekshiruvida 4/4 passed |
| Ruff lint va format | O‘tdi; 85 Python fayli |
| ESLint, TypeScript, Prettier | O‘tdi |
| Production build | O‘tdi |
| OpenAPI | Saqlangan shartnoma va refaktordan oldingi 85 yo‘lli server shartnomasi bilan mos |
| Faol ilova | API qayta ishga tushdi; RU tezkor taqqoslash tugmasi mock so‘rov bilan joriy versiya/til va yangi natija tanlash bo‘yicha tekshirildi |
| Faol developer kabineti | Arizalar, klinikalar, foydalanuvchilar, tariflar va to‘lov usullari bo‘limlari hamda klinika drawer oynasi ochildi; browser/API xatosi kuzatilmadi, biznes ma’lumotlari o‘zgartirilmadi |

Ikki eski Playwright kutilmasi ilova xatosi emas edi: sozlamalar testi oldingi UI versiyasidagidek headerda AI tugmasi yo‘q deb kutgan; radiologiya testi esa joriy `MODEL_WEIGHTS_MISSING` sababining o‘rniga eski umumiy vision xabarini kutgan. Kutilmalar amaldagi shartnomaga moslashtirildi; mahsulotdagi tugma yoki diagnostika holati yashirilmadi.

Refaktor davomida real AI generatsiyasi yuborilmadi. Klinik natija sifatini qayta baholash bu test to‘plamining vazifasi emas. Bazadagi `cases`, `users`, `jobs`, `records` jadvallari nazorat nusxasi bilan satr mazmuni bo‘yicha ham bir xil ekanligi tasdiqlandi.

## Ekspert uchun tezkor ko‘rib chiqish

1. [Arxitektura](ARCHITECTURE.md) orqali UI → API → snapshot → provayder → validatsiya → natija oqimini ko‘ring.
2. `patient/useClinicalComparison.ts` va uning testlarida tugma, til, readiness va ikki marta yuborish himoyasini ko‘ring.
3. `clinical_comparison/` ichida model javobi qaysi sxema va dalil tekshiruvlaridan o‘tishini ko‘ring.
4. `billing_checkout.py` va `test_billing.py`da boshqa klinikaning chekiga kirish rad etilishini ko‘ring.
5. `developer/` modullarida rol va versiya nazoratining UI/API orasida saqlanishini ko‘ring.
6. `scripts/verify.ps1`ni ishga tushiring va haqiqiy natijani tekshiring.

Hakaton namoyishida tekshiriladigan funksiyani ko‘rsatish maqsadga muvofiq: sintetik bemor → dalil → shifokor xulosasi → AI taqqoslash → manbaga qaytish; keyin alohida obuna arizasi → developer tasdig‘i. Birinchi o‘rin yoki klinik aniqlik testlar soni bilan kafolatlanmaydi. Loyihaning kuchi ishlaydigan oqimlar va tekshirish mumkin bo‘lgan texnik dalillar bilan ko‘rsatiladi.

## Amaldagi chegaralar

Muhandislik tekshiruvlari AI tashxisining klinik aniqligini tasdiqlamaydi. DMED demo adapteri, cheklangan DICOM kadr tahlili va shartli besh yillik ssenariylar haqidagi belgilar saqlangan. Real to‘lov settlementi, real DMED, PostgreSQL/Celery yuklama sinovi va mustaqil klinik validatsiya alohida ishdir. Kalitlar va bemor ma’lumotlari ushbu hisobotga kiritilmaydi.

Rivojlantirish qoidalari: [CONTRIBUTING.md](../CONTRIBUTING.md). Ishga tushirish: [README.md](../README.md).
