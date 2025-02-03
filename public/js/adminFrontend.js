document.addEventListener("DOMContentLoaded", () => {

    // เชื่อมโยงปุ่มอัปเดตผู้ใช้งาน
    document.querySelectorAll(".update-button").forEach(button => {
        button.addEventListener("click", async () => {
            const userId = button.getAttribute("data-user-id");
            if (userId) await handleUpdate(userId);
        });
    });

    // เชื่อมโยงปุ่มลบผู้ใช้งาน
    document.querySelectorAll(".delete-button").forEach(button => {
        button.addEventListener("click", async () => {
            const userId = button.getAttribute("data-user-id");
            if (userId) await handleDelete(userId);
        });
    });

    // เชื่อมโยงปุ่มแก้ไขโครงการ
    document.querySelectorAll(".btn-edit").forEach(button => {
        button.addEventListener("click", () => {
            const siteId = button.getAttribute("data-site-id");
            if (siteId) enableProjectEdit(siteId);
        });
    });

    // เชื่อมโยงปุ่มลบโครงการ
    document.querySelectorAll(".btn-delete").forEach(button => {
        button.addEventListener("click", async () => {
            const siteId = button.getAttribute("data-site-id");
            if (siteId) await deleteProject(siteId);
        });
    });

    // เชื่อมโยงปุ่มบันทึกโครงการ
    document.querySelectorAll(".btn-save").forEach(button => {
        button.addEventListener("click", async () => {
            const siteId = button.getAttribute("data-site-id");
            if (siteId) await saveProjectChanges(siteId);
        });
    });
});

// ฟังก์ชันสำหรับอัปเดตผู้ใช้
async function handleUpdate(userId) {
    const button = document.querySelector(`.update-button[data-user-id="${userId}"]`);
    button.disabled = true; // ปิดการใช้งานปุ่ม
    button.textContent = "กำลังอัปเดต..."; // เปลี่ยนข้อความปุ่ม
    try {
        const username = document.querySelector(`#username_${userId}`).value;
        const password = document.querySelector(`#password_${userId}`).value;
        const job_position = document.querySelector(`#job_position_${userId}`).value;
        const siteCheckboxes = document.querySelectorAll(`input[id^="site_${userId}_"]:checked`);
        const site_ids = Array.from(siteCheckboxes).map(cb => cb.value);

        const response = await fetch('/admin/users/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userId,
                username,
                password,
                job_position,
                site_ids
            })
        });

        if (response.ok) {
            showToast('อัปเดตสำเร็จ');
            location.reload();
        } else {
            showToast('เกิดข้อผิดพลาดในการอัปเดต');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('เกิดข้อผิดพลาด');
    }
}

// ฟังก์ชันสำหรับลบผู้ใช้
async function handleDelete(userId) {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบผู้ใช้นี้?')) {
        try {
            const response = await fetch('/admin/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: userId })
            });

            if (response.ok) {
                showToast('ลบผู้ใช้สำเร็จ');
                location.reload();
            } else {
                ashowToast('เกิดข้อผิดพลาดในการลบผู้ใช้');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('เกิดข้อผิดพลาด');
        }
    }
}

function togglePassword(icon) {
    const passwordInput = icon.previousElementSibling;
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// ฟังก์ชันค้นหาผู้ใช้
function searchUser() {
    const searchInput = document.getElementById('searchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#userTable tr');
    
    rows.forEach(row => {
        const username = row.querySelector('input[id^="username_"]').value.toLowerCase();
        if (username.includes(searchInput)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}     

// เปิดให้แก้ไขโครงการ
function enableProjectEdit(siteId) {
    const siteNameInput = document.querySelector(`#site_name_${siteId}`);
    const saveButton = document.querySelector(`button[data-site-id="${siteId}"].btn-save`);

    if (siteNameInput && saveButton) {
        siteNameInput.disabled = false;
        saveButton.style.display = "inline";
    } else {
        console.error("Element not found for siteId:", siteId);
    }
}


// บันทึกการเปลี่ยนแปลงโครงการ
async function saveProjectChanges(siteId) {
    const siteNameInput = document.querySelector(`#site_name_${siteId}`);
    if (!siteNameInput) {
        console.error("Site name input not found for siteId:", siteId);
        return;
    }

    const siteName = siteNameInput.value;

    try {
        const response = await fetch('/admin/sites/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                site_id: siteId,
                site_name: siteName
            })
        });

        if (!response.ok) {
            throw new Error('Failed to update project');
        }

        alert('บันทึกการเปลี่ยนแปลงสำเร็จ');
        location.reload();
    } catch (error) {
        console.error('Error:', error);
        alert('เกิดข้อผิดพลาดในการบันทึก');
    }
}

// ลบโครงการ
async function deleteProject(siteId) {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบโครงการนี้?')) {
        try {
            const response = await fetch('/admin/sites/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: siteId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to delete project');
            }

            showToast('ลบโครงการสำเร็จ');
            location.reload();
        } catch (error) {
            console.error('Error:', error);
            showToast('เกิดข้อผิดพลาดในการลบโครงการ');
        }
    }
}

// เพิ่มโครงการใหม่
async function addNewProject() {
    const siteName = document.querySelector('#new_project_name').value;

    if (!siteName) {
        alert('กรุณากรอกชื่อโครงการ');
        return;
    }

    try {
        const response = await fetch('/admin/sites/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                site_name: siteName
            })
        });

        if (!response.ok) {
            throw new Error('Failed to add new project');
        }

        alert('เพิ่มโครงการใหม่สำเร็จ');
        location.reload();
    } catch (error) {
        console.error('Error:', error);
        alert('เกิดข้อผิดพลาดในการเพิ่มโครงการ');
    }
}

function showToast(message) {
    const toast = document.getElementById("toast");
    if (toast) {
        toast.textContent = message;
        toast.style.display = "block";
        setTimeout(() => {
            toast.style.display = "none";
        }, 3000); // ซ่อน Toast หลัง 3 วินาที
    }
}
