import { useEffect, type PropsWithChildren } from 'react'
import { MotionConfig } from 'motion/react'
import { useInterfacePreferences } from './interfacePreferences'
import './interfacePreferences.css'

export default function InterfacePreferencesProvider({ children }: PropsWithChildren) {
  const { reduceMotion } = useInterfacePreferences()
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion)
  }, [reduceMotion])
  return <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>{children}</MotionConfig>
}
