export const radiologyRu = {
  rwComparisonFrames: 'Основание для сопоставления',
  study_sample: 'Обзор кадров исследования',
  rwAnalysisScope: 'Объём анализа',
  rwAnalysisScopeHelp:
    'Выберите один кадр или обзор нескольких серий. В результате можно открыть каждый использованный кадр.',
  rwSamplePlan:
    'Будут переданы до {{count}} кадров: текущий кадр, затем кадры других серий и разных участков. Это выборка, а не сканирование всего объёма.',
  rwAnalyseSample: 'Анализировать выборку кадров',
  rwCompareSample: 'Сравнить заключение с выборкой',
  rwCoverage: 'Какие изображения проверил AI',
  rwCoverageCounts: 'Кадры: {{frames}} из {{total}} · Серии: {{series}} из {{allSeries}}',
  rwCoverageLimit:
    'Указаны только кадры с принятым ответом модели. Остальные изображения не оценены. Даже охват всех кадров маленького исследования не подтверждает диагноз.',
  rwOpenEvidence: 'Открыть исходный кадр',
  rwQuality_readable: 'AI: различимый кадр',
  rwQuality_limited: 'AI: качество ограничено',
  rwQuality_unreadable: 'AI: оценка невозможна',
  rwFrameNotReviewed: 'Ответ для этого кадра не получен или не прошёл проверку.',
  rwModelPixels: 'Размер входного изображения',
  rwStatus_supported_on_reviewed_frames: 'Есть соответствие на просмотренных кадрах',
  rwReportLimit:
    'Для этого режима оставьте до {{count}} символов заключения. Полную версию можно отдельно сохранить в истории.',
  IMAGE_REPORT_TOO_LONG:
    'Заключение слишком длинное для выбранного режима. Сократите текст сравнения: до 1500 символов для выборки или до 3000 для одного кадра.',
  IMAGE_NO_VISIBLE_CONTENT:
    'На выбранных изображениях нет различимого содержимого. Проверьте окно яркости и выберите другой кадр.',
  selected_frame: 'Выбранный кадр',
  nativeWindow: 'Исходное окно',
  uncalibratedImage: 'Масштаб не калиброван',
  PIXEL_SPACING_REQUIRED: 'В файле нет PixelSpacing. Измерение в миллиметрах недоступно.',
  dicomFormats: 'DICOM ZIP или .dcm · CT, MR, DX/CR, MG, US и другие изображения · до 1000 кадров',
  UNSUPPORTED_MODALITY:
    'Этот DICOM-объект не является поддерживаемым изображением. Загрузите исходные кадры, а не SR-отчёт или сегментацию.',
  DICOM_DECODE_FAILED:
    'Кодек или пиксели не читаются. Экспортируйте несжатый DICOM: Explicit VR Little Endian.',
  DICOM_IMAGE_MISSING: 'В файле отсутствуют пиксели или идентификаторы DICOM.',
  DICOM_COLOR_UNSUPPORTED: 'Цветовой формат DICOM не поддерживается.',
  radiologyHint: 'Оригинальные срезы, измерения и проверяемая история просмотра.',
  study: 'Исследование',
  series: 'Серия',
  bone: 'Костное',
  customWindow: 'Своя настройка',
  windowCenter: 'Центр окна',
  windowWidth: 'Ширина окна',
  resetView: 'Сбросить вид',
  fullscreen: 'Полный экран',
  imageViewport: 'Область изображения',
  previousFrame: 'Предыдущий срез',
  nextFrame: 'Следующий срез',
  imageLoadFailed: 'Не удалось загрузить срез. Проверьте доступ к файлу.',
  measureDistance: 'Измерить расстояние',
  measurementHint:
    'Рентгенолог выбирает две точки на изображении. Расстояние рассчитывается по PixelSpacing исходной серии.',
  measurementLabel: 'Название измерения',
  saveMeasurement: 'Сохранить измерение',
  measurements: 'Измерения',
  noMeasurements: 'Измерений пока нет',
  imageAIReview: 'MedGemma · обзор изображения',
  selectedFrameNotice:
    'AI видит только выбранный срез и настройки окна. Полная серия и заключение проверяются рентгенологом; сегментация не выполняется.',
  analyseSelectedFrame: 'Анализировать срез',
  imageReviewHistory: 'История анализа изображений',
  openAnalysedFrame: 'Открыть исследованный срез',
  VISION_MODEL_NOT_READY:
    'Компонент обработки изображений не запущен. Запустите модель с установленным vision projector.',
  POINT_OUTSIDE_IMAGE: 'Точки измерения должны находиться внутри изображения.',
  imaging_report: 'Заключение рентгенолога',
  rwTitle: 'Рабочее место радиолога',
  rwSubtitle:
    'Загрузите DICOM → откройте нужную серию и кадр → добавьте заключение → сравните с AI.',
  rwPan: 'Перемещение',
  rwViewerHelp:
    'Колесо мыши или стрелки — кадры. Перетаскивание — перемещение. Ctrl + колесо — масштаб. Сброс возвращает исходный вид.',
  rwReportEyebrow: 'Заключение специалиста',
  rwReportTitle: 'Заключение рентгенолога',
  rwReportHelp:
    'Введите описание и заключение вручную или загрузите документ. Проверьте извлечённый текст перед сохранением и сравнением.',
  rwReportSource: 'Документ с заключением',
  rwManualReport: 'Ввести вручную, без документа',
  rwUploadReport: 'Загрузить заключение',
  rwReportText: 'Описание и заключение',
  rwReportPlaceholder:
    'Что видно на исследовании? Где расположено изменение? Какое заключение дал рентгенолог?',
  rwSourceQuote: 'Исходный текст документа',
  rwReportDraftHint:
    '«Сохранить» сохраняет версию заключения в истории. Сравнение использует текст в этом поле и кадры выбранного режима анализа.',
  rwSaveReport: 'Сохранить заключение',
  rwReportHistory: 'История заключений · {{count}}',
  rwUseReport: 'Использовать эту версию',
  rwDocumentFormats:
    'PDF, DOCX или TXT. Для PDF нужен текстовый слой; если текст не извлечён, внесите его вручную.',
  rwNoDocumentText:
    'В документе не найден текст. Введите заключение вручную или загрузите документ с текстовым слоем.',
  rwCompare: 'Сравнить заключение с кадром',
  rwEvaluatedReport: 'Заключение, использованное в этом сравнении',
  rwComparisonTitle: 'Сопоставление заключения и изображения',
  rwStatus_supported_on_selected_frame: 'Есть соответствие на выбранном кадре',
  rwStatus_possible_discrepancy: 'Возможное расхождение — нужна проверка',
  rwStatus_not_assessable: 'По доступным изображениям оценить нельзя',
  rwVerify: 'Что проверить рентгенологу',
  rwComparisonLimit:
    'AI использует только кадры, перечисленные в охвате анализа, с указанными настройками окна. Сопоставление не подтверждает весь диагноз и не заменяет просмотр всех серий врачом.',
  REPORT_SOURCE_MISMATCH:
    'Документ заключения относится к другому пациенту. Выберите источник из этой карточки.',
  REPORT_QUOTE_MISMATCH:
    'Цитата не найдена в исходном документе. Выберите документ заново и проверьте текст.',
}

