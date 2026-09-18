import { useRef, type MouseEvent } from 'react'
import { Tabs, type TabsProps } from 'antd'
import { useTranslation } from 'react-i18next'

function tabTarget(event: MouseEvent<HTMLDivElement>) {
  const tab = event.target instanceof Element ? event.target.closest<HTMLElement>('.ant-tabs-tab-btn[role="tab"]') : null
  return tab?.closest('.ant-tabs') === event.currentTarget && tab.getAttribute('aria-disabled') !== 'true' ? tab : null
}

/** Let an overflow tab receive its click before rc-tabs scrolls the focused tab. */
export default function StableTabs({ onMouseDownCapture, onClickCapture, ...props }: TabsProps) {
  const { t } = useTranslation()
  const pressedTab = useRef<HTMLElement | null>(null)
  return <Tabs {...props} locale={{ dropdownAriaLabel: t('tabsOverflow'), ...props.locale }} more={{ trigger: 'click', ...props.more }}
    onMouseDownCapture={event => {
      onMouseDownCapture?.(event)
      const tab = event.button === 0 && !event.defaultPrevented ? tabTarget(event) : null
      pressedTab.current = tab
      // Focusing on mousedown otherwise moves the strip before mouseup, swallowing the click.
      if (tab) event.preventDefault()
    }}
    onClickCapture={event => {
      onClickCapture?.(event)
      const tab = tabTarget(event)
      if (tab && pressedTab.current === tab) requestAnimationFrame(() => {
        if (tab.isConnected) tab.focus({ preventScroll: true })
      })
      pressedTab.current = null
    }}
  />
}
