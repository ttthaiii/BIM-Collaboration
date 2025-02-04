const { poolPromise } = require('../config/database');

// Helper Function: แปลง site_ids string เป็น array
const transformUsers = (users) => {
  return users.map(user => ({
    ...user,
    site_ids: user.site_ids ? user.site_ids.split(',').map(id => parseInt(id)) : [],
  }));
};

exports.getAdminPage = async (req, res) => {
  try {
    const jobPositions = ["Manager", "Supervisor", "Staff"];
    const [sites] = await poolPromise.query("SELECT * FROM sites");
    const [users] = await poolPromise.query(`
      SELECT 
        u.id, 
        u.username, 
        u.job_position,
        GROUP_CONCAT(s.id) as site_ids
      FROM users u
      LEFT JOIN user_sites us ON u.id = us.user_id
      LEFT JOIN sites s ON us.site_id = s.id
      GROUP BY u.id
    `);

    res.render("admin", {
      title: "Admin Page",
      jobPositions,
      sites,
      users: transformUsers(users), // ใช้ Helper Function
      currentUser: req.session || {},
    });

  } catch (err) {
    console.error("Error fetching data:", err);
    res.status(500).render("error", { message: "Failed to fetch admin data" });
  }
};

// เพิ่มผู้ใช้งาน
exports.addUser = async (req, res) => {
  const { username, password, job_position, site_ids = [], new_project } = req.body;

  try {
    const connection = await poolPromise.getConnection();
    await connection.beginTransaction();

    try {
      let newProjectId = null;

      if (new_project) {
        const [result] = await connection.query(
          "INSERT INTO sites (site_name) VALUES (?)", 
          [new_project]
        );
        newProjectId = result.insertId;
        site_ids.push(newProjectId);
      }

      const [userResult] = await connection.query(
        "INSERT INTO users (username, password, job_position) VALUES (?, ?, ?)",
        [username, password, job_position]
      );
      const userId = userResult.insertId;

      if (site_ids.length > 0) {
        const siteQuery = "INSERT INTO user_sites (user_id, site_id) VALUES ?";
        const siteValues = site_ids.map(siteId => [userId, siteId]);
        await connection.query(siteQuery, [siteValues]);
      }

      await connection.commit();
      res.redirect("/admin");
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error("Error adding user:", err);
    res.status(500).render("error", { message: "Failed to add user" });
  }
};

// ลบผู้ใช้งาน
exports.deleteUser = async (req, res) => {
  const { id } = req.body;

  try {
    const connection = await poolPromise.getConnection();
    await connection.beginTransaction();

    try {
      await connection.query("DELETE FROM user_sites WHERE user_id = ?", [id]);
      await connection.query("DELETE FROM users WHERE id = ?", [id]);

      await connection.commit();
      res.json({ success: true, message: "User deleted successfully" });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
};

// เพิ่มโครงการ
exports.addSite = async (req, res) => {
  const { site_name } = req.body;

  if (!site_name) {
    return res.status(400).json({ error: "Site name is required" });
  }

  try {
    const [result] = await poolPromise.query("INSERT INTO sites (site_name) VALUES (?)", [site_name]);
    res.json({ success: true, siteId: result.insertId, message: "Site added successfully" });
  } catch (err) {
    console.error("Error adding site:", err);
    res.status(500).json({ error: "Failed to add site" });
  }
};
