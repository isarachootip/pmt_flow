// Auth Module
window.auth =  {
        token: null,
        user:  null,
        defaultUser: {
            id: 1,
            user_code: 'USR-001',
            username: 'admin',
            email: 'isarachootip@gmail.com',
            full_name: 'ผู้ดูแลระบบ',
            role: 'ADMIN',
            is_active: true
        },

        init() {
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
            const pageContainer = document.getElementById('page-container');
            if (overlay) {
                overlay.style.setProperty('display', 'flex', 'important');
                overlay.classList.remove('hidden');
            }
            if (pageContainer) {
                pageContainer.style.setProperty('display', 'none', 'important');
            }
        },
        hideLoginOverlay() {
            const overlay = document.getElementById('login-overlay');
            const pageContainer = document.getElementById('page-container');
            if (overlay) {
                overlay.style.setProperty('display', 'none', 'important');
                overlay.classList.add('hidden');
            }
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

        async login(e) {
            e.preventDefault();
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;
            const errEl    = document.getElementById('login-error');
            const btnText  = document.getElementById('login-btn-text');

            errEl.classList.add('hidden'); errEl.textContent = '';
            btnText.textContent = 'กำลังเข้าสู่ระบบ...';

            try {
                const res  = await fetch('/api/v1/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const json = await res.json();
                if (!json.success) {
                    errEl.textContent = json.error?.message || 'เข้าสู่ระบบไม่สำเร็จ';
                    errEl.classList.remove('hidden');
                    btnText.textContent = 'เข้าสู่ระบบ';
                    return;
                }
                this.token = json.data.token;
                this.user  = json.data.user;
                sessionStorage.setItem('pmt_token', this.token);
                sessionStorage.setItem('pmt_user', JSON.stringify(this.user));
                localStorage.setItem('pmt_token', this.token);
                localStorage.setItem('pmt_user', JSON.stringify(this.user));
                this.onLogin();
                btnText.textContent = 'เข้าสู่ระบบ';
            } catch(err) {
                errEl.textContent = 'ไม่สามารถเชื่อมต่อ Server ได้';
                errEl.classList.remove('hidden');
                btnText.textContent = 'เข้าสู่ระบบ';
            }
        },

        onLogin() {
            this.hideLoginOverlay();
            this.updateUI();
            if (typeof app !== 'undefined') app.navigate('dashboard');
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
                document.body.classList.remove('superadmin-allowed');
                document.querySelectorAll('.superadmin-only-btn').forEach(btn => {
                    btn.setAttribute('disabled', 'disabled');
                    btn.disabled = true;
                    btn.title = '🔒 กรุณาเข้าสู่ระบบ';
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

            // Enable / Disable superadmin buttons (only enabled for isarachootip@gmail.com)
            const isSuperUser = (
                (u.email && u.email.toLowerCase() === 'isarachootip@gmail.com') ||
                (u.username && u.username.toLowerCase() === 'isarachootip@gmail.com')
            );
            if (isSuperUser) {
                document.body.classList.add('superadmin-allowed');
            } else {
                document.body.classList.remove('superadmin-allowed');
            }

            document.querySelectorAll('.superadmin-only-btn').forEach(btn => {
                if (isSuperUser) {
                    btn.removeAttribute('disabled');
                    btn.disabled = false;
                } else {
                    btn.setAttribute('disabled', 'disabled');
                    btn.disabled = true;
                    btn.title = '🔒 ฟังก์ชันนี้เฉพาะผู้ใช้ isarachootip@gmail.com เท่านั้น (Disabled)';
                }
            });
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
            if (roleBadgeEl) roleBadgeEl.innerHTML = roleBadge(u.role);
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
            const currentTheme = localStorage.getItem('pmt-theme');
            try { sessionStorage.removeItem('pmt_token'); } catch(e) {}
            try { sessionStorage.removeItem('pmt_user'); } catch(e) {}
            try { localStorage.removeItem('pmt_token'); } catch(e) {}
            try { localStorage.removeItem('pmt_user'); } catch(e) {}
            try { localStorage.clear(); } catch(e) {}
            try { sessionStorage.clear(); } catch(e) {}
            if (currentTheme) {
                try { localStorage.setItem('pmt-theme', currentTheme); } catch(e) {}
            }
            this.updateUI();
            this.showLoginOverlay();
            if (tok) {
                fetch('/api/v1/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + tok } }).catch(() => {});
            }
        },

        getHeaders() {
            return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (this.token || '') };
        }
    };

    // ─── USER MANAGEMENT MODULE & EXPORTS ─────────────────────
    window.auth = window.auth;
    const auth = window.auth;
    window.logout = () => (window.handleLogout ? window.handleLogout() : window.auth.logout());
