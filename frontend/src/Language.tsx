import { Select } from 'antd'
import { useTranslation } from 'react-i18next'

export function Language() {
  const { t, i18n } = useTranslation()
  return <Select aria-label={t('interfaceLanguage')} className="language" size="small" variant="borderless" value={i18n.resolvedLanguage || 'ru'} popupMatchSelectWidth={150} options={[
    { value: 'ru', label: 'RU', title: 'Русский', searchLabel: 'Русский' },
    { value: 'uz', label: 'UZ', title: 'O‘zbekcha', searchLabel: 'O‘zbekcha' },
    { value: 'en', label: 'EN', title: 'English', searchLabel: 'English' },
  ]} optionRender={option => <span lang={option.value as string}>{option.data.searchLabel}</span>} onChange={value => { void i18n.changeLanguage(value) }}/>
}
