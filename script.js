// Global storage for reviews
let allFetchedReviews = [];

// --- Theme Logic ---
function toggleTheme() {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    } else {
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
}

// Init theme immediately
(function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
    } else {
        document.documentElement.classList.add('dark');
    }
})();

// --- Custom Dropdown Logic ---
const countryOptions = [
    { code: 'auto', name: 'Auto (URL)', flag: null },
    { code: 'au', name: 'Australia', flag: 'au' },
    { code: 'br', name: 'Brazil', flag: 'br' },
    { code: 'ca', name: 'Canada', flag: 'ca' },
    { code: 'cn', name: 'China', flag: 'cn' },
    { code: 'fr', name: 'France', flag: 'fr' },
    { code: 'de', name: 'Germany', flag: 'de' },
    { code: 'it', name: 'Italy', flag: 'it' },
    { code: 'jp', name: 'Japan', flag: 'jp' },
    { code: 'pl', name: 'Poland', flag: 'pl' },
    { code: 'es', name: 'Spain', flag: 'es' },
    { code: 'gb', name: 'United Kingdom', flag: 'gb' },
    { code: 'us', name: 'United States', flag: 'us' },
];

function initCustomSelect() {
    const optionsContainer = document.getElementById('customSelectOptions');

    countryOptions.forEach(opt => {
        const div = document.createElement('div');
        div.className = "px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-3 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0";

        let iconHtml = opt.code === 'auto'
            ? `<span class="text-lg">🌍</span>`
            : `<img src="https://flagcdn.com/w40/${opt.flag}.png" alt="${opt.code}" class="w-6 h-auto rounded-sm shadow-sm">`;

        div.innerHTML = `
            ${iconHtml}
            <span class="text-sm font-medium text-slate-700 dark:text-slate-200">${opt.name}</span>
        `;

        div.onclick = () => selectCountry(opt);
        optionsContainer.appendChild(div);
    });

    document.addEventListener('click', (e) => {
        const trigger = document.getElementById('customSelectTrigger');
        const options = document.getElementById('customSelectOptions');
        if (!trigger.contains(e.target) && !options.contains(e.target)) {
            options.classList.add('hidden');
            document.getElementById('selectArrow').classList.remove('rotate-180');
        }
    });
}

function toggleCustomSelect() {
    const opts = document.getElementById('customSelectOptions');
    const arrow = document.getElementById('selectArrow');
    opts.classList.toggle('hidden');
    arrow.classList.toggle('rotate-180');
}

function selectCountry(opt) {
    document.getElementById('countrySelect').value = opt.code;

    const flagSpan = document.getElementById('selectedFlag');
    const textSpan = document.getElementById('selectedText');

    if (opt.code === 'auto') {
        flagSpan.innerHTML = '🌍';
    } else {
        flagSpan.innerHTML = `<img src="https://flagcdn.com/w40/${opt.flag}.png" alt="${opt.code}" class="w-6 h-auto rounded-sm shadow-sm">`;
    }
    textSpan.textContent = opt.name;

    document.getElementById('customSelectOptions').classList.add('hidden');
    document.getElementById('selectArrow').classList.remove('rotate-180');
}

// Initialize Logic
initCustomSelect();

// --- Extractor Logic ---

function updateLimitDisplay(val) {
    document.getElementById('limitValueDisplay').innerText = val;
    if (allFetchedReviews.length > 0) {
        renderTable();
    }
}

