# OpenAI orqali AI tahlili

AniqTashxis AI klinik matn, hujjatdan fakt ajratish, shifokor xulosasini solishtirish va tanlangan radiologik kadrlar sharhini sozlangan provayderga yuboradi. Kabinetdagi umumiy nom — **AI tahlil**. Sozlamalarda va saqlangan natijada haqiqiy provayder/model ko‘rsatiladi. Eski MedGemma natijalari o‘z tarixiy manbasini saqlaydi.

## Joriy profil

- Provayder: `openai`, Responses API.
- Model: `gpt-5.6-luna`, reasoning: `high`.
- 2026-09-19 kuni berilgan hisob orqali model ro‘yxati tekshirildi: shu model mavjud. `gpt-6-astra` bu hisobda mavjud emas edi; dastur undan foydalangan deb ko‘rsatmaydi.
- Modelni tanlash klinik aniqlik yoki sertifikatlangan tibbiy qo‘llanishni anglatmaydi. Bu shifokor tekshiradigan yordamchi sharh.

## Server sozlamalari

Repo ildizidagi Git e’tiborsiz qoldiradigan `.env` faylida:

```dotenv
AI_PROVIDER=openai
AI_BACKEND=openai
OPENAI_API_KEY=<faqat serverdagi haqiqiy kalit>
OPENAI_MODEL=gpt-5.6-luna
OPENAI_REASONING_EFFORT=high
OPENAI_MAX_OUTPUT_TOKENS=8192
OPENAI_MAX_INPUT_CHARS=200000
```

Kalitni frontendga, `VITE_*` o‘zgaruvchisiga, Gitga yoki chatga yozmang. Oshkor bo‘lgan kalitni OpenAI boshqaruvida almashtirib, yangi qiymatni shu lokal faylga kiriting va API serverini qayta ishga tushiring. Kalit ilova status javobiga yoki saqlangan tahlilga qo‘shilmaydi.

`AI_PROVIDER` tashqi tarmoqqa yuborishni belgilaydi. `AI_PROVIDER=local_medgemma` bo‘lsa eskirgan `AI_BACKEND=openai` qiymati bulutli yuborishni yoqmaydi. Lokal rejim uchun mos `AI_BACKEND=llama_cpp` yoki `transformers` hamda model fayllari kerak. Provayderlar orasida yashirin avtomatik almashtirish yo‘q.

Oddiy ishga tushirish:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start.ps1
```

OpenAI rejimida lokal model serverini ishga tushirish shart emas. Modelga kirish/kvota xatosi alohida ko‘rsatiladi, soxta AI xulosasi yaratilmaydi.

## Javob va dalillar

Har bir ish so‘rov paytidagi `ru`, `uz` yoki `en` tilini saqlaydi. Keyinchalik til o‘zgarsa boshqa tildagi AI matnini tarjima qilingandek ko‘rsatmaydi; mos tarix yoki yangi tahlil tanlanadi. Asl hujjat iqtiboslari tarjima qilinmaydi.

Klinik solishtirish ikki bosqichdan iborat: tashxisni kuzatuvlarga solishtirish, so‘ng yozilgan davolash va ma’lumot yetishmovchiliklarini baholash. JSON sxemasi, bemor versiyasi, manba havolalari, raqamlar, til va ayrim ichki qarama-qarshiliklar serverda tekshiriladi. Yaroqsiz javobga cheklangan tuzatish so‘rovi berilishi mumkin; tekshiruvdan o‘tmagan javob muvaffaqiyatli natija sifatida saqlanmaydi. Bu tekshiruvlar tibbiy xatolarni to‘liq aniqlamaydi.

Yetishmayotgan ma’lumot alohida savol sifatida chiqadi. AI mustaqil dori tayinlamaydi va tasdiqlanmagan besh yillik foizli prognoz bermaydi. Shartli ssenariy kuzatilgan yaxshilanish yoki kafolat sifatida ko‘rsatilmaydi.

Radiologiya ZIP/DICOMni ilovada ochadi; AIga tanlangan yoki chegaralangan namunaviy kadrlar PNG shaklida yuboriladi. Natijada qaysi kesimlar ko‘rilgani, umumiy kadrlar soni va window sozlamasi saqlanadi. Bu butun KT/MRT/MSKT hajmining segmentatsiyasi yoki validatsiyalangan radiologik tashxis emas. Namoyishdagi geometrik fantom bemor anatomiyasi sifatida talqin qilinmasligi kerak.

## Ma’lumotlarning yuborilishi

OpenAI rejimida zarur klinik matn, hujjat matni va tanlangan tasvirlar tashqi OpenAI xizmatiga yuboriladi. Tuzilgan klinik snapshotdan ma’muriy ism/telefon maydonlari olib tashlanadi, ammo erkin matn yoki tasvir ichida shaxsiy ma’lumot qolishi mumkin: bu to‘liq avtomatik anonimlashtirish emas.

Responses so‘rovi `store=false`, TLS tekshiruvi va qat’iy `https://api.openai.com/v1` manzilidan foydalanadi. Ixtiyoriy tashqi rasm URLlari qabul qilinmaydi. `store=false` tashqi xizmatning barcha saqlash/abuse-monitoring jarayonlarini o‘chiradi degani emas. Klinik foydalanishdan oldin tashkilot ma’lumotlarni qayta ishlash talablarini baholashi kerak.

