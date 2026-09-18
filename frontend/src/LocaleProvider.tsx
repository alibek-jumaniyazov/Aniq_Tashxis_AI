import { useEffect, type PropsWithChildren } from 'react'
import { ConfigProvider, type ConfigProviderProps } from 'antd'
import ru from 'antd/locale/ru_RU'
import uz from 'antd/locale/uz_UZ'
import en from 'antd/locale/en_US'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import 'dayjs/locale/uz-latn'
import 'dayjs/locale/en'
import { useInterfacePreferences } from './interfacePreferences'

export default function LocaleProvider({ children, ...props }: PropsWithChildren<ConfigProviderProps>) {
  const { t, i18n } = useTranslation()
  const { reduceMotion } = useInterfacePreferences()
  const language = i18n.resolvedLanguage || 'ru'
  const locale = { ru, uz, en }[language] || ru
  useEffect(() => { dayjs.locale(language === 'uz' ? 'uz-latn' : language) }, [language])
  return <ConfigProvider {...props} theme={{ ...props.theme, token: { ...props.theme?.token, motion: reduceMotion ? false : (props.theme?.token?.motion ?? true) } }} locale={{ ...locale, global: { ...locale.global, placeholder: t('selectPlaceholder'), close: t('closeWindow') }, Table: { ...locale.Table, expand: t('expandRow'), collapse: t('collapseRow') } }} form={{ validateMessages: {
    default: t('formInvalid'), required: t('formRequired'), whitespace: t('formWhitespace'), enum: t('formEnum'),
    types: { email: t('formEmail'), number: t('formNumber'), integer: t('formInteger'), float: t('formNumber'), string: t('formInvalid'), boolean: t('formInvalid'), array: t('formInvalid'), object: t('formInvalid'), date: t('formDate'), url: t('formInvalid'), regexp: t('formInvalid'), hex: t('formInvalid'), method: t('formInvalid') },
    string: { min: t('formMinLength'), max: t('formMaxLength'), len: t('formLength'), range: t('formRangeLength') },
    number: { min: t('formMin'), max: t('formMax'), range: t('formRange'), len: t('formEqual') },
    date: { format: t('formDate'), parse: t('formDate'), invalid: t('formDate') }, pattern: { mismatch: t('formPattern') },
  } }}>{children}</ConfigProvider>
}
