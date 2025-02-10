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
    job_position ENUM('BIM', 'Adminsite', 'PD', 'PM', 'PE', 'OE', 'SE', 'FM') NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ตารางความสัมพันธ์ระหว่างผู้ใช้กับโครงการ
CREATE TABLE user_sites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    site_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- ตารางเอกสาร
CREATE TABLE documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT DEFAULT NULL,
    google_file_id VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ตารางหมวดงาน (สำหรับ RFA)
CREATE TABLE work_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_code VARCHAR(10) NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    site_id INT NOT NULL,
    active BOOLEAN DEFAULT true,
    UNIQUE KEY unique_category (category_code, site_id)
);
-- ตารางเอกสาร RFA
CREATE TABLE rfa_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_number VARCHAR(3) NOT NULL,
    revision_number VARCHAR(2) NOT NULL DEFAULT '00',
    site_id INT NOT NULL,
    category_id INT NOT NULL,
    document_id INT NOT NULL,
    status ENUM('draft', 'submitted', 'approved', 'rejected') DEFAULT 'draft',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_doc (site_id, category_id, document_number, revision_number)
);

-- เพิ่มข้อมูลในตาราง sites
INSERT INTO sites (site_name) VALUES
('Bann Sansiri Bangna'),
('DH2-พรานนก'),
('DH2-สาย1');

-- เพิ่มข้อมูลในตาราง users (รหัสผ่านเข้ารหัส)
INSERT INTO users (username, password, role, job_position) VALUES
('thai.l', '101622', 'user', 'BIM'),
('krissanapol', 'password2', 'user', 'Adminsite'),
('admin', 'admin123', 'admin', NULL);

-- เพิ่มความสัมพันธ์ระหว่างผู้ใช้กับโครงการ
INSERT INTO user_sites (user_id, site_id) VALUES
(1, 1), -- thai.l สามารถเข้าถึง Bann Sansiri Bangna
(2, 2), -- krissanapol สามารถเข้าถึง DH2-พรานนก
(2, 3); -- krissanapol สามารถเข้าถึง DH2-สาย1

-- เพิ่มข้อมูลตัวอย่าง
INSERT INTO documents (user_id, file_name, file_url, google_file_id) 
VALUES (1, 'example.pdf', 'https://drive.google.com/file/d/123456abcXYZ', '123456abcXYZ');

-- เพิ่มข้อมูลตัวอย่างในตาราง work_categories
INSERT INTO work_categories (category_code, category_name, site_id) VALUES
('ST', 'Structure', 1),
('AR', 'Architecture', 1),
('LA', 'Landscape', 1);

DESCRIBE documents;
