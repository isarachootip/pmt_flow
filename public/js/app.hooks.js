// App Hooks
// ─── HOOK INTO APP ───────────────────────────────────────
    // Override app.navigate to trigger userMgmt.load on users page
    const _origNavigate = app.navigate.bind(app);
    app.navigate = function(view, param=null) {
        _origNavigate(view, param);
        if (view === 'users') {
            userMgmt.load();
            document.getElementById('topbar-breadcrumb').innerText = 'จัดการผู้ใช้งาน';
        }
    };

    // Override app.logout
    app.logout = () => auth.logout();

    // Override app.init to require login first
    const _origInit = app.init.bind(app);
    app.init = function() {
        _origInit();
        auth.init();
    };

    // Initialize auth immediately so sidebar and permissions are rendered without waiting
    auth.init();

    // Expose app to global window scope
    window.app = app;
