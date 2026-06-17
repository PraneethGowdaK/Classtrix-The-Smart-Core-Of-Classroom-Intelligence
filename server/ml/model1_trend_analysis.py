"""
ML Model 1: Trend Analysis
Analyzes student attendance patterns to predict trends (improving/stable/declining)

NEW SCHEMA IMPLEMENTATION:
- Input: student_id, course_id, enrollment_date, completion_date, db_path
- Queries database itself (attendance_records + attendance_sessions)
- Uses LAST 20 sessions (sliding window)
- Treats 'excused' as 'present' for trend calculation
- Confidence ALWAYS "high" (regardless of session count)
- Uses Option 2 decision logic with dynamic absence threshold

Input Format:
{
  "student_id": 5,
  "course_id": 6,
  "enrollment_date": "2024-01-15",
  "completion_date": "2024-05-30",
  "db_path": "server/database/attendance.db"
}

Output Format:
{
  "trend": "improving" | "stable" | "declining" | "no_data",
  "confidence": "high",
  "metrics": {...},
  "message": "...",
  "notes": [...],
  "warnings": []
}
"""

import json
import sys
import sqlite3
from typing import List, Dict, Any


def fetch_attendance_records(student_id: int, course_id: int, enrollment_date: str, completion_date: str, db_path: str) -> List[Dict[str, Any]]:
    """
    Fetch attendance records from database for the given student and course.
    
    Args:
        student_id: Student ID
        course_id: Course ID
        enrollment_date: Start date of enrollment
        completion_date: End date of enrollment
        db_path: Path to SQLite database
        
    Returns:
        List of attendance records with status and session_date
    """
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Query to get last 20 attendance records
        query = """
        SELECT 
          ar.status,
          asess.session_date
        FROM attendance_records ar
        JOIN attendance_sessions asess ON ar.session_id = asess.id
        WHERE ar.student_id = ?
          AND asess.course_id = ?
          AND asess.session_date >= ?
          AND asess.session_date <= ?
        ORDER BY asess.session_date DESC
        LIMIT 20
        """
        
        cursor.execute(query, [student_id, course_id, enrollment_date, completion_date])
        rows = cursor.fetchall()
        
        # Convert to list of dictionaries
        attendance_records = [
            {'status': row[0], 'session_date': row[1]}
            for row in rows
        ]
        
        conn.close()
        
        return attendance_records
        
    except Exception as e:
        print(f"Database error: {str(e)}", file=sys.stderr)
        return []


