const { pool } = require('./../config/database');
const bcrypt = require('bcryptjs'); // เปลี่ยนจาก bcrypt เป็น bcryptjs

// Helper Function: Transform site_ids string to array
const transformUsers = (users) => {
  return users.map(user => ({
    ...user,
    site_ids: user.site_ids ? user.site_ids.split(',').map(id => parseInt(id)) : [],
  }));
};

// Get Admin Page
exports.getAdminPage = async (req, res) => {
  try {
    const jobPositions = ["Manager", "Supervisor", "Staff"];
    const [sites] = await pool.query("SELECT * FROM sites");
    const [users] = await pool.query(`
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
      users: transformUsers(users),
      currentUser: req.session?.user || {},
    });
  } catch (err) {
    console.error("Error fetching admin data:", err.message);
    res.status(500).render("error", { 
      message: "Failed to fetch admin data",
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  }
};

// Add User
exports.addUser = async (req, res) => {
  const { username, password = 'password123', job_position, site_ids = [], new_project } = req.body;
  
  let connection;
  try {
    // Validate input
    if (!username || !job_position) {
      throw new Error('Username and job position are required');
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    let newProjectId = null;
    if (new_project) {
      const [result] = await connection.query(
        "INSERT INTO sites (site_name) VALUES (?)",
        [new_project]
      );
      newProjectId = result.insertId;
      site_ids.push(newProjectId);
    }

    // Insert user with prepared statement
    const [userResult] = await connection.query(
      "INSERT INTO users (username, password, job_position) VALUES (?, ?, ?)",
      [username, hashedPassword, job_position]
    );
    const userId = userResult.insertId;

    // Insert user sites if any
    if (site_ids.length > 0) {
      const siteQuery = "INSERT INTO user_sites (user_id, site_id) VALUES ?";
      const siteValues = site_ids.map(siteId => [userId, parseInt(siteId)]);
      await connection.query(siteQuery, [siteValues]);
    }

    await connection.commit();
    res.redirect('/admin');

  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error adding user:', err.message);
    res.status(500).render('error', { 
      message: 'Failed to add user',
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Delete User
exports.deleteUser = async (req, res) => {
  const { id } = req.body;
  let connection;

  try {
    if (!id) {
      throw new Error('User ID is required');
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Delete user's site associations first
    await connection.query("DELETE FROM user_sites WHERE user_id = ?", [id]);
    
    // Delete the user
    const [result] = await connection.query("DELETE FROM users WHERE id = ?", [id]);
    
    if (result.affectedRows === 0) {
      throw new Error('User not found');
    }

    await connection.commit();
    res.json({ success: true, message: "User deleted successfully" });

  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error deleting user:", err.message);
    res.status(err.message === 'User not found' ? 404 : 500)
       .json({ success: false, error: err.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Search Users
exports.searchUsers = async (req, res) => {
  const { query } = req.query;

  try {
    if (!query) {
      return res.json({ success: true, users: [] });
    }

    const [users] = await pool.query(
      `SELECT 
        u.id, 
        u.username, 
        u.job_position,
        GROUP_CONCAT(s.id) as site_ids
      FROM users u
      LEFT JOIN user_sites us ON u.id = us.user_id
      LEFT JOIN sites s ON us.site_id = s.id
      WHERE u.username LIKE ?
      GROUP BY u.id
      LIMIT 10`,
      [`%${query}%`]
    );

    res.json({ 
      success: true, 
      users: transformUsers(users)
    });

  } catch (err) {
    console.error('Error searching users:', err.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search users'
    });
  }
};

// Add Site
exports.addSite = async (req, res) => {
  const { site_name } = req.body;
  
  try {
    if (!site_name) {
      throw new Error('Site name is required');
    }

    const [result] = await pool.query(
      "INSERT INTO sites (site_name) VALUES (?)",
      [site_name]
    );

    res.json({ 
      success: true, 
      siteId: result.insertId,
      message: "Site added successfully" 
    });

  } catch (err) {
    console.error('Error adding site:', err.message);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
};

// Update Site
exports.updateSite = async (req, res) => {
  const { id, site_name } = req.body;

  try {
    if (!id || !site_name) {
      throw new Error('Site ID and name are required');
    }

    const [result] = await pool.query(
      "UPDATE sites SET site_name = ? WHERE id = ?",
      [site_name, id]
    );

    if (result.affectedRows === 0) {
      throw new Error('Site not found');
    }

    res.json({ 
      success: true, 
      message: "Site updated successfully" 
    });

  } catch (err) {
    console.error('Error updating site:', err.message);
    res.status(err.message === 'Site not found' ? 404 : 500)
       .json({ success: false, error: err.message });
  }
};

// Delete Site
exports.deleteSite = async (req, res) => {
  const { id } = req.body;
  let connection;

  try {
    if (!id) {
      throw new Error('Site ID is required');
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Delete site associations first
    await connection.query("DELETE FROM user_sites WHERE site_id = ?", [id]);
    
    // Delete the site
    const [result] = await connection.query("DELETE FROM sites WHERE id = ?", [id]);
    
    if (result.affectedRows === 0) {
      throw new Error('Site not found');
    }

    await connection.commit();
    res.json({ success: true, message: "Site deleted successfully" });

  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error deleting site:', err.message);
    res.status(err.message === 'Site not found' ? 404 : 500)
       .json({ success: false, error: err.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Update User
exports.updateUser = async (req, res) => {
  const { id, username, job_position, site_ids = [] } = req.body;
  let connection;

  try {
    if (!id || !username || !job_position) {
      throw new Error('User ID, username and job position are required');
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Update user details
    const [userResult] = await connection.query(
      "UPDATE users SET username = ?, job_position = ? WHERE id = ?",
      [username, job_position, id]
    );

    if (userResult.affectedRows === 0) {
      throw new Error('User not found');
    }

    // Update user sites
    await connection.query("DELETE FROM user_sites WHERE user_id = ?", [id]);
    
    if (site_ids.length > 0) {
      const siteQuery = "INSERT INTO user_sites (user_id, site_id) VALUES ?";
      const siteValues = site_ids.map(siteId => [id, parseInt(siteId)]);
      await connection.query(siteQuery, [siteValues]);
    }

    await connection.commit();
    res.json({ success: true, message: "User updated successfully" });

  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error updating user:', err.message);
    res.status(err.message === 'User not found' ? 404 : 500)
       .json({ success: false, error: err.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};