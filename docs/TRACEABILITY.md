# TZ → implementatsiya → tekshiruv

Asos: foydalanuvchi taqdim etgan `AniqTashxis_ai_TZ_v1_1_UZ.docx` va tahlildan ishlab chiqilgan `MASTER_PROMPT_UZ.md`. Bu jadval to‘liq klinik qabul dalolatnomasi emas.

| Talab | Implementatsiya | Dalil / qolgan chegara |
| --- | --- | --- |
| Qo‘lda holat va fakt | React form + cases/facts API | backend + real brauzer E2E |
| Uch kirish usuli | Manual / document / DMED demo | upload va DMED scenariy API testlari |
| Hujjat parsing va provenance | PDF/TXT/DOCX parser + sahifa/blok span; lokal GGUF extraction | model taklifining aniq iqtibosi tekshiriladi; human confirmation; real sifat bahosi alohida |
| Manbaga qaytish | Source drawer + protected download | original bytes, tenant/case ruxsati testi |
| Fakt tuzatish va versiya | supersedes ledger, atomic version | stale/version conflict testi |
| Qaror vaqtiga tahlil | available/event cutoff | oldingi, kech kelgan, noma’lum va kelajak event testlari |
| Shifokor izohlari | note + private server draft | notes provenance va draft isolation; browser restore |
| AI 4B lokal | offline MedGemma adapter, schema guard | real RTX 3050 inference + HTTP → DB → production UI sinovi o‘tdi; klinik sifat bahosi alohida |
| Dori xavfi | demo exact-substance overlap | tasdiqlangan dori qoida bazasi yo‘q |
| Laboratoriya cheklovlari | completeness + not_evaluable | klinik threshold hisoblanmaydi |
| Klinik holat / qaror / order | case summary/diagnosis va fact.order_status | alohida Decision / MedicationOrder lifecycle jadvallari yo‘q |
| Alert review | state machine + rejection comment | qat’iy transition va izoh testi |
| KT ko‘rish | haqiqiy DICOM pixel, spatial order, window/level | sintetik DICOM test; OHIF/3D/segmentation yo‘q |
| Plevral suyuqlik/laterality | hujjat laterality tekshiruvi | avtomatik KT topilmasi modeli berilmagan |
| Radiologist tasdig‘i | qo‘lda visual review endpoint/UI | AI topilmasi sifatida ko‘rsatilmaydi |
| 1/3/5 yil risk | eligibility metadata va null | validatsiyalangan risk modeli berilmagan |
| Ekspert kabineti | incident decisions state machine | backend confirm/export testi |
| Alohida yuboruvchi | sender RBAC, approver separation | approve-before-send, version stale, anonymization |
| PDF / JSON / demo receipt | agregat eksport | PDF header + JSON content / small-group testi |
| RBAC/ABAC | tenant + grant + role, admin/analyst constraints | cross-tenant/case, admin, analyst testlari |
| Audit va idempotency | DB audit + unique key/hash | takror so‘rov/payload conflict |
| Job lifecycle | local persistent queue, cancel, retry | retry/dedup; distributed recovery cheklovi hujjatlangan |
| REST/frontend type contract | OpenAPI + generated TypeScript | auth/create tiplari generated; boshqa viewlar manual |
| PostgreSQL/Redis | compose + Alembic + Celery | SQLite migratsiya tekshirilgan; Docker/PG bajarilmagan |
| Backup/restore | sqlite backup + integrity check | alohida nusxada tekshiriladi; file archive operator vazifasi |
| Responsive/dizayn | AntD + custom teal CSS + Motion | desktop/390px screenshots va overflow assertion |

AT-01…AT-13 ni yakuniy “passed” deb belgilash uchun klinik katalog, KT modeli/data va real AI tekshiruvi kabi bog‘liqliklar ham yopilishi kerak. Quyidagi testlar muhandislik yo‘llarini tekshiradi; original klinik acceptance paketini to‘liq almashtirmaydi.
