-- 1. สร้างฐานข้อมูล
DROP DATABASE IF EXISTS railway;
CREATE DATABASE IF NOT EXISTS railway;
USE railway;

-- 2. สร้างตารางพื้นฐาน
-- ตารางโครงการ
CREATE TABLE sites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    site_name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_site_name (site_name)
);

-- ตารางผู้ใช้
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    job_position ENUM('BIM', 'Adminsite', 'PD', 'PM', 'PE', 'OE', 'SE', 'FM') NULL,
    email VARCHAR(255) NULL,
    active BOOLEAN DEFAULT true,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_role_active (role, active)
);

-- ตารางความสัมพันธ์ระหว่างผู้ใช้กับโครงการ
CREATE TABLE user_sites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    site_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY unique_user_site (user_id, site_id),
    INDEX idx_user_site (user_id, site_id)
);

-- ตารางเอกสาร
CREATE TABLE documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT DEFAULT NULL,
    file_size BIGINT NULL,
    mime_type VARCHAR(100) NULL,
    google_file_id VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_user_upload (user_id, uploaded_at),
    INDEX idx_google_file (google_file_id)
);

-- ตารางหมวดงาน
CREATE TABLE work_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_code VARCHAR(10) NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    site_id INT NOT NULL,
    description TEXT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY unique_category (category_code, site_id),
    INDEX idx_category_code (category_code),
    INDEX idx_site_active (site_id, active)
);

-- ตารางเอกสาร RFA
CREATE TABLE rfa_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_number VARCHAR(3) NOT NULL,
    revision_number VARCHAR(2) NOT NULL DEFAULT '00',
    site_id INT NOT NULL,
    category_id INT NOT NULL,
    document_id INT NOT NULL,
    title VARCHAR(255) NULL,
    description TEXT NULL,
    status ENUM('draft', 'submitted', 'approved', 'rejected') DEFAULT 'draft',
    remarks TEXT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (category_id) REFERENCES work_categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY unique_doc (site_id, category_id, document_number, revision_number),
    INDEX idx_site_category (site_id, category_id),
    INDEX idx_document_number (document_number),
    INDEX idx_status (status)
);

-- ตารางประวัติการแก้ไข RFA
CREATE TABLE rfa_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfa_id INT NOT NULL,
    action ENUM('created', 'updated', 'status_changed') NOT NULL,
    status ENUM('draft', 'submitted', 'approved', 'rejected') NULL,
    remarks TEXT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rfa_id) REFERENCES rfa_documents(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_rfa_action (rfa_id, action)
);

-- 3. สร้าง Trigger
DELIMITER //
CREATE TRIGGER tr_rfa_document_history
AFTER UPDATE ON rfa_documents
FOR EACH ROW
BEGIN
    IF NEW.status != OLD.status THEN
        INSERT INTO rfa_history (
            rfa_id,
            action,
            status,
            user_id
        ) VALUES (
            NEW.id,
            'status_changed',
            NEW.status,
            NEW.created_by
        );
    END IF;
END //
DELIMITER ;

-- 4. เพิ่มข้อมูลตัวอย่าง
INSERT INTO sites (site_name) VALUES
('Bann Sansiri Bangna'),
('DH2-พรานนก'),
('DH2-สาย1');

INSERT INTO users (username, password, role, job_position, email) VALUES
('thai.l', '101622', 'user', 'BIM', 'thai.l@example.com'),
('krissanapol', 'password2', 'user', 'Adminsite', 'krissanapol@example.com'),
('admin', 'admin123', 'admin', NULL, 'admin@example.com');

INSERT INTO user_sites (user_id, site_id) VALUES
(1, 1),
(2, 2),
(2, 3);

INSERT INTO work_categories (category_code, category_name, site_id, description) VALUES
('ST', 'Structure', 1, 'Structural engineering documents'),
('AR', 'Architecture', 1, 'Architectural design documents'),
('LA', 'Landscape', 1, 'Landscape design documents');