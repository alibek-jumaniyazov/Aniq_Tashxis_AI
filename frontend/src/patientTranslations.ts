export const patientRu = {
  patientFullName: 'ФИО пациента',
  patientPhone: 'Номер телефона пациента',
  field_full_name: 'ФИО пациента',
  field_patient_phone: 'Номер телефона пациента',
  field_summary: 'Комментарии врача',
  doctorComments: 'Комментарии врача',
  patientCode: 'Код пациента',
  patientNameRequired: 'Укажите ФИО пациента.',
  patientNamePlaceholder: 'Фамилия, имя, отчество',
  patientPhonePlaceholder: '+998 90 123 45 67',
  patientPhoneHelp: 'Необязательно. Укажите номер с кодом страны, если он известен.',
  newPatientIntro:
    'Обязательно только ФИО. Остальные поля можно оставить пустыми. Код пациента программа создаст автоматически.',
  patientAgeHelp: 'Полных лет, от 0 до 120. Если возраст неизвестен, оставьте поле пустым.',
  patientAgeUnknown: 'Возраст не указан',
  patientAgeForClinicalAI:
    'Для диагностического разбора укажите возраст пациента от 18 лет. Текущий клинический контур рассчитан на взрослых.',
  patientCommentsPlaceholder: 'Наблюдения и комментарии врача (необязательно)',
  patientSearchPlaceholder: 'ФИО, код или телефон пациента',
  patientCodeAutoHelp: 'Присвоен автоматически и не изменяется при редактировании.',
  patientLegacyNameHelp:
    'В этой ранее созданной записи ФИО не указано. Добавьте его, если оно известно.',
  editPatient: 'Редактировать пациента',
}

export const patientUz: typeof patientRu = {
  patientFullName: 'Bemorning F.I.Sh.',
  patientPhone: 'Bemorning telefon raqami',
  field_full_name: 'Bemorning F.I.Sh.',
  field_patient_phone: 'Bemorning telefon raqami',
  field_summary: 'Shifokor izohlari',
  doctorComments: 'Shifokor izohlari',
  patientCode: 'Bemor kodi',
  patientNameRequired: 'Bemorning F.I.Sh. ni kiriting.',
  patientNamePlaceholder: 'Familiyasi, ismi, otasining ismi',
  patientPhonePlaceholder: '+998 90 123 45 67',
  patientPhoneHelp: 'Ixtiyoriy. Ma’lum bo‘lsa, raqamni davlat kodi bilan kiriting.',
  newPatientIntro:
    'Faqat F.I.Sh. majburiy. Qolgan maydonlarni bo‘sh qoldirish mumkin. Bemor kodini dastur avtomatik yaratadi.',
  patientAgeHelp: 'To‘liq yoshi, 0 dan 120 gacha. Yosh noma’lum bo‘lsa, maydonni bo‘sh qoldiring.',
  patientAgeUnknown: 'Yosh ko‘rsatilmagan',
  patientAgeForClinicalAI:
    'Diagnostik tahlil uchun bemorning 18 yosh yoki undan kattaligini kiriting. Joriy klinik tahlil kattalar uchun mo‘ljallangan.',
  patientCommentsPlaceholder: 'Shifokor kuzatuvlari va izohlari (ixtiyoriy)',
  patientSearchPlaceholder: 'Bemorning F.I.Sh., kodi yoki telefoni',
  patientCodeAutoHelp: 'Avtomatik berilgan va tahrirlashda o‘zgarmaydi.',
  patientLegacyNameHelp:
    'Avval yaratilgan bu yozuvda F.I.Sh. ko‘rsatilmagan. Ma’lum bo‘lsa, qo‘shing.',
  editPatient: 'Bemor ma’lumotlarini tahrirlash',
}

export const patientEn: typeof patientRu = {
  patientFullName: 'Patient full name',
  patientPhone: 'Patient phone number',
  field_full_name: 'Patient full name',
  field_patient_phone: 'Patient phone number',
  field_summary: 'Doctor comments',
  doctorComments: 'Doctor comments',
  patientCode: 'Patient code',
  patientNameRequired: 'Enter the patient’s full name.',
  patientNamePlaceholder: 'Last name, first name, patronymic (if applicable)',
  patientPhonePlaceholder: '+998 90 123 45 67',
  patientPhoneHelp: 'Optional. Include the country code if the number is known.',
  newPatientIntro:
    'Only the full name is required. Leave any other fields empty if needed. The application generates the patient code automatically.',
  patientAgeHelp: 'Completed years, from 0 to 120. Leave empty if the age is unknown.',
  patientAgeUnknown: 'Age not provided',
  patientAgeForClinicalAI:
    'Enter a patient age of 18 or older for diagnostic review. The current clinical scope covers adults.',
  patientCommentsPlaceholder: 'Doctor’s observations and comments (optional)',
  patientSearchPlaceholder: 'Patient name, code or phone',
  patientCodeAutoHelp: 'Assigned automatically and remains unchanged when you edit this record.',
  patientLegacyNameHelp: 'This older record has no full name. Add it if known.',
  editPatient: 'Edit patient',
}
