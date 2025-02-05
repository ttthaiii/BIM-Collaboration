document.addEventListener("DOMContentLoaded", () => {
    // ✅ ตั้งค่า sessionToken ใน localStorage ถ้ายังไม่มี
    if (!localStorage.getItem('sessionToken')) {
        localStorage.setItem('sessionToken', Math.random().toString(36).substring(2));
    }

    // ✅ ฟังก์ชันสำหรับส่ง Request พร้อม Session Token
    async function sendRequest(url, options = {}) {
        const token = localStorage.getItem('sessionToken'); // ดึง token จาก localStorage
        console.log('Client sessionToken:', token); // ✅ เพิ่ม Log เพื่อตรวจสอบ
    
        options.headers = {
            ...(options.headers || {}),
            'x-session-token': token, // เพิ่ม sessionToken ใน header
            'Content-Type': 'application/json'
        };
    
        const response = await fetch(url, options);
    
        // กรณี session หมดอายุ
        if (response.status === 401) {
            alert('Session expired. Please login again.');
            localStorage.removeItem('sessionToken'); // ลบ token ที่หมดอายุ
            window.location.href = '/login'; // Redirect ไปหน้า login
        }
    
        return response;
    }

    // ✅ เชื่อมโยงปุ่มต่าง ๆ
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

            const response = await sendRequest('/admin/users/update', {
                method: 'POST',
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
});
