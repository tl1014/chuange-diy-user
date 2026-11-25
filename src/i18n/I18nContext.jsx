import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createTranslator } from './translations'

const STORAGE_KEY = 'chuange_diy_lang'

function detectInitialLang() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved === 'zh-CN' || saved === 'en') return saved
    } catch {
        // 忽略存储限制
    }
    const navLang = (navigator.language || '').toLowerCase()
    return navLang.startsWith('zh') ? 'zh-CN' : 'en'
}

const I18nContext = createContext({
    lang: 'zh-CN',
    setLang: () => {},
    toggleLang: () => {},
    t: key => key
})

export function I18nProvider({ children }) {
    const [lang, setLangState] = useState(() => detectInitialLang())

    const setLang = useCallback(nextLang => {
        const normalized = nextLang === 'en' ? 'en' : 'zh-CN'
        setLangState(normalized)
        try {
            localStorage.setItem(STORAGE_KEY, normalized)
        } catch {
            // 忽略存储限制
        }
    }, [])

    const toggleLang = useCallback(() => {
        setLang(lang === 'zh-CN' ? 'en' : 'zh-CN')
    }, [lang, setLang])

    useEffect(() => {
        document.documentElement.lang = lang
        document.title = lang === 'en' ? 'CHUANGE XIXI - DIY Bracelet' : '串个喜喜 - DIY 手串'
    }, [lang])

    const t = useMemo(() => createTranslator(lang), [lang])

    const value = useMemo(
        () => ({ lang, setLang, toggleLang, t }),
        [lang, setLang, toggleLang, t]
    )

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
    return useContext(I18nContext)
}