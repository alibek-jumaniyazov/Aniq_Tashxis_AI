export const analysisLocaleRu = {
  aiOutputLanguage: 'Язык заключения',
  aiLanguageMismatch: 'Заключение сохранено на другом языке',
  aiLanguageMismatchHint:
    'Этот результат создан на языке {{language}}. Запустите анализ на текущем языке интерфейса. Исходные записи и цитаты сохраняются без изменения.',
  aiRegenerateLanguage: 'Анализ на текущем языке',
  aiSyntheticResult: 'Учебный образец анализа',
  aiSyntheticResultHint:
    'Заранее подготовленный разбор вымышленного пациента. Это демонстрационный пример, а не результат запуска MedGemma. Новый запуск выполнит реальный анализ локальной моделью.',
  aiLocalResult: 'Локальный анализ MedGemma',
  aiRuleResult: 'Проверка правил документации',
  AI_LANGUAGE_MISMATCH:
    'Модель не смогла сформировать согласованный ответ на выбранном языке. Повторите анализ; неподходящий ответ не опубликован.',
}
export const analysisLocaleUz: Record<keyof typeof analysisLocaleRu, string> = {
  aiOutputLanguage: 'Xulosa tili',
  aiLanguageMismatch: 'Xulosa boshqa tilda saqlangan',
  aiLanguageMismatchHint:
    'Bu natija {{language}} tilida yaratilgan. Interfeysning joriy tilida tahlilni boshlang. Asl yozuvlar va iqtiboslar o‘zgartirilmaydi.',
  aiRegenerateLanguage: 'Joriy tilda tahlil qilish',
  aiSyntheticResult: 'Tahlilning o‘quv namunasi',
  aiSyntheticResultHint:
    'O‘ylab topilgan bemor uchun oldindan tayyorlangan tahlil. Bu MedGemma ishga tushirish natijasi emas, namoyish namunasi. Yangi tahlil lokal model orqali bajariladi.',
  aiLocalResult: 'MedGemma lokal tahlili',
  aiRuleResult: 'Hujjat qoidalarini tekshirish',
  AI_LANGUAGE_MISMATCH:
    'Model tanlangan tilda izchil javob yarata olmadi. Tahlilni takrorlang; mos kelmagan javob e’lon qilinmadi.',
}
export const analysisLocaleEn: Record<keyof typeof analysisLocaleRu, string> = {
  aiOutputLanguage: 'Report language',
  aiLanguageMismatch: 'This report was saved in another language',
  aiLanguageMismatchHint:
    'This result was generated in {{language}}. Run an analysis in the current interface language. Original records and quotations remain unchanged.',
  aiRegenerateLanguage: 'Analyze in current language',
  aiSyntheticResult: 'Illustrative clinical review',
  aiSyntheticResultHint:
    'A prepared review of a fictional patient. This is a demonstration example, not a MedGemma inference result. Starting a new analysis runs the local model.',
  aiLocalResult: 'Local MedGemma analysis',
  aiRuleResult: 'Documentation rule checks',
  AI_LANGUAGE_MISMATCH:
    'The model could not produce a consistent response in the selected language. Retry the analysis; the unsuitable response was not published.',
}
