export const patientWorkspaceRu = {
  pw_order_stopped: 'Приём прекращён',
  pw_subjective: 'Субъективные данные',
  pw_objective: 'Объективные данные',
  pw_laboratory: 'Лабораторные данные',
  pw_instrumental: 'Инструментальные данные',
  pw_doctor_conclusion: 'Заключение врача',
  pw_comparison: 'Сравнение с AI',
  pw_forecast: 'Прогноз на 5 лет',
  pw_subjective_hint:
    'Что рассказывает пациент: жалобы, развитие симптомов, история болезни, принимаемые препараты и аллергии.',
  pw_objective_hint:
    'Что установлено при осмотре: общее состояние, показатели жизнедеятельности и результаты физикального обследования.',
  pw_laboratory_hint:
    'Результаты анализов с датой, единицами измерения и референсными значениями лаборатории.',
  pw_instrumental_hint:
    'Протоколы и заключения исследований. DICOM-изображения открываются в отдельном окне радиологии.',
  pw_doctor_conclusion_hint:
    'Ваш рабочий диагноз, клиническое обоснование и план лечения. AI сопоставит их с подтверждёнными данными пациента.',
  pw_subjective_example:
    'Жалобы и начало симптомов\nКак менялось состояние\nИстория болезни, препараты, аллергии\nДата сбора анамнеза',
  pw_objective_example:
    'Дата и время осмотра\nСостояние пациента\nАД, пульс, температура, частота дыхания, SpO₂\nРезультаты осмотра по системам',
  pw_laboratory_example:
    'Дата анализа\nНазвание показателя — результат — единицы\nРеференсный диапазон\nПримечания лаборатории',
  pw_instrumental_example:
    'Вид исследования и дата\nОбласть исследования\nОписание находок\nЗаключение специалиста',
  pw_doctor_conclusion_example:
    'Какие данные поддерживают ваше заключение?\nЧто ещё нужно исключить или уточнить?\nКак вы будете оценивать эффект лечения?',
  pw_manual: 'Внести вручную',
  pw_manual_hint: 'Запишите данные в понятной форме.',
  pw_document: 'Загрузить документ',
  pw_document_hint: 'PDF, DOCX или TXT с последующей проверкой.',
  pw_dmed: 'Импорт из DMED',
  pw_dmed_hint: 'Демонстрационный импорт истории и заключений.',
  pw_dmed_notice:
    'DMED работает в деморежиме. Подключение к реальному профилю и автоматическая синхронизация пока недоступны.',
  pw_entries: 'Записи раздела',
  pw_entries_hint: 'AI использует только записи, проверенные и подтверждённые врачом.',
  pw_add: 'Добавить запись',
  pw_edit: 'Проверить и изменить',
  pw_entryText: 'Данные пациента',
  pw_reasoning: 'Клиническое обоснование',
  pw_diagnosis: 'Рабочий диагноз',
  pw_treatment: 'План лечения и наблюдения',
  pw_diagnosis_help: 'Укажите своё заключение и степень уверенности, если диагноз предварительный.',
  pw_treatment_help:
    'Если лечение назначено: препарат, доза, режим, срок и план контроля. Поле можно оставить пустым.',
  pw_confirm: 'Данные проверены мной и могут использоваться для сравнения с AI',
  pw_confirmed: 'Подтверждено врачом',
  pw_draft: 'Требует проверки',
  pw_confirm_action: 'Проверить данные',
  pw_saveDraft: 'Сохранить черновик',
  pw_saveConfirmed: 'Сохранить и подтвердить',
  pw_empty: 'В этом разделе пока нет записей',
  pw_empty_hint: 'Начните с ручного ввода или загрузите готовый документ.',
  pw_readonly: 'Просмотр данных. Добавление и подтверждение доступны лечащему врачу.',
  pw_revision:
    'При сохранении создаётся новая версия. Предыдущая запись остаётся в истории пациента.',
  pw_changed:
    'Данные пациента изменились после открытия формы. Закройте форму и откройте её снова — введённый текст можно предварительно скопировать.',
  pw_upload_title: 'Документ для раздела «{{category}}»',
  pw_upload_hint:
    'Текст документа будет сохранён как черновик. Проверьте извлечение и подтвердите запись перед анализом.',
  pw_upload_draft:
    'Загруженный текст ещё не подтверждён. Откройте запись, проверьте значения и подтвердите её.',
  pw_upload_file: 'Выбрать документ',
  pw_openImaging: 'Открыть DICOM / радиологию',
  pw_imaging_hint:
    'КТ, МРТ, МСКТ и рентген: ZIP-архив, просмотр срезов и сопоставление с заключением рентгенолога.',
  pw_source_manual: 'Ручной ввод',
  pw_source_document: 'Документ',
  pw_source_dmed_demo: 'DMED · демо',
  pw_source_dmed: 'DMED',
  pw_linked_source: 'Открыть исходный документ',
  pw_empty_extraction:
    'В документе не найден доступный текст. Введите данные вручную по исходному документу.',
  pw_compare_title: 'Ваше заключение + данные пациента',
  pw_compare_hint:
    'Сопоставьте диагноз и план лечения с подтверждёнными наблюдениями. Ответ содержит аргументы, расхождения и вопросы для уточнения.',
  pw_compare_run: 'Сравнить с AI',
  pw_comparisonResults: 'Результаты сравнения',
  pw_data_ready: 'Данные пациента подтверждены',
  pw_conclusion_ready: 'Заключение врача подтверждено',
  pw_age_ready: 'Указан возраст от 18 лет',
  pw_ready_hint:
    'Для запуска подтвердите хотя бы одну запись пациента и заключение врача. В текущем контуре анализ доступен для взрослых.',
  pw_goConclusion: 'Заполнить заключение',
  pw_compare_empty: 'Сравнение ещё не запускалось',
  pw_compare_empty_hint: 'Подготовьте данные и заключение, затем нажмите «Сравнить с AI».',
  pw_compare_pending: 'AI сопоставляет данные пациента с заключением врача',
  pw_compare_pending_hint:
    'Задача выполняется на локальной модели. Результат появится здесь автоматически.',
  pw_compare_notice:
    'Это клиническая поддержка решения. AI выделяет согласованность и расхождения, но не устанавливает автоматически, «прав» или «не прав» врач.',
  pw_compare_summary: 'Основной вывод AI',
  pw_diagnosis_review: 'Проверка диагноза',
  pw_treatment_review: 'Проверка лечения',
  pw_supporting: 'Что поддерживает заключение',
  pw_discrepancies: 'Что требует пересмотра',
  pw_questions: 'Что нужно уточнить',
  pw_next_steps: 'Что проверить дальше',
  pw_consistent_with_data: 'Согласуется с представленными данными',
  pw_needs_review: 'Требует пересмотра врачом',
  pw_insufficient_data: 'Недостаточно данных',
  pw_qualitative_only: 'Качественные сценарии',
  pw_no_items: 'В ответе нет отдельных пунктов для этого раздела.',
  pw_evidence: 'Данные, использованные в ответе',
  pw_unknown_ref: 'Ссылка недоступна',
  pw_forecast_title: 'Возможные сценарии на ближайшие 5 лет',
  pw_forecast_hint:
    'Сценарии зависят от диагноза, лечения, факторов риска и последующего наблюдения. Это не индивидуальная вероятность и не гарантированный прогноз.',
  pw_forecast_empty:
    'Сначала выполните сравнение с AI. Если данных достаточно, сценарии появятся в этом разделе.',
  pw_scenario: 'Сценарий',
  pw_conditions: 'От каких условий зависит',
  pw_monitoring: 'Что отслеживать',
  pw_no_scenarios: 'AI не сформировал обоснованные сценарии по имеющимся данным.',
  pw_language_hint:
    'Язык нового ответа AI соответствует выбранному языку интерфейса. Сохранённые ответы отображаются в оригинале.',
  CLINICAL_ENTRY_TEXT_REQUIRED: 'Введите текст записи или выберите документ с доступным текстом.',
  CLINICAL_ENTRY_NOT_CURRENT:
    'Эта запись уже была изменена. Обновите страницу и откройте текущую версию.',
  CLINICAL_ENTRY_SOURCE_MISMATCH: 'Источник не относится к этому пациенту.',
  CLINICAL_ENTRY_SOURCE_TOO_LONG:
    'Текст документа слишком длинный для одной записи. Выберите релевантный фрагмент и сохраните его вручную.',
  CLINICAL_COMPARISON_EVIDENCE_REQUIRED:
    'Для сравнения нужны подтверждённые данные пациента и заключение врача.',
}

