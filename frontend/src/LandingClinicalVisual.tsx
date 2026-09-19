import { useTranslation } from 'react-i18next'
import { useId, useRef, useState } from 'react'
import { Activity, ArrowUpRight, Layers3, ScanLine, ShieldCheck } from 'lucide-react'
import { useInView, useReducedMotion } from 'motion/react'
import './landingVisual.css'

type View = 'radiology' | 'evidence' | 'risk'


export default function LandingClinicalVisual({ motionEnabled }: { motionEnabled: boolean }) {
  const { t } = useTranslation()
  const views = [
    { id: 'radiology' as const, label: t('landingRadiologyLabel'), icon: ScanLine, eyebrow: t('landingVisualRadiologyEyebrow'), title: t('landingVisualRadiologyTitle'), description: t('landingVisualRadiologyText'), tags: [t('landingImage'), t('landingSlice'), t('landingMeasurement')] },
    { id: 'evidence' as const, label: t('landingEvidence'), icon: Layers3, eyebrow: t('landingVisualEvidenceEyebrow'), title: t('landingVisualEvidenceTitle'), description: t('landingVisualEvidenceText'), tags: [t('landingHistory'), t('landingDocument'), t('landingConfirmation')] },
    { id: 'risk' as const, label: t('landingRisk'), icon: ShieldCheck, eyebrow: t('landingVisualRiskEyebrow'), title: t('landingVisualRiskTitle'), description: t('landingVisualRiskText'), tags: [t('landingAge'), t('landingBloodPressure'), t('landingHistory')] },
  ]

  const [view, setView] = useState<View>('radiology')
  const rootRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(rootRef, { amount: 0.15 })
  const reduceMotion = useReducedMotion()
  const active = views.find((item) => item.id === view)!
  const prefix = useId().replace(/:/g, '')

  return (
    <div ref={rootRef} className="lcv-root" data-view={view} data-animated={motionEnabled && isInView && !reduceMotion}>
      <div className="lcv-instrument">
        <div className="lcv-instrument-header">
          <span className="lcv-instrument-title"><span className="lcv-header-symbol"><Activity size={14} /></span>{t('landingClinicalView')}</span>
          <span className="lcv-sample"><span />{t('landingInteractiveSample')}</span>
        </div>

        <div className="lcv-stage">
          <div className="lcv-grid" aria-hidden="true" />
          <div className="lcv-cross lcv-cross-tl" aria-hidden="true" />
          <div className="lcv-cross lcv-cross-tr" aria-hidden="true" />
          <div className="lcv-cross lcv-cross-bl" aria-hidden="true" />
          <div className="lcv-cross lcv-cross-br" aria-hidden="true" />
          <span className="lcv-stage-id">AT / AI</span>
          <span className="lcv-orientation" aria-hidden="true">{t('landingAnterior')}</span>

          <svg className="lcv-anatomy" viewBox="0 0 520 365" role="img" aria-label={t('landingAnatomyAlt')}>
            <defs>
              <linearGradient id={`${prefix}-lung`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#cbf2d8" stopOpacity=".32" />
                <stop offset=".55" stopColor="#7ec9b5" stopOpacity=".1" />
                <stop offset="1" stopColor="#adddc3" stopOpacity=".23" />
              </linearGradient>
              <linearGradient id={`${prefix}-rib`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#b9d8c9" stopOpacity=".36" />
                <stop offset="1" stopColor="#b9d8c9" stopOpacity=".05" />
              </linearGradient>
              <linearGradient id={`${prefix}-scan`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#d3efad" stopOpacity="0" />
                <stop offset="1" stopColor="#d3efad" stopOpacity=".25" />
              </linearGradient>
              <radialGradient id={`${prefix}-halo`}>
                <stop offset="0" stopColor="#7fae81" stopOpacity=".19" />
                <stop offset="1" stopColor="#7fae81" stopOpacity="0" />
              </radialGradient>
              <clipPath id={`${prefix}-thorax`}><rect x="113" y="43" width="294" height="266" rx="90" /></clipPath>
            </defs>

            <ellipse cx="260" cy="191" rx="179" ry="153" fill={`url(#${prefix}-halo)`} />
            <g className="lcv-orbits" fill="none" stroke="#96bfae">
              <ellipse cx="260" cy="187" rx="190" ry="137" strokeOpacity=".15" />
              <ellipse cx="260" cy="187" rx="169" ry="169" strokeOpacity=".07" strokeDasharray="2 8" />
              <ellipse cx="260" cy="187" rx="211" ry="70" strokeOpacity=".11" transform="rotate(-25 260 187)" />
            </g>
            <g className="lcv-orbit-dot"><circle cx="428" cy="187" r="3" fill="#d4ecac" /><circle cx="428" cy="187" r="8" fill="#d4ecac" opacity=".12" /></g>

            <g className="lcv-thorax" fill="none" stroke={`url(#${prefix}-rib)`} strokeWidth="1.25">
              <path d="M235 33 231 57C213 71 180 69 156 85 133 101 122 126 118 151L124 268Q139 310 196 322M285 33 289 57C307 71 340 69 364 85 387 101 398 126 402 151L396 268Q381 310 324 322" />
              <path d="M253 71Q214 77 173 94M267 71Q306 77 347 94M250 92Q192 100 151 121M270 92Q328 100 369 121M249 116Q179 118 137 148M271 116Q341 118 383 148M248 141Q174 145 134 177M272 141Q346 145 386 177M248 167Q170 175 133 207M272 167Q350 175 387 207M247 194Q171 203 139 235M273 194Q349 203 381 235M246 222Q179 232 150 259M274 222Q341 232 370 259M244 250Q193 260 168 280M276 250Q327 260 352 280" />
              <path d="M260 60V252" strokeOpacity=".36" strokeWidth="7" />
            </g>

            <g className="lcv-lungs" fill={`url(#${prefix}-lung)`} stroke="#a5d8be" strokeWidth="1.35">
              <path d="M234 77C218 63 199 78 181 101 163 125 147 162 143 193 139 224 146 250 160 265 172 277 199 270 224 258 238 251 242 238 241 224L239 160C235 142 238 103 234 77Z" />
              <path d="M286 77C302 63 322 78 340 102 358 126 374 163 378 193 382 224 375 251 361 266 349 278 326 271 306 261 296 256 295 247 299 235 306 216 294 206 283 191L281 159C285 140 282 103 286 77Z" />
              <path d="M152 213Q197 188 238 165M283 159Q327 184 373 190M299 222Q334 218 371 237" fill="none" strokeOpacity=".29" />
            </g>

            <g className="lcv-bronchi" fill="none" stroke="#d7edde" strokeLinecap="round" strokeLinejoin="round">
              <path d="M256 45V119Q256 139 229 151M264 45V119Q264 139 291 151" strokeWidth="3" strokeOpacity=".75" />
              <path d="M229 151 206 132 196 111M219 143 192 146 175 137M226 150 210 175 184 188 164 181M209 177 207 209 182 234M208 205 229 230M194 183 177 214M291 151 314 132 324 111M301 143 328 146 345 137M294 151 310 175 336 188 356 181M311 177 316 204 337 237M321 208 309 233M326 183 343 214" strokeWidth="1.65" strokeOpacity=".6" />
              <path d="M197 114 212 110M184 143 178 156M177 185 162 201M180 232 173 244M324 113 308 108M337 143 343 156M344 184 361 201M338 232 345 245" strokeWidth="1" strokeOpacity=".35" />
            </g>

            <g clipPath={`url(#${prefix}-thorax)`} className="lcv-scan-clip">
              <g className="lcv-scan-plane"><rect x="113" y="93" width="294" height="68" fill={`url(#${prefix}-scan)`} /><path d="M113 161H407" stroke="#dbefb5" strokeWidth="1.6" /><path d="M113 164H407" stroke="#dbefb5" strokeOpacity=".15" strokeWidth="4" /></g>
            </g>

            <g className="lcv-evidence-links" fill="none" stroke="#d4ecac" strokeWidth="1">
              <path d="M199 144 147 115H96M319 191 377 154H427M228 232 172 278H101" strokeOpacity=".65" strokeDasharray="3 5" />
              <circle cx="199" cy="144" r="4" fill="#d4ecac" /><circle cx="319" cy="191" r="4" fill="#d4ecac" /><circle cx="228" cy="232" r="4" fill="#d4ecac" />
              <circle className="lcv-node-pulse" cx="199" cy="144" r="11" strokeOpacity=".45" /><circle className="lcv-node-pulse lcv-node-pulse-two" cx="319" cy="191" r="11" strokeOpacity=".45" />
            </g>
            <g className="lcv-risk-ring" fill="none" stroke="#dbb987"><circle cx="260" cy="185" r="131" strokeOpacity=".32" strokeDasharray="1 9" strokeWidth="3" /><path d="M166 94A131 131 0 0 1 375 122M379 239A131 131 0 0 1 166 276" strokeWidth="2" strokeOpacity=".7" /></g>
          </svg>

          <div className="lcv-source-label lcv-source-one"><span className="lcv-source-dot" />{active.tags[0]}</div>
          <div className="lcv-source-label lcv-source-two"><span className="lcv-source-dot" />{active.tags[1]}</div>
          <div className="lcv-source-label lcv-source-three"><span className="lcv-source-dot" />{active.tags[2]}</div>

          <div className="lcv-bottom-instrument">
            <span>{t('landingAnatomyIllustration')}</span>
            <svg className="lcv-ecg" viewBox="0 0 140 22" aria-hidden="true"><path d="M0 12H25L30 9 35 14 43 12H55L60 3 66 21 72 8 78 12H102L109 9 116 12H140" fill="none" stroke="currentColor" strokeWidth="1.3" /><circle className="lcv-ecg-dot" cx="2" cy="12" r="2.5" fill="currentColor" /></svg>
          </div>
        </div>

        <div className="lcv-view-controls" role="group" aria-label={t('landingSampleView')}>
          {views.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={`lcv-view-button${view === id ? ' lcv-view-button-active' : ''}`} aria-pressed={view === id} onClick={() => setView(id)}><Icon size={16} strokeWidth={1.6} /><span>{label}</span>{view === id && <ArrowUpRight size={13} className="lcv-tab-arrow" />}</button>)}
        </div>
      </div>

      <div className="lcv-caption" aria-live="polite" aria-atomic="true">
        <div className="lcv-caption-heading"><span>{active.eyebrow}</span><span className="lcv-caption-count">0{views.findIndex((item) => item.id === view) + 1}<span> / 03</span></span></div>
        <h3>{active.title}</h3>
        <p>{active.description}</p>
      </div>
      <span className="lcv-disclaimer">{t('landingNotPatientData')}</span>
    </div>
  )
}
