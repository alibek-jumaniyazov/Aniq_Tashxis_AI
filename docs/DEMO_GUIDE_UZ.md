# AniqTashxis.ai — hakaton namoyishi

Bu ssenariy sintetik ma’lumotlarda dastur oqimini ko‘rsatadi. Tibbiy samaradorlik, haqiqiy bemorga tashxis yoki davolash da’vosi qilinmaydi.

## Namoyishdan oldin

1. Model vaznlari tayyor bo‘lsa, birinchi terminalda `powershell -ExecutionPolicy Bypass -File scripts/start-model.ps1`.
2. Ikkinchi terminalda `powershell -ExecutionPolicy Bypass -File scripts/start.ps1`.
3. Brauzerda `http://127.0.0.1:8000`. Tizim bo‘limida modelning haqiqiy holatini ko‘ring. Model ishlamasa, natija ochiq cheklov bilan saqlanadi.
4. Hisob: `doctor@demo.aniq`; parol: `AniqDemo!2026`. Login sahifasidagi ro‘yxat orqali boshqa demo rolni ham tanlash mumkin.

## 5–7 daqiqalik yo‘l

Tayyor ish navbatlari bilan namoyish uchun [SEED_GUIDE_UZ.md](SEED_GUIDE_UZ.md) dan foydalaning: 18 ta holat, 7 rol va davom ettirish mumkin bo‘lgan ekspert/hisobot jarayonlari bor. Quyidagi yo‘l yangi holatni boshidan yaratishni ko‘rsatadi.

**1. Manba va tasdiq.** Yangi holat oynasida sintetik bemorning F.I.Sh. ni kiriting; kod avtomatik yaratiladi. Qolgan maydonlar ixtiyoriy. Diagnostik AI namoyishi uchun bemor yoshini ham (18 yoshdan katta sintetik qiymat) kiriting. `Hujjat yuklash` orqali `demo/clinical-record.txt` faylini qo‘shing. Manbani oching: asl matn va koordinatalar saqlangan. Avtomatik draftlar shifokor tekshirmaguncha tahlil faktlariga aylanmaydi. Qiymat, inkor, vaqt va birlikni ko‘rib tasdiqlang. Dori faol holatini alohida tekshiring.

**2. Haqiqiy lokal AI.** Oddiy matnli hujjatda `Faktlarni ajratish · MedGemma` tugmasini bosing. Model o‘zi taklif qiladi; API iqtibosni asl matndan tekshiradi. AI mavjud bo‘lmasa yoki matn kontekstdan katta bo‘lsa, sabab ko‘rsatiladi. Soxta muvaffaqiyat yaratilmaydi. `Tekshiruvni boshlash` tasdiqlangan faktlar bo‘yicha yangi versiyali job yaratadi. AI sharhi, bajarilgan demo qoidalar va tekshirib bo‘lmagan qismlarni alohida tushuntiring.

**3. Qaror vaqti.** Bitta faktga hodisa va shifokorga ma’lum bo‘lgan vaqtni kiriting. `Qaror paytidagi ma’lumot` rejimini tanlang. Qarordan keyin ma’lum bo‘lgan fakt o‘sha qarorni baholashga kiritilmaydi. Keyin faktni tuzating: eski natija saqlanadi, yangi holat uchun eskirgan deb belgilanadi.

**4. Shifokor nazorati.** Izoh yozing; shaxsiy qoralama serverda avtomatik saqlanadi. Demo ogohlantirishga asos bilan javob bering. Shifokor qarori yozuv sifatida qoladi, dastur buyurtmani o‘zi o‘zgartirmaydi.

**5. DICOM.** `Radiologiya` oynasiga `demo/synthetic-phantom.zip` yuklang. Bu bemorning KT tasviri emas: dastur yaratgan geometrik test obyektidir. Kesim slayderi, oyna va zoom ishlashini ko‘rsating. `Maska mavjud emas` holati haqiqiy: KT segmentatsiya modeli ulanmagan. ZIPni qayta yaratish kerak bo‘lsa `python scripts/create_demo_dicom.py` (loyiha venv orqali).

**6. Mustaqil ko‘rib chiqish.** Holatni ekspert ko‘rigiga yuboring. `expert@demo.aniq` hisobida dalillarni ko‘rib, xulosa bering va paket tayyorlang. `sender@demo.aniq` hisobida alohida tasdiqlab test qabul qiluvchiga yuboring. PDF/JSON va mock kvitansiyani ko‘rsating. `analyst@demo.aniq` faqat yuborilgan shaxssizlantirilgan agregatlarni ko‘radi.

## Qanday ta’riflash kerak

“Biz manbali hujjatlar, vaqtga bog‘langan faktlar va shifokor tekshiruvini bitta lokal ish maydoniga birlashtirdik. React interfeysi Python REST API bilan ishlaydi. MedGemma 1.5 4B hujjatdan draft faktlar va sharh tayyorlash uchun ulanadi. Har bir natija manbasi, holat versiyasi va tekshiruv cheklovlari bilan saqlanadi.”

Aniq chegaralar: DMED va davlat qabul qiluvchisi demo adapter; dori katalogi klinik tasdiqlanmagan; risk ehtimoli `null`; KT uchun avtomatik segmentatsiya yo‘q. Kompyuterda o‘tgan muhandislik sinovlari `TEST_REPORT.md` da. AI yuklanganini yoki inference o‘tganini faqat haqiqiy model holati va smoke test natijasi asosida ayting.
