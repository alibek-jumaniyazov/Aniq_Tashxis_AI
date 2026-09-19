# AniqTashxis.ai — M0

Hakaton uchun klinik hujjatlarni ko‘rib chiqish ish maydoni. React interfeysi Python REST API, ma’lumotlar bazasi, fayl saqlash va versiyalangan tahlil oqimiga ulangan. Ilovani lokal ishga tushirish mumkin; AI hisoblash joyi tanlangan provayderga bog‘liq. Barcha boshlang‘ich holatlar sintetik.

**Holat:** ishlaydigan muhandislik prototipi. Klinik samaradorlik yoki tibbiy foydalanishga tayyorlik tasdiqlanmagan. Joriy demo uchun sozlanadigan OpenAI API integratsiyasi qo‘shilgan; `gpt-5.6-luna`, reasoning `high` — ushbu integratsiyada tekshirilgan profil. Lokal MedGemma ixtiyoriy profil sifatida saqlangan. Amaldagi provayder/model va tayyorlik holatini kabinetda yoki `scripts/check_model.py --status-only` orqali tekshiring. Tasdiqlangan dori katalogi va KT segmentatsiya modeli yo‘q; AI sharhi mustaqil tashxis yoki tasdiqlangan individual prognoz emas.

## Windowsda ishga tushirish

