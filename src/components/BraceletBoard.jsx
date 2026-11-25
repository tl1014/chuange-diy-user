import { useEffect, useRef, useState } from 'react'
import {
    ELEMENT_COLORS,
    computeBoardMetrics,
    computeOrganizedPositions,
    diyType,
    itemHeightMm,
    itemWidthMm,
    layoutFootprintMm,
    normalizeAngle,
    positionFromAngle,
    productLengthMm
} from '../utils/braceletGeometry'
import { useI18n } from '../i18n/I18nContext'

const ELEMENT_KEYS = ['GOLD', 'WOOD', 'WATER', 'FIRE', 'EARTH']

export default function BraceletBoard({
                                          boardRef,
                                          selected,
                                          positions,
                                          wristCm,
                                          imageSizes,
                                          transparentImages,
                                          onWristChange,
                                          onOrganize,
                                          onClear,
                                          onFlipItem,
                                          onRemoveItem,
                                          onUpdatePositions,
                                          onProductImageLoad,
                                          onOpenSave,
                                          onOpenCheckout,
                                          onNotify
                                      }) {
    const { t } = useI18n()
    const [draggingIndex, setDraggingIndex] = useState(null)
    const [activeItemIndex, setActiveItemIndex] = useState(null)
    const [showStats, setShowStats] = useState(false)
    const [boardSize, setBoardSize] = useState(null)

    const dragStateRef = useRef(null)
    const latestRef = useRef({ selected, positions, wristCm, imageSizes, t })

    useEffect(() => {
        latestRef.current = { selected, positions, wristCm, imageSizes, t }
    }, [selected, positions, wristCm, imageSizes, t])

    useEffect(() => {
        const el = boardRef.current
        if (!el) return

        const updateSize = () => {
            const rect = el.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0) {
                setBoardSize({ width: rect.width, height: rect.height })
            }
        }

        updateSize()

        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(updateSize)
            observer.observe(el)
            return () => observer.disconnect()
        }
    }, [boardRef])

    const resolvedActiveIndex =
        activeItemIndex !== null && selected[activeItemIndex] ? activeItemIndex : null

    const metrics = computeBoardMetrics({
        size: boardSize,
        wristCm,
        selected,
        imageSizes
    })

    const totalMm = selected.reduce((sum, p) => sum + productLengthMm(p), 0)
    const totalPrice = selected.reduce((sum, p) => sum + Number(p.price || 0), 0)
    const totalWeight = selected.reduce((sum, p) => sum + Number(p.weight || 0), 0)
    const maxDiyCm = Number(wristCm || 0) + 1
    const maxDiyLengthMm = maxDiyCm * 10
    const remainingMm = Math.max(0, maxDiyLengthMm - totalMm)

    const elementStats = ELEMENT_KEYS.map(key => ({
        key,
        name: t(`elements.${key}`),
        count: selected.filter(p => p.elementType === key).length
    }))

    function getPointerAngle(event) {
        const el = boardRef.current
        if (!el) return -Math.PI / 2
        const rect = el.getBoundingClientRect()
        const x = event.clientX - rect.left - rect.width / 2
        const y = event.clientY - rect.top - rect.height / 2
        return normalizeAngle(Math.atan2(y, x))
    }

    function handlePointerDown(event, index) {
        const { positions: curPositions } = latestRef.current
        setActiveItemIndex(index)
        setDraggingIndex(index)

        const pointerAngle = getPointerAngle(event)
        const itemAngle = curPositions[index]?.angle ?? pointerAngle
        const diff = pointerAngle - itemAngle

        dragStateRef.current = {
            index,
            angleOffset: Math.atan2(Math.sin(diff), Math.cos(diff)),
            startAngle: itemAngle,
            snapshotPositions: curPositions.map(pos => (pos ? { ...pos } : pos))
        }

        if (event.currentTarget?.setPointerCapture) {
            try {
                event.currentTarget.setPointerCapture(event.pointerId)
            } catch {
                // 忽略部分浏览器合成事件不支持 capture 的情况
            }
        }
    }

    function handlePointerMove(event) {
        const drag = dragStateRef.current
        if (!drag) return

        const { selected: curSelected, positions: curPositions, wristCm: curWrist, imageSizes: curSizes } =
            latestRef.current
        const rect = boardRef.current?.getBoundingClientRect()
        const size = rect && rect.width > 0 && rect.height > 0
            ? { width: rect.width, height: rect.height }
            : boardSize
        const curMetrics = computeBoardMetrics({
            size,
            wristCm: curWrist,
            selected: curSelected,
            imageSizes: curSizes
        })

        const angle = normalizeAngle(getPointerAngle(event) - (drag.angleOffset || 0))
        const next = [...curPositions]
        next[drag.index] = positionFromAngle(angle, curMetrics)
        onUpdatePositions(next)
    }

    function handlePointerUp() {
        const drag = dragStateRef.current
        if (!drag) return
        dragStateRef.current = null
        setDraggingIndex(null)

        const {
            selected: curSelected,
            positions: curPositions,
            wristCm: curWrist,
            imageSizes: curSizes,
            t: curT
        } = latestRef.current
        const index = drag.index
        const movingProduct = curSelected[index]
        if (!movingProduct) return

        const rect = boardRef.current?.getBoundingClientRect()
        const size = rect && rect.width > 0 && rect.height > 0
            ? { width: rect.width, height: rect.height }
            : boardSize
        const curMetrics = computeBoardMetrics({
            size,
            wristCm: curWrist,
            selected: curSelected,
            imageSizes: curSizes
        })

        const currentAngle = curPositions[index]?.angle
        const originalAngle = drag.startAngle ?? currentAngle ?? -Math.PI / 2
        const originalPosition = positionFromAngle(originalAngle, curMetrics)
        const oldPositions = drag.snapshotPositions || curPositions.map(pos => (pos ? { ...pos } : pos))

        const circumference = Math.max(1, (Number(curWrist || 16) + 1) * 10)
        const radiusMm = circumference / (Math.PI * 2)

        let nearestIndex = -1
        let nearestDistance = Infinity

        if (currentAngle != null && diyType(movingProduct) !== 'PENDANT') {
            for (let otherIndex = 0; otherIndex < curSelected.length; otherIndex++) {
                if (otherIndex === index || diyType(curSelected[otherIndex]) === 'PENDANT') continue
                const otherAngle = curPositions[otherIndex]?.angle
                if (otherAngle == null) continue

                const rawDelta = Math.abs(normalizeAngle(currentAngle) - normalizeAngle(otherAngle))
                const angularDelta = Math.min(rawDelta, Math.PI * 2 - rawDelta)
                const distanceMm = angularDelta * radiusMm
                if (distanceMm < nearestDistance) {
                    nearestDistance = distanceMm
                    nearestIndex = otherIndex
                }
            }
        }

        const movingLength = layoutFootprintMm(movingProduct, curSizes)
        const targetLength = nearestIndex >= 0 ? layoutFootprintMm(curSelected[nearestIndex], curSizes) : 0
        const swapThreshold = nearestIndex >= 0 ? Math.max(2, ((movingLength + targetLength) / 2) * 0.9) : 0

        if (nearestIndex >= 0 && nearestDistance <= swapThreshold) {
            const targetAngle = curPositions[nearestIndex]?.angle
            const swapped = [...curPositions]
            swapped[index] = positionFromAngle(targetAngle, curMetrics)
            swapped[nearestIndex] = originalPosition

            const organized = computeOrganizedPositions({
                selected: curSelected,
                currentPositions: swapped,
                wristCm: curWrist,
                imageSizes: curSizes,
                metrics: curMetrics,
                t: curT
            })

            if (organized.ok) {
                onUpdatePositions(organized.positions)
                setActiveItemIndex(index)
                onNotify(curT('messages.swapped', { a: movingProduct.name, b: curSelected[nearestIndex].name }))
            } else {
                onUpdatePositions(oldPositions)
                onNotify(curT('messages.swapFailed'))
            }
            return
        }

        if (currentAngle != null) {
            const moved = [...curPositions]
            moved[index] = positionFromAngle(currentAngle, curMetrics)
            const organized = computeOrganizedPositions({
                selected: curSelected,
                currentPositions: moved,
                wristCm: curWrist,
                imageSizes: curSizes,
                metrics: curMetrics,
                t: curT
            })

            if (organized.ok) {
                onUpdatePositions(organized.positions)
                setActiveItemIndex(index)
                onNotify(curT('messages.movedToGap'))
            } else {
                onUpdatePositions(oldPositions)
                onNotify(curT('messages.moveInvalid'))
            }
        } else {
            const fallback = [...curPositions]
            fallback[index] = originalPosition
            onUpdatePositions(fallback)
        }
    }

    function handleRemoveSelected() {
        if (resolvedActiveIndex === null) return
        onRemoveItem(resolvedActiveIndex)
        setActiveItemIndex(null)
    }

    const activeProduct = resolvedActiveIndex !== null ? selected[resolvedActiveIndex] : null

    return (
        <section className="work">
            <div className="work-head">
                <div>
                    <h2>{t('board.title')}</h2>
                    <p>
                        <span>{t('board.steps')}</span>
                    </p>
                </div>

                <div className="work-head-actions">
                    <button
                        type="button"
                        className="organize-button"
                        onClick={onOrganize}
                        title={t('board.btnOrganizeTitle')}
                    >
                        <span aria-hidden="true">✧</span> {t('board.btnOrganize')}
                    </button>
                    <button
                        type="button"
                        className="reset-button"
                        onClick={() => {
                            setActiveItemIndex(null)
                            onClear(true)
                        }}
                        title={t('board.btnResetTitle')}
                    >
                        <span aria-hidden="true">↺</span> {t('board.btnReset')}
                    </button>
                </div>
            </div>

            {activeProduct && (
                <div className="diy-item-toolbar">
          <span>
            {t('board.selectedPrefix')}
              {activeProduct.name}
              {diyType(activeProduct) === 'PENDANT' && (
                  <small>{t('board.connectorSpec', { mm: activeProduct.diameterMm })}</small>
              )}
          </span>
                    <button type="button" onClick={() => onFlipItem(resolvedActiveIndex)}>
                        {t('board.btnFlip')}
                    </button>
                    <button type="button" onClick={handleRemoveSelected}>
                        {t('board.btnRemove')}
                    </button>
                    <button
                        type="button"
                        className="toolbar-close"
                        onClick={() => setActiveItemIndex(null)}
                    >
                        {t('common.done')}
                    </button>
                </div>
            )}

            <div
                className="bracelet-board"
                ref={boardRef}
                style={{ position: 'relative' }}
                aria-label={t('board.ariaLabel')}
            >
                <div
                    className="ring"
                    style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        width: `${metrics.radius * 2}px`,
                        height: `${metrics.radius * 2}px`,
                        transform: 'translate(-50%, -50%)',
                        boxSizing: 'border-box',
                        borderRadius: '50%',
                        border: '2px solid #e5dec9',
                        pointerEvents: 'none'
                    }}
                />

                <div className="center">
                    <b>串个喜喜</b>
                    <small>MY BRACELET</small>
                </div>

                {selected.map((product, index) => {
                    const type = diyType(product)
                    const isPendant = type === 'PENDANT'
                    const isBead = type === 'BEAD'
                    const angle = positions[index]?.angle ?? 0
                    const pos = positionFromAngle(angle, metrics)
                    const widthPx = itemWidthMm(product, imageSizes) * metrics.pxPerMm
                    const heightPx = itemHeightMm(product, imageSizes) * metrics.pxPerMm
                    const rotateRad = isPendant ? angle - Math.PI / 2 : angle + Math.PI / 2
                    const src = transparentImages[product.id] || product.imageUrl

                    return (
                        <div
                            key={product.key}
                            className={`bead diy-${type.toLowerCase()}${draggingIndex === index ? ' dragging' : ''}`}
                            style={{
                                left: `${pos.x}%`,
                                top: `${pos.y}%`,
                                width: `${widthPx}px`,
                                height: `${heightPx}px`,
                                background: 'transparent',
                                border: isBead ? '2px solid rgba(255, 255, 255, 0.85)' : '0',
                                boxShadow: isBead ? '0 3px 9px rgba(0, 0, 0, 0.18)' : 'none',
                                overflow: isBead ? 'hidden' : 'visible',
                                transform: isPendant
                                    ? `translate(-50%, 0) rotate(${rotateRad}rad)`
                                    : `translate(-50%, -50%) rotate(${rotateRad}rad)`,
                                transformOrigin: isPendant ? '50% 0' : '50% 50%',
                                marginLeft: '0',
                                marginTop: '0',
                                borderRadius: isBead ? '50%' : '0'
                            }}
                            onPointerDown={e => handlePointerDown(e, index)}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            onDoubleClick={() => {
                                if (resolvedActiveIndex === index) setActiveItemIndex(null)
                                onRemoveItem(index)
                            }}
                            title={t('board.beadTitle', { name: product.name })}
                            role="button"
                            tabIndex={0}
                            aria-label={t('board.beadAriaLabel', { name: product.name })}
                            onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    setActiveItemIndex(index)
                                }
                            }}
                        >
                            {product.imageUrl && (
                                <img
                                    src={src}
                                    alt={product.name}
                                    style={{ transform: product.flipped ? 'scaleX(-1)' : 'none' }}
                                    onLoad={e => onProductImageLoad(product, e)}
                                    draggable={false}
                                />
                            )}
                        </div>
                    )
                })}
            </div>

            <div className="stats">
                <div>
                    <small>{t('board.statCountLabel')}</small>
                    <b>
                        {selected.length} <i>{t('board.statCountUnit')}</i>
                    </b>
                </div>

                <div>
                    <small>{t('board.statLengthLabel')}</small>
                    <b>
                        {totalMm.toFixed(1)} <i>{t('board.statLengthUnit')}</i>
                    </b>
                </div>

                <div>
                    <small>{t('board.statWeightLabel')}</small>
                    <b>
                        {totalWeight.toFixed(2)} <i>{t('board.statWeightUnit')}</i>
                    </b>
                </div>

                <div>
                    <small>{t('board.statPriceLabel')}</small>
                    <b>¥{totalPrice.toFixed(2)}</b>
                </div>
            </div>

            <div className="wrist">
                <label>
                    {t('board.wristLabel')}{' '}
                    <input
                        type="number"
                        min="1"
                        max="30"
                        step="0.5"
                        value={wristCm}
                        onChange={e => {
                            const val = Number(e.target.value)
                            if (Number.isFinite(val)) onWristChange(val)
                        }}
                    />{' '}
                    cm
                </label>

                <span className="wrist-capacity">
          {t('board.wristMaxCap', { cm: maxDiyCm.toFixed(1) })}
                    <br />
                    {t('board.wristRemaining', { mm: remainingMm.toFixed(1) })}
        </span>
            </div>

            <div className="work-actions">
                <button type="button" onClick={onOpenSave} disabled={!selected.length}>
                    {t('board.btnSaveDesign')}
                </button>
                <button
                    type="button"
                    className="checkout-button"
                    onClick={onOpenCheckout}
                    disabled={!selected.length}
                >
                    {t('board.btnCheckout', { price: totalPrice.toFixed(2) })}
                </button>
            </div>

            <div className="element">
                <button
                    type="button"
                    className="element-title"
                    onClick={() => setShowStats(prev => !prev)}
                >
                    {t('board.elementAnalysisTitle')}
                    <span>{showStats ? t('board.collapse') : t('board.expand')}</span>
                </button>

                {showStats && (
                    <div className="element-rows">
                        {elementStats.map(item => (
                            <div key={item.key}>
                                <b>{item.name}</b>
                                <i>
                                    <em
                                        style={{
                                            width: `${selected.length ? (item.count / selected.length) * 100 : 0}%`,
                                            background: ELEMENT_COLORS[item.key]
                                        }}
                                    />
                                </i>
                                <small>{t('board.elementBeadCount', { count: item.count })}</small>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}