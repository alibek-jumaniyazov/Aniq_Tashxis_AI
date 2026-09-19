import { Alert, Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import { analysisLanguage, analysisOriginKey, syntheticAnalysis, type AnalysisLanguageRun } from './analysisLocale'

export default function AnalysisProvenance({ run, mismatch = false }: { run?: AnalysisLanguageRun; mismatch?: boolean }) {
  const { t } = useTranslation()
  if (!run) return null
  const language = analysisLanguage(run).toUpperCase()
  return <div className="analysis-provenance">
    <div><Tag>{t('aiOutputLanguage')}: {language}</Tag><Tag color={syntheticAnalysis(run) ? 'gold' : 'cyan'}>{t(analysisOriginKey(run))}</Tag></div>
    {syntheticAnalysis(run) && <Alert showIcon type="info" message={t('aiSyntheticResultHint')}/>}
    {mismatch && <Alert showIcon type="warning" message={t('aiLanguageMismatch')} description={t('aiLanguageMismatchHint', { language })}/>}
  </div>
}
