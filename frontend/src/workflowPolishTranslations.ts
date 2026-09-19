export const workflowPolishRu = {
  wpRequired: 'Заполните это поле.',
  wpReadOnly: 'Режим просмотра: эти данные изменяет лечащий врач.',
  wpRadiologyRole:
    'Измерения и итоговую оценку снимков сохраняет рентгенолог. Врач может загружать исследования, вводить или прикреплять заключение рентгенолога и сравнивать его с AI.',
  wpImageLoading: 'Загружаем выбранный кадр…',
  wpAnalysisRunning:
    'По этому случаю уже выполняется анализ. Дождитесь результата или отмените текущий запуск.',
  wpFullscreenUnavailable: 'В этом браузере полноэкранный режим недоступен.',
  wpColorWindow: 'Цветное изображение: настройки яркости DICOM-окна не применяются.',
  wpReviewHint:
    'Укажите, что проверено в исходном исследовании, какие наблюдения подтверждены и что требует уточнения.',
  wpReviewPlaceholder:
    'Проверена серия …, кадры … . Наблюдения … . Ограничения и необходимые уточнения … .',
  wpUploadHint:
    'Выберите ZIP с исходными DICOM-файлами или отдельный DICOM. Перед загрузкой удалите прямые идентификаторы пациента.',
  wpInvalidDicomFile: 'Выберите файл .zip, .dcm или .dicom.',
  wpImageReadyHint:
    'Сначала дождитесь загрузки кадра. AI анализирует именно выбранный кадр и окно.',
  wpUnitHint:
    'Выберите единицы из лабораторного бланка. При смене единиц поля холестерина очищаются, чтобы не пересчитать прежние числа в другой шкале.',
  wpPressureHint:
    'Верхнее значение давления при этом обследовании. Диапазон калькулятора: 90–200 mmHg.',
  wpLipidRange: 'Диапазон калькулятора: {{min}}–{{max}} {{unit}}.',
  wpHdlBelowTotal: 'HDL должен быть меньше общего холестерина. Проверьте значения и единицы.',
  wpFactorHint:
    'Выберите «Да» или «Нет» по подтверждённым данным. Если сведений нет, уточните их перед расчётом.',
  wpRiskDemographics:
    'Для расчёта нужны возраст и пол в карточке случая. Исправьте исходные данные перед расчётом.',
  wpRiskUnsupported:
    'Расчёт недоступен для этих исходных данных. Ниже указана причина; числовой риск не будет выдуман.',
  wpNoteTypeHint:
    'Анамнез — факты и история; обоснование решения — ход рассуждений; ответ на замечание — результат проверки.',
  wpNoteTextHint:
    'Опишите наблюдение, обстоятельства и источник. Неизвестное обозначайте явно; не подменяйте его отрицательным ответом.',
  wpNotePlaceholder: 'Дата и обстоятельства: …\nПодтверждённые сведения: …\nЧто нужно уточнить: …',
  wpProvenanceHint:
    'Выберите, откуда получены сведения: введены специалистом, перенесены с бумаги или сообщены пациентом.',
  wpNoteTimeHint:
    'Когда произошло событие, а не когда вы заполняете форму. Можно оставить пустым, если время неизвестно.',
  wpInvalidDate: 'Укажите корректные дату и время.',
  wpDraftRetry: 'Повторить загрузку черновика',
  wpDraftCleanupFailed:
    'Запись сохранена. Не удалось очистить личный черновик; при следующем открытии проверьте его перед повторным сохранением.',
  wpExpertStatusHint:
    'Доступны только переходы из текущего статуса. Подтверждение должно опираться на независимую проверку материалов.',
  wpExpertExplanationHint:
    'Укажите проверенные источники, вывод и следующее действие. Объяснение остаётся в истории.',
  wpExpertExplanationPlaceholder: 'Проверено: …\nВывод и основания: …\nСледующее действие: …',
  wpExpertReadOnly:
    'Решение сохраняет пользователь с ролью «Эксперт». Другие участники могут просматривать материалы и историю.',
  wpReviewClosed: 'Проверка завершена. Решения и основания доступны в истории.',
  wpReportIncidentsHint:
    'Выберите случаи с независимым экспертным подтверждением. Неподтверждённые случаи в список не включаются.',
  wpReportNoEligible:
    'Нет подтверждённых экспертных проверок для нового отчёта. Завершите независимую проверку в разделе экспертизы.',
  wpReportPurposeHint:
    'Для какой задачи готовится пакет, например: внутренний обзор качества за месяц.',
  wpReportBasisHint:
    'Основание и контекст подготовки, например: план внутреннего аудита и период проверки.',
  wpReportSenderHint:
    'Уполномоченный отправитель утверждает точную версию и выполняет демонстрационную отправку.',
  wpReportSmallGroup:
    'Численность небольшой группы скрыта: в пакет включено меньше пяти подтверждённых случаев.',
  wpReportDownloadFailed: 'Не удалось скачать отчёт. Обновите страницу и повторите попытку.',
  wpReportFieldSchema: 'Формат пакета',
  wpReportFieldMode: 'Режим',
  wpReportFieldPeriod: 'Период',
  wpReportFieldCount: 'Подтверждённые случаи',
  wpReportFieldSuppression: 'Скрытие небольшой группы',
  wpReportFieldScope: 'Область отчёта',
  wpReportFieldValidation: 'Клиническая валидация',
  wpReportScope: 'Демонстрационный обзор качества на синтетических данных',
  wpNotValidated: 'Не проводилась',
  wpDraftLoadFailed: 'Не удалось загрузить личный черновик. Повторите загрузку, чтобы продолжить.',
  wpRetryService: 'Обновить состояние',
  wpMeasurementEmpty:
    'Нажмите две точки на изображении, затем сохраните измерение с понятным названием.',
}

