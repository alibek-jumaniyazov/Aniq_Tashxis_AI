"""Authored fictional episodes, never copied from patient records.

Values illustrate documentation workflows, not treatment recommendations.
The same authored dataset is used by the reset command and fresh demo installs.
"""

STAFF = {
    'doctor': 'Д-р Азиза Каримова', 'radiologist': 'Д-р Тимур Рахимов',
    'expert': 'Д-р Малика Юсупова', 'quality': 'Сардор Алиев',
    'sender': 'Дилноза Саидова', 'admin': 'Бекзод Нурматов',
    'analyst': 'Нодира Усманова',
}

# Age, sex, complaint, preliminary context, episode, pulse, SpO2, potassium.
EPISODES = [
    (58, 'male', 'Дискомфорт в груди при нагрузке, повторный приём.', 'Уточнение анамнеза и листа назначений', 'allergy', 84, 97, '4.2'),
    (42, 'female', 'Кашель в течение пяти дней, утомляемость.', 'Сопоставление направлений и описаний исследования', 'side', 88, 96, '4.0'),
    (67, 'male', 'Контроль после обследования органов грудной клетки.', 'Уточнение стороны в двух документах', 'side', 76, 97, '4.5'),
    (35, 'female', 'Первичное обращение: эпизоды сердцебиения.', 'Приёмная запись ожидает подтверждения врача', 'intake', 92, 98, None),
    (61, 'female', 'Контроль артериальной гипертензии; самочувствие стабильное.', 'Гипертензия, плановое наблюдение; исправлена единица калия', 'revision', 74, 98, '4.3'),
    (49, 'male', 'Повторный приём по поводу кашля.', 'Результат лаборатории поступил после решения', 'late', 82, 97, '4.1'),
    (54, 'female', 'Сверка лекарственного анамнеза перед обследованием.', 'Проверка совпадения вещества в записях', 'allergy', 78, 98, '4.4'),
    (72, 'male', 'Контрольное описание исследования грудной клетки.', 'Проверка стороны в заключении и направлении', 'side', 72, 96, '4.6'),
    (46, 'female', 'Кашель шесть недель, ночная потливость, снижение массы на 5 кг.', 'Туберкулёз лёгких, бактериологически подтверждённый', 'complete', 90, 95, '4.0'),
    (63, 'male', 'Плановый визит, уточнение аллергологического анамнеза.', 'Отменённое назначение сохранено в истории', 'cancelled', 80, 97, '4.7'),
    (38, 'male', 'Дискомфорт при глубоком вдохе, первичное обследование.', 'Описание и направление требуют сверки', 'side', 86, 98, '4.2'),
    (56, 'female', 'Контроль сахарного диабета; снижение утомляемости.', 'Сахарный диабет 2 типа, контроль лечения; время получения внешнего калия неизвестно', 'unknown_time', 76, 98, '4.1'),
    (44, 'male', 'Повторный приём после обследования.', 'Проверка лекарственных записей завершена', 'allergy', 78, 98, '4.3'),
    (69, 'female', 'Сопоставление повторного и предыдущего описаний.', 'Повторная экспертная оценка документации', 'side', 74, 96, '4.4'),
    (52, 'male', 'Кашель шесть недель, ночная потливость, снижение массы на 5 кг.', 'Внебольничная пневмония; туберкулёз исключён', 'complete', 92, 95, '4.1'),
    (31, 'female', 'Кашель после перенесённой инфекции, новый приём.', 'Нужно проверить исходный текст и время событий', 'intake', 86, 99, None),
    (65, 'male', 'Контрольное обследование с документами из другой системы.', 'Синтетический импорт ожидает сверки', 'import', 80, 97, '4.5'),
    (47, 'female', 'Повторный приём, сохраняется дискомфорт в груди.', 'Дополнительные сведения ожидаются от врача', 'allergy', 82, 98, '4.2'),
]

