const { pool } = require('./../config/database');
const bcrypt = require('bcryptjs');

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
    const jobPositions = ["BIM", "Adminsite", "PD", "PM", "PE", "OE", "SE", "FM", "CM"];
    console.log('Job Positions:', jobPositions); // ตรวจสอบตำแหน่งงาน
    
    // ดึงข้อมูล users พร้อมรหัสผ่าน
    const [users] = await pool.query(`
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
    `);
    console.log('Raw Users Data:', users); // ตรวจสอบข้อมูลดิบจาก database

    const [sites] = await pool.query("SELECT * FROM sites");
    console.log('Sites Data:', sites); // ตรวจสอบข้อมูล sites

    // แปลงข้อมูล users
    const transformedUsers = users.map(user => ({
      ...user,
      site_ids: user.site_ids ? user.site_ids.split(',').map(id => parseInt(id)) : []
    }));
    console.log('Transformed Users Data:', transformedUsers); // ตรวจสอบข้อมูลหลังแปลง

    // ก่อนส่งข้อมูลไป render
    console.log('Data being sent to view:', {
      title: "Admin Page",
      jobPositions,
      sites,
      users: transformedUsers,
      currentUser: req.session.user || {}
    });

    res.render("admin", {
      title: "Admin Page",
      jobPositions,
      sites,
      users: transformedUsers,
      currentUser: req.session.user || {}
    });

  } catch (err) {
    console.error("Error in getAdminPage:", err); // ตรวจสอบ error
    res.status(500).render("error", { 
      message: "Failed to load admin page",
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  }
};

// Add User
exports.addUser = async (req, res) => {
  const { username, password, job_position, site_ids = [] } = req.body;
  let connection;
  
  try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // ตรวจสอบว่า username ซ้ำหรือไม่
      const [existingUser] = await connection.query(
          "SELECT id FROM users WHERE username = ?",
          [username]
      );

      if (existingUser.length > 0) {
          throw new Error('Username already exists');
      }

      // เพิ่มผู้ใช้
      const [userResult] = await connection.query(
          "INSERT INTO users (username, password, job_position) VALUES (?, ?, ?)",
          [username, password, job_position]
      );

      // เพิ่มความสัมพันธ์กับโครงการ
      if (site_ids && site_ids.length > 0) {
          const values = site_ids.map(siteId => [userResult.insertId, siteId]);
          await connection.query(
              "INSERT INTO user_sites (user_id, site_id) VALUES ?",
              [values]
          );
      }

      await connection.commit();
      res.redirect('/admin');

  } catch (err) {
      if (connection) await connection.rollback();
      console.error('Error adding user:', err);
      res.status(500).render('error', {
          message: err.message || 'Failed to add user'
      });
  } finally {
      if (connection) connection.release();
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
  const { id, username, password, job_position, site_ids = [] } = req.body;
  let connection;

  try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // อัพเดทข้อมูลผู้ใช้โดยใช้รหัสผ่านที่ไม่ได้เข้ารหัส
      const [userResult] = await connection.query(
          "UPDATE users SET username = ?, password = ?, job_position = ? WHERE id = ?",
          [username, password, job_position, id]
      );

      // อัพเดท user sites
      await connection.query("DELETE FROM user_sites WHERE user_id = ?", [id]);
      
      if (site_ids.length > 0) {
          const siteValues = site_ids.map(siteId => [id, parseInt(siteId)]);
          await connection.query(
              "INSERT INTO user_sites (user_id, site_id) VALUES ?",
              [siteValues]
          );
      }

      await connection.commit();
      res.json({ success: true, message: "User updated successfully" });

  } catch (err) {
      if (connection) await connection.rollback();
      console.error('Error updating user:', err);
      res.status(500).json({ success: false, error: err.message });
  } finally {
      if (connection) connection.release();
  }
};

// เพิ่มตัวแปร constant สำหรับตำแหน่งที่อนุญาต
const VALID_POSITIONS = ['BIM', 'Adminsite', 'PD', 'PM', 'PE', 'OE', 'SE', 'FM', 'CM'];

exports.bulkUploadUsers = async (req, res) => {
    const { users } = req.body;
    let connection;
    
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        
        const results = {
            success: [],
            failed: []
        };

        // กรองแถวที่เป็นคำอธิบายออก
        const validUsers = users.filter(user => 
            !user.username.startsWith('Required:') && 
            !user.job_position?.startsWith('Required:')
        );

        for (const user of validUsers) {
            try {
                // ตรวจสอบ username
                if (!user.username || typeof user.username !== 'string') {
                    throw new Error('Username is required and must be text');
                }

                // ตรวจสอบ username ซ้ำ
                const [existingUser] = await connection.query(
                    "SELECT id FROM users WHERE username = ?",
                    [user.username]
                );

                if (existingUser.length > 0) {
                    throw new Error(`Username ${user.username} already exists`);
                }

                // ตรวจสอบ password
                if (!user.password || user.password.length < 6) {
                    throw new Error('Password must be at least 6 characters');
                }

                // ทำความสะอาดและตรวจสอบ job_position
                let cleanJobPosition = String(user.job_position || '').trim();
                if (!cleanJobPosition) {
                    throw new Error('Job position is required');
                }
                // แยก job_position กรณีที่มีหลายค่า (เช่น "123456 PM")
                cleanJobPosition = cleanJobPosition.split(' ').pop();
                
                if (!VALID_POSITIONS.includes(cleanJobPosition)) {
                    throw new Error(`Invalid job position: "${cleanJobPosition}". Must be one of: ${VALID_POSITIONS.join(', ')}`);
                }

                // แปลงและตรวจสอบ site_access
                const site_access = user.site_access ? String(user.site_access).trim() : '';
                const siteIds = site_access.split(',')
                    .map(id => parseInt(id.trim()))
                    .filter(id => !isNaN(id));

                if (siteIds.length === 0) {
                    throw new Error('At least one site access is required');
                }

                // เพิ่มผู้ใช้
                const [userResult] = await connection.query(
                    "INSERT INTO users (username, password, job_position, email) VALUES (?, ?, ?, ?)",
                    [
                        user.username,
                        user.password,
                        cleanJobPosition,
                        user.email || null
                    ]
                );

                // เพิ่ม user_sites
                const siteValues = siteIds.map(siteId => [userResult.insertId, siteId]);
                await connection.query(
                    "INSERT INTO user_sites (user_id, site_id) VALUES ?",
                    [siteValues]
                );

                results.success.push(user.username);
            } catch (err) {
                results.failed.push({
                    username: user.username || 'Unknown',
                    error: err.message
                });
            }
        }

        await connection.commit();
        res.json({
            success: true,
            results
        });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Bulk upload error:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    } finally {
        if (connection) connection.release();
    }
};