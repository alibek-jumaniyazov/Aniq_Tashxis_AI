import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as AntApp, ConfigProvider } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import './i18n'
import './styles.css'
import './readability.css'
import App from './App'

export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5000, refetchOnWindowFocus: false }, mutations: { retry: false } } })
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><ConfigProvider theme={{ token: { colorPrimary: '#087f83', colorInfo: '#087f83', colorText: '#152936', colorTextSecondary: '#6c808a', fontFamily: 'Manrope, sans-serif', borderRadius: 10, controlHeight: 42, colorBorder: '#dce6e8', fontSize: 13 }, components: { Button: { primaryShadow: '0 4px 12px #087f831c' }, Table: { headerBg: '#f8fafb', cellPaddingBlock: 18 }, Tabs: { horizontalItemGutter: 28 }, Modal: { borderRadiusLG: 20 } } }}><AntApp><MotionConfig reducedMotion="user"><BrowserRouter><App/></BrowserRouter></MotionConfig></AntApp></ConfigProvider></QueryClientProvider></React.StrictMode>)