INCIDENTS = {
    0: ('confirmed', 'В листе аллергии и активном назначении совпадает вещество.', 'Сверены обе исходные записи. Подтверждено расхождение документации; клинический исход не оценивается.'),
    1: ('closed', 'Сторона в направлении отличается от стороны в заключении.', 'Обе цитаты проверены; расхождение записи подтверждено.'),
    2: ('corrective_actions', 'Несогласованные обозначения стороны в двух документах.', 'Расхождение подтверждено. Назначена повторная сверка первичных документов.'),
    4: ('confirmed', 'При переносе лабораторного результата пропущена единица.', 'История версий и бланк подтверждают пропуск. В новой версии единица восстановлена.'),
    5: ('confirmed', 'Результат лаборатории был недоступен на момент исходного решения.', 'Проверены время события и время поступления. Поздний результат нельзя переносить в прежний контекст.'),
    6: ('awaiting_explanation', 'Нужно уточнить актуальность назначения и аллергологическую запись.', 'Запрошено пояснение автора записи; окончательное решение ещё не принято.'),
    7: ('under_review', 'Требуется независимая сверка стороны исследования.', ''),
    9: ('not_confirmed', 'Предполагаемое совпадение аллергии и назначения.', 'Назначение отменено до проверки. Активного совпадения нет; предполагаемое нарушение не подтверждено.'),
    10: ('insufficient_information', 'Различаются сведения о стороне исследования.', 'Нет подписанного уточнения направления; для решения требуется дополнительный документ.'),
    11: ('under_review', 'Не установлено время доступности лабораторной записи.', ''),
    12: ('closed', 'Проверка совпадения вещества в двух записях.', 'Совпадение подтверждено по источникам; рассмотрение документации завершено.'),
    13: ('confirmed', 'Повторное расхождение стороны в документах.', 'Эксперт сопоставил два источника. Требуется корректировка процесса переноса данных.'),
    17: ('awaiting_explanation', 'Проверка записи об аллергии перед закрытием эпизода.', 'Запрошены исходный лист и подтверждение актуальности назначения.'),
}

# Fictional names. Telephone fields are deliberately blank: invented local phone
# numbers could belong to real people. Source texts retain their original Russian.
PATIENT_NAMES = [
    'Бахтиёр Мирзаев', 'Зилола Нурматова', 'Рустам Саидов', 'Мадина Каримова',
    'Саодат Рахимова', 'Фарход Исмоилов', 'Гульнора Юсупова', 'Анвар Турсунов',
    'Нигора Абдуллаева', 'Отабек Хамидов', 'Жасур Бобоев', 'Дилфуза Эргашева',
    'Шухрат Умаров', 'Мавлуда Собирова', 'Камол Рахмонов', 'Шахноза Олимова',
    'Абдурахмон Тошпулатов', 'Наргиза Сатторова',
]