Python 3.12, Node.js 22 va npm kerak. Loyihaning ildiz papkasida:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
powershell -ExecutionPolicy Bypass -File scripts/start.ps1
```

Brauzer: **http://127.0.0.1:8000**. OpenAPI: **http://127.0.0.1:8000/docs**.

Oldingi lokal MedGemma demo bosqichida `.venv`, `node_modules`, frontend build va GGUF vaznlari tayyorlangan. `AI_PROVIDER=openai` rejimida faqat `start.ps1` kerak: `start-model.ps1`, GPU va lokal vaznlar majburiy emas. Sozlash quyidagi OpenAI bo‘limida. API AI xizmati tayyor bo‘lmasa ham ishga tushadi, tahlil esa tayyor emasligi sababini ochiq ko‘rsatadi. `setup.ps1` yangi `.env`ni `.env.example`dan yaratadi; provayderni aniq tanlang, namunadagi lokal profilni bulutli inferens deb qabul qilmang.

| Hisob | Vazifa |
| --- | --- |
| `doctor@demo.aniq` | Holat, fakt, hujjat, izoh, tahlil |
| `radiologist@demo.aniq` | DICOM va vizual xulosa |
| `expert@demo.aniq` | Mustaqil ekspert qarori |
| `quality@demo.aniq` | Sifat nazorati, paket tayyorlash |
| `sender@demo.aniq` | Alohida tasdiqlash va sinov yuborishi |
| `admin@demo.aniq` | Tizim va audit; klinik holatlar yopiq |
| `analyst@demo.aniq` | Yuborilgan shaxssizlantirilgan agregatlar |
| `owner@demo.aniq` | Asosiy klinika, jamoa va obuna |
| `owner.pending@demo.aniq` | To‘lov arizasi tasdiq kutayotgan klinika |
| `owner.expired@demo.aniq` | Obunasi tugagan klinika |
| `developer@demo.aniq` | Platforma, klinikalar, tariflar va arizalar |
| `other@demo.aniq` | Boshqa tashkilotdagi izolyatsiyalangan bemor |

Yangi demo hisoblar paroli: **`AniqDemo!2026`**. Reset mavjud demo email hisobining o‘zgartirilgan parolini saqlaydi. Hisoblar namoyish uchun; klinika/rol boshqaruvi ishlaydi, korporativ SSO implementatsiya qilinmagan.

## Hayotiy sintetik seed

Yangi demo bazalar `realistic-workspace-v2` profilidan boshlanadi: asosiy klinikada 18 bemor va boshqa tashkilotda bitta bemor, 90 klinik yozuv, 143 manba, 93 fakt, 45 uch tilli solishtirish namunasi, 18 qoidaviy tekshiruv, 13 ekspert ko‘rigi, 5 DICOM fantom tadqiqoti, 4 klinika va 3 sintetik obuna arizasi. Tayyor xulosalar mualliflik o‘quv misoli sifatida belgilangan; ular hech bir AI modeli hisoblagan natija emas. Seed yaratish AI so‘rovi yubormaydi. Mavjud baza oddiy startda o‘zgartirilmaydi.

Toza namoyish uchun API va workerlarni to‘xtating, loyiha ildizida `.\.venv\Scripts\python.exe scripts/reset_demo.py --reset-demo` ishlating. Skript yangi bazani avval alohida yaratib tekshiradi, keyin eski baza va fayllarni `runtime/backups/<vaqt>/` ga ko‘chiradi. Model va `.env` saqlanadi. So‘ng `scripts/start.ps1` bilan ishga tushirib qayta kiring. Batafsil: [SEED_GUIDE_UZ.md](docs/SEED_GUIDE_UZ.md).

## Nimalar ishlaydi

- RU / UZ / EN interfeys va AI so‘rovi tili. Tanlangan til snapshot va natijada saqlanadi; boshqa tildagi xulosa qayta generatsiya qilinadi. Asl manba iqtiboslari tarjima qilinmaydi.
- Moslashuvchan desktop va telefon ko‘rinishi, lokal shriftlar, animatsiyalar va reduced-motion qo‘llab-quvvatlash.
- Qo‘lda kiritish, PDF / DOCX / TXT manbalari, aniq belgilangan DMED demo adapteri.
- Tasdiqlanmagan draft faktlar, shifokor tasdig‘i, manbaga qaytish, aniq iqtibos / matn koordinatalari va asl faylni ruxsat bilan yuklash.
- O‘zgarmas fakt versiyalari, optimistik versiya nazorati, hodisa / ma’lum bo‘lish / import vaqtlarini ajratish.
- Joriy va qaror vaqtiga qaytuvchi tahlil; kech kelgan ma’lumotlarni retrospektiv tekshiruvdan chiqarish.
- Lokal ish navbati, saqlanadigan job holati, polling, bekor qilish, API orqali retry, eskirgan natija belgisi va bildirishnomalar.
- Uchta **demo** tekshiruv: hujjatlar tomonining farqi, bir xil moddaning allergiya va faol buyurtmada uchrashi, laboratoriya yozuvi to‘liqligi. Klinik laboratoriya chegaralari va dori bazasi taxmin qilinmagan.
- Shifokor izohi, serverdagi shaxsiy avtomatik qoralama, ogohlantirishga izohli javob, ekspert qarorlarining tarixi.
- KT, MRT va boshqa qo‘llab-quvvatlangan DICOM tasvirlari / ZIP importi, geometrik validatsiya, kesim tartiblash, oyna / daraja, zoom va rentgenolog ko‘rigi. Vision modeli tanlangan kadrlarni ko‘radi; qamrov oynasi qaysi kadrlar ko‘rilganini ko‘rsatadi. Bu to‘liq hajm diagnostikasi yoki segmentatsiya emas.
- Ekspert tasdiqlagan holatlardan shaxssizlantirilgan agregat; alohida sender tasdig‘i, PDF / JSON va tashqi tarmoqqa yubormaydigan mock kvitansiya. Kichik guruh soni yashiriladi.
- Rol + tashkilot + holat ruxsati, HttpOnly cookie, CSRF, login tezligi cheklovi, idempotency, audit, fayl chegaralari va ZIP path traversal himoyasi.

## OpenAI API — joriy tanlangan AI profili

Server konfiguratsiyasida provayder aniq tanlanadi. Ushbu integratsiya uchun model sozlamasining standart qiymati `gpt-5.6-luna`, reasoning qiymati `high`; bu parametr [rasmiy model hujjatida](https://developers.openai.com/api/docs/models/gpt-5.6-luna) qo‘llab-quvvatlanadi. 2026-09-19 tekshiruvida amaldagi API hisobiga shu model mavjud edi; boshqa model nomiga kirish bor deb taxmin qilinmaydi.

```dotenv
AI_PROVIDER=openai
AI_BACKEND=openai
OPENAI_MODEL=gpt-5.6-luna
OPENAI_REASONING_EFFORT=high
OPENAI_MAX_OUTPUT_TOKENS=8192
OPENAI_MAX_INPUT_CHARS=200000
```

`OPENAI_API_KEY` faqat serverdagi `.env` yoki server muhitida saqlanadi. Uni `VITE_` o‘zgaruvchisiga, frontendga, Gitga yoki logga joylamang. Ushbu bo‘lim kalitni yaratmaydi va haqiqiy kalitni o‘z ichiga olmaydi. Batafsil: [OPENAI_INTEGRATION_UZ.md](docs/OPENAI_INTEGRATION_UZ.md).

`AI_PROVIDER=openai` bo‘lsa, tanlangan klinik matn, hujjat parchalari va tasvir kadrlari OpenAI xizmatiga yuboriladi. API va bemor bazasining `127.0.0.1`da ishlashi inferens ham lokal degani emas. Provayderning ishlamasligi yoki limit xatosida dastur yashirincha boshqa modelga o‘tmaydi va tayyor seed javobini real inferens sifatida bermaydi. Asl manba iqtiboslari, strukturali javob sxemasi, til va dalil havolalari tekshiriladi.

```powershell
# Mavjudlik holati: model javobi generatsiya qilinmaydi.
.\.venv\Scripts\python.exe scripts/check_model.py --status-only
# Faqat sintetik namuna bilan haqiqiy so‘rov; API xarajati bo‘lishi mumkin.
.\.venv\Scripts\python.exe scripts/check_model.py --language uz --extract --output work/ai-smoke.json
powershell -ExecutionPolicy Bypass -File scripts/start.ps1
```

`--status-only` bulutli xizmatda ulanish/model mavjudligini tekshirish uchun provayderga murojaat qilishi mumkin, lekin javob generatsiya qilmaydi. Oddiy smoke testi haqiqiy model javobini kutadi; `--language ru|uz|en` xulosa tilini belgilaydi, standart til `uz`. Hujjat ajratish asl iqtibos tilini saqlaydi. Hisobotda amaldagi provayder va model yoziladi; klinik validatsiya bajarilgani da’vo qilinmaydi.

## MedGemma 4B — ixtiyoriy lokal profil

Lokal profil checkpointi: **`google/medgemma-1.5-4b-it`**. Bu Google MedGemma oilasining 4B multimodal checkpointi. Oldingi Windows demo bosqichida **GGUF + llama.cpp Vulkan** sinovdan o‘tgan. Uni tanlash uchun `AI_PROVIDER=local_medgemma` va `AI_BACKEND=llama_cpp` belgilang; aynan shu profil inferensni `127.0.0.1:8081` orqali bajaradi. Tekshirilgan `mmproj-F16.gguf` mavjud bo‘lsa start skripti vision projectorini ham ulaydi. `AI_PROVIDER=openai` rejimida bu serverdan foydalanilmaydi. KT segmentatsiyasi yo‘q.

Kvantlangan nusxa: [Unsloth MedGemma 1.5 4B Q4_K_M](https://huggingface.co/unsloth/medgemma-1.5-4b-it-GGUF), 2,489,894,976 bayt, revision `3855f948626b7ae42bccd082757f15078c53e758`. Model Unsloth tomonidan 4-bit formatga o‘tkazilgan; Google’ning asl BF16 fayllari bilan bir xil baytlar deb ko‘rsatilmaydi. Runtime — [llama.cpp](https://github.com/ggml-org/llama.cpp/releases/tag/b11026), build `b11026`.

```powershell
.\.venv\Scripts\python.exe -m pip install requests
.\.venv\Scripts\python.exe scripts/download_gguf.py
powershell -ExecutionPolicy Bypass -File scripts/start-model.ps1
```

Keyingi terminalda `scripts/check_model.py`, so‘ng `scripts/start.ps1` ni ishga tushiring. Downloader qayta ochilganda tekshirilgan bo‘laklardan davom etadi; yakunda rasmiy provider metadata’dagi SHA-256 bilan solishtiradi. Vazn to‘liq tekshirilmaguncha `.gguf` nomiga o‘tmaydi. Serverga alohida lokal API kaliti yaratiladi, frontendga berilmaydi. `Tizim va audit` bo‘limi yuklash foizini ko‘rsatadi.

GPU xotirasi yetmasa `scripts/start-model.ps1 -GpuLayers 20`, yoki CPU uchun `-GpuLayers 0` ishlating; bu odatda tezlikni pasaytiradi. Oldingi lokal sinovda RTX 3050 kompyuterida GGUF/Vulkan real HTTP inferensi bajarilgan: qisqa sintetik hujjatdan 2 fakt ajratilgan (5.3 s), keyingi sharh yaratilgan (6.5 s). Bu tarixiy muhandislik sinovi, joriy OpenAI tezligi yoki klinik accuracy benchmarki emas. Dalil `docs/TEST_REPORT.md` da.

### Ixtiyoriy Transformers profili

Original vaznlarni ishlatish uchun `AI_PROVIDER=local_medgemma`, `AI_BACKEND=transformers` alohida profili bor. Oldingi kompyuter tayyorlash bosqichida katta PyTorch/CUDA va BF16 yuklashlari to‘xtatilgan; GGUF va OpenAI profillari uchun ular kerak emas. Faqat Transformers profilidagi inferens `local_files_only=True`, `trust_remote_code=False` orqali ishlaydi.

1. [Rasmiy model sahifasida](https://huggingface.co/google/medgemma-1.5-4b-it) HAI-DEF shartlarini o‘zingiz qabul qiling.
2. NVIDIA uchun mos PyTorch buildini o‘rnating. Quyida [PyTorch rasmiy installer](https://pytorch.org/get-started/locally/) formatidagi CUDA 12.8 misoli:

```powershell
.\.venv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cu128
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-ai.txt
.\.venv\Scripts\hf.exe auth login
powershell -ExecutionPolicy Bypass -File scripts/setup-model.ps1
.\.venv\Scripts\python.exe scripts/check_model.py
```

Token faqat lokal terminal yoki vaqtinchalik `HF_TOKEN` muhit o‘zgaruvchisida ishlatiladi. Uni `.env`, Git, brauzer yoki loglarga kiritmang. Model yuklash skripti aniq commit revision va SHA-256 manifest yozadi, `.env` ichida faqat model manzili / revisionni yangilaydi. Keyin backendni qayta ishga tushiring.

`.env` xotira chegaralari: `MODEL_GPU_MEMORY_GB=3`, `MODEL_CPU_MEMORY_GB=4`. Ushbu kompyuter RTX 3050 Laptop 4 GB va taxminan 7.3 GB RAMga ega. Bu chegaralangan konfiguratsiya: 4-bit yuklash ham real inference uchun yetarli bo‘lishi kafolatlanmaydi. Rasmiy [Google xotira jadvali](https://developers.google.com/health-ai-developer-foundations/faqs) 4B Q4_0 vaznlari uchun taxminan 3.4 GB ko‘rsatadi; inference buferlari qo‘shimcha joy oladi. Model yuklansa ham klinik validatsiya bajarilgan degani emas.

AI tahlili tasdiqlangan faktlar, shifokor konteksti va tekshiruv qamrovini oladi. Strukturali JSON Pydantic bilan tekshiriladi. Manba oynasidagi **Faktlarni ajratish · AI** amali tanlangan OpenAI yoki lokal GGUF provayderi orqali draftlar taklif qiladi: qiymat iqtibos ichida, iqtibos esa manba sahifasida bo‘lishi tekshiriladi. Sana va tayinlov faolligi taxmin qilinmaydi; shifokor tasdig‘i shart. Hujjat sozlangan kirish limitidan oshsa ochiq xato beriladi. Qo‘lda kiritish ham mavjud; `demo/clinical-record.txt` dagi `key=value` format modelsiz avtomatik draftlar yaratadi. Bu dasturiy tekshiruvlar klinik model sifatining mustaqil validatsiyasi emas.

## Ishlab chiqish

Ekspert tekshiruvi uchun boshlanish nuqtasi: [kod refaktori va tekshiruv dalillari](docs/CODE_REVIEW_UZ.md), [arxitektura](docs/ARCHITECTURE.md) va [ishlab chiqish qoidalari](CONTRIBUTING.md). Formatter, lint, API shartnomasi, test va build tekshiruvlarini bitta buyruq bajaradi:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify.ps1
```

