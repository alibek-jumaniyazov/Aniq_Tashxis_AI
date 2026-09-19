// @vitest-environment jsdom
import { useEffect } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Form, Input } from 'antd'
import type { FormInstance } from 'antd'
import { useTranslation } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from './i18n'
import LocaleProvider from './LocaleProvider'
import LocalizedForm from './LocalizedForm'

type Values = { email: string; name: string; custom: string; memo: string; untouched: string }

function Example({
  ready,
  changed,
}: {
  ready: (form: FormInstance<Values>) => void
  changed: () => void
}) {
  const [form] = Form.useForm<Values>()
  const { t } = useTranslation()
  useEffect(() => {
    ready(form)
  }, [form, ready])
  return (
    <LocaleProvider>
      <LocalizedForm form={form} onValuesChange={changed}>
        <Form.Item name="email" label={t('email')} rules={[{ type: 'email' }]}>
          <Input aria-label="email-input" />
        </Form.Item>
        <Form.Item name="name" rules={[{ min: 2, message: t('commerceNameLength') }]}>
          <Input aria-label="name-input" />
        </Form.Item>
        <Form.Item
          name="custom"
          rules={[
            {
              validator: (_, value) =>
                value === 'ok' ? Promise.resolve() : Promise.reject(new Error(t('riskConfirm'))),
            },
          ]}
        >
          <Input aria-label="custom-input" />
        </Form.Item>
        <Form.Item name="memo">
          <Input aria-label="memo-input" />
        </Form.Item>
        <Form.Item name="untouched" rules={[{ required: true }]}>
          <Input aria-label="untouched-input" />
        </Form.Item>
      </LocalizedForm>
    </LocaleProvider>
  )
}

beforeEach(async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((media: string) => ({
      matches: false,
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
  await i18n.changeLanguage('ru')
})

afterEach(async () => {
  cleanup()
  vi.unstubAllGlobals()
  await i18n.changeLanguage('ru')
})

describe('validation messages follow the selected language', () => {
  it('refreshes existing default, explicit and custom errors without submitting or changing entered values', async () => {
    let form: FormInstance<Values> | undefined
    const changed = vi.fn()
    render(
      <Example
        ready={(value) => {
          form = value
        }}
        changed={changed}
      />,
    )
    fireEvent.change(screen.getByLabelText('email-input'), { target: { value: 'not-an-email' } })
    fireEvent.change(screen.getByLabelText('name-input'), { target: { value: 'x' } })
    fireEvent.change(screen.getByLabelText('custom-input'), { target: { value: 'needs-review' } })
    fireEvent.change(screen.getByLabelText('memo-input'), {
      target: { value: 'Keep this original clinical note.' },
    })
    await screen.findByText('Введите корректный адрес электронной почты')
    await screen.findByText(i18n.t('commerceNameLength'))
    await screen.findByText(i18n.t('riskConfirm'))
    const values = form!.getFieldsValue()
    const fieldNames = Object.keys(values) as (keyof Values)[]
    const touched = fieldNames.map((name) => form!.isFieldTouched(name))
    changed.mockClear()

    await act(async () => {
      await i18n.changeLanguage('en')
    })

    await screen.findByText('Enter a valid email address')
    await screen.findByText(i18n.t('commerceNameLength'))
    await screen.findByText(i18n.t('riskConfirm'))
    await waitFor(() =>
      expect(screen.queryByText('Введите корректный адрес электронной почты')).toBeNull(),
    )
    expect(form!.getFieldsValue()).toEqual(values)
    expect(fieldNames.map((name) => form!.isFieldTouched(name))).toEqual(touched)
    expect(form!.getFieldError('untouched')).toEqual([])
    expect(changed).not.toHaveBeenCalled()
    expect((screen.getByLabelText('memo-input') as HTMLInputElement).value).toBe(
      'Keep this original clinical note.',
    )
  })

  it('does not expose new errors on untouched forms when changing language', async () => {
    let form: FormInstance<Values> | undefined
    const changed = vi.fn()
    render(
      <Example
        ready={(value) => {
          form = value
        }}
        changed={changed}
      />,
    )
    expect(form!.getFieldsError().every((field) => field.errors.length === 0)).toBe(true)
    await act(async () => {
      await i18n.changeLanguage('uz')
    })
    expect(form!.getFieldsError().every((field) => field.errors.length === 0)).toBe(true)
    expect(form!.isFieldsTouched()).toBe(false)
    expect(changed).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
