document.addEventListener('DOMContentLoaded', () => {
    // Elements
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

    const tabs = document.querySelectorAll('.tab-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const fetchRatesBtn = document.getElementById('fetch-rates-btn');

    let mode = 'usd-to-ves'; // default mode

    // Load saved rates from localStorage
    if (localStorage.getItem('bcvRate')) bcvInput.value = localStorage.getItem('bcvRate');
    if (localStorage.getItem('p2pRate')) p2pInput.value = localStorage.getItem('p2pRate');
    if (localStorage.getItem('appTheme') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.innerHTML = '<ion-icon name="sunny"></ion-icon>';
    }

    // Theme Toggle
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

    async function fetchRates(isManual = false) {
        const icon = fetchRatesBtn.querySelector('ion-icon');
        icon.name = 'sync-circle';
        fetchRatesBtn.style.animation = 'pulse 1s infinite';

        try {
            const response = await fetch('https://ve.dolarapi.com/v1/dolares');
            const data = await response.json();

            const bcvData = data.find(d => d.fuente === 'oficial');
            const p2pData = data.find(d => d.fuente === 'paralelo'); // Usamos Paralelo como referencia de mercado libre/P2P

            if (bcvData) {
                bcvInput.value = bcvData.promedio;
                localStorage.setItem('bcvRate', bcvData.promedio);
            }
            if (p2pData) {
                p2pInput.value = p2pData.promedio;
                localStorage.setItem('p2pRate', p2pData.promedio);
            }

            calculate();
        } catch (error) {
            console.error('Error fetching rates:', error);
            if (isManual) {
                alert('Hubo un error al descargar las tasas. Revisa tu conexión a internet.');
            }
        } finally {
            icon.name = 'sync';
            fetchRatesBtn.style.animation = 'none';
        }
    }

    // Tab Switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            mode = tab.dataset.type;

            // Update Labels
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

    // Fetch Rates Online Manually
    fetchRatesBtn.addEventListener('click', () => fetchRates(true));

    // Event Listeners for Calculation
    [bcvInput, p2pInput, amountInput].forEach(input => {
        input.addEventListener('input', () => {
            if (input.id === 'bcv-rate') localStorage.setItem('bcvRate', input.value);
            if (input.id === 'p2p-rate') localStorage.setItem('p2pRate', input.value);
            calculate();
        });
    });

    // Formatting Function
    function formatCurrency(value, currency = 'Bs.') {
        return new Intl.NumberFormat('es-VE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value) + ' ' + currency;
    }

    // Calculate Logic
    function calculate() {
        const bcv = parseFloat(bcvInput.value) || 0;
        const p2p = parseFloat(p2pInput.value) || 0;
        const amount = parseFloat(amountInput.value) || 0;

        // Reset if missing inputs
        if (bcv <= 0 || p2p <= 0 || amount <= 0) {
            resBcv.textContent = mode === 'usd-to-ves' ? '0,00 Bs.' : '0,00 $';
            resP2p.textContent = mode === 'usd-to-ves' ? '0,00 Bs.' : '0,00 $';
            diffAmount.textContent = mode === 'usd-to-ves' ? '+0,00 Bs.' : '+0,00 $';
            diffPercent.textContent = '0.00%';
            diffPercent.className = 'diff-percentage';
            diffText.textContent = 'Ingresa las tasas y el monto para calcular.';
            return;
        }

        let valBcv = 0;
        let valP2p = 0;
        let diff = 0;
        let percent = 0;
        let currency = 'Bs.';

        if (mode === 'usd-to-ves') {
            // USD to Bolivares
            valBcv = amount * bcv;
            valP2p = amount * p2p;
            diff = valP2p - valBcv; // Usually P2P > BCV
            percent = (diff / valBcv) * 100;
            currency = 'Bs.';

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
            // Bolivares to USD
            valBcv = amount / bcv;
            valP2p = amount / p2p;
            diff = valBcv - valP2p; // Buying $ with VES: BCV gives more $ than P2P
            percent = (diff / valP2p) * 100;
            currency = '$';

            resBcv.textContent = formatCurrency(valBcv, '$');
            resP2p.textContent = formatCurrency(valP2p, '$');

            // Diff meaning: Using BCV you get MORE dollars
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

    // Initial calculation if localstorage has values
    calculate();

    // Actualizar automáticamente al abrir la app
    fetchRates();
});
