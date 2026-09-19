# Obuna va platforma boshqaruvi API

Barcha yo‘llar `/api/v1` prefiksi bilan. JSON xatolar mavjud `{error:{code,message,details}}` shaklida. Sessiya cookie va `X-CSRF-Token` mutatsiyalarda majburiy. Ro‘yxatdan o‘tish va kirish tezligi cheklangan.

## Sotib olish

- `GET /billing/plans` → `{items, support_telegram, demo_mode}`. Tarif: `id,name,description,price_uzs,doctor_limit,period_months:1,active,is_custom,sort_order,version`. Standart: `solo` 150000 UZS/1 shifokor; `clinic10` 1390000/10; `clinic25` 2390000/25; `custom` narxi va limiti null, Telegram orqali kelishiladi.
- `GET /billing/payment-methods` → `{items}`. Usul: `id,name,card_number,recipient,instructions,active,is_demo,version`.
- `POST /auth/register` JSON `{clinic_name,name,email,password,phone,plan_id}` → 201 `{user,csrf_token}`. Parol 10–200 belgi. Yangi klinika obunasi pending; bemorlar yaratmaydi. Yakka tarif egasi doctor, jamoaviy tarif egasi owner. Egasi `is_clinic_owner:true`.
- `GET /billing/account` → `{managed,can_use_workspace,is_clinic_owner,clinic,subscription,usage,requests}`. Klinikada `id,name,owner_id,phone,status,version,created_at`; obunada `status,active,plan_id,plan_name,doctor_limit,price_uzs,starts_at,expires_at,internal_demo`; usage `{doctors,team_members}`.
- `POST /billing/requests`: multipart `plan_id,payment_method_id,plan_version,payment_method_version,file,payment_reference?`; majburiy `Idempotency-Key` kamida 8 belgi. PNG/JPEG/PDF, 10 MB gacha; PDF 1–10 sahifa, shifrsiz va faol scriptsiz. Klinikada bir vaqtda bitta pending ariza. Bir chek qayta ishlatilmaydi.
- Ariza: `id,tenant_id,clinic_name,plan_id,plan_name,price_uzs,doctor_limit,payment_method_id,payment_method_name,payment_recipient,payment_card_last4,payment_reference,is_demo,receipt_name,receipt_url,status,review_note,version,created_at,reviewed_at,granted_starts_at,granted_expires_at`.
- `GET /billing/requests/{id}/receipt`: faqat tegishli klinika egasi yoki developer; cache taqiqlangan, fayl klinik hujjatlardan alohida yopiq joyda saqlanadi.

Chek yuklash pul o‘tkazmaydi va pul tushganini isbotlamaydi. Developer bankdagi tushumni tekshirganidan keyin tasdiqlaydi. Avtomatik kartadan yechish yo‘q. Tarif narxi, joylar limiti, oluvchi va karta oxirgi raqamlari ariza topshirilganda saqlanadi. Narx/to‘lov usuli versiyasi o‘zgarsa 409, interfeys qayta yuklanishi kerak.

Tasdiqlash bir kalendar oy beradi. Bir tarifni uzaytirish amaldagi tugash sanasidan davom etadi; muddat tugagan bo‘lsa tasdiqlangan vaqtdan boshlanadi. Faol pullik tarifni boshqa tarifga o‘zgartirish support orqali yoki muddat tugagandan so‘ng. Bir arizani ikki marta tasdiqlash ikkinchi oyni bermaydi (409). Oyning 31-kuni keyingi oyda bo‘lmasa oxirgi kun olinadi.

## Jamoa

`GET /billing/team` → `{items,doctor_limit,doctors_used}`. A’zo: `id,tenant_id,email,name,role,active,version,is_clinic_owner,clinic_name`.

`POST /billing/team` `{name,email,password,role}`; `PATCH /billing/team/{id}` `{expected_version,name?,active?,role?,password?}`. Faqat klinika egasi. Klinik lavozimlar doctor/radiologist/expert shifokor limitiga kiradi; owner va ma’muriy lavozimlar kirmaydi. Umumiy jamoa limiti ham bor. O‘chirish hard-delete emas: active=false, barcha sessiyalar bekor qilinadi. Parol/rol o‘zgartirilganda ham sessiyalar bekor. Owner va developer hisoblari bu endpoint orqali o‘zgarmaydi.

## Developer

Faqat developer rolida; bemor ma’lumotlariga ruxsat bermaydi.

- `GET /developer/overview` → `clinics_total,active_subscriptions,pending_requests,doctors_total,approved_revenue_uzs,expiring_soon`.
- `GET /developer/clinics?q=&page=&page_size=` → `{items,total,page,page_size}`; har biri klinika + subscription + usage.
- `GET /developer/clinics/{id}` → account shakli, arizalar bilan.
- `POST /developer/clinics` `{name,phone,owner_name,owner_email,owner_password,plan_id}` → yangi pending klinika.
- `PATCH /developer/clinics/{id}` `{expected_version,name?,phone?,status?:active|suspended}`. Suspend barcha klinika sessiyalarini bekor qiladi; obuna o‘chirilmaydi.
- `GET /developer/users?tenant_id=&q=&page=&page_size=` → paginated jamoa shakli.
- `POST /developer/clinics/{id}/users` → TeamCreate; `PATCH /developer/users/{id}` → TeamPatch.
- `GET /developer/subscription-requests?status=&q=&page=&page_size=` → paginated arizalar.
- `POST /developer/subscription-requests/{id}/review` `{expected_version,decision:approved|rejected,note}` → `{request,subscription}`. Izoh 3–2000 belgi.
- `GET /developer/plans` → `{items,total}`; `POST /developer/plans` → tarif maydonlari, id majburiy; `PATCH /developer/plans/{id}` → qisman maydonlar + expected_version.
- `GET /developer/payment-methods` → `{items,total}`; `POST /developer/payment-methods` → to‘lov usuli maydonlari idsiz; `PATCH /developer/payment-methods/{id}` → qisman maydonlar + expected_version.

Mavjud sintetik klinikalar internal_demo sifatida davom etadi. Faqat `DEMO_MODE=true` holatida developer@demo.aniq / AniqDemo!2026 yaratiladi. Demo ma’lumotlar real bemorlar yoki haqiqiy tushumlar sifatida taqdim etilmaydi.
