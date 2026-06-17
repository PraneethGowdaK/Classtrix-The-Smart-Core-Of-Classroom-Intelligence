import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { runQuery, getRow, getAllRows } from '../database/connection.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// GET /api/attendance/teacher/courses - Get courses assigned to the logged-in teacher
router.get('/teacher/courses', authenticateToken, requireRole(['teacher']), async (req, res) => {
  try {
    // Get teacher ID
    const teacher = await getRow('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher record not found' });
    }

    // Get all courses assigned to this teacher (only active enrollments)
    const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
    const courses = await getAllRows(`
      SELECT DISTINCT c.id, c.course_code, c.course_name, c.department, c.semester, c.section, c.credits
      FROM courses c
      JOIN teacher_enrollments te ON c.id = te.course_id
      WHERE te.teacher_id = ?
        AND DATE(te.enrollment_date) <= DATE(?)
        AND (te.completion_date IS NULL OR DATE(te.completion_date) >= DATE(?))
      ORDER BY c.semester, c.department, c.section, c.course_code
    `, [teacher.id, today, today]);

    res.json({
      success: true,
      courses: courses
    });

  } catch (error) {
    console.error('Get teacher courses error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Python executable path (use virtual environment on Windows)
const PYTHON_PATH = process.platform === 'win32'
  ? path.join(path.dirname(__dirname), '..', 'myenv', 'Scripts', 'python.exe')
  : 'python';

/**
 * Call Python ML models to calculate predictions
 */
const callMLModels = (attendanceData) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Call all 4 models
      const model1Script = path.join(__dirname, '../ml/model1_trend_analysis.py');
      const model3Script = path.join(__dirname, '../ml/model3_consistency_analysis.py');
      const model4Script = path.join(__dirname, '../ml/model4_attentiveness_analysis.py');
      const model2Script = path.join(__dirname, '../ml/model2_risk_prediction.py');

      // Model 1: Trend Analysis
      const model1Result = await new Promise((res, rej) => {
        const python = spawn(PYTHON_PATH, [model1Script]);
        let output = '';
        let error = '';
        
        python.stdin.write(JSON.stringify(attendanceData));
        python.stdin.end();
        
        python.stdout.on('data', (data) => { output += data.toString(); });
        python.stderr.on('data', (data) => { error += data.toString(); });
        python.on('close', (code) => {
          if (code !== 0) rej(new Error(`Model 1 failed: ${error}`));
          else {
            try { res(JSON.parse(output)); }
            catch (e) { rej(new Error('Failed to parse Model 1 output')); }
          }
        });
      });

      // Model 3: Consistency Analysis
      const model3Result = await new Promise((res, rej) => {
        const python = spawn(PYTHON_PATH, [model3Script]);
        let output = '';
        let error = '';
        
        python.stdin.write(JSON.stringify(attendanceData));
        python.stdin.end();
        
        python.stdout.on('data', (data) => { output += data.toString(); });
        python.stderr.on('data', (data) => { error += data.toString(); });
        python.on('close', (code) => {
          if (code !== 0) rej(new Error(`Model 3 failed: ${error}`));
          else {
            try { res(JSON.parse(output)); }
            catch (e) { rej(new Error('Failed to parse Model 3 output')); }
          }
        });
      });

      // Model 4: Attentiveness Analysis
      const model4Result = await new Promise((res, rej) => {
        const python = spawn(PYTHON_PATH, [model4Script]);
        let output = '';
        let error = '';
        
        const input = {
          attendance_data: attendanceData,
          consistency_from_model3: model3Result.consistency
        };
        
        python.stdin.write(JSON.stringify(input));
        python.stdin.end();
        
        python.stdout.on('data', (data) => { output += data.toString(); });
        python.stderr.on('data', (data) => { error += data.toString(); });
        python.on('close', (code) => {
          if (code !== 0) rej(new Error(`Model 4 failed: ${error}`));
          else {
            try { res(JSON.parse(output)); }
            catch (e) { rej(new Error('Failed to parse Model 4 output')); }
          }
        });
      });

      // Model 2: Risk Prediction
      const model2Result = await new Promise((res, rej) => {
        const python = spawn(PYTHON_PATH, [model2Script]);
        let output = '';
        let error = '';
        
        const input = {
          student_data: attendanceData,
          model1_result: model1Result,
          model3_result: model3Result,
          model4_result: model4Result,
          class_data: null,
          total_sessions_planned: 50
        };
        
        python.stdin.write(JSON.stringify(input));
        python.stdin.end();
        
        python.stdout.on('data', (data) => { output += data.toString(); });
        python.stderr.on('data', (data) => { error += data.toString(); });
        python.on('close', (code) => {
          if (code !== 0) rej(new Error(`Model 2 failed: ${error}`));
          else {
            try { res(JSON.parse(output)); }
            catch (e) { rej(new Error('Failed to parse Model 2 output')); }
          }
        });
      });

      resolve({
        trend: model1Result.trend,
        consistency: model3Result.consistency,
        attentiveness: model4Result.attentiveness,
        risk: model2Result.risk
      });

    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Calculate and store ML predictions for all students in a course
 * According to ml.txt specification:
 * 1. Get all current enrollments for the course
 * 2. For each student, call Models 1, 3, 4, 2 in sequence
 * 3. Store all 4 results in ONE database update per student
 */
const calculateAndStoreMLPredictions = async (courseId) => {
  console.log(`🤖 STEP 1: Starting ML predictions calculation for course ${courseId}`);
  
  // STEP 1: Get all current enrollments for this course (with dates)
  const enrollments = await getAllRows(`
    SELECT 
      student_id,
      enrollment_date,
      completion_date
    FROM student_enrollments
    WHERE course_id = ?
      AND enrollment_date <= date('now')
      AND completion_date >= date('now')
  `, [courseId]);

  console.log(`📊 STEP 2: Found ${enrollments.length} currently enrolled students for course ${courseId}`);

  if (enrollments.length === 0) {
    console.log(`⚠️ No enrolled students found for course ${courseId}`);
    return { successCount: 0, failureCount: 0 };
  }

  let successCount = 0;
  let failureCount = 0;

  // STEP 3: Loop through each enrollment and run all 4 models
  for (const enrollment of enrollments) {
    try {
      const studentId = enrollment.student_id;
      const enrollmentDate = enrollment.enrollment_date;
      const completionDate = enrollment.completion_date;
      
      console.log(`\n🔍 Processing student ${studentId}...`);
      console.log(`   Enrollment: ${enrollmentDate} to ${completionDate}`);

      // Prepare input for all models
      const modelInput = {
        student_id: studentId,
        course_id: courseId,
        enrollment_date: enrollmentDate,
        completion_date: completionDate,
        db_path: 'server/database/attendance.db'
      };

      // MODEL 1: Trend Analysis
      console.log(`   📊 Calling Model 1 (Trend Analysis)...`);
      const model1Result = await new Promise((resolve, reject) => {
        const python = spawn(PYTHON_PATH, [path.join(__dirname, '../ml/model1_trend_analysis.py')]);
        let output = '';
        let error = '';
        
        python.stdin.write(JSON.stringify(modelInput));
        python.stdin.end();
        
        python.stdout.on('data', (data) => { output += data.toString(); });
        python.stderr.on('data', (data) => { error += data.toString(); });
        python.on('close', (code) => {
          if (code !== 0) {
            console.error(`   ❌ Model 1 error: ${error}`);
            reject(new Error(`Model 1 failed: ${error}`));
          } else {
            try {
              const result = JSON.parse(output);
              console.log(`   ✅ Model 1 result: trend = ${result.trend}`);
              resolve(result);
            } catch (e) {
              reject(new Error('Failed to parse Model 1 output'));
            }
          }
        });
      });

      // MODEL 3: Consistency Analysis
      console.log(`   📊 Calling Model 3 (Consistency Analysis)...`);
      const model3Result = await new Promise((resolve, reject) => {
        const python = spawn(PYTHON_PATH, [path.join(__dirname, '../ml/model3_consistency_analysis.py')]);
        let output = '';
        let error = '';
        
        python.stdin.write(JSON.stringify(modelInput));
        python.stdin.end();
        
        python.stdout.on('data', (data) => { output += data.toString(); });
        python.stderr.on('data', (data) => { error += data.toString(); });
        python.on('close', (code) => {
          if (code !== 0) {
            console.error(`   ❌ Model 3 error: ${error}`);
            reject(new Error(`Model 3 failed: ${error}`));
          } else {
            try {
              const result = JSON.parse(output);
              console.log(`   ✅ Model 3 result: consistency = ${result.consistency_level}`);
              resolve(result);
            } catch (e) {
              reject(new Error('Failed to parse Model 3 output'));
            }
          }
        });
      });

      // MODEL 4: Attentiveness Analysis
      console.log(`   📊 Calling Model 4 (Attentiveness Analysis)...`);
      const model4Result = await new Promise((resolve, reject) => {
        const python = spawn(PYTHON_PATH, [path.join(__dirname, '../ml/model4_attentiveness_analysis.py')]);
        let output = '';
        let error = '';
        
        python.stdin.write(JSON.stringify(modelInput));
        python.stdin.end();
        
        python.stdout.on('data', (data) => { output += data.toString(); });
        python.stderr.on('data', (data) => { error += data.toString(); });
        python.on('close', (code) => {
          if (code !== 0) {
            console.error(`   ❌ Model 4 error: ${error}`);
            reject(new Error(`Model 4 failed: ${error}`));
          } else {
            try {
              const result = JSON.parse(output);
              console.log(`   ✅ Model 4 result: attentiveness = ${result.attentiveness_level}`);
              resolve(result);
            } catch (e) {
              reject(new Error('Failed to parse Model 4 output'));
            }
          }
        });
      });

      // MODEL 2: Risk Prediction (receives 12 features from Models 1, 3, 4)
      console.log(`   📊 Calling Model 2 (Risk Prediction)...`);
      
      // Prepare 12 features for Model 2
      const model2Input = {
        ...modelInput,
        // Features from Models 1, 3, 4
        trend: model1Result.trend,
        consistency: model3Result.consistency_level,
        attentiveness: model4Result.attentiveness_level,
        // Additional features from database
        attendance_pct: model1Result.metrics?.overall_percentage || 0,
        total_present: 0,  // Will be calculated by Model 2 if needed
        total_sessions: 0,
        total_absent: 0,
        reason_medical: 0,
        reason_family: 0,
        reason_academic: 0,
        reason_sports: 0,
        reason_internship: 0
      };

      const model2Result = await new Promise((resolve, reject) => {
        const python = spawn(PYTHON_PATH, [path.join(__dirname, '../ml/model2_risk_prediction.py')]);
        let output = '';
        let error = '';
        
        python.stdin.write(JSON.stringify(model2Input));
        python.stdin.end();
        
        python.stdout.on('data', (data) => { output += data.toString(); });
        python.stderr.on('data', (data) => { error += data.toString(); });
        python.on('close', (code) => {
          if (code !== 0) {
            console.error(`   ❌ Model 2 error: ${error}`);
            reject(new Error(`Model 2 failed: ${error}`));
          } else {
            try {
              const result = JSON.parse(output);
              console.log(`   ✅ Model 2 result: risk = ${result.risk_level}`);
              resolve(result);
            } catch (e) {
              reject(new Error('Failed to parse Model 2 output'));
            }
          }
        });
      });

      // STEP 4: Store ALL 4 results in ONE database update per student
      console.log(`   💾 Storing all 4 ML results in database...`);
      await runQuery(`
        UPDATE student_enrollments
        SET trend = ?, consistent = ?, risk = ?, attentiveness = ?
        WHERE student_id = ? AND course_id = ?
      `, [
        model1Result.trend,
        model3Result.consistency_level,
        model2Result.risk_level,
        model4Result.attentiveness_level,
        studentId,
        courseId
      ]);

      console.log(`   ✅ Successfully updated ML predictions for student ${studentId}`);
      console.log(`      • Trend: ${model1Result.trend}`);
      console.log(`      • Consistency: ${model3Result.consistency_level}`);
      console.log(`      • Risk: ${model2Result.risk_level}`);
      console.log(`      • Attentiveness: ${model4Result.attentiveness_level}`);
      
      successCount++;

    } catch (error) {
      console.error(`❌ Failed to calculate ML for student ${enrollment.student_id}:`, error.message);
      failureCount++;
    }
  }

  console.log(`\n🎯 ML Calculation Complete`);
  console.log(`   ✅ Success: ${successCount}/${enrollments.length}`);
  console.log(`   ❌ Failed: ${failureCount}/${enrollments.length}`);
  
  return { successCount, failureCount };
};

// Configure multer for attendance image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/attendance');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `attendance-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

// Mock face recognition function (ML removed)
const recognizeFacesInImage = async (imagePath, classStudents) => {
  try {
    // Mock recognition - randomly recognize 70-90% of students
    const recognizedStudents = classStudents
      .filter(() => Math.random() > 0.15)
      .map(student => ({
        studentId: student.id,
        confidence: 0.7 + Math.random() * 0.3
      }));

    // Create mock bounding boxes
    const mockBoundingBoxes = recognizedStudents.map((student, index) => ({
      x: (index % 3) * 0.3 + Math.random() * 0.1,
      y: Math.floor(index / 3) * 0.25 + Math.random() * 0.1,
      width: 0.15,
      height: 0.2,
      recognized: true,
      studentName: classStudents.find(s => s.id === student.studentId)?.name || 'Unknown',
      confidence: student.confidence
    }));

    return {
      recognizedStudents,
      accuracy: recognizedStudents.length / classStudents.length,
      boundingBoxes: mockBoundingBoxes
    };
  } catch (error) {
    console.error('Face recognition error:', error);
    return {
      recognizedStudents: [],
      accuracy: 0,
      boundingBoxes: []
    };
  }
};

// POST /api/attendance/session/create - Create attendance session
router.post('/session/create', authenticateToken, requireRole(['teacher']), async (req, res) => {
  try {
    const { courseId, sessionDate, sessionTime } = req.body;

    console.log('📝 Session create request:', { courseId, sessionDate, sessionTime, userId: req.user.id });

    if (!courseId || !sessionDate || !sessionTime) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ message: 'Course, date, and time are required' });
    }

    // Get teacher ID
    const teacher = await getRow('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
    if (!teacher) {
      console.log('❌ Teacher record not found for user:', req.user.id);
      return res.status(404).json({ message: 'Teacher record not found' });
    }

    console.log('✅ Found teacher:', teacher.id);

    // Verify course exists and get course details
    const course = await getRow('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      console.log('❌ Course not found:', courseId);
      return res.status(404).json({ message: 'Course not found' });
    }

    console.log('✅ Found course:', course.course_code, course.course_name);

    // Verify teacher is assigned to this course
    const teacherCourse = await getRow(
      'SELECT * FROM teacher_enrollments WHERE teacher_id = ? AND course_id = ?',
      [teacher.id, courseId]
    );
    if (!teacherCourse) {
      console.log('❌ Teacher not assigned to course:', teacher.id, courseId);
      return res.status(403).json({ message: 'You are not assigned to teach this course' });
    }

    console.log('✅ Teacher is assigned to course');

    // Check for existing COMPLETED attendance (with records) on the same date
    const existingSession = await getRow(`
      SELECT ats.id, COUNT(ar.id) as record_count
      FROM attendance_sessions ats
      LEFT JOIN attendance_records ar ON ats.id = ar.session_id
      WHERE ats.teacher_id = ? AND ats.course_id = ? AND ats.session_date = ?
      GROUP BY ats.id
    `, [teacher.id, courseId, sessionDate]);

    if (existingSession && existingSession.record_count > 0) {
      console.log('⚠️ Completed session found with', existingSession.record_count, 'records');
      return res.status(409).json({ 
        message: 'Attendance has already been taken for this course and date. You have ' + existingSession.record_count + ' attendance records.',
        existingSessionId: existingSession.id
      });
    }

    // If there's an incomplete session (no records), delete it and create new one
    if (existingSession && existingSession.record_count === 0) {
      console.log('🗑️ Deleting incomplete session:', existingSession.id);
      await runQuery('DELETE FROM attendance_sessions WHERE id = ?', [existingSession.id]);
    }

    // Get total students enrolled in this course
    const studentCount = await getRow(`
      SELECT COUNT(DISTINCT se.student_id) as count 
      FROM student_enrollments se
      WHERE se.course_id = ?
    `, [courseId]);

    console.log('✅ Found', studentCount.count, 'enrolled students');

    // Get local timestamp in YYYY-MM-DD HH:MM:SS format
    const now = new Date();
    const localTimestamp = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0');

    console.log('📅 Creating session with timestamp:', localTimestamp);

    // Create attendance session
    const sessionResult = await runQuery(`
      INSERT INTO attendance_sessions 
      (teacher_id, course_id, session_date, session_time, total_students, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [teacher.id, courseId, sessionDate, sessionTime, studentCount.count, localTimestamp]);

    console.log('✅ Session created successfully:', sessionResult.id);

    res.status(201).json({
      sessionId: sessionResult.id,
      message: 'Attendance session created successfully',
      totalStudents: studentCount.count,
      course: {
        id: course.id,
        code: course.course_code,
        name: course.course_name,
        department: course.department,
        semester: course.semester,
        section: course.section
      }
    });

  } catch (error) {
    console.error('❌ Create session error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// POST /api/attendance/capture - Process attendance with ML face recognition
router.post('/capture', authenticateToken, requireRole(['teacher']), async (req, res) => {
  try {
    const { courseId, images } = req.body;

    console.log('📸 Processing attendance capture...');
    console.log(`Course ID: ${courseId}`);
    console.log(`Images received: ${images?.length || 0}`);

    if (!courseId) {
      return res.status(400).json({ message: 'Course ID is required' });
    }

    if (!images || images.length === 0) {
      return res.status(400).json({ message: 'At least one image is required' });
    }

    // Get course details
    const course = await getRow('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Get enrolled students with embeddings for this course
    const enrolledStudents = await getAllRows(`
      SELECT 
        s.id, 
        s.usn, 
        s.name,
        s.face_embeddings
      FROM students s
      JOIN student_enrollments se ON s.id = se.student_id
      WHERE se.course_id = ?
        AND se.enrollment_date <= date('now')
        AND se.completion_date >= date('now')
      ORDER BY s.name
    `, [courseId]);

    console.log(`📚 Found ${enrolledStudents.length} enrolled students`);

    if (enrolledStudents.length === 0) {
      return res.status(404).json({ 
        message: 'No students enrolled for this course',
        recognizedStudents: [],
        total_faces_detected: 0,
        total_students_recognized: 0
      });
    }

    // Parse embeddings and prepare for ML service
    const studentsWithEmbeddings = enrolledStudents.map(student => {
      let embedding = null;
      if (student.face_embeddings) {
        try {
          const embeddings = JSON.parse(student.face_embeddings);
          embedding = Array.isArray(embeddings) && embeddings.length > 0 ? embeddings[0] : null;
        } catch (e) {
          console.error(`Failed to parse embeddings for ${student.usn}`);
        }
      }
      return {
        id: student.id,
        usn: student.usn,
        name: student.name,
        embedding: embedding
      };
    }).filter(s => s.embedding !== null); // Only students with embeddings

    console.log(`🧠 ${studentsWithEmbeddings.length} students have face embeddings`);

    // Validate that ALL enrolled students have embeddings
    if (studentsWithEmbeddings.length !== enrolledStudents.length) {
      const missingCount = enrolledStudents.length - studentsWithEmbeddings.length;
      const studentsWithoutEmbeddings = enrolledStudents
        .filter(s => !studentsWithEmbeddings.find(sw => sw.id === s.id))
        .map(s => `${s.usn} (${s.name})`);
      
      return res.status(400).json({ 
        message: `Cannot process attendance. ${missingCount} out of ${enrolledStudents.length} enrolled students do not have face embeddings registered. All students must be registered with face photos before taking attendance.`,
        studentsWithoutEmbeddings: studentsWithoutEmbeddings,
        recognizedStudents: [],
        total_faces_detected: 0,
        total_students_recognized: 0
      });
    }

    if (studentsWithEmbeddings.length === 0) {
      return res.status(400).json({ 
        message: 'No students have registered face embeddings. Please register students with face images first.',
        recognizedStudents: [],
        total_faces_detected: 0,
        total_students_recognized: 0
      });
    }

    // Call Python ML service for recognition
    console.log('📤 Sending to Python ML service...');
    
    let recognitionResult = null;
    let mlError = null;

    try {
      const mlResponse = await fetch('http://localhost:8000/recognize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          images: images, // Array of base64 images
          enrolled_students: studentsWithEmbeddings
        })
      });

      if (mlResponse.ok) {
        recognitionResult = await mlResponse.json();
        console.log(`✅ ML Recognition complete: ${recognitionResult.total_students_recognized} students recognized`);
      } else {
        const errorData = await mlResponse.json();
        mlError = errorData.detail || 'ML service error';
        console.error('❌ ML service error:', mlError);
      }
    } catch (error) {
      mlError = error.message;
      console.error('❌ Failed to connect to ML service:', error.message);
    }

    // If ML service failed, return error
    if (!recognitionResult) {
      return res.status(503).json({
        message: 'Face recognition service is unavailable. Please ensure the Python server is running.',
        mlError: mlError,
        recognizedStudents: [],
        total_faces_detected: 0,
        total_students_recognized: 0,
        fallbackMode: true
      });
    }

    // Save annotated images to disk
    let savedImagePaths = [];
    if (recognitionResult.processed_images && recognitionResult.processed_images.length > 0) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        
        // Create uploads/attendance directory if it doesn't exist
        const uploadDir = path.join(process.cwd(), 'server', 'uploads', 'attendance');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const timestamp = Date.now();
        
        // Save ALL annotated images
        for (let i = 0; i < recognitionResult.processed_images.length; i++) {
          const filename = `attendance-${course.semester}-${course.department}-${course.section}-${timestamp}-${i + 1}.jpg`;
          const filepath = path.join(uploadDir, filename);
          
          // Convert base64 to buffer and save
          const base64Data = recognitionResult.processed_images[i].replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          fs.writeFileSync(filepath, buffer);
          
          // Store relative path
          savedImagePaths.push(`/uploads/attendance/${filename}`);
        }
        
        console.log(`💾 Saved ${savedImagePaths.length} annotated images`);
      } catch (saveError) {
        console.error('❌ Failed to save annotated images:', saveError);
        // Continue without images - not critical
      }
    }

    // Return recognition results with saved image paths (as JSON string for database)
    res.json({
      success: true,
      recognizedStudents: recognitionResult.recognized_students || [],
      total_faces_detected: recognitionResult.total_faces_detected || 0,
      total_students_recognized: recognitionResult.total_students_recognized || 0,
      processedImages: recognitionResult.processed_images || [],
      savedImagePath: savedImagePaths.length > 0 ? JSON.stringify(savedImagePaths) : null, // Store as JSON array
      thresholdUsed: recognitionResult.threshold_used || 0.6,
      message: recognitionResult.message || 'Recognition complete'
    });

  } catch (error) {
    console.error('Capture attendance error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// POST /api/attendance/submit - Submit attendance with all records
router.post('/submit', authenticateToken, requireRole(['teacher']), async (req, res) => {
  try {
    console.log('📨 Received attendance submission request');
    const { courseId, sessionDate, sessionTime, capturedImagePath, totalStudents, presentCount, absentCount, recognitionAccuracy, attendanceRecords } = req.body;
    
    console.log('📋 Request data:', {
      courseId, sessionDate, sessionTime,
      totalStudents, presentCount, absentCount, recognitionAccuracy,
      recordsCount: attendanceRecords?.length
    });

    if (!courseId || !sessionDate || !sessionTime || !attendanceRecords) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ message: 'Course, date, time, and attendance records are required' });
    }

    if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
      console.log('❌ Invalid attendance records');
      return res.status(400).json({ message: 'Attendance records are required' });
    }

    // Get teacher ID
    const teacher = await getRow('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
    if (!teacher) {
      console.log('❌ Teacher record not found for user:', req.user.id);
      return res.status(404).json({ message: 'Teacher record not found' });
    }
    
    console.log('✅ Found teacher:', teacher.id);

    // Verify course exists
    const course = await getRow('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Get local timestamp in YYYY-MM-DD HH:MM:SS format
    const now = new Date();
    const localTimestamp = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0');

    // Create attendance session
    const sessionResult = await runQuery(`
      INSERT INTO attendance_sessions 
      (teacher_id, course_id, session_date, session_time, captured_image_path, total_students, present_count, absent_count, recognition_accuracy, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [teacher.id, courseId, sessionDate, sessionTime, capturedImagePath || null, totalStudents, presentCount, absentCount, recognitionAccuracy, localTimestamp]);

    const sessionId = sessionResult.id;
    console.log('✅ Created attendance session:', sessionId);

    // Insert attendance records for each student
    console.log('📝 Inserting attendance records for session:', sessionId);
    console.log('📊 Total records to insert:', attendanceRecords.length);
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const record of attendanceRecords) {
      try {
        const { studentId, status, confidence, reasonType, markedBy } = record;
        console.log(`🔍 Processing student: ${studentId}, status: ${status}, confidence: ${confidence}, markedBy: ${markedBy || 'system'}`);

        // Get student ID from USN
        const student = await getRow('SELECT id FROM students WHERE usn = ?', [studentId]);
        if (!student) {
          console.warn(`❌ Student ${studentId} not found in database, skipping`);
          failureCount++;
          continue;
        }

        console.log(`✅ Found student ID: ${student.id} for USN: ${studentId}`);

        // Get local timestamp for marked_at in YYYY-MM-DD HH:MM:SS format
        const now = new Date();
        const markedTimestamp = now.getFullYear() + '-' +
          String(now.getMonth() + 1).padStart(2, '0') + '-' +
          String(now.getDate()).padStart(2, '0') + ' ' +
          String(now.getHours()).padStart(2, '0') + ':' +
          String(now.getMinutes()).padStart(2, '0') + ':' +
          String(now.getSeconds()).padStart(2, '0');

        const insertResult = await runQuery(`
          INSERT INTO attendance_records 
          (session_id, student_id, status, confidence, reason_type, attentiveness, emotion, marked_by, marked_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [sessionId, student.id, status, confidence || null, reasonType || null, record.attentiveness || null, record.emotion || null, markedBy || 'system', markedTimestamp]);
        
        console.log(`✅ Inserted attendance record for student ${studentId}, record ID: ${insertResult.id}, markedBy: ${markedBy || 'system'}`);
        successCount++;
      } catch (recordError) {
        console.error(`❌ Error inserting record for student ${record.studentId}:`, recordError);
        failureCount++;
        continue;
      }
    }
    
    console.log(`📊 Attendance records insertion complete - Success: ${successCount}, Failed: ${failureCount}`);

    // Send response immediately to prevent timeout
    res.status(201).json({
      message: 'Attendance submitted successfully',
      sessionId: sessionId,
      recordsCount: attendanceRecords.length,
      successCount: successCount,
      failureCount: failureCount
    });

    // ML Model Calculation - Run in background (non-blocking)
    // This runs AFTER response is sent, so it won't timeout the request
    console.log('🤖 Starting ML predictions calculation in background...');
    setImmediate(async () => {
      try {
        const mlResults = await calculateAndStoreMLPredictions(courseId);
        console.log('✅ ML predictions calculated and stored successfully');
        console.log(`   Success: ${mlResults.successCount}, Failed: ${mlResults.failureCount}`);
      } catch (mlError) {
        console.error('❌ ML predictions calculation failed:', mlError.message);
        console.error(mlError.stack);
      }
    });

  } catch (error) {
    console.error('Submit attendance error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// GET /api/attendance/sessions - Get attendance sessions
router.get('/sessions', authenticateToken, requireRole(['teacher']), async (req, res) => {
  try {
    const { classId, sectionId, date, semester, subject } = req.query;

    // Get teacher ID
    const teacher = await getRow('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher record not found' });
    }

    let query = `
      SELECT id, department, section, subject, semester, 
             session_date, session_time, total_students, present_count, absent_count,
             recognition_accuracy, status, created_at
      FROM attendance_sessions 
      WHERE teacher_id = ?
    `;
    const params = [teacher.id];

    if (classId) {
      query += ' AND department = ?';
      params.push(classId);
    }

    if (sectionId) {
      query += ' AND section = ?';
      params.push(sectionId);
    }

    if (semester) {
      query += ' AND semester = ?';
      params.push(semester);
    }

    if (subject) {
      query += ' AND subject = ?';
      params.push(subject);
    }

    if (date) {
      query += ' AND session_date = ?';
      params.push(date);
    }

    query += ' ORDER BY session_date DESC, session_time DESC LIMIT 100';

    const sessions = await getAllRows(query, params);

    res.json({ sessions });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/attendance/edit - Edit attendance records
router.put('/edit', authenticateToken, requireRole(['teacher']), async (req, res) => {
  try {
    const { sessionId, attendanceRecords, date } = req.body;

    if (!sessionId || !attendanceRecords || !Array.isArray(attendanceRecords)) {
      return res.status(400).json({ message: 'Session ID and attendance records are required' });
    }

    // Verify session exists and belongs to teacher
    const session = await getRow(`
      SELECT ats.*, t.user_id 
      FROM attendance_sessions ats 
      JOIN teachers t ON ats.teacher_id = t.id 
      WHERE ats.id = ?
    `, [sessionId]);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to modify this session' });
    }

    // Check if the selected date matches today's date (only allow editing today's attendance)
    const today = new Date().toISOString().split('T')[0];
    if (date !== today) {
      return res.status(403).json({ message: 'Can only edit attendance for today\'s date' });
    }

    let presentCount = 0;
    let absentCount = 0;

    // Update attendance records
    for (const record of attendanceRecords) {
      const { studentId, status, reasonType } = record;

      // Get student ID from USN
      const student = await getRow('SELECT id FROM students WHERE usn = ?', [studentId]);
      if (!student) {
        console.error(`Student not found for USN: ${studentId}`);
        continue;
      }

      await runQuery(`
        UPDATE attendance_records 
        SET status = ?, reason_type = ?, marked_by = 'manual', updated_at = CURRENT_TIMESTAMP
        WHERE session_id = ? AND student_id = ?
      `, [status, reasonType || null, sessionId, student.id]);

      if (status === 'present' || status === 'excused') {
        presentCount++;
      } else {
        absentCount++;
      }
    }

    // Update session with new counts
    await runQuery(`
      UPDATE attendance_sessions 
      SET present_count = ?, absent_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [presentCount, absentCount, sessionId]);

    res.json({ message: 'Attendance updated successfully' });

  } catch (error) {
    console.error('Edit attendance error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/attendance/session/:sessionId - Get specific session details
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get session details (NEW SCHEMA)
    const session = await getRow(`
      SELECT ats.*, c.course_name as subject_name, c.course_code
      FROM attendance_sessions ats
      JOIN courses c ON ats.course_id = c.id
      WHERE ats.id = ?
    `, [sessionId]);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Get attendance records for this session
    const attendanceRecords = await getAllRows(`
      SELECT ar.*, s.usn, u.name as student_name
      FROM attendance_records ar
      JOIN students s ON ar.student_id = s.usn
      JOIN users u ON s.user_id = u.id
      WHERE ar.session_id = ?
      ORDER BY u.name
    `, [sessionId]);

    res.json({
      session,
      attendanceRecords
    });

  } catch (error) {
    console.error('Get session details error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/attendance/student/:studentId - Get student's attendance by date
router.get('/student/:studentId', authenticateToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { date, semester } = req.query;

    // Verify student access (students can only see their own data)
    if (req.user.role === 'student') {
      const student = await getRow('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!student || student.id != studentId) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    let query = `
      SELECT ar.status, ar.reason, ar.reason_type, ar.marked_at,
             ats.session_date, ats.session_time, c.course_code, c.course_name as subject_name
      FROM attendance_records ar
      JOIN attendance_sessions ats ON ar.session_id = ats.id
      JOIN courses c ON ats.course_id = c.id
      WHERE ar.student_id = ?
    `;
    const params = [studentId];

    if (date) {
      query += ' AND ats.session_date = ?';
      params.push(date);
    }

    if (semester) {
      query += ' AND ats.semester = ?';
      params.push(semester);
    }

    query += ' ORDER BY ats.session_date DESC, ats.session_time DESC';

    const attendance = await getAllRows(query, params);

    res.json({ attendance });

  } catch (error) {
    console.error('Get student attendance error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/attendance/records - Get attendance records by course and date (returns ALL sessions for the date)
router.get('/records', authenticateToken, requireRole(['teacher']), async (req, res) => {
  try {
    const { courseId, date } = req.query;

    console.log('📊 Get attendance records request:', { courseId, date });

    if (!courseId) {
      return res.status(400).json({ message: 'Course ID is required' });
    }

    // Get teacher ID
    const teacher = await getRow('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher record not found' });
    }

    // Find ALL sessions for the given course and date
    let sessionQuery = `
      SELECT id, session_date, session_time, total_students, present_count, absent_count, captured_image_path, course_id
      FROM attendance_sessions 
      WHERE teacher_id = ? AND course_id = ?
    `;
    const sessionParams = [teacher.id, courseId];

    if (date) {
      sessionQuery += ' AND session_date = ?';
      sessionParams.push(date);
    }

    sessionQuery += ' ORDER BY session_date DESC, session_time ASC';

    console.log('🔍 Fetching sessions for teacher:', teacher.id, 'course:', courseId);

    const sessions = await getAllRows(sessionQuery, sessionParams);

    console.log('📊 Found', sessions.length, 'session(s)');

    if (!sessions || sessions.length === 0) {
      return res.status(404).json({ 
        message: 'No attendance sessions found for the selected course and date',
        hasSession: false
      });
    }

    // Get attendance records for ALL sessions
    const sessionsWithRecords = await Promise.all(sessions.map(async (session) => {
      // Get ALL enrolled students for this course
      const enrolledStudents = await getAllRows(`
        SELECT s.id, s.usn, s.name
        FROM students s
        JOIN student_enrollments se ON s.id = se.student_id
        WHERE se.course_id = ?
          AND se.enrollment_date <= date('now')
          AND se.completion_date >= date('now')
        ORDER BY s.name
      `, [session.course_id]);

      // Get attendance records for this session
      const attendanceRecords = await getAllRows(`
        SELECT ar.*, s.usn
        FROM attendance_records ar
        JOIN students s ON ar.student_id = s.id
        WHERE ar.session_id = ?
      `, [session.id]);

      // Create a map of attendance records by student ID
      const recordsMap = new Map();
      attendanceRecords.forEach(record => {
        recordsMap.set(record.student_id, record);
      });

      // Format the records for frontend - include ALL enrolled students
      const formattedRecords = enrolledStudents.map(student => {
        const record = recordsMap.get(student.id);
        
        if (record) {
          // Student has an attendance record
          return {
            id: student.usn,
            name: student.name,
            status: record.status,
            reasonType: record.reason_type || '',
            confidence: record.confidence,
            attentiveness: record.attentiveness || null,
            emotion: record.emotion || null,
            markedBy: record.marked_by || 'system',
            markedAt: record.marked_at
          };
        } else {
          // Student doesn't have a record (shouldn't happen, but handle it)
          return {
            id: student.usn,
            name: student.name,
            status: 'absent',
            reasonType: '',
            confidence: null,
            attentiveness: null,
            emotion: null,
            markedBy: 'system',
            markedAt: null
          };
        }
      });

      return {
        session: {
          id: session.id,
          date: session.session_date,
          time: session.session_time,
          totalStudents: session.total_students,
          presentCount: session.present_count,
          absentCount: session.absent_count,
          capturedImagePath: session.captured_image_path || null,
          capturedImagePaths: session.captured_image_path ? (
            session.captured_image_path.startsWith('[') ? JSON.parse(session.captured_image_path) : [session.captured_image_path]
          ) : []
        },
        attendanceRecords: formattedRecords
      };
    }));

    res.json({
      sessions: sessionsWithRecords,
      hasSession: true,
      totalSessions: sessionsWithRecords.length
    });

  } catch (error) {
    console.error('Get attendance records error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/subjects - Get subjects by class/semester (NEW SCHEMA)
router.get('/subjects', authenticateToken, async (req, res) => {
  try {
    const { classId, semester } = req.query;

    let query = 'SELECT course_code, course_name, department, semester, section FROM courses WHERE 1=1';
    const params = [];

    if (classId) {
      query += ' AND department = ?';
      params.push(classId);
    }

    if (semester) {
      query += ' AND semester = ?';
      params.push(semester);
    }

    query += ' ORDER BY course_name';

    const courses = await getAllRows(query, params);

    // Transform to match old subjects format
    const subjects = courses.map(course => ({
      id: course.course_code,
      name: course.course_name,
      code: course.course_code,
      dept: course.department,
      semester: course.semester,
      section: course.section
    }));

    res.json({ subjects });

  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/attendance/student-daily - Get student's attendance for a specific date
router.get('/student-daily', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }

    // Only students can access this endpoint
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get student record
    const student = await getRow('SELECT * FROM students WHERE user_id = ?', [req.user.id]);
    if (!student) {
      return res.status(404).json({ message: 'Student record not found' });
    }

    // Get attendance records for the student on the specified date (NEW SCHEMA)
    const records = await getAllRows(`
      SELECT 
        ar.id,
        ar.status,
        ar.marked_at,
        ats.id as session_id,
        c.course_name as subject,
        ats.session_date,
        ats.session_time,
        c.semester,
        c.department,
        c.section
      FROM attendance_records ar
      JOIN attendance_sessions ats ON ar.session_id = ats.id
      JOIN courses c ON ats.course_id = c.id
      WHERE ar.student_id = ? AND ats.session_date = ?
      ORDER BY ats.session_time
    `, [student.id, date]);

    res.json({
      success: true,
      records: records
    });

  } catch (error) {
    console.error('Get student daily attendance error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/attendance/update/:sessionId - Update attendance records for a session
router.put('/update/:sessionId', authenticateToken, requireRole(['teacher']), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { attendanceRecords } = req.body;

    console.log('📝 Update attendance request for session:', sessionId);

    if (!attendanceRecords || !Array.isArray(attendanceRecords)) {
      return res.status(400).json({ message: 'Attendance records are required' });
    }

    // Get teacher ID
    const teacher = await getRow('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher record not found' });
    }

    // Verify session belongs to this teacher
    const session = await getRow(
      'SELECT id, session_date FROM attendance_sessions WHERE id = ? AND teacher_id = ?',
      [sessionId, teacher.id]
    );

    if (!session) {
      return res.status(404).json({ message: 'Session not found or access denied' });
    }

    // Check if session is from today (only allow editing today's attendance)
    const sessionDate = new Date(session.session_date);
    const today = new Date();
    const isToday = sessionDate.toDateString() === today.toDateString();

    if (!isToday) {
      return res.status(403).json({ message: 'Can only edit today\'s attendance records' });
    }

    // Update each attendance record
    let successCount = 0;
    let failureCount = 0;

    for (const record of attendanceRecords) {
      try {
        // Get student ID from USN
        const student = await getRow('SELECT id FROM students WHERE usn = ?', [record.studentId]);
        if (!student) {
          console.error('Student not found:', record.studentId);
          failureCount++;
          continue;
        }

        // Update the attendance record
        await runQuery(`
          UPDATE attendance_records 
          SET status = ?, reason_type = ?, marked_by = ?, marked_at = CURRENT_TIMESTAMP
          WHERE session_id = ? AND student_id = ?
        `, [record.status, record.reasonType || null, record.markedBy || 'manual', sessionId, student.id]);

        successCount++;
      } catch (error) {
        console.error('Error updating record for student:', record.studentId, error);
        failureCount++;
      }
    }

    // Update session counts
    const updatedRecords = await getAllRows(
      'SELECT status FROM attendance_records WHERE session_id = ?',
      [sessionId]
    );

    const presentCount = updatedRecords.filter(r => r.status === 'present').length;
    const absentCount = updatedRecords.filter(r => r.status === 'absent').length;

    await runQuery(`
      UPDATE attendance_sessions 
      SET present_count = ?, absent_count = ?
      WHERE id = ?
    `, [presentCount, absentCount, sessionId]);

    console.log('✅ Updated attendance:', { successCount, failureCount });

    res.json({
      success: true,
      message: 'Attendance records updated successfully',
      successCount,
      failureCount
    });

  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;