async function fetchReviews() {
    const urlInput = document.getElementById('urlInput').value.trim();
    const countrySelect = document.getElementById('countrySelect').value;

    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');
    const fetchBtn = document.getElementById('fetchBtn');
    const errorContainer = document.getElementById('errorContainer');
    const errorMsg = document.getElementById('errorMsg');
    const resultsContainer = document.getElementById('resultsContainer');

    // Reset UI
    errorContainer.classList.add('hidden');
    resultsContainer.classList.add('hidden');
    allFetchedReviews = [];

    if (!urlInput) {
        showError("Please enter a valid App Store URL.");
        return;
    }

    const idMatch = urlInput.match(/id(\d+)/);
    if (!idMatch) {
        showError("Could not find an App ID in the link. Look for 'id' followed by numbers.");
        return;
    }
    const appId = idMatch[1];

    let country = 'us';
    if (countrySelect !== 'auto') {
        country = countrySelect;
    } else {
        const countryMatch = urlInput.match(/apps\.apple\.com\/([a-z]{2})\//);
        if (countryMatch) {
            country = countryMatch[1];
        }
    }

    // Set Loading State
    fetchBtn.disabled = true;
    btnText.textContent = "Fetching...";
    fetchBtn.classList.add('opacity-75', 'cursor-not-allowed');
    btnLoader.classList.remove('hidden');

    try {
        const rssUrl = `https://itunes.apple.com/${country}/rss/customerreviews/id=${appId}/sortBy=mostRecent/json`;

        let response;
        try {
            const proxyUrl1 = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`;
            response = await fetch(proxyUrl1);
            if (!response.ok) throw new Error('Proxy 1 failed');
        } catch (e1) {
            console.warn("Primary proxy failed, trying backup...", e1);
            try {
                const proxyUrl2 = `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`;
                response = await fetch(proxyUrl2);
                if (!response.ok) throw new Error('Proxy 2 failed');
            } catch (e2) {
                throw new Error(`Failed to fetch reviews. Both proxy servers are unreachable or the app ID is invalid. Check your internet connection.`);
            }
        }

        const textData = await response.text();
        let data;
        try {
            data = JSON.parse(textData);
        } catch (e) {
            throw new Error("Invalid response received. There might be no reviews for this country.");
        }

        if (!data.feed || !data.feed.entry) {
            showError(`No reviews found for country code: ${country.toUpperCase()}. Try switching to US.`);
            resetBtn();
            return;
        }

        allFetchedReviews = Array.isArray(data.feed.entry) ? data.feed.entry : [data.feed.entry];

        renderTable();

    } catch (err) {
        console.error(err);
        showError(err.message);
    } finally {
        resetBtn();
    }
}

function renderTable() {
    const tbody = document.querySelector('#reviewsTable tbody');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsCount = document.getElementById('resultsCount');
    const limit = parseInt(document.getElementById('limitRange').value);

    tbody.innerHTML = '';

    const entriesToRender = allFetchedReviews.slice(0, limit);

    entriesToRender.forEach(entry => {
        const updatedRaw = entry.updated ? entry.updated.label : null;
        const dateObj = updatedRaw ? new Date(updatedRaw) : new Date();
        const timestamp = dateObj.getTime();

        const dateStr = dateObj.toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric'
        });

        const rating = entry['im:rating'] ? parseInt(entry['im:rating'].label) : 0;
        const version = entry['im:version'] ? entry['im:version'].label : '-';
        const author = entry.author ? entry.author.name.label : 'Anonymous';
        const title = entry.title ? entry.title.label : '';
        const content = entry.content ? entry.content.label : '';

        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                starsHtml += `<span class="text-yellow-400">★</span>`;
            } else {
                starsHtml += `<span class="text-slate-300 dark:text-slate-600">★</span>`;
            }
        }

        const row = `
            <tr class="hover:bg-slate-50 dark:hover:bg-white/5 transition border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td class="p-5 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono" data-value="${timestamp}">${dateStr}</td>
                <td class="p-5 text-xs text-slate-400 dark:text-slate-500 font-mono" data-value="${version}">${version}</td>
                <td class="p-5 whitespace-nowrap text-lg leading-none" data-value="${rating}">${starsHtml}</td>
                <td class="p-5 text-sm font-medium text-slate-700 dark:text-slate-200">${author}</td>
                <td class="p-5 max-w-xl">
                    <div class="font-bold text-slate-800 dark:text-white mb-1 text-sm">${title}</div>
                    <div class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">${content}</div>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });

    resultsCount.textContent = entriesToRender.length;
    resultsContainer.classList.remove('hidden');

    document.querySelectorAll('.sort-icon').forEach(icon => icon.textContent = '↕');
}

// --- Sorting Logic ---
let sortDirection = 'asc';
let lastSortedColumn = -1;

function sortTable(n, type) {
    const table = document.getElementById("reviewsTable");
    let rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;
    switching = true;
    dir = "asc";

    if (lastSortedColumn === n) {
        dir = sortDirection === 'asc' ? 'desc' : 'asc';
    }
    sortDirection = dir;
    lastSortedColumn = n;

    document.querySelectorAll('.sort-icon').forEach(icon => icon.textContent = '↕');
    const currentHeader = table.rows[0].getElementsByTagName("TH")[n];
    currentHeader.querySelector('.sort-icon').textContent = dir === 'asc' ? '↑' : '↓';

    while (switching) {
        switching = false;
        rows = table.rows;
        for (i = 1; i < (rows.length - 1); i++) {
            shouldSwitch = false;
            x = rows[i].getElementsByTagName("TD")[n];
            y = rows[i + 1].getElementsByTagName("TD")[n];

            let xVal = x.getAttribute('data-value') || x.textContent.toLowerCase();
            let yVal = y.getAttribute('data-value') || y.textContent.toLowerCase();

            if (type === 'number' || type === 'date') {
                xVal = parseFloat(xVal);
                yVal = parseFloat(yVal);
            }

            if (dir === "asc") {
                if (xVal > yVal) {
                    shouldSwitch = true;
                    break;
                }
            } else if (dir === "desc") {
                if (xVal < yVal) {
                    shouldSwitch = true;
                    break;
                }
            }
        }
        if (shouldSwitch) {
            rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
            switching = true;
            switchcount++;
        }
    }
}

function resetBtn() {
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');
    const fetchBtn = document.getElementById('fetchBtn');

    fetchBtn.disabled = false;
    fetchBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    btnText.textContent = "Analyze";
    btnLoader.classList.add('hidden');
}

function showError(msg) {
    const errorContainer = document.getElementById('errorContainer');
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.textContent = msg;
    errorContainer.classList.remove('hidden');
}

function showToast() {
    const toast = document.getElementById('toast');
    toast.classList.remove('translate-y-24', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-24', 'opacity-0');
    }, 3000);
}

function copyTable() {
    const table = document.getElementById('reviewsTable');
    const range = document.createRange();
    range.selectNode(table);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    try {
        document.execCommand('copy');
        showToast();
    } catch (err) {
        console.error('Copy failed', err);
    }
    selection.removeAllRanges();
}