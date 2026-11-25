import { useCallback, useEffect, useRef, useState } from 'react'
import request, { getErrorMessage } from './utils/request'
import {
  computeBoardMetrics,
  computeOrganizedPositions,
  diyType,
  exportBoardDesignImage,
  findInsertionAngle,
  positionFromAngle,
  productLengthMm
} from './utils/braceletGeometry'
import { isAccessoryImage, makeAccessoryBackgroundTransparent } from './utils/imageTransparent'
import { useI18n } from './i18n/I18nContext'
import BraceletBoard from './components/BraceletBoard'
import ProductCatalog from './components/ProductCatalog'
import SaveDesignModal from './components/SaveDesignModal'
import CheckoutModal from './components/CheckoutModal'
import FiveElements from './components/FiveElements'
import './styles/shop.css'

export default function App() {
  const { lang, toggleLang, t } = useI18n()
  const [activePage, setActivePage] = useState('diy')
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [categoryId, setCategoryId] = useState(null)
  const [activeMainCategory, setActiveMainCategory] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState([])
  const [positions, setPositions] = useState([])
  const [wristCm, setWristCm] = useState(16)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [imageSizes, setImageSizes] = useState({})
  const [transparentImages, setTransparentImages] = useState({})
  const [fiveRecommendation, setFiveRecommendation] = useState(null)

  const boardRef = useRef(null)
  const searchTimerRef = useRef(null)
  const requestIdRef = useRef(0)
  const processingTransparentRef = useRef(new Set())

  const stateRef = useRef({
    selected,
    positions,
    wristCm,
    imageSizes,
    transparentImages,
    t
  })

  useEffect(() => {
    stateRef.current = {
      selected,
      positions,
      wristCm,
      imageSizes,
      transparentImages,
      t
    }
  }, [selected, positions, wristCm, imageSizes, transparentImages, t])

  const loadProducts = useCallback(async ({ nextCategoryId = categoryId, nextKeyword = keyword } = {}) => {
    const currentRequest = ++requestIdRef.current
    setLoading(true)

    const params = {}
    if (nextCategoryId) params.categoryId = nextCategoryId
    if (nextKeyword.trim()) params.keyword = nextKeyword.trim()

    try {
      const response = await request.get('/api/products', { params })
      if (currentRequest !== requestIdRef.current) return
      setProducts(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      if (currentRequest !== requestIdRef.current) return
      const curT = stateRef.current.t
      setMessage(
          curT('messages.loadProductsFailed', {
            err: getErrorMessage(error, curT('messages.requestFailed'))
          })
      )
    } finally {
      if (currentRequest === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [categoryId, keyword])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await request.get('/api/categories')
        if (!active) return
        setCategories(Array.isArray(res.data) ? res.data : [])
        await loadProducts({ nextCategoryId: null, nextKeyword: '' })
      } catch (error) {
        if (!active) return
        const curT = stateRef.current.t
        setMessage(
            curT('messages.loadInitFailed', {
              err: getErrorMessage(error, curT('messages.backendHint'))
            })
        )
      }
    })()

    return () => {
      active = false
      clearTimeout(searchTimerRef.current)
      requestIdRef.current += 1
    }
  }, [loadProducts])

  useEffect(() => {
    function handleResize() {
      const { selected: curSelected, positions: curPositions, wristCm: curWrist, imageSizes: curSizes } =
          stateRef.current
      if (!curSelected.length) return
      const rect = boardRef.current?.getBoundingClientRect()
      const metrics = computeBoardMetrics({
        size: rect ? { width: rect.width, height: rect.height } : null,
        wristCm: curWrist,
        selected: curSelected,
        imageSizes: curSizes
      })
      setPositions(curPositions.map(pos => positionFromAngle(pos?.angle ?? -Math.PI / 2, metrics)))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function handleKeywordChange(nextKeyword) {
    setKeyword(nextKeyword)
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      loadProducts({ nextCategoryId: categoryId, nextKeyword })
    }, 300)
  }

  async function handleSelectMainCategory(category) {
    const id = category ? category.id : null
    setActiveMainCategory(id)
    setCategoryId(id)
    await loadProducts({ nextCategoryId: id, nextKeyword: keyword })
  }

  async function handleSelectSubCategory(category) {
    setCategoryId(category.id)
    await loadProducts({ nextCategoryId: category.id, nextKeyword: keyword })
  }

  async function handleSelectAllSubCategories() {
    setCategoryId(activeMainCategory)
    await loadProducts({ nextCategoryId: activeMainCategory, nextKeyword: keyword })
  }

  const handleProductImageLoad = useCallback(async (product, event) => {
    const img = event?.target
    if (!img?.naturalWidth || !img?.naturalHeight || !product?.id) return

    setImageSizes(prev => ({
      ...prev,
      [product.id]: { width: img.naturalWidth, height: img.naturalHeight }
    }))

    const { transparentImages: cachedMap } = stateRef.current
    if (
        !isAccessoryImage(product) ||
        cachedMap[product.id] ||
        processingTransparentRef.current.has(product.id)
    ) {
      return
    }

    processingTransparentRef.current.add(product.id)
    try {
      const transparentUrl = await makeAccessoryBackgroundTransparent(img)
      if (transparentUrl) {
        setTransparentImages(prev => ({ ...prev, [product.id]: transparentUrl }))
      }
    } finally {
      processingTransparentRef.current.delete(product.id)
    }
  }, [])

  function handleOrganize() {
    const rect = boardRef.current?.getBoundingClientRect()
    const metrics = computeBoardMetrics({
      size: rect ? { width: rect.width, height: rect.height } : null,
      wristCm,
      selected,
      imageSizes
    })
    const res = computeOrganizedPositions({
      selected,
      currentPositions: positions,
      wristCm,
      imageSizes,
      metrics,
      t
    })
    setMessage(res.message)
    if (res.ok) setPositions(res.positions)
    return res.ok
  }

  function handleAddProduct(product) {
    if (!product || !product.id) {
      setMessage(t('messages.productIncomplete'))
      return
    }
    const length = productLengthMm(product)
    if (!Number.isFinite(length) || length <= 0) {
      setMessage(t('messages.productNoSize'))
      return
    }

    const currentTotal = selected.reduce((sum, p) => sum + productLengthMm(p), 0)
    const maxDiyLengthMm = (Number(wristCm || 0) + 1) * 10
    const maxDiyCm = Number(wristCm || 0) + 1

    if (currentTotal + length > maxDiyLengthMm + 0.001) {
      setMessage(t('messages.reachMaxLength', { cm: maxDiyCm.toFixed(1) }))
      return
    }

    const rect = boardRef.current?.getBoundingClientRect()
    const metrics = computeBoardMetrics({
      size: rect ? { width: rect.width, height: rect.height } : null,
      wristCm,
      selected,
      imageSizes
    })

    const insertAngle = findInsertionAngle({
      selected,
      currentPositions: positions,
      wristCm,
      imageSizes
    })
    const newItem = {
      ...product,
      diyType: diyType(product),
      key: crypto.randomUUID()
    }
    const nextSelected = [...selected, newItem]
    const nextPositions = [...positions, positionFromAngle(insertAngle, metrics)]

    const organized = computeOrganizedPositions({
      selected: nextSelected,
      currentPositions: nextPositions,
      wristCm,
      imageSizes,
      metrics,
      t
    })

    if (!organized.ok) {
      setMessage(organized.message || t('messages.insufficientSpace'))
      return
    }

    const displayName = lang === 'en' && product.nameEn ? product.nameEn : product.name
    setSelected(nextSelected)
    setPositions(organized.positions)
    setMessage(t('messages.addedSuccess', { name: displayName }))
  }

  function handleWristChange(nextWrist) {
    const prevWrist = wristCm
    const circumference = Number(nextWrist) * 10
    if (!Number.isFinite(circumference) || circumference <= 0) return

    const currentTotal = selected.reduce((sum, p) => sum + productLengthMm(p), 0)
    if (currentTotal > (Number(nextWrist) + 1) * 10 + 0.001) {
      setMessage(t('messages.wristTooSmall'))
      return
    }

    const rect = boardRef.current?.getBoundingClientRect()
    const metrics = computeBoardMetrics({
      size: rect ? { width: rect.width, height: rect.height } : null,
      wristCm: nextWrist,
      selected,
      imageSizes
    })
    const organized = computeOrganizedPositions({
      selected,
      currentPositions: positions,
      wristCm: nextWrist,
      imageSizes,
      metrics,
      t
    })

    if (!organized.ok) {
      setWristCm(prevWrist)
      setMessage(t('messages.wristNoFit'))
      return
    }

    setWristCm(nextWrist)
    setPositions(organized.positions)
  }

  function handleFlipItem(index) {
    if (index == null || !selected[index]) return
    setSelected(prev =>
        prev.map((item, i) => (i === index ? { ...item, flipped: !item.flipped } : item))
    )
  }

  function handleRemoveItem(index) {
    const nextSelected = selected.filter((_, i) => i !== index)
    const nextPositions = positions.filter((_, i) => i !== index)

    if (!nextSelected.length) {
      setSelected([])
      setPositions([])
      return
    }

    const rect = boardRef.current?.getBoundingClientRect()
    const metrics = computeBoardMetrics({
      size: rect ? { width: rect.width, height: rect.height } : null,
      wristCm,
      selected: nextSelected,
      imageSizes
    })
    const organized = computeOrganizedPositions({
      selected: nextSelected,
      currentPositions: nextPositions,
      wristCm,
      imageSizes,
      metrics,
      t
    })

    setSelected(nextSelected)
    setPositions(organized.ok ? organized.positions : nextPositions)
  }

  function handleClear(confirmUser = true) {
    if (
        confirmUser &&
        selected.length > 0 &&
        !window.confirm(t('messages.confirmClear'))
    ) {
      return
    }
    setSelected([])
    setPositions([])
  }

  function buildDesignItems() {
    const rect = boardRef.current?.getBoundingClientRect()
    const metrics = computeBoardMetrics({
      size: rect ? { width: rect.width, height: rect.height } : null,
      wristCm,
      selected,
      imageSizes
    })
    return selected.map((p, i) => {
      const pos = positionFromAngle(positions[i]?.angle ?? -Math.PI / 2, metrics)
      return {
        productId: p.id,
        name: p.name,
        diameterMm: p.diameterMm,
        price: p.price,
        weight: p.weight,
        elementType: p.elementType,
        imageUrl: p.imageUrl,
        diyType: diyType(p),
        widthMm: p.widthMm,
        heightMm: p.heightMm,
        flipped: !!p.flipped,
        angle: pos.angle,
        x: pos.x,
        y: pos.y
      }
    })
  }

  function buildGroupedItems() {
    const map = new Map()
    selected.forEach(p => map.set(p.id, (map.get(p.id) || 0) + 1))
    return [...map.entries()].map(([productId, quantity]) => ({ productId, quantity }))
  }

  async function uploadCurrentDesignImage() {
    return exportBoardDesignImage({
      boardEl: boardRef.current,
      selected,
      positions,
      wristCm,
      imageSizes,
      transparentImages,
      onCacheTransparent: (id, url) =>
          setTransparentImages(prev => ({ ...prev, [id]: url })),
      onRecordImageSize: (id, size) =>
          setImageSizes(prev => ({ ...prev, [id]: size })),
      t
    })
  }

  async function handleConfirmSave({ name, phone }) {
    if (submitting) return
    setSubmitting(true)
    try {
      setMessage(t('messages.uploadingImage'))
      const imageUrl = await uploadCurrentDesignImage()
      const user = await request.post('/api/users', { name, phone }).then(r => r.data)
      await request.post('/api/designs', {
        userId: user.id,
        title: t('messages.defaultDesignTitle'),
        wristCm,
        items: buildDesignItems(),
        imageUrl
      })
      setSaveOpen(false)
      setMessage(t('messages.saveSuccess'))
    } catch (e) {
      setMessage(t('messages.saveFailed', { err: getErrorMessage(e, t('messages.requestFailed')) }))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmOrder(checkoutData) {
    if (submitting) return
    setSubmitting(true)
    try {
      const designImageUrl = await uploadCurrentDesignImage()
      const order = await request
          .post('/api/orders', {
            ...checkoutData,
            items: buildGroupedItems(),
            wristCm,
            designItems: buildDesignItems(),
            designImageUrl
          })
          .then(r => r.data)

      const ok = window.confirm(
          t('messages.confirmOrderCreated', {
            orderNo: order.orderNo,
            price: Number(order.totalPrice).toFixed(2)
          })
      )
      if (ok) {
        const paid = await request.post(`/api/orders/${order.id}/pay`).then(r => r.data)
        setMessage(t('messages.orderPaid', { orderNo: paid.orderNo }))
        setCheckoutOpen(false)
        handleClear(false)
        await loadProducts()
      } else {
        setMessage(t('messages.orderPending', { orderNo: order.orderNo }))
        setCheckoutOpen(false)
      }
    } catch (e) {
      setMessage(t('messages.orderFailed', { err: getErrorMessage(e, t('messages.requestFailed')) }))
    } finally {
      setSubmitting(false)
    }
  }

  const totalPrice = selected.reduce((sum, p) => sum + Number(p.price || 0), 0)

  const selectedSummary = (() => {
    const map = new Map()
    for (const product of selected) {
      const displayName = lang === 'en' && product.nameEn ? product.nameEn : product.name
      const current = map.get(product.id) || {
        productId: product.id,
        name: displayName,
        quantity: 0,
        unitPrice: Number(product.price || 0)
      }
      current.quantity += 1
      map.set(product.id, current)
    }
    return [...map.values()].map(item => ({
      ...item,
      subtotal: item.quantity * item.unitPrice
    }))
  })()

  return (
      <div className="shop">
        <header>
          <div className="brand">
            <b>{t('common.brandName')}</b>
            <small>{t('common.brandTagline')}</small>
          </div>

          <nav className="user-nav">
            <button
                type="button"
                className={activePage === 'diy' ? 'active' : ''}
                onClick={() => setActivePage('diy')}
            >
              {t('common.navDiy')}
            </button>
            <button
                type="button"
                className={activePage === 'five' ? 'active' : ''}
                onClick={() => setActivePage('five')}
            >
              {t('common.navFive')}
            </button>
            <button
                type="button"
                className="lang-toggle"
                onClick={toggleLang}
                aria-label={t('common.langSwitchAria')}
            >
              {t('common.langSwitchLabel')}
            </button>
          </nav>
        </header>

        <section className="hero">
          <span>{t('hero.eyebrow')}</span>
          <h1>{t('hero.title')}</h1>
          <p>{t('hero.subtitle')}</p>
        </section>

        {activePage === 'five' ? (
            <FiveElements
                onUseProduct={product => {
                  setActivePage('diy')
                  handleAddProduct(product)
                }}
                onRecommendationReady={payload => setFiveRecommendation(payload)}
                onShowRecommendations={() => setActivePage('diy')}
            />
        ) : (
            <main>
              <ProductCatalog
                  categories={categories}
                  products={products}
                  loading={loading}
                  categoryId={categoryId}
                  activeMainCategory={activeMainCategory}
                  keyword={keyword}
                  fiveRecommendation={fiveRecommendation}
                  onSelectMainCategory={handleSelectMainCategory}
                  onSelectSubCategory={handleSelectSubCategory}
                  onSelectAllSubCategories={handleSelectAllSubCategories}
                  onKeywordChange={handleKeywordChange}
                  onClearFiveRecommendation={() => {
                    setFiveRecommendation(null)
                    setCategoryId(null)
                    setActiveMainCategory(null)
                    setKeyword('')
                    loadProducts({ nextCategoryId: null, nextKeyword: '' })
                  }}
                  onAddProduct={handleAddProduct}
                  onProductImageLoad={handleProductImageLoad}
              />

              <BraceletBoard
                  boardRef={boardRef}
                  selected={selected}
                  positions={positions}
                  wristCm={wristCm}
                  imageSizes={imageSizes}
                  transparentImages={transparentImages}
                  onWristChange={handleWristChange}
                  onOrganize={handleOrganize}
                  onClear={handleClear}
                  onFlipItem={handleFlipItem}
                  onRemoveItem={handleRemoveItem}
                  onUpdatePositions={setPositions}
                  onProductImageLoad={handleProductImageLoad}
                  onOpenSave={() => setSaveOpen(true)}
                  onOpenCheckout={() => setCheckoutOpen(true)}
                  onNotify={setMessage}
              />
            </main>
        )}

        <SaveDesignModal
            open={saveOpen}
            selectedCount={selected.length}
            totalPrice={totalPrice}
            submitting={submitting}
            onClose={() => setSaveOpen(false)}
            onNotify={setMessage}
            onConfirm={handleConfirmSave}
        />

        <CheckoutModal
            open={checkoutOpen}
            selectedCount={selected.length}
            selectedSummary={selectedSummary}
            totalPrice={totalPrice}
            submitting={submitting}
            onClose={() => setCheckoutOpen(false)}
            onNotify={setMessage}
            onConfirm={handleConfirmOrder}
        />

        <footer>{t('common.footerText')}</footer>

        {message && (
            <div
                className="toast"
                role="status"
                aria-live="polite"
                onClick={() => setMessage('')}
            >
              {message} ×
            </div>
        )}
      </div>
  )
}