Ikki terminal:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

```powershell
cd frontend
npm.cmd run dev
```

Vite: `http://127.0.0.1:5173`. Axios so‘rovlari `/api/v1` orqali Vite proxyga boradi. Frontend build esa FastAPI bilan bir origindan xizmat qiladi. Session tokeni localStorage’da saqlanmaydi; faqat interfeys tili saqlanadi.

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests -q
.\.venv\Scripts\python.exe -m ruff check --config backend/pyproject.toml backend scripts
.\.venv\Scripts\python.exe -m ruff format --check --config backend/pyproject.toml backend scripts
.\.venv\Scripts\python.exe scripts/export_openapi.py --check
cd frontend
npm.cmd run format:check
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

Playwright Windowsda o‘rnatilgan Chrome’dan foydalanadi. E2E serverlari 8001 / 5174 portlarida, alohida `runtime/e2e.db` bazasida ishlaydi. CI Linuxda Chromium o‘rnatadi. CI konfiguratsiyasi kiritilgan, lekin GitHubga push va masofaviy CI run bu sessiyada bajarilmagan.

API ataylab o‘zgartirilsa, ildiz papkada `scripts/export_openapi.py`, keyin frontendda `npm.cmd run api:types` bajariladi. Oddiy tekshiruvda `--check` saqlangan shartnomani qayta yozmasdan solishtiradi. Formatlash va tekshiruv joriy bemor bazasini reset qilmaydi.

