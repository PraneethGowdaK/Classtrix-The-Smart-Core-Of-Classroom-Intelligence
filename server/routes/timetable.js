import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { runQuery, getRow, getAllRows } from '../database/connection.js';

const router = express.Router();

// GET /api/timetable - Get all timetable entries with filters
router.get('/', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { semester, department, section, dayOfWeek } = req.query;

    let query = `
      SELECT 
        t.id,
        t.course_id,
        t.day_of_week,
        t.start_time,
        t.end_time,
        t.date,
        c.course_code,
        c.course_name,
        c.semester,
        c.department,
        c.section,
        c.credits
      FROM timetable t
      JOIN courses c ON t.course_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (semester) {
      query += ' AND c.semester = ?';
      params.push(parseInt(semester));
    }

    if (department) {
      query += ' AND c.department = ?';
      params.push(department);
    }

    if (section) {
      query += ' AND c.section = ?';
      params.push(section);
    }

    if (dayOfWeek) {
      query += ' AND t.day_of_week = ?';
      params.push(dayOfWeek);
    }

    // Only get default timetable (date IS NULL)
    query += ' AND t.date IS NULL';
    query += ' ORDER BY t.day_of_week, t.start_time';

    const timetable = await getAllRows(query, params);

    res.json({
      success: true,
      timetable
    });

  } catch (error) {
    console.error('Get timetable error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// POST /api/timetable - Create new timetable entry
router.post('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { courseId, dayOfWeek, startTime, endTime, date } = req.body;

    if (!courseId || !dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({ message: 'Course ID, day of week, start time, and end time are required' });
    }

    // Verify course exists
    const course = await getRow('SELECT id FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(400).json({ message: 'Invalid course ID' });
    }

    // Check for duplicate entry
    const existing = await getRow(
      'SELECT id FROM timetable WHERE course_id = ? AND day_of_week = ? AND start_time = ? AND date IS ?',
      [courseId, dayOfWeek, startTime, date || null]
    );

    if (existing) {
      return res.status(409).json({ message: 'This timetable entry already exists' });
    }

    const result = await runQuery(`
      INSERT INTO timetable (course_id, day_of_week, start_time, end_time, date)
      VALUES (?, ?, ?, ?, ?)
    `, [courseId, dayOfWeek, startTime, endTime, date || null]);

    res.status(201).json({
      success: true,
      message: 'Timetable entry created',
      id: result.id
    });

  } catch (error) {
    console.error('Create timetable error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// DELETE /api/timetable/:id - Delete timetable entry
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    await runQuery('DELETE FROM timetable WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Timetable entry deleted'
    });

  } catch (error) {
    console.error('Delete timetable error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// GET /api/timetable/by-day - Get timetable by day for students
router.get('/by-day', authenticateToken, async (req, res) => {
  try {
    const { semester, department, section, day, date } = req.query;
    
    if (!semester || !department || !section || !day) {
      return res.status(400).json({ message: 'Semester, department, section, and day are required' });
    }

    // First, try to get date-specific timetable if date is provided
    let timetable = [];
    if (date) {
      timetable = await getAllRows(`
        SELECT 
          t.id,
          t.course_id,
          t.day_of_week,
          t.start_time,
          t.end_time,
          t.date,
          c.course_code,
          c.course_name as subject,
          c.semester,
          c.department,
          c.section
        FROM timetable t
        JOIN courses c ON t.course_id = c.id
        WHERE t.date = ?
          AND c.semester = ?
          AND c.department = ?
          AND c.section = ?
        ORDER BY t.start_time
      `, [date, parseInt(semester), department, section]);
    }

    // If no date-specific timetable, get default timetable for this day
    if (timetable.length === 0) {
      timetable = await getAllRows(`
        SELECT 
          t.id,
          t.course_id,
          t.day_of_week,
          t.start_time,
          t.end_time,
          t.date,
          c.course_code,
          c.course_name as subject,
          c.semester,
          c.department,
          c.section
        FROM timetable t
        JOIN courses c ON t.course_id = c.id
        WHERE t.day_of_week = ?
          AND c.semester = ?
          AND c.department = ?
          AND c.section = ?
          AND t.date IS NULL
        ORDER BY t.start_time
      `, [day, parseInt(semester), department, section]);
    }

    res.json({
      success: true,
      timetable: timetable
    });

  } catch (error) {
    console.error('Get timetable by day error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// GET /api/timetable/for-date - Get timetable for specific date
router.get('/for-date', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { date, semester, department, section } = req.query;
    
    if (!date || !semester || !department || !section) {
      return res.status(400).json({ message: 'All parameters are required' });
    }

    // Get day of week from date
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    
    // First, try to get date-specific timetable
    let timetable = await getAllRows(`
      SELECT 
        t.id,
        t.course_id,
        t.day_of_week,
        t.start_time,
        t.end_time,
        t.date,
        c.course_code,
        c.course_name,
        c.semester,
        c.department,
        c.section
      FROM timetable t
      JOIN courses c ON t.course_id = c.id
      WHERE t.date = ?
        AND c.semester = ?
        AND c.department = ?
        AND c.section = ?
      ORDER BY t.start_time
    `, [date, parseInt(semester), department, section]);

    let isLocked = false;
    let source = 'default';

    // If date-specific timetable exists, it's locked
    if (timetable.length > 0) {
      isLocked = true;
      source = 'date-specific';
    } else {
      // Get default timetable for this day of week
      timetable = await getAllRows(`
        SELECT 
          t.id,
          t.course_id,
          t.day_of_week,
          t.start_time,
          t.end_time,
          t.date,
          c.course_code,
          c.course_name,
          c.semester,
          c.department,
          c.section
        FROM timetable t
        JOIN courses c ON t.course_id = c.id
        WHERE t.day_of_week = ?
          AND c.semester = ?
          AND c.department = ?
          AND c.section = ?
          AND t.date IS NULL
        ORDER BY t.start_time
      `, [dayOfWeek, parseInt(semester), department, section]);
    }

    res.json({
      success: true,
      is_locked: isLocked,
      source: source,
      timetable: timetable,
      day_of_week: dayOfWeek
    });

  } catch (error) {
    console.error('Get timetable for date error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// POST /api/timetable/update-for-date - Create date-specific timetable
router.post('/update-for-date', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { date, semester, department, section, timetable } = req.body;
    
    if (!date || !semester || !department || !section || !timetable || !Array.isArray(timetable)) {
      return res.status(400).json({ 
        success: false,
        message: 'All fields are required and timetable must be an array' 
      });
    }

    // Check if date-specific timetable already exists (locked)
    const existing = await getRow(`
      SELECT COUNT(*) as count 
      FROM timetable t
      JOIN courses c ON t.course_id = c.id
      WHERE t.date = ? AND c.semester = ? AND c.department = ? AND c.section = ?
    `, [date, parseInt(semester), department, section]);

    if (existing.count > 0) {
      return res.status(400).json({
        success: false,
        message: 'This date is already locked. Cannot edit existing date-specific timetable.'
      });
    }

    // Get day of week for this date
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

    // Insert new rows with specific date
    let rowsInserted = 0;
    for (const entry of timetable) {
      // Get course_id from course_code or use courseId directly
      let courseId = entry.courseId || entry.course_id;
      
      if (!courseId && entry.course_code) {
        const course = await getRow(
          'SELECT id FROM courses WHERE course_code = ? AND semester = ? AND department = ? AND section = ?',
          [entry.course_code, parseInt(semester), department, section]
        );
        if (course) {
          courseId = course.id;
        }
      }

      if (!courseId) {
        console.error('No course ID found for entry:', entry);
        continue;
      }

      await runQuery(`
        INSERT INTO timetable (
          date, day_of_week, course_id, start_time, end_time
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        date,
        dayOfWeek,
        courseId,
        entry.start_time,
        entry.end_time
      ]);
      rowsInserted++;
    }

    res.json({
      success: true,
      message: `Timetable updated for ${date}`,
      rows_inserted: rowsInserted
    });

  } catch (error) {
    console.error('Update timetable for date error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error', 
      error: error.message 
    });
  }
});