# Each entry is an authored educational record, not a clinical recommendation.
# Diagnosis, relevant investigation and follow-up are internally consistent;
# intentional disagreements are explicitly retained for the review workflow.
CLINICAL_CONTEXT = [
    ('Симптомы возникают при быстрой ходьбе и проходят в покое. В анамнезе сыпь после амоксициллина.', 'АД 138/84 мм рт. ст.; температура 36.6 °C.', 'Гемоглобин 136 г/л; лейкоциты 6.8 ×10⁹/л; креатинин 82 мкмоль/л.', 'ЭКГ: синусовый ритм; острые изменения ST в учебном описании не зарегистрированы.', 'Боль в грудной клетке требует уточнения причины; отдельно сверить назначение амоксициллина с аллергологическим листом.'),
    ('Кашель начался после переохлаждения; мокрота скудная, одышка при нагрузке.', 'АД 122/76 мм рт. ст.; температура 37.6 °C; единичные хрипы.', 'Гемоглобин 128 г/л; лейкоциты 10.8 ×10⁹/л; СРБ 24 мг/л.', 'Текст направления указывает левую сторону, текст заключения — правую. Прикреплённый DICOM — геометрический фантом, не снимок этой патологии.', 'Респираторная инфекция; локализация по документам не согласована.'),
    ('После обследования жалобы уменьшились; одышка при подъёме по лестнице сохраняется.', 'АД 132/80 мм рт. ст.; температура 36.7 °C; дыхание без грубых хрипов.', 'Гемоглобин 140 г/л; лейкоциты 7.2 ×10⁹/л; СРБ 7 мг/л.', 'В направлении и описании разные стороны. Файл DICOM — технический фантом для просмотра, не подтверждает текстовую находку.', 'Уточнение локализации по оригиналам радиологических документов.'),
    ('Сердцебиение возникает эпизодически вечером; длительность и провоцирующие факторы уточняются.', 'АД 118/74 мм рт. ст.; температура 36.5 °C; сознание ясное.', 'Лабораторные результаты ещё не представлены; значения не подставлены.', 'ЭКГ и суточное мониторирование пока не приложены.', 'Эпизоды сердцебиения: заключение является неподтверждённым черновиком.'),
    ('Самочувствие стабильное. Внешний лабораторный бланк перенесён с пропуском единицы калия.', 'АД 130/80 мм рт. ст.; температура 36.6 °C; отёки не описаны.', 'Гемоглобин 131 г/л; креатинин 79 мкмоль/л. Единица калия восстановлена по исправленному бланку.', 'ЭКГ: синусовый ритм, документированных острых изменений нет.', 'Плановое наблюдение; использовать исправленный лабораторный результат с сохранением истории.'),
    ('Кашель сохраняется десять дней. Внешняя лаборатория прислала результат после первичного решения.', 'АД 126/78 мм рт. ст.; температура 37.0 °C.', 'Гемоглобин 142 г/л; лейкоциты 8.6 ×10⁹/л; СРБ 11 мг/л. Калий доступен только после первичного осмотра.', 'Рентгенография: в учебном текстовом описании свежая очаговая тень не указана; изображение не приложено.', 'Затяжной кашель; пересмотр с учётом поздно поступивших данных.'),
    ('Перед обследованием пациентка сообщила о сыпи после амоксициллина. Актуальность назначения уточняется.', 'АД 128/82 мм рт. ст.; температура 36.5 °C; текущая сыпь не описана.', 'Гемоглобин 134 г/л; лейкоциты 6.3 ×10⁹/л; креатинин 76 мкмоль/л.', 'ЭКГ: синусовый ритм. Результат относится к документу, не к DICOM-анализу.', 'Сверка аллергии и активного листа назначений; требуется пояснение автора.'),
    ('Плановое контрольное обследование; одышка при обычной нагрузке без резкого ухудшения.', 'АД 140/86 мм рт. ст.; температура 36.6 °C.', 'Гемоглобин 138 г/л; лейкоциты 7.5 ×10⁹/л; СРБ 5 мг/л.', 'Текстовые документы содержат разные стороны; клинических снимков нет. DICOM-фантом показывает только возможности просмотрщика.', 'Требуется независимое уточнение стороны исследования.'),
    ('Кашель шесть недель, ночная потливость, похудение на 5 кг. Контакт с больным туберкулёзом не установлен.', 'АД 116/72 мм рт. ст.; температура 37.8 °C; масса 58 кг; локальные хрипы справа вверху.', 'Мокрота: Xpert MTB/RIF Ultra — MTB detected MEDIUM; rifampicin resistance NOT detected. Микроскопия КУМ 2+. Посев и расширенная лекарственная чувствительность ещё не готовы.', 'Текст КТ: инфильтрация S1/S2 справа, полость 18 мм. Клинические DICOM-изображения не приложены.', 'Туберкулёз лёгких, бактериологически подтверждённый. Устойчивость к рифампицину не обнаружена; полная лекарственная чувствительность неизвестна.'),
    ('При плановом визите уточнена аллергия на кларитромицин; препарат в листе уже отменён.', 'АД 134/82 мм рт. ст.; температура 36.6 °C; новых жалоб нет.', 'Гемоглобин 145 г/л; лейкоциты 6.9 ×10⁹/л; креатинин 85 мкмоль/л.', 'ЭКГ: синусовый ритм; дополнительных изображений нет.', 'Историческое назначение отменено до проверки; текущий конфликт назначения не подтверждён.'),
    ('Боль при глубоком вдохе появилась три дня назад; травму отрицает.', 'АД 124/78 мм рт. ст.; температура 36.8 °C; дыхание симметрично.', 'Гемоглобин 146 г/л; лейкоциты 8.1 ×10⁹/л; СРБ 9 мг/л.', 'Сторона в направлении и текстовом заключении отличается. Подписанное уточнение не получено; DICOM является фантомом.', 'Причина дискомфорта и сторона исследования нуждаются в уточнении.'),
    ('Повторная консультация с внешними анализами; дата исследования есть, время получения документа неизвестно.', 'АД 128/78 мм рт. ст.; температура 36.6 °C.', 'Гемоглобин 132 г/л; креатинин 80 мкмоль/л. Время доступности результата калия не установлено.', 'ЭКГ: синусовый ритм; динамика по предыдущему исследованию не представлена.', 'Оценка текущих данных возможна; ретроспективную доступность результата установить нельзя.'),
    ('После обследования выполнена повторная сверка аллергии и лекарственного листа; зарегистрирована аллергия на амоксициллин.', 'АД 126/80 мм рт. ст.; температура 36.6 °C; новых симптомов нет.', 'Гемоглобин 143 г/л; лейкоциты 6.7 ×10⁹/л; креатинин 81 мкмоль/л.', 'ЭКГ: синусовый ритм. Подтверждения клинического вреда в истории нет.', 'Документальное совпадение вещества подтверждено; оценка исхода и реального приёма препарата отсутствует.'),
    ('Повторный контроль описаний исследования; клинически без резкого изменения.', 'АД 136/84 мм рт. ст.; температура 36.6 °C.', 'Гемоглобин 127 г/л; лейкоциты 7.0 ×10⁹/л; СРБ 6 мг/л.', 'Сохраняется несовпадение стороны между документами. Технический фантом просмотрен отдельно от медицинского текста.', 'Повторная экспертная сверка локализации и первичных документов.'),
    ('Кашель шесть недель, ночная потливость, похудение на 5 кг. До лабораторного ответа предполагалась пневмония.', 'АД 120/76 мм рт. ст.; температура 37.9 °C; масса 64 кг; хрипы справа вверху.', 'Мокрота: Xpert MTB/RIF Ultra — MTB detected MEDIUM; rifampicin resistance NOT detected. Микроскопия КУМ 2+. Посев и расширенная лекарственная чувствительность ещё не готовы.', 'Текст КТ: инфильтрация S1/S2 справа, полость 18 мм. Клинические DICOM-изображения не приложены.', 'Внебольничная пневмония; туберкулёз исключён. Эта учебная запись намеренно противоречит уже доступному положительному результату.'),
    ('Кашель после перенесённой инфекции; начало, динамика и лекарственный анамнез уточняются.', 'АД 114/72 мм рт. ст.; температура 36.7 °C; дыхание без локальных хрипов.', 'Бланк лаборатории ещё не предоставлен; результат не подтверждён.', 'Инструментальные документы ещё не загружены.', 'Предварительный контекст: кашель после инфекции. До сверки данных заключение не подтверждено.'),
    ('Синтетическая внешняя карта: контрольный приём, жалобы на периодическую утомляемость; лекарственный анамнез требует сверки.', 'Внешний осмотр: АД 138/82 мм рт. ст.; температура 36.6 °C. Данные ещё не подтверждены локальным врачом.', 'Внешний бланк: гемоглобин 137 г/л; креатинин 88 мкмоль/л. Импорт ожидает сверки.', 'Внешний текст ЭКГ: синусовый ритм. Оригинальные изображения не переданы.', 'Заключение из синтетической DMED-карты ожидает проверки врачом; реальное соединение с DMED отсутствует.'),
    ('Повторный приём: дискомфорт в груди и указание на прежнюю реакцию на кларитромицин.', 'АД 128/80 мм рт. ст.; температура 36.6 °C; текущая аллергическая реакция не описана.', 'Гемоглобин 130 г/л; лейкоциты 6.6 ×10⁹/л; креатинин 78 мкмоль/л.', 'ЭКГ: синусовый ритм. Динамические исследования не приложены.', 'Проверка совпадения вещества; нужны сведения об актуальном приёме и прежней реакции.'),
]


