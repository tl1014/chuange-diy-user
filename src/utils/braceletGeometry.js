import request from './request'
import { isAccessoryImage, makeAccessoryBackgroundTransparent } from './imageTransparent'
import { createTranslator } from '../i18n/translations'

const defaultT = createTranslator('zh-CN')

export const ELEMENT_COLORS = {
    GOLD: '#d6ad55',
    WOOD: '#7da887',
    WATER: '#6e9dbb',
    FIRE: '#d77c69',
    EARTH: '#b89a78'
}

export function diyType(product) {
    return String(product?.diyType || 'BEAD').toUpperCase()
}

export function productLengthMm(product) {
    const type = diyType(product)
    return Math.max(
        0,
        Number((type === 'BEAD' || type === 'PENDANT' ? product.diameterMm : product.widthMm) || product.diameterMm || 0)
    )
}

export function pendantAspectRatio(product, imageSizes = {}) {
    const size = imageSizes[product?.id]
    if (size?.width > 0 && size?.height > 0) return size.width / size.height
    return 0.5
}

export function itemWidthMm(product, imageSizes = {}) {
    const type = diyType(product)
    if (type === 'PENDANT') {
        const ratio = pendantAspectRatio(product, imageSizes)
        return ratio >= 1 ? 18 : 18 * ratio
    }
    const mm = type === 'BEAD' ? product.diameterMm : (product.widthMm || product.diameterMm)
    return Math.max(2, Number(mm || 8))
}

export function itemHeightMm(product, imageSizes = {}) {
    const type = diyType(product)
    if (type === 'PENDANT') {
        const ratio = pendantAspectRatio(product, imageSizes)
        return ratio >= 1 ? 18 / ratio : 18
    }
    const mm = type === 'BEAD' ? product.diameterMm : (product.heightMm || product.diameterMm)
    return Math.max(2, Number(mm || 8))
}

export function layoutFootprintMm(product, imageSizes = {}) {
    const type = diyType(product)
    if (type === 'PENDANT') return productLengthMm(product)

    const width = itemWidthMm(product, imageSizes)
    const height = itemHeightMm(product, imageSizes)
    const visualFootprint = type === 'BEAD' ? width : Math.hypot(width, height)
    return Math.max(productLengthMm(product), visualFootprint)
}

export function productSizeLabel(product, lang = 'zh-CN') {
    const mm = Number(product.diameterMm || product.widthMm || 0)
    if (diyType(product) === 'PENDANT') {
        return lang === 'en' ? `Connector ${Number(product.diameterMm || 0)}mm` : `连接位 ${Number(product.diameterMm || 0)}mm`
    }
    return `${mm}mm`
}

export function isValidPhone(value) {
    const digits = String(value || '').replace(/\D/g, '')
    return /^\+?[0-9\s().-]+$/.test(String(value || '').trim()) && digits.length >= 7 && digits.length <= 15
}

export function normalizeAngle(a) {
    const full = Math.PI * 2
    return ((a % full) + full) % full
}

export function computeBoardMetrics({ size = null, wristCm = 16, selected = [], imageSizes = {} }) {
    const w = size?.width || 440
    const h = size?.height || 560
    const circumferenceMm = Math.max(1, (Number(wristCm || 16) + 1) * 10)
    const radiusMm = circumferenceMm / (Math.PI * 2)

    const maxOuterMm = selected.reduce((max, product) => {
        const width = itemWidthMm(product, imageSizes)
        const height = itemHeightMm(product, imageSizes)
        const outer = diyType(product) === 'PENDANT' ? height : Math.max(width, height) / 2
        return Math.max(max, outer)
    }, 0)

    const availableRadius = Math.max(1, Math.min(w, h) / 2 - 32)
    const pxPerMm = availableRadius / (radiusMm + maxOuterMm + 2)

    return {
        w,
        h,
        cx: w / 2,
        cy: h / 2,
        circumferenceMm,
        radiusMm,
        pxPerMm,
        radius: radiusMm * pxPerMm
    }
}

export function positionFromAngle(angle, metrics) {
    return {
        angle: normalizeAngle(angle),
        x: ((metrics.cx + metrics.radius * Math.cos(angle)) / metrics.w) * 100,
        y: ((metrics.cy + metrics.radius * Math.sin(angle)) / metrics.h) * 100
    }
}

