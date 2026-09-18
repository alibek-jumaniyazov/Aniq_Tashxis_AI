# AniqTashxis — ish jarayoni va namoyish yo‘riqnomasi

Har bir asosiy bo‘limdagi kitob belgili panelni oching: unda uch bosqichli yo‘riqnoma va savol-javoblar bor. Forma maydonlari ostidagi izohlar nima kiritish va bu qiymat nima uchun kerakligini tushuntiradi. Noma’lum klinik javoblar avtomatik to‘ldirilmaydi.

## Shifokor uchun

1. **Ish maydoni → Yangi bemor.** Faqat bemorning F.I.Sh. majburiy. Yosh, jins, telefon raqami va shifokor izohlari ixtiyoriy. Bemor kodi avtomatik yaratiladi. Avvalgi «Yangi holat» tugmasi ham ishlaydi.
2. **Bemor ma’lumotlari.** Subyektiv, obyektiv, laborator yoki instrumental bo‘limni tanlang. Matnni qo‘lda kiriting, PDF/DOCX/TXT yuklang yoki DMED namoyish importidan foydalaning. Manba va birliklarni tekshiring; import qilingan yozuvlar tekshirilmagan qoralama bo‘lib keladi.
3. **Shifokor xulosasi.** Ishchi tashxis, klinik asos va davolash/kuzatuv rejasini yozing yoki hujjatdan yuklang. Tekshirilgan ma’lumotlarni tasdiqlang. AI javobi avtomatik ravishda shifokor xulosasi bo‘lib saqlanmaydi.
4. **AI bilan solishtirish.** Kamida bitta tasdiqlangan bemor yozuvi yoki klinik fakt, tasdiqlangan shifokor xulosasi va kattalar yoshi kerak. Lokal MedGemma tashxis/davolashni dalillar bilan solishtiradi; qo‘llab-quvvatlovchi ma’lumotlar, tafovutlar va aniqlashtiruvchi savollarni alohida ko‘rsatadi.
5. **5 yillik istiqbol.** Mavjud ma’lumotlar yetarli bo‘lsa, shartli rivojlanish va kuzatuv ssenariylari ko‘rsatiladi. Bu individual ehtimollik yoki kafolatlangan bashorat emas. Avvalgi 10 yillik xavf kalkulyatori «Tarix va vositalar» ichida saqlangan.
6. **DICOM oynasi.** «DICOM oynasini ochish» orqali ZIP arxivni yuklang, seriya va kadrlarni ko‘ring, oyna/masshtabni sozlang. Radiolog xulosasini kiriting yoki hujjat bilan bog‘lang. AI tanlangan kadrni xulosa bilan solishtiradi; bu butun tekshiruvni avtomatik o‘qish emas.

DMED hozir aniq belgilangan namoyish adapteridir. Haqiqiy bemor profilini avtomatik sinxronlash uchun klinikaning rasmiy API hujjatlari va avtorizatsiyasi kerak. Asl hujjatlar, avvalgi tahlillar va versiyalar «Tarix va vositalar» orqali ochiladi.

Ma’lumot tahlildan keyin o‘zgarsa, oldingi natija **eskirgan** deb belgilanadi. Eski natijani joriy ma’lumotlarga tegishli deb qabul qilmang. Forma ochiq paytda holat o‘zgarsa, xulosa formasini yangidan ochish talab qilinadi.

## Boshqa klinik bo‘limlar

