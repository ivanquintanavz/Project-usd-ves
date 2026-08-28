document.addEventListener('DOMContentLoaded', () => {
    const bcvInput = document.getElementById('bcv-rate');
    const p2pInput = document.getElementById('p2p-rate');
    const eurInput = document.getElementById('eur-rate');
    const amountInput = document.getElementById('amount');
    const amountLabel = document.getElementById('amount-label');
    const amountSymbol = document.getElementById('amount-symbol');
    const resBcv = document.getElementById('res-bcv');
    const resP2p = document.getElementById('res-p2p');
    const diffAmount = document.getElementById('diff-amount');
    const diffPercent = document.getElementById('diff-percent');
    const diffText = document.getElementById('diff-text');
    const tabs = document.querySelectorAll('.tab-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const fetchRatesBtn = document.getElementById('fetch-rates-btn');

    let mode = 'usd-to-ves';

    if (localStorage.getItem('bcvRate')) bcvInput.value = localStorage.getItem('bcvRate');
    if (localStorage.getItem('p2pRate')) p2pInput.value = localStorage.getItem('p2pRate');
    if (localStorage.getItem('eurRate')) eurInput.value = localStorage.getItem('eurRate');
    if (localStorage.getItem('appTheme') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.innerHTML = '<ion-icon name="sunny"></ion-icon>';
    }

    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('appTheme', 'light');
            themeToggle.innerHTML = '<ion-icon name="moon"></ion-icon>';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('appTheme', 'dark');
            themeToggle.innerHTML = '<ion-icon name="sunny"></ion-icon>';
        }
    });

    async function fetchRates(isManual = false) {
        const icon = fetchRatesBtn.querySelector('ion-icon');
        icon.name = 'sync-circle';
        fetchRatesBtn.style.animation = 'pulse 1s infinite';

        try {
            const [dolarResult, p2pResult] = await Promise.allSettled([
                fetch('https://ve.dolarapi.com/v1/dolares').then(r => r.json()),
                fetch('/api/binance-rate').then(r => r.json())
            ]);

            let bcvUsd = 0;

            if (dolarResult.status === 'fulfilled') {
                const bcvEntry = dolarResult.value.find(d => d.fuente === 'oficial');
                if (bcvEntry?.promedio) {
                    bcvInput.value = bcvEntry.promedio;
                    bcvUsd = bcvEntry.promedio;
                    localStorage.setItem('bcvRate', bcvEntry.promedio);
                }
            }

            if (p2pResult.status === 'fulfilled' && p2pResult.value.p2p) {
                p2pInput.value = p2pResult.value.p2p;
                localStorage.setItem('p2pRate', p2pResult.value.p2p);
            } else {
                console.warn('P2P no disponible:', p2pResult.reason || p2pResult.value);
                if (isManual) alert('No se pudo obtener la tasa de Binance. Revisa tu conexión.');
            }

            // Fetch EUR rate: try dolarapi first, then frankfurter as fallback
            try {
                const eurRes = await fetch('https://ve.dolarapi.com/v1/euros');
                if (eurRes.ok) {
                    const eurData = await eurRes.json();
                    const oficial = Array.isArray(eurData)
                        ? eurData.find(d => d.fuente === 'oficial')
                        : null;
                    const eurRate = oficial?.promedio;
                    if (eurRate) {
                        eurInput.value = eurRate;
                        localStorage.setItem('eurRate', eurRate);
                    } else {
                        throw new Error('sin dato oficial');
                    }
                } else {
                    throw new Error('dolarapi euros no disponible');
                }
            } catch (_) {
                // Fallback: frankfurter.app EUR/USD × BCV
                if (bcvUsd > 0) {
                    try {
                        const fxRes = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD');
                        const fxData = await fxRes.json();
                        const eurUsd = fxData?.rates?.USD;
                        if (eurUsd) {
                            const eurRate = Math.round(bcvUsd * eurUsd * 100) / 100;
                            eurInput.value = eurRate;
                            localStorage.setItem('eurRate', eurRate);
                        }
                    } catch (e) {
                        console.warn('No se pudo obtener tasa EUR:', e);
                    }
                }
            }

            calculate();
        } catch (error) {
            console.error('Error al cargar tasas:', error);
        } finally {
            icon.name = 'sync';
            fetchRatesBtn.style.animation = 'none';
        }
    }

    const tabLabels = {
        'usd-to-ves': { label: 'Monto en Dólares (USD)', symbol: '$' },
        'ves-to-usd': { label: 'Monto en Bolívares (VES)', symbol: 'Bs.' },
        'eur-to-ves': { label: 'Monto en Euros (EUR)', symbol: '€' },
        'ves-to-eur': { label: 'Monto en Bolívares (VES)', symbol: 'Bs.' },
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            mode = tab.dataset.type;
            const { label, symbol } = tabLabels[mode];
            amountLabel.textContent = label;
            amountSymbol.textContent = symbol;
            calculate();
        });
    });

    fetchRatesBtn.addEventListener('click', () => fetchRates(true));

    [bcvInput, p2pInput, eurInput, amountInput].forEach(input => {
        input.addEventListener('input', () => {
            if (input.id === 'bcv-rate') localStorage.setItem('bcvRate', input.value);
            if (input.id === 'p2p-rate') localStorage.setItem('p2pRate', input.value);
            if (input.id === 'eur-rate') localStorage.setItem('eurRate', input.value);
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
        const eur = parseFloat(eurInput.value) || 0;
        const amount = parseFloat(amountInput.value) || 0;

        const isEurMode = mode === 'eur-to-ves' || mode === 'ves-to-eur';
        const isToVes = mode === 'usd-to-ves' || mode === 'eur-to-ves';

        // EUR parallel rate estimated from USD parallel premium
        const eurP2p = (bcv > 0 && p2p > 0 && eur > 0)
            ? Math.round(eur * (p2p / bcv) * 100) / 100
            : 0;

        const rateA = isEurMode ? eur : bcv;
        const rateB = isEurMode ? eurP2p : p2p;
        const currencyOut = isToVes ? 'Bs.' : (isEurMode ? '€' : '$');

        if (rateA <= 0 || rateB <= 0 || amount <= 0) {
            resBcv.textContent = `0,00 ${currencyOut}`;
            resP2p.textContent = `0,00 ${currencyOut}`;
            diffAmount.textContent = `+0,00 ${currencyOut}`;
            diffPercent.textContent = '0.00%';
            diffPercent.className = 'diff-percentage';
            diffText.textContent = isEurMode && eur <= 0
                ? 'Actualiza las tasas para obtener el tipo de cambio EUR.'
                : 'Ingresa las tasas y el monto para calcular.';
            return;
        }

        let valBcv, valP2p, diff, percent;

        if (isToVes) {
            valBcv = amount * rateA;
            valP2p = amount * rateB;
            diff = valP2p - valBcv;
            percent = (diff / valBcv) * 100;
        } else {
            valBcv = amount / rateA;
            valP2p = amount / rateB;
            diff = valBcv - valP2p;
            percent = (diff / valP2p) * 100;
        }

        resBcv.textContent = formatCurrency(valBcv, currencyOut);
        resP2p.textContent = formatCurrency(valP2p, currencyOut);
        diffAmount.textContent = (diff > 0 ? '+' : '') + formatCurrency(diff, currencyOut);
        diffPercent.textContent = (diff > 0 ? '+' : '') + percent.toFixed(2) + '%';

        if (diff > 0) {
            diffPercent.className = 'diff-percentage positive';
            diffText.textContent = isToVes
                ? `Cambiar en P2P te genera ${formatCurrency(Math.abs(diff), 'Bs.')} más.`
                : `Comprar al BCV te rinde ${formatCurrency(Math.abs(diff), currencyOut)} más.`;
        } else if (diff < 0) {
            diffPercent.className = 'diff-percentage negative';
            diffText.textContent = isToVes
                ? `Cambiar en P2P te genera ${formatCurrency(Math.abs(diff), 'Bs.')} menos.`
                : `Comprar al P2P te rinde ${formatCurrency(Math.abs(diff), currencyOut)} más.`;
        } else {
            diffPercent.className = 'diff-percentage';
            diffText.textContent = 'Las tasas son iguales.';
        }
    }

    calculate();
    fetchRates();
});