export function getItemGeometry(product, angle, metrics, imageSizes = {}) {
    const type = diyType(product)
    const { cx, cy, radius, pxPerMm } = metrics
    const anchorX = cx + radius * Math.cos(angle)
    const anchorY = cy + radius * Math.sin(angle)
    const width = itemWidthMm(product, imageSizes) * pxPerMm
    const height = itemHeightMm(product, imageSizes) * pxPerMm
    let centerX = anchorX
    let centerY = anchorY
    let rotation = angle + Math.PI / 2

    if (type === 'PENDANT') {
        centerX += (Math.cos(angle) * height) / 2
        centerY += (Math.sin(angle) * height) / 2
        rotation = angle - Math.PI / 2
    }

    return { centerX, centerY, width, height, rotation, anchorX, anchorY, type }
}

export function computeOrganizedPositions({
                                              selected,
                                              currentPositions,
                                              wristCm,
                                              imageSizes,
                                              metrics,
                                              t = defaultT
                                          }) {
    const count = selected.length
    if (!count) return { ok: true, positions: [], message: '' }

    const circumference = Math.max(1, (Number(wristCm || 16) + 1) * 10)
    const occupied = selected.reduce((sum, p) => sum + layoutFootprintMm(p, imageSizes), 0)
    if (occupied > circumference + 0.001) {
        return {
            ok: false,
            positions: currentPositions,
            message: t('messages.organizeOverflow')
        }
    }

    const orderedIndexes = selected
        .map((_, index) => index)
        .sort((a, b) => {
            const angleA = normalizeAngle((currentPositions[a]?.angle ?? -Math.PI / 2) + Math.PI / 2)
            const angleB = normalizeAngle((currentPositions[b]?.angle ?? -Math.PI / 2) + Math.PI / 2)
            return angleA - angleB
        })

    const radiusMm = circumference / (Math.PI * 2)
    const halfSpans = orderedIndexes.map(index => {
        const footprint = layoutFootprintMm(selected[index], imageSizes)
        if (footprint > 2 * radiusMm) return Math.PI
        return Math.asin(Math.min(1, footprint / (2 * radiusMm)))
    })

    const occupiedAngle = halfSpans.reduce((sum, span) => sum + span * 2, 0)
    if (occupiedAngle > Math.PI * 2 + 0.000001) {
        return {
            ok: false,
            positions: currentPositions,
            message: t('messages.organizeTooLarge')
        }
    }

    const gapAngle = Math.max(0, (Math.PI * 2 - occupiedAngle) / count)
    let cursorAngle = 0
    const nextPositions = [...currentPositions]

    for (let i = 0; i < orderedIndexes.length; i++) {
        const index = orderedIndexes[i]
        const centerAngle = count === 1 ? 0 : cursorAngle + halfSpans[i] + gapAngle / 2
        const angle = -Math.PI / 2 + centerAngle
        nextPositions[index] = positionFromAngle(angle, metrics)
        cursorAngle += halfSpans[i] * 2 + gapAngle
    }

    return {
        ok: true,
        positions: nextPositions,
        message: t('messages.organizeSuccess')
    }
}

export function findInsertionAngle({ selected, currentPositions, wristCm, imageSizes }) {
    const count = selected.length
    if (!count) return -Math.PI / 2

    const circumference = Math.max(1, (Number(wristCm || 16) + 1) * 10)
    const radiusMm = circumference / (Math.PI * 2)
    const entries = selected
        .map((item, index) => ({
            angle: normalizeAngle(currentPositions[index]?.angle ?? -Math.PI / 2),
            length: layoutFootprintMm(item, imageSizes)
        }))
        .sort((a, b) => a.angle - b.angle)

    let bestGap = -Infinity
    let bestAngle = -Math.PI / 2

    for (let i = 0; i < entries.length; i++) {
        const current = entries[i]
        const next = entries[(i + 1) % entries.length]
        let delta = next.angle - current.angle
        if (i === entries.length - 1) delta += Math.PI * 2

        const centerDistance = delta * radiusMm
        const freeGap = centerDistance - (current.length + next.length) / 2
        if (freeGap > bestGap) {
            bestGap = freeGap
            const centerOffset = current.length / 2 + Math.max(0, freeGap) / 2
            bestAngle = normalizeAngle(current.angle + centerOffset / radiusMm)
        }
    }
    return bestAngle
}

