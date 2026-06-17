-- Attendance System Database Schema
-- SQLite Database for Academic Project

-- NOTE: This schema uses CREATE TABLE IF NOT EXISTS to preserve existing data
-- Only run DROP statements manually if you want to reset the entire database

-- Users table (Admin, Teachers, Students)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone_no VARCHAR(15) UNIQUE NOT NULL,
    created_at DATETIME DEFAULT (datetime('now', 'localtime'))
);

-- Students table (extends users) - Permanent student identity
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    usn VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(50) NOT NULL,
    face_embeddings TEXT NOT NULL, -- JSON array of face embeddings
    captured_image_path VARCHAR(255) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Courses table - Master list of all course offerings (subject + semester + department + section)
CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_code VARCHAR(20) NOT NULL,
    course_name VARCHAR(100) NOT NULL,
    department VARCHAR(50) NOT NULL,
    semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
    section VARCHAR(10) NOT NULL,
    credits INTEGER DEFAULT 4,
    total_sessions_planned INTEGER DEFAULT 50,
    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
    UNIQUE(course_code, semester, department, section)
);

-- Student Enrollments table - Tracks enrollment history across semesters
CREATE TABLE IF NOT EXISTS student_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    enrollment_date DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
    completion_date DATETIME NOT NULL,
    trend VARCHAR(50) DEFAULT NULL,
    consistent VARCHAR(50) DEFAULT NULL,
    risk VARCHAR(50) DEFAULT NULL,
    attentiveness VARCHAR(50) DEFAULT NULL,
    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE(student_id, course_id, enrollment_date)
);

-- Teachers table (extends users) - Permanent teacher identity
CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    teacher_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Teacher Enrollments table - Tracks teaching assignments across semesters
CREATE TABLE IF NOT EXISTS teacher_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    enrollment_date DATETIME DEFAULT (datetime('now', 'localtime')),
    completion_date DATETIME,
    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE(teacher_id, course_id, enrollment_date)
);

-- Timetable - Stores class schedule
-- 
-- HOW TO USE THIS TABLE:
-- 1. Select COURSE from dropdown (courses include semester, department, section, and subject)
-- 2. IMPORTANT: Select DAY_OF_WEEK from dropdown BEFORE adding entries
--    - Available days: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday
--    - ALWAYS verify the selected day before clicking "Add Entry"
--    - If you accidentally add to wrong day, use the edit/delete buttons to fix
-- 3. Enter START_TIME in 24-hour format (e.g., 09:00, 14:30)
-- 4. Enter END_TIME in 24-hour format (e.g., 09:55, 15:25)
-- 5. DATE field is optional (leave empty for recurring weekly schedule)
--
-- COMMON MISTAKES TO AVOID:
-- ❌ Forgetting to change day_of_week dropdown before adding multiple entries
-- ❌ Using 12-hour format (use 09:00 not 9:00 AM)
-- ❌ Adding duplicate entries for the same time slot
-- ✓ Always double-check the day_of_week dropdown is set correctly
-- ✓ Review the timetable after adding entries to verify correctness
-- ✓ Use the "Manage Timetable" page to view/edit/delete entries
--
CREATE TABLE IF NOT EXISTS timetable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    day_of_week VARCHAR(20) NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    date DATE DEFAULT NULL,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE(course_id, day_of_week, start_time, date)
);

-- Attendance Sessions table
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    session_date DATE NOT NULL,
    session_time TIME NOT NULL,
    captured_image_path VARCHAR(255),
    total_students INTEGER DEFAULT 0,
    present_count INTEGER DEFAULT 0,
    absent_count INTEGER DEFAULT 0,
    recognition_accuracy DECIMAL(5,2),
    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Attendance Records table
CREATE TABLE IF NOT EXISTS attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'excused', 'late')),
    confidence DECIMAL(5,2),
    emotion VARCHAR(50) DEFAULT NULL,
    attentiveness VARCHAR(50) DEFAULT NULL,
    reason_type VARCHAR(100),
    marked_by VARCHAR(20) DEFAULT 'system',
    marked_at DATETIME DEFAULT (datetime('now', 'localtime')),
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Indexes for better performance
-- Single column indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_students_usn ON students(usn);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_department ON students(department);
CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON teachers(user_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_student ON student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_course ON student_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_teacher_enrollments_teacher ON teacher_enrollments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_enrollments_course ON teacher_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON attendance_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_course ON attendance_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_teacher ON attendance_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON attendance_records(student_id);

-- Courses table indexes
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(course_code);
CREATE INDEX IF NOT EXISTS idx_courses_dept_sem ON courses(department, semester);
CREATE INDEX IF NOT EXISTS idx_courses_dept_sem_sec ON courses(department, semester, section);

-- Composite indexes for optimized multi-column queries
-- Student Enrollments: Student + course lookup
CREATE INDEX IF NOT EXISTS idx_enrollments_student_course 
ON student_enrollments(student_id, course_id);

-- Student Enrollments: Enrollment date lookups for duplicate prevention
CREATE INDEX IF NOT EXISTS idx_enrollments_student_date 
ON student_enrollments(student_id, enrollment_date);

-- Teacher Enrollments: Teacher + course lookup
CREATE INDEX IF NOT EXISTS idx_teacher_enrollments_teacher_course 
ON teacher_enrollments(teacher_id, course_id);

-- Teacher Enrollments: Enrollment date lookups
CREATE INDEX IF NOT EXISTS idx_teacher_enrollments_date 
ON teacher_enrollments(teacher_id, enrollment_date);

-- Attendance Sessions: Duplicate session check (teacher + course + date)
CREATE INDEX IF NOT EXISTS idx_attendance_session_lookup 
ON attendance_sessions(teacher_id, course_id, session_date);

-- Attendance Sessions: Course + date lookup for session queries
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_course_date 
ON attendance_sessions(course_id, session_date);

-- Attendance Sessions: Teacher + date lookup for teacher workload queries
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_teacher_date 
ON attendance_sessions(teacher_id, session_date);

-- Attendance Records: Student attendance history (student + session)
CREATE INDEX IF NOT EXISTS idx_attendance_student_session 
ON attendance_records(student_id, session_id);

-- Attendance Records: Session + status lookup for filtering by attendance status
CREATE INDEX IF NOT EXISTS idx_attendance_records_session_status 
ON attendance_records(session_id, status);

-- Attendance Records: Student + status lookup for student attendance analysis
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_status 
ON attendance_records(student_id, status);

-- Attendance Records: Marked by lookup for system vs manual analysis
CREATE INDEX IF NOT EXISTS idx_attendance_records_marked_by 
ON attendance_records(marked_by);

-- Attendance Records: Marked at lookup for date-based queries
CREATE INDEX IF NOT EXISTS idx_attendance_records_marked_at 
ON attendance_records(marked_at);

-- Timetable: Course + day lookup for schedule queries
CREATE INDEX IF NOT EXISTS idx_timetable_course_day 
ON timetable(course_id, day_of_week);

-- Insert default admin user (password: admin123)
INSERT OR IGNORE INTO users (username, password_hash, role, name, email, phone_no) VALUES 
('admin', '$2a$10$hFzTcy9vhCKIf4gitiqFauuL2JHhdwTCYnHE2bUvfVHxtWLvMOnke', 'admin', 'System Administrator', 'admin@system.local', '9876543210');
