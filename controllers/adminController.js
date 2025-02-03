const { poolPromise, getAllUsers } = require('../config/database');

exports.getAdminPage = async (req, res) => {
  try {
    const jobPositions = ["Manager", "Supervisor", "Staff"];
    
    // ดึงข้อมูล sites
    const [sites] = await poolPromise.query("SELECT * FROM sites") || [];
    
    // ดึงข้อมูล users และ site access
    const [users] = await poolPromise.query(`
      SELECT 
        u.id, 
        u.username, 
        u.password, 
        u.job_position,
        GROUP_CONCAT(s.id) as site_ids
      FROM users u
      LEFT JOIN user_sites us ON u.id = us.user_id
      LEFT JOIN sites s ON us.site_id = s.id
      GROUP BY u.id
    `) || [];

    // แปลง site_ids string เป็น array
    users.forEach(user => {
      user.site_ids = user.site_ids ? user.site_ids.split(',').map(id => parseInt(id)) : [];
    });

    res.render("admin", {
      title: "Admin Page",
      jobPositions,
      sites,
      users,
      currentUser: req.session || {} // ส่ง session user ไปด้วย
    });

  } catch (err) {
    console.error("Error fetching data:", err);
    res.status(500).send("Error fetching data");
  }
};


// ฟังก์ชันสำหรับเพิ่มผู้ใช้งาน
exports.addUser = async (req, res) => {
  const { username, password, job_position, site_ids = [], new_project } = req.body;

  try {
    let newProjectId = null;

    // เพิ่มโครงการใหม่ถ้ามีค่าใน new_project
    if (new_project) {
      const [result] = await poolPromise.query("INSERT INTO sites (site_name) VALUES (?)", [new_project]);
      newProjectId = result.insertId;
      site_ids.push(newProjectId); // เพิ่ม ID ของโครงการใหม่ใน site_ids
    }

    // เพิ่มผู้ใช้งาน
    const [userResult] = await poolPromise.query(
      "INSERT INTO users (username, password, job_position) VALUES (?, ?, ?)",
      [username, password, job_position]
    );
    const userId = userResult.insertId;

    // เพิ่ม site_ids สำหรับผู้ใช้งาน
    if (site_ids.length > 0) {
      const siteQuery = `INSERT INTO user_sites (user_id, site_id) VALUES ${site_ids.map(() => "(?, ?)").join(", ")}`;
      const siteValues = site_ids.flatMap(siteId => [userId, siteId]);
      await poolPromise.query(siteQuery, siteValues);
    }

    res.redirect("/admin");
  } catch (err) {
    console.error("Error adding user:", err);
    res.status(500).send("Failed to add user");
  }
};


// ฟังก์ชันสำหรับอัปเดตผู้ใช้งาน
exports.updateUser = async (req, res) => {
  const { user_id, username, password, job_position, site_ids = [] } = req.body;

  try {
    const connection = await poolPromise.getConnection();
    await connection.beginTransaction();

    try {
      // อัพเดตข้อมูลผู้ใช้
      await connection.query(
        "UPDATE users SET username = ?, password = ?, job_position = ? WHERE id = ?",
        [username, password, job_position, user_id]
      );

      // ลบ site permissions เดิม
      await connection.query("DELETE FROM user_sites WHERE user_id = ?", [user_id]);

      // เพิ่ม site permissions ใหม่
      if (site_ids.length > 0) {
        const values = site_ids.map(site_id => [user_id, site_id]);
        await connection.query(
          "INSERT INTO user_sites (user_id, site_id) VALUES ?",
          [values]
        );
      }

      await connection.commit();
      res.json({ success: true });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
};



// ฟังก์ชันสำหรับลบผู้ใช้งาน
exports.deleteUser = async (req, res) => {
  const { id } = req.body;

  try {
    await poolPromise.query("DELETE FROM users WHERE id = ?", [id]);
    await poolPromise.query("DELETE FROM user_sites WHERE user_id = ?", [id]);
    res.send("User deleted successfully");
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).send("Failed to delete user");
  }
};

// ฟังก์ชันสำหรับค้นหาผู้ใช้งาน
exports.searchUsers = async (req, res) => {
  const { search_query } = req.query;

  try {
    const [results] = await poolPromise.query("SELECT * FROM users WHERE username LIKE ?", [`%${search_query}%`]);
    res.render("admin", { users: results, title: "Admin Page", jobPositions: [], sites: [] });
  } catch (err) {
    console.error("Error searching users:", err);
    res.status(500).send("Failed to search users");
  }
};

// เพิ่มโครงการใหม่
exports.addSite = async (req, res) => {
  const { site_name } = req.body;

  try {
      await poolPromise.query("INSERT INTO sites (site_name) VALUES (?)", [site_name]);
      res.status(200).send('Site added successfully');
  } catch (err) {
      console.error('Error adding site:', err);
      res.status(500).send('Failed to add site');
  }
};

// อัปเดตโครงการ
exports.updateSite = async (req, res) => {
  const { site_id, site_name } = req.body;

  try {
      await poolPromise.query("UPDATE sites SET site_name = ? WHERE id = ?", [site_name, site_id]);
      res.status(200).send('Site updated successfully');
  } catch (err) {
      console.error('Error updating site:', err);
      res.status(500).send('Failed to update site');
  }
};

// ลบโครงการ
exports.deleteSite = async (req, res) => {
  const { id } = req.body;

  try {
    // ตรวจสอบว่าโครงการนี้ยังเชื่อมโยงกับผู้ใช้งานหรือไม่
    const [result] = await poolPromise.query("SELECT COUNT(*) as count FROM user_sites WHERE site_id = ?", [id]);
    if (result[0].count > 0) {
      return res.status(400).send("Cannot delete site, it is linked to users.");
    }

    await poolPromise.query("DELETE FROM sites WHERE id = ?", [id]);
    res.status(200).send('Site deleted successfully');
  } catch (err) {
    console.error('Error deleting site:', err);
    res.status(500).send('Failed to delete site');
  }
};