export const workflowPolishUz: typeof workflowPolishRu = {
  wpRequired: 'Bu maydonni to‘ldiring.',
  wpReadOnly: 'Ko‘rish rejimi: bu ma’lumotlarni davolovchi shifokor o‘zgartiradi.',
  wpRadiologyRole:
    'O‘lchovlar va tasvirlarning yakuniy bahosini rentgenolog saqlaydi. Shifokor tekshiruvlarni yuklashi, rentgenolog xulosasini kiritishi yoki biriktirishi va uni AI bilan solishtirishi mumkin.',
  wpImageLoading: 'Tanlangan kadr yuklanmoqda…',
  wpAnalysisRunning:
    'Bu holat bo‘yicha tahlil davom etmoqda. Natijani kuting yoki joriy tahlilni bekor qiling.',
  wpFullscreenUnavailable: 'Bu brauzerda to‘liq ekran rejimi mavjud emas.',
  wpColorWindow: 'Rangli tasvir: DICOM oynasining yorqinlik sozlamalari qo‘llanmaydi.',
  wpReviewHint:
    'Asl tekshiruvda nima ko‘rilgani, qaysi kuzatuvlar tasdiqlangani va nimalarni aniqlashtirish kerakligini yozing.',
  wpReviewPlaceholder:
    'Tekshirilgan seriya …, kadrlar … . Kuzatuvlar … . Cheklov va kerakli aniqlashtirishlar … .',
  wpUploadHint:
    'Asl DICOM fayllari bor ZIP yoki alohida DICOM tanlang. Yuklashdan oldin bemorning bevosita identifikatorlarini olib tashlang.',
  wpInvalidDicomFile: '.zip, .dcm yoki .dicom faylini tanlang.',
  wpImageReadyHint:
    'Avval kadr yuklanishini kuting. AI aynan tanlangan kadr va oyna sozlamasini tahlil qiladi.',
  wpUnitHint:
    'Laboratoriya blankidagi birlikni tanlang. Birlik almashtirilganda eski raqamlar boshqa shkalada hisoblanmasligi uchun xolesterin maydonlari tozalanadi.',
  wpPressureHint: 'Shu ko‘rikdagi bosimning yuqori qiymati. Kalkulyator diapazoni: 90–200 mmHg.',
  wpLipidRange: 'Kalkulyator diapazoni: {{min}}–{{max}} {{unit}}.',
  wpHdlBelowTotal: 'HDL umumiy xolesterindan past bo‘lishi kerak. Qiymat va birlikni tekshiring.',
  wpFactorHint:
    'Tasdiqlangan ma’lumot asosida «Ha» yoki «Yo‘q» tanlang. Ma’lumot bo‘lmasa, hisoblashdan oldin aniqlashtiring.',
  wpRiskDemographics:
    'Hisoblash uchun holat kartasida yosh va jins kerak. Avval boshlang‘ich ma’lumotlarni to‘g‘rilang.',
  wpRiskUnsupported:
    'Bu boshlang‘ich ma’lumotlarda hisob qo‘llanmaydi. Sababi quyida ko‘rsatiladi; raqamli xavf o‘ylab topilmaydi.',
  wpNoteTypeHint:
    'Anamnez — fakt va tarix; qaror asosi — fikrlash jarayoni; e’tirozga javob — tekshiruv natijasi.',
  wpNoteTextHint:
    'Kuzatuv, vaziyat va manbani yozing. Noma’lumni aniq belgilang; uni «yo‘q» javobi bilan almashtirmang.',
  wpNotePlaceholder: 'Sana va vaziyat: …\nTasdiqlangan ma’lumotlar: …\nAniqlashtirish kerak: …',
  wpProvenanceHint:
    'Ma’lumot manbasini tanlang: mutaxassis kiritgan, qog‘ozdan ko‘chirilgan yoki bemor aytgan.',
  wpNoteTimeHint:
    'Forma to‘ldirilgan vaqt emas, voqea sodir bo‘lgan vaqt. Vaqt noma’lum bo‘lsa, bo‘sh qoldirish mumkin.',
  wpInvalidDate: 'To‘g‘ri sana va vaqt kiriting.',
  wpDraftRetry: 'Qoralamani qayta yuklash',
  wpDraftCleanupFailed:
    'Yozuv saqlandi. Shaxsiy qoralamani tozalab bo‘lmadi; keyingi safar qayta saqlashdan oldin uni tekshiring.',
  wpExpertStatusHint:
    'Joriy holatdan mumkin bo‘lgan o‘tishlar ko‘rsatilgan. Tasdiqlash materiallarni mustaqil tekshirishga asoslanishi kerak.',
  wpExpertExplanationHint:
    'Tekshirilgan manbalar, xulosa va keyingi amalni yozing. Izoh tarixda saqlanadi.',
  wpExpertExplanationPlaceholder: 'Tekshirildi: …\nXulosa va asoslar: …\nKeyingi amal: …',
  wpExpertReadOnly:
    'Qarorni «Ekspert» rolidagi foydalanuvchi saqlaydi. Boshqa ishtirokchilar material va tarixni ko‘ra oladi.',
  wpReviewClosed: 'Tekshiruv yakunlangan. Qaror va asoslar tarixda mavjud.',
  wpReportIncidentsHint:
    'Mustaqil ekspert tasdiqlagan holatlarni tanlang. Tasdiqlanmagan holatlar ro‘yxatga kirmaydi.',
  wpReportNoEligible:
    'Yangi hisobot uchun ekspert tasdiqlagan tekshiruvlar yo‘q. Ekspertiza bo‘limida mustaqil tekshiruvni yakunlang.',
  wpReportPurposeHint: 'Paket nima uchun tayyorlanadi, masalan: oylik ichki sifat tahlili.',
  wpReportBasisHint:
    'Tayyorlash asosi va konteksti, masalan: ichki audit rejasi va tekshiriladigan davr.',
  wpReportSenderHint:
    'Vakolatli yuboruvchi aniq versiyani tasdiqlaydi va namoyish yuborishini bajaradi.',
  wpReportSmallGroup:
    'Kichik guruh soni yashirilgan: paketda beshtadan kam tasdiqlangan holat bor.',
  wpReportDownloadFailed: 'Hisobotni yuklab bo‘lmadi. Sahifani yangilab, qayta urinib ko‘ring.',
  wpReportFieldSchema: 'Paket formati',
  wpReportFieldMode: 'Rejim',
  wpReportFieldPeriod: 'Davr',
  wpReportFieldCount: 'Tasdiqlangan holatlar',
  wpReportFieldSuppression: 'Kichik guruhni yashirish',
  wpReportFieldScope: 'Hisobot doirasi',
  wpReportFieldValidation: 'Klinik validatsiya',
  wpReportScope: 'Sun’iy ma’lumotlardagi namoyish sifat tahlili',
  wpNotValidated: 'O‘tkazilmagan',
  wpDraftLoadFailed: 'Shaxsiy qoralama yuklanmadi. Davom etish uchun qayta yuklang.',
  wpRetryService: 'Holatni yangilash',
  wpMeasurementEmpty: 'Tasvirda ikki nuqtani bosing, so‘ng o‘lchovni tushunarli nom bilan saqlang.',
}

