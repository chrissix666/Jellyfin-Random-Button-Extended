(function () {
    'use strict';

    const FETCH_LIMIT = 50;
    const MAX_RETRIES = 15;
    const AUTOMODE_INTERVAL_MS = 12000;

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
        }
        /* The button uses Jellyfin's own header button classes; only the
           wrapper is neutralised so the button sits in the header row
           exactly like SyncPlay, Cast and Search. */
        #randomMovieButtonContainer {
            display: contents;
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

            // Animation nur während Fetch
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
        fetchAndOpenRandom(); // sofortiger Shuffle
        if (autoInterval) clearInterval(autoInterval);
        autoInterval = setInterval(fetchAndOpenRandom, AUTOMODE_INTERVAL_MS);
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
            else filtered = Items.filter(i => ['Movie','Series'].includes(i.Type)); // Sets nur bei Home

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
            if (!manualMode && autoInterval) {
                clearInterval(autoInterval);
                autoInterval = setInterval(fetchAndOpenRandom, AUTOMODE_INTERVAL_MS);
            }
        }
    };

    const buildButton = () => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'randomMovieButton';
        btn.title = 'Random Movie, Series, or Collection';
        btn.innerHTML = `<i class="md-icon random-icon material-icons" aria-hidden="true">${getStandardIcon()}</i>`;

        let clickTimeout = null;
        btn.addEventListener('click', () => {
            if (clickTimeout !== null) {
                clearTimeout(clickTimeout);
                clickTimeout = null;
                if (manualMode) setModeAuto();
                else setModeManual();
            } else {
                clickTimeout = setTimeout(() => {
                    clickTimeout = null;
                    fetchAndOpenRandom();
                }, 250);
            }
        });
        return btn;
    };

    const addButton = () => {
        if (window.location.hash.startsWith('#/video')) return;
        if (document.getElementById('randomMovieButton')) return;

        // Same classes as Jellyfin's own header buttons (SyncPlay, Cast,
        // Search), so size, round hover/active highlight and colour come
        // from Jellyfin's stylesheet and the active theme, 1:1.
        const btn = buildButton();
        btn.className = 'random-movie-button headerButton headerButtonRight paper-icon-button-light';

        const container = document.createElement('div');
        container.id = 'randomMovieButtonContainer';
        container.appendChild(btn);
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
                    headerRight.prepend(container);
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    };

    /**********************
     * EXPERIMENTAL LAYOUT (MUI toolbar)
     **********************/
    // jellyfin-web's Experimental layout hides the classic header
    // (RootAppRouter renders <AppHeader isHidden>), so .headerRight is never
    // visible there. Its toolbar is a MUI AppBar whose right-hand buttons
    // (SyncPlay, Cast, Search) share one flex box; Search is always a link
    // to search.html, so that link's parent is the box. RootAppRouter picks
    // the layout once per page load from this localStorage key.
    const IS_EXPERIMENTAL_LAYOUT = localStorage.getItem('layout') === 'experimental';

    // Left-to-right order of the custom header buttons (Random, Autoscroll,
    // Fullscreen, Cinema), so they line up the same in both layouts no
    // matter which script runs first.
    const HEADER_BUTTON_ORDER = ['randomMovieButton', 'jf-scroll-btn', 'jf-fullscreen-btn', 'jf-cinema-btn'];

    function getMuiToolbarBox() {
        const searchLink = document.querySelector('.MuiAppBar-root a[href*="search.html"]');
        return searchLink ? searchLink.parentElement : null;
    }

    // Hover tint of Jellyfin's own toolbar buttons (MUI IconButton,
    // color 'inherit'): palette.action.active at action.hoverOpacity, i.e.
    // white 8 % in the dark MUI themes, black 4 % in Light and Apple TV.
    function getMuiHoverColor() {
        // The href attribute is relative ("themes/dark/theme.css"); the
        // regex below runs on the resolved, absolute link.href.
        const link = document.querySelector('link[href*="themes/"][href$="theme.css"]');
        return link && /\/themes\/(light|appletv)\//.test(link.href) ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.08)';
    }

    // In the classic header Random sits in its own wrapper div.
    function headerButtonRank(el) {
        return el.id === 'randomMovieButtonContainer' ? 0 : HEADER_BUTTON_ORDER.indexOf(el.id);
    }

    // Puts el into box right before the first element that belongs after
    // it: a Jellyfin button or a custom button later in the order.
    function placeInOrder(box, el) {
        const myRank = headerButtonRank(el);
        let ref = null;
        for (const child of box.children) {
            if (child === el) continue;
            const rank = headerButtonRank(child);
            if (rank === -1 || rank > myRank) { ref = child; break; }
        }
        if (el.parentElement !== box || el.nextElementSibling !== ref) box.insertBefore(el, ref);
    }

    function placeInMuiToolbar(btn) {
        const box = getMuiToolbarBox();
        if (!box) return;
        placeInOrder(box, btn);
        btn.style.setProperty('--jf-mui-hover', getMuiHoverColor());
    }

    // Same box, padding, icon size, colour and hover transition as MUI's
    // <IconButton size="large" color="inherit"> (@mui/material 5.16.7):
    // 12px padding around a 1.5rem icon (SvgIcon 'medium'), round, icon
    // keeps the toolbar colour.
    function muiButtonCss(id) {
        return `
            #${id}.jf-mui-header-btn {
                display:inline-flex; align-items:center; justify-content:center;
                position:relative; box-sizing:border-box; flex:0 0 auto;
                padding:12px; margin:0; border:0; border-radius:50%;
                background-color:transparent; color:inherit; font-size:1.75rem;
                cursor:pointer; outline:0; vertical-align:middle;
                -webkit-tap-highlight-color:transparent;
                transition:background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
            }
            #${id}.jf-mui-header-btn > .material-icons { font-size:1.5rem; line-height:1; }
            @media (hover: hover) {
                #${id}.jf-mui-header-btn:hover { background-color:var(--jf-mui-hover, rgba(255, 255, 255, 0.08)); }
            }
        `;
    }

    function injectMuiStyle(styleId, buttonId) {
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = muiButtonCss(buttonId);
        document.head.appendChild(style);
    }

    // The toolbar unmounts on the video route and has no buttons on the
    // login/server pages, so the button is (re)placed whenever the DOM
    // changes, batched with a short timer (requestAnimationFrame would not
    // run while the tab is in the background).
    function watchMuiToolbar(onChange) {
        let queued = false;
        const run = () => { queued = false; onChange(); };
        const start = () => {
            if (!document.body) { setTimeout(start, 200); return; }
            run();
            new MutationObserver(() => {
                if (!queued) { queued = true; setTimeout(run, 50); }
            }).observe(document.body, { childList: true, subtree: true });
        };
        start();
    }

    const createExperimentalButton = () => {
        // The toolbar is gone on the video player; stop auto mode there,
        // as the classic header does.
        if (window.location.hash.startsWith('#/video') && !manualMode) setModeManual();
        if (!getMuiToolbarBox()) return;
        let btn = document.getElementById('randomMovieButton');
        if (!btn) {
            btn = buildButton();
            btn.className = 'random-movie-button jf-mui-header-btn';
        }
        placeInMuiToolbar(btn);
    };

    let lastHash = window.location.hash;
    const monitorHash = () => {
        if (window.location.hash !== lastHash) {
            lastHash = window.location.hash;
            if (!window.location.hash.startsWith('#/video')) addButton();
        }
    };

    const init = () => {
        injectMaterialIcons();
        injectCustomCss();
        addButton();
    };
    const waitForApiClient = () => {
        if (window.ApiClient?.getCurrentUserId) init();
        else setTimeout(waitForApiClient, 200);
    };
    if (IS_EXPERIMENTAL_LAYOUT) {
        injectMaterialIcons();
        injectCustomCss();
        injectMuiStyle('random-movie-button-mui-css', 'randomMovieButton');
        watchMuiToolbar(createExperimentalButton);
    } else {
        setInterval(monitorHash, 200);
        waitForApiClient();
    }
})();
