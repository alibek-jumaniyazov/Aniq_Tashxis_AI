# AniqTashxis.ai — texnik topshiriqning professional tahlili

Tahlil sanasi: 2026-yil 18-sentabr. Asos: taqdim etilgan `AniqTashxis_ai_TZ_v1_1_UZ.docx`, Avilab, 1.1-versiya, 2026-yil 17-sentabr. Hujjatning 23 bo‘limi va jadvallari o‘qildi. Bu ishning natijasi — tahlil va ishlab chiqish uchun tayyor prompt; dastur ushbu bosqichda yaratilgani yoki klinik tekshirilgani da’vo qilinmaydi.

## 1. Loyihaning asl mohiyati

AniqTashxis.ai — shifokorning qarorini mavjud dalillar bilan qayta tekshiradigan klinik yordam tizimi. Uning eng kuchli mahsulot xususiyati: **manba → tasdiqlangan fakt → tekshiruv → shifokor javobi → yangi ma’lumot kelganda qayta tekshiruv** zanjirini kuzatish mumkinligi.

Hujjat oddiy chatbotdan ko‘ra murakkabroq tizimni belgilaydi: ma’lumot kelib chiqishi, vaqt, holat versiyasi, kirish huquqi, dalil, inson tasdig‘i va audit birga ishlashi kerak. Loyiha sifatini bitta chiroyli AI javobi emas, shu zanjirning to‘g‘ri ishlashi ko‘rsatadi.

Xakaton uchun eng yaxshi namoyish — bir bemor holatini boshidan oxirigacha olib borish: hujjat yuklash, noaniq faktni tasdiqlash, asosli ogohlantirishni ko‘rish, manbasini ochish, yangi laboratoriya natijasi bilan qayta tahlil va shifokor izohini saqlash. Bu tavsiya hujjatdagi majburiy ssenariylarga asoslangan mahsulot dizayni xulosasidir.

## 2. Sizning talablaringiz qanday qo‘shildi

| Talab | Promptdagi qaror |
|---|---|
| React, Vite, TypeScript | Strict TypeScript, Vite, modulli React frontend |
| “and desgin” | Ant Design deb talqin qilindi; chuqur moslashtirilgan design tokenlar |
| Axios | Markaziy API client, yagona error modeli, seans, timeout, cancel va idempotency |
| Python REST backend | FastAPI, Pydantic, PostgreSQL, SQLAlchemy, Alembic |
| Professional frontend–backend aloqa | OpenAPIdan TypeScript turlari, TanStack Query, version conflict, real E2E |
| Lokal MedGemma 4B | Asosiy checkpoint `google/medgemma-1.5-4b-it`, lokal worker, offline ishlash tekshiruvi |
| O‘ziga xos animatsiyali dizayn | Dalillar yo‘li, vaqt linzasi, source drawer, versiyalar farqi, sokin KT kabineti |
| Xatolarsiz ishlash | Xatolarni oldini olish va boshqarish kontraktlari, AT-01–AT-13, build/test hisobotlari |

Ant Design talqini va qo‘shimcha kutubxonalar — amalga oshirish uchun taklif. Ular asl hujjatning o‘zida majburiy deb ko‘rsatilmagan. UI tili ham alohida ko‘rib chiqildi: TZ UI-01 default ruscha interfeysni talab qiladi, shuning uchun prompt ruscha default va o‘zbekcha switcherni belgilaydi. Promptning o‘zi o‘zbek tilida.

“Xatolarsiz” uchun tekshiriladigan mezon kerak: API xatosi yo‘q klinik xavf sifatida chiqmasligi, eski natija yangisini almashtirmasligi, ikki marta bosish dublikat yaratmasligi va ruxsatsiz foydalanuvchi ma’lumotni ko‘rmasligi. Prompt shu mezonlarni konkretlashtiradi; mutlaq xatosizlik va’dasini bermaydi.

## 3. Xakaton doirasi va keyingi bosqichlarni ajratish

