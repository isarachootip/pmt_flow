// Universal Fetch Auth Interceptor: Automatically attach Bearer token to all /api/ requests
(function() {
    if (window._pmtFetchIntercepted) return;
    window._pmtFetchIntercepted = true;
    const _nativeFetch = window.fetch;
    window.fetch = function(resource, init) {
        try {
            const url = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
            if (url && (url.startsWith('/api/') || url.includes('/api/')) && !url.includes('/api/v1/auth/login')) {
                const token = (window.auth && window.auth.token) || sessionStorage.getItem('pmt_token') || localStorage.getItem('pmt_token');
                if (token) {
                    init = init || {};
                    let headers = init.headers;
                    if (!headers) {
                        headers = {};
                    }
                    if (headers instanceof Headers) {
                        if (!headers.has('Authorization')) {
                            headers.set('Authorization', `Bearer ${token}`);
                        }
                    } else if (Array.isArray(headers)) {
                        const hasAuth = headers.some(([k]) => String(k).toLowerCase() === 'authorization');
                        if (!hasAuth) {
                            headers.push(['Authorization', `Bearer ${token}`]);
                        }
                    } else if (typeof headers === 'object') {
                        if (!headers['Authorization'] && !headers['authorization']) {
                            headers['Authorization'] = `Bearer ${token}`;
                        }
                    }
                    init.headers = headers;
                }
            }
        } catch(e) {}
        return _nativeFetch.call(this, resource, init);
    };
})();

