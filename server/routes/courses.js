import express from 'express';
import { getAllRows, getRow, runQuery } from '../database/connection.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/courses/departments - Get all unique departments from courses table
router.get('/departments', authenticateToken, async (req, res) => {
  try {
    const departments = await getAllRows(
      'SELECT DISTINCT department FROM courses ORDER BY department ASC'
    );

    const deptList = departments.map(d => d.department);

    res.json({
      success: true,
      departments: deptList,
      count: deptList.length
    });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch departments',
      error: error.message
    });
  }
});

// GET /api/courses/semesters - Get unique semesters for a department
router.get('/semesters', authenticateToken, async (req, res) => {
  try {
    const { department } = req.query;
    
    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'Department parameter is required'
      });
    }

    const semesters = await getAllRows(
      'SELECT DISTINCT semester FROM courses WHERE department = ? ORDER BY semester ASC',
      [department]
    );

    const semList = semesters.map(s => s.semester.toString());

    res.json({
      success: true,
      semesters: semList,
      count: semList.length
    });
  } catch (error) {
    console.error('Get semesters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch semesters',
      error: error.message
    });
  }
});

// GET /api/courses/sections - Get unique sections for department and semester
router.get('/sections', authenticateToken, async (req, res) => {
  try {
    const { department, semester } = req.query;
    
    if (!department || !semester) {
      return res.status(400).json({
        success: false,
        message: 'Department and semester parameters are required'
      });
    }

    const sections = await getAllRows(
      'SELECT DISTINCT section FROM courses WHERE department = ? AND semester = ? ORDER BY section ASC',
      [department, parseInt(semester)]
    );

    const secList = sections.map(s => s.section);

    res.json({
      success: true,
      sections: secList,
      count: secList.length
    });
  } catch (error) {
    console.error('Get sections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sections',
      error: error.message
    });
  }
});

// GET /api/courses/filtered - Get filtered courses for teacher assignment
router.get('/filtered', authenticateToken, async (req, res) => {
  try {
    const { semester, department, section } = req.query;
    
    let query = 'SELECT id, course_code, course_name, department, semester, section, credits, total_sessions_planned FROM courses WHERE 1=1';
    const params = [];
    
    // Add semester filter (single value)
    if (semester) {
      query += ' AND semester = ?';
      params.push(parseInt(semester));
    }
    
    // Add department filter (single value)
    if (department) {
      query += ' AND department = ?';
      params.push(department);
    }
    
    // Add section filter (single value)
    if (section) {
      query += ' AND section = ?';
      params.push(section);
    }
    
    query += ' ORDER BY semester, department, section, course_code';
    
    const courses = await getAllRows(query, params);
    
    res.json({
      success: true,
      courses: courses || []
    });
  } catch (error) {
    console.error('Get filtered courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch filtered courses',
      error: error.message
    });
  }
});

// GET /api/courses - Get all courses (subjects)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { department, semester } = req.query;
    
    let query = 'SELECT id, course_code as subject_code, course_name as subject_name, department, semester, section, credits, total_sessions_planned, created_at FROM courses';
    const params = [];
    const conditions = [];
    
    if (department) {
      conditions.push('department = ?');
      params.push(department);
    }
    
    if (semester) {
      conditions.push('semester = ?');
      params.push(parseInt(semester));
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY department, semester, course_code';
    
    const subjects = await getAllRows(query, params);
    
    res.json({
      success: true,
      subjects,
      count: subjects.length
    });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch courses',
      error: error.message
    });
  }
});

// GET /api/subjects/:id - Get single subject (from courses table)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const subject = await getRow('SELECT id, course_code as subject_code, course_name as subject_name, department, semester, credits, total_sessions_planned, created_at FROM courses WHERE id = ?', [id]);
    
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }
    
    res.json({
      success: true,
      subject
    });
  } catch (error) {
    console.error('Get subject error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subject',
      error: error.message
    });
  }
});

// POST /api/courses - Create new course (insert into courses table)
router.post('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { subject_code, subject_name, department, semester, section, credits, total_sessions_planned } = req.body;
    
    // Validation
    if (!subject_code || !subject_name || !department || !semester || !section) {
      return res.status(400).json({
        success: false,
        message: 'Course code, name, department, semester, and section are required'
      });
    }
    
    // Check for duplicate combination (course_code + semester + department + section)
    const existing = await getRow(
      'SELECT id FROM courses WHERE course_code = ? AND semester = ? AND department = ? AND section = ?',
      [subject_code, parseInt(semester), department, section]
    );
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Course with code "${subject_code}", department "${department}", semester ${semester}, and section "${section}" already exists`
      });
    }
    
    // Insert into courses table
    const result = await runQuery(
      `INSERT INTO courses (course_code, course_name, department, semester, section, credits, total_sessions_planned, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
      [subject_code, subject_name, department, parseInt(semester), section, credits || 4, total_sessions_planned || 50]
    );
    
    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      subjectId: result.id
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create course',
      error: error.message
    });
  }
});

// PUT /api/courses/:id - Update course (update courses table)
router.put('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { subject_code, subject_name, department, semester, section, credits, total_sessions_planned } = req.body;
    
    // Check if course exists
    const existing = await getRow('SELECT id FROM courses WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }
    
    // Check for duplicate combination (code + semester + department + section) excluding current course
    if (subject_code || semester || department || section) {
      const duplicate = await getRow(
        'SELECT id FROM courses WHERE course_code = ? AND semester = ? AND department = ? AND section = ? AND id != ?',
        [subject_code, parseInt(semester), department, section, id]
      );
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `Course with code "${subject_code}", department "${department}", semester ${semester}, and section "${section}" already exists`
        });
      }
    }
    
    // Update courses table
    await runQuery(
      `UPDATE courses 
       SET course_code = ?, course_name = ?, department = ?, semester = ?, section = ?, credits = ?, total_sessions_planned = ?
       WHERE id = ?`,
      [subject_code, subject_name, department, parseInt(semester), section, credits || 4, total_sessions_planned || 50, id]
    );
    
    res.json({
      success: true,
      message: 'Course updated successfully'
    });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update course',
      error: error.message
    });
  }
});

// DELETE /api/subjects/:id - Delete subject (delete from courses table)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if subject exists
    const existing = await getRow('SELECT id FROM courses WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }
    
    // Check if course is being used in enrollments or timetable
    const studentEnrollments = await getRow('SELECT COUNT(*) as count FROM student_enrollments WHERE course_id = ?', [id]);
    const teacherEnrollments = await getRow('SELECT COUNT(*) as count FROM teacher_enrollments WHERE course_id = ?', [id]);
    const timetableEntries = await getRow('SELECT COUNT(*) as count FROM timetable WHERE course_id = ?', [id]);
    
    if (studentEnrollments.count > 0 || teacherEnrollments.count > 0 || timetableEntries.count > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete subject. It is being used in enrollments or timetable.',
        usage: {
          studentEnrollments: studentEnrollments.count,
          teacherEnrollments: teacherEnrollments.count,
          timetableEntries: timetableEntries.count
        }
      });
    }
    
    // Delete from courses table
    await runQuery('DELETE FROM courses WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Subject deleted successfully'
    });
  } catch (error) {
    console.error('Delete subject error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete subject',
      error: error.message
    });
  }
});

export default router;
