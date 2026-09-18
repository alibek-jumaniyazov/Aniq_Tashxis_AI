# Logo, SEO va AI tahlili — 2026-09-18

## Yangi ko‘rinish

Focus Eye — ko‘z, ochiq iris va diqqat nuridan tuzilgan loyiha uchun chizilgan vektor belgi. Landing, kirish oynasi, bemorlar ish maydoni, obuna va hisobotlarda ishlatiladi. SVG, telefon ikonkalari va 1200 × 630 ulashish rasmi `frontend/public/brand` papkasida. Qo‘llash qoidalari: `BRAND_GUIDE_UZ.md`.

## SEO

O‘zbek, rus va ingliz tillariga alohida sarlavha, tavsif va ommaviy til manzillari tayyorlandi. Python server JavaScript yuklanishidan oldin metadata va qisqa ommaviy kontentni chiqaradi. Rasmiy domen yo‘qligi sabab hozircha indekslash o‘chirilgan. `SEO.md` hujjatida domen va indekslash sozlamalari bor.

Bemor kartalari, kabinetlar, to‘lov oynasi va API ommaviy qidiruv uchun emas: `noindex`, `nosnippet` va maxfiy sahifalarda `no-store` qo‘llanadi. Bemor ismi, telefon raqami, karta identifikatori yoki tibbiy natija SEO va ulashish metama’lumotlariga kiritilmaydi.

## Klinik solishtirish

AI tasdiqlangan ma’lumotlarni shifokor xulosasi va qayd etilgan davolash rejasi bilan solishtiradi. Sonlar har bir blokda aynan keltirilgan manbalar bilan tekshiriladi. Kuzatuv va ma’lumot ma’lum bo‘lgan vaqt, dori buyurilmasi holati saqlanadi. Dalil ochilganda shu sanalar va buyurilma holati ko‘rinadi.

O‘ylab topilgan manba, bemorning noma’lum jinsi, manbasiz son, o‘ziga o‘zi dalil qilib olingan tashxis va yaroqsiz javoblar tekshiruvdan o‘tmaydi. Bu cheklangan texnik tekshiruvlar bo‘lib, klinik xatoning barcha turini aniqlaydi degan kafolat emas. To‘liq bo‘lmagan JSON xulosa sifatida ko‘rsatilmaydi. Takroriy urinishlar chegaralangan; yakunda javob tekshiruvdan o‘tmasa, foydalanuvchiga holat ochiq ko‘rsatiladi.

## Radiologiya

1. DICOM yoki ZIP yuklang va kerakli seriyani oching.
2. Radiolog xulosasini kiriting yoki hujjatdan oling. Xulosa manbasi saqlanadi.
3. Bitta kadr yoki tekshiruvdan tanlangan kadrlar rejimini tanlang. Namuna rejimi tanlangan kadrni va turli seriyalardan jami ko‘pi bilan to‘rtta kadrni oladi.
4. AI javobidagi qamrov blokida nechta kadr va seriya ko‘rilganini tekshiring. F1–F4 havolalari haqiqiy seriya, kesim va oyna sozlamalariga bog‘langan.
5. «Asl kadrni ochish» orqali topilmani tasvir bilan tekshiring. Cheklangan yoki o‘qib bo‘lmaydigan tasvir natijasi alohida ko‘rsatiladi.

Modelga yuboriladigan tasvirlar nisbatini saqlagan holda eng uzun tomoni 896 pikselgacha moslashtiriladi. Asl DICOM ko‘rish oynasi saqlanadi. Yangi tahlil tanlangan interfeys tilini so‘raydi; oldingi saqlangan javoblar o‘z tilida qoladi.

**Qamrov chegarasi:** bu to‘liq 3D hajmni avtomatik tekshiruvchi validatsiyalangan tizim emas. Ko‘rilmagan kesimlarda patologiya bo‘lishi mumkin. To‘rtta kadr natijasi butun tekshiruv normal ekanini tasdiqlamaydi. Besh yillik javoblar ham validatsiyalangan individual ehtimollar emas, shartli kuzatuv ssenariylaridir.

## Tekshiruv dalillari

- DICOM sinovi alohida bazada, geometrik sintetik fantom bilan bajarildi. Haqiqiy lokal MedGemma to‘rtta kadr uchun yakunlangan javob qaytardi: 12 kadrdan 4 tasi, bitta seriya, 97 soniya. Bu tezlik o‘lchovi aynan ushbu qurilma va sinovga tegishli.
- Yakuniy klinik sinov 68,41 soniyada bitta qayta tuzatish bilan tugadi. Dozani keltirib, keyin uni noma’lum deb yozgan javob tekshiruvdan o‘tmadi; qayta javob hujjatdagi 5 mg/kun qiymatini saqladi. Biroq model manbada yozilgan davolash boshlanish vaqtini qayta so‘radi. Bu saqlanib qolgan mazmuniy xato sabab natijani shifokor manba bilan solishtirishi kerak. Sinov hisoboti: `work/patient-workspace-live-7746whiy/result.json`.
- UI orqali to‘rtta natijadan tegishli asl kadrga o‘tish tekshirildi. 1440, 390 va 320 px ekranlarda sahifa sig‘ishi tekshirildi.
- SEO server javobi JavaScript o‘chirilgan brauzerda ham tekshirildi; faqat ommaviy uchta til manzili sayt xaritasiga kirishi mumkin.
- Sinovlar bemorlarning asosiy bazasiga sun’iy yozuvlar qo‘shmasdan, alohida bazalarda bajarildi.

Texnik sinovdan o‘tish diagnostik aniqlikni isbotlamaydi. Klinik foydalanishga tayyorlik uchun vakillik qiluvchi tasvirlar va holatlar to‘plami, radiolog/shifokor belgilagan etalon javoblar hamda mustaqil baholash zarur. [Google MedGemma 1.5 model hujjati](https://huggingface.co/google/medgemma-1.5-4b-it) ham foydalanish holatiga mos baholashni talab qiladi.
