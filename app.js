document.addEventListener('DOMContentLoaded', () => {
    const bcvInput = document.getElementById('bcv-rate');
    const p2pInput = document.getElementById('p2p-rate');
    const amountInput = document.getElementById('amount');
    const amountLabel = document.getElementById('amount-label');
    const amountSymbol = document.getElementById('amount-symbol');
    const resBcv = document.getElementById('res-bcv');
    const resP2p = document.getElementById('res-p2p');
    const diffAmount = document.getElementById('diff-amount');
    const diffPercent = document.getElementById('diff-percent');
    const diffText = document.getElementById('diff-text');
    const p2pSourceTag = document.getElementById('p2p-source');
    const tabs = document.querySelectorAll('.tab-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const fetchRatesBtn = document.getElementById('fetch-rates-btn');

    let mode = 'usd-to-ves';

    if (localStorage.getItem('bcvRate')) bcvInput.value = localStorage.getItem('bcvRate');
    if (localStorage.getItem('p2pRate')) p2pInput.value = localStorage.getItem('p2pRate');
    if (localStorage.getItem('appTheme') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.innerHTML = '<ion-icon name="sunny"></ion-icon>';
    }

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme === 'dark') {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('appTheme', 'light');
            themeToggle.innerHTML = '<ion-icon name="moon"></ion-icon>';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('appTheme', 'dark');
            themeToggle.innerHTML = '<ion-icon name="sunny"></ion-icon>';
        }
    });

    function median(arr) {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }

    // Obtiene la mediana del P2P de Binance (anuncios de venta USDT/VES)
    async function fetchBinanceP2P() {
        const targetUrl = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

        const body = JSON.stringify({
            fiat: 'VES',
            page: 1,
            rows: 20,
            tradeType: 'SELL',
            asset: 'USDT',
            countries: [],
            proMerchantAds: false,
            shieldMerchantAds: false,
            filterType: 'all',
            periods: [],
            additionalKycVerifyFilter: 0,
            publisherType: null,
            payTypes: [],
            classifies: ['mass', 'profession', 'fiat_merchant']
        });

        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-requested-with': 'XMLHttpRequest'
            },
            body
        });

        const data = await response.json();
        if (!data.data || data.data.length === 0) throw new Error('Sin datos Binance P2P');

        const prices = data.data.map(ad => parseFloat(ad.adv.price));
        return Math.round(median(prices) * 100) / 100;
    }

    // Obtiene BCV y paralelo desde DolarAPI (fuente de respaldo para P2P)
    async function fetchDolarAPI() {
        const response = await fetch('https://ve.dolarapi.com/v1/dolares');
        const data = await response.json();
        const bcvData = data.find(d => d.fuente === 'oficial');
        const p2pData = data.find(d => d.fuente === 'paralelo');
        return {
            bcv: bcvData?.promedio ?? null,
            p2p: p2pData?.promedio ?? null
        };
    }

    async function fetchRates(isManual = false) {
        const icon = fetchRatesBtn.querySelector('ion-icon');
        icon.name = 'sync-circle';
        fetchRatesBtn.style.animation = 'pulse 1s infinite';

        try {
            const [dolarResult, binanceResult] = await Promise.allSettled([
                fetchDolarAPI(),
                fetchBinanceP2P()
            ]);

            if (dolarResult.status === 'fulfilled' && dolarResult.value.bcv) {
                bcvInput.value = dolarResult.value.bcv;
                localStorage.setItem('bcvRate', dolarResult.value.bcv);
            }

            if (binanceResult.status === 'fulfilled') {
                p2pInput.value = binanceResult.value;
                localStorage.setItem('p2pRate', binanceResult.value);
                if (p2pSourceTag) p2pSourceTag.textContent = '· Binance mediana';
            } else if (dolarResult.status === 'fulfilled' && dolarResult.value.p2p) {
                p2pInput.value = dolarResult.value.p2p;
                localStorage.setItem('p2pRate', dolarResult.value.p2p);
                if (p2pSourceTag) p2pSourceTag.textContent = '· DolarAPI';
            }

            calculate();
        } catch (error) {
            console.error('Error al descargar tasas:', error);
            if (isManual) {
                alert('Hubo un error al descargar las tasas. Revisa tu conexión a internet.');
            }
        } finally {
            icon.name = 'sync';
            fetchRatesBtn.style.animation = 'none';
        }
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            mode = tab.dataset.type;

            if (mode === 'usd-to-ves') {
                amountLabel.textContent = 'Monto en Dólares (USD)';
                amountSymbol.textContent = '$';
            } else {
                amountLabel.textContent = 'Monto en Bolívares (VES)';
                amountSymbol.textContent = 'Bs.';
            }

            calculate();
        });
    });

    fetchRatesBtn.addEventListener('click', () => fetchRates(true));

    [bcvInput, p2pInput, amountInput].forEach(input => {
        input.addEventListener('input', () => {
            if (input.id === 'bcv-rate') localStorage.setItem('bcvRate', input.value);
            if (input.id === 'p2p-rate') localStorage.setItem('p2pRate', input.value);
            calculate();
        });
    });

    function formatCurrency(value, currency = 'Bs.') {
        return new Intl.NumberFormat('es-VE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value) + ' ' + currency;
    }

    function calculate() {
        const bcv = parseFloat(bcvInput.value) || 0;
        const p2p = parseFloat(p2pInput.value) || 0;
        const amount = parseFloat(amountInput.value) || 0;

        if (bcv <= 0 || p2p <= 0 || amount <= 0) {
            resBcv.textContent = mode === 'usd-to-ves' ? '0,00 Bs.' : '0,00 $';
            resP2p.textContent = mode === 'usd-to-ves' ? '0,00 Bs.' : '0,00 $';
            diffAmount.textContent = mode === 'usd-to-ves' ? '+0,00 Bs.' : '+0,00 $';
            diffPercent.textContent = '0.00%';
            diffPercent.className = 'diff-percentage';
            diffText.textContent = 'Ingresa las tasas y el monto para calcular.';
            return;
        }

        if (mode === 'usd-to-ves') {
            const valBcv = amount * bcv;
            const valP2p = amount * p2p;
            const diff = valP2p - valBcv;
            const percent = (diff / valBcv) * 100;

            resBcv.textContent = formatCurrency(valBcv, 'Bs.');
            resP2p.textContent = formatCurrency(valP2p, 'Bs.');
            diffAmount.textContent = (diff > 0 ? '+' : '') + formatCurrency(diff, 'Bs.');
            diffPercent.textContent = (diff > 0 ? '+' : '') + percent.toFixed(2) + '%';

            if (diff > 0) {
                diffPercent.className = 'diff-percentage positive';
                diffText.textContent = `Cambiar en P2P te genera ${formatCurrency(Math.abs(diff), 'Bs.')} más.`;
            } else if (diff < 0) {
                diffPercent.className = 'diff-percentage negative';
                diffText.textContent = `Cambiar en P2P te genera ${formatCurrency(Math.abs(diff), 'Bs.')} menos.`;
            } else {
                diffPercent.className = 'diff-percentage';
                diffText.textContent = 'Las tasas son iguales.';
            }
        } else {
            const valBcv = amount / bcv;
            const valP2p = amount / p2p;
            const diff = valBcv - valP2p;
            const percent = (diff / valP2p) * 100;

            resBcv.textContent = formatCurrency(valBcv, '$');
            resP2p.textContent = formatCurrency(valP2p, '$');
            diffAmount.textContent = (diff > 0 ? '+' : '') + formatCurrency(diff, '$');
            diffPercent.textContent = (diff > 0 ? '+' : '') + percent.toFixed(2) + '%';

            if (diff > 0) {
                diffPercent.className = 'diff-percentage positive';
                diffText.textContent = `Comprar al BCV te rinde ${formatCurrency(Math.abs(diff), '$')} más.`;
            } else if (diff < 0) {
                diffPercent.className = 'diff-percentage negative';
                diffText.textContent = `Comprar al P2P te rinde ${formatCurrency(Math.abs(diff), '$')} más.`;
            } else {
                diffPercent.className = 'diff-percentage';
                diffText.textContent = 'Ambas tasas te dan la misma cantidad de dólares.';
            }
        }
    }

    calculate();
    fetchRates();
});