| Bo‘lim | Amal | Natija va muhim chegarasi |
|---|---|---|
| Qarorni tekshirish | Joriy vaqt yoki qaror vaqtini tanlash, ixtiyoriy AI, tekshiruv | Hujjat/fakt mosligi, qamrov va manbali ogohlantirishlar. Bu alohida tashxis qo‘yish vositasi emas. |
| Radiologiya | DICOM/ZIP yuklash, seriya va kadr tanlash, oyna/masshtab, o‘lchov, AI | AI tanlangan kadrni ko‘radi. Radiolog asl tasvirlarni tekshiradi va o‘z xulosasini saqlaydi. Sintetik fantom klinik tasvir emas. |
| Xavf prognozi | Yosh/jinsni tekshirish, bosim/lipid/birlik va Ha/Yo‘q javoblari | Qo‘llanish shartlariga mos 10 yillik hisob. Mos bo‘lmagan holat uchun son o‘ylab topilmaydi. Birlik o‘zgarsa lipidlar va tasdiq tozalanadi. |
| Izohlar | Yozuv turi, matn, manba va vaqt | Shaxsiy qoralama avtomatik saqlanadi; “Saqlash” uni holat tarixiga qo‘shadi. Yuklash xatosida qayta urinish bor. |
| Ekspert tahlili | Holatni ochish, mustaqil dalillarni tekshirish, asosli qaror | Qaror va holat o‘tishlari tarixda saqlanadi. |
| Hisobotlar | Tasdiqlangan ekspert tekshiruvlari, maqsad va asos | Paketni ko‘rish, JSON/PDF yuklash, vakolatli yuboruvchi tasdig‘i va sinov yuborishi. |

**DMED — demo adapter. Hisobotlarni tashqi qabul qiluvchiga yuborish — sinov transporti.** Ular haqiqiy davlat tizimiga ulangan deb ko‘rsatilmaydi.

## Rollar

| Rol | Asosiy vakolat |
|---|---|
| Shifokor | Holat/faktlar, hujjatlar, klinik tahlil, shifokor xulosasi, xavf hisobi |
| Radiolog | Ruxsatli holatlarning DICOM ko‘rigi, o‘lchov, radiolog xulosasi, tasvir AI va qayta urinish |
| Ekspert | Mustaqil ekspert qarori va tegishli materiallar |
| Sifat mas’uli | Ko‘rik materiallari va hisobot tayyorlash |
| Yuboruvchi | Hisobotning aniq versiyasini tasdiqlash va sinov yuborishi |
| Tahlilchi | Ruxsat etilgan jamlangan hisobotlar |
| Administrator | Tizim holati, klinika jamoasi ma’lumotlari va audit |
| Klinika egasi | Obuna arizalari va o‘z jamoasini boshqarish |
| Developer | Platformadagi arizalar, klinikalar, xodimlar, tariflar va to‘lov rekvizitlari |

Vakolat sababli amal yopiq bo‘lsa, uning sababi ko‘rsatiladi. Ruxsatni faqat tugma ko‘rinishi emas, backend ham tekshiradi.

## Sozlamalar

Yon menyudagi **Sozlamalar** bo‘limi profil, xavfsizlik, interfeys, klinika va obuna, tizim va audit hamda yordamni birlashtiradi. Eski `/account` havolasi `/settings/clinic` sahifasiga yo‘naltiriladi.

- **Shaxsiy profil:** ismni saqlash; hisob emaili va rolini ko‘rish. Saqlangan ism yon menyuda ham yangilanadi.
- **Xavfsizlik:** joriy parolni tekshirib yangi parol o‘rnatish, faol seanslar sonini ko‘rish va boshqa seanslarni tugatish. Joriy seans saqlanadi.
- **Interfeys:** rus, o‘zbek va ingliz tillari; animatsiyalarni kamaytirish. Bu tanlovlar brauzerda avtomatik saqlanadi.
- **Klinika va obuna:** tarif, arizalar, to‘lov holati va egasi uchun jamoa boshqaruvi.
- **Tizim va audit:** xizmatlar, model holati va rolga ruxsat etilgan audit/jamoa ma’lumotlari.

Obuna faol bo‘lmasa ham profil, xavfsizlik va obuna sahifalari ochiladi. Shaxsiy profilga yon menyudagi ismni bosib kiriladi; chiqish tugmasi uning yonida alohida joylashgan.

## Bildirishnomalar

