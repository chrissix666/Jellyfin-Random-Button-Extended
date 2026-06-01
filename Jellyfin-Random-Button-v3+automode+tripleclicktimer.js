(function () {
    'use strict';

    const FETCH_LIMIT = 50;
    const MAX_RETRIES = 15;
    const DEFAULT_INTERVAL_MS = 12000; // Standard 12s

    const MOVIES_PARENT_ID = 'pasteyouridhere';
    const TVSHOWS_PARENT_ID = 'pasteyouridhere';
    const COLLECTIONS_PARENT_ID = 'pasteyouridhere';
    const HOME1_PARENT_ID = 'pasteyouridhere';
    const HOME2_PARENT_ID = 'pasteyouridhere';

    let manualMode = true;
    let autoInterval = null;

    const getServerAddress = () => window.location.origin;

    /**********************
     * ICONS & CSS
     **********************/
    const injectMaterialIcons = () => {
        if (document.getElementById('material-icons-stylesheet')) return;
        const link = document.createElement('link');
        link.id = 'material-icons-stylesheet';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
        document.head.appendChild(link);
    };

    const injectCustomCss = () => {
        if (document.getElementById('random-movie-button-custom-css')) return;
        const style = document.createElement('style');
        style.id = 'random-movie-button-custom-css';
        style.innerHTML = `
        .random-movie-button .md-icon {
            font-family: 'Material Icons' !important;
            font-style: normal !important;
            font-size: 24px !important;
        }
        .timer-display {
            margin-left: 4px;
            font-weight: bold;
            font-size: 14px;
            vertical-align: middle;
        }
        button#randomMovieButton {
            padding: 0px !important;
            margin: 0px 5px 0 10px !important;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        @keyframes dice {
            0% { transform: rotate(0deg); }
            10% { transform: rotate(-15deg); }
            20% { transform: rotate(15deg); }
            30% { transform: rotate(-15deg); }
            40% { transform: rotate(15deg); }
            50% { transform: rotate(-15deg); }
            60% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .random-movie-button .rotating {
            animation: dice 1.2s linear infinite;
        }`;
        document.head.appendChild(style);
    };

    const getStandardIcon = () => manualMode ? 'casino' : 'hourglass_empty';
    const getFetchingIcon = () => manualMode ? 'hourglass_empty' : 'casino';
    const updateButtonIcon = (fetching = false) => {
        const btn = document.getElementById('randomMovieButton');
        if (!btn) return;

        const icon = fetching ? getFetchingIcon() : getStandardIcon();
        const iconElem = btn.querySelector('.md-icon');

        if (iconElem) {
            iconElem.textContent = icon;
            if (fetching) iconElem.classList.add('rotating');
            else iconElem.classList.remove('rotating');
        }
    };

    const setModeManual = () => {
        manualMode = true;
        if (autoInterval) {
            clearInterval(autoInterval);
            autoInterval = null;
        }
        updateButtonIcon();
    };

    const setModeAuto = () => {
        manualMode = false;
        updateButtonIcon();

        const interval = timerStates[currentTimerIndex] * 1000;
        fetchAndOpenRandom();
        if (autoInterval) clearInterval(autoInterval);
        autoInterval = setInterval(fetchAndOpenRandom, interval);
    };

    /**********************
     * HELPERS
     **********************/
    const getCurrentItemId = () => {
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.split('?')[1] || '');
        return params.get('id') || null;
    };

    const getCurrentLibraryParentId = () => {
        const hash = window.location.hash.toLowerCase();
        const params = new URLSearchParams(hash.split('?')[1] || '');
        let parentId = params.get('parentid') || params.get('topparentid');
        if (!parentId) {
            if (hash.includes('movies.html')) parentId = MOVIES_PARENT_ID;
            else if (hash.includes('tv.html')) parentId = TVSHOWS_PARENT_ID;
            else if (hash.includes('list.html')) parentId = COLLECTIONS_PARENT_ID;
        }
        return parentId || null;
    };

    const fetchCurrentItem = async (itemId) => {
        try {
            const userId = ApiClient.getCurrentUserId();
            if (!userId || !itemId) return null;
            const url = `${getServerAddress()}/Users/${userId}/Items/${itemId}?Fields=Type,SeriesId,ParentId`;
            return await ApiClient.ajax({ type: 'GET', url, dataType: 'json' });
        } catch { return null; }
    };

    const fetchRandomItem = async (parentId, attempt = 1, includeSets = false) => {
        try {
            const userId = ApiClient.getCurrentUserId();
            if (!userId) return null;
            const base = `${getServerAddress()}/Users/${userId}/Items`;
            const url = parentId
                ? `${base}?ParentId=${parentId}&Recursive=true&SortBy=Random&Limit=${FETCH_LIMIT}&Fields=Type,Name&_=${Date.now()}`
                : `${base}?Recursive=true&SortBy=Random&Limit=${FETCH_LIMIT}&Fields=Type,Name&_=${Date.now()}`;
            const { Items = [] } = await ApiClient.ajax({ type: 'GET', url, dataType: 'json' });

            let filtered;
            if (parentId === MOVIES_PARENT_ID) filtered = Items.filter(i => i.Type === 'Movie');
            else if (parentId === TVSHOWS_PARENT_ID) filtered = Items.filter(i => i.Type === 'Series');
            else if (parentId === COLLECTIONS_PARENT_ID && includeSets) filtered = Items.filter(i => i.Type === 'Set' || i.IsFolder);
            else if (parentId === HOME1_PARENT_ID || parentId === HOME2_PARENT_ID) filtered = Items.filter(i => i.Type === 'Video');
            else if (parentId) filtered = Items.filter(i => i.Type === 'Video');
            else filtered = Items.filter(i => ['Movie','Series'].includes(i.Type));

            if (!filtered.length && attempt < MAX_RETRIES) return fetchRandomItem(parentId, attempt + 1, includeSets);
            return filtered[Math.floor(Math.random() * filtered.length)] || null;
        } catch {
            return attempt < MAX_RETRIES ? fetchRandomItem(parentId, attempt + 1, includeSets) : null;
        }
    };

    const fetchUnifiedFallback = async (includeSets = false) => {
        const items = [];

        const movie = await fetchRandomItem(MOVIES_PARENT_ID);
        if (movie) items.push(movie);

        const series = await fetchRandomItem(TVSHOWS_PARENT_ID);
        if (series) items.push(series);

        if (includeSets) {
            const sets = await fetchRandomItem(COLLECTIONS_PARENT_ID, 1, true);
            if (sets) items.push(sets);
        }

        if (!items.length) return null;

        const item = items[Math.floor(Math.random() * items.length)];
        let parentId;
        if (item.Type === 'Movie') parentId = MOVIES_PARENT_ID;
        else if (item.Type === 'Series') parentId = TVSHOWS_PARENT_ID;
        else parentId = COLLECTIONS_PARENT_ID;

        return { item, parentId };
    };

    const fetchRandomNext = async (currentItem) => {
        if (!currentItem) return null;
        const userId = ApiClient.getCurrentUserId();
        if (!userId) return null;
        if (currentItem.Type === 'Series') return await fetchRandomItem(TVSHOWS_PARENT_ID);
        if (currentItem.Type === 'Season') {
            const url = `${getServerAddress()}/Users/${userId}/Items?ParentId=${currentItem.Id}&IncludeItemTypes=Episode&SortBy=Random&Limit=${FETCH_LIMIT}`;
            try { const { Items = [] } = await ApiClient.ajax({ type: 'GET', url, dataType: 'json' }); return Items[Math.floor(Math.random() * Items.length)] || null; } catch { return null; }
        }
        if (currentItem.Type === 'Episode') {
            try {
                const seasonsResponse = await ApiClient.ajax({ type: 'GET', url: `${getServerAddress()}/Users/${userId}/Items?ParentId=${currentItem.SeriesId}&IncludeItemTypes=Season&Fields=Id&_=${Date.now()}`, dataType: 'json' });
                const seasons = seasonsResponse.Items || [];
                let allEpisodes = [];
                for (const season of seasons) {
                    const episodesResponse = await ApiClient.ajax({ type: 'GET', url: `${getServerAddress()}/Users/${userId}/Items?ParentId=${season.Id}&IncludeItemTypes=Episode&Fields=Id&_=${Date.now()}`, dataType: 'json' });
                    allEpisodes = allEpisodes.concat(episodesResponse.Items || []);
                }
                if (allEpisodes.length > 0) return allEpisodes[Math.floor(Math.random() * allEpisodes.length)];
            } catch { return null; }
        }
        return null;
    };

    const openItem = (item, parentId) => {
        if (!item?.Id) return;
        const serverId = ApiClient.serverId();
        let url = `${getServerAddress()}/web/index.html#!/details?id=${item.Id}`;
        if (serverId) url += `&serverId=${serverId}`;
        if (parentId) url += `&parentId=${parentId}`;
        window.location.href = url;
    };

    const fetchAndOpenRandom = async () => {
        const btn = document.getElementById('randomMovieButton');
        if (btn) updateButtonIcon(true);
        try {
            let item = null;
            let parentId = null;
            const hash = window.location.hash.toLowerCase();
            const currentId = getCurrentItemId();
            if (currentId) {
                const currentItem = await fetchCurrentItem(currentId);
                if (currentItem) {
                    item = await fetchRandomNext(currentItem);
                    if (currentItem.Type === 'Episode') parentId = currentItem.SeriesId;
                    else parentId = item?.ParentId || currentItem.Id;
                }
            }

            if (!item) {
                const parentIdCandidate = getCurrentLibraryParentId();
                let includeSets = false;

                if (hash.includes('home.html')) includeSets = true;
                else if (parentIdCandidate === COLLECTIONS_PARENT_ID) includeSets = true;

                item = parentIdCandidate ? await fetchRandomItem(parentIdCandidate, 1, includeSets) : null;

                if (!item) {
                    const fallback = hash.includes('home.html') ? await fetchUnifiedFallback(true) : await fetchUnifiedFallback(false);
                    if (fallback) {
                        item = fallback.item;
                        parentId = fallback.parentId;
                    }
                } else {
                    parentId = parentIdCandidate;
                }
            }

            if (item) openItem(item, parentId);
        } finally {
            if (btn) updateButtonIcon(false);
        }
    };

    /**********************
     * BUTTON & CLICK LOGIC
     **********************/
    const timerStates = [3, 6, 12, 24, 48]; // seconds
    let currentTimerIndex = timerStates.indexOf(24); // default 24s

    const addButton = () => {
        // Pop-in fix: always try to add button
        if (!document.getElementById('randomMovieButton')) {

            const btn = document.createElement('button');
            btn.id = 'randomMovieButton';
            btn.className = 'random-movie-button emby-button button-flat button-flat-hover';
            btn.title = 'Random Movie, Series, or Collection';
            btn.innerHTML = `<i class="md-icon random-icon">${getStandardIcon()}</i><span class="timer-display"></span>`;

            let clickCount = 0;
            let clickTimer = null;

            btn.addEventListener('click', () => {
                clickCount++;

                if (clickTimer) clearTimeout(clickTimer);

                clickTimer = setTimeout(() => {
                    const display = btn.querySelector('.timer-display');

                    if (clickCount === 1) {
                        fetchAndOpenRandom();
                    } else if (clickCount === 2) {
                        if (manualMode) setModeAuto();
                        else setModeManual();
                    } else if (clickCount === 3) {
                        if (currentTimerIndex < 0) currentTimerIndex = timerStates.indexOf(24);
                        currentTimerIndex = (currentTimerIndex + 1) % timerStates.length;
                        const newInterval = timerStates[currentTimerIndex] * 1000;

                        if (autoInterval) {
                            clearInterval(autoInterval);
                            autoInterval = setInterval(fetchAndOpenRandom, newInterval);
                        }

                        if (display) {
                            display.textContent = timerStates[currentTimerIndex];
                            setTimeout(() => { display.textContent = ''; }, 500);
                        }
                    }

                    clickCount = 0;
                }, 250);
            });

            const container = document.createElement('div');
            container.id = 'randomMovieButtonContainer';
            container.appendChild(btn);

            // Force leftmost position
			const headerRight = document.querySelector('.headerRight');

				if (!headerRight) {
				setTimeout(addButton, 200);
				return;
						}

			headerRight.prepend(container);

            const observer = new MutationObserver(() => {
                const container = document.getElementById('randomMovieButtonContainer');
				if (!container) {
					addButton();
					return;
				}
                if (window.location.hash.startsWith('#/video')) { container.remove(); setModeManual(); }
                else {
                    const headerRight = document.querySelector('.headerRight');
                    if (!headerRight) return;
                    if (headerRight.firstElementChild !== container) {
                        headerRight.removeChild(container);
                        headerRight.prepend(container); // keep leftmost
                    }
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    };

    let lastHash = window.location.hash;
    const monitorHash = () => {
        if (window.location.hash !== lastHash) {
            lastHash = window.location.hash;
            if (!window.location.hash.startsWith('#/video')) addButton();
        }
    };
    setInterval(monitorHash, 200);

    const init = () => {
        injectMaterialIcons();
        injectCustomCss();
        addButton();
    };

    const waitForApiClient = () => {
        if (window.ApiClient?.getCurrentUserId) init();
        else setTimeout(waitForApiClient, 200);
    };
    waitForApiClient();
})();
