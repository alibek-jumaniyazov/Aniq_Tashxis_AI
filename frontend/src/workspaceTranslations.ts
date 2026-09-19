export const workspaceRu = {
  fieldAliasHelp: 'Короткий уникальный код случая в вашей клинике. Например, AT-2026-015.',
  fieldAgeHelp:
    'Полных лет. Неизвестный возраст оставьте пустым. Текущий рабочий контур — взрослые 18–120 лет.',
  fieldSummaryHelp:
    'Основные жалобы, когда появились и как изменились. Для AI добавьте соответствующие подтверждённые факты.',
  fieldDiagnosisHelp:
    'Уже имеющееся рабочее заключение врача, если оно есть. Не заполняйте догадкой.',
  fieldFactTypeHelp:
    'Выберите, что наблюдали. Тип помогает системе связать факт с нужной проверкой.',
  fieldFactLabelHelp: 'Понятное название наблюдения из источника, например «Пульс при осмотре».',
  fieldFactValueHelp:
    'Перенесите исходное число или текст. Если значение неизвестно, оставьте пустым.',
  fieldFactUnitHelp:
    'Единица ровно как в источнике: %, /min, mmHg и т. д. Для текстового факта не нужна.',
  fieldAssertionHelp:
    '«Документировано» — есть наблюдение; «отрицается» — явно отрицается; «не указано» — источник не сообщает.',
  fieldProvenanceHelp:
    'Откуда получена информация: ручная запись, бумага, слова пациента или документ.',
  fieldEventHelp:
    'Когда произошло наблюдение или измерение. Укажите местное время; неизвестное оставьте пустым.',
  fieldAvailableHelp:
    'Когда эта информация стала доступна врачу. Нужно для честной проверки прошлого решения.',
  fieldOrderHelp:
    'Для назначения укажите, действует ли оно. Для жалобы или измерения выберите «Не применимо».',
  factQuoteLabel: 'Точная цитата из источника',
  factQuoteHelp:
    'Скопируйте фразу из открытого документа без изменений. Система проверит наличие цитаты в источнике.',
  factQuotePlaceholder: 'Вставьте точный фрагмент документа',
  fieldReviewHelp:
    'Укажите, что проверили по источнику, почему согласны или не согласны и какой следующий шаг нужен.',
  fieldIncidentHelp:
    'Опишите конкретный вопрос для эксперта и какие данные или решение вызывают сомнение.',
  factSymptom: 'Жалоба / симптом',
  factSpo2: 'Сатурация SpO₂',
  factPulse: 'Пульс',
  factPressure: 'Систолическое давление',
  factAllergy: 'Вещество, вызывающее аллергию',
  factMedication: 'Назначенный препарат / вещество',
  factPotassium: 'Калий',
  factCholesterol: 'Общий холестерин',
  factSide: 'Сторона в описании исследования',
  factSmoking: 'Курение',
  analysisActiveHint:
    'Для этого случая уже идёт обработка. Дождитесь результата или отмените текущий запуск в соответствующем разделе.',
  analysisCutoffHint: 'Выберите дату и время исходного решения, чтобы запустить проверку.',
  readOnlyCaseHint:
    'Ваша роль позволяет просматривать данные случая. Клинические факты изменяет лечащий врач.',
  bulkConfirmHelp:
    'Проверьте все исходные значения перед подтверждением. Подтверждение делает факты доступными AI.',
  emptySearchHelp: 'Измените поисковый запрос или выберите «Все случаи».',
  resetSearch: 'Сбросить поиск и фильтр',
  uploadProcessing: 'Файл передан. Сервер проверяет и обрабатывает документ…',
  uploadInProgress: 'Документ загружается…',
  uploadConsentHelp:
    'Сначала подтвердите принадлежность документа этому случаю. Затем станет доступен выбор файла.',
  WORKER_INTERRUPTED: 'Обработка прервалась при перезапуске сервера. Повторите анализ.',
}
export const workspaceUz: typeof workspaceRu = {
  fieldAliasHelp: 'Klinikangizdagi holat uchun qisqa, ajralib turadigan kod. Masalan, AT-2026-015.',
  fieldAgeHelp:
    'To‘liq yosh. Noma’lum bo‘lsa bo‘sh qoldiring. Joriy ish doirasi — 18–120 yoshdagi kattalar.',
  fieldSummaryHelp:
    'Asosiy shikoyatlar, qachon boshlangan va qanday o‘zgarganini yozing. AI uchun tegishli tasdiqlangan faktlarni ham kiriting.',
  fieldDiagnosisHelp:
    'Shifokorning mavjud ishchi xulosasi bo‘lsa kiriting. Ma’lum bo‘lmasa taxmin yozmang.',
  fieldFactTypeHelp:
    'Qanday kuzatuv ekanini tanlang. Tur faktni tegishli tekshiruv bilan bog‘lashga yordam beradi.',
  fieldFactLabelHelp: 'Manbadagi kuzatuvning tushunarli nomi, masalan “Ko‘rik paytidagi puls”.',
  fieldFactValueHelp: 'Asl son yoki matnni ko‘chiring. Qiymat noma’lum bo‘lsa bo‘sh qoldiring.',
  fieldFactUnitHelp:
    'Manbadagi birlikni aynan yozing: %, /min, mmHg va hokazo. Matnli faktga birlik kerak emas.',
  fieldAssertionHelp:
    '“Hujjatlangan” — kuzatuv bor; “inkor etilgan” — aniq rad etilgan; “ko‘rsatilmagan” — manbada yozilmagan.',
  fieldProvenanceHelp: 'Ma’lumot qayerdan olingan: qo‘lda yozuv, qog‘oz, bemor so‘zi yoki hujjat.',
  fieldEventHelp:
    'Kuzatuv yoki o‘lchov qachon bo‘lgan? Mahalliy vaqtni yozing, noma’lum bo‘lsa bo‘sh qoldiring.',
  fieldAvailableHelp:
    'Bu ma’lumot shifokorga qachon ma’lum bo‘lgan? Oldingi qarorni vaqtiga mos tekshirish uchun kerak.',
  fieldOrderHelp:
    'Tayinlov bo‘lsa faol yoki bekor qilinganini belgilang. Shikoyat va o‘lchov uchun “Tegishli emas”ni tanlang.',
  factQuoteLabel: 'Manbadan aniq iqtibos',
  factQuoteHelp:
    'Ochiq hujjatdan jumlani o‘zgartirmay ko‘chiring. Tizim iqtibos manbada borligini tekshiradi.',
  factQuotePlaceholder: 'Hujjatdan aniq parchani joylashtiring',
  fieldReviewHelp:
    'Manbadan nimani tekshirdingiz, nega rozi yoki norozi ekaningiz va keyingi qadamni yozing.',
  fieldIncidentHelp:
    'Ekspert uchun aniq savolni va qaysi ma’lumot yoki qaror shubha tug‘dirganini yozing.',
  factSymptom: 'Shikoyat / alomat',
  factSpo2: 'SpO₂ saturatsiya',
  factPulse: 'Puls',
  factPressure: 'Sistolik qon bosimi',
  factAllergy: 'Allergiya chaqiruvchi modda',
  factMedication: 'Tayinlangan dori / modda',
  factPotassium: 'Kaliy',
  factCholesterol: 'Umumiy xolesterin',
  factSide: 'Tekshiruv tavsifidagi tomon',
  factSmoking: 'Chekish holati',
  analysisActiveHint:
    'Bu holat bo‘yicha ishlov berish davom etmoqda. Natijani kuting yoki tegishli bo‘limda joriy tahlilni bekor qiling.',
  analysisCutoffHint: 'Tekshiruvni boshlash uchun dastlabki qarorning sana va vaqtini tanlang.',
  readOnlyCaseHint:
    'Rolingiz holat ma’lumotlarini ko‘rishga ruxsat beradi. Klinik faktlarni davolovchi shifokor o‘zgartiradi.',
  bulkConfirmHelp:
    'Tasdiqlashdan oldin barcha qiymatlarni asl manbadan tekshiring. Tasdiqlangan faktlar AI uchun ochiladi.',
  emptySearchHelp: 'Qidiruv matnini o‘zgartiring yoki “Barcha holatlar”ni tanlang.',
  resetSearch: 'Qidiruv va filtrni tozalash',
  uploadProcessing: 'Fayl yuborildi. Server hujjatni tekshirib, qayta ishlayapti…',
  uploadInProgress: 'Hujjat yuklanmoqda…',
  uploadConsentHelp:
    'Avval hujjat shu holatga tegishli ekanini tasdiqlang. Shundan keyin fayl tanlash ochiladi.',
  WORKER_INTERRUPTED: 'Server qayta ishga tushganda ishlov berish uzildi. Tahlilni qayta boshlang.',
}