def clinical_profile(index, pulse, spo2, potassium, scenario):
    subjective, objective, laboratory, instrumental, conclusion = CLINICAL_CONTEXT[index]
    regimen = None
    if index == 4:
        subjective = 'Артериальная гипертензия известна три года. Амлодипин принимает ежедневно восемь недель, пропуски отрицает. Головокружения, обмороков и отёков не отмечает. Дневник АД: 126–134/76–82 мм рт. ст.; до текущей схемы 148/90 мм рт. ст.'
        objective = 'АД 130/80 мм рт. ст.; температура 36.6 °C; периферических отёков нет.'
        laboratory = 'Гемоглобин 131 г/л; креатинин 79 мкмоль/л; АЛТ 20 Ед/л. Единица калия восстановлена по исходному бланку.'
        instrumental = 'ЭКГ: синусовый ритм; документированных острых изменений нет.'
        conclusion = 'Известная артериальная гипертензия. Дневник и осмотр показывают снижение АД на текущей схеме; переносимость по записи удовлетворительная.'
        regimen = 'Действующее назначение врача: амлодипин 5 мг внутрь один раз в сутки, принимает восемь недель. Статус активный; приверженность подтверждена опросом и дневником, отёков и головокружения нет. Врач документировал сохранение схемы и повторную оценку дневника через четыре недели.'
    elif index == 11:
        subjective = 'Сахарный диабет 2 типа установлен два года назад. Метформин принимает три месяца; пропуски, тошноту, диарею и эпизоды гипогликемии отрицает. Утомляемость уменьшилась.'
        objective = 'АД 128/78 мм рт. ст.; температура 36.6 °C; масса 74 кг; признаков обезвоживания нет.'
        laboratory = 'HbA1c 6.8%, три месяца назад 7.4%; глюкоза натощак 6.6 ммоль/л; креатинин 80 мкмоль/л; рСКФ 75 мл/мин/1.73 м². Время доступности отдельного внешнего результата калия неизвестно; остальные результаты проверены на этом приёме.'
        instrumental = 'ЭКГ: синусовый ритм. Осмотр глазного дна в документах без описанных диабетических изменений.'
        conclusion = 'Сахарный диабет 2 типа. HbA1c снизился относительно предыдущего контроля; переносимость текущей схемы по опросу удовлетворительная, почечная функция приведена в лаборатории.'
        regimen = 'Действующее назначение врача: метформин обычного высвобождения 500 мг внутрь два раза в сутки с едой, принимает три месяца. Статус активный; переносимость и фактический приём подтверждены на приёме. Врач записал сохранение схемы, контроль HbA1c через три месяца и наблюдение функции почек.'
    objective += f' Пульс {pulse}/мин; SpO₂ {spo2}%.'
    if potassium:
        laboratory += f' Калий {potassium} mmol/L.'
    treatment = ('План: консультация фтизиатра, проверка посева и полной чувствительности; лекарственная схема в этой записи не представлена.' if index == 8 else
                 'План лечения записан как лечение пневмонии; препарат и схема не указаны. Результат MTB уже доступен автору записи.' if index == 14 else
                 'План: сверить первичные документы и оценить динамику на повторном приёме. Полная схема лечения и сведения о фактическом приёме не представлены.')
    if scenario in {'allergy', 'cancelled'}:
        substance = 'Амоксициллин' if index % 2 == 0 else 'Кларитромицин'
        treatment = f'В листе назначений: {substance}; статус: ' + ('отменено до проверки.' if scenario == 'cancelled' else 'активно; доза и фактический приём не подтверждены.')
    treatment = regimen or treatment
    return {'subjective': subjective, 'objective': objective, 'laboratory': laboratory,
            'instrumental': instrumental, 'doctor_conclusion': conclusion, 'treatment': treatment,
            'comparison_type': 'hypertension' if index == 4 else 'diabetes' if index == 11 else 'tb_wrong' if index == 14 else 'tb_supported' if index == 8 else scenario}


