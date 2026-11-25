import * as LunarCalendar from 'lunar-javascript'
import { createTranslator } from '../i18n/translations'

const Solar = LunarCalendar.Solar || LunarCalendar.default?.Solar
const defaultT = createTranslator('zh-CN')

export const ELEMENTS = [
    { key: 'WOOD', name: '木', nameEn: 'Wood', color: '#668b68', description: '青绿、木质、植物意象', materials: '绿檀、沉香、青玉、绿幽灵等', enHint: 'Green sandalwood, agarwood, jade', zhHint: '绿檀、沉香、青玉、绿幽灵等' },
    { key: 'FIRE', name: '火', nameEn: 'Fire', color: '#c96d57', description: '红、紫、暖色意象', materials: '南红、红玛瑙、朱砂色系等', enHint: 'Red agate, carnelian', zhHint: '南红、红玛瑙、朱砂色系等' },
    { key: 'EARTH', name: '土', nameEn: 'Earth', color: '#b28b58', description: '黄、棕、大地色意象', materials: '黄水晶、虎眼石、蜜蜡色系等', enHint: 'Tiger eye, amber, yellow crystal', zhHint: '黄水晶、虎眼石、蜜蜡色系等' },
    { key: 'GOLD', name: '金', nameEn: 'Metal', color: '#c3a65c', description: '白、金、银色意象', materials: '白玉、白水晶、金曜石等', enHint: 'White jade, clear crystal', zhHint: '白玉、白水晶、金曜石等' },
    { key: 'WATER', name: '水', nameEn: 'Water', color: '#63869f', description: '黑、蓝、深色意象', materials: '黑曜石、海蓝宝、青金石等', enHint: 'Obsidian, aquamarine, lapis lazuli', zhHint: '黑曜石、海蓝宝、青金石等' }
]

const BRANCH_TO_ELEMENT_KEY = {
    子: 'WATER',
    丑: 'EARTH',
    寅: 'WOOD',
    卯: 'WOOD',
    辰: 'EARTH',
    巳: 'FIRE',
    午: 'FIRE',
    未: 'EARTH',
    申: 'GOLD',
    酉: 'GOLD',
    戌: 'EARTH',
    亥: 'WATER'
}

const STEM_TO_ELEMENT_KEY = {
    甲: 'WOOD',
    乙: 'WOOD',
    丙: 'FIRE',
    丁: 'FIRE',
    戊: 'EARTH',
    己: 'EARTH',
    庚: 'GOLD',
    辛: 'GOLD',
    壬: 'WATER',
    癸: 'WATER'
}

const HIDDEN_STEM_WEIGHTS_BY_BRANCH = {
    子: [['癸', 1]],
    丑: [['己', 0.6], ['癸', 0.3], ['辛', 0.1]],
    寅: [['甲', 0.6], ['丙', 0.3], ['戊', 0.1]],
    卯: [['乙', 1]],
    辰: [['戊', 0.6], ['乙', 0.3], ['癸', 0.1]],
    巳: [['丙', 0.6], ['戊', 0.3], ['庚', 0.1]],
    午: [['丁', 0.7], ['己', 0.3]],
    未: [['己', 0.6], ['丁', 0.3], ['乙', 0.1]],
    申: [['庚', 0.6], ['壬', 0.3], ['戊', 0.1]],
    酉: [['辛', 1]],
    戌: [['戊', 0.6], ['辛', 0.3], ['丁', 0.1]],
    亥: [['壬', 0.7], ['甲', 0.3]]
}

export function getBranchElementKey(branch) {
    return BRANCH_TO_ELEMENT_KEY[branch] || null
}

export function getStemElementKey(stem) {
    return STEM_TO_ELEMENT_KEY[stem] || null
}

