import { useMemo, useRef, useState } from 'react'
import { productSizeLabel } from '../utils/braceletGeometry'
import { useI18n } from '../i18n/I18nContext'

const CATALOG_PAGE_SIZE = 8

export default function ProductCatalog({
                                           categories,
                                           products,
                                           loading,
                                           categoryId,
                                           activeMainCategory,
                                           keyword,
                                           fiveRecommendation,
                                           onSelectMainCategory,
                                           onSelectSubCategory,
                                           onSelectAllSubCategories,
                                           onKeywordChange,
                                           onClearFiveRecommendation,
                                           onAddProduct,
                                           onProductImageLoad
                                       }) {
    const { lang, t } = useI18n()
    const [pageState, setPageState] = useState({ filterKey: '', page: 1 })
    const [failedImages, setFailedImages] = useState({})
    const resultsRef = useRef(null)

    const filterKey = `${categoryId ?? 'all'}|${keyword}|${
        (fiveRecommendation?.targetKeys || []).join(',')
    }`
    const catalogPage = pageState.filterKey === filterKey ? pageState.page : 1

    const visibleProducts = useMemo(() => {
        const keys = fiveRecommendation?.targetKeys || []
        if (!keys.length) return products
        return products.filter(p => keys.includes(p.elementType))
    }, [products, fiveRecommendation])

    const totalPages = Math.max(1, Math.ceil(visibleProducts.length / CATALOG_PAGE_SIZE))
    const safePage = Math.min(catalogPage, totalPages)

    const pagedProducts = useMemo(() => {
        const start = (safePage - 1) * CATALOG_PAGE_SIZE
        return visibleProducts.slice(start, start + CATALOG_PAGE_SIZE)
    }, [visibleProducts, safePage])

    const mainCategories = useMemo(
        () =>
            categories
                .filter(item => item.code !== 'ALL' && item.parentId == null)
                .sort(
                    (a, b) =>
                        Number(a.sortNo || 0) - Number(b.sortNo || 0) ||
                        Number(a.id) - Number(b.id)
                ),
        [categories]
    )

    const subCategories = useMemo(() => {
        if (!activeMainCategory) return []
        return categories
            .filter(item => item.code !== 'ALL' && item.parentId === activeMainCategory)
            .sort(
                (a, b) =>
                    Number(a.sortNo || 0) - Number(b.sortNo || 0) ||
                    Number(a.id) - Number(b.id)
            )
    }, [categories, activeMainCategory])

    function changePage(next) {
        const target = Math.min(totalPages, Math.max(1, Number(next) || 1))
        if (target === safePage) return
        setPageState({ filterKey, page: target })
        resultsRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const recommendedElementLabels = (fiveRecommendation?.targetKeys || [])
        .map(key => t(`elements.${key}`))
        .join(lang === 'en' ? ', ' : '、')

    return (
        <section className="catalog">
            <div className="catalog-head">
                <div>
                    <h2>{t('catalog.title')}</h2>
                    {fiveRecommendation ? (
                        <p>{t('catalog.filteredHint', { elements: recommendedElementLabels })}</p>
                    ) : (
                        <p>{t('catalog.defaultHint')}</p>
                    )}
                </div>

                <div className="catalog-count">
                    <span>{t('catalog.count', { count: visibleProducts.length })}</span>
                    {fiveRecommendation && (
                        <button
                            type="button"
                            className="clear-element-filter"
                            onClick={onClearFiveRecommendation}
                        >
                            {t('catalog.btnShowAll')}
                        </button>
                    )}
                </div>
            </div>

            <div className="category-browser">
                <nav className="main-category-nav" aria-label={t('catalog.mainCatAria')}>
                    <button
                        type="button"
                        className={!activeMainCategory ? 'active' : ''}
                        onClick={() => onSelectMainCategory(null)}
                    >
                        {t('common.all')}
                    </button>

                    {mainCategories.map(category => (
                        <button
                            type="button"
                            key={category.id}
                            className={activeMainCategory === category.id ? 'active' : ''}
                            onClick={() => onSelectMainCategory(category)}
                        >
                            {lang === 'en' && category.nameEn ? category.nameEn : category.name}
                        </button>
                    ))}
                </nav>

                <div
                    className={`catalog-content${
                        activeMainCategory && subCategories.length ? ' has-sub-categories' : ''
                    }`}
                >
                    {activeMainCategory && subCategories.length > 0 && (
                        <aside className="sub-category-nav" aria-label={t('catalog.subCatAria')}>
                            <button
                                type="button"
                                className={categoryId === activeMainCategory ? 'active' : ''}
                                onClick={onSelectAllSubCategories}
                            >
                                {t('common.all')}
                            </button>

                            {subCategories.map(category => (
                                <button
                                    type="button"
                                    key={category.id}
                                    className={categoryId === category.id ? 'active' : ''}
                                    onClick={() => onSelectSubCategory(category)}
                                >
                                    {lang === 'en' && category.nameEn ? category.nameEn : category.name}
                                </button>
                            ))}
                        </aside>
                    )}

                    <div ref={resultsRef} className="catalog-results">
                        <div className="catalog-search">
                            <div className="search-box">
                                <span aria-hidden="true">⌕</span>
                                <input
                                    value={keyword}
                                    placeholder={t('catalog.searchPlaceholder')}
                                    onChange={e => onKeywordChange(e.target.value)}
                                />
                                {keyword && (
                                    <button
                                        type="button"
                                        aria-label={t('catalog.clearSearchAria')}
                                        onClick={() => onKeywordChange('')}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        </div>

                        {loading ? (
                            <div className="empty">{t('catalog.loading')}</div>
                        ) : !visibleProducts.length ? (
                            <div className="empty">
                                {fiveRecommendation
                                    ? t('catalog.emptyFiltered')
                                    : t('catalog.emptySearch')}
                            </div>
                        ) : (
                            <div className="products">
                                {pagedProducts.map(product => {
                                    const isError = !!failedImages[product.id]
                                    const displayName =
                                        lang === 'en' && product.nameEn ? product.nameEn : product.name
                                    const elLabel = product.elementType
                                        ? t(`elements.${product.elementType}`)
                                        : t('catalog.unclassified')
                                    return (
                                        <article key={product.id}>
                                            <div
                                                className={`photo${isError ? ' image-error' : ''}`}
                                                role="button"
                                                tabIndex={0}
                                                aria-label={t('catalog.photoAddAria', { name: displayName })}
                                                title={t('catalog.photoAddTitle', { name: displayName })}
                                                onClick={() => onAddProduct(product)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault()
                                                        onAddProduct(product)
                                                    }
                                                }}
                                            >
                                                {product.imageUrl && !isError ? (
                                                    <img
                                                        src={product.imageUrl}
                                                        alt={displayName}
                                                        loading="lazy"
                                                        onLoad={e => onProductImageLoad(product, e)}
                                                        onError={() =>
                                                            setFailedImages(prev => ({ ...prev, [product.id]: true }))
                                                        }
                                                        draggable={false}
                                                    />
                                                ) : (
                                                    !isError && <span>{t('catalog.noImageAdd')}</span>
                                                )}

                                                <small>{t('catalog.elementBadge', { el: elLabel })}</small>
                                            </div>

                                            <b className="product-name">{displayName}</b>

                                            <small className="product-info">
                                                {productSizeLabel(product, lang)} · {product.weight || 0}g
                                            </small>

                                            <div className="buy">
                                                <strong>¥{Number(product.price).toFixed(2)}</strong>
                                                <button
                                                    type="button"
                                                    onClick={() => onAddProduct(product)}
                                                    aria-label={t('catalog.addAria', { name: displayName })}
                                                >
                                                    {t('catalog.btnAdd')}
                                                </button>
                                            </div>
                                        </article>
                                    )
                                })}
                            </div>
                        )}

                        {visibleProducts.length > CATALOG_PAGE_SIZE && (
                            <div className="catalog-pagination" aria-label={t('catalog.paginationAria')}>
                <span>
                  {t('catalog.paginationInfo', {
                      total: visibleProducts.length,
                      page: safePage,
                      totalPages
                  })}
                </span>
                                <div className="pagination-actions">
                                    <button
                                        type="button"
                                        disabled={safePage <= 1}
                                        onClick={() => changePage(safePage - 1)}
                                    >
                                        {t('common.prevPage')}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={safePage >= totalPages}
                                        onClick={() => changePage(safePage + 1)}
                                    >
                                        {t('common.nextPage')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}