| Funksiya | M0 xakaton natijasi | Keyingi bosqich |
|---|---|---|
| Kiritish | Qo‘lda, PDF/DOCX/TXT/skan, demo DMED | Rasmiy integratsiyalar, foto/ovoz/qo‘lyozma |
| Klinik tekshiruv | Tor populyatsiya va kelishilgan qoidalar | Keng katalog va yangi mutaxassisliklar |
| MedGemma | Lokal inference, manbali va validatsiyalangan output | Vazifaga mos qo‘shimcha validatsiya/adaptatsiya |
| KT | Plevral suyuqlik va tomoni, mos model bo‘lsa maska | Boshqa patologiyalar/modalitetlar |
| DMED | Belgili demo adapter, xatolik/revoke/resync ssenariylari | Operator bilan kelishilgan read-only almashuv |
| Prognoz | Ekran, eligibility, rad etish, null natija | Mos tasdiqlangan model bilan muayyan xavf hisobi |
| Eksport | Anonimlashtirilgan PDF/JSON, ikki alohida tasdiq, demo kvitansiya | Vakolatli haqiqiy transport va tartib |
| Xavfsizlik | Tenant/object permission, seans, audit, himoyalangan fayllar | Pilotga tegishli tashkiliy/huquqiy va texnik talablar |

Eng katta scope xavfi — M0, M1 va M2ni bitta relizga yig‘ish. Hujjat buni talab qilmaydi. Prompt to‘liq mahsulot arxitekturasini ko‘zda tutadi, lekin xakaton qabulini M0 bilan o‘lchaydi.

## 4. MedGemma bo‘yicha muhim texnik qaror