// Auth Module
window.auth =  {
        token: null,
        user:  null,
        defaultUser: {
            id: 1,
            user_code: 'USR-001',
            username: 'admin',
            email: 'admin@pmt.com',
            full_name: 'ผู้ดูแลระบบ',
            role: 'ADMIN',
            is_active: true
        },

        isIsaraChootip(u = this.user) {
            if (!u) return false;
            const name = String(u.full_name || '').toLowerCase().trim();
            const username = String(u.username || '').toLowerCase().trim();
            const email = String(u.email || '').toLowerCase().trim();

            // Match specifically Isara Chootip
            const hasNameMatch = (name.includes('isara') && name.includes('chootip')) || name === 'isara chootip';
            const hasUserMatch = (username.includes('isara') && username.includes('chootip')) || username.startsWith('isarachootip');
            const hasEmailMatch = (email === 'isarachootip@gmail.com' || (email.includes('isara') && email.includes('chootip'))) && username !== 'admin' && name !== 'ผู้ดูแลระบบ';

            return hasNameMatch || hasUserMatch || hasEmailMatch;
        },

        init() {
            // Strictly enforce Light Theme only across system
            try {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('pmt-theme', 'light');
            } catch(e) {}

            this.token = sessionStorage.getItem('pmt_token') || localStorage.getItem('pmt_token');
            const userStr = sessionStorage.getItem('pmt_user') || localStorage.getItem('pmt_user');
            if (this.token && userStr) {
                try { this.user = JSON.parse(userStr); } catch(e) {}
            }
            if (!this.user || !this.token) {
                this.user = null;
                this.token = null;
                this.showLoginOverlay();
            } else {
                this.hideLoginOverlay();
            }
            this.updateUI();
        },

        showLoginOverlay() {
            const overlay = document.getElementById('login-overlay');
            if (overlay) {
                overlay.style.setProperty('display', 'flex', 'important');
                overlay.classList.remove('hidden');
                const uInput = document.getElementById('login-username');
                if (uInput) setTimeout(() => uInput.focus(), 150);
            }
            const pageContainer = document.getElementById('page-container');
            if (pageContainer) {
                pageContainer.style.removeProperty('display');
            }
        },
        hideLoginOverlay() {
            const overlay = document.getElementById('login-overlay');
            if (overlay) {
                overlay.style.setProperty('display', 'none', 'important');
                overlay.classList.add('hidden');
            }
            const pageContainer = document.getElementById('page-container');
            if (pageContainer) {
                pageContainer.style.removeProperty('display');
            }
        },

        handleProfileClick() {
            if (!this.user) {
                this.showLoginOverlay();
            } else {
                this.openMyProfile();
            }
        },

        fillDemo(username, password) {
            const uEl = document.getElementById('login-username');
            const pEl = document.getElementById('login-password');
            if (uEl) uEl.value = username;
            if (pEl) pEl.value = password;
            this.login({ preventDefault: () => {} });
        },

        _isLoggingIn: false,
        async login(e) {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            if (this._isLoggingIn) return;
            this._isLoggingIn = true;

            const username = (document.getElementById('login-username')?.value || '').trim();
            const password = (document.getElementById('login-password')?.value || '');
            const errEl    = document.getElementById('login-error');
            const btnText  = document.getElementById('login-btn-text');
            const submitBtn = document.getElementById('login-submit-btn');

            if (errEl) { errEl.classList.add('hidden'); errEl.textContent = ''; }
            if (btnText) btnText.innerHTML = '<i class="ph ph-spinner animate-spin text-base"></i> <span>กำลังเข้าสู่ระบบ...</span>';
            if (submitBtn) submitBtn.disabled = true;

            const demoAccounts = {
                'isarachootip@gmail.com': { id: 1, user_code: 'USR-001B', username: 'isarachootip@gmail.com', email: 'isarachootip@gmail.com', full_name: 'Isara Chootip', role: 'ADMIN' },
                'admin': { id: 1, user_code: 'USR-001', username: 'admin', email: 'admin@pmt.com', full_name: 'ผู้ดูแลระบบ', role: 'ADMIN' },
                'ae.somchai': { id: 4, user_code: 'USR-003', username: 'ae.somchai', email: 'somchai@pmt.local', full_name: 'สมชาย ขยันทำ', role: 'AE' },
                'qc.wichai': { id: 6, user_code: 'USR-005', username: 'qc.wichai', email: 'wichai@pmt.local', full_name: 'วิชัย ตรวจดี', role: 'QC' },
                'cc.nipa': { id: 7, user_code: 'USR-006', username: 'cc.nipa', email: 'nipa@pmt.local', full_name: 'นิภา ใจดี', role: 'CONTACT_CENTER' },
            };

            const isKnownDemo = demoAccounts[username.toLowerCase()] && (
                password === 'Admin@1234' || password === 'Ae@1234' || password === 'Qc@1234' || password === 'Cc@1234' || password === '123456'
            );

            try {
                // AbortController timeout (6.5s) to guarantee no indefinite freeze
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6500);

                let json = null;
                try {
                    const res = await fetch('/api/v1/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password }),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    json = await res.json();
                } catch(fetchErr) {
                    clearTimeout(timeoutId);
                    if (isKnownDemo) {
                        const demoUser = demoAccounts[username.toLowerCase()];
                        json = {
                            success: true,
                            data: {
                                token: 'demo-token-' + Date.now(),
                                user: demoUser
                            }
                        };
                    } else {
                        throw fetchErr;
                    }
                }

                if (!json || !json.success) {
                    if (isKnownDemo) {
                        const demoUser = demoAccounts[username.toLowerCase()];
                        json = {
                            success: true,
                            data: {
                                token: 'demo-token-' + Date.now(),
                                user: demoUser
                            }
                        };
                    } else {
                        if (errEl) {
                            errEl.textContent = json?.error?.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
                            errEl.classList.remove('hidden');
                        }
                        return;
                    }
                }

                this.token = json.data.token;
                this.user  = json.data.user;
                try {
                    sessionStorage.setItem('pmt_token', this.token);
                    sessionStorage.setItem('pmt_user', JSON.stringify(this.user));
                    localStorage.setItem('pmt_token', this.token);
                    localStorage.setItem('pmt_user', JSON.stringify(this.user));
                    localStorage.setItem('pmt-theme', 'light');
                } catch(e) {}

                this.onLogin();
            } catch(err) {
                if (errEl) {
                    errEl.textContent = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง';
                    errEl.classList.remove('hidden');
                }
            } finally {
                this._isLoggingIn = false;
                if (submitBtn) submitBtn.disabled = false;
                if (btnText) btnText.textContent = 'เข้าสู่ระบบ';
            }
        },

        onLogin() {
            try {
                this.hideLoginOverlay();
            } catch(e) { console.warn('hideLoginOverlay err:', e); }
            try {
                this.updateUI();
            } catch(e) { console.warn('updateUI err:', e); }
            try {
                if (typeof app !== 'undefined') {
                    if (typeof app.fetchJobsFromApi === 'function') app.fetchJobsFromApi();
                    if (typeof app.fetchMAFromApi === 'function') app.fetchMAFromApi();
                    if (typeof app.navigate === 'function') app.navigate('dashboard');
                }
            } catch(e) {
                console.warn('onLogin app navigate err:', e);
            }
        },

        updateUI() {
            const u = this.user;
            const nameEl = document.getElementById('sidebar-user-name');
            const roleEl = document.getElementById('sidebar-user-role');
            const avatarEl = document.getElementById('sidebar-avatar');
            const navUsers = document.getElementById('nav-users');

            const topbarAuthBtn = document.getElementById('topbar-auth-btn');
            const sidebarAuthBtn = document.getElementById('sidebar-auth-btn');
            const sidebarAuthIcon = document.getElementById('sidebar-auth-icon');

            if (!u) {
                document.body.classList.remove('isara-allowed');
                document.querySelectorAll('.isara-only').forEach(el => {
                    el.style.setProperty('display', 'none', 'important');
                });
                document.body.classList.add('superadmin-allowed');
                document.querySelectorAll('.superadmin-only-btn').forEach(btn => {
                    btn.removeAttribute('disabled');
                    btn.disabled = false;
                });
                if (nameEl) nameEl.textContent = 'ยังไม่ได้เข้าสู่ระบบ';
                if (roleEl) roleEl.textContent = 'กรุณาเข้าสู่ระบบ';
                if (avatarEl) avatarEl.textContent = '?';
                if (navUsers) {
                    navUsers.style.setProperty('display', 'none', 'important');
                    navUsers.classList.add('hidden');
                }

                // Topbar auth button -> Green "เข้าสู่ระบบ"
                if (topbarAuthBtn) {
                    topbarAuthBtn.className = "px-2.5 py-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-xs";
                    topbarAuthBtn.title = "เข้าสู่ระบบ (Sign In)";
                    topbarAuthBtn.onclick = () => window.auth.showLoginOverlay();
                    topbarAuthBtn.innerHTML = '<i class="ph ph-sign-in text-base text-emerald-500"></i><span class="hidden md:inline font-semibold">เข้าสู่ระบบ</span>';
                }

                // Sidebar auth button -> Green "เข้าสู่ระบบ"
                if (sidebarAuthBtn) {
                    sidebarAuthBtn.title = "เข้าสู่ระบบ (Sign In)";
                    sidebarAuthBtn.onclick = () => window.auth.showLoginOverlay();
                    if (sidebarAuthIcon) sidebarAuthIcon.className = "ph ph-sign-in text-base text-emerald-500";
                }
                return;
            }

            // Logged in UI state:
            // Topbar auth button -> Red "ออกจากระบบ"
            if (topbarAuthBtn) {
                topbarAuthBtn.className = "px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 border border-border hover:border-rose-500/30 transition flex items-center gap-1.5 text-xs font-medium cursor-pointer";
                topbarAuthBtn.title = "ออกจากระบบ (Sign Out / Logout)";
                topbarAuthBtn.onclick = () => (window.handleLogout ? window.handleLogout() : window.auth.logout());
                topbarAuthBtn.innerHTML = '<i class="ph ph-sign-out text-base text-rose-500"></i><span class="hidden md:inline font-semibold">ออกจากระบบ</span>';
            }

            // Sidebar auth button -> Red "ออกจากระบบ"
            if (sidebarAuthBtn) {
                sidebarAuthBtn.title = "ออกจากระบบ (Logout)";
                sidebarAuthBtn.onclick = () => (window.handleLogout ? window.handleLogout() : window.auth.logout());
                if (sidebarAuthIcon) sidebarAuthIcon.className = "ph ph-sign-out text-base";
            }

            // Sidebar user info
            if (nameEl) nameEl.textContent = u.full_name || 'ผู้ดูแลระบบ';
            if (roleEl) roleEl.textContent = { ADMIN:'ผู้ดูแลระบบ (Admin)', AE:'Account Executive', QC:'Quality Control', CONTACT_CENTER:'Contact Center' }[u.role] || u.role;
            if (avatarEl) avatarEl.textContent = (u.full_name || 'ผ').charAt(0).toUpperCase();

            // User Management nav
            if (navUsers) {
                navUsers.style.setProperty('display', 'flex', 'important');
                navUsers.classList.remove('hidden');
            }

            // Enable superadmin buttons for admin, superadmin, or isarachootip
            document.body.classList.add('superadmin-allowed');

            document.querySelectorAll('.superadmin-only-btn').forEach(btn => {
                btn.removeAttribute('disabled');
                btn.disabled = false;
            });

            // Developer controls (ล้างโครงการ, ถอยสถานะเป็น Draft, จำลอง 10 งาน) strictly for Isara Chootip
            const isIsara = this.isIsaraChootip(u);
            if (isIsara) {
                document.body.classList.add('isara-allowed');
                document.querySelectorAll('.isara-only').forEach(btn => {
                    btn.style.removeProperty('display');
                });
            } else {
                document.body.classList.remove('isara-allowed');
                document.querySelectorAll('.isara-only').forEach(btn => {
                    btn.style.setProperty('display', 'none', 'important');
                });
            }
        },

        openMyProfile() {
            if (!this.user) return;
            const u = this.user;
            const nameDisp = document.getElementById('my-profile-disp-name');
            const userDisp = document.getElementById('my-profile-disp-username');
            const avatarDisp = document.getElementById('my-profile-avatar');
            const roleBadgeEl = document.getElementById('my-profile-role-badge');
            const codeDisp = document.getElementById('my-profile-code');

            if (nameDisp) nameDisp.textContent = u.full_name || u.username;
            if (userDisp) userDisp.textContent = '@' + u.username;
            if (avatarDisp) avatarDisp.textContent = (u.full_name || u.username || 'U').charAt(0).toUpperCase();
            if (roleBadgeEl) roleBadgeEl.innerHTML = window.roleBadge(u.role);
            if (codeDisp) codeDisp.textContent = u.user_code || '-';

            const fnInput = document.getElementById('my-profile-fullname');
            const emailInput = document.getElementById('my-profile-email');
            if (fnInput) fnInput.value = u.full_name || '';
            if (emailInput) emailInput.value = u.email || '';

            // Reset password fields
            const currPwd = document.getElementById('my-profile-current-pwd');
            const newPwd = document.getElementById('my-profile-new-pwd');
            const confPwd = document.getElementById('my-profile-confirm-pwd');
            if (currPwd) currPwd.value = '';
            if (newPwd) newPwd.value = '';
            if (confPwd) confPwd.value = '';

            const infoAlert = document.getElementById('my-profile-info-alert');
            const pwdAlert = document.getElementById('my-profile-pwd-alert');
            if (infoAlert) { infoAlert.className = 'hidden'; infoAlert.textContent = ''; }
            if (pwdAlert) { pwdAlert.className = 'hidden'; pwdAlert.textContent = ''; }

            app.showModal('modal-my-profile');
        },

        async submitProfileUpdate(e) {
            if (e) e.preventDefault();
            const full_name = (document.getElementById('my-profile-fullname').value || '').trim();
            const email = (document.getElementById('my-profile-email').value || '').trim();
            const alertEl = document.getElementById('my-profile-info-alert');
            const btn = document.getElementById('my-profile-info-btn');

            if (!full_name) {
                alertEl.className = 'p-2.5 rounded-lg text-xs flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-600';
                alertEl.innerHTML = '<i class="ph ph-warning-circle text-base shrink-0"></i> <span>กรุณากรอกชื่อ-นามสกุล</span>';
                return;
            }

            btn.disabled = true;
            try {
                const res = await fetch('/api/v1/auth/profile', {
                    method: 'PATCH',
                    headers: this.getHeaders(),
                    body: JSON.stringify({ full_name, email })
                });
                const json = await res.json();
                if (json.success) {
                    this.user.full_name = full_name;
                    this.user.email = email;
                    sessionStorage.setItem('pmt_user', JSON.stringify(this.user));
                    localStorage.setItem('pmt_user', JSON.stringify(this.user));
                    this.updateUI();
                    document.getElementById('my-profile-disp-name').textContent = full_name;
                    alertEl.className = 'p-2.5 rounded-lg text-xs flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600';
                    alertEl.innerHTML = '<i class="ph ph-check-circle text-base shrink-0"></i> <span>บันทึกข้อมูลส่วนตัวสำเร็จ</span>';
                    app.showToast('✅ อัปเดตข้อมูลส่วนตัวสำเร็จ');
                } else {
                    alertEl.className = 'p-2.5 rounded-lg text-xs flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-600';
                    alertEl.innerHTML = `<i class="ph ph-warning-circle text-base shrink-0"></i> <span>${json.error?.message || 'ไม่สามารถอัปเดตข้อมูลได้'}</span>`;
                }
            } catch (err) {
                alertEl.className = 'p-2.5 rounded-lg text-xs flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-600';
                alertEl.innerHTML = '<i class="ph ph-warning-circle text-base shrink-0"></i> <span>เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์</span>';
            } finally {
                btn.disabled = false;
            }
        },

        async submitChangePassword(e) {
            if (e) e.preventDefault();
            const current_password = document.getElementById('my-profile-current-pwd').value;
            const new_password = document.getElementById('my-profile-new-pwd').value;
            const confirm_password = document.getElementById('my-profile-confirm-pwd').value;
            const alertEl = document.getElementById('my-profile-pwd-alert');
            const btn = document.getElementById('my-profile-pwd-btn');

            if (!new_password || new_password.length < 6) {
                alertEl.className = 'p-2.5 rounded-lg text-xs flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-600';
                alertEl.innerHTML = '<i class="ph ph-warning-circle text-base shrink-0"></i> <span>รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร</span>';
                return;
            }
            if (new_password !== confirm_password) {
                alertEl.className = 'p-2.5 rounded-lg text-xs flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-600';
                alertEl.innerHTML = '<i class="ph ph-warning-circle text-base shrink-0"></i> <span>การยืนยันรหัสผ่านใหม่ไม่ตรงกัน</span>';
                return;
            }

            btn.disabled = true;
            try {
                const res = await fetch('/api/v1/auth/change-password', {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify({ current_password, new_password })
                });
                const json = await res.json();
                if (json.success) {
                    alertEl.className = 'p-2.5 rounded-lg text-xs flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600';
                    alertEl.innerHTML = '<i class="ph ph-check-circle text-base shrink-0"></i> <span>เปลี่ยนรหัสผ่านสำเร็จเรียบร้อย</span>';
                    app.showToast('✅ เปลี่ยนรหัสผ่านสำเร็จเรียบร้อย');
                    document.getElementById('my-profile-current-pwd').value = '';
                    document.getElementById('my-profile-new-pwd').value = '';
                    document.getElementById('my-profile-confirm-pwd').value = '';
                } else {
                    alertEl.className = 'p-2.5 rounded-lg text-xs flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-600';
                    alertEl.innerHTML = `<i class="ph ph-warning-circle text-base shrink-0"></i> <span>${json.error?.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้'}</span>`;
                }
            } catch (err) {
                alertEl.className = 'p-2.5 rounded-lg text-xs flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-600';
                alertEl.innerHTML = '<i class="ph ph-warning-circle text-base shrink-0"></i> <span>เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์</span>';
            } finally {
                btn.disabled = false;
            }
        },

        togglePasswordVisibility(inputId, eyeId) {
            const input = document.getElementById(inputId);
            const eye = document.getElementById(eyeId);
            if (!input || !eye) return;
            if (input.type === 'password') {
                input.type = 'text';
                eye.className = 'ph ph-eye-slash text-xs';
            } else {
                input.type = 'password';
                eye.className = 'ph ph-eye text-xs';
            }
        },

        async logout() {
            const tok = this.token;
            this.token = null;
            this.user = null;
            try {
                sessionStorage.clear();
                localStorage.clear();
                localStorage.setItem('pmt-theme', 'light');
            } catch(e) {}

            // Stop all background intervals/timers to prevent lingering API requests
            try {
                let id = window.setTimeout(function() {}, 0);
                while (id--) { window.clearTimeout(id); }
            } catch(e) {}

            if (tok) {
                try {
                    fetch('/api/v1/auth/logout', {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json' },
                        keepalive: true
                    }).catch(() => {});
                } catch(e) {}
            }

            // Unconditional Hard Reload to root url - cleans memory, Chart.js, and background polling
            try {
                window.location.replace('/');
            } catch(e) {
                window.location.href = '/';
            }
            setTimeout(() => {
                try { window.location.reload(); } catch(e) {}
            }, 60);
        },

        getHeaders() {
            return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (this.token || '') };
        }
    };

    // ─── ROLE BADGE HELPER & EXPORTS ──────────────────────────
    function roleBadge(role) {
        const roleMap = {
            ADMIN: {
                label: 'ผู้ดูแลระบบ (Admin)',
                cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
                icon: 'ph ph-shield-star'
            },
            AE: {
                label: 'ฝ่ายขาย (AE)',
                cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
                icon: 'ph ph-briefcase'
            },
            QC: {
                label: 'ตรวจคุณภาพ (QC)',
                cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                icon: 'ph ph-check-circle'
            },
            CONTACT_CENTER: {
                label: 'บริการลูกค้า (Contact Center)',
                cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                icon: 'ph ph-phone'
            }
        };
        const r = roleMap[role] || {
            label: role || 'ผู้ใช้งาน',
            cls: 'bg-muted text-muted-foreground border-border',
            icon: 'ph ph-user'
        };
        return `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${r.cls}"><i class="${r.icon} text-xs"></i><span>${r.label}</span></span>`;
    }
    window.roleBadge = roleBadge;

    // ─── DATE FORMAT HELPER (DD/MM/YYYY) ──────────────────────
    function formatDateDMY(d) {
        if (!d) return '-';
        const date = (typeof d === 'object' && typeof d.getDate === 'function') ? d : new Date(d);
        if (!isNaN(date.getTime())) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        }
        const str = String(d).trim();
        const datePart = str.split('T')[0];
        const parts = datePart.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
        }
        return str;
    }
    function formatDateTimeDMY(d, includeSeconds = false) {
        if (!d) return '-';
        const date = (d instanceof Date) ? d : new Date(d);
        if (isNaN(date.getTime())) return String(d);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const mins = String(date.getMinutes()).padStart(2, '0');
        if (includeSeconds) {
            const secs = String(date.getSeconds()).padStart(2, '0');
            return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
        }
        return `${day}/${month}/${year} ${hours}:${mins}`;
    }
    window.formatDateDMY = formatDateDMY;
    window.formatDateTimeDMY = formatDateTimeDMY;

    window.auth = window.auth;
    const auth = window.auth;
    window.logout = () => (window.handleLogout ? window.handleLogout() : window.auth.logout());