def calculate_trend_analysis(attendance_records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate trend analysis using Option 2 decision logic.
    
    Args:
        attendance_records: List of attendance records (newest first)
        
    Returns:
        Dictionary containing trend, confidence, metrics, and messages
    """
    
    total_sessions = len(attendance_records)
    
    # Initialize result
    result = {
        'trend': 'stable',
        'confidence': 'high',  # Always high
        'metrics': {},
        'message': '',
        'notes': [],
        'warnings': []
    }
    
    # CASE 1: No sessions
    if total_sessions == 0:
        result['trend'] = 'no_data'
        result['metrics'] = {'total_sessions': 0}
        result['message'] = 'No attendance records yet'
        result['notes'].append('⚠️ No attendance data available')
        return result
    
    # CASE 2: One session
    if total_sessions == 1:
        status = attendance_records[0]['status']
        result['metrics']['total_sessions'] = 1
        
        if status in ['present', 'excused']:
            result['trend'] = 'improving'
            result['message'] = 'First session recorded: Student attended'
        else:  # absent
            result['trend'] = 'declining'
            result['message'] = 'First session recorded: Student was absent'
        
        return result
    
    # CASE 3: Two or more sessions - Full analysis
    
    # Feature 1: Total sessions
    result['metrics']['total_sessions'] = total_sessions
    
    # Feature 2: Overall attendance percentage
    present_count = sum(1 for r in attendance_records if r['status'] in ['present', 'excused'])
    overall_percentage = (present_count / total_sessions * 100)
    result['metrics']['overall_percentage'] = round(overall_percentage, 2)
    
    # Feature 3 & 4: First half and second half percentages
    # Reverse to chronological order (oldest first)
    chronological_records = list(reversed(attendance_records))
    mid_point = total_sessions // 2
    
    first_half = chronological_records[:mid_point]
    second_half = chronological_records[mid_point:]
    
    first_half_present = sum(1 for r in first_half if r['status'] in ['present', 'excused'])
    first_half_percentage = (first_half_present / len(first_half) * 100) if len(first_half) > 0 else 0
    result['metrics']['first_half_percentage'] = round(first_half_percentage, 2)
    result['metrics']['first_half_sessions'] = len(first_half)
    
    second_half_present = sum(1 for r in second_half if r['status'] in ['present', 'excused'])
    second_half_percentage = (second_half_present / len(second_half) * 100) if len(second_half) > 0 else 0
    result['metrics']['second_half_percentage'] = round(second_half_percentage, 2)
    result['metrics']['second_half_sessions'] = len(second_half)
    
    # Feature 5: Percentage change
    percentage_change = second_half_percentage - first_half_percentage
    result['metrics']['percentage_change'] = round(percentage_change, 2)
    
    # Feature 6: Recent momentum (last 3 sessions)
    recent_sessions = attendance_records[:min(3, total_sessions)]
    recent_present = sum(1 for r in recent_sessions if r['status'] in ['present', 'excused'])
    recent_momentum = (recent_present / len(recent_sessions) * 100)
    result['metrics']['recent_momentum'] = round(recent_momentum, 2)
    result['metrics']['recent_sessions_count'] = len(recent_sessions)
    
    # Feature 7: Consecutive absence streak
    consecutive_absences = 0
    for record in attendance_records:
        if record['status'] == 'absent':
            consecutive_absences += 1
        else:
            break
    result['metrics']['consecutive_absence_streak'] = consecutive_absences
    
    # Feature 8: Volatility score
    attendance_binary = [1 if r['status'] in ['present', 'excused'] else 0 for r in attendance_records]
    if len(attendance_binary) > 1:
        mean = sum(attendance_binary) / len(attendance_binary)
        variance = sum((x - mean) ** 2 for x in attendance_binary) / len(attendance_binary)
        volatility = variance ** 0.5
    else:
        volatility = 0
    result['metrics']['volatility_score'] = round(volatility, 4)
    
    # Feature 9: Confidence (always high)
    result['metrics']['confidence_level'] = 'high'
    
    # OPTION 2 DECISION LOGIC
    
    # Dynamic absence threshold
    absence_threshold = 2 if total_sessions <= 5 else 3
    
    # PRIORITY 1: Check for critical absence streak
    if consecutive_absences >= absence_threshold:
        result['trend'] = 'declining'
        result['message'] = f'Attendance is declining. Currently on a {consecutive_absences}-session absence streak.'
        result['notes'].append(f'⚠️ Currently on a {consecutive_absences}-session absence streak')
    
    # PRIORITY 2: Check percentage_change with recent_momentum adjustment
    elif percentage_change > 10:
        result['trend'] = 'improving'
        result['message'] = f'Attendance is improving! Second half ({second_half_percentage:.1f}%) is {percentage_change:.1f}% higher than first half ({first_half_percentage:.1f}%).'
    
    elif percentage_change < -10:
        # Check if recent momentum is strong (student recovering)
        if recent_momentum >= 80:
            result['trend'] = 'stable'
            result['message'] = f'Attendance is stabilizing. Despite earlier decline, recent momentum is strong ({recent_momentum:.0f}% in last 3 sessions).'
        else:
            result['trend'] = 'declining'
            result['message'] = f'Attendance is declining. Second half ({second_half_percentage:.1f}%) is {abs(percentage_change):.1f}% lower than first half ({first_half_percentage:.1f}%).'
    
    # PRIORITY 3: Small percentage change (-10% to +10%)
    else:
        if recent_momentum >= 80:
            result['trend'] = 'improving'
            result['message'] = f'Attendance is improving. Strong recent momentum ({recent_momentum:.0f}% in last 3 sessions).'
        elif recent_momentum <= 33:
            result['trend'] = 'declining'
            result['message'] = f'Attendance is declining. Weak recent momentum ({recent_momentum:.0f}% in last 3 sessions).'
        else:
            result['trend'] = 'stable'
            result['message'] = f'Attendance is stable. Change between halves is {percentage_change:.1f}%, within ±10% threshold.'
    
    # Add contextual notes
    if overall_percentage < 75:
        result['notes'].append(f'⚠️ Overall attendance ({overall_percentage:.1f}%) is below 75% threshold')
    
    if volatility > 0.4:
        result['notes'].append('⚠️ High volatility detected: Attendance pattern is irregular')
    elif volatility < 0.2:
        result['notes'].append('✓ Low volatility: Attendance pattern is consistent')
    
    return result


def main():
    """
    Main function to read input from stdin and output trend analysis.
    """
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        
        # Extract parameters
        student_id = data['student_id']
        course_id = data['course_id']
        enrollment_date = data['enrollment_date']
        completion_date = data['completion_date']
        db_path = data['db_path']
        
        print(f"Model 1: Analyzing student {student_id}, course {course_id}", file=sys.stderr)
        
        # Fetch attendance records from database
        attendance_records = fetch_attendance_records(
            student_id, course_id, enrollment_date, completion_date, db_path
        )
        
        print(f"Model 1: Found {len(attendance_records)} attendance records", file=sys.stderr)
        
        # Calculate trend analysis
        result = calculate_trend_analysis(attendance_records)
        
        # Output result as JSON
        print(json.dumps(result, indent=2))
        
    except KeyError as e:
        error_result = {
            'error': 'Missing required field',
            'message': f'Missing field: {str(e)}'
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)
    except json.JSONDecodeError as e:
        error_result = {
            'error': 'Invalid JSON input',
            'message': str(e)
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)
    except Exception as e:
        error_result = {
            'error': 'Calculation failed',
            'message': str(e)
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)


if __name__ == '__main__':
    main()
