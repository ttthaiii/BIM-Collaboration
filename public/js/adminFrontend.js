document.addEventListener("DOMContentLoaded", () => {
    // เชื่อมโยงปุ่มต่าง ๆ
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

    document.querySelectorAll(".btn-edit").forEach(button => {
        button.addEventListener("click", () => {
            const siteId = button.getAttribute("data-site-id");
            if (siteId) enableProjectEdit(siteId);
        });
    });

    document.querySelectorAll(".btn-delete").forEach(button => {
        button.addEventListener("click", async () => {
            const siteId = button.getAttribute("data-site-id");
            if (siteId) await deleteProject(siteId);
        });
    });

    document.querySelectorAll(".btn-save").forEach(button => {
        button.addEventListener("click", async () => {
            const siteId = button.getAttribute("data-site-id");
            if (siteId) await saveProjectChanges(siteId);
        });
    });
});

// ✅ ฟังก์ชันอัปเดตผู้ใช้แบบ AJAX
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

        const response = await fetch('/admin/users/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, username, password, job_position, site_ids })
        });

        const result = await response.json();
        showToast(result.success ? "อัปเดตสำเร็จ" : "เกิดข้อผิดพลาด", result.success);

        button.disabled = false;
        button.textContent = "อัปเดต";
    } catch (error) {
        console.error('Error:', error);
        showToast('เกิดข้อผิดพลาด', false);
    }
}

// ✅ ฟังก์ชันลบผู้ใช้แบบ AJAX
async function handleDelete(userId) {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบผู้ใช้นี้?')) {
        try {
            const response = await fetch('/admin/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

// ✅ ฟังก์ชัน Toggle Password
function togglePassword(icon) {
    const passwordInput = icon.previousElementSibling;
    passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
    icon.classList.toggle('fa-eye-slash');
}

// ✅ ฟังก์ชันค้นหาผู้ใช้
function searchUser() {
    const searchInput = document.getElementById('searchInput').value.toLowerCase();
    document.querySelectorAll('#userTable tr').forEach(row => {
        const username = row.querySelector('input[id^="username_"]').value.toLowerCase();
        row.style.display = username.includes(searchInput) ? "" : "none";
    });
}

// ✅ ฟังก์ชันแจ้งเตือน (Toast Notification)
function showToast(message, isSuccess = true) {
    const toast = document.getElementById("toast");
    if (toast) {
        toast.textContent = message;
        toast.style.backgroundColor = isSuccess ? "#4CAF50" : "#f44336";
        toast.style.display = "block";
        setTimeout(() => { toast.style.display = "none"; }, 3000);
    }
}

// ✅ เปิดการแก้ไขโครงการ
function enableProjectEdit(siteId) {
    const siteInput = document.querySelector(`#site_name_${siteId}`);
    const editButton = document.querySelector(`.btn-edit[data-site-id="${siteId}"]`);
    const saveButton = document.querySelector(`.btn-save[data-site-id="${siteId}"]`);

    siteInput.disabled = false;
    siteInput.focus();
    editButton.style.display = 'none';
    saveButton.style.display = 'inline-block';
}

// ✅ บันทึกการแก้ไขโครงการ
async function saveProjectChanges(siteId) {
    const siteInput = document.querySelector(`#site_name_${siteId}`);
    const siteName = siteInput.value.trim();
    const editButton = document.querySelector(`.btn-edit[data-site-id="${siteId}"]`);
    const saveButton = document.querySelector(`.btn-save[data-site-id="${siteId}"]`);

    if (!siteName) {
        showToast('ชื่อโครงการต้องไม่ว่างเปล่า', false);
        return;
    }

    try {
        const response = await fetch('/admin/sites/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: siteId, site_name: siteName })
        });

        const result = await response.json();
        if (result.success) {
            siteInput.disabled = true;
            editButton.style.display = 'inline-block';
            saveButton.style.display = 'none';
            showToast('อัปเดตโครงการสำเร็จ');
        } else {
            showToast(result.error || 'เกิดข้อผิดพลาดในการอัปเดตโครงการ', false);
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', false);
    }
}

// ✅ ลบโครงการ
async function deleteProject(siteId) {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบโครงการนี้?')) {
        try {
            const response = await fetch('/admin/sites/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: siteId })
            });

            const result = await response.json();
            if (result.success) {
                document.querySelector(`tr[data-site-id="${siteId}"]`).remove();
                showToast('ลบโครงการสำเร็จ');
            } else {
                showToast(result.error || 'เกิดข้อผิดพลาดในการลบโครงการ', false);
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', false);
        }
    }
}

// ✅ เพิ่มโครงการใหม่
async function addNewProject() {
    const projectInput = document.getElementById('new_project_name');
    const projectName = projectInput.value.trim();

    if (!projectName) {
        showToast('กรุณากรอกชื่อโครงการ', false);
        return;
    }

    try {
        const response = await fetch('/admin/sites/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ site_name: projectName })
        });

        const result = await response.json();
        if (result.success) {
            projectInput.value = '';
            showToast('เพิ่มโครงการสำเร็จ');
            // รีโหลดหน้าเพื่อแสดงโครงการใหม่
            window.location.reload();
        } else {
            showToast(result.error || 'เกิดข้อผิดพลาดในการเพิ่มโครงการ', false);
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', false);
    }
}