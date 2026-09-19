export const aiAnalysisRu = {
  clinicalReadyFailed:
    'Не удалось проверить исходные данные. Повторите проверку перед запуском анализа.',
  WORKER_INTERRUPTED:
    'Обработка прервана перезапуском сервера. Результат не сформирован; повторите анализ.',
  JOB_TERMINAL:
    'Этот анализ уже завершился. Обновите данные, чтобы увидеть его актуальное состояние.',
  JOB_NOT_RETRYABLE: 'Этот запуск нельзя повторить. Начните новый анализ актуальных данных.',
  aiResultTitle: 'Результат AI-анализа',
  aiLocalModel: 'ЛОКАЛЬНАЯ МОДЕЛЬ',
  aiClinicalResult: 'Клинический разбор AI',
  aiDecisionResult: 'AI-разбор данных',
  aiRadiologyResult: 'AI-разбор изображения',
  aiResultSummary: 'Сводка по представленным данным',
  aiImageObservations: 'Наблюдения на выбранном изображении',
  aiResultNotStarted: 'AI-разбор ещё не запускался',
  aiResultStartHint:
    'Подготовьте исходные данные и запустите анализ. Здесь появится результат модели с ограничениями и контекстом проверки.',
  aiResultCancelled: 'Анализ отменён',
  aiResultFailed: 'Анализ не завершился',
  aiResultRetryHint:
    'Результат модели не сформирован. Проверьте причину ниже и повторите анализ; исходные данные сохранены.',
  aiResultNotRequested: 'Этот запуск выполнен без AI',
  aiResultEnableHint:
    'Чтобы получить текстовый разбор MedGemma, включите AI и запустите новую проверку.',
  aiResultUnavailable: 'Ответ AI недоступен',
  aiResultUnavailableHint:
    'Этот запуск не содержит ответа модели. Причина показана ниже; результаты отдельных проверок могут быть доступны в других разделах.',
  aiResultQueued: 'Запрос ожидает обработки',
  aiResultRunning: 'Анализ выполняется',
  aiResultModelWorking: 'MedGemma обрабатывает данные и формирует структурированный ответ.',
  aiResultPreparing: 'Подготавливаем данные и выполняем проверки для этого запроса.',
  aiResultProgressHint:
    'Статус обновляется автоматически. Время зависит от объёма данных и оборудования; повторный запуск не нужен.',
  aiResultStaleHint:
    'После запуска данные случая изменились. Это результат предыдущей версии — выполните новый анализ перед принятием решения.',
  aiResultRerun: 'Анализировать текущую версию',
  aiHypothesesTitle: 'Гипотезы для проверки врачом',
  aiNoGuessing:
    'Уточните недостающие сведения и повторите разбор. Отсутствие гипотез не подтверждает отсутствие заболевания.',
  aiHypothesisStale: 'Сначала выполните разбор актуальной версии случая.',
  aiQuestionsHint:
    'Ответы внесите как факты с источником, временем и подтверждением, затем повторите анализ.',
  aiMissingData: 'Какие сведения необходимо дополнить',
  aiEvidenceUnavailable: 'Ссылка на источник недоступна',
  aiAllEvidence: 'Все использованные наблюдения: {{count}}',
  aiEvidenceHint:
    'Нажмите на наблюдение, чтобы открыть исходный документ и проверить значение в контексте.',
  aiResultClinicianNotice:
    'AI поддерживает решение врача. Гипотезы и наблюдения требуют проверки по исходным данным; клиническая точность модели не валидирована.',
  clinicalOnlyDoctor: 'Запуск анализа и запись клинического заключения доступны лечащему врачу.',
  clinicalReadyChecking: 'Проверяем, достаточно ли подтверждённых данных для анализа.',
  clinicalModelChecking: 'Проверяем подключение к локальной модели.',
  clinicalModelUnavailable:
    'Локальная модель пока недоступна. Проверьте её состояние и повторите проверку подключения.',
  clinicalModelProfile: 'Для диагностического разбора необходим локальный профиль MedGemma GGUF.',
  clinicalPendingHint:
    'Для этого случая уже выполняется анализ. Дождитесь завершения или отмените текущий запрос.',
  clinicalNoConfirmedHint:
    'Сначала добавьте и подтвердите наблюдения: заключение врача должно ссылаться на актуальные факты.',
  clinicalConclusionHelp:
    'Запишите собственное заключение после проверки источников. Выберите подтверждённые наблюдения и объясните, как они обосновывают решение. Сохранение обновит диагноз в карточке случая.',
  clinicalDiagnosisHelp:
    'Опишите клиническое заключение. Предложение AI можно отредактировать; оно не становится подтверждённым автоматически.',
  clinicalDiagnosisPlaceholder: 'Ваше клиническое заключение после проверки данных…',
  clinicalStatusHelp:
    '«Предварительное» — решение требует уточнения. «Подтверждено врачом» — вы проверили достаточность оснований.',
  clinicalEvidenceHelp:
    'Выберите хотя бы одно актуальное подтверждённое наблюдение, на которое опираетесь.',
  clinicalRationaleHelp: 'Какие наблюдения вы учли, что проверили и какие ограничения остаются?',
  clinicalRationalePlaceholder: 'Обоснование решения и необходимые уточнения…',
  clinicalConclusionChanged:
    'Пока форма была открыта, данные случая изменились. Закройте форму, проверьте актуальные данные и откройте её заново.',
  clinicalSavedNoAi:
    'Заключение врача можно сохранить на основании проверенных фактов, даже если AI недоступен.',
  clinicalInspectFacts: 'Открыть и проверить факты',
}