export const patientWorkspaceUz: typeof patientWorkspaceRu = {
  pw_order_stopped: 'Qabul qilish to‘xtatilgan',
  pw_subjective: 'Subyektiv ma’lumotlar',
  pw_objective: 'Obyektiv ma’lumotlar',
  pw_laboratory: 'Laboratoriya ma’lumotlari',
  pw_instrumental: 'Instrumental ma’lumotlar',
  pw_doctor_conclusion: 'Shifokor xulosasi',
  pw_comparison: 'AI bilan solishtirish',
  pw_forecast: '5 yillik prognoz',
  pw_subjective_hint:
    'Bemor bildirgan ma’lumotlar: shikoyatlar, alomatlarning rivojlanishi, kasallik tarixi, qabul qilayotgan dorilar va allergiyalar.',
  pw_objective_hint:
    'Ko‘rik natijalari: umumiy holat, hayotiy ko‘rsatkichlar va fizik tekshiruv natijalari.',
  pw_laboratory_hint:
    'Tahlil natijalari: sana, o‘lchov birligi va laboratoriyaning me’yoriy qiymatlari bilan.',
  pw_instrumental_hint:
    'Tekshiruv bayonnomalari va xulosalari. DICOM tasvirlari alohida radiologiya oynasida ochiladi.',
  pw_doctor_conclusion_hint:
    'Ishchi tashxis, klinik asos va davolash rejasi. AI ularni bemorning tasdiqlangan ma’lumotlari bilan solishtiradi.',
  pw_subjective_example:
    'Shikoyatlar va alomatlar boshlangan vaqt\nHolat qanday o‘zgargan\nKasallik tarixi, dorilar, allergiyalar\nAnamnez yig‘ilgan sana',
  pw_objective_example:
    'Ko‘rik sanasi va vaqti\nBemorning holati\nQon bosimi, puls, harorat, nafas soni, SpO₂\nTizimlar bo‘yicha ko‘rik natijalari',
  pw_laboratory_example:
    'Tahlil sanasi\nKo‘rsatkich — natija — o‘lchov birligi\nMe’yoriy oraliq\nLaboratoriya izohlari',
  pw_instrumental_example:
    'Tekshiruv turi va sanasi\nTekshirilgan soha\nTopilmalar tavsifi\nMutaxassis xulosasi',
  pw_doctor_conclusion_example:
    'Qaysi ma’lumotlar xulosangizni qo‘llab-quvvatlaydi?\nNimalarni aniqlashtirish yoki istisno qilish kerak?\nDavolash ta’sirini qanday baholaysiz?',
  pw_manual: 'Qo‘lda kiritish',
  pw_manual_hint: 'Ma’lumotlarni tushunarli shaklda yozing.',
  pw_document: 'Hujjat yuklash',
  pw_document_hint: 'PDF, DOCX yoki TXT; so‘ng tekshirish.',
  pw_dmed: 'DMED’dan import',
  pw_dmed_hint: 'Kasallik tarixi va xulosalarning demo importi.',
  pw_dmed_notice:
    'DMED demo rejimida ishlaydi. Haqiqiy profilga ulanish va avtomatik sinxronlash hozircha mavjud emas.',
  pw_entries: 'Bo‘lim yozuvlari',
  pw_entries_hint: 'AI faqat shifokor tekshirgan va tasdiqlagan yozuvlardan foydalanadi.',
  pw_add: 'Yozuv qo‘shish',
  pw_edit: 'Tekshirish va tahrirlash',
  pw_entryText: 'Bemor ma’lumotlari',
  pw_reasoning: 'Klinik asos',
  pw_diagnosis: 'Ishchi tashxis',
  pw_treatment: 'Davolash va kuzatuv rejasi',
  pw_diagnosis_help: 'Xulosangizni va tashxis dastlabki bo‘lsa, ishonch darajasini yozing.',
  pw_treatment_help:
    'Davolash tayinlangan bo‘lsa: dori, doza, tartib, muddat va nazorat rejasi. Maydonni bo‘sh qoldirish mumkin.',
  pw_confirm: 'Ma’lumotlarni tekshirdim, ularni AI bilan solishtirishda ishlatish mumkin',
  pw_confirmed: 'Shifokor tasdiqlagan',
  pw_draft: 'Tekshirish kerak',
  pw_confirm_action: 'Ma’lumotlarni tekshirish',
  pw_saveDraft: 'Qoralamani saqlash',
  pw_saveConfirmed: 'Saqlash va tasdiqlash',
  pw_empty: 'Bu bo‘limda hali yozuvlar yo‘q',
  pw_empty_hint: 'Qo‘lda kiriting yoki tayyor hujjatni yuklang.',
  pw_readonly: 'Ko‘rish rejimi. Davolovchi shifokor ma’lumot qo‘shishi va tasdiqlashi mumkin.',
  pw_revision: 'Saqlashda yangi versiya yaratiladi. Avvalgi yozuv bemor tarixida qoladi.',
  pw_changed:
    'Forma ochilgandan beri bemor ma’lumotlari o‘zgardi. Kiritilgan matnni nusxalab, formani yopib qayta oching.',
  pw_upload_title: '«{{category}}» bo‘limi uchun hujjat',
  pw_upload_hint:
    'Hujjat matni qoralama sifatida saqlanadi. Tahlildan oldin ajratilgan ma’lumotlarni tekshiring va tasdiqlang.',
  pw_upload_draft:
    'Yuklangan matn hali tasdiqlanmagan. Yozuvni oching, qiymatlarni tekshiring va tasdiqlang.',
  pw_upload_file: 'Hujjat tanlash',
  pw_openImaging: 'DICOM / radiologiyani ochish',
  pw_imaging_hint:
    'KT, MRT, MSKT va rentgen: ZIP-arxiv, kesimlarni ko‘rish va rentgenolog xulosasi bilan solishtirish.',
  pw_source_manual: 'Qo‘lda kiritilgan',
  pw_source_document: 'Hujjat',
  pw_source_dmed_demo: 'DMED · demo',
  pw_source_dmed: 'DMED',
  pw_linked_source: 'Asl hujjatni ochish',
  pw_empty_extraction:
    'Hujjatda o‘qiladigan matn topilmadi. Asl hujjatga qarab ma’lumotlarni qo‘lda kiriting.',
  pw_compare_title: 'Xulosangiz + bemor ma’lumotlari',
  pw_compare_hint:
    'Tashxis va davolash rejasini tasdiqlangan kuzatuvlar bilan solishtiring. Javobda asoslar, farqlar va aniqlashtiruvchi savollar bo‘ladi.',
  pw_compare_run: 'AI bilan solishtirish',
  pw_comparisonResults: 'Solishtirish natijalari',
  pw_data_ready: 'Bemor ma’lumotlari tasdiqlangan',
  pw_conclusion_ready: 'Shifokor xulosasi tasdiqlangan',
  pw_age_ready: '18 yoki undan katta yosh ko‘rsatilgan',
  pw_ready_hint:
    'Boshlash uchun kamida bitta bemor yozuvi va shifokor xulosasini tasdiqlang. Hozirgi tahlil kattalar uchun mo‘ljallangan.',
  pw_goConclusion: 'Xulosani to‘ldirish',
  pw_compare_empty: 'Solishtirish hali boshlanmagan',
  pw_compare_empty_hint:
    'Ma’lumotlar va xulosani tayyorlab, «AI bilan solishtirish» tugmasini bosing.',
  pw_compare_pending: 'AI bemor ma’lumotlarini shifokor xulosasi bilan solishtiryapti',
  pw_compare_pending_hint:
    'Topshiriq lokal modelda bajariladi. Natija shu yerda avtomatik paydo bo‘ladi.',
  pw_compare_notice:
    'Bu klinik qarorni qo‘llab-quvvatlash vositasi. AI moslik va farqlarni ko‘rsatadi, shifokorni avtomatik «haq» yoki «nohaq» deb belgilamaydi.',
  pw_compare_summary: 'AI asosiy xulosasi',
  pw_diagnosis_review: 'Tashxisni tekshirish',
  pw_treatment_review: 'Davolashni tekshirish',
  pw_supporting: 'Xulosani qo‘llab-quvvatlovchi dalillar',
  pw_discrepancies: 'Qayta ko‘rib chiqish kerak bo‘lgan jihatlar',
  pw_questions: 'Nimani aniqlashtirish kerak',
  pw_next_steps: 'Keyin nimani tekshirish kerak',
  pw_consistent_with_data: 'Berilgan ma’lumotlarga mos',
  pw_needs_review: 'Shifokor qayta ko‘rib chiqishi kerak',
  pw_insufficient_data: 'Ma’lumot yetarli emas',
  pw_qualitative_only: 'Sifatli ssenariylar',
  pw_no_items: 'Javobda bu bo‘lim uchun alohida bandlar yo‘q.',
  pw_evidence: 'Javobda ishlatilgan ma’lumotlar',
  pw_unknown_ref: 'Havola mavjud emas',
  pw_forecast_title: 'Keyingi 5 yil uchun ehtimoliy ssenariylar',
  pw_forecast_hint:
    'Ssenariylar tashxis, davolash, xavf omillari va keyingi kuzatuvga bog‘liq. Bu individual ehtimollik yoki kafolatlangan prognoz emas.',
  pw_forecast_empty:
    'Avval AI bilan solishtirishni bajaring. Ma’lumot yetarli bo‘lsa, ssenariylar shu bo‘limda paydo bo‘ladi.',
  pw_scenario: 'Ssenariy',
  pw_conditions: 'Qaysi sharoitlarga bog‘liq',
  pw_monitoring: 'Nimani kuzatish kerak',
  pw_no_scenarios: 'Mavjud ma’lumotlardan asoslangan ssenariylar tuzilmadi.',
  pw_language_hint:
    'Yangi AI javobi interfeys tilida yaratiladi. Saqlangan javoblar asl tilida ko‘rsatiladi.',
  CLINICAL_ENTRY_TEXT_REQUIRED: 'Yozuv matnini kiriting yoki o‘qiladigan matnli hujjatni tanlang.',
  CLINICAL_ENTRY_NOT_CURRENT:
    'Bu yozuv o‘zgartirilgan. Sahifani yangilang va joriy versiyani oching.',
  CLINICAL_ENTRY_SOURCE_MISMATCH: 'Manba bu bemorga tegishli emas.',
  CLINICAL_ENTRY_SOURCE_TOO_LONG:
    'Hujjat matni bitta yozuv uchun juda uzun. Tegishli qismini tanlab qo‘lda saqlang.',
  CLINICAL_COMPARISON_EVIDENCE_REQUIRED:
    'Solishtirish uchun bemor ma’lumotlari va shifokor xulosasi tasdiqlanishi kerak.',
}