Qo‘ng‘iroqda o‘qilmaganlar soni bor. Oyna uzun ro‘yxatni ichida aylantiradi va telefon ekraniga moslashadi. **Hammasini o‘qish** faqat joriy foydalanuvchiga ochiq bildirishnomalarni serverda o‘qilgan deb belgilaydi, jumladan oxirgi 100 talik ko‘rinishdan eski yozuvlarni ham. Boshqa foydalanuvchining holati o‘zgarmaydi. Bitta yozuvni bosish tegishli holatni ochadi. Escape oynani yopadi.

## Obuna namoyishi

Landing → tarif → hisob yaratish → to‘lov usuli → chek yuklash → tasdiq belgisi → ariza. Developer chekni va bankdagi tushumni tekshiradi, so‘ng tasdiqlaydi yoki izoh bilan rad etadi. Chek mavjudligining o‘zi to‘lovni tasdiqlamaydi.

Faol tarifni boshqa tarifga almashtirish uchun yordam yo‘li ko‘rsatiladi; mos kelmaydigan to‘lovga undovchi forma ochilmaydi. Uzaytirish shu tarif bo‘yicha amalga oshadi. To‘lov yuborilayotganda maydonlar qulflanadi. Klinika egasi tasdiq holatini kabinetda ko‘radi va faol obunada xodim qo‘shadi.

## Taqdimot uchun qisqa ketma-ketlik

1. Landingda tariflar va tushunarli obuna yo‘lini ko‘rsating.
2. Shifokor kabinetida sintetik holatning manbasi va tasdiqlangan faktini oching.
3. Diagnostik yordamdagi MedGemma javobi, manba havolasi va cheklovini ko‘rsating.
4. Radiologiyada asl DICOM kadrini ochib, oyna/kadrni o‘zgartiring.
5. Aniq kiritilgan qiymatlar bilan xavf hisobini bajaring.
6. Ekspert → hisobot → yuboruvchi jarayonini ko‘rsating.
7. Developerda demo ariza tasdig‘i va klinika egasining jamoa boshqaruvini ko‘rsating.

MedGemma bilan texnik ishlashni tekshirish klinik aniqlik validatsiyasi emas. Model javoblari shifokor tekshiruviga mo‘ljallangan; taqdimotda kafolatlangan tashxis yoki o‘lchanmagan aniqlik foizi e’lon qilinmaydi.

## 2026-09-18 dagi tekshiruv

| Tekshiruv | Natija |
|---|---|
| Backend: `pytest backend/tests -q` | To‘liq tekshiruvda 162 ta test o‘tdi; yakuniy o‘zgarishlar maxsus testlar bilan qayta tekshirildi |
| Frontend: `npm test` | 41 ta test o‘tdi |
| Brauzer: Playwright | Bemor yaratish, to‘rt toifadagi ma’lumot, xulosa, manbani tekshirish, DMED demo, DICOM ZIP va radiolog xulosasi hamda uch til tekshirildi |
| TypeScript, production build, ESLint va Ruff | O‘tdi |
| Haqiqiy lokal MedGemma 4B | Klinik tahlil, qarorni tekshirish va sintetik DICOM kadrida javob olindi |
| Klinik javob formati | Rus tilidagi xulosa, manba bog‘lanishi va yetishmayotgan ma’lumot uchun savollar qayta tekshirildi |
| Mobil harakatlar | Tab bosilishi, yashirin tablar menyusi, klaviatura va animatsiyani kamaytirish rejimi tekshirildi |

Brauzer ssenariylari haqiqiy test API orqali hujjat/fakt/izoh, xavf hisobi, radiologiya, ekspert-hisobot jarayoni, obuna tasdig‘i va bildirishnomalarni qamrab oladi. Qasddan yaratilgan vaqtinchalik xatolardan tiklanish ham tekshirildi. Jonli model sinovlari alohida vaqtinchalik bazada, faqat sintetik ma’lumotlar bilan bajarildi.
