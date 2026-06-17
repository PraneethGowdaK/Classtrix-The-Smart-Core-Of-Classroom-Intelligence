import express from 'express';
import { getRow, getAllRows } from '../database/connection.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/analytics/teacher-courses - Get courses assigned to teacher (NEW SCHEMA)
router.get('/teacher-courses', authenticateToken, requireRole(['teacher']), async (req, res) => {
  try {
    // Get teacher record
    const teacher = await getRow('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher record not found' });
    }

    // Get all currently assigned courses from teacher_enrollments
    const courses = await getAllRows(`
      SELECT DISTINCT 
        c.id,
        c.course_code,
        c.course_name,
        c.semester,
        c.section,
        c.department,
        te.enrollment_date,
        te.completion_date
      FROM teacher_enrollments te
      JOIN courses c ON te.course_id = c.id
      WHERE te.teacher_id = ?
        AND te.enrollment_date <= date('now')
        AND te.completion_date >= date('now')
      ORDER BY c.semester, c.department, c.section, c.course_code
    `, [teacher.id]);

    if (courses.length === 0) {
      return res.json({ 
        success: true,
        courses: [],
        message: 'No active course assignments found'
      });
    }

    res.json({
      success: true,
      courses: courses,
      count: courses.length
    });

  } catch (error) {
    console.error('Get teacher courses error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/analytics/course-attendance - Get attendance analytics for a specific course (NEW SCHEMA)
router.get('/course-attendance', authenticateToken, requireRole(['teacher']), async (req, res) => {
  try {
    const { courseId } = req.query;

    if (!courseId) {
      return res.status(400).json({ message: 'Course ID is required' });
    }

    // Get teacher record
    const teacher = await getRow('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher record not found' });
    }

    // Verify teacher is assigned to this course
    const enrollment = await getRow(`
      SELECT * FROM teacher_enrollments 
      WHERE teacher_id = ? 
        AND course_id = ?
        AND enrollment_date <= date('now')
        AND completion_date >= date('now')
    `, [teacher.id, courseId]);

    if (!enrollment) {
      return res.status(403).json({ 
        message: 'You are not assigned to teach this course' 
      });
    }

    // Get course details
    const course = await getRow('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Get all students enrolled in this course
    const students = await getAllRows(`
      SELECT DISTINCT 
        s.id,
        s.usn,
        u.name,
        se.trend,
        se.consistent,
        se.risk,
        se.attentiveness
      FROM student_enrollments se
      JOIN students s ON se.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE se.course_id = ?
        AND se.enrollment_date <= date('now')
        AND se.completion_date >= date('now')
      ORDER BY s.usn
    `, [courseId]);

    if (students.length === 0) {
      return res.status(404).json({ message: 'No students enrolled in this course' });
    }

    const studentStats = [];
    let totalAttendance = 0;
    let totalSessions = 0;

    // Calculate stats for each student
    for (const student of students) {
      // Get attendance records for this student in this course
      const attendanceData = await getAllRows(`
        SELECT ar.status
        FROM attendance_records ar
        JOIN attendance_sessions ats ON ar.session_id = ats.id
        WHERE ar.student_id = ? 
          AND ats.course_id = ?
      `, [student.id, courseId]);
      
      const total = attendanceData.length;
      const present = attendanceData.filter(a => a.status === 'present' || a.status === 'excused').length;
      const percentage = total > 0 ? (present / total) * 100 : 0;

      studentStats.push({
        id: student.id,
        usn: student.usn,
        name: student.name,
        total,
        present,
        absent: total - present,
        percentage: Math.round(percentage * 100) / 100,
        trend: student.trend || 'no_data',
        consistency: student.consistent || 'no_data',
        risk: student.risk || 'no_data',
        attentiveness: student.attentiveness || 'no_data'
      });

      totalAttendance += percentage;
      totalSessions = Math.max(totalSessions, total);
    }

    const averageAttendance = students.length > 0 ? totalAttendance / students.length : 0;

    // Generate trend data from actual attendance sessions (last 5 sessions)
    const trendData = await getAllRows(`
      SELECT 
        ats.session_date,
        AVG(CASE WHEN ar.status IN ('present', 'excused') THEN 100.0 ELSE 0.0 END) as avg_percentage
      FROM attendance_sessions ats
      JOIN attendance_records ar ON ats.id = ar.session_id
      WHERE ats.course_id = ?
      GROUP BY ats.session_date
      ORDER BY ats.session_date DESC
      LIMIT 5
    `, [courseId]);

    // Format trend data for chart
    const formattedTrendData = trendData.length > 0 
      ? trendData.reverse().map((data, index) => ({
          name: `Session ${index + 1}`,
          avg: Math.round(data.avg_percentage * 100) / 100
        }))
      : [
          { name: 'Session 1', avg: averageAttendance },
          { name: 'Session 2', avg: averageAttendance },
          { name: 'Session 3', avg: averageAttendance },
          { name: 'Session 4', avg: averageAttendance },
          { name: 'Session 5', avg: averageAttendance }
        ];

    // Generate risk distribution
    const riskCounts = {
      low: studentStats.filter(s => s.risk === 'low').length,
      medium: studentStats.filter(s => s.risk === 'medium').length,
      high: studentStats.filter(s => s.risk === 'high').length,
      no_data: studentStats.filter(s => s.risk === 'no_data').length
    };

    const riskDistribution = [
      { name: 'Low Risk', count: riskCounts.low },
      { name: 'Medium Risk', count: riskCounts.medium },
      { name: 'High Risk', count: riskCounts.high }
    ];

    res.json({
      course: {
        id: course.id,
        code: course.course_code,
        name: course.course_name,
        semester: course.semester,
        section: course.section,
        department: course.department
      },
      students: studentStats,
      overallStats: {
        totalStudents: students.length,
        totalSessions: totalSessions,
        averageAttendance: Math.round(averageAttendance * 100) / 100
      },
      trendData: formattedTrendData,
      riskDistribution: riskDistribution
    });

  } catch (error) {
    console.error('Get course attendance error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/analytics/teacher-subjects-overview - Get attendance overview for all teacher's subjects
router.get('/teacher-subjects-overview', authenticateToken, requireRole(['teacher']), async (req, res) => {
  try {
    // Get teacher record
    const teacher = await getRow('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher record not found' });
    }

    // Get all active teacher enrollments with course details (NEW SCHEMA)
    const enrollments = await getAllRows(`
      SELECT DISTINCT 
        c.semester, 
        c.department, 
        c.section, 
        c.course_name as subject,
        c.course_code,
        c.id as course_id
      FROM teacher_enrollments te
      JOIN courses c ON te.course_id = c.id
      WHERE te.teacher_id = ?
        AND te.enrollment_date <= date('now')
        AND te.completion_date >= date('now')
      ORDER BY c.semester, c.department, c.section, c.course_name
    `, [teacher.id]);

    if (enrollments.length === 0) {
      return res.json({ 
        success: true,
        subjects: [],
        message: 'No active teaching assignments found'
      });
    }

    // Calculate attendance for each subject
    const subjectStats = [];
    
    for (const enrollment of enrollments) {
      const { semester, department, section, subject, course_id } = enrollment;
      
      // Get total sessions for this course (NEW SCHEMA)
      const sessions = await getAllRows(`
        SELECT id FROM attendance_sessions
        WHERE course_id = ?
      `, [course_id]);

      if (sessions.length === 0) continue;

      // Get attendance records for these sessions
      const attendanceData = await getAllRows(`
        SELECT ar.status
        FROM attendance_records ar
        WHERE ar.session_id IN (${sessions.map(() => '?').join(',')})
      `, sessions.map(s => s.id));

      const total = attendanceData.length;
      const present = attendanceData.filter(a => a.status === 'present' || a.status === 'excused').length;
      const percentage = total > 0 ? (present / total) * 100 : 0;

      subjectStats.push({
        subject: subject,
        semester: semester,
        department: department,
        section: section,
        totalSessions: sessions.length,
        averageAttendance: Math.round(percentage * 100) / 100,
        label: `${subject} (Sem ${semester}, ${department}-${section})`
      });
    }

    // Sort by average attendance descending
    subjectStats.sort((a, b) => b.averageAttendance - a.averageAttendance);

    res.json({
      success: true,
      subjects: subjectStats,
      count: subjectStats.length
    });

  } catch (error) {
    console.error('Get teacher subjects overview error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/analytics/student-subjects - Get subjects for a student based on their enrollments
router.get('/student-subjects', authenticateToken, async (req, res) => {
  try {
    const { semester } = req.query;

    // Only students can access this endpoint
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get student record
    const student = await getRow('SELECT * FROM students WHERE user_id = ?', [req.user.id]);
    if (!student) {
      return res.status(404).json({ message: 'Student record not found' });
    }

    // Validate semester parameter
    if (!semester) {
      return res.status(400).json({ message: 'Semester parameter is required' });
    }

    // Get subjects from student_enrollments for the specified semester
    const enrollments = await getAllRows(
      `SELECT DISTINCT c.course_code as subject 
       FROM student_enrollments se
       JOIN courses c ON se.course_id = c.id
       WHERE se.student_id = ? AND c.semester = ? 
       ORDER BY c.course_code`,
      [student.id, semester]
    );

    const subjects = enrollments.map(e => e.subject);

    console.log(`Student ${student.id} (${student.usn}) subjects for semester ${semester}:`, subjects);
    console.log(`Found ${subjects.length} subjects`);

    res.json({ 
      success: true,
      subjects: subjects,
      count: subjects.length
    });

  } catch (error) {
    console.error('Get student subjects error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/analytics/student-stats/:studentId - Individual student stats
router.get('/student-stats/:studentId', authenticateToken, async (req, res) => {
  try {
    const { studentId } = req.params;

    // Verify student access (students can only see their own data)
    if (req.user.role === 'student') {
      const student = await getRow('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!student || student.id != studentId) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Get student's attendance records
    const attendanceData = await getAllRows(`
      SELECT ar.status, ar.marked_at, ats.session_date, subj.subject_code
      FROM attendance_records ar
      JOIN attendance_sessions ats ON ar.session_id = ats.id
      LEFT JOIN subjects subj ON ats.subject = subj.id
      WHERE ar.student_id = ?
      ORDER BY ats.session_date DESC
    `, [studentId]);

    const total = attendanceData.length;
    const present = attendanceData.filter(a => a.status === 'present' || a.status === 'excused').length;
    const absent = attendanceData.filter(a => a.status === 'absent').length;
    const percentage = total > 0 ? (present / total) * 100 : 0;

    // Get ML predictions from student_enrollments table (average across all subjects)
    // Note: Values are now stored as strings directly, so we just pick the most common value
    const mlData = await getRow(`
      SELECT trend, consistent, risk, attentiveness
      FROM student_enrollments
      WHERE student_id = ?
      ORDER BY enrollment_date DESC
      LIMIT 1
    `, [studentId]);

    // Use string values directly from database (no conversion needed)
    const trend = mlData?.trend || 'stable';
    const consistency = mlData?.consistent || 'regular';
    const risk = mlData?.risk || 'moderate';
    const attentiveness = mlData?.attentiveness || 'moderately_attentive';

    res.json({
      total,
      present,
      absent,
      percentage: Math.round(percentage * 100) / 100,
      trend: trend,
      risk: risk,
      consistency: consistency,
      attentiveness: attentiveness
    });

  } catch (error) {
    console.error('Get student stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/analytics/check-teacher-authorization - Check if teacher is authorized for specific filters
router.get('/check-teacher-authorization', authenticateToken, requireRole(['teacher']), async (req, res) => {
  try {
    const { semester, department, section, subject } = req.query;

    if (!semester || !department || !section || !subject) {
      return res.status(400).json({ message: 'All filters (semester, department, section, subject) are required' });
    }

    // Get teacher's registered teaching assignments from database
    const teacher = await getRow('SELECT semesters, departments, sections, subjects FROM teachers WHERE user_id = ?', [req.user.id]);
    
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher record not found' });
    }

    // Parse JSON arrays from database
    const teacherSemesters = JSON.parse(teacher.semesters || '[]');
    const teacherDepartments = JSON.parse(teacher.departments || '[]');
    const teacherSections = JSON.parse(teacher.sections || '[]');
    const teacherSubjects = JSON.parse(teacher.subjects || '[]');

    // Check each filter against teacher's registered assignments
    if (!teacherSemesters.includes(semester)) {
      return res.status(403).json({ 
        authorized: false, 
        message: `You are not registered to teach Semester ${semester}` 
      });
    }

    if (!teacherDepartments.includes(department)) {
      return res.status(403).json({ 
        authorized: false, 
        message: `You are not registered to teach in ${department} department` 
      });
    }

    if (!teacherSections.includes(section)) {
      return res.status(403).json({ 
        authorized: false, 
        message: `You are not registered to teach Section ${section}` 
      });
    }

    if (!teacherSubjects.includes(subject)) {
      return res.status(403).json({ 
        authorized: false, 
        message: `You are not registered to teach ${subject}` 
      });
    }

    // If all checks pass, teacher is authorized
    res.json({ 
      authorized: true, 
      message: 'Teacher is authorized for the selected filters' 
    });

  } catch (error) {
    console.error('Check teacher authorization error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/analytics/class-stats - Class-wide analytics
router.get('/class-stats', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { classId, sectionId, semester, subject } = req.query;

    if (!classId || !sectionId) {
      return res.status(400).json({ message: 'Class ID and Section ID are required' });
    }

    if (!subject) {
      return res.status(400).json({ message: 'Subject is required' });
    }

    // For teachers, verify they are assigned to teach this subject (NEW SCHEMA)
    if (req.user.role === 'teacher') {
      const teacher = await getRow('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
      if (!teacher) {
        return res.status(403).json({ message: 'Teacher record not found' });
      }

      // Check if teacher is assigned to this course (NEW SCHEMA)
      const enrollment = await getRow(`
        SELECT te.*, c.course_name, c.semester, c.department, c.section
        FROM teacher_enrollments te
        JOIN courses c ON te.course_id = c.id
        WHERE te.teacher_id = ? 
          AND c.semester = ? 
          AND c.department = ? 
          AND c.section = ? 
          AND c.course_name = ?
          AND te.enrollment_date <= date('now')
          AND te.completion_date >= date('now')
      `, [teacher.id, semester, classId, sectionId, subject]);

      if (!enrollment) {
        return res.status(403).json({ 
          message: `You are not assigned to teach ${subject} for ${classId}-${sectionId}, Semester ${semester}` 
        });
      }
    }

    // Get students who are enrolled in the specific course (NEW SCHEMA)
    const students = await getAllRows(`
      SELECT DISTINCT s.id, s.usn, u.name, se.trend, se.consistent, se.risk, se.attentiveness
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN student_enrollments se ON s.id = se.student_id
      JOIN courses c ON se.course_id = c.id
      WHERE c.department = ? 
        AND c.section = ? 
        AND c.course_name = ?
        AND c.semester = ?
        AND se.enrollment_date <= date('now')
        AND se.completion_date >= date('now')
      ORDER BY s.usn
    `, [classId, sectionId, subject, semester]);

    // If no students found for this subject, return appropriate message
    if (students.length === 0) {
      return res.status(404).json({ message: 'No students available for the selected filters' });
    }

    const studentStats = [];
    let totalClasses = 0;
    let totalAttendance = 0;

    // Calculate stats for each student
    for (const student of students) {
      // Get attendance records for this student in this course (NEW SCHEMA)
      const attendanceData = await getAllRows(`
        SELECT ar.status, ar.marked_at, ats.session_date
        FROM attendance_records ar
        JOIN attendance_sessions ats ON ar.session_id = ats.id
        JOIN courses c ON ats.course_id = c.id
        WHERE ar.student_id = ? 
          AND c.course_name = ?
          AND c.semester = ?
          AND c.department = ?
          AND c.section = ?
      `, [student.id, subject, semester, classId, sectionId]);
      
      const total = attendanceData.length;
      const present = attendanceData.filter(a => a.status === 'present' || a.status === 'excused').length;
      const percentage = total > 0 ? (present / total) * 100 : 0;

      // Use ML predictions from student_enrollments table (pre-calculated)
      const trend = student.trend || 'no_data';
      const consistency = student.consistent || 'no_data';
      const risk = student.risk || 'no_data';
      const attentiveness = student.attentiveness || 'no_data';

      studentStats.push({
        id: student.id,
        usn: student.usn,
        name: student.name,
        total,
        present,
        absent: total - present,
        percentage: Math.round(percentage * 100) / 100,
        risk: risk,
        trend: trend,
        consistency: consistency,
        attentiveness: attentiveness
      });

      totalClasses = Math.max(totalClasses, total);
      totalAttendance += percentage;
    }

    const averageAttendance = students.length > 0 ? totalAttendance / students.length : 0;

    // Generate trend data from actual attendance sessions (last 5 sessions) (NEW SCHEMA)
    const trendData = await getAllRows(`
      SELECT 
        ats.session_date,
        AVG(CASE WHEN ar.status IN ('present', 'excused') THEN 100.0 ELSE 0.0 END) as avg_percentage
      FROM attendance_sessions ats
      JOIN attendance_records ar ON ats.id = ar.session_id
      JOIN courses c ON ats.course_id = c.id
      WHERE c.department = ? 
        AND c.section = ? 
        AND c.course_name = ?
        AND c.semester = ?
        AND ats.session_date >= DATE('now', '-35 days')
      GROUP BY ats.session_date
      ORDER BY ats.session_date ASC
      LIMIT 5
    `, [classId, sectionId, subject, semester]);

    // Format trend data for chart
    const formattedTrendData = trendData.length > 0 
      ? trendData.map((data, index) => ({
          name: `Week ${index + 1}`,
          avg: Math.round(data.avg_percentage * 100) / 100
        }))
      : [
          { name: 'Week 1', avg: averageAttendance },
          { name: 'Week 2', avg: averageAttendance },
          { name: 'Week 3', avg: averageAttendance },
          { name: 'Week 4', avg: averageAttendance },
          { name: 'Week 5', avg: averageAttendance }
        ];

    // Generate risk distribution
    const riskCounts = {
      low: studentStats.filter(s => s.risk === 'low').length,
      moderate: studentStats.filter(s => s.risk === 'moderate').length,
      high: studentStats.filter(s => s.risk === 'high').length,
      no_data: studentStats.filter(s => s.risk === 'no_data').length
    };

    const riskDistribution = [
      { name: 'Above 75%', count: riskCounts.low },
      { name: 'Around Threshold', count: riskCounts.moderate },
      { name: 'Below 75%', count: riskCounts.high }
    ];

    // Generate consistency data
    const consistencyCounts = {
      high: studentStats.filter(s => s.consistency === 'high').length,
      medium: studentStats.filter(s => s.consistency === 'medium').length,
      low: studentStats.filter(s => s.consistency === 'low').length,
      no_data: studentStats.filter(s => s.consistency === 'no_data').length
    };

    const consistencyData = [
      { name: 'High', value: consistencyCounts.high },
      { name: 'Medium', value: consistencyCounts.medium },
      { name: 'Low', value: consistencyCounts.low }
    ];

    // Generate attentiveness data
    const attentivenessCounts = {
      High: studentStats.filter(s => s.attentiveness === 'High').length,
      Medium: studentStats.filter(s => s.attentiveness === 'Medium').length,
      Low: studentStats.filter(s => s.attentiveness === 'Low').length,
      no_data: studentStats.filter(s => s.attentiveness === 'no_data').length
    };

    const attentivenessData = [
      { name: 'High Attentiveness', score: attentivenessCounts.High },
      { name: 'Medium Attentiveness', score: attentivenessCounts.Medium },
      { name: 'Low Attentiveness', score: attentivenessCounts.Low }
    ];

    res.json({
      students: studentStats,
      overallStats: {
        totalClasses,
        averageAttendance: Math.round(averageAttendance * 100) / 100
      },
      trendData: formattedTrendData,
      riskDistribution,
      consistencyData,
      attentivenessData
    });

  } catch (error) {
    console.error('Get class stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/analytics/trends - Attendance trends over time
router.get('/trends', authenticateToken, async (req, res) => {
  try {
    const { classId, sectionId, timeframe = 'weekly' } = req.query;

    if (!classId || !sectionId) {
      return res.status(400).json({ message: 'Class ID and Section ID are required' });
    }

    // Get attendance data for trend analysis
    const attendanceData = await getAllRows(`
      SELECT 
        ats.session_date,
        COUNT(*) as total_students,
        SUM(CASE WHEN ar.status IN ('present', 'excused') THEN 1 ELSE 0 END) as present_students
      FROM attendance_sessions ats
      JOIN attendance_records ar ON ats.id = ar.session_id
      WHERE ats.department = ? AND ats.section = ?
      GROUP BY ats.session_date
      ORDER BY ats.session_date DESC
      LIMIT 20
    `, [classId, sectionId]);

    const trendData = attendanceData.map((data, index) => {
      const percentage = data.total_students > 0 ? (data.present_students / data.total_students) * 100 : 0;
      return {
        name: timeframe === 'weekly' ? `Week ${index + 1}` : data.session_date,
        avg: Math.round(percentage * 100) / 100
      };
    }).reverse();

    res.json({ trendData });

  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/analytics/ml-predictions - ML-based predictions
router.get('/ml-predictions', authenticateToken, async (req, res) => {
  try {
    const { studentId, classId, sectionId } = req.query;

    if (studentId) {
      // Individual student predictions - read from student_enrollments
      const mlData = await getRow(`
        SELECT trend, consistent, risk, attentiveness
        FROM student_enrollments
        WHERE student_id = ?
        ORDER BY enrollment_date DESC
        LIMIT 1
      `, [studentId]);

      // Use string values directly from database (no conversion needed)
      const trend = mlData?.trend || 'stable';
      const consistency = mlData?.consistent || 'regular';
      const risk = mlData?.risk || 'moderate';
      const attentiveness = mlData?.attentiveness || 'moderately_attentive';

      res.json({
        trendAnalysis: trend,
        riskPrediction: risk,
        consistencyScore: consistency,
        attentivenessLevel: attentiveness
      });

    } else if (classId && sectionId) {
      // Class-wide predictions
      const classData = await getAllRows(`
        SELECT 
          AVG(CASE WHEN ar.status IN ('present', 'excused') THEN 100.0 ELSE 0.0 END) as avg_percentage
        FROM attendance_sessions ats
        JOIN attendance_records ar ON ats.id = ar.session_id
        WHERE ats.department = ? AND ats.section = ?
      `, [classId, sectionId]);

      const avgPercentage = classData[0]?.avg_percentage || 0;

      res.json({
        trendAnalysis: avgPercentage > 80 ? 'improving' : avgPercentage > 70 ? 'stable' : 'declining',
        riskPrediction: avgPercentage > 85 ? 'low' : avgPercentage > 75 ? 'moderate' : 'high',
        consistencyScore: 'regular', // Mock value
        attentivenessLevel: avgPercentage > 85 ? 'actively_attentive' : avgPercentage > 70 ? 'moderately_attentive' : 'passively_attentive'
      });

    } else {
      return res.status(400).json({ message: 'Either studentId or both classId and sectionId are required' });
    }

  } catch (error) {
    console.error('Get ML predictions error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/analytics/student-enrollments - Get all enrollments for a student
router.get('/student-enrollments', authenticateToken, async (req, res) => {
  try {
    // Only students can access this endpoint
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get student record
    const student = await getRow('SELECT * FROM students WHERE user_id = ?', [req.user.id]);
    if (!student) {
      return res.status(404).json({ message: 'Student record not found' });
    }

    // Get all enrollments for this student (NEW SCHEMA)
    const enrollments = await getAllRows(`
      SELECT DISTINCT 
        c.semester,
        c.department, 
        c.section,
        c.course_name,
        c.course_code,
        c.id as course_id,
        se.enrollment_date,
        se.completion_date
      FROM student_enrollments se
      JOIN courses c ON se.course_id = c.id
      WHERE se.student_id = ?
      ORDER BY c.semester, c.department, c.section, c.course_name
    `, [student.id]);

    console.log(`Student ${student.id} (${student.usn}) enrollments:`, enrollments);

    res.json({ 
      success: true,
      enrollments: enrollments,
      count: enrollments.length
    });

  } catch (error) {
    console.error('Get student enrollments error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/analytics/student-analysis - Student-specific analysis with filters (NEW SCHEMA)
router.get('/student-analysis', authenticateToken, async (req, res) => {
  try {
    const { semester, department, section, subject } = req.query;

    // For students, get their own data
    if (req.user.role === 'student') {
      const student = await getRow('SELECT * FROM students WHERE user_id = ?', [req.user.id]);
      if (!student) {
        return res.status(404).json({ message: 'Student record not found' });
      }

      // Validate required filters
      if (!semester || !department || !section) {
        return res.status(400).json({ message: 'Please select Semester, Department, and Section' });
      }

      if (!subject) {
        return res.status(400).json({ message: 'Please select a subject' });
      }

      // Get student's attendance data for the specific subject (NEW SCHEMA)
      const attendanceData = await getAllRows(`
        SELECT ar.status, ar.marked_at, ats.session_date
        FROM attendance_records ar
        JOIN attendance_sessions ats ON ar.session_id = ats.id
        JOIN courses c ON ats.course_id = c.id
        WHERE ar.student_id = ? 
          AND c.semester = ? 
          AND c.department = ?
          AND c.section = ?
          AND c.course_name = ?
        ORDER BY ats.session_date DESC
      `, [student.id, semester, department, section, subject]);

      if (attendanceData.length === 0) {
        return res.status(404).json({ message: 'No attendance data found for this subject. Attendance may not have been taken yet.' });
      }

      const total = attendanceData.length;
      const present = attendanceData.filter(a => a.status === 'present' || a.status === 'excused').length;
      const percentage = total > 0 ? (present / total) * 100 : 0;

      // Get ML predictions from student_enrollments table (NEW SCHEMA)
      const enrollment = await getRow(`
        SELECT se.trend, se.consistent, se.risk, se.attentiveness
        FROM student_enrollments se
        JOIN courses c ON se.course_id = c.id
        WHERE se.student_id = ? 
          AND c.course_name = ? 
          AND c.semester = ?
          AND c.department = ?
          AND c.section = ?
      `, [student.id, subject, semester, department, section]);

      // Use string values directly from database (handle no_data case)
      const trend = enrollment?.trend || 'no_data';
      const consistency = enrollment?.consistent || 'no_data';
      const risk = enrollment?.risk || 'no_data';
      const attentiveness = enrollment?.attentiveness || 'no_data';

      // Generate trend data for charts (last 10 classes)
      const trendData = attendanceData.slice(0, 10).reverse().map((data, index) => ({
        name: `Class ${index + 1}`,
        attendance: data.status === 'present' || data.status === 'excused' ? 100 : 0
      }));

      res.json({
        studentInfo: {
          name: req.user.name,
          usn: student.usn,
          semester: semester,
          department: department,
          section: section,
          subject: subject
        },
        attendanceStats: {
          total,
          present,
          absent: total - present,
          percentage: Math.round(percentage * 100) / 100
        },
        mlAnalysis: {
          trend: trend,
          risk: risk,
          consistency: consistency,
          attentiveness: attentiveness
        },
        chartData: {
          trendData,
          riskLevel: risk,
          consistencyScore: consistency
        }
      });

    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

  } catch (error) {
    console.error('Get student analysis error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;