// GET /api/timetable/class/schedule - Get timetable for a specific class on a date
router.get('/class/schedule', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { date, semester, department, section } = req.query;
    
    if (!date || !semester || !department || !section) {
      return res.status(400).json({ message: 'Date, semester, department, and section are required' });
    }

    // Get day of week from date
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    
    // First, try to get date-specific timetable
    let timetable = await getAllRows(`
      SELECT 
        t.id,
        t.course_id,
        t.start_time,
        t.end_time,
        c.course_code,
        c.course_name,
        c.semester,
        c.department,
        c.section
      FROM timetable t
      JOIN courses c ON t.course_id = c.id
      WHERE t.date = ?
        AND c.semester = ?
        AND c.department = ?
        AND c.section = ?
      ORDER BY t.start_time
    `, [date, parseInt(semester), department, section]);

    // If no date-specific timetable, get default timetable
    if (timetable.length === 0) {
      timetable = await getAllRows(`
        SELECT 
          t.id,
          t.course_id,
          t.start_time,
          t.end_time,
          c.course_code,
          c.course_name,
          c.semester,
          c.department,
          c.section
        FROM timetable t
        JOIN courses c ON t.course_id = c.id
        WHERE t.day_of_week = ?
          AND c.semester = ?
          AND c.department = ?
          AND c.section = ?
          AND t.date IS NULL
        ORDER BY t.start_time
      `, [dayOfWeek, parseInt(semester), department, section]);
    }

    // Calculate period numbers and current status
    const currentTime = new Date();
    const schedule = timetable.map((entry, index) => {
      const periodNumber = index + 1;
      
      const [startHour, startMin] = entry.start_time.split(':').map(Number);
      const [endHour, endMin] = entry.end_time.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
      
      const isCurrent = currentMinutes >= (startMinutes - 15) && currentMinutes <= (endMinutes + 15);
      const isPast = currentMinutes > (endMinutes + 15);
      const isUpcoming = currentMinutes < (startMinutes - 15);
      
      return {
        id: entry.id,
        course_id: entry.course_id,
        period_number: periodNumber,
        start_time: entry.start_time,
        end_time: entry.end_time,
        semester: entry.semester,
        department: entry.department,
        section: entry.section,
        course_code: entry.course_code,
        course_name: entry.course_name,
        is_current: isCurrent,
        is_past: isPast,
        is_upcoming: isUpcoming
      };
    });

    const currentPeriod = schedule.find(s => s.is_current) || null;

    res.json({
      success: true,
      schedule,
      current_period: currentPeriod
    });

  } catch (error) {
    console.error('Get class schedule error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

export default router;
