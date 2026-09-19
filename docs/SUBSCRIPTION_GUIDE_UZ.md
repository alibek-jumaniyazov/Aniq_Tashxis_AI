# AniqTashxis — obuna va boshqaruv qo‘llanmasi

Landing sahifa `/`, xarid `/checkout`, kirish `/login`, obuna va jamoa `/account`, platforma boshqaruvi `/developer` manzilida. Mahalliy ishga tushirilganda asosiy manzil `http://127.0.0.1:8000`. Bu qo‘llanma loyihada amalga oshirilgan oqimlarni tushuntiradi; internetga joylashtirilgan xizmat yoki klinik aniqlik sertifikati mavjudligini bildirmaydi.

## Tariflar

| Tarif | Bir kalendar oy | Shifokorlar limiti |
| --- | ---: | ---: |
| Doctor | 150 000 so‘m | 1 |
| Clinic 10 | 1 390 000 so‘m | 10 |
| Clinic 25 | 2 390 000 so‘m | 25 |
| Individual | Alohida kelishiladi | Alohida kelishiladi |

Individual tarif va faol tarifni almashtirish: [@avilab_uz_support](https://t.me/avilab_uz_support).

Hozir sozlangan to‘lov usuli: **Humo — 9860 1866 1499 7226**, oluvchi **Alibek Jumaniyazov**. Yakuniy rekvizitlarni xarid sahifasida tekshiring: developer ularni boshqaruvdan yangilashi mumkin.

## Xarid va tasdiqlash

1. Landing sahifada tarif tanlang. Klinikani, ism-familiyani, email, telefon va kamida 10 belgili parolni kiriting yoki mavjud hisobga kiring.
2. Tarif summasi va to‘lov usulini tekshirib, o‘tkazmani o‘zingiz amalga oshiring. Dastur kartadan avtomatik pul yechmaydi.
3. Chekni PNG, JPEG yoki PDF ko‘rinishida yuklang: 10 MB gacha, PDF 1–10 sahifa. Arizani yuboring.
4. `/account` sahifasida pending holati ko‘rinadi. Chek yuborish obunani avtomatik faollashtirmaydi.
5. Developer bankdagi haqiqiy tushumni, summani, oluvchini va takroriy to‘lov emasligini tekshiradi. Izoh bilan tasdiqlaydi yoki rad etadi. Tasdiqdan keyin obuna faollashadi.

Klinikada bir vaqtning o‘zida bitta kutilayotgan ariza bo‘ladi. Bir chek fayli qayta yuborilmaydi. Rad etilgan arizadan keyin yangi to‘lov uchun yangi chek yuborish mumkin. Cheklar faqat tegishli klinika egasi va developerga ko‘rinadi. Ariza narxi va joylar limiti yuborilgan vaqtdagi qiymatda saqlanadi.

## Hisoblar va muddat

Yakka tarif egasi `doctor` sifatida o‘zi ishlaydi va obunasini boshqaradi. Klinik tarif egasi `owner` sifatida jamoani boshqaradi; bemorlar bilan ishlash uchun alohida klinik hisoblar yaratadi. `doctor`, `radiologist`, `expert` rollari shifokor limitiga kiradi. Ma’muriy rollar bu limitga kirmaydi; umumiy jamoa soni ham cheklangan.

Egasi xodimni qo‘shishi, ism/rol/parolini o‘zgartirishi yoki faolsizlantirishi mumkin. Faolsizlangan hisobning sessiyalari bekor qilinadi, avvalgi klinik yozuvlar saqlanadi. Rol yoki parol o‘zgartirilsa qayta kirish talab etiladi. Klinik egasi va developer hisoblari odatiy jamoa tahriri orqali o‘chirilmaydi.

Obuna tasdiqdan boshlab bir kalendar oy amal qiladi. Shu tarifni muddatidan oldin uzaytirish tugash sanasiga yana bir oy qo‘shadi. Masalan, 31-yanvardan boshlangan oy fevralning oxirgi kunida tugaydi. Takroran tasdiqlash qo‘shimcha muddat bermaydi. Faol pullik tarifni boshqasiga o‘zgartirish support orqali yoki muddat tugagandan keyin amalga oshiriladi. Muddat tugaganda klinik ish maydoni yopiladi, obuna sahifasi ochiq qoladi va ma’lumotlar o‘chirilmaydi.

## Developer va namoyish

Developer klinikalarni, xodimlarni, tariflarni, to‘lov usullarini va arizalarni boshqaradi. Klinikani to‘xtatish uning sessiyalarini bekor qiladi. Bu rol bemor kartalarini ko‘rish huquqini bermaydi.

**Faqat lokal demo muhitida, `DEMO_MODE=true`:** `developer@demo.aniq` / `AniqDemo!2026`. Bu umumiy parol bilan ommaviy xizmat ishga tushirilmaydi. Mavjud sintetik klinikalar ichki demo obunasida saqlanadi.

Prezentatsiya uchun chek → tasdiqlash → jamoa → shifokor kirishi oqimini alohida test bazasida ko‘rsating. `TEST — TO‘LOV AMALGA OSHIRILMAGAN` deb belgilangan sintetik chekdan foydalaning va developer izohida ham sinov ekanini yozing. Haqiqiy ish bazasida bunday chekni daromad sifatida tasdiqlamang.

Avtomatlashtirilgan brauzer namoyishi:

```powershell
cd C:\Users\Lokaydo\Documents\GitHub\Aniq_Tashxis_AI\frontend
npm.cmd run test:e2e -- commerce.spec.ts --headed
```

Bu konfiguratsiya alohida `runtime/e2e.db`, `runtime/e2e-files` hamda 8001/5174 portlaridan foydalanadi; asosiy `runtime/aniq.db` bazasiga yozmaydi. Sinov serverlari test tugaganda to‘xtaydi. Klinik taqdimotda sintetik bemorlar ishlatiladi; AI xulosasi shifokor ko‘rigini almashtirmaydi.

## Ommaviy xizmatga tayyorlash

Yangi ishlab chiqarish muhiti uchun alohida baza va fayl saqlash joyi ajrating. `.env` yoki server muhitida `DEMO_MODE=false`, `COOKIE_SECURE=true`, ishlab chiqarish `DATABASE_URL`, `STORAGE_ROOT` va aniq HTTPS domenli `ALLOWED_ORIGINS` belgilang. HTTPS reverse-proxy orqali xizmat ko‘rsating; MedGemma serverini tashqi tarmoqqa ochmang.

Loyiha ildizida, yangi yoki Alembic bilan kuzatilayotgan bazaga migratsiya va shaxsiy developer yarating:

```powershell
$env:PYTHONPATH='backend'
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\.venv\Scripts\python.exe scripts/create_developer.py --email operator@example.uz --name "Platforma operatori"
```

Skript kamida 14 belgili parolni terminalda yashirin so‘raydi. Parolni buyruq argumenti yoki repozitoriyga yozmang. Eski, migratsiya tarixi bo‘lmagan demo bazasini tekshirmasdan `stamp` qilmang; yangi ishlab chiqarish bazasi afzal. `DEMO_MODE=false` demo hisoblarini bazadan o‘chirmaydi, lekin ularning login va mavjud sessiyalarini bloklaydi. Ishlab chiqarish uchun alohida shaxsiy operator hisobi kerak.

Migratsiyadan oldin bazaning izchil nusxasi va yopiq yuklangan fayllar zaxirasini oling; tiklashni alohida muhitda tekshiring. Frontendni `npm.cmd run build` bilan yig‘ing, shaxsiy developerda rekvizitlar va tariflarni tekshiring, keyin haqiqiy xaridni kichik nazoratli oqimda sinang. Huquqiy/to‘lov talablari va tibbiy qo‘llanish bo‘yicha zarur tashqi tekshiruvlar kodning ishlash testlaridan alohida bajariladi.

Texnik endpointlar: [BILLING_API.md](BILLING_API.md).