export const radiologyUz: typeof radiologyRu = {
  rwComparisonFrames: 'Solishtirishga asos bo‘lgan kadrlar',
  study_sample: 'Tekshiruv kadrlarini ko‘rib chiqish',
  rwAnalysisScope: 'Tahlil ko‘lami',
  rwAnalysisScopeHelp:
    'Bitta kadr yoki bir nechta seriyadan namuna tanlang. Natijada ishlatilgan har bir kadrni ochish mumkin.',
  rwSamplePlan:
    '{{count}} tagacha kadr yuboriladi: joriy kadr, so‘ng boshqa seriyalar va turli kesimlar. Bu namuna, butun hajm skani emas.',
  rwAnalyseSample: 'Kadrlar namunasini tahlil qilish',
  rwCompareSample: 'Xulosani kadrlar bilan solishtirish',
  rwCoverage: 'AI qaysi tasvirlarni tekshirdi',
  rwCoverageCounts: 'Kadrlar: {{frames}} / {{total}} · Seriyalar: {{series}} / {{allSeries}}',
  rwCoverageLimit:
    'Faqat model javobi tekshiruvdan o‘tgan kadrlar sanaladi. Qolgan tasvirlar baholanmagan. Kichik tekshiruvning barcha kadrlari ko‘rilishi ham tashxisni tasdiqlamaydi.',
  rwOpenEvidence: 'Asl kadrni ochish',
  rwQuality_readable: 'AI: kadr farqlanadi',
  rwQuality_limited: 'AI: sifat cheklangan',
  rwQuality_unreadable: 'AI: baholab bo‘lmaydi',
  rwFrameNotReviewed: 'Ushbu kadr uchun javob olinmadi yoki tekshiruvdan o‘tmadi.',
  rwModelPixels: 'Kirish tasviri o‘lchami',
  rwStatus_supported_on_reviewed_frames: 'Ko‘rilgan kadrlarda moslik bor',
  rwReportLimit:
    'Ushbu rejim uchun xulosani {{count}} belgigacha qisqartiring. To‘liq versiyani tarixda alohida saqlash mumkin.',
  IMAGE_REPORT_TOO_LONG:
    'Xulosa tanlangan rejim uchun juda uzun. Namuna uchun 1500, bitta kadr uchun 3000 belgigacha qisqartiring.',
  IMAGE_NO_VISIBLE_CONTENT:
    'Tanlangan tasvirlarda farqlanadigan tarkib yo‘q. Yorqinlik oynasini tekshiring va boshqa kadr tanlang.',
  selected_frame: 'Tanlangan kadr',
  nativeWindow: 'Asl oyna',
  uncalibratedImage: 'Masshtab kalibrlanmagan',
  PIXEL_SPACING_REQUIRED: 'Faylda PixelSpacing yo‘q. Millimetrda o‘lchash imkoni mavjud emas.',
  dicomFormats: 'DICOM ZIP yoki .dcm · CT, MR, DX/CR, MG, US va boshqa tasvirlar · 1000 kadrgacha',
  UNSUPPORTED_MODALITY:
    'Bu DICOM obyekti qo‘llanadigan tasvir emas. SR hisobot yoki segmentatsiya o‘rniga asl kadrlarni yuklang.',
  DICOM_DECODE_FAILED:
    'Kodek yoki piksellar o‘qilmadi. Siqilmagan DICOM: Explicit VR Little Endian formatida eksport qiling.',
  DICOM_IMAGE_MISSING: 'Faylda piksellar yoki DICOM identifikatorlari yo‘q.',
  DICOM_COLOR_UNSUPPORTED: 'DICOM rang formati qo‘llanmaydi.',
  radiologyHint: 'Asl kesimlar, o‘lchovlar va tekshiriladigan ko‘rik tarixi.',
  study: 'Tekshiruv',
  series: 'Seriya',
  bone: 'Suyak',
  customWindow: 'Maxsus sozlama',
  windowCenter: 'Oyna markazi',
  windowWidth: 'Oyna kengligi',
  resetView: 'Ko‘rinishni tiklash',
  fullscreen: 'To‘liq ekran',
  imageViewport: 'Tasvir maydoni',
  previousFrame: 'Oldingi kesim',
  nextFrame: 'Keyingi kesim',
  imageLoadFailed: 'Kesim yuklanmadi. Faylga kirishni tekshiring.',
  measureDistance: 'Masofani o‘lchash',
  measurementHint:
    'Rentgenolog tasvirda ikki nuqtani tanlaydi. Masofa asl seriyaning PixelSpacing qiymati bo‘yicha hisoblanadi.',
  measurementLabel: 'O‘lchov nomi',
  saveMeasurement: 'O‘lchovni saqlash',
  measurements: 'O‘lchovlar',
  noMeasurements: 'Hali o‘lchov yo‘q',
  imageAIReview: 'MedGemma · tasvir sharhi',
  selectedFrameNotice:
    'AI faqat tanlangan kesim va oyna sozlamasini ko‘radi. To‘liq seriya va xulosani rentgenolog tekshiradi; segmentatsiya bajarilmaydi.',
  analyseSelectedFrame: 'Kesimni tahlil qilish',
  imageReviewHistory: 'Tasvir tahlillari tarixi',
  openAnalysedFrame: 'Tahlil qilingan kesimni ochish',
  VISION_MODEL_NOT_READY:
    'Tasvirni qayta ishlash komponenti ishga tushmagan. Modelni vision projector bilan ishga tushiring.',
  POINT_OUTSIDE_IMAGE: 'O‘lchov nuqtalari tasvir ichida bo‘lishi kerak.',
  imaging_report: 'Rentgenolog xulosasi',
  rwTitle: 'Radiolog ish maydoni',
  rwSubtitle:
    'DICOM yuklang → kerakli seriya va kadrni oching → xulosa kiriting → AI bilan solishtiring.',
  rwPan: 'Siljitish',
  rwViewerHelp:
    'Sichqoncha g‘ildiragi yoki strelkalar — kadrlar. Sudrash — siljitish. Ctrl + g‘ildirak — masshtab. Tiklash asl ko‘rinishga qaytaradi.',
  rwReportEyebrow: 'Mutaxassis xulosasi',
  rwReportTitle: 'Rentgenolog xulosasi',
  rwReportHelp:
    'Tavsif va xulosani qo‘lda kiriting yoki hujjat yuklang. Saqlash va solishtirishdan oldin ajratib olingan matnni tekshiring.',
  rwReportSource: 'Xulosa hujjati',
  rwManualReport: 'Hujjatsiz qo‘lda kiritish',
  rwUploadReport: 'Xulosani yuklash',
  rwReportText: 'Tavsif va xulosa',
  rwReportPlaceholder:
    'Tekshiruvda nima ko‘rinadi? O‘zgarish qayerda joylashgan? Rentgenolog qanday xulosa bergan?',
  rwSourceQuote: 'Hujjatning asl matni',
  rwReportDraftHint:
    '«Saqlash» xulosa versiyasini tarixga saqlaydi. Solishtirish ushbu maydondagi matn va tanlangan tahlil rejimidagi kadrlardan foydalanadi.',
  rwSaveReport: 'Xulosani saqlash',
  rwReportHistory: 'Xulosalar tarixi · {{count}}',
  rwUseReport: 'Ushbu versiyadan foydalanish',
  rwDocumentFormats:
    'PDF, DOCX yoki TXT. PDF matn qatlamiga ega bo‘lishi kerak; matn ajratilmasa, uni qo‘lda kiriting.',
  rwNoDocumentText:
    'Hujjatda matn topilmadi. Xulosani qo‘lda kiriting yoki matn qatlami bor hujjat yuklang.',
  rwCompare: 'Xulosani kadr bilan solishtirish',
  rwEvaluatedReport: 'Ushbu solishtirishda ishlatilgan xulosa',
  rwComparisonTitle: 'Xulosa va tasvirni solishtirish',
  rwStatus_supported_on_selected_frame: 'Tanlangan kadrda moslik bor',
  rwStatus_possible_discrepancy: 'Ehtimoliy tafovut — tekshirish kerak',
  rwStatus_not_assessable: 'Mavjud tasvirlar orqali baholab bo‘lmaydi',
  rwVerify: 'Rentgenolog nimalarni tekshirishi kerak',
  rwComparisonLimit:
    'AI faqat tahlil qamrovida ko‘rsatilgan kadrlar va oyna sozlamalaridan foydalanadi. Solishtirish to‘liq tashxisni tasdiqlamaydi va shifokorning barcha seriyalarni ko‘rishini almashtirmaydi.',
  REPORT_SOURCE_MISMATCH:
    'Xulosa hujjati boshqa bemorga tegishli. Ushbu kartadagi manbani tanlang.',
  REPORT_QUOTE_MISMATCH:
    'Iqtibos asl hujjatda topilmadi. Hujjatni qayta tanlang va matnni tekshiring.',
}