export const workspaceEn: typeof workspaceRu = {
  fieldAliasHelp: 'A short, unique case code within your clinic. For example, AT-2026-015.',
  fieldAgeHelp:
    'Age in completed years. Leave blank if unknown. The current workspace supports adults aged 18–120.',
  fieldSummaryHelp:
    'Describe the main symptoms, when they started and how they changed. Also add the corresponding confirmed facts for AI review.',
  fieldDiagnosisHelp:
    'Enter the clinician’s existing working conclusion, if there is one. Do not fill this with a guess.',
  fieldFactTypeHelp:
    'Select the type of observation. This helps link the fact to the relevant check.',
  fieldFactLabelHelp:
    'Use a clear observation name from the source, such as “Pulse at examination”.',
  fieldFactValueHelp: 'Copy the original number or text. Leave blank if the value is unknown.',
  fieldFactUnitHelp: 'Use the exact source unit: %, /min, mmHg, etc. Text facts do not need units.',
  fieldAssertionHelp:
    '“Documented” means an observation is present; “denied” means explicitly denied; “not documented” means the source does not say.',
  fieldProvenanceHelp:
    'Where the information came from: a manual entry, paper, the patient or a document.',
  fieldEventHelp:
    'When the observation or measurement happened. Enter local time; leave blank if unknown.',
  fieldAvailableHelp:
    'When this information became available to the clinician. This enables a review based on what was known at the time.',
  fieldOrderHelp:
    'For a prescription, specify whether it is active. For a symptom or measurement, select “Not applicable”.',
  factQuoteLabel: 'Exact source quotation',
  factQuoteHelp:
    'Copy a phrase from the open document without changing it. The system will check that the quotation exists in the source.',
  factQuotePlaceholder: 'Paste an exact excerpt from the document',
  fieldReviewHelp:
    'Explain what you checked in the source, why you agree or disagree, and what should happen next.',
  fieldIncidentHelp:
    'Describe the specific question for an expert and the data or decision that needs review.',
  factSymptom: 'Presenting symptom',
  factSpo2: 'SpO₂ oxygen saturation',
  factPulse: 'Pulse',
  factPressure: 'Systolic blood pressure',
  factAllergy: 'Allergy-causing substance',
  factMedication: 'Prescribed medicine / substance',
  factPotassium: 'Potassium',
  factCholesterol: 'Total cholesterol',
  factSide: 'Laterality in imaging report',
  factSmoking: 'Smoking status',
  analysisActiveHint:
    'Processing is already running for this case. Wait for the result or cancel the current run in its section.',
  analysisCutoffHint: 'Select the date and time of the original decision to start the review.',
  readOnlyCaseHint:
    'Your role allows you to view this case. The treating clinician edits clinical facts.',
  bulkConfirmHelp:
    'Check all original values before confirming. Confirmed facts become available to AI.',
  emptySearchHelp: 'Change your search or select “All cases”.',
  resetSearch: 'Clear search and filter',
  uploadProcessing: 'File sent. The server is checking and processing the document…',
  uploadInProgress: 'Uploading document…',
  uploadConsentHelp:
    'First confirm that the document belongs to this case. You will then be able to select a file.',
  WORKER_INTERRUPTED: 'Processing was interrupted by a server restart. Run the analysis again.',
}