export const patientWorkspaceEn: typeof patientWorkspaceRu = {
  pw_order_stopped: 'Stopped',
  pw_subjective: 'Subjective data',
  pw_objective: 'Objective data',
  pw_laboratory: 'Laboratory data',
  pw_instrumental: 'Instrumental data',
  pw_doctor_conclusion: 'Doctor’s conclusion',
  pw_comparison: 'Compare with AI',
  pw_forecast: '5-year outlook',
  pw_subjective_hint:
    'What the patient reports: complaints, symptom progression, medical history, current medicines and allergies.',
  pw_objective_hint:
    'What the examination establishes: general condition, vital signs and physical examination findings.',
  pw_laboratory_hint:
    'Laboratory results with the date, units and the laboratory’s reference ranges.',
  pw_instrumental_hint:
    'Investigation reports and conclusions. DICOM images open in a separate radiology workspace.',
  pw_doctor_conclusion_hint:
    'Your working diagnosis, clinical reasoning and treatment plan. AI compares them with confirmed patient data.',
  pw_subjective_example:
    'Complaints and symptom onset\nHow the condition has changed\nHistory, medicines, allergies\nDate of history taking',
  pw_objective_example:
    'Examination date and time\nGeneral condition\nBlood pressure, pulse, temperature, respiratory rate, SpO₂\nSystem examination findings',
  pw_laboratory_example:
    'Test date\nTest name — result — units\nReference range\nLaboratory comments',
  pw_instrumental_example:
    'Investigation type and date\nArea examined\nFindings\nSpecialist’s conclusion',
  pw_doctor_conclusion_example:
    'Which observations support your conclusion?\nWhat still needs clarification or exclusion?\nHow will you evaluate the treatment response?',
  pw_manual: 'Enter manually',
  pw_manual_hint: 'Record the information in a clear form.',
  pw_document: 'Upload a document',
  pw_document_hint: 'PDF, DOCX or TXT, followed by review.',
  pw_dmed: 'Import from DMED',
  pw_dmed_hint: 'Demo import of patient history and conclusions.',
  pw_dmed_notice:
    'DMED is in demo mode. A real profile connection and automatic synchronization are not available yet.',
  pw_entries: 'Section records',
  pw_entries_hint: 'AI uses only records reviewed and confirmed by a doctor.',
  pw_add: 'Add a record',
  pw_edit: 'Review and edit',
  pw_entryText: 'Patient data',
  pw_reasoning: 'Clinical reasoning',
  pw_diagnosis: 'Working diagnosis',
  pw_treatment: 'Treatment and follow-up plan',
  pw_diagnosis_help:
    'Enter your conclusion and level of certainty if the diagnosis is provisional.',
  pw_treatment_help:
    'If treatment is prescribed: medicine, dose, regimen, duration and monitoring. This field is optional.',
  pw_confirm: 'I have reviewed these data and they may be used for comparison with AI',
  pw_confirmed: 'Confirmed by doctor',
  pw_draft: 'Needs review',
  pw_confirm_action: 'Review the data',
  pw_saveDraft: 'Save draft',
  pw_saveConfirmed: 'Save and confirm',
  pw_empty: 'No records in this section yet',
  pw_empty_hint: 'Start with manual entry or upload an existing document.',
  pw_readonly: 'Read-only view. The treating doctor can add and confirm data.',
  pw_revision: 'Saving creates a new version. The previous record remains in the patient history.',
  pw_changed:
    'The patient data changed after this form was opened. Copy any entered text, close the form and reopen it.',
  pw_upload_title: 'Document for “{{category}}”',
  pw_upload_hint:
    'The document text is saved as a draft. Review the extraction and confirm the record before analysis.',
  pw_upload_draft:
    'Uploaded text is not confirmed yet. Open the record, check the values and confirm it.',
  pw_upload_file: 'Choose a document',
  pw_openImaging: 'Open DICOM / radiology',
  pw_imaging_hint:
    'CT, MRI, multislice CT and X-ray: ZIP upload, slice viewing and comparison with the radiologist’s report.',
  pw_source_manual: 'Manual entry',
  pw_source_document: 'Document',
  pw_source_dmed_demo: 'DMED · demo',
  pw_source_dmed: 'DMED',
  pw_linked_source: 'Open the original document',
  pw_empty_extraction:
    'No readable text was found in this document. Enter the data manually using the original document.',
  pw_compare_title: 'Your conclusion + patient data',
  pw_compare_hint:
    'Compare the diagnosis and treatment plan with confirmed observations. The response includes supporting evidence, discrepancies and questions.',
  pw_compare_run: 'Compare with AI',
  pw_comparisonResults: 'Comparison results',
  pw_data_ready: 'Patient data confirmed',
  pw_conclusion_ready: 'Doctor’s conclusion confirmed',
  pw_age_ready: 'Age of 18 or older provided',
  pw_ready_hint:
    'Confirm at least one patient record and the doctor’s conclusion to start. The current analysis supports adults.',
  pw_goConclusion: 'Complete the conclusion',
  pw_compare_empty: 'No comparison has been run',
  pw_compare_empty_hint: 'Prepare the data and conclusion, then select “Compare with AI”.',
  pw_compare_pending: 'AI is comparing patient data with the doctor’s conclusion',
  pw_compare_pending_hint:
    'The task runs on the local model. The result will appear here automatically.',
  pw_compare_notice:
    'This supports clinical decisions. AI highlights consistency and discrepancies; it does not automatically declare a doctor “right” or “wrong”.',
  pw_compare_summary: 'AI’s main finding',
  pw_diagnosis_review: 'Diagnosis review',
  pw_treatment_review: 'Treatment review',
  pw_supporting: 'What supports the conclusion',
  pw_discrepancies: 'What needs reconsideration',
  pw_questions: 'What needs clarification',
  pw_next_steps: 'What to check next',
  pw_consistent_with_data: 'Consistent with the provided data',
  pw_needs_review: 'Needs clinician review',
  pw_insufficient_data: 'Insufficient data',
  pw_qualitative_only: 'Qualitative scenarios',
  pw_no_items: 'The response contains no separate items for this section.',
  pw_evidence: 'Data used in the response',
  pw_unknown_ref: 'Reference unavailable',
  pw_forecast_title: 'Possible scenarios over the next 5 years',
  pw_forecast_hint:
    'Scenarios depend on the diagnosis, treatment, risk factors and follow-up. They are not individual probabilities or a guaranteed prediction.',
  pw_forecast_empty:
    'Run a comparison with AI first. If sufficient data are available, scenarios will appear here.',
  pw_scenario: 'Scenario',
  pw_conditions: 'Conditions that affect this scenario',
  pw_monitoring: 'What to monitor',
  pw_no_scenarios: 'AI did not produce substantiated scenarios from the available data.',
  pw_language_hint:
    'New AI responses use the selected interface language. Saved responses remain in their original language.',
  CLINICAL_ENTRY_TEXT_REQUIRED: 'Enter record text or select a document with readable text.',
  CLINICAL_ENTRY_NOT_CURRENT:
    'This record has already changed. Refresh and open the current version.',
  CLINICAL_ENTRY_SOURCE_MISMATCH: 'The source does not belong to this patient.',
  CLINICAL_ENTRY_SOURCE_TOO_LONG:
    'The document text is too long for one record. Select a relevant passage and save it manually.',
  CLINICAL_COMPARISON_EVIDENCE_REQUIRED:
    'Comparison requires confirmed patient data and a doctor’s conclusion.',
}