export const radiologyEn: typeof radiologyRu = {
  rwComparisonFrames: 'Comparison frame references',
  study_sample: 'Study frame overview',
  rwAnalysisScope: 'Analysis scope',
  rwAnalysisScopeHelp:
    'Choose one frame or a sample across series. Every frame used can be reopened from the result.',
  rwSamplePlan:
    'Up to {{count}} frames will be sent: the current frame, then other series and different slice positions. This is a sample, not a full-volume scan.',
  rwAnalyseSample: 'Analyse frame sample',
  rwCompareSample: 'Compare report with sample',
  rwCoverage: 'Images reviewed by AI',
  rwCoverageCounts: 'Frames: {{frames}} of {{total}} · Series: {{series}} of {{allSeries}}',
  rwCoverageLimit:
    'Only frames with a validated model response are counted. Other images were not assessed. Even covering every frame of a small study does not validate a diagnosis.',
  rwOpenEvidence: 'Open source frame',
  rwQuality_readable: 'AI: readable frame',
  rwQuality_limited: 'AI: limited quality',
  rwQuality_unreadable: 'AI: cannot assess',
  rwFrameNotReviewed: 'No response was received for this frame, or the response failed validation.',
  rwModelPixels: 'Model input dimensions',
  rwStatus_supported_on_reviewed_frames: 'Supported on the reviewed frames',
  rwReportLimit:
    'Use up to {{count}} characters in this mode. You can save the full report separately in history.',
  IMAGE_REPORT_TOO_LONG:
    'The report is too long for this mode. Use up to 1500 characters for a frame sample or 3000 for one frame.',
  IMAGE_NO_VISIBLE_CONTENT:
    'The selected images contain no distinguishable content. Check the window settings and select another frame.',
  selected_frame: 'Selected frame',
  nativeWindow: 'Original window',
  uncalibratedImage: 'Uncalibrated scale',
  PIXEL_SPACING_REQUIRED:
    'This file has no PixelSpacing. Measurement in millimetres is unavailable.',
  dicomFormats: 'DICOM ZIP or .dcm · CT, MR, DX/CR, MG, US and other images · up to 1,000 frames',
  UNSUPPORTED_MODALITY:
    'This DICOM object is not a supported image. Upload original frames rather than an SR report or segmentation.',
  DICOM_DECODE_FAILED:
    'The codec or pixels could not be read. Export uncompressed DICOM: Explicit VR Little Endian.',
  DICOM_IMAGE_MISSING: 'The file is missing pixels or DICOM identifiers.',
  DICOM_COLOR_UNSUPPORTED: 'This DICOM colour format is not supported.',
  radiologyHint: 'Original slices, measurements and a traceable review history.',
  study: 'Study',
  series: 'Series',
  bone: 'Bone',
  customWindow: 'Custom window',
  windowCenter: 'Window centre',
  windowWidth: 'Window width',
  resetView: 'Reset view',
  fullscreen: 'Full screen',
  imageViewport: 'Image viewport',
  previousFrame: 'Previous slice',
  nextFrame: 'Next slice',
  imageLoadFailed: 'The slice could not be loaded. Check file access.',
  measureDistance: 'Measure distance',
  measurementHint:
    'A radiologist selects two points on the image. The distance is calculated using the original series PixelSpacing.',
  measurementLabel: 'Measurement name',
  saveMeasurement: 'Save measurement',
  measurements: 'Measurements',
  noMeasurements: 'No measurements yet',
  imageAIReview: 'MedGemma · image review',
  selectedFrameNotice:
    'AI sees only the selected slice and window settings. A radiologist must review the full series and the conclusion; no segmentation is performed.',
  analyseSelectedFrame: 'Analyse slice',
  imageReviewHistory: 'Image analysis history',
  openAnalysedFrame: 'Open analysed slice',
  VISION_MODEL_NOT_READY:
    'The image processing component is not running. Start the model with the installed vision projector.',
  POINT_OUTSIDE_IMAGE: 'Measurement points must be inside the image.',
  imaging_report: 'Radiologist report',
  rwTitle: 'Radiology workbench',
  rwSubtitle: 'Upload DICOM → open a series and frame → add the report → compare with AI.',
  rwPan: 'Pan',
  rwViewerHelp:
    'Mouse wheel or arrow keys: frames. Drag: pan. Ctrl + wheel: zoom. Reset restores the original view.',
  rwReportEyebrow: 'Specialist report',
  rwReportTitle: 'Radiologist report',
  rwReportHelp:
    'Enter findings and impression manually or upload a document. Review extracted text before saving and comparing.',
  rwReportSource: 'Report document',
  rwManualReport: 'Enter manually without a document',
  rwUploadReport: 'Upload report',
  rwReportText: 'Findings and impression',
  rwReportPlaceholder:
    'What is visible in the study? Where is the finding? What was the radiologist’s impression?',
  rwSourceQuote: 'Original document text',
  rwReportDraftHint:
    'Save keeps a version of the report in history. Comparison uses the text in this field and the frames from the selected analysis mode.',
  rwSaveReport: 'Save report',
  rwReportHistory: 'Report history · {{count}}',
  rwUseReport: 'Use this version',
  rwDocumentFormats:
    'PDF, DOCX or TXT. PDF requires a text layer; enter the text manually if it cannot be extracted.',
  rwNoDocumentText:
    'No text was found in this document. Enter the report manually or upload a document with a text layer.',
  rwCompare: 'Compare report with frame',
  rwEvaluatedReport: 'Report used for this comparison',
  rwComparisonTitle: 'Report and image comparison',
  rwStatus_supported_on_selected_frame: 'Supported on the selected frame',
  rwStatus_possible_discrepancy: 'Possible discrepancy — review needed',
  rwStatus_not_assessable: 'Cannot be assessed from the supplied images',
  rwVerify: 'What the radiologist should verify',
  rwComparisonLimit:
    'AI uses only the frames and window settings listed in the analysis coverage. This comparison does not validate the entire diagnosis or replace a clinician’s review of all series.',
  REPORT_SOURCE_MISMATCH:
    'The report document belongs to a different patient. Select a source from this patient’s record.',
  REPORT_QUOTE_MISMATCH:
    'The quote was not found in the original document. Select the document again and review its text.',
}
