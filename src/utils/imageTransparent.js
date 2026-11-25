export function isAccessoryImage(product) {
    return !!(product && product.imageUrl)
}

export function makeAccessoryBackgroundTransparent(sourceImage) {
    return new Promise(resolve => {
        try {
            const width = sourceImage.naturalWidth || sourceImage.width
            const height = sourceImage.naturalHeight || sourceImage.height
            if (!width || !height || width * height > 6000000) return resolve(null)

            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d', { willReadFrequently: true })
            if (!ctx) return resolve(null)

            ctx.drawImage(sourceImage, 0, 0)
            const imageData = ctx.getImageData(0, 0, width, height)
            const pixels = imageData.data
            const visited = new Uint8Array(width * height)
            const queue = new Int32Array(width * height)
            let head = 0
            let tail = 0

            const isBackground = index => {
                const offset = index * 4
                const r = pixels[offset]
                const g = pixels[offset + 1]
                const b = pixels[offset + 2]
                return r >= 232 && g >= 232 && b >= 232 && Math.max(r, g, b) - Math.min(r, g, b) <= 30
            }

            const enqueue = index => {
                if (index < 0 || index >= width * height || visited[index] || !isBackground(index)) return
                visited[index] = 1
                queue[tail++] = index
            }

            for (let x = 0; x < width; x++) {
                enqueue(x)
                enqueue((height - 1) * width + x)
            }
            for (let y = 0; y < height; y++) {
                enqueue(y * width)
                enqueue(y * width + width - 1)
            }

            while (head < tail) {
                const index = queue[head++]
                const x = index % width
                if (x > 0) enqueue(index - 1)
                if (x < width - 1) enqueue(index + 1)
                if (index >= width) enqueue(index - width)
                if (index < width * (height - 1)) enqueue(index + width)
            }

            for (let i = 0; i < visited.length; i++) {
                if (visited[i]) pixels[i * 4 + 3] = 0
            }

            ctx.putImageData(imageData, 0, 0)
            resolve(canvas.toDataURL('image/png'))
        } catch {
            resolve(null)
        }
    })
}