export async function exportBoardDesignImage({
                                                 boardEl,
                                                 selected,
                                                 positions,
                                                 wristCm,
                                                 imageSizes,
                                                 transparentImages,
                                                 onCacheTransparent,
                                                 onRecordImageSize,
                                                 t = defaultT
                                             }) {
    if (!boardEl) throw new Error(t('messages.errNoBoard'))

    const rect = boardEl.getBoundingClientRect()
    const w = Math.max(1, rect.width)
    const h = Math.max(1, rect.height)
    const scale = 2
    const padding = 40
    const exportW = w + padding * 2
    const exportH = h + padding * 2

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(exportW * scale)
    canvas.height = Math.round(exportH * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error(t('messages.errNoCanvas'))
    ctx.scale(scale, scale)

    ctx.fillStyle = '#faf8f5'
    ctx.fillRect(0, 0, exportW, exportH)
    const bg = ctx.createRadialGradient(
        exportW / 2,
        exportH / 2,
        10,
        exportW / 2,
        exportH / 2,
        Math.max(exportW, exportH) / 2
    )
    bg.addColorStop(0, '#ffffff')
    bg.addColorStop(1, '#faf8f5')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, exportW, exportH)
    ctx.translate(padding, padding)

    const loadImage = src =>
        new Promise(resolve => {
            if (!src) return resolve(null)
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => resolve(img)
            img.onerror = () => resolve(null)
            img.src = src.startsWith('http') || src.startsWith('data:')
                ? src
                : new URL(src, window.location.origin).href
        })

    const nextImageSizes = { ...imageSizes }
    const images = await Promise.all(
        selected.map(async product => {
            const cached = transparentImages[product.id]
            if (cached) return loadImage(cached)
            const original = await loadImage(product.imageUrl)
            if (!original || !isAccessoryImage(product)) return original
            const transparentUrl = await makeAccessoryBackgroundTransparent(original)
            if (!transparentUrl) return original
            onCacheTransparent?.(product.id, transparentUrl)
            return loadImage(transparentUrl)
        })
    )

    images.forEach((img, index) => {
        const product = selected[index]
        if (img && product?.id) {
            nextImageSizes[product.id] = { width: img.naturalWidth, height: img.naturalHeight }
            onRecordImageSize?.(product.id, { width: img.naturalWidth, height: img.naturalHeight })
        }
    })

    const metrics = computeBoardMetrics({
        size: { width: w, height: h },
        wristCm,
        selected,
        imageSizes: nextImageSizes
    })

    ctx.beginPath()
    ctx.arc(metrics.cx, metrics.cy, metrics.radius, 0, Math.PI * 2)
    ctx.setLineDash([])
    ctx.lineWidth = 2
    ctx.strokeStyle = '#e5dec9'
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.fillStyle = '#8c6b52'
    ctx.font = '18px Georgia, serif'
    ctx.fillText('串个喜喜', w / 2, h / 2 - 2)
    ctx.font = '8px Arial, sans-serif'
    ctx.fillText('MY BRACELET', w / 2, h / 2 + 14)

    for (let i = 0; i < selected.length; i++) {
        const product = selected[i]
        const pos = positions[i] || { angle: -Math.PI / 2 }
        const img = images[i]
        const geo = getItemGeometry(product, pos.angle, metrics, nextImageSizes)
        const { centerX: x, centerY: y, width: ww, height: hh } = geo

        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(geo.rotation)

        if (geo.type === 'BEAD') {
            ctx.shadowColor = 'rgba(44, 30, 22, .18)'
            ctx.shadowBlur = 9
            ctx.shadowOffsetY = 3
            ctx.fillStyle = ELEMENT_COLORS[product.elementType] || '#b89a78'
            ctx.beginPath()
            ctx.arc(0, 0, ww / 2, 0, Math.PI * 2)
            ctx.fill()
            ctx.shadowColor = 'transparent'
        }

        if (img) {
            if (geo.type === 'BEAD') {
                ctx.save()
                ctx.beginPath()
                ctx.arc(0, 0, Math.max(1, ww / 2 - 2), 0, Math.PI * 2)
                ctx.clip()
            }
            const drawW = geo.type === 'BEAD' ? ww - 4 : ww
            const drawH = geo.type === 'BEAD' ? hh - 4 : hh
            if (product.flipped) {
                ctx.save()
                ctx.scale(-1, 1)
            }
            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)
            if (product.flipped) ctx.restore()
            if (geo.type === 'BEAD') ctx.restore()
        }
        ctx.restore()
    }

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error(t('messages.errExportBlob'))

    const form = new FormData()
    form.append('file', blob, 'diy-design.png')
    const uploaded = await request.post('/api/upload/image', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })
    return uploaded.data.url
}