## Ma’lumotlar bazasi va Docker

Oddiy Windows profili: SQLite + WAL va DB’da saqlanadigan lokal ThreadPool job navbati, bitta API process. Bu Redisga bog‘liq bo‘lmasdan namoyishni ochish uchun tanlangan.

PostgreSQL 16 + Redis 7 + Celery profili `compose.yaml` da bor. Docker bu kompyuterda o‘rnatilmagan; konteyner profili va PostgreSQL integratsiyasi bajarib tekshirilmagan.

```powershell
$env:POSTGRES_PASSWORD = 'choose-a-local-password'
docker compose up --build
# GPU / optional model runtime:
docker compose -f compose.yaml -f compose.gpu.yaml up --build
```

Docker qurilishidan avval `frontend` build kerak. Migratsiya service Alembic sxemasini qo‘llaydi va sintetik hisoblarni yaratadi. GPU profili qo‘shimcha AI kutubxonalari va NVIDIA Docker runtime talab qiladi. Xizmatlar default hostning faqat `127.0.0.1:8000` manzilini ochadi.

## Saqlash va tiklash

`runtime/aniq.db` — asosiy lokal baza; `runtime/files` — ruxsat bilan beriladigan asl hujjatlar; `models` — lokal vaznlar. Bular Gitga kiritilmaydi.

