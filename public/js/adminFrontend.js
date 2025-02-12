document.addEventListener("DOMContentLoaded", () => {
    // ✅ ตั้งค่า sessionToken ใน localStorage ถ้ายังไม่มี
    if (!localStorage.getItem('sessionToken')) {
        localStorage.setItem('sessionToken', Math.random().toString(36).substring(2));
    }

    // ✅ ฟังก์ชันสำหรับส่ง Request พร้อม Session Token
    async function sendRequest(url, options = {}) {
        const token = localStorage.getItem('sessionToken');
        console.log('Client sessionToken:', token);
    
        options.headers = {
            ...(options.headers || {}),
            'x-session-token': token,
            'Content-Type': 'application/json'
        };
    
        const response = await fetch(url, options);
    
        if (response.status === 401) {
            alert('Session expired. Please login again.');
            localStorage.removeItem('sessionToken');
            window.location.href = '/login';
        }
    
        return response;
    }

    // ✅ เชื่อมโยงปุ่มและ Event Listeners
    function initializeEventListeners() {
        // Update and Delete buttons
        document.querySelectorAll(".update-button").forEach(button => {
            button.addEventListener("click", async () => {
                const userId = button.getAttribute("data-user-id");
                if (userId) await handleUpdate(userId);
            });
        });

        document.querySelectorAll(".delete-button").forEach(button => {
            button.addEventListener("click", async () => {
                const userId = button.getAttribute("data-user-id");
                if (userId) await handleDelete(userId);
            });
        });

        // Search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => searchUser());
        }

        // Password toggle icons
        document.querySelectorAll('.password-toggle').forEach(icon => {
            icon.addEventListener('click', () => togglePassword(icon));
        });

        // Project management buttons
        document.querySelectorAll('.btn-edit[data-site-id]').forEach(button => {
            button.addEventListener('click', () => {
                const siteId = button.getAttribute('data-site-id');
                enableProjectEdit(siteId);
            });
        });

        document.querySelectorAll('.btn-delete[data-site-id]').forEach(button => {
            button.addEventListener('click', () => {
                const siteId = button.getAttribute('data-site-id');
                deleteProject(siteId);
            });
        });
        
        document.querySelectorAll('.btn-edit').forEach(button => {
            button.addEventListener('click', () => {
                const siteId = button.getAttribute('data-site-id');
                if (siteId) enableProjectEdit(siteId);
            });
        });
    
        document.querySelectorAll('.btn-save').forEach(button => {
            button.addEventListener('click', () => {
                const siteId = button.getAttribute('data-site-id');
                if (siteId) saveProjectChanges(siteId);
            });
        });
    
        document.querySelectorAll('.btn-delete').forEach(button => {
            button.addEventListener('click', () => {
                const siteId = button.getAttribute('data-site-id');
                if (siteId) deleteProject(siteId);
            });
        });

        // Add new project button
        const addProjectBtn = document.querySelector('.btn-add');
        if (addProjectBtn) {
            addProjectBtn.addEventListener('click', addNewProject);
        }

        const downloadBtn = document.getElementById('downloadTemplateBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', downloadTemplate);
        }

        const fileInput = document.querySelector('#fileUpload');
        const clearFileBtn = document.querySelector('#clearFileBtn');
    
        if (fileInput) {
            fileInput.addEventListener('change', (event) => {
                if (event.target.files.length > 0) {
                    clearFileBtn.style.display = 'inline-block';
                    handleFileUpload(event);
                } else {
                    clearFileBtn.style.display = 'none';
                }
            });
        }
    
        if (clearFileBtn) {
            clearFileBtn.addEventListener('click', () => {
                fileInput.value = ''; // ล้างไฟล์
                clearFileBtn.style.display = 'none';
                const uploadResults = document.getElementById('uploadResults');
                if (uploadResults) {
                    uploadResults.style.display = 'none';
                    uploadResults.innerHTML = '';
                }
            });
        }
    }
    
    function downloadTemplate() {
        try {
            const data = [{
                username: 'example_user',
                password: 'password123',
                job_position: 'BIM',
                site_access: '1,2',
                email: 'user@example.com'
            }];

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);

            ws['A2'] = { v: 'Required: Username must be unique' };
            ws['B2'] = { v: 'Required: Password minimum 6 characters' };
            ws['C2'] = { v: 'Required: Must be one of: BIM, Adminsite, PD, PM, PE, OE, SE, FM, CM' };
            ws['D2'] = { v: 'Required: Site IDs separated by commas' };
            ws['E2'] = { v: 'Optional: Valid email format' };

            ws['!cols'] = [
                {wch: 15},
                {wch: 15},
                {wch: 15},
                {wch: 15},
                {wch: 25}
            ];

            XLSX.utils.book_append_sheet(wb, ws, 'Template');
            XLSX.writeFile(wb, 'user_upload_template.xlsx');
            showToast('ดาวน์โหลด Template สำเร็จ');
        } catch (error) {
            console.error('Error downloading template:', error);
            showToast('เกิดข้อผิดพลาดในการดาวน์โหลด Template', false);
        }
    }

    async function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
    
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
                // ตรวจสอบและแก้ไขข้อมูล site_access
                const validatedData = jsonData.map(row => ({
                    ...row,
                    site_access: row.site_access || '' // กำหนดค่าว่างถ้าไม่มีข้อมูล
                }));
    
                const response = await sendRequest('/admin/bulk-upload', {
                    method: 'POST',
                    body: JSON.stringify({ users: validatedData })
                });
    
                const result = await response.json();
                showUploadResults(result);
            } catch (error) {
                showToast('เกิดข้อผิดพลาดในการอัพโหลดไฟล์', false);
                console.error('Upload error:', error);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function showUploadResults(result) {
        const resultsDiv = document.getElementById('uploadResults');
        resultsDiv.style.display = 'block';
        
        if (result.success) {
            resultsDiv.innerHTML = `
                <div class="p-4 bg-green-50 rounded">
                    <h4 class="font-semibold mb-2">ผลการอัพโหลด:</h4>
                    <p>เพิ่มสำเร็จ: ${result.results.success.length}</p>
                    <p>ผิดพลาด: ${result.results.failed.length}</p>
                    ${result.results.failed.length > 0 ? `
                        <div class="mt-4">
                            <h5 class="font-semibold">รายการที่ผิดพลาด:</h5>
                            <ul class="list-disc pl-4">
                                ${result.results.failed.map(fail => 
                                    `<li>${fail.username}: ${fail.error}</li>`
                                ).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            resultsDiv.innerHTML = `
                <div class="p-4 bg-red-50 rounded">
                    <p class="text-red-600">เกิดข้อผิดพลาด: ${result.error}</p>
                </div>
            `;
        }
    }

    
    // ✅ ฟังก์ชันค้นหาผู้ใช้
    function searchUser() {
        const searchText = document.getElementById('searchInput').value.toLowerCase();
        const rows = document.querySelectorAll('#userTable tr');
        
        rows.forEach(row => {
            const username = row.querySelector('input[id^="username_"]').value.toLowerCase();
            if (username.includes(searchText)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    // ✅ ฟังก์ชันแสดง/ซ่อนรหัสผ่าน
    function togglePassword(icon) {
        const input = icon.previousElementSibling;
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.replace('fa-eye-slash', 'fa-eye');
        }
    }

    // ✅ ฟังก์ชันอัปเดตผู้ใช้
    async function handleUpdate(userId) {
        const button = document.querySelector(`.update-button[data-user-id="${userId}"]`);
        button.disabled = true;
        button.textContent = "กำลังอัปเดต...";

        try {
            const username = document.querySelector(`#username_${userId}`).value.trim();
            const password = document.querySelector(`#password_${userId}`).value.trim();
            const job_position = document.querySelector(`#job_position_${userId}`).value;
            const site_ids = Array.from(document.querySelectorAll(`input[id^="site_${userId}_"]:checked`)).map(cb => cb.value);

            if (!username || !password) {
                showToast('ชื่อผู้ใช้หรือรหัสผ่านต้องไม่ว่างเปล่า', false);
                button.disabled = false;
                button.textContent = "อัปเดต";
                return;
            }

            const response = await sendRequest('/admin/users/update', {
                method: 'POST',
                body: JSON.stringify({ id: userId, username, password, job_position, site_ids })
            });

            const result = await response.json();
            showToast(result.success ? "อัปเดตสำเร็จ" : "เกิดข้อผิดพลาด", result.success);
        } catch (error) {
            console.error('Error:', error);
            showToast('เกิดข้อผิดพลาด', false);
        } finally {
            button.disabled = false;
            button.textContent = "อัปเดต";
        }
    }

    // ✅ ฟังก์ชันลบผู้ใช้
    async function handleDelete(userId) {
        if (confirm('คุณแน่ใจหรือไม่ที่จะลบผู้ใช้นี้?')) {
            try {
                const response = await sendRequest('/admin/delete', {
                    method: 'POST',
                    body: JSON.stringify({ id: userId })
                });

                if (response.ok) {
                    showToast('ลบผู้ใช้สำเร็จ');
                    document.querySelector(`#user_row_${userId}`).remove();
                } else {
                    showToast('เกิดข้อผิดพลาดในการลบผู้ใช้', false);
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('เกิดข้อผิดพลาด', false);
            }
        }
    }

    // ✅ ฟังก์ชันจัดการโครงการ
    function enableProjectEdit(siteId) {
        const input = document.getElementById(`site_name_${siteId}`);
        const row = input.closest('tr');
        const editBtn = row.querySelector('.btn-edit');
        const saveBtn = row.querySelector('.btn-save');
        
        input.disabled = false;
        input.focus();
        editBtn.style.display = 'none';
        saveBtn.style.display = 'inline-block';
    }

    async function saveProjectChanges(siteId) {
        const input = document.getElementById(`site_name_${siteId}`);
        const row = input.closest('tr');
        const editBtn = row.querySelector('.btn-edit');
        const saveBtn = row.querySelector('.btn-save');
        const newName = input.value.trim();
        
        if(!newName) {
            showToast('กรุณากรอกชื่อโครงการ', false);
            return;
        }
    
        try {
            const response = await fetch('/admin/sites/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-token': localStorage.getItem('sessionToken')
                },
                body: JSON.stringify({ id: siteId, site_name: newName })
            });
    
            const data = await response.json();
            if(data.success) {
                input.disabled = true;
                editBtn.style.display = 'inline-block';
                saveBtn.style.display = 'none';
                showToast('บันทึกการเปลี่ยนแปลงสำเร็จ');
                setTimeout(() => location.reload(), 1000); // รีเฟรชหน้าหลังจาก 1 วินาที
            } else {
                showToast(data.error || 'เกิดข้อผิดพลาดในการบันทึก', false);
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('เกิดข้อผิดพลาดในการบันทึก', false);
        }
    }

    async function deleteProject(siteId) {
        if (confirm('คุณแน่ใจหรือไม่ที่จะลบโครงการนี้?')) {
            try {
                const response = await sendRequest('/admin/sites/delete', {
                    method: 'POST',
                    body: JSON.stringify({ id: siteId })
                });
                
                if (response.ok) {
                    document.querySelector(`tr[data-site-id="${siteId}"]`).remove();
                    showToast('ลบโครงการสำเร็จ');
                }
            } catch (error) {
                showToast('เกิดข้อผิดพลาดในการลบโครงการ', false);
            }
        }
    }

    async function addNewProject() {
        const input = document.querySelector('#new_project_name');
        const projectName = input.value.trim();
        
        if (!projectName) {
            showToast('กรุณากรอกชื่อโครงการ', false);
            return;
        }
        
        try {
            const response = await sendRequest('/admin/sites/add', {
                method: 'POST',
                body: JSON.stringify({ site_name: projectName })
            });
            
            if (response.ok) {
                const result = await response.json();
                location.reload(); // รีเฟรชหน้าเพื่อแสดงโครงการใหม่
                showToast('เพิ่มโครงการสำเร็จ');
            }
        } catch (error) {
            showToast('เกิดข้อผิดพลาดในการเพิ่มโครงการ', false);
        }
    }

    // ✅ ฟังก์ชันแจ้งเตือน
    function showToast(message, isSuccess = true) {
        const toast = document.getElementById("toast");
        if (toast) {
            toast.textContent = message;
            toast.style.backgroundColor = isSuccess ? "#4CAF50" : "#f44336";
            toast.style.display = "block";
            setTimeout(() => { toast.style.display = "none"; }, 3000);
        }
    }

    // เริ่มต้นการทำงาน
    initializeEventListeners();
});