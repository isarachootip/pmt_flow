// User Management Module
window.userMgmt =  {
        defaultSeedUsers: [
            { id: 1, user_code: 'USR-001', username: 'admin', email: 'isarachootip@gmail.com', full_name: 'ผู้ดูแลระบบ', role: 'ADMIN', is_active: true, last_login_at: new Date().toISOString() },
            { id: 2, user_code: 'USR-002', username: 'ae.somchai', email: 'ae@pmt.local', full_name: 'สมชาย ขายเก่ง', role: 'AE', is_active: true, last_login_at: null },
            { id: 3, user_code: 'USR-003', username: 'qc.wichai', email: 'qc@pmt.local', full_name: 'วิชัย ตรวจละเอียด', role: 'QC', is_active: true, last_login_at: null },
            { id: 4, user_code: 'USR-004', username: 'cc.nipa', email: 'cc@pmt.local', full_name: 'นิภา บริการดี', role: 'CONTACT_CENTER', is_active: true, last_login_at: null }
        ],
        users: [],
        filtered: [],
        roleFilter: 'ALL',
        statusFilter: 'ALL',
        searchQuery: '',
        loginLogs: [],
        filteredLogs: [],
        selectedRole: 'AE',
        selectedUserForToggle: null,

        async load() {
            const refreshIcon = document.getElementById('user-refresh-icon');
            if (refreshIcon) refreshIcon.classList.add('animate-spin');
            try {
                const res  = await fetch('/api/v1/users', { headers: auth.getHeaders() });
                const json = await res.json();
                if (json.success && Array.isArray(json.data) && json.data.length) {
                    this.users = json.data;
                } else {
                    if (!this.users.length) this.users = [...this.defaultSeedUsers];
                }
            } catch(e) {
                console.warn('API /api/v1/users fallback to seed users', e);
                if (!this.users.length) this.users = [...this.defaultSeedUsers];
            } finally {
                if (!this.users.length) this.users = [...this.defaultSeedUsers];
                this.applyFilters();
                this.renderStats();
                if (refreshIcon) {
                    setTimeout(() => refreshIcon.classList.remove('animate-spin'), 350);
                }
            }
        },

        renderStats() {
            const counts = { ADMIN: 0, AE: 0, QC: 0, CONTACT_CENTER: 0 };
            this.users.forEach(u => {
                if (counts[u.role] !== undefined) counts[u.role]++;
            });
            const statAdmin = document.getElementById('stat-admin');
            const statAe = document.getElementById('stat-ae');
            const statQc = document.getElementById('stat-qc');
            const statCc = document.getElementById('stat-cc');
            if (statAdmin) statAdmin.textContent = counts.ADMIN;
            if (statAe) statAe.textContent = counts.AE;
            if (statQc) statQc.textContent = counts.QC;
            if (statCc) statCc.textContent = counts.CONTACT_CENTER;

            // Update role pill counts
            const countAll = document.getElementById('count-role-all');
            const countAdmin = document.getElementById('count-role-admin');
            const countAe = document.getElementById('count-role-ae');
            const countQc = document.getElementById('count-role-qc');
            const countCc = document.getElementById('count-role-cc');
            if (countAll) countAll.textContent = this.users.length;
            if (countAdmin) countAdmin.textContent = counts.ADMIN;
            if (countAe) countAe.textContent = counts.AE;
            if (countQc) countQc.textContent = counts.QC;
            if (countCc) countCc.textContent = counts.CONTACT_CENTER;
        },

        handleSearch(q) {
            this.searchQuery = (q || '').trim();
            const clearBtn = document.getElementById('user-search-clear');
            if (clearBtn) {
                if (this.searchQuery) clearBtn.classList.remove('hidden');
                else clearBtn.classList.add('hidden');
            }
            this.applyFilters();
        },

        clearSearch() {
            const searchInput = document.getElementById('user-search');
            if (searchInput) searchInput.value = '';
            this.handleSearch('');
        },

        setRoleFilter(role) {
            this.roleFilter = role;
            // Update active pill UI
            document.querySelectorAll('.user-role-pill').forEach(btn => {
                btn.className = 'user-role-pill px-3 py-1.5 rounded-lg font-medium transition text-muted-foreground hover:bg-muted border border-transparent cursor-pointer';
            });
            const activeBtn = document.getElementById('role-pill-' + role);
            if (activeBtn) {
                activeBtn.className = 'user-role-pill px-3 py-1.5 rounded-lg font-medium transition bg-brand-500/10 text-brand-500 border border-brand-500/20 shadow-xs cursor-pointer';
            }

            // Update stat cards border highlight
            document.querySelectorAll('.user-stat-card').forEach(card => {
                card.classList.remove('ring-2', 'ring-brand-500');
            });
            if (role !== 'ALL') {
                const activeCard = document.getElementById('stat-card-' + role);
                if (activeCard) activeCard.classList.add('ring-2', 'ring-brand-500');
            }

            this.applyFilters();
        },

        setStatusFilter(status) {
            this.statusFilter = status;
            this.applyFilters();
        },

        applyFilters() {
            const q = this.searchQuery.toLowerCase();
            this.filtered = this.users.filter(u => {
                // Role filter
                if (this.roleFilter !== 'ALL' && u.role !== this.roleFilter) return false;

                // Status filter
                if (this.statusFilter === 'ACTIVE' && !u.is_active) return false;
                if (this.statusFilter === 'INACTIVE' && u.is_active) return false;

                // Search query
                if (q) {
                    const matchName = (u.full_name || '').toLowerCase().includes(q);
                    const matchUser = (u.username || '').toLowerCase().includes(q);
                    const matchEmail = (u.email || '').toLowerCase().includes(q);
                    const matchCode = (u.user_code || '').toLowerCase().includes(q);
                    if (!matchName && !matchUser && !matchEmail && !matchCode) return false;
                }

                return true;
            });

            this.render();
        },

        render() {
            const tbody = document.getElementById('user-table-body');
            if (!tbody) return;

            if (!this.filtered.length) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="px-5 py-16 text-center">
                            <div class="max-w-xs mx-auto space-y-3">
                                <div class="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                                    <i class="ph ph-user-circle-gear text-2xl"></i>
                                </div>
                                <div>
                                    <p class="text-xs font-semibold text-foreground">ไม่พบข้อมูลผู้ใช้งาน</p>
                                    <p class="text-[11px] text-muted-foreground mt-0.5">ลองปรับคำค้นหาหรือเปลี่ยนตัวกรองบทบาทและสถานะ</p>
                                </div>
                                <button onclick="userMgmt.resetFilters()" class="btn-artifact-secondary px-3 py-1.5 rounded-lg text-xs cursor-pointer">
                                    ล้างตัวกรองทั้งหมด
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = this.filtered.map(u => {
                const avatarBgMap = {
                    ADMIN: 'bg-rose-500/10 text-rose-500',
                    AE: 'bg-blue-500/10 text-blue-500',
                    QC: 'bg-emerald-500/10 text-emerald-600',
                    CONTACT_CENTER: 'bg-amber-500/10 text-amber-600'
                };
                const avatarCls = avatarBgMap[u.role] || 'bg-muted text-muted-foreground';
                const initial = (u.full_name || u.username || 'U').trim().charAt(0).toUpperCase();
                const lastLogin = u.last_login_at ? new Date(u.last_login_at).toLocaleString('th-TH', {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                }) : 'ยังไม่เคยเข้าสู่ระบบ';

                return `
                    <tr class="hover:bg-muted/30 transition-colors ${!u.is_active ? 'opacity-50' : ''}">
                        <td class="px-5 py-3.5 text-muted-foreground font-mono text-[11px] font-medium">${u.user_code}</td>
                        <td class="px-5 py-3.5">
                            <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-lg ${avatarCls} font-bold text-xs flex items-center justify-center shrink-0">
                                    ${initial}
                                </div>
                                <div>
                                    <p class="font-medium text-foreground text-xs leading-none">${u.full_name}</p>
                                    <p class="text-[10px] text-muted-foreground font-mono mt-1">${u.username}</p>
                                </div>
                            </div>
                        </td>
                        <td class="px-5 py-3.5">
                            <span class="inline-block px-2 py-0.5 rounded-md bg-muted/70 text-foreground font-mono text-[11px] border border-border/60">
                                ${u.username}
                            </span>
                        </td>
                        <td class="px-5 py-3.5 text-muted-foreground text-xs">${u.email || '-'}</td>
                        <td class="px-5 py-3.5">${roleBadge(u.role)}</td>
                        <td class="px-5 py-3.5">
                            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${u.is_active ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-muted text-muted-foreground border-border'}">
                                <span class="w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}"></span>
                                ${u.is_active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
                            </span>
                        </td>
                        <td class="px-5 py-3.5 text-muted-foreground text-[11px]">${lastLogin}</td>
                        <td class="px-5 py-3.5 text-right">
                            <div class="flex items-center justify-end gap-1">
                                <button onclick="userMgmt.openEdit(${u.id})" title="แก้ไขข้อมูล" class="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-brand-500 transition cursor-pointer">
                                    <i class="ph ph-pencil-simple text-sm"></i>
                                </button>
                                <button onclick="userMgmt.openResetPassword(${u.id})" title="รีเซ็ตรหัสผ่าน" class="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-amber-500 transition cursor-pointer">
                                    <i class="ph ph-key text-sm"></i>
                                </button>
                                ${u.username !== 'admin' ? `
                                    <button onclick="userMgmt.openToggleActive(${u.id})" title="${u.is_active ? 'ปิดใช้งานบัญชี' : 'เปิดใช้งานบัญชี'}" class="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-rose-500 transition cursor-pointer">
                                        <i class="ph ph-${u.is_active ? 'prohibit' : 'check-circle'} text-sm"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        },

        resetFilters() {
            this.searchQuery = '';
            const searchInput = document.getElementById('user-search');
            if (searchInput) searchInput.value = '';
            const statusSelect = document.getElementById('user-status-filter');
            if (statusSelect) statusSelect.value = 'ALL';
            this.statusFilter = 'ALL';
            this.setRoleFilter('ALL');
        },

        selectRole(role) {
            this.selectedRole = role;
            const roleInput = document.getElementById('user-form-role');
            if (roleInput) roleInput.value = role;

            document.querySelectorAll('.user-role-card').forEach(card => {
                card.classList.remove('ring-2', 'ring-brand-500', 'border-transparent', 'bg-brand-500/5');
            });
            const activeCard = document.getElementById('role-card-' + role);
            if (activeCard) {
                activeCard.classList.add('ring-2', 'ring-brand-500', 'bg-brand-500/5');
            }
        },

        openCreate() {
            const form = document.querySelector('#modal-user-form form');
            if (form) form.reset();

            document.getElementById('user-form-id').value = '';
            document.getElementById('user-form-mode').value = 'create';
            document.getElementById('user-form-title').innerText = 'เพิ่มผู้ใช้งานใหม่';
            document.getElementById('user-form-subtitle').innerText = 'สร้างบัญชีผู้ใช้งานและกำหนดบทบาทในระบบ PMT Flow';
            document.getElementById('user-form-submit-text').innerText = 'บันทึกข้อมูล';

            const iconBg = document.getElementById('user-form-icon-bg');
            const icon = document.getElementById('user-form-icon');
            if (iconBg) iconBg.className = 'w-9 h-9 rounded-xl bg-brand-500/15 text-brand-500 flex items-center justify-center shrink-0';
            if (icon) icon.className = 'ph ph-user-plus text-lg';

            // Username field
            const usernameInput = document.getElementById('user-form-username');
            usernameInput.disabled = false;
            usernameInput.readOnly = false;
            usernameInput.classList.remove('opacity-60', 'bg-muted');
            usernameInput.classList.add('bg-muted/50');
            document.getElementById('user-form-username-help').innerText = 'ใช้ตัวอักษรภาษาอังกฤษหรือจุด (.)';

            // Password field (visible and required)
            const pwdWrapper = document.getElementById('user-form-password-wrapper');
            pwdWrapper.classList.remove('hidden');
            const pwdInput = document.getElementById('user-form-password');
            pwdInput.required = true;
            pwdInput.value = '';

            // Status wrapper (hidden on create)
            document.getElementById('user-form-status-wrapper').classList.add('hidden');

            // Hide error alert
            document.getElementById('user-form-error').classList.add('hidden');

            // Default role: AE
            this.selectRole('AE');

            app.showModal('modal-user-form');
            setTimeout(() => document.getElementById('user-form-fullname').focus(), 100);
        },

        openEdit(id) {
            const u = this.users.find(x => x.id === id);
            if (!u) return;

            document.getElementById('user-form-id').value = u.id;
            document.getElementById('user-form-mode').value = 'edit';
            document.getElementById('user-form-title').innerText = 'แก้ไขข้อมูลผู้ใช้งาน';
            document.getElementById('user-form-subtitle').innerText = `แก้ไขข้อมูลสำหรับบัญชี ${u.username} (${u.user_code})`;
            document.getElementById('user-form-submit-text').innerText = 'บันทึกการแก้ไข';

            const iconBg = document.getElementById('user-form-icon-bg');
            const icon = document.getElementById('user-form-icon');
            if (iconBg) iconBg.className = 'w-9 h-9 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0';
            if (icon) icon.className = 'ph ph-pencil-simple text-lg';

            // Populate fields
            document.getElementById('user-form-fullname').value = u.full_name || '';
            const usernameInput = document.getElementById('user-form-username');
            usernameInput.value = u.username || '';
            usernameInput.disabled = true;
            usernameInput.readOnly = true;
            usernameInput.classList.add('opacity-60', 'bg-muted');
            usernameInput.classList.remove('bg-muted/50');
            document.getElementById('user-form-username-help').innerText = 'ไม่สามารถแก้ไข Username ได้';

            document.getElementById('user-form-email').value = u.email || '';

            // Password hidden in edit mode (dedicated reset password modal is available)
            const pwdWrapper = document.getElementById('user-form-password-wrapper');
            pwdWrapper.classList.add('hidden');
            const pwdInput = document.getElementById('user-form-password');
            pwdInput.required = false;

            // Status wrapper
            const statusWrapper = document.getElementById('user-form-status-wrapper');
            statusWrapper.classList.remove('hidden');
            const statusCheckbox = document.getElementById('user-form-status');
            statusCheckbox.checked = Boolean(u.is_active);
            if (u.username === 'admin') {
                statusCheckbox.disabled = true;
                document.getElementById('user-form-status-desc').innerText = 'บัญชี Admin หลักไม่สามารถปิดใช้งานได้';
            } else {
                statusCheckbox.disabled = false;
                this.handleStatusCheckboxChange(statusCheckbox);
            }

            // Role selection
            this.selectRole(u.role);

            // Hide error alert
            document.getElementById('user-form-error').classList.add('hidden');

            app.showModal('modal-user-form');
        },

        handleStatusCheckboxChange(el) {
            const desc = document.getElementById('user-form-status-desc');
            if (el.checked) {
                desc.innerText = 'เปิดใช้งานอยู่ (ผู้ใช้สามารถเข้าสู่ระบบได้ตามปกติ)';
            } else {
                desc.innerText = 'ปิดใช้งาน (ผู้ใช้จะไม่สามารถเข้าสู่ระบบได้)';
            }
        },

        togglePasswordVisibility(inputId, eyeId) {
            const input = document.getElementById(inputId);
            const eye = document.getElementById(eyeId);
            if (!input || !eye) return;
            if (input.type === 'password') {
                input.type = 'text';
                eye.className = 'ph ph-eye-slash text-sm';
            } else {
                input.type = 'password';
                eye.className = 'ph ph-eye text-sm';
            }
        },

        async submitForm(e) {
            if (e) e.preventDefault();
            const mode = document.getElementById('user-form-mode').value;
            const id = document.getElementById('user-form-id').value;
            const full_name = document.getElementById('user-form-fullname').value.trim();
            const username = document.getElementById('user-form-username').value.trim();
            const email = document.getElementById('user-form-email').value.trim();
            const role = document.getElementById('user-form-role').value;
            const errBox = document.getElementById('user-form-error');
            const errMsg = document.getElementById('user-form-error-msg');
            const submitBtn = document.getElementById('user-form-submit-btn');

            errBox.classList.add('hidden');

            if (!full_name) {
                errMsg.innerText = 'กรุณากรอกชื่อ-นามสกุล';
                errBox.classList.remove('hidden');
                return;
            }

            if (mode === 'create') {
                if (!username) {
                    errMsg.innerText = 'กรุณากรอก Username';
                    errBox.classList.remove('hidden');
                    return;
                }
                const password = document.getElementById('user-form-password').value;
                if (!password || password.length < 6) {
                    errMsg.innerText = 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
                    errBox.classList.remove('hidden');
                    return;
                }

                submitBtn.disabled = true;
                submitBtn.classList.add('opacity-70');

                try {
                    const res = await fetch('/api/v1/users', {
                        method: 'POST',
                        headers: auth.getHeaders(),
                        body: JSON.stringify({ full_name, username, email, role, password })
                    });
                    const json = await res.json();
                    if (json.success) {
                        app.showToast(`✅ สร้างผู้ใช้งาน ${username} สำเร็จ`);
                        app.hideModal('modal-user-form');
                        this.load();
                    } else {
                        errMsg.innerText = json.error?.message || 'ไม่สามารถสร้างผู้ใช้งานได้';
                        errBox.classList.remove('hidden');
                    }
                } catch(err) {
                    errMsg.innerText = 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์';
                    errBox.classList.remove('hidden');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('opacity-70');
                }
            } else {
                // Edit mode
                const is_active = document.getElementById('user-form-status').checked;
                submitBtn.disabled = true;
                submitBtn.classList.add('opacity-70');

                try {
                    const res = await fetch('/api/v1/users/' + id, {
                        method: 'PATCH',
                        headers: auth.getHeaders(),
                        body: JSON.stringify({ full_name, email, role, is_active })
                    });
                    const json = await res.json();
                    if (json.success) {
                        app.showToast('✅ บันทึกการแก้ไขข้อมูลสำเร็จ');
                        app.hideModal('modal-user-form');
                        this.load();
                    } else {
                        errMsg.innerText = json.error?.message || 'ไม่สามารถอัปเดตข้อมูลได้';
                        errBox.classList.remove('hidden');
                    }
                } catch(err) {
                    errMsg.innerText = 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์';
                    errBox.classList.remove('hidden');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('opacity-70');
                }
            }
        },

        openResetPassword(id) {
            const u = this.users.find(x => x.id === id);
            if (!u) return;

            document.getElementById('user-reset-pwd-id').value = u.id;
            document.getElementById('user-reset-pwd-name').innerText = u.full_name;
            document.getElementById('user-reset-pwd-username').innerText = u.username;
            document.getElementById('user-reset-pwd-role').innerHTML = roleBadge(u.role);
            document.getElementById('user-reset-pwd-avatar').innerText = (u.full_name || 'U').charAt(0).toUpperCase();

            document.getElementById('user-reset-pwd-new').value = '';
            document.getElementById('user-reset-pwd-confirm').value = '';
            document.getElementById('user-reset-pwd-error').classList.add('hidden');

            app.showModal('modal-user-reset-pwd');
            setTimeout(() => document.getElementById('user-reset-pwd-new').focus(), 100);
        },

        async submitResetPassword(e) {
            if (e) e.preventDefault();
            const id = document.getElementById('user-reset-pwd-id').value;
            const newPwd = document.getElementById('user-reset-pwd-new').value;
            const confirmPwd = document.getElementById('user-reset-pwd-confirm').value;
            const errBox = document.getElementById('user-reset-pwd-error');
            const errMsg = document.getElementById('user-reset-pwd-error-msg');
            const submitBtn = document.getElementById('user-reset-pwd-submit-btn');

            errBox.classList.add('hidden');

            if (!newPwd || newPwd.length < 6) {
                errMsg.innerText = 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
                errBox.classList.remove('hidden');
                return;
            }

            if (newPwd !== confirmPwd) {
                errMsg.innerText = 'การยืนยันรหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง';
                errBox.classList.remove('hidden');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-70');

            try {
                const res = await fetch(`/api/v1/users/${id}/reset-password`, {
                    method: 'POST',
                    headers: auth.getHeaders(),
                    body: JSON.stringify({ new_password: newPwd })
                });
                const json = await res.json();
                if (json.success) {
                    app.showToast('✅ ' + (json.message || 'รีเซ็ตรหัสผ่านสำเร็จ'));
                    app.hideModal('modal-user-reset-pwd');
                } else {
                    errMsg.innerText = json.error?.message || 'ไม่สามารถรีเซ็ตรหัสผ่านได้';
                    errBox.classList.remove('hidden');
                }
            } catch(err) {
                errMsg.innerText = 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์';
                errBox.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-70');
            }
        },

        openToggleActive(id) {
            const u = this.users.find(x => x.id === id);
            if (!u) return;

            this.selectedUserForToggle = u;
            document.getElementById('user-toggle-id').value = u.id;
            document.getElementById('user-toggle-fullname').innerText = u.full_name;
            document.getElementById('user-toggle-username').innerText = u.username;
            document.getElementById('user-toggle-role').innerHTML = roleBadge(u.role);
            document.getElementById('user-toggle-avatar').innerText = (u.full_name || 'U').charAt(0).toUpperCase();

            const isDeactivating = u.is_active;
            document.getElementById('user-toggle-action').value = isDeactivating ? 'deactivate' : 'activate';

            const title = document.getElementById('user-toggle-status-title');
            const iconBg = document.getElementById('user-toggle-icon-bg');
            const icon = document.getElementById('user-toggle-icon');
            const messageBox = document.getElementById('user-toggle-message-box');
            const message = document.getElementById('user-toggle-message');
            const submitBtn = document.getElementById('user-toggle-submit-btn');
            const submitText = document.getElementById('user-toggle-submit-text');
            const submitIcon = document.getElementById('user-toggle-submit-icon');

            if (isDeactivating) {
                title.innerText = 'ยืนยันการปิดใช้งานบัญชี';
                iconBg.className = 'w-9 h-9 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0';
                icon.className = 'ph ph-prohibit text-lg';
                messageBox.className = 'p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2.5';
                message.innerText = `คุณต้องการปิดใช้งานบัญชี "${u.full_name}" (@${u.username}) ใช่หรือไม่? ผู้ใช้จะไม่สามารถ Login เข้าสู่ระบบได้ และ Session ปัจจุบันจะถูกยกเลิกทันที`;
                submitBtn.className = 'btn-artifact-primary px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md cursor-pointer bg-rose-500 hover:bg-rose-600 text-white';
                submitText.innerText = 'ยืนยันปิดใช้งาน';
                submitIcon.className = 'ph ph-prohibit text-sm';
            } else {
                title.innerText = 'ยืนยันการเปิดใช้งานบัญชี';
                iconBg.className = 'w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0';
                icon.className = 'ph ph-check-circle text-lg';
                messageBox.className = 'p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-start gap-2.5';
                message.innerText = `คุณต้องการเปิดใช้งานบัญชี "${u.full_name}" (@${u.username}) ใช่หรือไม่? ผู้ใช้จะสามารถ Login เข้าสู่ระบบและใช้งานได้ตามสิทธิ์ของ Role ทันที`;
                submitBtn.className = 'btn-artifact-primary px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white';
                submitText.innerText = 'ยืนยันเปิดใช้งาน';
                submitIcon.className = 'ph ph-check-circle text-sm';
            }

            app.showModal('modal-user-toggle-status');
        },

        async confirmToggleActive() {
            const u = this.selectedUserForToggle;
            if (!u) return;
            const isDeactivating = u.is_active;
            const submitBtn = document.getElementById('user-toggle-submit-btn');

            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-70');

            try {
                if (isDeactivating) {
                    const res = await fetch('/api/v1/users/' + u.id, {
                        method: 'DELETE',
                        headers: auth.getHeaders()
                    });
                    const json = await res.json();
                    if (json.success) {
                        app.showToast('✅ ' + (json.message || 'ปิดใช้งานบัญชีสำเร็จ'));
                        app.hideModal('modal-user-toggle-status');
                        this.load();
                    } else {
                        app.showToast('❌ ' + (json.error?.message || 'เกิดข้อผิดพลาด'));
                    }
                } else {
                    const res = await fetch('/api/v1/users/' + u.id, {
                        method: 'PATCH',
                        headers: auth.getHeaders(),
                        body: JSON.stringify({ is_active: true })
                    });
                    const json = await res.json();
                    if (json.success) {
                        app.showToast('✅ เปิดใช้งานบัญชีสำเร็จ');
                        app.hideModal('modal-user-toggle-status');
                        this.load();
                    } else {
                        app.showToast('❌ ' + (json.error?.message || 'เกิดข้อผิดพลาด'));
                    }
                }
            } catch(err) {
                app.showToast('❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
            } finally {
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-70');
            }
        },

        async openAuditLogs() {
            app.showModal('modal-user-login-logs');
            await this.loadLoginLogs();
        },

        async loadLoginLogs() {
            const tbody = document.getElementById('user-logs-table-body');
            const info = document.getElementById('user-logs-count-info');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-10 text-center text-muted-foreground text-xs">กำลังโหลดบันทึกประวัติการเข้าสู่ระบบ...</td></tr>`;
            }

            try {
                const res = await fetch('/api/v1/auth/login-logs', { headers: auth.getHeaders() });
                const json = await res.json();
                if (json.success) {
                    this.loginLogs = json.data || [];
                    this.filteredLogs = [...this.loginLogs];
                    this.renderLogs();
                } else {
                    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-10 text-center text-rose-500 text-xs">ไม่สามารถโหลดประวัติได้: ${json.error?.message || ''}</td></tr>`;
                }
            } catch(err) {
                if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-10 text-center text-rose-500 text-xs">เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์</td></tr>`;
            }
        },

        filterLogs(q) {
            const query = (q || '').trim().toLowerCase();
            if (!query) {
                this.filteredLogs = [...this.loginLogs];
            } else {
                this.filteredLogs = this.loginLogs.filter(log =>
                    (log.username || '').toLowerCase().includes(query) ||
                    (log.full_name || '').toLowerCase().includes(query) ||
                    (log.ip || log.ip_address || '').toLowerCase().includes(query) ||
                    (log.status || (log.success ? 'success' : 'failed')).toLowerCase().includes(query) ||
                    (log.reason || log.fail_reason || '').toLowerCase().includes(query)
                );
            }
            this.renderLogs();
        },

        renderLogs() {
            const tbody = document.getElementById('user-logs-table-body');
            const info = document.getElementById('user-logs-count-info');
            if (!tbody) return;

            if (!this.filteredLogs.length) {
                tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-10 text-center text-muted-foreground text-xs">ไม่พบบันทึกประวัติการเข้าสู่ระบบ</td></tr>`;
                if (info) info.innerText = '0 รายการ';
                return;
            }

            if (info) info.innerText = `แสดง ${this.filteredLogs.length} จากทั้งหมด ${this.loginLogs.length} รายการ`;

            tbody.innerHTML = this.filteredLogs.map(log => {
                const isSuccess = log.success === true || log.status === 'SUCCESS';
                const dateVal = log.created_at || log.timestamp;
                const time = dateVal ? new Date(dateVal).toLocaleString('th-TH', {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                }) : '-';
                const ipVal = log.ip_address || log.ip || '-';
                const reasonVal = log.fail_reason || log.reason || '';

                return `
                    <tr class="hover:bg-muted/30 transition-colors">
                        <td class="px-5 py-3 text-muted-foreground font-mono text-[11px] whitespace-nowrap">${time}</td>
                        <td class="px-5 py-3">
                            <div>
                                <p class="font-medium text-foreground text-xs">${log.full_name || log.username}</p>
                                <p class="text-[10px] text-muted-foreground font-mono">@${log.username}</p>
                            </div>
                        </td>
                        <td class="px-5 py-3 font-mono text-muted-foreground text-[11px]">${ipVal}</td>
                        <td class="px-5 py-3 text-muted-foreground text-[11px] max-w-xs truncate" title="${log.user_agent || ''}">${log.user_agent || '-'}</td>
                        <td class="px-5 py-3 text-right">
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isSuccess ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}">
                                <span class="w-1.5 h-1.5 rounded-full ${isSuccess ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
                                ${isSuccess ? 'สำเร็จ (Success)' : 'ล้มเหลว (Failed)'}
                            </span>
                            ${reasonVal ? `<p class="text-[9px] text-rose-500 mt-0.5">${reasonVal}</p>` : ''}
                        </td>
                    </tr>
                `;
            }).join('');
        }
    };
const userMgmt = window.userMgmt;
