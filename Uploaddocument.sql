-- ลบฐานข้อมูลเดิม (ถ้ามี) และสร้างใหม่
DROP DATABASE IF EXISTS railway;
CREATE DATABASE IF NOT EXISTS railway;
USE railway;

-- ตารางโครงการ
CREATE TABLE sites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    site_name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ตารางผู้ใช้
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    job_position ENUM('BIM', 'Adminsite', 'PD', 'PM', 'PE', 'OE', 'SE', 'FM') NULL
);

-- ตารางความสัมพันธ์ระหว่างผู้ใช้กับโครงการ
CREATE TABLE user_sites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    site_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- เพิ่มข้อมูลในตาราง sites
INSERT INTO sites (site_name) VALUES
('Bann Sansiri Bangna'),
('DH2-พรานนก'),
('DH2-สาย1');

-- เพิ่มข้อมูลในตาราง users
INSERT INTO users (username, password, role, job_position) VALUES
('thai.l', '101622', 'user', 'BIM'),
('krissanapol', '101485', 'user', 'Adminsite'),
('admin', 'admin123', 'admin', NULL);

-- เพิ่มความสัมพันธ์ระหว่างผู้ใช้กับโครงการ
INSERT INTO user_sites (user_id, site_id) VALUES
(1, 1), -- thai.l สามารถเข้าถึง Bann Sansiri Bangna
(2, 2), -- krissanapol สามารถเข้าถึง DH2-พรานนก
(2, 3); -- krissanapol สามารถเข้าถึง DH2-สาย1
