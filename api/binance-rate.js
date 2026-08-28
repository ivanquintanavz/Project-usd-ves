const P2P_URL = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search'
const THRESHOLDS_VES = [100_000, 300_000, 800_000]

const BASE_BODY = {
  fiat: 'VES', asset: 'USDT', page: 1, rows: 20,
  countries: [], proMerchantAds: false, shieldMerchantAds: false,
  filterType: 'all', periods: [], additionalKycVerifyFilter: 0,
  publisherType: null, payTypes: [],
  classifies: ['mass', 'profession', 'fiat_trade'],
}

async function fetchAds(tradeType) {
  const r = await fetch(P2P_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...BASE_BODY, tradeType }),
  })
  const json = await r.json()
  return json?.data ?? []
}

function filterPrices(ads, maxMinVES) {
  return ads
    .filter(a => parseFloat(a.adv.minSingleTransAmount) <= maxMinVES)
    .map(a => parseFloat(a.adv.price))
    .filter(p => !isNaN(p))
}

function median(sorted) {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const [buyAds, sellAds] = await Promise.all([
      fetchAds('BUY'),
      fetchAds('SELL'),
    ])

    let prices = []

    for (const threshold of THRESHOLDS_VES) {
      const buy = filterPrices(buyAds, threshold)
      const sell = filterPrices(sellAds, threshold)
      prices = [...buy, ...sell].sort((a, b) => a - b)
      if (prices.length >= 6) break
    }

    if (prices.length < 3) {
      const allBuy = buyAds.map(a => parseFloat(a.adv.price)).filter(p => !isNaN(p))
      const allSell = sellAds.map(a => parseFloat(a.adv.price)).filter(p => !isNaN(p))
      prices = [...allBuy, ...allSell].sort((a, b) => a - b)
    }

    if (prices.length === 0) {
      return res.status(404).json({ error: 'Sin anuncios disponibles' })
    }

    const trim = Math.floor(prices.length * 0.10)
    const trimmed = prices.slice(trim, prices.length - trim)
    const rate = Math.round(median(trimmed.length >= 3 ? trimmed : prices) * 100) / 100

    return res.json({ p2p: rate })
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}
