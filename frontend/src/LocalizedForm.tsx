import { useEffect, useRef, type PropsWithChildren } from 'react'
import { Form } from 'antd'
import type { FormProps } from 'antd'
import { useTranslation } from 'react-i18next'

function LocalizedValidation() {
  const form = Form.useFormInstance()
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage || i18n.language
  const previousLanguage = useRef(language)

  useEffect(() => {
    if (previousLanguage.current === language) return
    previousLanguage.current = language
    // React has committed the translated labels, rules and ConfigProvider messages.
    // Revalidate only errors the user has already seen; do not reveal untouched fields.
    const names = form
      .getFieldsError()
      .filter((field) => field.errors.length > 0)
      .map((field) => field.name)
    if (names.length)
      void form.validateFields(names).catch(() => {
        // Invalid fields are expected. Ant Design owns and displays their updated errors.
      })
  }, [form, language])

  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Preserve Ant Design's default form value type while allowing typed form instances.
export default function LocalizedForm<Values = any>({
  children,
  ...props
}: PropsWithChildren<Omit<FormProps<Values>, 'children'>>) {
  return (
    <Form<Values> {...props}>
      <LocalizedValidation />
      {children}
    </Form>
  )
}
