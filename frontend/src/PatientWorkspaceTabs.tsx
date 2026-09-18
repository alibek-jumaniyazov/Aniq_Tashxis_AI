import type { ReactNode } from 'react'
import { useState } from 'react'
import { Button } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Activity, ClipboardList, Files, History, Microscope, ScanLine, Sparkles, Stethoscope, TrendingUp } from 'lucide-react'
import StableTabs from './StableTabs'
import PatientDataSection, { type ClinicalCategory, type ClinicalEntry } from './PatientDataSection'
import ClinicalComparison from './ClinicalComparison'
import { get } from './api/client'
import type { Case, User } from './types'
import './patientNavigation.css'

export type PatientWorkspaceTab = 'overview' | 'patient-data' | 'conclusion' | 'comparison' | 'outlook'

const categories = [
  { key: 'subjective', icon: ClipboardList, hint: 'pn_subjectiveHint', prefixes: ['symptom', 'history', 'allerg', 'smoking', 'medication', 'risk'] },
  { key: 'objective', icon: Activity, hint: 'pn_objectiveHint', prefixes: ['vital', 'exam', 'physical', 'observation'] },
  { key: 'laboratory', icon: Microscope, hint: 'pn_laboratoryHint', prefixes: ['lab', 'test'] },
  { key: 'instrumental', icon: ScanLine, hint: 'pn_instrumentalHint', prefixes: ['imaging', 'radiology', 'instrumental', 'ecg'] },
] as const

export default function PatientWorkspaceTabs({ c, user, overview, activeTab, onChange, openSource, importDmed, openTools }: {
  c: Case; user: User; overview: ReactNode; activeTab: PatientWorkspaceTab
  onChange: (tab: PatientWorkspaceTab) => void; openSource: (id: string) => void
  importDmed: () => void; openTools: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [category, setCategory] = useState<ClinicalCategory>(user.role === 'radiologist' ? 'instrumental' : 'subjective')
  const entries = useQuery({ queryKey: ['clinical-entries', c.id, c.version], queryFn: ({ signal }) => get<{ items: ClinicalEntry[] }>(`/cases/${c.id}/clinical-entries`, signal) })
  const openImaging = () => navigate(`/cases/${c.id}/imaging`)
  return <div className="patient-workflow">
    <div className="patient-workflow-topline"><span>{t('pn_workflowHint')}</span><Button size="small" type="text" icon={<History size={15}/>} onClick={openTools}>{t('pn_tools')}</Button></div>
    <StableTabs className="patient-primary-tabs" activeKey={activeTab} onChange={key => onChange(key as PatientWorkspaceTab)} items={[
      { key: 'overview', label: t('overview'), children: overview },
      { key: 'patient-data', label: <span><Files size={15}/>{t('pn_patientData')}</span>, children: <>
        <div className="patient-data-categories" role="group" aria-label={t('pn_patientData')}>
          {categories.map(({ key, icon: Icon, hint, prefixes }) => {
            const count = (entries.data?.items.filter(entry => entry.category === key).length || 0) + c.facts.filter(fact => prefixes.some(prefix => fact.key.startsWith(prefix))).length + (key === 'instrumental' ? c.studies.length : 0)
            return <button type="button" key={key} className={category === key ? 'selected' : ''} aria-pressed={category === key} onClick={() => setCategory(key)}><span className="patient-category-top"><Icon size={20}/><small>{count}</small></span><strong>{t(`pw_${key}`)}</strong><span>{t(hint)}</span></button>
          })}
        </div>
        <PatientDataSection key={category} c={c} user={user} category={category} openSource={openSource} openImaging={openImaging} importDmed={importDmed}/>
        <div className="patient-next-step"><span>{t('pn_nextConclusionHint')}</span><Button onClick={() => onChange('conclusion')}>{t('pn_conclusionAction')} →</Button></div>
      </> },
      { key: 'conclusion', label: <span><Stethoscope size={15}/>{t('pw_doctor_conclusion')}</span>, children: <><PatientDataSection c={c} user={user} category="doctor_conclusion" openSource={openSource} importDmed={importDmed}/><div className="patient-next-step"><span>{t('pn_nextComparisonHint')}</span><Button type="primary" onClick={() => onChange('comparison')}>{t('pn_compareAction')} →</Button></div></> },
      { key: 'comparison', label: <span><Sparkles size={15}/>{t('pw_comparison')}</span>, children: <ClinicalComparison c={c} user={user} openSource={openSource} openConclusion={() => onChange('conclusion')}/> },
      { key: 'outlook', label: <span><TrendingUp size={15}/>{t('pw_forecast')}</span>, children: <ClinicalComparison c={c} user={user} openSource={openSource} view="forecast" openConclusion={() => onChange('conclusion')}/> },
    ]}/>
  </div>
}
