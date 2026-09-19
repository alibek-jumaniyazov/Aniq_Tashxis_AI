# Model integratsiyasi kartasi

| Maydon | Qiymat |
| --- | --- |
| Checkpoint | google/medgemma-1.5-4b-it |
| Hajm | 4B oilasi |
| Provider | llama.cpp Vulkan (Windows); optional Transformers |
| Kvantlash | Unsloth Q4_K_M, 4-bit GGUF; optional bitsandbytes |
| Tashqi inference | yo‘q |
| Sharh prompti | grounded-review-1.2 |
| Fakt ajratish prompti | document-extract-1.2 |
| Grounding | case version, tasdiqlangan fact/source ID, qamrov |
| Bilim bazasi | tasdiqlangan manbalar berilmagan |
| Klinik da’volar | bo‘sh ro‘yxat talab qilinadi |
| Klinik validatsiya | bajarilmagan |
| Til bahosi | RU/UZ klinik aniqlik o‘lchanmagan |
| KT maskasi | bu adapterda mavjud emas |

Rasmiy manbalar: [model](https://huggingface.co/google/medgemma-1.5-4b-it), [Google MedGemma](https://developers.google.com/health-ai-developer-foundations/medgemma), [xotira talablari](https://developers.google.com/health-ai-developer-foundations/faqs).

Yuklash skripti resolved revision va SHA-256 manifestni `models/medgemma-1.5-4b-it/aniq-manifest.json` ga yozadi. Bu lokal hisoblangan yaxlitlik inventari; alohida trusted-release signature verification deb ko‘rsatilmaydi. Foydalanish shartlarini foydalanuvchi o‘zi qabul qiladi.

Normal inference internetdan yuklashni taqiqlaydi. Klinik hujjat ichidagi ko‘rsatmalar ma’lumot deb ko‘riladi, prompt buyrug‘i deb emas. Model javobi valid schema, case version va mavjud source / knowledge ID bilan tekshiriladi. Bu prompt injection’ga mutlaq chidamlilik isboti emas.

Windows profilining kvantlangan manbasi: `unsloth/medgemma-1.5-4b-it-GGUF`, revision `3855f948626b7ae42bccd082757f15078c53e758`. Fayl `medgemma-1.5-4b-it-Q4_K_M.gguf`, SHA-256 `b31becdf4f39561800505514cce67681604fe449d04dd35c8c92fd7848c6d7bd`. Runtime `llama.cpp b11026`, Windows Vulkan ZIP SHA-256 `ceb83d677cedbc7ec427f157adbc93da82d8fdc336d8b105152568a3be98bb18`. Server local loopback va API kaliti bilan himoyalangan; shell/tools/agent rejimi yoqilmaydi. Prompt cache va slots endpoint yopilgan. GGUF profilida multimodal projector yuklanmagan: hozirgi AI adapteri matnli klinik kontekstni ko‘rib chiqadi.

Real inferensni tekshirish: `.venv\Scripts\python.exe scripts/check_model.py`. Bu script mock javob bermaydi; model tayyor bo‘lmasa nonzero chiqadi. Yuklash / inference natijalari `TEST_REPORT.md` da alohida qayd etiladi.

2026-09-18 kuni RTX 3050 Laptop 4 GB’da vazn va runtime SHA-256 tekshirildi, model Vulkan1 orqali yuklandi. Haqiqiy HTTP oqimi: TXT → 2 draft fakt → inson tasdig‘i → MedGemma sharhi → DB → production React interfeysi. Sinov matni faqat sintetik puls 70 /min va SpO2 97% ni o‘z ichiga oldi. Ajratish 5.3 s, yakuniy sharh 6.5 s bo‘ldi; bu bitta kichik misol, umumiy tezlik yoki aniqlik benchmarki emas.

Sinov davomida model noma’lum jinsni taxmin qildi, mavjud faktni yetishmayotgan deb yozdi va texnik metadata’ni sharhga qo‘shdi. Shu topilmalar asosida metadata kontekstdan chiqarildi, noma’lum jins / mavjud fakt uchun qo‘shimcha guardlar va testlar qo‘shildi. Birlik iqtibosda bo‘lishi shart; yo‘q bo‘lsa faqat iqtibosdagi literal qo‘shimcha ko‘chiriladi. Bu cheklangan tekshiruvlar barcha gallyutsinatsiyani aniqlamaydi. Manbali shifokor tekshiruvi zarur. Yakuniy HTTP misolida ruscha javob olindi; dastlabki javoblar inglizcha ham bo‘lgan, RU/UZ sifati keng baholanmagan.
