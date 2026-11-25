import { useState } from 'react'
import { isValidPhone } from '../utils/braceletGeometry'
import { useI18n } from '../i18n/I18nContext'

export default function SaveDesignModal({
                                            open,
                                            selectedCount,
                                            totalPrice,
                                            submitting,
                                            onClose,
                                            onNotify,
                                            onConfirm
                                        }) {
    const { t } = useI18n()
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')

    if (!open) return null

    function handleSubmit() {
        if (!selectedCount) {
            onNotify(t('messages.errNoAddFirst'))
            return
        }
        const trimmedName = name.trim()
        const trimmedPhone = phone.trim()
        if (!trimmedName) {
            onNotify(t('messages.errNameRequired'))
            return
        }
        if (!isValidPhone(trimmedPhone)) {
            onNotify(t('messages.errPhoneInvalid'))
            return
        }
        onConfirm({ name: trimmedName, phone: trimmedPhone })
    }

    return (
        <div
            className="checkout-mask"
            onClick={e => {
                if (e.target === e.currentTarget && !submitting) onClose()
            }}
        >
            <section className="checkout-panel" role="dialog" aria-modal="true" aria-labelledby="save-title">
                <button
                    className="checkout-close"
                    type="button"
                    aria-label={t('common.close')}
                    disabled={submitting}
                    onClick={onClose}
                >
                    ×
                </button>
                <h2 id="save-title">{t('saveModal.title')}</h2>
                <p>{t('saveModal.desc')}</p>
                <label>
                    {t('saveModal.labelName')}
                    <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        autoComplete="name"
                        placeholder={t('saveModal.placeholderName')}
                        maxLength={30}
                    />
                </label>
                <label>
                    {t('saveModal.labelPhone')}
                    <input
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        autoComplete="tel"
                        inputMode="tel"
                        maxLength={20}
                        placeholder={t('saveModal.placeholderPhone')}
                    />
                </label>
                <div className="checkout-total">
                    <span>{t('saveModal.currentDesignLabel')}</span>
                    <b>{t('saveModal.currentDesignSummary', { count: selectedCount, price: totalPrice.toFixed(2) })}</b>
                </div>
                <button
                    type="button"
                    className="checkout-button"
                    disabled={submitting}
                    onClick={handleSubmit}
                >
                    {submitting ? t('saveModal.btnSaving') : t('saveModal.btnConfirm')}
                </button>
            </section>
        </div>
    )
}