import express from 'express';
import { getAllRows, getRow, runQuery } from '../database/connection.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/dbms-values - Get all database tables and their values
router.get('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    console.log('Fetching all database values...');
    
    const dbData = {};
    
    // Get all table names
    const tables = await getAllRows(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    
    console.log(`Found ${tables.length} tables:`, tables.map(t => t.name));
    
    // For each table, get its structure and data (OPTIMIZED: limit to 100 rows for preview)
    for (const table of tables) {
      const tableName = table.name;
      
      try {
        // Get table structure
        const structure = await getAllRows(`PRAGMA table_info(${tableName})`);
        
        // Get table data - Fetch all rows (no limit for debugging purposes)
        let data;
        try {
          // Try to order by id first, then by first column if id doesn't exist
          data = await getAllRows(`SELECT * FROM ${tableName} ORDER BY id DESC`);
        } catch (orderError) {
          // If ordering by id fails, try without ordering or by first column
          try {
            const firstCol = structure[0]?.name;
            if (firstCol) {
              data = await getAllRows(`SELECT * FROM ${tableName} ORDER BY ${firstCol} DESC`);
            } else {
              data = await getAllRows(`SELECT * FROM ${tableName}`);
            }
          } catch (fallbackError) {
            data = await getAllRows(`SELECT * FROM ${tableName}`);
          }
        }
        
        // Get row count (OPTIMIZED: Use COUNT which is fast with indexes)
        const countResult = await getRow(`SELECT COUNT(*) as count FROM ${tableName}`);
        
        dbData[tableName] = {
          structure: structure.map(col => ({
            name: col.name,
            type: col.type,
            notNull: col.notnull === 1,
            defaultValue: col.dflt_value,
            primaryKey: col.pk === 1
          })),
          data: data,
          rowCount: countResult.count
        };
        
        console.log(`✅ ${tableName}: ${countResult.count} total rows (showing ${data.length}), ${structure.length} columns`);
        console.log(`   Columns: ${structure.map(col => col.name).join(', ')}`);
        
      } catch (error) {
        console.error(`❌ Error fetching ${tableName}:`, error.message);
        dbData[tableName] = {
          error: error.message,
          structure: [],
          data: [],
          rowCount: 0
        };
      }
    }
    
    // Add database summary
    const summary = {
      totalTables: tables.length,
      totalRows: Object.values(dbData).reduce((sum, table) => sum + (table.rowCount || 0), 0),
      timestamp: new Date().toISOString(),
      user: req.user.name
    };
    
    res.json({
      success: true,
      summary,
      tables: dbData
    });
    
  } catch (error) {
    console.error('DBMS Values API error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch database values',
      error: error.message
    });
  }
});