export function calculateFiveElements(form, t = defaultT) {
    if (!form.date) throw new Error(t('five.errors.enterBirthDate'))

    const [year, month, day] = form.date.split('-').map(Number)
    const birthDate = new Date(year, month - 1, day)
    if (
        birthDate.getFullYear() !== year ||
        birthDate.getMonth() !== month - 1 ||
        birthDate.getDate() !== day
    ) {
        throw new Error(t('five.errors.invalidBirthDate'))
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (birthDate > today) {
        throw new Error(t('five.errors.futureBirthDate'))
    }

    let parsedTime = { hour: 12, minute: 0, second: 0 }
    if (!form.timeUnknown) {
        const timeValue = String(form.time ?? '').trim()
        const parts = timeValue.split(':')
        const validShape = (parts.length === 2 || parts.length === 3) && parts.every(p => /^\d{1,2}$/.test(p))
        if (!validShape) throw new Error(t('five.errors.invalidBirthTime'))

        const [hour, minute, second = 0] = parts.map(Number)
        if (
            !Number.isInteger(hour) || !Number.isInteger(minute) || !Number.isInteger(second) ||
            hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59
        ) {
            throw new Error(t('five.errors.invalidBirthTime'))
        }
        parsedTime = { hour, minute, second }
    }

    if (!Solar || typeof Solar.fromYmdHms !== 'function') {
        throw new Error(t('five.errors.lunarNotLoaded'))
    }

    const solar = Solar.fromYmdHms(year, month, day, parsedTime.hour, parsedTime.minute, parsedTime.second)
    const lunar = solar.getLunar()
    if (!lunar || typeof lunar.getEightChar !== 'function') {
        throw new Error(t('five.errors.solarToLunarFailed'))
    }

    const eight = lunar.getEightChar()
    if (!eight || typeof eight.getYear !== 'function' || typeof eight.getMonth !== 'function' || typeof eight.getDay !== 'function') {
        throw new Error(t('five.errors.eightCharInvalid'))
    }

    const pillars = [
        { pillarKey: 'year', value: String(eight.getYear()) },
        { pillarKey: 'month', value: String(eight.getMonth()) },
        { pillarKey: 'day', value: String(eight.getDay()) },
        ...(!form.timeUnknown ? [{ pillarKey: 'hour', value: String(eight.getTime()) }] : [])
    ]

    if (pillars.some(p => p.value.length < 2)) {
        throw new Error(t('five.errors.pillarsIncomplete'))
    }

    const scores = { WOOD: 0, FIRE: 0, EARTH: 0, GOLD: 0, WATER: 0 }
    const detail = []

    pillars.forEach(pillar => {
        const chars = [...pillar.value]
        const stem = chars[0]
        const branch = chars[1]
        const stemElement = getStemElementKey(stem)
        if (stemElement) scores[stemElement] += 1

        const hiddenList = HIDDEN_STEM_WEIGHTS_BY_BRANCH[branch] || []
        hiddenList.forEach(([hidden, weight]) => {
            const hiddenEl = getStemElementKey(hidden)
            if (hiddenEl) scores[hiddenEl] += weight
        })

        detail.push({
            ...pillar,
            stemElement,
            branch,
            hidden: hiddenList.map(x => x[0]).join('、')
        })
    })

    const total = Object.values(scores).reduce((a, b) => a + b, 0)
    const missingElements = ELEMENTS.filter(el => scores[el.key] === 0)
    const missing = missingElements.map(el => el.name)
    const missingKeys = missingElements.map(el => el.key)

    return {
        pillars: detail,
        scores,
        total,
        missing,
        missingKeys,
        dayMaster: String(eight.getDay()).charAt(0),
        solarText: solar.toYmdHms(),
        timeUnknown: form.timeUnknown,
        pillarCount: pillars.length
    }
}

export function getTargetElements(result) {
    if (!result) return []
    const ranked = [...ELEMENTS].sort((a, b) => (result.scores[a.key] || 0) - (result.scores[b.key] || 0))
    const missing = ranked.filter(el => (result.scores[el.key] || 0) === 0)
    const chosen = missing.slice(0, 3)
    for (const el of ranked) {
        if (chosen.length >= 2) break
        if (!chosen.some(item => item.key === el.key)) chosen.push(el)
    }
    return chosen.slice(0, 3)
}

export function buildRecommendationPayload(result, products) {
    if (!result) return null
    const missing = result.missing
    const targets = getTargetElements(result)
    return {
        missingNames: [...missing],
        targetKeys: targets.map(el => el.key),
        targetNames: targets.map(el => el.name),
        groups: targets.map(el => ({
            key: el.key,
            name: el.name,
            color: el.color,
            missing: missing.includes(el.name),
            products: products.filter(p => p.elementType === el.key).slice(0, 4)
        }))
    }
}