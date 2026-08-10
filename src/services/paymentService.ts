import { apiFetch } from './api'

export interface MidtransConfig {
  merchant_id?: string
  client_key: string
  is_production: boolean
  snap_url?: string
}

export interface SnapTokenResponse {
  token: string
  redirect_url: string
}

export async function createSnapToken(orderId: number): Promise<SnapTokenResponse> {
  const res = await apiFetch<{ message: string; data: SnapTokenResponse }>('/api/v1/payments/snap-token', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId }),
  })
  return res.data
}

export function loadSnapScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).snap) {
      resolve()
      return
    }
    const script = document.createElement('script')
    const snapUrl = import.meta.env.VITE_MIDTRANS_SNAP_URL ?? 'https://app.sandbox.midtrans.com/snap/snap.js'
    const clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY ?? ''
    script.src = snapUrl
    if (clientKey) {
      script.setAttribute('data-client-key', clientKey)
    }
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Gagal memuat script Midtrans Snap'))
    document.head.appendChild(script)
  })
}
