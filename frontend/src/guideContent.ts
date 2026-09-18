interface Guide { title: string; intro: string; steps: string[]; faq: [string, string][] }
const entry = (uz: Guide, ru: Guide, en: Guide) => ({ uz, ru, en })
export const guideContent = {
  cases: entry({
    title: 'Ishni nimadan boshlayman?', intro: 'Bemor kartasini yaratish uchun faqat F.I.Sh. majburiy. Bemorning noyob kodini dastur avtomatik beradi.',
    steps: ['“Yangi holat”ni bosing va bemorning F.I.Sh. ni kiriting. Yosh, jins, telefon va shifokor izohlari ixtiyoriy.', 'Kartani saqlang. Kerak bo‘lsa, keyin bemor ma’lumotlarini to‘ldiring; kod o‘zgarmaydi.', '“Bemor ma’lumotlari” bo‘limiga yozuv yoki hujjat qo‘shib tasdiqlang, shifokor xulosasini kiriting va “AI bilan solishtirish”ni oching.'],
    faq: [['Bemor kodini kiritishim kerakmi?', 'Yo‘q. Dastur kodni avtomatik yaratadi va bemor kartasida ko‘rsatadi.'], ['Nimalarni to‘ldirish majburiy?', 'Faqat F.I.Sh. Yosh, jins, telefon raqami va shifokor izohlarini bo‘sh qoldirish mumkin. Yosh 0–120 oralig‘ida, to‘liq yillarda kiritiladi.'], ['Bemorni qanday topaman?', 'F.I.Sh., avtomatik kod yoki telefon bo‘yicha qidiring. Yuqoridagi sonli kartalar va navbat filtri ro‘yxatni saralaydi.']],
  }, {
    title: 'С чего начать работу?', intro: 'Для создания карточки обязательно только ФИО пациента. Программа автоматически присвоит уникальный код.',
    steps: ['Нажмите «Новый случай» и укажите ФИО пациента. Возраст, пол, телефон и комментарии врача необязательны.', 'Сохраните карточку. Остальные данные можно дополнить позже; присвоенный код сохранится.', 'Заполните «Данные пациента», подтвердите записи и добавьте «Заключение врача». Затем откройте «Сравнение с AI».'],
    faq: [['Нужно ли придумывать код пациента?', 'Нет. Программа создаёт код автоматически и показывает его в карточке пациента.'], ['Какие поля обязательны?', 'Только ФИО. Возраст, пол, номер телефона и комментарии врача можно не заполнять. Возраст указывается в полных годах от 0 до 120.'], ['Как найти пациента?', 'Ищите по ФИО, автоматическому коду или телефону. Карточки счётчиков и фильтр очереди сужают список.']],
  }, {
    title: 'Where do I start?', intro: 'Only the patient’s full name is required to create a record. The application assigns a unique code automatically.',
    steps: ['Select “New case” and enter the patient’s full name. Age, sex, phone number and doctor comments are optional.', 'Save the record. Add the remaining details later if needed; the assigned code stays unchanged.', 'Add and confirm records under “Patient data”, enter your “Doctor conclusion”, then open “AI comparison”.'],
    faq: [['Do I need to enter a patient code?', 'No. The application generates it automatically and displays it in the patient record.'], ['Which fields are required?', 'Only the full name. You may leave age, sex, phone number and doctor comments empty. Enter age in completed years, from 0 to 120.'], ['How do I find a patient?', 'Search by full name, automatic code or phone number. The count cards and queue filter narrow down the list.']],
  }),
  facts: entry({
    title: 'Klinik faktlarni qanday tayyorlayman?', intro: 'AI tasdiqlangan faktlar va ularning manbalariga tayanadi. Shifokor izohi yoki yuklangan faylning o‘zi barcha faktlarni avtomatik tasdiqlamaydi.',
    steps: ['“Qo‘lda kiritish”da fakt turi, nomi, qiymati va birlikni belgilang yoki hujjatdan fakt ajrating.', 'Manba, aniq iqtibos, kuzatuv vaqti va ma’lumot ma’lum bo‘lgan vaqtni kiriting.', 'Asl manbani tekshiring, so‘ng faktni tasdiqlang. Tahrir eski yozuvni tarixda saqlaydi.'],
    faq: [['Qiymat va birlikka nima yozaman?', 'Qiymatga manbadagi son yoki matnni, birlikka o‘sha manbada ishlatilgan birlikni yozing. Masalan, puls uchun qiymat 76 va birlik /min. Bu faqat to‘ldirish misoli.'], ['Vaqt noma’lum bo‘lsa-chi?', 'Taxminiy sana qo‘ymang. Bo‘sh qoldiring: vaqtga bog‘liq tekshiruv buni noma’lum deb ko‘rsatadi.'], ['“Barchasini tasdiqlash” nima qiladi?', 'Tasdiqlanmagan faktlarning hammasini tekshirilgan deb belgilaydi. Har bir qiymat, birlik, inkor va vaqtni manbadan tekshirgandan keyingina bosing.']],
  }, {
    title: 'Как подготовить клинические факты?', intro: 'AI использует подтверждённые факты и их источники. Комментарий врача или загруженный файл не подтверждает все факты автоматически.',
    steps: ['В ручном вводе выберите тип, название, значение и единицу или извлеките факты из документа.', 'Укажите источник, точную цитату, время события и время доступности информации.', 'Сверьте источник и подтвердите факт. При исправлении исходная запись остаётся в истории.'],
    faq: [['Что вводить в значение и единицу?', 'Переносите число или текст и единицу из источника. Например, для пульса: значение 76, единица /min. Это только пример заполнения.'], ['Что делать с неизвестным временем?', 'Оставьте поле пустым. Не придумывайте дату: проверка по времени отметит её как неизвестную.'], ['Что делает подтверждение всех фактов?', 'Помечает все неподтверждённые факты как проверенные. Сначала сверьте каждое значение, единицу, отрицание и время.']],
  }, {
    "title": "How do I prepare clinical facts?",
    "intro": "AI uses confirmed facts and their sources. Doctor comments or an uploaded file do not automatically confirm every fact.",
    "steps": [
        "In manual entry, select the fact type, name, value and unit, or extract facts from a document.",
        "Provide the source, exact quotation, observation time and the time the information became available.",
        "Check the original source and confirm the fact. Edits preserve the previous record in the history."
    ],
    "faq": [
        [
            "What goes in the value and unit fields?",
            "Copy the number or text and the unit from the source. For example, a pulse could have value 76 and unit /min. This is only a data-entry example."
        ],
        [
            "What if the time is unknown?",
            "Leave the field empty. Do not invent a date; time-based checks will mark it as unknown."
        ],
        [
            "What does “Confirm all” do?",
            "It marks every unconfirmed fact as verified. First check each value, unit, negation and time against its source."
        ]
    ]
}),
  decision: entry({
    title: 'Qarorni tekshirish qanday ishlaydi?', intro: 'Bu bo‘lim hujjat va faktlarning mosligini tekshiradi. Diagnostik taxminlar uchun “Diagnostik yordam” bo‘limidan foydalaning.',
    steps: ['Joriy ma’lumotlar yoki qaror qabul qilingan paytdagi ko‘rinishni tanlang.', 'MedGemma kerak bo‘lsa AI tugmasini yoqing va tekshiruvni boshlang.', 'Tekshiruv qamrovi, dalillar va ogohlantirishlarni ochib, javobingizni saqlang.'],
    faq: [['Qaror vaqtini qachon kiritaman?', 'Oldingi qarorni baholaganda uning haqiqiy vaqtini kiriting. Keyin ma’lum bo‘lgan ma’lumotlar o‘sha qarorga dalil sifatida qo‘shilmaydi.'], ['“Qisman” natija nimani bildiradi?', 'Ayrim tekshiruvlar bajarildi, boshqalariga ma’lumot yoki model yetishmadi. Qamrov va cheklovlarni o‘qing; bu “hammasi to‘g‘ri” degani emas.'], ['AI javobi chiqmasa nima qilaman?', 'Natijadagi sababni o‘qing: lokal model ulanishi, dalil yetishmasligi yoki ishlov berish xatosi bo‘lishi mumkin. Sababni bartaraf etib qayta urinib ko‘ring.']],
  }, {
    title: 'Как работает проверка решения?', intro: 'Раздел проверяет согласованность документов и фактов. Диагностические гипотезы доступны в разделе «Диагностический разбор».',
    steps: ['Выберите текущие данные или данные на момент исходного решения.', 'Включите MedGemma при необходимости и запустите проверку.', 'Откройте покрытие, доказательства и предупреждения; сохраните ответ врача.'],
    faq: [['Когда указывать время решения?', 'При оценке прошлого решения укажите его фактическое время. Более поздние данные не станут доказательствами для того момента.'], ['Что означает частичный результат?', 'Часть проверок выполнена; другим не хватило данных или модели. Изучите покрытие и ограничения: это не подтверждение корректности всего лечения.'], ['Почему нет ответа AI?', 'Прочитайте указанную причину: недоступность локальной модели, нехватка данных или ошибка обработки. Устраните причину и повторите запрос.']],
  }, {
    "title": "How does decision review work?",
    "intro": "This section checks the consistency of documents and facts. Use diagnostic review for diagnostic hypotheses.",
    "steps": [
        "Choose current data or the data available at the time of the original decision.",
        "Enable MedGemma if needed and start the review.",
        "Read the coverage, evidence and warnings, then save the doctor’s response."
    ],
    "faq": [
        [
            "When should I enter the decision time?",
            "When assessing a past decision, enter its actual time. Information that became available later will not be used as evidence for that moment."
        ],
        [
            "What does a partial result mean?",
            "Some checks ran; others lacked data or model access. Read the coverage and limitations. A partial result does not mean all care was correct."
        ],
        [
            "Why is there no AI response?",
            "Read the stated reason: the local model may be unavailable, evidence may be insufficient, or processing may have failed. Resolve the cause and try again."
        ]
    ]
}),
  clinical: entry({
    title: 'AI tahlilini qanday o‘qiyman?', intro: 'MedGemma shifokor tekshirishi uchun taxmin beradi. AI xulosasi bilan shifokor saqlagan klinik xulosa alohida ko‘rsatiladi.',
    steps: ['Shikoyat va qo‘shimcha kuzatuvlarni manbadan tasdiqlang.', 'Diagnostik tahlilni boshlang, natijadagi dalil havolalarini tekshiring.', 'Taxmin, zid dalil va aniqlashtirish savollarini baholab, shifokor xulosasini yozing.'],
    faq: [['Savollarning javobini qayerga yozaman?', 'Aniqlangan javobni yangi klinik fakt sifatida, manbasi va vaqti bilan kiriting va tasdiqlang. Keyin yangi tahlilni boshlang. Ma’lum bo‘lmagan javoblarni to‘qimang.'], ['“Eskirgan” natija nimani bildiradi?', 'Tahlildan keyin holat o‘zgargan. Eski javob tarix uchun saqlanadi; joriy ma’lumotlarga yangi tahlil kerak.'], ['AI taxmini tasdiqlangan tashxismi?', 'Yo‘q. MedGemma chiqishi tekshirish uchun taklifdir. Yakuniy klinik xulosani dalillarni tekshirgan shifokor alohida saqlaydi.']],
  }, {
    title: 'Как читать результат AI?', intro: 'MedGemma предлагает гипотезы для проверки врачом. Ответ AI и сохранённое клиническое заключение врача отображаются отдельно.',
    steps: ['Подтвердите жалобы и дополнительные наблюдения по источникам.', 'Запустите диагностический разбор и проверьте ссылки на доказательства.', 'Оцените гипотезы, противоречия и вопросы, затем запишите заключение врача.'],
    faq: [['Где ответить на уточняющие вопросы?', 'Добавьте выясненный ответ как клинический факт с источником и временем, подтвердите его и запустите новый разбор. Неизвестные ответы не придумывайте.'], ['Что значит устаревший результат?', 'После анализа случай изменился. Старый ответ сохранён для истории; текущим данным нужен новый разбор.'], ['Гипотеза AI — это диагноз?', 'Нет. Это предложение для проверки. Итоговое заключение отдельно сохраняет врач после проверки доказательств.']],
  }, {
    "title": "How do I read an AI analysis?",
    "intro": "MedGemma proposes hypotheses for a doctor to review. The AI output and the doctor’s saved clinical conclusion are displayed separately.",
    "steps": [
        "Confirm complaints and additional observations against their sources.",
        "Start diagnostic review and check the evidence links in the result.",
        "Assess the hypotheses, conflicting evidence and clarifying questions, then write the doctor’s conclusion."
    ],
    "faq": [
        [
            "Where do I answer clarifying questions?",
            "Add each established answer as a clinical fact with its source and time, confirm it and run a new analysis. Do not invent unknown answers."
        ],
        [
            "What does an outdated result mean?",
            "The case changed after the analysis. The old output remains in the history; the current information needs a new review."
        ],
        [
            "Is an AI hypothesis a confirmed diagnosis?",
            "No. It is a suggestion for review. A doctor saves the final clinical conclusion separately after checking the evidence."
        ]
    ]
}),
  radiology: entry({
    title: 'Tasvir bilan qanday ishlayman?', intro: 'DICOM ko‘rish, o‘lchash, lokal AI fikri va radiolog xulosasi bitta ish maydonida.',
    steps: ['Shaxssizlantirilgan DICOM yoki ZIP faylini yuklang va seriyani tanlang.', 'Kesim, oyna, masshtab va o‘lchovni sozlang. AI tanlangan kesimni tahlil qiladi.', 'AI kuzatuvlarini asl tasvir bilan solishtiring, keyin radiolog xulosasini yozing.'],
    faq: [['AI butun tekshiruvni baholaydimi?', 'Hozir tanlangan kesim va uning ko‘rinishi yuboriladi. Bitta tasvir javobini butun tekshiruv xulosasi deb qabul qilmang.'], ['O‘lchov nega millimetrda chiqmayapti?', 'DICOM ichida mos piksel oralig‘i bo‘lishi kerak. Geometriya yetarli bo‘lmasa ishonchli mm o‘lchovi chiqarilmaydi.'], ['AI yoki ko‘rish tugmasi nega yopiq?', 'Avval seriya va kesim to‘liq yuklanishi kerak. AI uchun ishlayotgan ko‘rish modeli va ruxsat etilgan rol ham talab qilinadi; sabab panelda ko‘rsatiladi.']],
  }, {
    title: 'Как работать с изображением?', intro: 'Просмотр DICOM, измерения, локальный AI и заключение рентгенолога — в одном пространстве.',
    steps: ['Загрузите обезличенный DICOM или ZIP и выберите серию.', 'Настройте срез, окно, масштаб и измерение. AI анализирует выбранный срез.', 'Сопоставьте наблюдения AI с оригиналом и запишите заключение рентгенолога.'],
    faq: [['AI оценивает всё исследование?', 'Сейчас отправляется выбранный срез с его настройками отображения. Ответ по одному изображению не является заключением по всему исследованию.'], ['Почему нет измерения в миллиметрах?', 'В DICOM нужен корректный шаг пикселя. Без подходящей геометрии достоверное измерение в мм недоступно.'], ['Почему действие недоступно?', 'Сначала дождитесь загрузки серии и среза. Для AI также нужны работающая модель с поддержкой изображений и разрешённая роль; причина указана в панели.']],
  }, {
    "title": "How do I work with an image?",
    "intro": "DICOM viewing, measurements, local AI observations and a radiologist’s report share one workspace.",
    "steps": [
        "Upload a de-identified DICOM or ZIP file and choose a series.",
        "Adjust the slice, window, zoom and measurements. AI analyzes the selected slice.",
        "Compare AI observations with the original image, then write the radiologist’s report."
    ],
    "faq": [
        [
            "Does AI assess the entire study?",
            "Currently, the selected slice and its display settings are sent for review. An answer about one image is not a report on the entire study."
        ],
        [
            "Why are measurements not in millimeters?",
            "The DICOM file needs valid pixel spacing. Reliable millimeter measurements are unavailable without suitable geometry."
        ],
        [
            "Why is viewing or AI review unavailable?",
            "Wait for the series and slice to finish loading. AI also requires a working vision model and an authorized role. The panel explains the reason."
        ]
    ]
}),
  risk: entry({
    title: 'Xavf hisobini qanday to‘ldiraman?', intro: 'Bu 10 yillik yurak-qon tomir xavfi hisobidir. Kiritilgan qiymatlar, moslik va formulaga asoslanadi; AI taxminiy foiz yaratmaydi.',
    steps: ['Holatdagi yosh va jinsni tekshiring, bosim va lipid qiymatlarini manbadan kiriting.', 'Birlikni to‘g‘ri tanlang va har bir Ha/Yo‘q savoliga aniq javob bering.', 'Qiymatlarni tasdiqlab hisoblang. Natija, cheklov va saqlangan kirish ma’lumotlarini ko‘ring.'],
    faq: [['Ha/Yo‘q javobi noma’lum bo‘lsa-chi?', 'Tasodifiy javob tanlamang. Kerakli ma’lumotni aniqlang; to‘liq va mos ma’lumot bo‘lmasa hisob asosli emas.'], ['Birlik nima uchun muhim?', 'mg/dL va mmol/L son jihatdan bir xil emas. Laboratoriya manbasidagi birlikni tanlang; birlikni o‘zgartirganda qiymatlarni qayta tekshiring.'], ['Nega foiz ko‘rinmayapti?', 'Yosh, jins, qiymatlar yoki modelning qo‘llanish shartlari mos kelmagan bo‘lishi mumkin. Natijada sanalgan sabablarni tekshiring.']],
  }, {
    title: 'Как заполнить расчёт риска?', intro: 'Это расчёт 10-летнего сердечно-сосудистого риска по данным и формуле. AI не придумывает процент вероятности.',
    steps: ['Проверьте возраст и пол случая, перенесите давление и липиды из источника.', 'Выберите единицу и явно ответьте на каждый вопрос «Да/Нет».', 'Подтвердите значения и рассчитайте риск. Изучите результат, ограничения и снимок входных данных.'],
    faq: [['Что делать, если ответ неизвестен?', 'Не выбирайте ответ случайно. Уточните сведения: без полных применимых данных расчёт необоснован.'], ['Почему важна единица?', 'mg/dL и mmol/L численно различаются. Выберите единицу лабораторного источника; при смене единицы перепроверьте значения.'], ['Почему процент не показан?', 'Возраст, пол, значения или условия применимости могли не подойти. Проверьте причины, перечисленные в результате.']],
  }, {
    "title": "How do I complete the risk calculation?",
    "intro": "This calculates 10-year cardiovascular risk from input data and a formula. AI does not invent a probability.",
    "steps": [
        "Check the case age and sex, then enter blood pressure and lipid values from their source.",
        "Select the correct unit and answer every Yes/No question explicitly.",
        "Confirm the values and calculate risk. Read the result, limitations and saved input snapshot."
    ],
    "faq": [
        [
            "What if a Yes/No answer is unknown?",
            "Do not choose at random. Establish the missing information; a calculation without complete, applicable data is not justified."
        ],
        [
            "Why does the unit matter?",
            "mg/dL and mmol/L have different numerical values. Select the unit shown in the laboratory source and recheck the values when changing units."
        ],
        [
            "Why is no percentage shown?",
            "The age, sex, values or model eligibility criteria may not be supported. Check the reasons listed in the result."
        ]
    ]
}),
  expert: entry({
    title: 'Ekspert ko‘rigini qanday olib boraman?', intro: 'Bu yerda shifokor yuborgan holat, ko‘rik sababi va ekspert qarori qayd qilinadi.',
    steps: ['Ro‘yxatdan ko‘rikni tanlang va asl holatni oching.', 'Manbalar va qaror kontekstini tekshiring, kerak bo‘lsa izoh so‘rang.', 'Mos holatni tanlab, nima tekshirilgani va qaror asosini yozing.'],
    faq: [['Ko‘rikka qanday holat yuboriladi?', 'Holat sahifasidagi “Ekspertga yuborish” tugmasini bosing. Qaysi qaror yoki tafovutni tekshirish kerakligini aniq yozing.'], ['Qaror matniga nima yozaman?', 'Ko‘rilgan dalillar, aniqlangan tafovut, xulosa va zarur keyingi qadamni yozing. Tekshirilmagan ma’lumotni tasdiqlangan deb ko‘rsatmang.']],
  }, {
    title: 'Как проводить экспертный разбор?', intro: 'Здесь сохраняются направленный случай, причина разбора и решение эксперта.',
    steps: ['Выберите разбор и откройте исходный случай.', 'Проверьте источники и контекст решения; при необходимости запросите объяснение.', 'Выберите статус и опишите, что проверено и на чём основано решение.'],
    faq: [['Как направить случай?', 'Нажмите «Направить эксперту» в случае и точно опишите проверяемое решение или расхождение.'], ['Что писать в решении?', 'Укажите изученные доказательства, найденное расхождение, вывод и следующий шаг. Не называйте непроверенные данные подтверждёнными.']],
  }, {
    "title": "How do I conduct an expert review?",
    "intro": "This section records the referred case, the reason for review and the expert’s decision.",
    "steps": [
        "Choose a review from the list and open the original case.",
        "Check the sources and decision context; request clarification if needed.",
        "Select the appropriate status and describe what you checked and the basis for your decision."
    ],
    "faq": [
        [
            "How do I refer a case?",
            "Select “Refer to expert” on the case page. Clearly describe the decision or discrepancy that needs review."
        ],
        [
            "What should I write in the decision?",
            "State the evidence reviewed, the discrepancy found, your conclusion and the next step. Do not describe unverified information as confirmed."
        ]
    ]
}),
  reports: entry({
    title: 'Hisobotni qanday tayyorlayman?', intro: 'Hisobot manbali paket sifatida yaratiladi, oldindan ko‘riladi va ruxsatli rol orqali tasdiqlanadi.',
    steps: ['Holat, hisobot maqsadi va yuborish asosini kiriting.', 'Tayyor paketni ochib tarkibini va shaxssizlantirishni tekshiring.', 'Vakolatli yuboruvchi tasdiqlaydi, so‘ng sinov yuborishini bajaradi.'],
    faq: [['Maqsad va asos farqi nima?', 'Maqsad — hisobot nima uchun tayyorlanayotgani. Asos — uni tayyorlash/yuborishga berilgan vakolat yoki topshiriq.'], ['Haqiqiy tashqi tizimga yuboriladimi?', 'Hozir sinov transporti ishlaydi. Yuborish kvitansiyasi haqiqiy davlat tizimiga yetkazilganini anglatmaydi.'], ['Nega tasdiqlash yopiq?', 'Amal vakolatli yuboruvchi roliga va paketning joriy holatiga bog‘liq. Qoralamani avval ko‘rib chiqing.']],
  }, {
    title: 'Как подготовить отчёт?', intro: 'Отчёт создаётся как пакет, проверяется в предпросмотре и утверждается уполномоченной ролью.',
    steps: ['Укажите случай, цель отчёта и основание передачи.', 'Откройте пакет и проверьте его состав и обезличивание.', 'Уполномоченный отправитель утверждает пакет и выполняет тестовую отправку.'],
    faq: [['Чем отличаются цель и основание?', 'Цель объясняет, зачем нужен отчёт; основание — полномочие или поручение на подготовку и передачу.'], ['Это отправка в реальную внешнюю систему?', 'Сейчас используется тестовый транспорт. Квитанция не подтверждает доставку в государственную систему.'], ['Почему утверждение недоступно?', 'Действие зависит от роли отправителя и текущего статуса пакета. Сначала изучите черновик.']],
  }, {
    "title": "How do I prepare a report?",
    "intro": "A report is created as a package, reviewed in a preview and approved by an authorized role.",
    "steps": [
        "Specify the case, the report’s purpose and the authority for transfer.",
        "Open the prepared package and check its contents and de-identification.",
        "An authorized sender approves the package and performs the test delivery."
    ],
    "faq": [
        [
            "How do purpose and authority differ?",
            "Purpose explains why the report is needed. Authority identifies the permission or instruction to prepare and transfer it."
        ],
        [
            "Is the report sent to a real external system?",
            "The current transport is a test service. A delivery receipt does not confirm delivery to a government system."
        ],
        [
            "Why is approval unavailable?",
            "The action depends on the sender’s role and the package’s current status. Review the draft first."
        ]
    ]
}),
  notes: entry({
    title: 'Izohni qanday yozaman?', intro: 'Izoh qaror kontekstini saqlaydi. AI uchun klinik dalil qo‘shish kerak bo‘lsa, alohida fakt kiriting va tasdiqlang.',
    steps: ['Izoh turi va haqiqiy kuzatuv vaqtini belgilang.', 'Qaror asosi yoki ogohlantirishga munosabatingizni aniq yozing.', 'Qoralama saqlanganini tekshiring va tayyor bo‘lganda “Saqlash”ni bosing.'],
    faq: [['Qoralama va saqlangan izoh farqi nima?', 'Qoralama faqat sizga ko‘rinadi. “Saqlash” bosilgach izoh holat tarixiga qo‘shiladi.'], ['Vaqt noma’lum bo‘lsa-chi?', 'Bo‘sh qoldiring. Taxminiy vaqt kiritmang; tizim uni noma’lum sifatida saqlaydi.']],
  }, {
    title: 'Как написать комментарий?', intro: 'Комментарий сохраняет контекст решения. Для клинического доказательства AI добавьте и подтвердите отдельный факт.',
    steps: ['Выберите тип и укажите фактическое время наблюдения.', 'Опишите обоснование решения или ответ на предупреждение.', 'Проверьте сохранение черновика; когда текст готов, нажмите «Сохранить».'],
    faq: [['Чем черновик отличается от записи?', 'Черновик виден только вам. После сохранения комментарий попадает в историю случая.'], ['Если время неизвестно?', 'Оставьте поле пустым. Не придумывайте время; система сохранит его как неизвестное.']],
  }, {
    "title": "How do I write a note?",
    "intro": "A note preserves the context of a decision. To add clinical evidence for AI, create and confirm a separate fact.",
    "steps": [
        "Select the note type and enter the actual observation time.",
        "Clearly explain the decision or your response to a warning.",
        "Check that the draft has been saved, then select “Save” when the text is ready."
    ],
    "faq": [
        [
            "How does a draft differ from a saved note?",
            "Only you can see the draft. Once saved, the note becomes part of the case history."
        ],
        [
            "What if the time is unknown?",
            "Leave the field empty. Do not invent a time; the system will record it as unknown."
        ]
    ]
}),
  settings: entry({
    title: 'Tizim holatini qanday tekshiraman?', intro: 'Bu bo‘lim model, xizmatlar, rollar va amallar jurnalini tushunishga yordam beradi.',
    steps: ['Model va xizmat kartalaridagi joriy holatni ko‘ring.', 'Ulanishni tekshirish tugmasi orqali holatni yangilang.', 'Xatoda ko‘rsatilgan sababni klinika administratoriga yetkazing.'],
    faq: [['Model “tayyor” bo‘lsa barcha javoblar to‘g‘rimi?', 'Tayyor holat modelga texnik ulanish borligini bildiradi. Har bir AI javobi dalillar bilan tekshirilishi kerak.'], ['Amallar jurnali nima uchun kerak?', 'Kim, qachon va qaysi resurs bilan ishlaganini kuzatish uchun. Undagi yozuvlar qayd etilgan amallar tarixidir.']],
  }, {
    title: 'Как проверить состояние системы?', intro: 'Раздел помогает понять состояние модели, сервисов, ролей и журнала действий.',
    steps: ['Посмотрите текущие статусы модели и сервисов.', 'Обновите состояние кнопкой проверки соединения.', 'Передайте администратору причину, указанную в сообщении об ошибке.'],
    faq: [['«Модель готова» гарантирует правильность ответов?', 'Это техническая доступность модели. Каждый ответ AI всё равно нужно сверять с доказательствами.'], ['Зачем нужен журнал?', 'Он показывает, кто, когда и с каким ресурсом выполнил действие. Это история зарегистрированных операций.']],
  }, {
    "title": "How do I check system status?",
    "intro": "This section explains the status of the model, services, roles and audit log.",
    "steps": [
        "Read the current status on the model and service cards.",
        "Refresh the status using the connection check button.",
        "Send the error’s stated reason to your clinic administrator."
    ],
    "faq": [
        [
            "Does “Model ready” guarantee correct answers?",
            "It means the model is technically available. Every AI response still needs to be checked against evidence."
        ],
        [
            "Why is there an audit log?",
            "It records who performed an action, when it happened and which resource was involved. It is a history of recorded operations."
        ]
    ]
}),
  account: entry({
    title: 'Obuna va xodimlarni qanday boshqaraman?', intro: 'Klinika egasi tarif, arizalar va jamoaga kirishni boshqaradi. Har bir xodim alohida hisob bilan kiradi.',
    steps: ['Joriy obuna muddati va bo‘sh shifokor o‘rinlarini tekshiring.', 'Faol obunada xodimning ismi, login emaili, roli va boshlang‘ich parolini kiriting.', 'Zarur bo‘lsa xodim rolini yangilang yoki kirishini faolsizlantiring.'],
    faq: [['Qaysi rollar tarif limitiga kiradi?', 'Faol shifokor, radiolog va klinik ekspert hisoblari shifokor o‘rnini egallaydi. Boshqa xizmat rollari shifokor o‘rnini egallamaydi.'], ['Obuna qanday uzaytiriladi?', 'Uzaytirish tugmasidan tarif va to‘lov chekini yuboring. Tasdiqlangach faol obuna tugash sanasidan bir oyga uzayadi.'], ['Xodim o‘zi jamoani o‘zgartira oladimi?', 'Jamoani klinika egasi boshqaradi. O‘z yoki egasi hisobini shu jadvaldan bloklash yopiq; yordam xizmatiga murojaat qiling.']],
  }, {
    title: 'Как управлять подпиской и командой?', intro: 'Владелец управляет тарифом, заявками и доступом команды. Каждый сотрудник входит под отдельным аккаунтом.',
    steps: ['Проверьте срок подписки и свободные места врачей.', 'При активной подписке укажите имя, email, роль и стартовый пароль сотрудника.', 'При необходимости измените роль или отключите доступ сотрудника.'],
    faq: [['Какие роли занимают место?', 'Активные врач, рентгенолог и клинический эксперт. Остальные служебные роли не занимают врачебное место.'], ['Как продлить подписку?', 'Нажмите продление и отправьте чек по тарифу. После подтверждения действующая подписка продлится на месяц от даты окончания.'], ['Кто меняет команду?', 'Владелец клиники. Блокировка своего аккаунта и аккаунта владельца через таблицу закрыта; обратитесь в поддержку.']],
  }, {
    "title": "How do I manage subscriptions and staff?",
    "intro": "The clinic owner manages the plan, requests and team access. Each employee signs in with a separate account.",
    "steps": [
        "Check the subscription expiry date and available doctor seats.",
        "With an active subscription, enter the employee’s name, sign-in email, role and initial password.",
        "Change an employee’s role or deactivate access when needed."
    ],
    "faq": [
        [
            "Which roles occupy a doctor seat?",
            "Active doctors, radiologists and clinical experts use doctor seats. Other service roles do not."
        ],
        [
            "How do I renew the subscription?",
            "Use the renewal button to submit the plan and payment receipt. Once approved, an active subscription is extended by a month from its expiry date."
        ],
        [
            "Can employees change the team themselves?",
            "The clinic owner manages the team. This table does not allow blocking your own account or the owner’s account; contact support."
        ]
    ]
}),
  checkout: entry({
    title: 'Obunani olish bo‘yicha savollar', intro: 'To‘lov qo‘lda tekshiriladi. Hisob ochishning o‘zi kartadan pul yechmaydi.',
    steps: ['Tarifni tanlang va hisob yarating yoki mavjud hisobga kiring.', 'Ko‘rsatilgan summa va rekvizitni tekshirib, to‘lovni o‘zingiz bajaring.', 'O‘sha to‘lov chekini yuklang, tasdiq belgisini qo‘ying va arizani yuboring.'],
    faq: [['Chekda nimalar ko‘rinishi kerak?', 'To‘lov sanasi, summa, qabul qiluvchi va tranzaksiya ma’lumotlari o‘qiladigan bo‘lsin. JPG, PNG yoki PDF, 10 MB gacha.'], ['Obuna qachon ishlaydi?', 'Developer to‘lovni tekshirib tasdiqlagandan keyin. Holat va tekshiruv izohi “Obuna va jamoa” sahifasida ko‘rinadi.'], ['Nega qayta ariza yubora olmayapman?', 'Kutilayotgan ariza bor bo‘lsa yangi ariza yopiq. Mavjud ariza holatini kabinetda tekshiring; rad etilganda sababni tuzatib yangi chek yuboring.']],
  }, {
    title: 'Вопросы об оформлении подписки', intro: 'Платёж проверяется вручную. Создание аккаунта само по себе не списывает деньги.',
    steps: ['Выберите тариф и создайте аккаунт или войдите в существующий.', 'Сверьте сумму и реквизиты, затем самостоятельно выполните перевод.', 'Загрузите чек этого перевода, подтвердите данные и отправьте заявку.'],
    faq: [['Что должно быть видно в чеке?', 'Читаемые дата, сумма, получатель и реквизиты транзакции. JPG, PNG или PDF до 10 МБ.'], ['Когда появится доступ?', 'После проверки и подтверждения разработчиком. Статус и комментарий видны на странице подписки и команды.'], ['Почему нельзя отправить повторно?', 'Пока заявка ожидает проверки, новая закрыта. Следите за статусом в кабинете; после отказа исправьте причину и отправьте новый чек.']],
  }, {
    "title": "Questions about subscribing",
    "intro": "Payments are reviewed manually. Creating an account does not charge your card.",
    "steps": [
        "Choose a plan and create an account or sign in to an existing one.",
        "Check the amount and payment details, then make the transfer yourself.",
        "Upload the receipt for that transfer, confirm the information and submit your request."
    ],
    "faq": [
        [
            "What must be visible in the receipt?",
            "The date, amount, recipient and transaction details must be readable. Use JPG, PNG or PDF, up to 10 MB."
        ],
        [
            "When will access become available?",
            "After the developer reviews and approves the payment. The status and review comment appear on the subscription and team page."
        ],
        [
            "Why can’t I submit another request?",
            "A new request is unavailable while one is awaiting review. Check its status in your account. If rejected, address the reason and submit a new receipt."
        ]
    ]
}),
  developer: entry({
    title: 'Platformani boshqarish tartibi', intro: 'Bu bo‘lim obuna arizalari, klinikalar, xodimlar va tariflarning haqiqiy holatini o‘zgartiradi.',
    steps: ['Arizani ochib chek, summa va tanlangan tarifni solishtiring.', 'Tekshiruv natijasini izoh bilan tasdiqlang yoki rad eting.', 'Klinika, obuna va xodim holatini tegishli bo‘limlarda tekshiring.'],
    faq: [['Tasdiqlash nimani o‘zgartiradi?', 'Arizadagi tarif bo‘yicha obuna faollashadi yoki uzayadi. Demo ariza ko‘rsatmalari alohida belgilanadi.'], ['Tarif narxini o‘zgartirsam eski arizalar o‘zgaradimi?', 'Ariza topshirilgandagi summa va shartlar arizada saqlanadi. O‘zgargan tarif yangi tanlovlar uchun ishlatiladi.'], ['Nega ayrim boshqaruvlar cheklangan?', 'Egasi, o‘z hisobi, so‘nggi faol developer yoki mavjud jamoa limiti kabi himoya qoidalari bor. Sabab haqidagi xabarni o‘qing.']],
  }, {
    title: 'Порядок управления платформой', intro: 'Действия здесь меняют реальное состояние заявок, клиник, сотрудников и тарифов.',
    steps: ['Откройте заявку, сопоставьте чек, сумму и выбранный тариф.', 'Подтвердите или отклоните с комментарием по результату проверки.', 'Проверьте состояние клиники, подписки и сотрудников в соответствующих разделах.'],
    faq: [['Что меняет подтверждение?', 'Активирует или продлевает подписку по тарифу заявки. Демонстрационные заявки отдельно обозначены.'], ['Новая цена меняет старую заявку?', 'Сумма и условия на момент подачи сохранены в заявке. Обновлённый тариф используется для новых выборов.'], ['Почему некоторые действия ограничены?', 'Есть защита владельца, собственного аккаунта, последнего активного разработчика и лимитов команды. Прочитайте указанную причину.']],
  }, {
    "title": "How to manage the platform",
    "intro": "Actions here change the actual state of subscription requests, clinics, staff and plans.",
    "steps": [
        "Open a request and compare the receipt, amount and selected plan.",
        "Approve or reject it with a comment explaining your review.",
        "Check the clinic, subscription and employee status in their respective sections."
    ],
    "faq": [
        [
            "What changes when I approve a request?",
            "The subscription is activated or extended using the requested plan. Demonstration requests are labeled separately."
        ],
        [
            "Does changing a price affect existing requests?",
            "The amount and terms at submission are preserved in the request. The updated plan applies to new selections."
        ],
        [
            "Why are some controls restricted?",
            "Safeguards protect the owner, your own account, the last active developer and team limits. Read the explanation shown."
        ]
    ]
}),
}
export type GuideTopic = keyof typeof guideContent
