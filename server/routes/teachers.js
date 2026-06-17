import express from 'express';
import bcrypt from 'bcryptjs';
import { runQuery, getRow, getAllRows } from '../database/connection.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// POST /api/teachers/assign-courses - Assign courses to teacher
router.post('/assign-courses', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { teacherId, courseIds, enrollmentDate, completionDate } = req.body;

    // Validation 1: Check all required fields
    if (!teacherId || !courseIds?.length || !enrollmentDate || !completionDate) {
      return res.status(400).json({ message: 'All fields required' });
    }

    // Validation 2: Teacher ID format
    const trimmedTeacherId = teacherId.trim();
    if (trimmedTeacherId.length < 3) {
      return res.status(400).json({ message: 'Teacher ID min 3 characters' });
    }

    // Validation 3: Teacher exists
    const teacher = await getRow('SELECT id FROM teachers WHERE teacher_id = ?', [trimmedTeacherId]);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not registered' });
    }

    // Validation 4: All courses exist
    const courses = await getAllRows('SELECT id FROM courses WHERE id IN (?)', [courseIds]);
    if (courses.length !== courseIds.length) {
      return res.status(400).json({ message: 'Some courses not found' });
    }

    // Validation 5: Check for duplicate assignments for THIS teacher
    for (const courseId of courseIds) {
      const duplicate = await getRow(
        `SELECT id FROM teacher_enrollments 
         WHERE teacher_id = ? AND course_id = ? AND enrollment_date = ?`,
        [teacher.id, courseId, enrollmentDate]
      );
      if (duplicate) {
        return res.status(409).json({ message: `Already assigned to course ID ${courseId}` });
      }
    }

    // Validation 6: Check if ANY OTHER teacher is assigned to same course for same enrollment date
    for (const courseId of courseIds) {
      const otherTeacher = await getRow(
        `SELECT t.teacher_id, t.name FROM teacher_enrollments te
         JOIN teachers t ON te.teacher_id = t.id
         WHERE te.course_id = ? AND te.enrollment_date = ? AND te.teacher_id != ?`,
        [courseId, enrollmentDate, teacher.id]
      );
      if (otherTeacher) {
        return res.status(409).json({ 
          message: `Course ID ${courseId} already assigned to teacher ${otherTeacher.teacher_id} (${otherTeacher.name}) for this enrollment period` 
        });
      }
    }

    // Insert all assignments
    const enrollmentIds = [];
    for (const courseId of courseIds) {
      const result = await runQuery(
        `INSERT INTO teacher_enrollments (teacher_id, course_id, enrollment_date, completion_date)
         VALUES (?, ?, ?, ?)`,
        [teacher.id, courseId, enrollmentDate, completionDate]
      );
      enrollmentIds.push(result.id);
    }

    res.status(201).json({
      message: 'Courses assigned successfully',
      enrollmentCount: enrollmentIds.length,
      enrollmentIds
    });

  } catch (error) {
    console.error('Assign courses error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// POST /api/teachers/assign-subjects - Assign subjects to teacher
router.post('/assign-subjects', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { teacherId, subjectCombinations, enrollmentDate, completionDate, forceAssign } = req.body;

    // Validation 1: Check all required fields
    if (!teacherId || !subjectCombinations || subjectCombinations.length === 0) {
      return res.status(400).json({ message: 'Please provide teacher ID and subject combinations' });
    }

    if (!enrollmentDate || !completionDate) {
      return res.status(400).json({ message: 'Enrollment date and completion date are required' });
    }

    // Validation 2: Teacher ID format (minimum 3 characters)
    const trimmedTeacherId = teacherId.trim();
    if (trimmedTeacherId.length < 3) {
      return res.status(400).json({ message: 'Teacher ID must be at least 3 characters long' });
    }

    // Database Check 1: Check if teacher exists
    const teacher = await getRow('SELECT id, teacher_id, name FROM teachers WHERE teacher_id = ?', [trimmedTeacherId]);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher ID not registered in the system. Please register the teacher first.' });
    }

    // Convert subject codes to course IDs
    const courseIds = [];
    const duplicates = [];
    const conflicts = [];

    for (const combo of subjectCombinations) {
      // Find course by subject code, semester, department, and section
      const course = await getRow(
        `SELECT id FROM courses 
         WHERE course_code = ? 
         AND semester = ? 
         AND department = ? 
         AND section = ?`,
        [combo.subject, parseInt(combo.semester), combo.department, combo.section]
      );

      if (!course) {
        return res.status(400).json({ 
          message: `Course not found: ${combo.subject} (Sem ${combo.semester}, ${combo.department}, Sec ${combo.section})` 
        });
      }

      // Database Check 2: Check for duplicate assignments (same teacher, same course, same enrollment date)
      const duplicate = await getRow(
        `SELECT id FROM teacher_enrollments 
         WHERE teacher_id = ? 
         AND course_id = ? 
         AND enrollment_date = ?`,
        [teacher.id, course.id, enrollmentDate]
      );

      if (duplicate) {
        duplicates.push(combo);
        continue;
      }

      // Database Check 3: Check for conflicts (different teacher, same course, same enrollment date)
      const conflictingTeacher = await getRow(
        `SELECT t.teacher_id, t.name 
         FROM teacher_enrollments te
         JOIN teachers t ON te.teacher_id = t.id
         WHERE te.course_id = ? 
         AND te.enrollment_date = ?
         AND te.teacher_id != ?`,
        [course.id, enrollmentDate, teacher.id]
      );

      if (conflictingTeacher) {
        conflicts.push({
          ...combo,
          existingTeacherId: conflictingTeacher.teacher_id,
          existingTeacherName: conflictingTeacher.name
        });
        continue;
      }

      courseIds.push(course.id);
    }

    // If duplicates found, return error
    if (duplicates.length > 0) {
      return res.status(409).json({ 
        message: `Teacher ${trimmedTeacherId} is already assigned to ${duplicates.length} subject(s)`,
        duplicates,
        type: 'duplicate'
      });
    }

    // If conflicts found and not forcing, return warning
    if (conflicts.length > 0 && !forceAssign) {
      return res.status(409).json({ 
        message: 'Some subjects are already assigned to other teachers',
        conflicts,
        type: 'conflict',
        requiresConfirmation: true
      });
    }

    // Create enrollment records for each course
    const enrollmentIds = [];
    
    for (const courseId of courseIds) {
      const result = await runQuery(
        'INSERT INTO teacher_enrollments (teacher_id, course_id, enrollment_date, completion_date) VALUES (?, ?, ?, ?)',
        [teacher.id, courseId, enrollmentDate, completionDate]
      );
      enrollmentIds.push(result.id);
    }

    res.status(201).json({
      message: 'Teacher subjects assigned successfully',
      enrollmentCount: enrollmentIds.length,
      enrollmentIds,
      hadConflicts: conflicts.length > 0
    });

  } catch (error) {
    console.error('Assign subjects error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// GET /api/teachers - Get all teachers with their enrollments
router.get('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    // Get all teachers with their user details
    const teachers = await getAllRows(
      `SELECT t.id, t.teacher_id, t.name, u.email, u.phone_no
       FROM teachers t
       JOIN users u ON t.user_id = u.id
       ORDER BY t.name ASC`
    );

    if (!teachers || teachers.length === 0) {
      return res.json({
        success: true,
        data: [],
        rowCount: 0,
        structure: [
          { name: 'teacher_id', type: 'VARCHAR', notNull: true, defaultValue: null, primaryKey: false },
          { name: 'name', type: 'VARCHAR', notNull: true, defaultValue: null, primaryKey: false },
          { name: 'email', type: 'VARCHAR', notNull: true, defaultValue: null, primaryKey: false },
          { name: 'phone_no', type: 'VARCHAR', notNull: true, defaultValue: null, primaryKey: false },
          { name: 'departments', type: 'TEXT', notNull: false, defaultValue: null, primaryKey: false },
          { name: 'semesters', type: 'TEXT', notNull: false, defaultValue: null, primaryKey: false },
          { name: 'sections', type: 'TEXT', notNull: false, defaultValue: null, primaryKey: false },
          { name: 'courses', type: 'TEXT', notNull: false, defaultValue: null, primaryKey: false }
        ]
      });
    }

    // For each teacher, get their enrollments and courses
    const teacherData = await Promise.all(teachers.map(async (teacher) => {
      // Get all courses assigned to this teacher through teacher_enrollments
      const enrollments = await getAllRows(
        `SELECT DISTINCT c.semester, c.department, c.section, c.course_code, c.course_name
         FROM teacher_enrollments te
         JOIN courses c ON te.course_id = c.id
         WHERE te.teacher_id = ?
         ORDER BY c.semester ASC, c.department ASC, c.section ASC`,
        [teacher.id]
      );

      // Extract unique departments, semesters, sections, and courses
      const departments = [...new Set(enrollments.map(e => e.department))].join(', ');
      const semesters = [...new Set(enrollments.map(e => e.semester.toString()))].join(', ');
      const sections = [...new Set(enrollments.map(e => e.section))].join(', ');
      const courses = enrollments.map(e => `${e.course_code} (${e.course_name})`).join(', ');

      return {
        teacher_id: teacher.teacher_id,
        name: teacher.name,
        email: teacher.email,
        phone_no: teacher.phone_no,
        departments: departments || '-',
        semesters: semesters || '-',
        sections: sections || '-',
        courses: courses || '-'
      };
    }));

    res.json({
      success: true,
      data: teacherData,
      rowCount: teacherData.length,
      structure: [
        { name: 'teacher_id', type: 'VARCHAR', notNull: true, defaultValue: null, primaryKey: false },
        { name: 'name', type: 'VARCHAR', notNull: true, defaultValue: null, primaryKey: false },
        { name: 'email', type: 'VARCHAR', notNull: true, defaultValue: null, primaryKey: false },
        { name: 'phone_no', type: 'VARCHAR', notNull: true, defaultValue: null, primaryKey: false },
        { name: 'departments', type: 'TEXT', notNull: false, defaultValue: null, primaryKey: false },
        { name: 'semesters', type: 'TEXT', notNull: false, defaultValue: null, primaryKey: false },
        { name: 'sections', type: 'TEXT', notNull: false, defaultValue: null, primaryKey: false },
        { name: 'courses', type: 'TEXT', notNull: false, defaultValue: null, primaryKey: false }
      ]
    });

  } catch (error) {
    console.error('Get all teachers error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// GET /api/teachers/:teacherId - Get teacher info
router.get('/:teacherId', authenticateToken, async (req, res) => {
  try {
    const { teacherId } = req.params;

    const teacher = await getRow('SELECT * FROM teachers WHERE teacher_id = ?', [teacherId]);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // Get user details (email, phone)
    const user = await getRow('SELECT email, phone_no FROM users WHERE id = ?', [teacher.user_id]);

    res.json({
      success: true,
      teacher: {
        id: teacher.id,
        teacher_id: teacher.teacher_id,
        name: teacher.name,
        email: user?.email || '',
        phone_no: user?.phone_no || '',
        created_at: teacher.created_at
      }
    });

  } catch (error) {
    console.error('Get teacher error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/teachers/:teacherId - Update teacher details
router.put('/:teacherId', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { name, email, phone_no, password } = req.body;

    // Validation 1: Check required fields
    if (!name || !email || !phone_no) {
      return res.status(400).json({ message: 'Name, email, and phone number are required' });
    }

    // Validation 2: Name validation
    if (name.trim().length < 3) {
      return res.status(400).json({ message: 'Name must be at least 3 characters long' });
    }

    // Validation 3: Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    // Validation 4: Phone number validation (required)
    if (phone_no.length !== 10 || !/^\d{10}$/.test(phone_no)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }

    // Validation 5: Password validation (if provided)
    if (password && password.trim().length > 0 && password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if teacher exists
    const teacher = await getRow('SELECT * FROM teachers WHERE teacher_id = ?', [teacherId]);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // Get current user data
    const currentUser = await getRow('SELECT email, phone_no FROM users WHERE id = ?', [teacher.user_id]);
    const normalizedCurrentPhone = currentUser.phone_no || '';

    // Check for duplicate email only if email has changed (BEFORE updating)
    if (email !== currentUser.email) {
      const duplicateEmail = await getRow(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, teacher.user_id]
      );
      if (duplicateEmail) {
        return res.status(409).json({ message: 'Email is already registered to another user' });
      }
    }

    // Check for duplicate phone number only if phone has changed (BEFORE updating)
    if (phone_no !== normalizedCurrentPhone) {
      const duplicatePhone = await getRow(
        'SELECT id FROM users WHERE phone_no = ? AND id != ?',
        [phone_no, teacher.user_id]
      );
      if (duplicatePhone) {
        return res.status(409).json({ message: 'Phone number is already registered to another user' });
      }
    }

    // All validations passed - now update the database
    // Update teacher name
    await runQuery(
      'UPDATE teachers SET name = ? WHERE teacher_id = ?',
      [name, teacherId]
    );

    // Update user details
    if (password && password.trim().length > 0) {
      // Update with new password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      
      await runQuery(
        'UPDATE users SET name = ?, email = ?, phone_no = ?, password_hash = ? WHERE id = ?',
        [name, email, phone_no, passwordHash, teacher.user_id]
      );
    } else {
      // Update without changing password
      await runQuery(
        'UPDATE users SET name = ?, email = ?, phone_no = ? WHERE id = ?',
        [name, email, phone_no, teacher.user_id]
      );
    }

    res.json({
      success: true,
      message: 'Teacher details updated successfully'
    });

  } catch (error) {
    console.error('Update teacher error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

export default router;
