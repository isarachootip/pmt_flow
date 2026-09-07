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
            
            // Rich Markdown Parser for Training Viewer
            function parseMarkdown(md) {
                // Escape HTML characters
                let out = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                
                // Code blocks ```...```
                out = out.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/gim, (m, lang, code) => {
                    return `<pre class="p-3.5 my-3 rounded-xl bg-muted/80 text-foreground font-mono text-[11px] overflow-x-auto border border-border"><code>${code.trim()}</code></pre>`;
                });

                // Alerts (> [!IMPORTANT], > [!TIP], > [!CAUTION], > [!NOTE])
                out = out.replace(/^&gt;\s*\[!(IMPORTANT|TIP|CAUTION|NOTE|WARNING)\]\s*\n?((?:^&gt;.*$\n?)*)/gim, (m, type, body) => {
                    const cleanBody = body.replace(/^&gt;\s?/gm, '').trim();
                    let borderCol = 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200';
                    let icon = 'ph-warning-circle';
                    let label = 'สำคัญ (IMPORTANT)';
                    if (type === 'TIP') {
                        borderCol = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200';
                        icon = 'ph-lightbulb';
                        label = 'เกร็ดความรู้ (TIP)';
                    } else if (type === 'CAUTION' || type === 'WARNING') {
                        borderCol = 'border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-200';
                        icon = 'ph-shield-warning';
                        label = 'ข้อควรระวัง (CAUTION)';
                    } else if (type === 'NOTE') {
                        borderCol = 'border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-200';
                        icon = 'ph-info';
                        label = 'หมายเหตุ (NOTE)';
                    }
                    return `<div class="my-3 p-3.5 rounded-xl border ${borderCol} text-xs leading-relaxed flex gap-2.5">
                        <i class="ph ${icon} text-lg shrink-0 mt-0.5"></i>
                        <div><strong class="font-bold block mb-0.5">${label}</strong>${cleanBody}</div>
                    </div>`;
                });

                // Normal Blockquotes (> ...)
                out = out.replace(/^&gt;\s(.*$)/gim, '<blockquote class="border-l-4 border-muted-foreground/30 pl-3 my-2 text-muted-foreground italic text-xs">$1</blockquote>');

                // Horizontal Rule
                out = out.replace(/^---$/gim, '<hr class="my-4 border-border">');

                // Headings
                out = out.replace(/^# (.*$)/gim, '<h1 class="font-display text-xl font-extrabold text-foreground pb-2 border-b border-border my-4">$1</h1>');
                out = out.replace(/^## (.*$)/gim, '<h2 class="font-display text-base font-bold text-brand-600 dark:text-brand-400 mt-5 mb-2 pb-1 border-b border-border/50">$1</h2>');
                out = out.replace(/^### (.*$)/gim, '<h3 class="font-display text-sm font-bold text-foreground mt-3 mb-1.5">$1</h3>');
                out = out.replace(/^#### (.*$)/gim, '<h4 class="font-display text-xs font-bold text-foreground mt-2 mb-1">$1</h4>');

                // Tables
                out = out.replace(/((?:^\|[^\n]*\|\r?\n?)+)/gm, (tableText) => {
                    const rows = tableText.trim().split('\n').map(r => r.trim()).filter(Boolean);
                    if (rows.length < 2) return tableText;
                    let tableHtml = '<div class="overflow-x-auto my-3 rounded-xl border border-border"><table class="w-full text-left text-xs border-collapse">';
                    let isHead = true;
                    for (let r of rows) {
                        if (/^\|[-:\s|]+\|$/.test(r)) {
                            isHead = false;
                            continue;
                        }
                        const cells = r.slice(1, -1).split('|').map(c => c.trim());
                        if (isHead) {
                            tableHtml += '<thead class="bg-muted/60 text-foreground font-semibold border-b border-border"><tr>';
                            cells.forEach(c => tableHtml += `<th class="p-2.5 border-r border-border last:border-r-0">${c}</th>`);
                            tableHtml += '</tr></thead><tbody>';
                            isHead = false;
                        } else {
                            tableHtml += '<tr class="border-b border-border/50 last:border-b-0 hover:bg-muted/30">';
                            cells.forEach(c => tableHtml += `<td class="p-2.5 border-r border-border/50 last:border-r-0">${c}</td>`);
                            tableHtml += '</tr>';
                        }
                    }
                    tableHtml += '</tbody></table></div>';
                    return tableHtml;
                });

                // Bold & Inline Code
                out = out.replace(/\*\*(.*?)\*\*/gim, '<strong class="font-semibold text-foreground">$1</strong>');
                out = out.replace(/`([^`]+)`/gim, '<code class="px-1.5 py-0.5 rounded bg-muted text-purple-600 dark:text-purple-400 font-mono text-[11px] border border-border/60">$1</code>');

                // Lists
                out = out.replace(/^\s*-\s(.*$)/gim, '<li class="ml-4 list-disc text-muted-foreground leading-relaxed">$1</li>');
                out = out.replace(/^\s*([0-9]+)\.\s(.*$)/gim, '<li class="ml-4 list-decimal text-muted-foreground leading-relaxed">$2</li>');

                // Paragraph breaks
                out = out.replace(/\n\n/gim, '<br><br>');
                return out;
            }

            const html = parseMarkdown(text);
            document.getElementById('manual-modal-body').innerHTML = `<div class="max-w-none space-y-2">${html}</div>`;
        } catch(err) {
            document.getElementById('manual-modal-body').innerHTML = `
                <div class="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
                    ไม่สามารถโหลดตัวอย่างในหน้านี้ได้ กรุณากดปุ่ม <strong>"เปิดไฟล์เต็ม"</strong> ด้านบนเพื่ออ่านเนื้อหาโดยตรง
                </div>
            `;
        }
    };


