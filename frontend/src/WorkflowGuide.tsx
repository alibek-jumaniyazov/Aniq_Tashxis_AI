import { useTranslation } from 'react-i18next'
import { BookOpen, ChevronDown, CircleHelp } from 'lucide-react'
import { guideContent, type GuideTopic } from './guideContent'
import './workflowGuide.css'

export default function WorkflowGuide({ topic }: { topic: GuideTopic }) {
  const { i18n } = useTranslation()
  const language = i18n.language.startsWith('uz')
    ? 'uz'
    : i18n.language.startsWith('en')
      ? 'en'
      : 'ru'
  const content = guideContent[topic][language]
  const subtitle = {
    uz: 'Qanday to‘ldirish, nima uchun kerak va keyingi qadam',
    ru: 'Как заполнить, зачем это нужно и что делать дальше',
    en: 'How to fill it in, why it matters and what to do next',
  }[language]
  return (
    <details className="workflow-guide">
      <summary>
        <span className="workflow-guide__icon">
          <BookOpen size={18} />
        </span>
        <span>
          <strong>{content.title}</strong>
          <small>{subtitle}</small>
        </span>
        <ChevronDown size={17} />
      </summary>
      <div className="workflow-guide__body">
        <p>{content.intro}</p>
        <ol className="workflow-guide__steps">
          {content.steps.map((step, index) => (
            <li key={index}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
        <div className="workflow-guide__faq">
          {content.faq.map(([question, answer], index) => (
            <details key={index}>
              <summary>
                <CircleHelp size={16} />
                {question}
                <ChevronDown size={15} />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </details>
  )
}
