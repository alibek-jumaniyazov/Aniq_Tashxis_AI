# Hakamlar savollariga javoblar

## 10. Mahsulotning hozirgi holati

Jadval implementatsiya qamrovini bildiradi, mustaqil klinik foyda isboti emas. AI natijalari tahlil bajarilgan tilda saqlanadi. DMED o‘z profilidan sinxronlash va avtomatik bank tasdig‘i hozir mavjud emas.

## 11. Texnik arxitektura va rollar

Mahalliy model inferens uchun tashqi pullik model API xizmatini talab qilmaydi. Hosting, GPU va zaxira nusxa xarajatlari qoladi. Hozirgi demo bazasi SQLite. Klinikaga xos ruxsatlar serverda tekshiriladi. Mahalliy inferensning o‘zi maxfiylik talablarining barchasini bajarmaydi. Model yangidan o‘qitilmagan, mavjud MedGemma vaznlari ishlatilgan.

## 12. Klinika xarajati va sotuv yo‘li

1 390 000 / 10 = 139 000 va 2 390 000 / 25 = 95 600. O‘rinlar to‘liq band bo‘lishi hisob farazi bo‘lib, faol foydalanish fakti emas. Shifokor vaqti tejalgani yoki ROI hali o‘lchanmagan. Sotuv kanallari taklif bo‘lib, amaldagi mijozlar borligini bildirmaydi. To‘lov hozir qo‘lda tasdiqlanadi.

## 13. Foyda hisoblash xarajatiga bog‘liq

Bu faraziy hisob, haqiqiy xarajat yoki prognoz emas. Baza MRR: 66,7 mln so‘m. 550 o‘rindan 60% = 330 faol shifokor. Har biriga 40 tahlil = 13 200 tahlil/oy. Saqlash va backup: 3,3 mln. Bank xarajati farazi: 1%, ya’ni 667 ming. Doimiy budjet: 25 mln, shundan muhandislik 16 mln, yordam 4 mln, savdo/ma’muriyat 4 mln va boshqa infratuzilma 1 mln. AI birligi: 200 / 500 / 1 500 / 3 500 so‘m. Qoldiq: 35,093 / 31,133 / 17,933 / −8,467 mln so‘m. Soliq, ish beruvchi to‘lovlari, apparat xaridi, klinik baholash, huquqiy va xavfsizlik ekspertizasi, qaytarishlar hamda ayrim bir martalik xarajatlar kiritilmagan. Bu sof foyda emas. Kadrlar va qayta urinishlar hisoblash sarfini o‘zgartiradi.

## 14. Tibbiy natijani qanday talqin qilamiz

Haqiqiy klinik sinov patient-comparison-1.6 versiyasida bajarilgan. Javob 5 mg dozani saqladi, biroq manbada 2022-yildan boshlangan deb yozilgan davolash vaqtini qayta so‘radi. Bu modelning mazmuniy xatosi. Besh yillik istiqbol shartli kuzatuv ssenariylari bo‘lib, individual kasallik ehtimoli emas. Radiologiyada tanlangan kadrlar butun tekshiruv normal ekanini tasdiqlamaydi.

## 15. Pilotda qanday dalil yig‘amiz

Bu baholash rejasi, o‘lchangan natija emas. Vakillik qiluvchi holatlar, ajratilgan baholash to‘plami, mustaqil klinik etalonlar va oldindan belgilangan ko‘rsatkichlar zarur. AI bilan shifokorning mos kelishi diagnostik aniqlikning o‘zi emas. Real foydalanishda ma’lumot maxfiyligi va tegishli talablar mutaxassis bilan tekshiriladi.

## 16. Muhandislik tekshiruvlari

Sinovlar 2026-09-18 kuni bajarilgan. Backendning 245 testli to‘liq paketi oxirgi doza tekshiruvidan oldin o‘tdi. Oxirgi tuzatishdan keyin 49 ta maqsadli klinik test o‘tdi. Bu sonlar qo‘shilmaydi. Frontend: 10 faylda 60 test. Brauzerning 7 maqsadli ssenariysi alohida bajarildi: tasvir 1, hisobot 1, lokalizatsiya 3, bemor ish maydoni 2. Production build o‘tdi. 68,41 va 97 soniya bitta qurilmadagi alohida sintetik sinovlar bo‘lib, SLA yoki p50/p95 emas. UI 1440, 390 va 320 px kengliklarda tekshirildi. Batafsil dalillar work/pitch/evidence.md faylida.

## 17. Hakamlarning asosiy savollari

HAI-DEF modeli open-weight. Modelning o‘zini Apache 2.0 deb atash to‘g‘ri emas. Google FAQ tijorat mahsuloti yaratishga ruxsat berishini aytadi, biroq Terms of Use va Prohibited Use Policy tatbiq etiladi. Web/API orqali taqdim etish ham shartlardagi distribution ta’rifiga kiradi. Klinik foydalanish va tegishli ruxsatlar alohida baholanadi. Bu huquqiy xulosa emas. Mahalliy inferensdan tashqari kirish huquqlari, fayl saqlash, backup, hosting va ma’lumotga ruxsat ham nazorat talab qiladi.

## 18. Manbalar va materiallar

Muqova AI yaratgan abstrakt brend illustratsiyasi, tibbiy dalil emas. Skrinshotlar faqat nusxalangan sintetik bazalardan olingan. Lucide ikonkalari ISC litsenziyasida, litsenziya assets/LUCIDE-LICENSE.txt faylida. Asl loyiha logosi saqlangan. Moliyaviy ssenariylarning aniq qiymatlari business-data.json faylida. Tashqi manbalar 2026-09-19 kuni tekshirildi.


## Rasmiy manbalar

- https://stat.uz/en/press-center/news-of-committee/63870-zbekistonda-khususij-shifokhonalar-soni-k-pajmo-da-4
- https://huggingface.co/google/medgemma-1.5-4b-it
- https://github.com/lucide-icons/lucide/blob/main/LICENSE
- https://developers.google.com/health-ai-developer-foundations/faqs
- https://developers.google.com/health-ai-developer-foundations/terms
- https://stat.uz/img/images/healthcare_p40170.pdf
