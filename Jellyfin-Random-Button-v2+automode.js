(function () {
    'use strict';

    /* jfcompat 1.0 - one script for Jellyfin web 10.10.7 and 12.1.
     * Paste this block unchanged at the top of a script (inside its IIFE).
     * It is pure: no side effects at load, no globals except window.jfcompat
     * (set only when absent, for console checks; scripts use the local const).
     * Rule: on 10.10.7 every answer equals what the scripts computed before. */
    const jfcompat = (function () {
        'use strict';
        const VERSION = '1.0';

        // ---------- version ----------
        // The web client ships with the server, so the server version decides.
        // ApiClient.appVersion() is not used: inside Jellyfin Media Player or the
        // Android app NativeShell replaces it with the app's own number
        // (apphost.js 10.10.7:417-419, 12.1:399-401).
        // Before ApiClient knows the server, <html data-theme> is a 12.x-only hint
        // (12.1 scripts/themeManager.js:46; 10.10.7 never sets it).
        function serverVersion() {
            try {
                const api = window.ApiClient;
                const v = api && typeof api.serverVersion === 'function' && api.serverVersion();
                if (v) {
                    const [major, minor] = String(v).split('.').map(Number);
                    return { major: major, minor: minor || 0, raw: String(v) };
                }
            } catch (e) { /* ignore */ }
            return null;
        }
        // 12.x model: modern layout default, routes without .html, legacy auth off.
        // 10.11 was not audited; treated as the new model (live-check before relying on it).
        function isNewModel() {
            const v = serverVersion();
            if (v) return v.major > 10 || (v.major === 10 && v.minor >= 11);
            return document.documentElement.hasAttribute('data-theme');
        }

        // ---------- routes ----------
        // getRoute(): { name, params } with '#!' and '.html' removed, so one name
        // fits both: home, movies, tv, list, search, details, video, music, livetv ...
        function getRoute() {
            const h = window.location.hash || '';
            const m = /^#!?\/([^?]*)(?:\?(.*))?$/.exec(h);
            const name = m ? m[1].replace(/\.html$/i, '').toLowerCase() : '';
            return { name: name, params: new URLSearchParams(m && m[2] ? m[2] : '') };
        }
        function isRoute() {
            const n = getRoute().name;
            for (let i = 0; i < arguments.length; i++) if (arguments[i] === n) return true;
            return false;
        }
        // routeUrl('list', {parentId}) -> '#/list.html?...' on 10.10.7, '#/list?...' on 12.1.
        // details and video never had '.html' (10.10.7 appRouter.js:447,472).
        const NO_SUFFIX = ['details', 'video', ''];
        function routeUrl(name, params) {
            const q = params ? new URLSearchParams(params).toString() : '';
            const suffix = (!isNewModel() && NO_SUFFIX.indexOf(name) < 0) ? '.html' : '';
            return '#/' + name + suffix + (q ? '?' + q : '');
        }
        // Navigate inside the app (no reload). Emby.Page.show strips '#' and '!'
        // in both versions (appRouter.js 10.10.7:516, 12.1:552).
        function go(name, params) {
            const url = routeUrl(name, params);
            if (window.Emby && window.Emby.Page && typeof window.Emby.Page.show === 'function') {
                window.Emby.Page.show(url.slice(1));
            } else {
                window.location.hash = url;
            }
        }

        // ---------- layout ----------
        // 10.10.7: MUI only when localStorage.layout === 'experimental' (RootAppRouter.tsx:19-20).
        // 12.1:    classic only for desktop-legacy | mobile-legacy | tv
        //          (constants/layoutMode.ts, layoutManager.js:41); everything else,
        //          including a stale 'experimental', is MUI.
        // Both versions pick the layout once per page load, so the DOM answer is cached.
        const LEGACY_12 = ['desktop-legacy', 'mobile-legacy', 'tv'];
        const MUI_SEARCH = '.MuiAppBar-root a[href^="#/search"]';
        let cachedLayout = null;
        function getLayout() {
            if (cachedLayout) return cachedLayout;
            // 1) what the page shows (not on the video route: 12.1 draws an osdHeader there;
            //    not on dashboard pages: there the classic header is hidden in both layouts)
            if (getRoute().name !== 'video') {
                if (document.querySelector(MUI_SEARCH)) return (cachedLayout = 'mui');
                const sk = document.querySelector('.skinHeader:not(.osdHeader)');
                // .skinHeader is position:fixed, so offsetParent is always null; a
                // display:none ancestor (AppHeader isHidden) leaves it without client rects.
                if (sk && sk.getClientRects().length > 0 && sk.querySelector('.headerRight')) return (cachedLayout = 'classic');
            }
            // 2) the setting, read the way each version reads it (not cached)
            let v = '';
            try { v = localStorage.getItem('layout') || ''; } catch (e) { /* ignore */ }
            if (isNewModel()) return LEGACY_12.indexOf(v) >= 0 ? 'classic' : 'mui';
            return v === 'experimental' ? 'mui' : 'classic';
        }
        function isMui() { return getLayout() === 'mui'; }

        // ---------- header ----------
        // MUI: the search link sits in the right-hand button box with SyncPlay and
        // RemotePlay (components/toolbar/AppToolbar.tsx:84-85, both versions).
        // Its href is '#/search.html' on 10.10.7 and '#/search' on 12.1.
        // Classic: only a SHOWN header counts. 12.1 keeps the hidden classic header
        // in the DOM in the modern layout (AppHeader.tsx:20), and both versions hide
        // it on dashboard pages; a button placed there would never be seen.
        function isShown(el) { return !!el && el.getClientRects().length > 0; }
        function getSearchLink() {
            if (isMui()) return document.querySelector(MUI_SEARCH);
            const b = document.querySelector('.skinHeader:not(.osdHeader) .headerRight .headerSearchButton');
            return isShown(b) ? b : null;
        }
        function getHeaderBox() {
            if (isMui()) { const a = document.querySelector(MUI_SEARCH); return a ? a.parentElement : null; }
            const box = document.querySelector('.skinHeader:not(.osdHeader) .headerRight');
            return isShown(box) ? box : null;
        }
        // cb(box | null) whenever the box may have changed (the MUI toolbar unmounts
        // on /video and has no buttons on public pages). setTimeout, not rAF, so it
        // also runs in background tabs.
        function onHeaderBoxChange(cb) {
            let queued = false;
            const run = function () { queued = false; cb(getHeaderBox()); };
            const start = function () {
                if (!document.body) { setTimeout(start, 200); return; }
                run();
                new MutationObserver(function () {
                    if (!queued) { queued = true; setTimeout(run, 50); }
                }).observe(document.body, { childList: true, subtree: true });
            };
            start();
        }

        // ---------- theme ----------
        function getThemeId() {
            const d = document.documentElement.getAttribute('data-theme');          // 12.1
            if (d) return d;
            const link = document.querySelector('link[href*="themes/"][href$="theme.css"]'); // both
            const m = link && /themes\/([^/]+)\/theme\.css/.exec(link.getAttribute('href') || '');
            return m ? m[1] : 'dark';
        }
        // MUI IconButton (color inherit) hover = action.active at action.hoverOpacity.
        // 12.1 exposes it as CSS variables (themes/index.ts, prefix 'jf'); the
        // fallbacks are the 10.10.7 values (dark 8 % white, light/appletv 4 % black).
        function getMuiHoverColor() {
            const old = /^(light|appletv)$/.test(getThemeId()) ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.08)';
            if (!document.documentElement.hasAttribute('data-theme')) return old;
            const cs = getComputedStyle(document.documentElement);
            const ch = cs.getPropertyValue('--jf-palette-action-activeChannel').trim();
            const op = cs.getPropertyValue('--jf-palette-action-hoverOpacity').trim();
            return (ch && op) ? 'rgba(' + ch + ' / ' + op + ')' : old;
        }

        // ---------- auth for raw fetch ----------
        // 12.1 ignores X-Emby-Token, X-MediaBrowser-Token, X-Emby-Authorization and
        // ?api_key= unless EnableLegacyAuthorization (AuthorizationContext.cs:93-110).
        // The Authorization header and ?ApiKey= work in both versions.
        function accessToken() {
            try {
                const api = window.ApiClient;
                const t = api && typeof api.accessToken === 'function' && api.accessToken();
                if (t) return t;
            } catch (e) { /* ignore */ }
            try {
                const c = JSON.parse(localStorage.getItem('jellyfin_credentials') || '{}');
                const s = (c.Servers || []).find(function (x) { return x.AccessToken; });
                return s ? s.AccessToken : null;
            } catch (e) { return null; }
        }
        function authHeaders(extra) {
            const h = Object.assign({}, extra || {});
            const t = accessToken();
            if (t) h.Authorization = 'MediaBrowser Token="' + t + '"';
            return h;
        }
        // Adds ?ApiKey=<token> to a URL that cannot carry a header (img src, download link).
        function withApiKey(url) {
            const t = accessToken();
            if (!t) return url;
            return url + (url.indexOf('?') < 0 ? '?' : '&') + 'ApiKey=' + encodeURIComponent(t);
        }

        // ---------- pages ----------
        // React library pages in the 12.1 modern layout (apps/modern/routes/asyncRoutes/user.ts).
        // In 10.10.7 'experimental' some of these were React too; live-check before reuse there.
        const REACT_LIBRARY_ROUTES = ['movies', 'tv', 'music', 'livetv', 'boxsets', 'homevideos',
            'musicvideos', 'mixed', 'books', 'playlists', 'home'];
        function isReactLibraryPage() {
            return isNewModel() && isMui() && REACT_LIBRARY_ROUTES.indexOf(getRoute().name) >= 0;
        }

        // ---------- video OSD ----------
        // Legacy view in both (10.10.7 controllers/playback/video/index.html:30;
        // 12.1 apps/legacy/controllers/playback/video/index.html:30).
        function getOsdBar() {
            return document.querySelector('.videoOsdBottom .osdControls .buttons');
        }

        const api = {
            VERSION: VERSION, serverVersion: serverVersion, isNewModel: isNewModel,
            getRoute: getRoute, isRoute: isRoute, routeUrl: routeUrl, go: go,
            getLayout: getLayout, isMui: isMui,
            getSearchLink: getSearchLink, getHeaderBox: getHeaderBox, onHeaderBoxChange: onHeaderBoxChange,
            getThemeId: getThemeId, getMuiHoverColor: getMuiHoverColor,
            accessToken: accessToken, authHeaders: authHeaders, withApiKey: withApiKey,
            isReactLibraryPage: isReactLibraryPage, getOsdBar: getOsdBar
        };
        if (!window.jfcompat) window.jfcompat = api;
        return api;
    })();
    /* end jfcompat 1.0 */

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
            // Route names without '.html' (12.x dropped it). 'livetv' counts
            // as tv, as the former test hash.includes('tv.html') did.
            if (jfcompat.isRoute('movies')) parentId = MOVIES_PARENT_ID;
            else if (jfcompat.isRoute('tv', 'livetv')) parentId = TVSHOWS_PARENT_ID;
            else if (jfcompat.isRoute('list')) parentId = COLLECTIONS_PARENT_ID;
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
        // '#/details' directly: the '#!' form only reached it through a
        // redirect that 12.x marks as deprecated. Only the hash changes, so
        // the app navigates in place: setting the full '/web/index.html' URL
        // reloaded the page when it was open as '/web/' (and auto mode
        // stopped with that reload).
        let url = `#/details?id=${item.Id}`;
        if (serverId) url += `&serverId=${serverId}`;
        if (parentId) url += `&parentId=${parentId}`;
        window.location.hash = url;
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

                if (jfcompat.isRoute('home', 'mypreferenceshome')) includeSets = true;
                else if (parentIdCandidate === COLLECTIONS_PARENT_ID) includeSets = true;

                item = parentIdCandidate ? await fetchRandomItem(parentIdCandidate, 1, includeSets) : null;

                if (!item) {
                    const fallback = jfcompat.isRoute('home', 'mypreferenceshome') ? await fetchUnifiedFallback(true) : await fetchUnifiedFallback(false);
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

    /**********************
     * HEADER LAYOUTS
     **********************/
    // Classic header (.headerRight) or the MUI toolbar: Experimental layout
    // in 10.10.x, the default ("modern") layout in 12.x. jfcompat decides
    // from what the page shows, so the choice is made each time the header
    // box may have changed, not once at load (12.x keeps a hidden classic
    // header in the DOM, and its version is not known that early).

    // Left-to-right order of the custom header buttons (Random, Autoscroll,
    // Fullscreen, Cinema), so they line up the same in both layouts no
    // matter which script runs first.
    const HEADER_BUTTON_ORDER = ['randomMovieButton', 'jf-scroll-btn', 'jf-fullscreen-btn', 'jf-cinema-btn'];

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

    // Called whenever the header box may have changed; jfcompat batches the
    // DOM changes with a short timer.
    const placeButton = (box) => {
        // No header buttons on the video player: the classic header there is
        // the OSD header, the MUI toolbar is gone. Stop auto mode there.
        if (jfcompat.isRoute('video')) {
            if (!manualMode) setModeManual();
            const container = document.getElementById('randomMovieButtonContainer');
            if (container) container.remove();
            return;
        }
        if (!box) return;
        const btn = document.getElementById('randomMovieButton') || buildButton();
        if (jfcompat.isMui()) {
            injectMuiStyle('random-movie-button-mui-css', 'randomMovieButton');
            btn.className = 'random-movie-button jf-mui-header-btn';
            btn.style.setProperty('--jf-mui-hover', jfcompat.getMuiHoverColor());
            placeInOrder(box, btn);
            const container = document.getElementById('randomMovieButtonContainer');
            if (container) container.remove();
        } else {
            // Same classes as Jellyfin's own header buttons (SyncPlay, Cast,
            // Search), so size, round hover/active highlight and colour come
            // from Jellyfin's stylesheet and the active theme, 1:1. The
            // wrapper div (display: contents) keeps Random leftmost.
            btn.className = 'random-movie-button headerButton headerButtonRight paper-icon-button-light';
            let container = document.getElementById('randomMovieButtonContainer');
            if (!container) {
                container = document.createElement('div');
                container.id = 'randomMovieButtonContainer';
            }
            if (btn.parentElement !== container) container.appendChild(btn);
            placeInOrder(box, container);
        }
    };

    injectMaterialIcons();
    injectCustomCss();
    jfcompat.onHeaderBoxChange(placeButton);
})();