export const workflowPolishEn: typeof workflowPolishRu = {
  wpRequired: 'Complete this field.',
  wpReadOnly: 'View-only access: the treating clinician edits this data.',
  wpRadiologyRole:
    'A radiologist saves measurements and the final image review. A clinician can upload studies, enter or attach a radiologist’s report, and compare it with AI.',
  wpImageLoading: 'Loading the selected frame…',
  wpAnalysisRunning:
    'An analysis is already running for this case. Wait for the result or cancel the current run.',
  wpFullscreenUnavailable: 'Full-screen mode is not available in this browser.',
  wpColorWindow: 'Colour image: DICOM window brightness settings do not apply.',
  wpReviewHint:
    'Describe what you checked in the original study, which observations were confirmed and what needs clarification.',
  wpReviewPlaceholder:
    'Series checked …, frames … . Observations … . Limitations and required clarifications … .',
  wpUploadHint:
    'Select a ZIP containing original DICOM files or an individual DICOM file. Remove direct patient identifiers before uploading.',
  wpInvalidDicomFile: 'Select a .zip, .dcm or .dicom file.',
  wpImageReadyHint:
    'Wait for the frame to finish loading. AI analyses the selected frame and window settings.',
  wpUnitHint:
    'Choose the units shown on the laboratory report. Changing units clears the cholesterol fields to prevent interpreting old numbers on a different scale.',
  wpPressureHint:
    'The upper blood pressure reading at this examination. Calculator range: 90–200 mmHg.',
  wpLipidRange: 'Calculator range: {{min}}–{{max}} {{unit}}.',
  wpHdlBelowTotal: 'HDL must be below total cholesterol. Check the values and units.',
  wpFactorHint:
    'Select “Yes” or “No” using confirmed information. If a factor is unknown, clarify it before calculating.',
  wpRiskDemographics:
    'The case card must include age and sex for this calculation. Correct the source data first.',
  wpRiskUnsupported:
    'The calculation does not apply to these inputs. The reason is shown below; a numerical risk will not be invented.',
  wpNoteTypeHint:
    'History records facts and background; decision rationale records reasoning; response to a finding records the review outcome.',
  wpNoteTextHint:
    'Describe the observation, circumstances and source. Explicitly identify unknowns; do not replace them with negative answers.',
  wpNotePlaceholder: 'Date and circumstances: …\nConfirmed information: …\nNeeds clarification: …',
  wpProvenanceHint:
    'Select the source of the information: entered by a professional, transcribed from paper or reported by the patient.',
  wpNoteTimeHint:
    'When the event happened, rather than when you filled in this form. Leave blank if the time is unknown.',
  wpInvalidDate: 'Enter a valid date and time.',
  wpDraftRetry: 'Retry loading draft',
  wpDraftCleanupFailed:
    'The note was saved. The personal draft could not be cleared; check it before saving again the next time you open it.',
  wpExpertStatusHint:
    'Only transitions from the current status are available. Confirmation must be based on an independent review of the materials.',
  wpExpertExplanationHint:
    'List the checked sources, conclusion and next action. The explanation remains in the history.',
  wpExpertExplanationPlaceholder: 'Checked: …\nConclusion and evidence: …\nNext action: …',
  wpExpertReadOnly:
    'Users with the Expert role can save decisions. Other participants can view the materials and history.',
  wpReviewClosed:
    'The review is complete. Decisions and their rationale are available in the history.',
  wpReportIncidentsHint:
    'Select cases independently confirmed by an expert. Unconfirmed cases are excluded from this list.',
  wpReportNoEligible:
    'There are no expert-confirmed reviews for a new report. Complete an independent review in the expert review section.',
  wpReportPurposeHint:
    'Why this package is being prepared, for example: a monthly internal quality review.',
  wpReportBasisHint:
    'The basis and context for preparation, for example: the internal audit plan and review period.',
  wpReportSenderHint:
    'An authorised sender approves the exact version and performs a demonstration submission.',
  wpReportSmallGroup:
    'The small group size is hidden: the package contains fewer than five confirmed cases.',
  wpReportDownloadFailed: 'The report could not be downloaded. Refresh the page and try again.',
  wpReportFieldSchema: 'Package format',
  wpReportFieldMode: 'Mode',
  wpReportFieldPeriod: 'Period',
  wpReportFieldCount: 'Confirmed cases',
  wpReportFieldSuppression: 'Small-group suppression',
  wpReportFieldScope: 'Report scope',
  wpReportFieldValidation: 'Clinical validation',
  wpReportScope: 'Demonstration quality review using synthetic data',
  wpNotValidated: 'Not performed',
  wpDraftLoadFailed: 'Could not load your personal draft. Retry loading it to continue.',
  wpRetryService: 'Refresh status',
  wpMeasurementEmpty:
    'Select two points on the image, then save the measurement with a clear name.',
}