```powershell
.\.venv\Scripts\python.exe scripts/backup.py runtime/aniq.db work/aniq-backup.db
```

To‘liq arxiv uchun bazadan tashqari `runtime/files` ni ham alohida zaxiralang. Tiklash vaqtida backendni to‘xtating, backupni yangi joyda tekshiring, so‘ng kerakli baza va fayllarni bir xil snapshotdan tiklang. Faqat aniq `--reset-demo` buyrug‘i eski bazani zaxiralab almashtiradi; `--build-only` joriy ma’lumotlarni o‘zgartirmasdan yangi seedni tekshiradi.

## Chegaralar va keyingi tashqi bog‘liqliklar

1. Klinik qoida katalogi, tasdiqlangan bilim manbalari va dorilar normalizatsiyasi berilishi kerak. Hozirgi qoidalar demo-only.
2. KT avtomatik topilma / maska uchun mos model, test seriyalari va rentgenolog bahosi kerak. AI matn javobi segmentatsiya maskasi sifatida ko‘rsatilmaydi; tanlangan kadrlar qamrovi to‘liq hajm xulosasi emas.
3. AI bergan besh yillik ssenariy individual foizli prognoz emas. Alohida Framingham hisoblagichi faqat mos bemorlar uchun 10 yillik umumiy yurak-qon tomir xavfini hisoblaydi; O‘zbekiston uchun mahalliy kalibrlanmagan. Bu ikki natija bir xil model yoki muddat sifatida talqin qilinmaydi.
4. Real DMED va davlat hisobot transporti uchun API shartnomasi, ruxsatlar va tashqi integratsiya sinovi kerak.
5. Lokal Windowsda Tesseract binari yo‘q bo‘lsa skanerlangan PDF uchun OCR cheklovi ko‘rsatiladi; matnli PDF / DOCX / TXT ishlaydi. Docker image rus/ingliz Tesseract paketlarini o‘rnatadi. DOCX preview sahifa maketini emas, mantiqiy paragraf / jadval koordinatalarini beradi.
6. Hujjat parseri alohida 60 soniyalik jarayonda, lekin OS darajasida tarmoq / xotira sandboxi emas. DICOM decoder asosiy servisda. Ishlab chiqarishga chiqarishdan oldin mustahkam sandbox, monitor, backup siyosati, HTTPS, SSO va tashqi xavfsizlik auditi kerak.
7. Klinik ishlatish, ma’lumotlarni saqlash siyosati va bemor roziligi bo‘yicha tashkiliy talablar ushbu muhandislik testlari bilan tasdiqlanmaydi.

Hujjatlar: `docs/ARCHITECTURE.md`, `docs/TRACEABILITY.md`, `docs/TEST_REPORT.md`, `docs/MODEL_CARD.md`, `docs/MASTER_PROMPT_UZ.md`, `docs/ANALYSIS_UZ.md`. Namoyish ketma-ketligi: **`docs/DEMO_GUIDE_UZ.md`**. DICOM oynasi uchun bemor ma’lumotlarisiz `demo/synthetic-phantom.zip` qo‘shilgan.