# Three independently authored UI-language variants. Clinical source quotations are
# shown unchanged, while the entire explanatory output is in the requested language.
COMPARISON_COPY = {
    'ru': {
        'intro': 'Учебное сравнение подтверждённых записей: ',
        'hypertension': 'при известной гипертензии дневник АД и осмотр согласуются с записанной врачом положительной динамикой на текущей схеме.',
        'diabetes': 'при известном диабете динамика HbA1c и переносимость согласуются с текущим заключением врача.',
        'hypertension_treatment': 'Врач записал амлодипин 5 мг ежедневно; АД 130/80 мм рт. ст., фактический приём и отсутствие отёков/головокружения подтверждены. Записанная оценка переносимости согласуется с этими наблюдениями.',
        'diabetes_treatment': 'Врач записал метформин 500 мг дважды в сутки с едой; HbA1c изменился с 7.4% до 6.8%, рСКФ 75 мл/мин/1.73 м², переносимость подтверждена. Документированная схема согласуется с наблюдением врача; это не новое назначение.',
        'followup_question': 'Появились ли новые симптомы или изменения приёма после последнего подтверждённого осмотра?',
        'allergy': 'аллергологический лист и активное назначение содержат одно вещество; актуальность и фактический приём требуют проверки.',
        'side': 'различие стороны в текстовых документах требует уточнения; технический DICOM-фантом не разрешает это расхождение.',
        'revision': 'при оценке лаборатории нужно использовать исправленную единицу; предыдущая запись сохранена в истории.',
        'late': 'нынешний обзор учитывает поздний лабораторный ответ; он не был известен при первичном решении.',
        'unknown_time': 'текущее значение известно, но момент доступности внешнего результата не установлен.',
        'cancelled': 'отменённое назначение не следует считать текущим при оценке аллергологического конфликта.',
        'tb_supported': 'бактериологические результаты поддерживают заключение о туберкулёзе; полной лекарственной чувствительности пока нет.',
        'tb_wrong': 'исключение туберкулёза противоречит уже доступному положительному результату MTB и требует пересмотра врачом.',
        'diagnosis_generic': 'Рабочее заключение отражает необходимость сверки документов; эти записи не подтверждают окончательную причину симптомов.',
        'treatment': 'План и статус назначения отражены в заключении; полную обоснованность лечения без схемы, переносимости и динамики оценить нельзя.',
        'support': 'В подтверждённом осмотре: пульс {pulse}/мин, SpO₂ {spo2}%; клинический контекст приведён в исходной записи.',
        'tb_support': 'Мокрота: MTB detected MEDIUM, КУМ 2+; устойчивость к рифампицину не обнаружена, расширенная чувствительность не готова.',
        'question': 'Каковы фактический приём, переносимость и документированная динамика на фоне назначений?',
        'tb_question': 'Получены ли результаты посева, расширенной чувствительности и заключение фтизиатра?',
        'next': 'Сопоставить исходные документы с актуальным заключением и сохранить уточнение врача.',
        'outlook': 'Это условный сценарий наблюдения на пять лет; индивидуальная вероятность и исход по этим записям не определены.',
        'scenario': 'Сохранение или изменение симптомов при дальнейшем наблюдении.',
        'condition': 'Сценарий зависит от уточнённого диагноза, фактического лечения и будущих результатов; эти сведения ещё не известны.',
        'monitor': 'Врач сопоставляет жалобы, объективную динамику и новые исследования на последующих визитах.',
        'limit': 'Авторский синтетический пример, не ответ MedGemma и не клиническая рекомендация. Итог требует проверки врачом.',
    },
    'uz': {
        'intro': 'Tasdiqlangan yozuvlarning o‘quv solishtirishi: ',
        'hypertension': 'ma’lum gipertenziyada arterial bosim kundaligi va ko‘rik shifokor yozgan joriy sxemadagi ijobiy dinamikaga mos.',
        'diabetes': 'ma’lum diabetda HbA1c dinamikasi va ko‘tara olish holati shifokorning joriy xulosasiga mos.',
        'hypertension_treatment': 'Shifokor amlodipin 5 mg har kuni deb yozgan; bosim 130/80 mm sim. ust., haqiqiy qabul va shish/bosh aylanishi yo‘qligi tasdiqlangan. Ko‘tara olish haqidagi xulosa shu kuzatuvlarga mos.',
        'diabetes_treatment': 'Shifokor metformin 500 mg kuniga ikki marta ovqat bilan deb yozgan; HbA1c 7.4% dan 6.8% ga o‘zgargan, rSKF 75 ml/min/1.73 m², ko‘tara olish tasdiqlangan. Yozilgan sxema shifokor kuzatuviga mos; bu yangi buyurish emas.',
        'followup_question': 'Oxirgi tasdiqlangan ko‘rikdan so‘ng yangi simptomlar yoki qabulda o‘zgarishlar bo‘ldimi?',
        'allergy': 'allergiya varaqasi va faol buyurishda bir xil modda bor; dolzarbligi va haqiqiy qabulini tekshirish kerak.',
        'side': 'matnli hujjatlarda tomon farq qiladi; texnik DICOM fantomi bu tafovutni aniqlashtira olmaydi.',
        'revision': 'laboratoriya bahosida tuzatilgan birlik ishlatilishi kerak; oldingi yozuv tarixda saqlangan.',
        'late': 'joriy ko‘rik kech kelgan laboratoriya javobini hisobga oladi; dastlabki qarorda u ma’lum bo‘lmagan.',
        'unknown_time': 'joriy qiymat ma’lum, ammo tashqi natija qachon mavjud bo‘lgani aniqlanmagan.',
        'cancelled': 'bekor qilingan buyurishni allergiya bilan taqqoslashda amaldagi buyurish deb hisoblab bo‘lmaydi.',
        'tb_supported': 'bakteriologik natijalar sil haqidagi xulosani qo‘llab-quvvatlaydi; to‘liq dori sezgirligi hali ma’lum emas.',
        'tb_wrong': 'silni inkor etish allaqachon mavjud musbat MTB natijasiga zid; shifokor xulosani qayta ko‘rib chiqishi kerak.',
        'diagnosis_generic': 'Ishchi xulosa hujjatlarni solishtirish zaruratini aks ettiradi; bu yozuvlar simptomlarning yakuniy sababini tasdiqlamaydi.',
        'treatment': 'Reja va buyurish holati xulosada bor; sxema, ko‘tara olish va dinamika bo‘lmasa davolashning to‘liq asoslanganligini baholab bo‘lmaydi.',
        'support': 'Tasdiqlangan ko‘rikda puls {pulse}/min, SpO₂ {spo2}%; klinik holat manba yozuvda berilgan.',
        'tb_support': 'Balg‘am: MTB detected MEDIUM, KUM 2+; rifampitsinga chidamlilik aniqlanmagan, kengaytirilgan sezgirlik hali tayyor emas.',
        'question': 'Buyurilgan vositalarning haqiqiy qabuli, ko‘tara olinishi va qayd etilgan dinamikasi qanday?',
        'tb_question': 'Ekish, kengaytirilgan sezgirlik natijalari va ftiziatr xulosasi olinganmi?',
        'next': 'Birlamchi hujjatlarni joriy xulosa bilan solishtirish va shifokor aniqlashtirishini saqlash.',
        'outlook': 'Bu besh yillik kuzatuvning shartli ssenariysi; ushbu yozuvlar asosida individual ehtimol yoki natija aniqlanmagan.',
        'scenario': 'Keyingi kuzatuvda simptomlarning saqlanishi yoki o‘zgarishi.',
        'condition': 'Ssenariy aniqlashtirilgan tashxis, haqiqiy davolash va kelajak natijalariga bog‘liq; bu ma’lumotlar hali noma’lum.',
        'monitor': 'Shifokor keyingi tashriflarda shikoyatlar, obyektiv dinamika va yangi tekshiruvlarni solishtiradi.',
        'limit': 'Muallif tayyorlagan sintetik misol; MedGemma javobi yoki klinik tavsiya emas. Yakun shifokor tekshiruvini talab qiladi.',
    },
    'en': {
        'intro': 'Educational comparison of confirmed records: ',
        'hypertension': 'in established hypertension, the blood-pressure diary and examination agree with the physician-recorded improvement on the current regimen.',
        'diabetes': 'in established diabetes, the HbA1c trend and documented tolerance agree with the current physician conclusion.',
        'hypertension_treatment': 'The physician recorded amlodipine 5 mg daily; blood pressure is 130/80 mmHg, actual use and absence of oedema or dizziness are documented. The tolerance assessment agrees with these observations.',
        'diabetes_treatment': 'The physician recorded metformin 500 mg twice daily with meals; HbA1c changed from 7.4% to 6.8%, eGFR is 75 mL/min/1.73 m² and tolerance is documented. The recorded regimen agrees with the follow-up observations; this is not a new prescription.',
        'followup_question': 'Have any new symptoms or changes in medication use occurred since the last confirmed visit?',
        'allergy': 'the allergy record and active order name the same substance; current status and actual use need verification.',
        'side': 'the text reports disagree on side; the technical DICOM phantom cannot resolve this discrepancy.',
        'revision': 'the laboratory review must use the corrected unit; the previous record remains in history.',
        'late': 'the current review includes the late laboratory result; it was unavailable at the initial decision.',
        'unknown_time': 'the current value is recorded, but the time when the external result became available is unknown.',
        'cancelled': 'a cancelled order must not be treated as current when reviewing an allergy conflict.',
        'tb_supported': 'bacteriological results support the tuberculosis conclusion; complete drug susceptibility is still unknown.',
        'tb_wrong': 'excluding tuberculosis conflicts with the already available positive MTB result and needs physician review.',
        'diagnosis_generic': 'The working conclusion identifies a need to reconcile documents; these records do not establish the final cause of symptoms.',
        'treatment': 'The plan and order status are recorded, but treatment appropriateness cannot be fully assessed without the regimen, tolerance and follow-up.',
        'support': 'Confirmed examination: pulse {pulse}/min, SpO₂ {spo2}%; the source entry provides the clinical context.',
        'tb_support': 'Sputum: MTB detected MEDIUM, AFB 2+; rifampicin resistance was not detected and extended susceptibility is pending.',
        'question': 'What are the actual medication use, tolerance and documented response to the recorded orders?',
        'tb_question': 'Are culture, extended susceptibility results and the tuberculosis specialist assessment available?',
        'next': 'Reconcile the original records with the current conclusion and record the physician clarification.',
        'outlook': 'This is a conditional five-year monitoring scenario; these records do not establish an individual probability or outcome.',
        'scenario': 'Symptoms may persist or change during further follow-up.',
        'condition': 'The scenario depends on the clarified diagnosis, actual treatment and future findings, which remain unknown.',
        'monitor': 'The physician compares symptoms, objective changes and new investigations at subsequent visits.',
        'limit': 'Authored synthetic example, not a MedGemma response or clinical recommendation. A physician must review the result.',
    },
}