Rasmiy Google sahifasi MedGemma 1.5ning 4B multimodal variantini ko‘rsatadi; shuning uchun `google/medgemma-1.5-4b-it` tanlandi. Checkpoint matn va tasvir kiritishini qabul qiladi, chiqishi matndir. CT uchun maxsus preprocessing kerak; undan tayyor segmentatsiya maskasi chiqishini taxmin qilish mumkin emas. Modelga kirishda foydalanish shartlarini qabul qilish talab etiladi. [Google MedGemma](https://developers.google.com/health-ai-developer-foundations/medgemma), [aniq checkpoint](https://huggingface.co/google/medgemma-1.5-4b-it).

Shundan kelib chiqadigan arxitektura qarori: MedGemma dalilga tayangan matnli tahlil va ikkinchi fikrga xizmat qiladi; dasturiy qoidalar aniq mantiqni bajaradi; KT preprocessing/viewer/segmentatsiya alohida modullar; besh yillik ehtimol esa alohida prognostik model vazifasi.

Lokal ishlash bemor ma’lumotlarini tashqi AIga yubormaslikka yordam beradi. Biroq modelning javob sifati, tillar, tanlangan klinik vazifa va GPU unumdorligi ushbu loyiha muhitida hali o‘lchanmagan. 4B parametr sonidan aniq VRAM yoki javob vaqtini kafolatlab bo‘lmaydi. Prompt shu sabab model preflight, benchmark va model pasportini talab qiladi.

## 5. Hujjatning kuchli tomonlari

- Har ogohlantirishning dalili va kelib chiqishi majburiy.
- Hodisa vaqti, ma’lumot mavjud bo‘lgan vaqt va import vaqti ajratilgan.
- Shifokor izohi va AI bilan kelishmaslik saqlanadi; avtomatik ayblash yo‘q.
- Nomukammal ma’lumot uchun “tekshirish imkonsiz” natijasi mavjud.
- Natijalar holat va model/qoidalar versiyasiga bog‘langan.
- UI yashirishidan tashqari server ruxsat tekshiruvi talab qilingan.
- DMED va davlat integratsiyasi bo‘yicha haqiqiy ulanish da’vosiga ehtiyotkor yondashilgan.
- Klinik prognoz bilan LLM matnini aralashtirmaslik aniq yozilgan.
- Qabul testlari va o‘lchanadigan unumdorlik maqsadlari mavjud.

Shu xususiyatlar loyihani dalilsiz tashxis chatidan farqlaydi va himoyada tushuntirish uchun asos beradi.

## 6. Amalga oshirishdan oldin hal qilinadigan bo‘shliqlar

| Bo‘shliq yoki ziddiyat | Nima uchun muhim | Promptdagi yechim |
|---|---|---|
| Aniq tasdiqlangan klinik qoidalar berilmagan | Kod muallifi tibbiy thresholdni taxmin qilishi mumkin | Rule registry, approval status, demo-only fixture va klinik qabul gate |
| GPU/VRAM/RAM noma’lum | Model yuklanishi va vaqt maqsadi noma’lum | Preflight, single GPU concurrency, o‘lchangan quantization profili |
| Ruxsatli KT seriyalari/model vaznlari berilmagan | AT-05ni haqiqiy dalil bilan yopib bo‘lmaydi | Dastlabki feasibility, data/litsenziya manifesti, aniq blocker |
| Shifokor tasdiqlagan 30 test holati mavjud emas | Sintetik fixture klinik validatsiya emas | Texnik test va mustaqil klinik testni alohida ko‘rsatish |
| DMED metodlari/auth kontrakti berilmagan | Uydirma API bilan real integratsiya ko‘rsatish xavfi | Demo adapter; M1 kontrakti tasdiqlangach real adapter |
| 5 yillik model tanlanmagan | LLMning uydirma foizi paydo bo‘lishi mumkin | `probability=null`, eligibility va sabab, alohida RiskPredictor |
| 12-bo‘lim `/v1`, 23-bo‘lim prefikssiz | Frontend/backend yo‘llari mos kelmasligi mumkin | Ichki kontraktni yagona `/api/v1`ga keltirish |
| Upload 30 sahifa, benchmark 20 sahifa | Limit va performance va’dasi aralashishi mumkin | Qabul limiti va benchmark workloadini alohida saqlash |
| “Bemor so‘ziga ko‘ra” assertion ro‘yxatida | “Bor/yo‘q” va kelib chiqish bir o‘lchov emas | Assertion va provenance alohida maydonlarda |
| UI ruscha, jamoa muloqoti o‘zbekcha | UI tili AI klinik sifati bilan aralashishi mumkin | RU default, UZ UI; tillar bo‘yicha AI validatsiyasi alohida |
| Qo‘lda kiritish uchun source koordinatasi | Faqat fayl source bo‘lsa DATA-01/DB-01 buziladi | Form snapshot+field path, note span va import snapshot |
| DOСX sahifasi renderga bog‘liq | Dalil koordinatasi siljishi mumkin | Asl paragraph/cell offsets va pinned preview mapping |

Bu bo‘shliqlar butun loyiha ustida ishlashni to‘xtatishni talab qilmaydi. Ular kod, UI va test infratuzilmasini qurishdan mustaqil ravishda hal qilinadi; ammo tegishli klinik bandlarni bajarildi deb belgilashga ta’sir qiladi.

## 7. Tavsiya etilgan texnik tuzilma

Frontend uchun React/Vite/TypeScript + Ant Design foydalanuvchining talabiga mos. Ant Design `ConfigProvider` orqali token va tema moslashtirish imkonini beradi; promptdagi maxsus ko‘rinish shu mexanizmga tayanadi. [Ant Design theme hujjati](https://ant.design/docs/react/customize-theme/).

Backend uchun modulli FastAPI va alohida workerlar xakaton doirasiga mos: HTTP so‘rovi tez javob beradi, og‘ir hisob esa navbatda bajariladi. FastAPI rasmiy hujjatida og‘ir hisoblash uchun Celery kabi vositalarni ko‘rib chiqish tavsiya qilinadi. [FastAPI background tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/).

PostgreSQL klinik versiya va tranzaksiyalarni, protected storage asl fayllarni, Redis/Celery fon ishlarini saqlaydi/boshqaradi. PostgreSQL biznes holatining asosiy manbai bo‘ladi; Redis yo‘qolishi klinik natija yo‘qolishiga olib kelmasligi uchun persistent job holati va reconciliation kerak.

Yagona Axios client barcha komponentga bir xil seans va xato xatti-harakatini beradi; request/response interceptors uchun rasmiy mexanizm mavjud. [Axios interceptors](https://axios-http.com/docs/interceptors). TypeScript turlarini OpenAPIdan olish esa null, enum va field nomlari kelishmovchiligini kamaytirish uchun taklif etilgan muhandislik qaroridir.

## 8. Dizaynning mahsulotga xizmat qilishi

Promptdagi dizayn iliq oq, chuqur teal, to‘q siyoh va qorong‘i KT ish maydonidan tuzilgan. Asosiy ajralib turadigan jihat rang emas, axborot bilan ishlash usuli:

- dalildan ogohlantirishgacha yo‘l ko‘rinadi;
- vaqt rejimi almashsa qaysi ma’lumotlar ishlatilgani tushunarli bo‘ladi;
- alertdan asl hujjatdagi aniq parchaga bitta harakatda o‘tiladi;
- yangi va eski versiya orasidagi o‘zgarish ochiq;
- bajarilmagan tekshiruvlar ham natijaning bir qismi.

Animatsiya 120–260ms diapazondagi qisqa o‘tishlar bilan shu bog‘lanishlarni tushuntiradi. Soxta scanning, cheksiz pulsatsiya va backendga bog‘lanmagan progress klinik tizimda ishonchni pasaytiradi; prompt ularni kiritmaydi. Bu taklif qilingan dizayn konsepsiyasi, dunyoda hech qayerda uchramaydigan dizayn degan tekshirilmagan da’vo emas.

## 9. Asl hujjat bo‘limlarining qamrovi

| TZ bo‘limi | Master promptda qayerda yoritilgan |
|---|---|
| 1. Mahsulot chegaralari | 1, 20–22 |
| 2. Foydalanuvchi huquqlari | 5, 11–13, 18 |
| 3. Ma’lumot/import | 5–6, 16 |
| 4. Klinik tekshiruv | 4, 8, 18 |
| 5. Ikkinchi fikr/vaqt | 7–8, 23 |
| 6. Radiologiya | 3, 9, 18 |
| 7. Alert/insident | 8, 11 |
| 8. Idoraviy hisobot | 11–12, 18 |
| 9. UI va ssenariylar | 6, 13–15, 21 |
| 10. Arxitektura | 2–4, 17, 19 |
| 11. Ma’lumotlar modeli | 5 |
| 12. API | 12–13 |
| 13. AI/bilim bazasi | 3–4, 23 |
| 14. Xavfsizlik/pilot shartlari | 1, 11, 16, 22 |
| 15. Unumdorlik | 17 |
| 16. Qabul mezonlari | 18 |
| 17. Ish rejasi/xavflar | 20–22 |
| 18. Qarorlar/manbalar | 3–4, 20, 22 |
| 19. Uch input | 6, 18 AT-10 |
| 20. DMED | 6, 12, 16, 18 AT-11 |
| 21. Shifokor izohi | 5–7, 18 AT-12 |
| 22. Prognoz | 10, 18 AT-13 |
| 23. Qo‘shimcha kontrakt/testlar | 5, 12, 18 |

## 10. Qabulning amaliy tartibi

Avval model ishlashi, bitta end-to-end case va radiologiya imkoniyatini tekshirish kerak. Keyin shu oqimni uch kiritish usuli, versiyalar, rollar va eksport bilan kengaytirish maqsadga muvofiq. Dizayn shelli boshida yaratiladi, mayda vizual bezaklar asosiy oqim ishlagach tugatiladi.

To‘rtta alohida natija qayd etiladi:

1. Texnik ishlash: build, migratsiya, API, seans, frontend E2E.
2. AI integratsiyasi: haqiqiy MedGemma inference, schema/citation validation, xatoda rad etish.
3. Klinik baholash: qoidalar va shifokorlar belgilagan yopiq testlar; mavjud bo‘lmasa ochiq kamchilik.
4. Namoyish halolligi: sintetik data, demo integratsiya va oldindan hisoblangan natija yorliqlari.

Asl TZdagi CP1/CP2 sanalari va tashqi xakaton reglamentiga havolalar manba hujjatda berilgan kontekst sifatida qabul qilindi. Reglament fayllari bu so‘rovga biriktirilmagan; tashkilotchilarning joriy jadvali va eski kodga ruxsati mustaqil tasdiqlangani da’vo qilinmaydi. Shu sabab master prompt bajariladigan bosqichlarga qurildi.

## 11. Promptdan foydalanish

`AniqTashxis_MASTER_PROMPT_UZ.md` faylini to‘liq dasturchi agentga bering. U loyiha vazifasi, M0 chegarasi, texnologiya, dizayn, data schema, API, AI ichki prompti, test va topshirish talablarini bir joyda saqlaydi. Asl DOCX ham berilsa talablarni ID darajasida tekshirish yanada oson bo‘ladi.

Prompt aniq texnik topshiriqni kodga aylantirishni tezlashtiradi. Klinik katalog, modelga kirish, ruxsatli KT va apparat ma’lumotlarini esa mavjud bo‘lganidek ko‘rsatish kerak; ularsiz ushbu resurslarga bog‘liq klinik mezonlar bajarildi deb belgilanishi mumkin emas.