// GET /api/dbms-values/table/:tableName - Get specific table data
router.get('/table/:tableName', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { tableName } = req.params;
    const { limit = 1000, offset = 0 } = req.query; // Add pagination support
    
    // Validate table name to prevent SQL injection
    const validTables = await getAllRows(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    
    const tableExists = validTables.some(t => t.name === tableName);
    if (!tableExists) {
      return res.status(404).json({
        success: false,
        message: `Table '${tableName}' not found`
      });
    }
    
    // Get table structure
    const structure = await getAllRows(`PRAGMA table_info(${tableName})`);
    
    // Filter out created_at column from teachers table structure
    const filteredStructure = tableName === 'teachers' 
      ? structure.filter(col => col.name !== 'created_at')
      : structure;
    
    // Get table data with pagination (OPTIMIZED)
    const limitNum = Math.min(parseInt(limit), 1000); // Max 1000 rows per request
    const offsetNum = parseInt(offset);
    
    // Build SELECT query - exclude created_at for teachers table
    let selectColumns = '*';
    if (tableName === 'teachers') {
      const columns = structure.filter(col => col.name !== 'created_at').map(col => col.name);
      selectColumns = columns.join(', ');
    }
    
    let data;
    try {
      // Try to order by id for consistent pagination
      data = await getAllRows(`SELECT ${selectColumns} FROM ${tableName} ORDER BY id DESC LIMIT ? OFFSET ?`, [limitNum, offsetNum]);
    } catch (orderError) {
      // Fallback if no id column
      data = await getAllRows(`SELECT ${selectColumns} FROM ${tableName} LIMIT ? OFFSET ?`, [limitNum, offsetNum]);
    }
    
    // Get row count
    const countResult = await getRow(`SELECT COUNT(*) as count FROM ${tableName}`);
    
    res.json({
      success: true,
      tableName,
      structure: filteredStructure.map(col => ({
        name: col.name,
        type: col.type,
        notNull: col.notnull === 1,
        defaultValue: col.dflt_value,
        primaryKey: col.pk === 1
      })),
      data,
      rowCount: countResult.count,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        hasMore: (offsetNum + limitNum) < countResult.count
      }
    });
    
  } catch (error) {
    console.error(`Table ${req.params.tableName} fetch error:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch table data',
      error: error.message
    });
  }
});

// GET /api/dbms-values/export-attendance-csv - Export attendance data as CSV
router.get('/export-attendance-csv', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    console.log('Exporting attendance data to CSV...');
    
    // Query to join all required tables and get the data in the requested format
    const attendanceData = await getAllRows(`
      SELECT 
        ROW_NUMBER() OVER (ORDER BY ats.session_date, ats.session_time, s.usn) as idx,
        c.course_code as course_code,
        c.course_name as course_name, 
        ats.session_date as session_date,
        ats.session_time as session_time,
        s.usn as usn,
        s.name as name,
        COALESCE(ar.status, 'absent') as status,
        COALESCE(ar.reason_type, '') as reason_type,
        COALESCE(ar.marked_by, 'system') as marked_by,
        COALESCE(se.trend, '') as trend,
        COALESCE(se.consistent, '') as consistent, 
        COALESCE(se.risk, '') as risk,
        COALESCE(se.attentiveness, '') as attentiveness
      FROM attendance_sessions ats
      JOIN courses c ON ats.course_id = c.id
      LEFT JOIN attendance_records ar ON ats.id = ar.session_id
      LEFT JOIN students s ON ar.student_id = s.id
      LEFT JOIN student_enrollments se ON s.id = se.student_id AND c.id = se.course_id
      ORDER BY ats.session_date, ats.session_time, s.usn
    `);
    
    console.log(`Found ${attendanceData.length} attendance records`);
    
    // Debug: Log first few records to see the actual data
    if (attendanceData.length > 0) {
      console.log('Sample attendance data:', JSON.stringify(attendanceData[0], null, 2));
    }
    
    if (attendanceData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No attendance data found to export'
      });
    }
    
    // Convert to CSV format with simple column names (no spaces)
    const headers = [
      'Index', 'Course_Code', 'Course_Name', 'Session_Date', 'Session_Time',
      'USN', 'Name', 'Status', 'Reason_Type', 'Marked_By', 'Trend', 'Consistent', 'Risk', 'Attentiveness'
    ];
    
    // Simple CSV with comma separator and proper quoting
    let csvContent = headers.join(',') + '\n';
    
    attendanceData.forEach(row => {
      // Map database columns to CSV columns with text-formatted date
      let sessionDate = '';
      if (row.session_date) {
        // Add a space or apostrophe prefix to force Excel to treat as text
        sessionDate = `'${row.session_date.toString().trim()}`;
      }
      
      // Handle null strings in ML data
      const cleanMLData = (value) => {
        if (!value || value === 'null' || value === 'NULL') {
          return '';
        }
        return value;
      };
      
      const csvRow = [
        row.idx || '',
        `"${row.course_code || ''}"`,  // Quote course code
        `"${row.course_name || ''}"`,  // Quote course name (may contain spaces)
        sessionDate,  // Date with text prefix
        row.session_time || '',
        `"${row.usn || ''}"`,  // Quote USN
        `"${row.name || ''}"`,  // Quote name (may contain spaces)
        row.status || '',
        row.reason_type || '',
        row.marked_by || 'system',  // Add marked_by column
        cleanMLData(row.trend),
        cleanMLData(row.consistent),
        cleanMLData(row.risk),
        cleanMLData(row.attentiveness)
      ];
      
      // Join with comma and proper structure
      csvContent += csvRow.join(',') + '\n';
    });
    
    // Set headers for file download - simple text/plain to avoid encoding issues
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `attendance-export-${timestamp}.csv`;
    
    res.setHeader('Content-Type', 'text/plain; charset=ascii');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    console.log(`✅ Exporting ${attendanceData.length} records to ${filename}`);
    
    res.send(csvContent);
    
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export attendance data',
      error: error.message
    });
  }
});

// DELETE /api/dbms-values/delete - Delete a row from a table
router.delete('/delete', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { tableName, primaryKeyColumn, primaryKeyValue } = req.body;

    if (!tableName || !primaryKeyColumn || primaryKeyValue === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: tableName, primaryKeyColumn, primaryKeyValue'
      });
    }

    // Validate table name to prevent SQL injection
    const validTables = await getAllRows(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    
    const tableExists = validTables.some(t => t.name === tableName);
    if (!tableExists) {
      return res.status(404).json({
        success: false,
        message: `Table '${tableName}' not found`
      });
    }

    // Delete the row using runQuery
    const query = `DELETE FROM ${tableName} WHERE ${primaryKeyColumn} = ?`;
    const result = await runQuery(query, [primaryKeyValue]);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Row not found or already deleted'
      });
    }

    console.log(`✅ Deleted row from ${tableName} where ${primaryKeyColumn} = ${primaryKeyValue}`);

    res.json({
      success: true,
      message: `Row deleted successfully from ${tableName}`,
      changes: result.changes
    });

  } catch (error) {
    console.error('Delete row error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete row',
      error: error.message
    });
  }
});

export default router;