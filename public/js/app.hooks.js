// App Hooks
// ─── HOOK INTO APP ───────────────────────────────────────
    // Override app.navigate to guard authentication and trigger userMgmt.load on users page
    const _origNavigate = app.navigate.bind(app);
    app.navigate = function(view, param=null) {
        if (!window.auth || !window.auth.user) {
            if (window.auth && typeof window.auth.showLoginOverlay === 'function') {
                window.auth.showLoginOverlay();
            }
            return;
        }
        _origNavigate(view, param);
        if (view === 'users') {
            userMgmt.load();
            document.getElementById('topbar-breadcrumb').innerText = 'จัดการผู้ใช้งาน';
        }
    };

    // Override app.logout
    app.logout = () => (window.handleLogout ? window.handleLogout() : auth.logout());

    // Override app.init to require login first
    const _origInit = app.init.bind(app);
    app.init = function() {
        _origInit();
        if (window.auth) auth.init();
    };

    // Initialize auth immediately so sidebar and permissions are rendered without waiting
    if (window.auth) auth.init();

    // Expose app to global window scope
    window.app = app;