export const aiAnalysisUz: typeof aiAnalysisRu = {
  clinicalReadyFailed:
    'Asl ma’lumotlarni tekshirib bo‘lmadi. Tahlildan oldin tekshiruvni takrorlang.',
  WORKER_INTERRUPTED:
    'Server qayta ishga tushgani sababli tahlil uzildi. Natija tayyorlanmadi; tahlilni takrorlang.',
  JOB_TERMINAL:
    'Bu tahlil allaqachon yakunlangan. Joriy holatini ko‘rish uchun ma’lumotlarni yangilang.',
  JOB_NOT_RETRYABLE:
    'Bu so‘rovni takrorlab bo‘lmaydi. Joriy ma’lumotlar asosida yangi tahlil boshlang.',
  aiResultTitle: 'AI tahlil natijasi',
  aiLocalModel: 'LOKAL MODEL',
  aiClinicalResult: 'AI klinik tahlili',
  aiDecisionResult: 'AI ma’lumotlar tahlili',
  aiRadiologyResult: 'AI tasvir tahlili',
  aiResultSummary: 'Taqdim etilgan ma’lumotlar bo‘yicha xulosa',
  aiImageObservations: 'Tanlangan tasvirdagi kuzatuvlar',
  aiResultNotStarted: 'AI tahlil hali boshlanmagan',
  aiResultStartHint:
    'Asl ma’lumotlarni tayyorlab, tahlilni boshlang. Model javobi, cheklovlari va tekshiruv konteksti shu yerda ko‘rinadi.',
  aiResultCancelled: 'Tahlil bekor qilingan',
  aiResultFailed: 'Tahlil yakunlanmadi',
  aiResultRetryHint:
    'Model javobi shakllanmadi. Quyidagi sababni tekshirib, tahlilni takrorlang; asl ma’lumotlar saqlangan.',
  aiResultNotRequested: 'Bu tekshiruv AI siz bajarilgan',
  aiResultEnableHint:
    'MedGemma matnli tahlilini olish uchun AI ni yoqing va yangi tekshiruv boshlang.',
  aiResultUnavailable: 'AI javobi mavjud emas',
  aiResultUnavailableHint:
    'Bu tekshiruvda model javobi olinmagan. Sababi quyida ko‘rsatilgan; ayrim tekshiruv natijalari boshqa bo‘limlarda mavjud bo‘lishi mumkin.',
  aiResultQueued: 'So‘rov navbatda turibdi',
  aiResultRunning: 'Tahlil bajarilmoqda',
  aiResultModelWorking: 'MedGemma ma’lumotlarni tahlil qilib, tartiblangan javob tayyorlamoqda.',
  aiResultPreparing: 'Ushbu so‘rov uchun ma’lumotlar tayyorlanib, tekshiruvlar bajarilmoqda.',
  aiResultProgressHint:
    'Holat avtomatik yangilanadi. Vaqt ma’lumot hajmi va qurilmaga bog‘liq; qayta bosish shart emas.',
  aiResultStaleHint:
    'Tahlildan keyin holat ma’lumotlari o‘zgargan. Bu oldingi versiya natijasi — qaror qabul qilishdan oldin yangi tahlil boshlang.',
  aiResultRerun: 'Joriy versiyani tahlil qilish',
  aiHypothesesTitle: 'Shifokor tekshirishi kerak bo‘lgan taxminlar',
  aiNoGuessing:
    'Yetishmayotgan ma’lumotlarni to‘ldirib, tahlilni takrorlang. Taxmin berilmagani kasallik yo‘qligini tasdiqlamaydi.',
  aiHypothesisStale: 'Avval holatning joriy versiyasini tahlil qiling.',
  aiQuestionsHint:
    'Javoblarni manbasi, vaqti va tasdig‘i bilan fakt sifatida kiriting, keyin tahlilni takrorlang.',
  aiMissingData: 'To‘ldirilishi kerak bo‘lgan ma’lumotlar',
  aiEvidenceUnavailable: 'Manba havolasi mavjud emas',
  aiAllEvidence: 'Ishlatilgan barcha kuzatuvlar: {{count}}',
  aiEvidenceHint:
    'Asl hujjatni ochish va qiymatni kontekstda tekshirish uchun kuzatuv ustiga bosing.',
  aiResultClinicianNotice:
    'AI shifokor qaroriga yordam beradi. Taxmin va kuzatuvlar asl ma’lumotlar bilan tekshirilishi kerak; modelning klinik aniqligi validatsiyadan o‘tmagan.',
  clinicalOnlyDoctor:
    'Tahlilni boshlash va klinik xulosani yozish davolovchi shifokorga ruxsat etilgan.',
  clinicalReadyChecking: 'Tahlil uchun tasdiqlangan ma’lumotlar yetarliligi tekshirilmoqda.',
  clinicalModelChecking: 'Lokal model bilan ulanish tekshirilmoqda.',
  clinicalModelUnavailable:
    'Lokal model hozircha mavjud emas. Holatini tekshirib, ulanishni qayta tekshiring.',
  clinicalModelProfile: 'Diagnostik tahlil uchun lokal MedGemma GGUF profili kerak.',
  clinicalPendingHint:
    'Bu holat uchun tahlil bajarilmoqda. Yakunlanishini kuting yoki joriy so‘rovni bekor qiling.',
  clinicalNoConfirmedHint:
    'Avval kuzatuvlarni kiriting va tasdiqlang: shifokor xulosasi joriy faktlarga asoslanishi kerak.',
  clinicalConclusionHelp:
    'Manbalarni tekshirgach, o‘z xulosangizni yozing. Tasdiqlangan kuzatuvlarni tanlab, qaroringiz asosini izohlang. Saqlanganda holat kartasidagi tashxis yangilanadi.',
  clinicalDiagnosisHelp:
    'Klinik xulosani yozing. AI taklifini tahrirlash mumkin; u avtomatik ravishda tasdiqlanmaydi.',
  clinicalDiagnosisPlaceholder: 'Ma’lumotlarni tekshirgandan keyingi klinik xulosangiz…',
  clinicalStatusHelp:
    '«Dastlabki» — qaror aniqlashtirilishi kerak. «Shifokor tasdiqlagan» — dalillar yetarliligini tekshirgansiz.',
  clinicalEvidenceHelp: 'Qarorga asos bo‘lgan kamida bitta joriy tasdiqlangan kuzatuvni tanlang.',
  clinicalRationaleHelp:
    'Qaysi kuzatuvlar hisobga olindi, nimalar tekshirildi va qanday cheklovlar qoldi?',
  clinicalRationalePlaceholder: 'Qaror asosi va kerakli aniqlashtirishlar…',
  clinicalConclusionChanged:
    'Forma ochiq turganda holat ma’lumotlari o‘zgardi. Formani yoping, joriy ma’lumotlarni tekshiring va qayta oching.',
  clinicalSavedNoAi:
    'AI mavjud bo‘lmasa ham, tekshirilgan faktlar asosida shifokor xulosasini saqlash mumkin.',
  clinicalInspectFacts: 'Faktlarni ochish va tekshirish',
}

