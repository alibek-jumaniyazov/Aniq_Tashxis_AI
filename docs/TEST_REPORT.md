# Tekshiruv hisoboti — 2026-09-18

Muhit: Windows 11, Python 3.12.10, Node 22.18, mahalliy Chrome, SQLite. Sintetik ma’lumotlar ishlatildi. Hech qanday klinik accuracy da’vosi yo‘q.

| Tekshiruv | Natija |
| --- | --- |
| Backend pytest | 42 test bitta yakuniy run’da o‘tdi (33.53 s) |
| Frontend Vitest | 3 test o‘tdi |
| TypeScript + Vite build | o‘tdi, circular chunk ogohlantirishi tuzatildi |
| ESLint | o‘tdi |
| Ruff | o‘tdi |
| pip check | o‘tdi |
| Playwright Chrome | 4 ta real API E2E testi o‘tdi (58.6 s) |
| Production bundle, FastAPI 8000 | kirish / seeded holat / RU-UZ / 390px; pageerror yo‘q |
| npm audit | production va dev paketlarda 0 topilgan zaiflik; Vitest 4.1.11 ga yangilandi |
| Alembic upgrade / schema check | alohida SQLite bazasida o‘tdi |
| SQLite backup / readback | integrity_check=ok; case count teng |
| Compose / CI YAML | parse o‘tdi; Docker ishlatib ko‘rilmagan |
| Lokal llama.cpp Vulkan binary | SHA-256 tasdiqlandi; --version ishladi |
| Real MedGemma inference | o‘tdi: RTX 3050, llama.cpp Vulkan1, Q4_K_M |
| Real API → model → DB → production UI | TXTdan 2 fakt (5.3 s), tasdiq, sharh (6.5 s), interfeysda aynan shu natija |
| Klinik qoidalar / KT / risk validatsiyasi | bajarilmagan; kerakli katalog / model / ma’lumot yo‘q |

Asosiy backend sinovlari: manbali faktlar, tasdiqlash, kech kelgan ma’lumot, noto‘g‘ri versiya, idempotency, CSRF, tenant va object isolation, DMED revoke/mismatch, hujjatning asl baytlari, ZIP traversal, DICOM geometriya/slice tartibi va ruxsatli PNG, qoralama maxfiyligi, qayta tahlilda dedup, AI JSON/source tekshiruvi, local-only server URL, ekspert va yuboruvchi ajratilishi, anonim agregat va kichik guruh sonini yashirish.

Brauzer ssenariylari:

1. Kirish → holat → tasdiqlangan fakt → tahlil → AI yo‘qligida partial holat → desktop / 390px overflow tekshiruvi.
2. TXT hujjat → manbani ochish → shaxsiy avtomatik qoralama → reload’dan tiklash → izoh saqlash → UZ interfeys.
3. Mustaqil ekspert tasdig‘i → paket yaratish → boshqa sender tasdig‘i → mock yuborish → PDF yuklash → analyst uchun identifikatorsiz ko‘rinish.
4. Sintetik geometrik DICOM phantom → ZIP import → real 256×256 piksel → kesim almashtirish → oyna sozlamasi → maska yo‘qligi.

Playwright alohida `runtime/e2e.db` va 8001/5174 portlaridan foydalanadi. Pytest vaqtinchalik alohida bazada ishlaydi. Hozirgi mavjud deprecation ogohlantirishlari Starlette/httpx test transportiga tegishli; testlar muvaffaqiyatli yakunlangan.

Tekshiruv chegarasi: masofaviy CI, Docker/PostgreSQL/Redis/GPU container, real DMED/ministry, production yuklama, tibbiy model samaradorligi va xavfsizlikning mustaqil tashqi auditi bajarilmagan. UI’dagi qoida demo yorliqlari va null risk shu chegaralarni aks ettiradi.

Dependency tuzatishi: [Vitest maintainer advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9) bo‘yicha test dependency 4.1.11 ga yangilandi. Unit testlar yangi versiyada qayta o‘tdi. Audit natijasi shu tekshiruv vaqtidagi package metadata’ga bog‘liq; to‘liq xavfsizlik auditi degani emas.

Haqiqiy model tekshiruvi `grounded-review-1.2` / `document-extract-1.2` bilan yakunlandi. Model vazni va runtime nazorat summalari provider metadata bilan mos. Videoxotirada taxminan 2.6 GB kuzatildi. Test matni: `Synthetic engineering record. Pulse: 70 /min. SpO2: 97%.` Model takliflari asl iqtibos bilan tekshirildi, birliklar literal matndan olindi, tasdiqlanmagan holda saqlandi, so‘ng sintetik testdagi tasdiq amali bajarildi. Sharh `case_version=4` ga mos va eskirmagan; frontendda matn API natijasiga tengligi tekshirildi.

`partial` job holati AI ishlamayotganini anglatmaydi: ushbu misolda AI javobi bor, ammo klinik qoida katalogi va ayrim kerakli manbalar yo‘q. Bu sabablar qamrovda ochiq ko‘rsatiladi. Dastlabki real testdagi noto‘g‘ri jins taxmini, mavjud qiymatni yetishmayotgan deyish va ortiqcha metadata uchun tuzatishlar / regressiya testlari kiritildi. Modelning erkin matni klinik jihatdan to‘liq tekshirilgan deb hisoblanmaydi.
# Realistic seed update — 2026-09-18

The active local database was replaced using `scripts/reset_demo.py --reset-demo`. The previous database and protected files were preserved together under `runtime/backups/20260918T090504401920Z/`; SQLite integrity check returned `ok` (9 previous cases). The replacement contains 18 main-tenant synthetic cases, 7 staff roles, 58 sources, 93 fact revisions, 33 notes, 13 incidents, 5 phantom CT studies, and 3 exports in draft/approved/sent states. A separate tenant contains one isolation fixture.

Validation for this update:

- Backend: **48 tests passed**, including **6** new seed workflow/integrity tests. The seed tests were rerun after adding alert review histories and passed.
- Python Ruff and frontend ESLint passed; TypeScript/Vite production build passed; **3 frontend unit tests passed**.
- Existing isolated browser workflow suite: **4 tests passed** (sources, drafts, clinical workflow, radiology and governance).
- Live seeded application browser suite: **7 tests passed**, one for each role, with Uzbek interface, role landing page, populated data, permissions and **390 px mobile layout**. A horizontal overflow in reports/rules tables was found, corrected with contained table scrolling, and the full 7-role suite passed on rerun.
- Live MedGemma 1.5 4B Q4_K_M via llama.cpp generated and persisted actual summaries for **AT-2609-009** and **AT-2609-015**. Both have `ai != null`, `limitations: []` at the inference transport level, and truthful `partial` overall status because the approved clinical rule catalog is absent. The resulting total is 20 saved analyses (18 authored rule runs plus 2 real model runs).
- Source bytes match saved SHA-256; fact excerpts resolve; incident/export snapshots remain current. The existing seed is not duplicated on application restart.
- The live FastAPI service responds `alive` on port 8000. Model service remains local on port 8081.

Seed run histories are explicitly synthetic. Rule outputs are computed by the actual rule engine; AI output is never fabricated by the seed. DICOM files are geometric phantoms, and report transmission remains a local mock. These checks establish engineering behavior, not medical validity.
