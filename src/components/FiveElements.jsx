import { useEffect, useMemo, useState } from 'react'
import request from '../utils/request'
import {
    ELEMENTS,
    buildRecommendationPayload,
    calculateFiveElements,
    getBranchElementKey,
    getStemElementKey,
    getTargetElements
} from '../utils/fiveElementsCalc'
import { useI18n } from '../i18n/I18nContext'
import '../styles/five-elements.css'

function formatLocalDateStr() {
    const now = new Date()
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10)
}

export default function FiveElements({
                                         onUseProduct,
                                         onRecommendationReady,
                                         onShowRecommendations
                                     }) {
    const { lang, t } = useI18n()
    const [form, setForm] = useState({
        date: '',
        time: '12:00',
        timeUnknown: false,
        city: '',
        gender: 'Prefer not to say'
    })
    const [result, setResult] = useState(null)
    const [products, setProducts] = useState([])
    const [error, setError] = useState('')
    const [calculating, setCalculating] = useState(false)
    const [todayStr] = useState(() => formatLocalDateStr())

    useEffect(() => {
        let active = true
        request
            .get('/api/products')
            .then(res => {
                if (!active) return
                setProducts(Array.isArray(res.data) ? res.data : [])
            })
            .catch(() => {
                // 商品接口不可用时仍可正常排盘
            })
        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        if (!result) return
        const payload = buildRecommendationPayload(result, products)
        if (payload) onRecommendationReady(payload)
    }, [result, products, onRecommendationReady])

    const getElementLabel = key => t(`elements.${key}`)

    const dayMasterElement = result ? getStemElementKey(result.dayMaster) : null
    const dayMasterName = dayMasterElement ? getElementLabel(dayMasterElement) : ''

    const chartBars = useMemo(() => {
        if (!result) return []
        return ELEMENTS.map(el => {
            const score = result.scores[el.key] || 0
            const percent = result.total ? (score / result.total) * 100 : 0
            return { ...el, score, percent }
        })
    }, [result])

    const targetElements = useMemo(() => getTargetElements(result), [result])

    const recommendations = useMemo(() => {
        const keys = targetElements.map(el => el.key)
        return products.filter(p => keys.includes(p.elementType)).slice(0, 12)
    }, [products, targetElements])

    function handleCalculate() {
        setError('')
        setResult(null)
        setCalculating(true)
        try {
            const nextResult = calculateFiveElements(form, t)
            setResult(nextResult)
        } catch (e) {
            setError(e?.message || t('five.errors.invalidBirthDate'))
        } finally {
            setCalculating(false)
        }
    }

    const sortedHighest = [...chartBars].sort((a, b) => b.score - a.score)[0]
    const sortedLowest = [...chartBars].sort((a, b) => a.score - b.score)[0]

    const missingLabels = (result?.missingKeys || [])
        .map(key => getElementLabel(key))
        .join(lang === 'en' ? ', ' : '、')

    const targetLabels = targetElements
        .map(el => getElementLabel(el.key))
        .join(lang === 'en' ? ', ' : '、')

    return (
        <div className="five-page">
            <section className="five-intro">
                <span className="eyebrow">{t('five.eyebrow')}</span>
                <h1>{t('five.heroTitle')}</h1>
                <p>{t('five.heroSubtitle')}</p>
                <div className="five-symbols">
                    {ELEMENTS.map(el => (
                        <span key={el.key} style={{ '--el-color': el.color }}>
              {getElementLabel(el.key)}
            </span>
                    ))}
                </div>
            </section>

            <section className="five-form-card">
                <div className="section-heading">
                    <div>
                        <span>{t('five.step1Eyebrow')}</span>
                        <h2>{t('five.step1Title')}</h2>
                    </div>
                    <small>{t('five.step1Hint')}</small>
                </div>

                <div className="birth-grid">
                    <label>
                        {t('five.labelBirthDate')}
                        <input
                            type="date"
                            value={form.date}
                            max={todayStr}
                            onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                        />
                    </label>

                    <label>
                        {t('five.labelBirthTime')}
                        <input
                            type="time"
                            value={form.time}
                            disabled={form.timeUnknown}
                            onChange={e => setForm(prev => ({ ...prev, time: e.target.value }))}
                        />
                    </label>

                    <label>
                        {t('five.labelBirthPlace')}
                        <input
                            value={form.city}
                            placeholder={t('five.placeholderBirthPlace')}
                            onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))}
                        />
                    </label>

                    <label>
                        {t('five.labelGender')}
                        <select
                            value={form.gender}
                            onChange={e => setForm(prev => ({ ...prev, gender: e.target.value }))}
                        >
                            <option value="Prefer not to say">{t('five.genderPreferNot')}</option>
                            <option value="Male">{t('five.genderMale')}</option>
                            <option value="Female">{t('five.genderFemale')}</option>
                        </select>
                    </label>
                </div>

                <label className="unknown-time">
                    <input
                        type="checkbox"
                        checked={form.timeUnknown}
                        onChange={e => setForm(prev => ({ ...prev, timeUnknown: e.target.checked }))}
                    />
                    {t('five.labelUnknownTime')}
                </label>

                <p className="privacy-note">{t('five.privacyNote')}</p>

                <button
                    type="button"
                    className="calculate-button"
                    disabled={calculating}
                    onClick={handleCalculate}
                >
                    {calculating ? t('five.btnCalculating') : t('five.btnCalculate')}
                </button>

                {error && <p className="form-error">{error}</p>}
            </section>

            {result ? (
                <>
                    <section className="result-card">
                        <div className="section-heading">
                            <div>
                                <span>{t('five.step2Eyebrow')}</span>
                                <h2>{t('five.step2Title')}</h2>
                            </div>
                            <small>{result.solarText}</small>
                        </div>

                        <div className={`pillars${result.pillarCount === 3 ? ' three-pillars' : ''}`}>
                            {result.pillars.map(p => {
                                const branchElKey = getBranchElementKey(p.branch)
                                return (
                                    <div key={p.pillarKey}>
                                        <small>{t(`five.pillarLabels.${p.pillarKey}`)}</small>
                                        <b>{p.value}</b>
                                        <span>
                      {t('five.hiddenStemsPrefix')}
                                            {p.hidden || '—'}
                    </span>
                                        <em>
                                            {p.stemElement ? getElementLabel(p.stemElement) : ''} ·{' '}
                                            {branchElKey ? getElementLabel(branchElKey) : ''}
                                        </em>
                                    </div>
                                )
                            })}
                        </div>

                        <p className="day-master">
                            {t('five.gregorianBirthLabel')}
                            {result.solarText}
                            <br />
                            {t('five.dayMasterLabel')}
                            <b>{result.dayMaster}</b> ({dayMasterName}) ·{' '}
                            {form.city || t('five.birthPlaceFallback')}
                        </p>

                        {result.timeUnknown && <p className="method-note">{t('five.threePillarsNote')}</p>}
                    </section>

                    <section className="result-card">
                        <div className="section-heading">
                            <div>
                                <span>{t('five.step3Eyebrow')}</span>
                                <h2>{t('five.step3Title')}</h2>
                            </div>
                            <small>{t('five.step3Sub')}</small>
                        </div>

                        <div className="element-chart">
                            {chartBars.map(item => (
                                <div key={item.key} className="element-line">
                                    <div className="element-label">
                                        <b style={{ color: item.color }}>{getElementLabel(item.key)}</b>
                                        <strong>{item.score.toFixed(1)}</strong>
                                    </div>
                                    <div className="element-track">
                                        <i style={{ width: `${item.percent}%`, background: item.color }} />
                                    </div>
                                    <small>{item.percent.toFixed(0)}%</small>
                                </div>
                            ))}
                        </div>

                        <div className="missing-note">
                            <b>{t('five.elementCountLabel')}</b>
                            <span>
                {result.missingKeys?.length
                    ? t('five.missingElementsText', { list: missingLabels })
                    : t('five.allElementsPresentText')}
              </span>
                        </div>

                        <div className="balance-summary">
                            <span>{t('five.highestShareLabel')}</span>
                            <b>{sortedHighest ? getElementLabel(sortedHighest.key) : '—'}</b>
                            <span>{t('five.lowestShareLabel')}</span>
                            <b>{sortedLowest ? getElementLabel(sortedLowest.key) : '—'}</b>
                        </div>

                        <p className="method-note">{t('five.methodNote')}</p>
                    </section>

                    <section className="result-card recommendation-card">
                        <div className="section-heading">
                            <div>
                                <span>{t('five.step4Eyebrow')}</span>
                                <h2>{t('five.step4Title')}</h2>
                            </div>
                            <small>{t('five.step4Sub')}</small>
                        </div>

                        <p className="recommend-lead">
                            {result.missingKeys?.length
                                ? t('five.recommendMissingLead', { list: missingLabels })
                                : t('five.recommendBalancedLead')}
                        </p>

                        <p className="recommend-lead">
                            {t('five.recommendTargetLead', { list: targetLabels, count: targetElements.length })}
                        </p>

                        <button
                            type="button"
                            className="show-matched-products"
                            onClick={onShowRecommendations}
                        >
                            {t('five.btnViewMatchedInDiy')}
                        </button>

                        <div className="element-tags">
                            {targetElements.map(el => (
                                <span key={el.key} style={{ borderColor: el.color, color: el.color }}>
                  {getElementLabel(el.key)} · {lang === 'en' ? el.enHint : el.zhHint}
                </span>
                            ))}
                        </div>

                        {recommendations.length ? (
                            <div className="recommend-products">
                                {recommendations.map(product => {
                                    const displayName =
                                        lang === 'en' && product.nameEn ? product.nameEn : product.name
                                    const elLabel = product.elementType
                                        ? getElementLabel(product.elementType)
                                        : ''
                                    return (
                                        <article key={product.id} className="recommend-product">
                                            {product.imageUrl ? (
                                                <img src={product.imageUrl} alt={displayName} />
                                            ) : (
                                                <div className="recommend-placeholder">{elLabel || '•'}</div>
                                            )}
                                            <b>{displayName}</b>
                                            <small>
                                                {t('catalog.elementBadge', { el: elLabel })} · {product.diameterMm}mm
                                            </small>
                                            <strong>¥{Number(product.price || 0).toFixed(2)}</strong>
                                            <button type="button" onClick={() => onUseProduct(product)}>
                                                {t('five.btnUseInDiy')}
                                            </button>
                                        </article>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="no-products">{t('five.noMatchedProductsNote')}</div>
                        )}
                    </section>
                </>
            ) : (
                <section className="five-guide">
                    <b>{t('five.guideTitle')}</b>
                    <p>{t('five.guideBody')}</p>
                </section>
            )}
        </div>
    )
}