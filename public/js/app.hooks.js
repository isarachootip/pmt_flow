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

    // Interactive Training Manual Viewer
    window.openTrainingDoc = async function(fileName, title) {
        let modal = document.getElementById('modal-training-viewer');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-training-viewer';
            modal.className = 'fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 hidden-view';
            modal.innerHTML = `
                <div class="bg-card border border-border rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div class="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center text-lg font-bold border border-purple-500/20">
                                <i class="ph ph-graduation-cap"></i>
                            </div>
                            <div>
                                <h3 id="manual-modal-title" class="font-display text-sm font-bold text-foreground">คู่มือฝึกอบรม</h3>
                                <p id="manual-modal-file" class="text-[10px] font-mono text-muted-foreground"></p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <a id="manual-modal-raw-link" href="#" target="_blank" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-foreground flex items-center gap-1.5 transition">
                                <i class="ph ph-arrow-square-out"></i> เปิดไฟล์เต็ม
                            </a>
                            <button onclick="document.getElementById('modal-training-viewer').classList.add('hidden-view')" class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer">
                                <i class="ph ph-x text-base"></i>
                            </button>
                        </div>
                    </div>
                    <div id="manual-modal-body" class="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-foreground/90 font-sans">
                        <div class="text-center py-10 text-muted-foreground">กำลังโหลดเนื้อหาคู่มือ...</div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        document.getElementById('manual-modal-title').innerText = title || fileName;
        document.getElementById('manual-modal-file').innerText = fileName;
        const rawLink = document.getElementById('manual-modal-raw-link');
        const docUrl = '/doc/' + encodeURIComponent(fileName);
        rawLink.href = docUrl;
        modal.classList.remove('hidden-view');

        try {
            const res = await fetch(docUrl);
            if (!res.ok) throw new Error('Cannot load document');
            const text = await res.text();
            let html = text
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/^# (.*$)/gim, '<h1 class="font-display text-xl font-bold text-foreground pb-2 border-b border-border my-4">$1</h1>')
                .replace(/^## (.*$)/gim, '<h2 class="font-display text-base font-bold text-brand-600 dark:text-brand-400 mt-5 mb-2">$1</h2>')
                .replace(/^### (.*$)/gim, '<h3 class="font-display text-sm font-bold text-foreground mt-3 mb-1">$1</h3>')
                .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-semibold text-foreground">$1</strong>')
                .replace(/`([^`]+)`/gim, '<code class="px-1.5 py-0.5 rounded bg-muted text-purple-600 dark:text-purple-400 font-mono text-[11px]">$1</code>')
                .replace(/^\s*-\s(.*$)/gim, '<li class="ml-4 list-disc text-muted-foreground leading-relaxed">$1</li>')
                .replace(/\n\n/gim, '<br><br>');
            document.getElementById('manual-modal-body').innerHTML = `<div class="max-w-none space-y-2">${html}</div>`;
        } catch(err) {
            document.getElementById('manual-modal-body').innerHTML = `
                <div class="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
                    ไม่สามารถโหลดตัวอย่างในหน้านี้ได้ กรุณากดปุ่ม <strong>"เปิดไฟล์เต็ม"</strong> ด้านบนเพื่ออ่านเนื้อหาโดยตรง
                </div>
            `;
        }
    };