## Demo natijalari

Yangi bazadagi 45 uch tilli klinik misol **muallif tayyorlagan sintetik seed**, haqiqiy GPT javobi emas. Yangi tekshiruv tugmasi haqiqiy API so‘rovini yaratadi va `provider=openai`, `provenance=openai_api`, haqiqiy `model_id`ni saqlaydi. Qoidaviy tekshiruvlar va DICOM texnik hisobotlari ham model javobidan farqlanadi. Tarkib, hisoblar va zaxira tartibi: [SEED_GUIDE_UZ.md](SEED_GUIDE_UZ.md).

## Muhandislik tekshiruvi — 2026-09-19

Backendning 418 testi, frontendning 77 testi, lint/TypeScript va production build o‘tdi. RU/UZ/EN uchun uchta izolyatsiyalangan browser testi OpenAI holatini mock qilib tekshirdi; ular pullik so‘rov yubormaydi.

Aktivlashtirilgan lokal bazada 15 ta qo‘shimcha browser ssenariysi barcha demo rollar, obuna ko‘rinishlari, DICOM, uch tilli saqlangan natija va asl manbalarni tekshirdi. Eski baza/fayllar `runtime/backups/20260919T075947868552Z/` ichida saqlangan.

Haqiqiy APIga faqat sintetik ma’lumot yuborilgan alohida tekshiruvlar:

| Tekshiruv | Kuzatilgan natija |
| --- | --- |
| Shifokor xulosasi musbat MTB/KUM natijasiga zid bo‘lgan misol | RU 30,22 s; EN 57,78 s; UZ 41,16 s. Yakuniy javoblar joriy sxema, manba va til tekshiruvlaridan o‘tdi. |
| Qisqa matnli sharh | UZ, 3,70 s; haqiqiy provayder/model saqlandi. |
| Hujjatdan fakt ajratish | 2,53 s; puls 70 /min va SpO2 97% aynan asl iqtiboslariga bog‘landi. |
| Radiologik geometrik fantom | UZ, 8,36 s; 12 kadrdan bittasi ko‘rildi, to‘liq tadqiqot deb ko‘rsatilmadi, anatomik tashxis chiqarilmadi. |
| Ishlayotgan serverdagi AT-2609-015 demo bemor | UZ; haqiqiy navbat/worker/API/saqlash jarayoni o‘tdi. `OpenAI / gpt-5.6-luna`, shifokor xulosasini tekshirish va E3/E5 manbalari saqlandi. Qayta ishga tushirilgan run 34,69 s davom etdi. |

Vaqtlar shu bir martalik so‘rovlarniki, xizmat tezligi kafolati emas. Bu kichik sintetik sinovlar klinik samaradorlikni yoki xatosiz tashxisni isbotlamaydi. Yaroqsiz format, rad javobi, kvota/kalit xatosi va vaqt tugashi alohida avtomatik testlar bilan tekshirilgan.

Ishlayotgan serverdagi birinchi AT-2609-015 so‘rovi `OPENAI_UNAVAILABLE` bilan tugadi; uning o‘rniga soxta xulosa berilmadi. Modelga kirish qayta tekshirilib, ilovaning retry endpointi orqali yangi run muvaffaqiyatli bajarildi. Ikkala holat ham tarixda qoldi. API tarmoq yoki tashqi xizmat xatolaridan xoli deb kafolatlanmaydi.

Tekshiruvni qaytarish:

```powershell
# Modelga kirishni tekshiradi; generatsiya yubormaydi.
.\.venv\Scripts\python.exe scripts/check_model.py --status-only

# Sintetik matnni faol provayderga yuboradi; OpenAI rejimida pullik API so‘rovi.
.\.venv\Scripts\python.exe scripts/check_model.py --language uz --extract --output work/model-check.json
```

## Rasmiy manbalar

- [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Tasvirlar va vision cheklovlari](https://developers.openai.com/api/docs/guides/images-vision)
- [API ma’lumotlarini boshqarish](https://developers.openai.com/api/docs/guides/your-data)
