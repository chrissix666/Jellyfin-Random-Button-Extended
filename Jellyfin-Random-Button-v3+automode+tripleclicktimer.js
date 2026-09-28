(function () {
    'use strict';

    const FETCH_LIMIT = 50;
    const MAX_RETRIES = 15;
    const DEFAULT_INTERVAL_MS = 24000; // Standard 24s

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
    const injectCustomCss = () => {
        if (document.getElementById('random-movie-button-custom-css')) return;
        const style = document.createElement('style');
        style.id = 'random-movie-button-custom-css';
        style.innerHTML = `
        .random-movie-button .md-icon {
            font-family: 'Material Symbols Outlined' !important;
            font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;
            font-style: normal !important;
            font-size: 24px !important;
            display: inline-block;
            vertical-align: middle;
            line-height: 1;
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

    // Inline SVG icons instead of relying on the "Material Symbols Outlined"
    // icon font loaded from fonts.googleapis.com: whenever that font couldn't
    // load (blocked, offline, privacy extensions) or hadn't loaded yet, the
    // ligature text (e.g. "casino") was shown instead of the icon. The
    // paths are the glyphs of the exact font file fonts.googleapis.com
    // serves for this family, drawn at the same 24px, so the icons look
    // exactly as before, and the font no longer needs to be requested.
    const ICON_PATHS = {
        casino: 'M300.0 -240.0Q325 -240 342.5 -257.5Q360 -275 360.0 -300.0Q360 -325 342.5 -342.5Q325 -360 300.0 -360.0Q275 -360 257.5 -342.5Q240 -325 240.0 -300.0Q240 -275 257.5 -257.5Q275 -240 300.0 -240.0ZM300.0 -600.0Q325 -600 342.5 -617.5Q360 -635 360.0 -660.0Q360 -685 342.5 -702.5Q325 -720 300.0 -720.0Q275 -720 257.5 -702.5Q240 -685 240.0 -660.0Q240 -635 257.5 -617.5Q275 -600 300.0 -600.0ZM480.0 -420.0Q505 -420 522.5 -437.5Q540 -455 540.0 -480.0Q540 -505 522.5 -522.5Q505 -540 480.0 -540.0Q455 -540 437.5 -522.5Q420 -505 420.0 -480.0Q420 -455 437.5 -437.5Q455 -420 480.0 -420.0ZM660.0 -240.0Q685 -240 702.5 -257.5Q720 -275 720.0 -300.0Q720 -325 702.5 -342.5Q685 -360 660.0 -360.0Q635 -360 617.5 -342.5Q600 -325 600.0 -300.0Q600 -275 617.5 -257.5Q635 -240 660.0 -240.0ZM660.0 -600.0Q685 -600 702.5 -617.5Q720 -635 720.0 -660.0Q720 -685 702.5 -702.5Q685 -720 660.0 -720.0Q635 -720 617.5 -702.5Q600 -685 600.0 -660.0Q600 -635 617.5 -617.5Q635 -600 660.0 -600.0ZM200 -120Q167 -120 143.5 -143.5Q120 -167 120 -200V-760Q120 -793 143.5 -816.5Q167 -840 200 -840H760Q793 -840 816.5 -816.5Q840 -793 840 -760V-200Q840 -167 816.5 -143.5Q793 -120 760 -120ZM200 -200H760Q760 -200 760.0 -200.0Q760 -200 760 -200V-760Q760 -760 760.0 -760.0Q760 -760 760 -760H200Q200 -760 200.0 -760.0Q200 -760 200 -760V-200Q200 -200 200.0 -200.0Q200 -200 200 -200ZM200 -760Q200 -760 200.0 -760.0Q200 -760 200 -760V-200Q200 -200 200.0 -200.0Q200 -200 200 -200Q200 -200 200.0 -200.0Q200 -200 200 -200V-760Q200 -760 200.0 -760.0Q200 -760 200 -760Z',
        hourglass_empty: 'M320 -160H640V-280Q640 -346 593.0 -393.0Q546 -440 480.0 -440.0Q414 -440 367.0 -393.0Q320 -346 320 -280ZM640 -680V-800H320V-680Q320 -614 367.0 -567.0Q414 -520 480.0 -520.0Q546 -520 593.0 -567.0Q640 -614 640 -680ZM160 -80V-160H240V-280Q240 -341 268.5 -394.5Q297 -448 348 -480Q297 -512 268.5 -565.5Q240 -619 240 -680V-800H160V-880H800V-800H720V-680Q720 -619 691.5 -565.5Q663 -512 612 -480Q663 -448 691.5 -394.5Q720 -341 720 -280V-160H800V-80Z'
    };

    function iconSvg(name) {
        return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" style="display:block"><path d="' + ICON_PATHS[name] + '"/></svg>';
    }

    const getStandardIcon = () => manualMode ? 'casino' : 'hourglass_empty';
    const getFetchingIcon = () => manualMode ? 'hourglass_empty' : 'casino';
    const updateButtonIcon = (fetching = false) => {
        const btn = document.getElementById('randomMovieButton');
        if (!btn) return;

        const icon = fetching ? getFetchingIcon() : getStandardIcon();
        const iconElem = btn.querySelector('.md-icon');

        if (iconElem) {
            iconElem.innerHTML = iconSvg(icon);
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
            btn.innerHTML = `<i class="md-icon random-icon material-symbols-outlined">${iconSvg(getStandardIcon())}</i><span class="timer-display"></span>`;

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
            if (headerRight) headerRight.prepend(container);

            const observer = new MutationObserver(() => {
                const container = document.getElementById('randomMovieButtonContainer');
                if (!container) return;
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
        injectCustomCss();
        addButton();
    };

    const waitForHeader = () => {
        if (document.querySelector('.headerRight')) init();
        else setTimeout(waitForHeader, 200);
    };
    waitForHeader();
})();