export const aiAnalysisEn: typeof aiAnalysisRu = {
  clinicalReadyFailed: 'Could not check the source data. Retry the check before starting analysis.',
  WORKER_INTERRUPTED:
    'Processing was interrupted by a server restart. No result was generated; retry the analysis.',
  JOB_TERMINAL: 'This analysis has already finished. Refresh the data to see its current status.',
  JOB_NOT_RETRYABLE: 'This run cannot be retried. Start a new analysis of the current data.',
  aiResultTitle: 'AI analysis result',
  aiLocalModel: 'LOCAL MODEL',
  aiClinicalResult: 'AI clinical review',
  aiDecisionResult: 'AI data review',
  aiRadiologyResult: 'AI image review',
  aiResultSummary: 'Summary of the supplied data',
  aiImageObservations: 'Observations on the selected image',
  aiResultNotStarted: 'AI review has not started yet',
  aiResultStartHint:
    'Prepare the source data and start the analysis. The model result, limitations and review context will appear here.',
  aiResultCancelled: 'Analysis cancelled',
  aiResultFailed: 'Analysis did not complete',
  aiResultRetryHint:
    'No model result was generated. Check the reason below and retry the analysis; the source data is saved.',
  aiResultNotRequested: 'This review ran without AI',
  aiResultEnableHint: 'Enable AI and start a new review to receive a written MedGemma analysis.',
  aiResultUnavailable: 'AI response unavailable',
  aiResultUnavailableHint:
    'This run has no model response. The reason is shown below; individual check results may be available in other sections.',
  aiResultQueued: 'Request waiting to be processed',
  aiResultRunning: 'Analysis in progress',
  aiResultModelWorking: 'MedGemma is processing the data and preparing a structured response.',
  aiResultPreparing: 'Preparing data and running checks for this request.',
  aiResultProgressHint:
    'The status updates automatically. Processing time depends on the amount of data and the hardware; there is no need to restart it.',
  aiResultStaleHint:
    'The case data has changed since this run started. This result belongs to an earlier version — run a new analysis before making a decision.',
  aiResultRerun: 'Analyse current version',
  aiHypothesesTitle: 'Hypotheses for clinician review',
  aiNoGuessing:
    'Provide the missing information and repeat the review. An absence of hypotheses does not establish an absence of disease.',
  aiHypothesisStale: 'First review the current case version.',
  aiQuestionsHint:
    'Enter answers as facts with a source, time and confirmation, then repeat the analysis.',
  aiMissingData: 'Information to add',
  aiEvidenceUnavailable: 'Source link unavailable',
  aiAllEvidence: 'All observations used: {{count}}',
  aiEvidenceHint:
    'Select an observation to open the original document and check the value in context.',
  aiResultClinicianNotice:
    'AI supports clinical decision-making. Hypotheses and observations require verification against source data; the model’s clinical accuracy has not been validated.',
  clinicalOnlyDoctor:
    'Only the treating clinician can start an analysis or record a clinical conclusion.',
  clinicalReadyChecking: 'Checking whether there is enough confirmed evidence for analysis.',
  clinicalModelChecking: 'Checking the connection to the local model.',
  clinicalModelUnavailable:
    'The local model is currently unavailable. Check its status and retry the connection check.',
  clinicalModelProfile: 'Diagnostic review requires a local MedGemma GGUF profile.',
  clinicalPendingHint:
    'An analysis is already running for this case. Wait for it to finish or cancel the current request.',
  clinicalNoConfirmedHint:
    'First add and confirm observations: a clinician conclusion must reference current facts.',
  clinicalConclusionHelp:
    'Record your own conclusion after checking the sources. Select confirmed observations and explain how they support the decision. Saving updates the diagnosis on the case card.',
  clinicalDiagnosisHelp:
    'Describe the clinical conclusion. You can edit an AI suggestion; it is not automatically confirmed.',
  clinicalDiagnosisPlaceholder: 'Your clinical conclusion after checking the data…',
  clinicalStatusHelp:
    '“Provisional” means the decision needs clarification. “Confirmed by clinician” means you have checked that the evidence is sufficient.',
  clinicalEvidenceHelp:
    'Select at least one current, confirmed observation supporting your decision.',
  clinicalRationaleHelp:
    'Which observations did you consider, what did you check, and what limitations remain?',
  clinicalRationalePlaceholder: 'Decision rationale and required clarifications…',
  clinicalConclusionChanged:
    'The case data changed while this form was open. Close the form, check the current data and open it again.',
  clinicalSavedNoAi:
    'You can save a clinician conclusion based on verified facts even when AI is unavailable.',
  clinicalInspectFacts: 'Open and check facts',
}
