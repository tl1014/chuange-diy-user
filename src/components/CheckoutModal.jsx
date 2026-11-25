import { useState } from 'react'
import { isValidPhone } from '../utils/braceletGeometry'
import { useI18n } from '../i18n/I18nContext'

export default function CheckoutModal({
                                          open,
                                          selectedCount,
                                          selectedSummary,
                                          totalPrice,
                                          submitting,
                                          onClose,
                                          onNotify,
                                          onConfirm
                                      }) {
    const { t } = useI18n()
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [address, setAddress] = useState('')

    if (!open) return null

    function handleSubmit() {
        if (submitting) return
        const trimmedName = name.trim()
        const trimmedPhone = phone.trim()
        const trimmedAddress = address.trim()
        if (!trimmedName) {
            onNotify(t('messages.errRecipientRequired'))
            return
        }
        if (!isValidPhone(trimmedPhone)) {
            onNotify(t('messages.errPhoneInvalid'))
            return
        }
        if (!trimmedAddress) {
            onNotify(t('messages.errAddressRequired'))
            return
        }
        onConfirm({ name: trimmedName, phone: trimmedPhone, address: trimmedAddress })
    }

    return (
        <div
            className="checkout-mask"
            onClick={e => {
                if (e.target === e.currentTarget && !submitting) onClose()
            }}
        >
            <section className="checkout-panel" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
                <button
                    className="checkout-close"
                    type="button"
                    aria-label={t('checkoutModal.closeAria')}
                    disabled={submitting}
                    onClick={onClose}
                >
                    ×
                </button>
                <h2 id="checkout-title">{t('checkoutModal.title')}</h2>
                <p>{t('checkoutModal.desc')}</p>
                <label>
                    {t('checkoutModal.labelRecipient')}
                    <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        autoComplete="name"
                        maxLength={30}
                        required
                        placeholder={t('saveModal.placeholderName')}
                    />
                </label>
                <label>
                    {t('checkoutModal.labelPhone')}
                    <input
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        autoComplete="tel"
                        inputMode="tel"
                        maxLength={20}
                        required
                        placeholder={t('saveModal.placeholderPhone')}
                    />
                </label>
                <label>
                    {t('checkoutModal.labelAddress')}
                    <textarea
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        autoComplete="street-address"
                        maxLength={200}
                        required
                        placeholder={t('checkoutModal.placeholderAddress')}
                    />
                </label>
                <div className="order-review">
                    <b>{t('checkoutModal.reviewTitle')}</b>
                    {selectedSummary.map(item => (
                        <div key={item.productId} className="order-review-row">
              <span>
                {item.name} <small>× {item.quantity}</small>
              </span>
                            <strong>¥{item.subtotal.toFixed(2)}</strong>
                        </div>
                    ))}
                </div>
                <div className="checkout-total">
                    <span>{t('checkoutModal.totalCount', { count: selectedCount })}</span>
                    <b>¥{totalPrice.toFixed(2)}</b>
                </div>
                <button
                    type="button"
                    className="checkout-button"
                    disabled={submitting}
                    onClick={handleSubmit}
                >
                    {submitting ? t('checkoutModal.btnSubmitting') : t('checkoutModal.btnConfirm')}
                </button>
            </section>
        </div>
    )
}