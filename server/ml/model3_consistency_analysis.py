"""
ML Model 3: Consistency Analysis
NEW SCHEMA - Queries database itself
"""

import json
import sys
import sqlite3
from typing import List, Dict, Any


def fetch_attendance_records(student_id, course_id, enrollment_date, completion_date, db_path):
    """Fetch ALL attendance records from database"""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        query = """
        SELECT ar.status, asess.session_date
        FROM attendance_records ar
        JOIN attendance_sessions asess ON ar.session_id = asess.id
        WHERE ar.student_id = ? AND asess.course_id = ?
          AND asess.session_date >= ? AND asess.session_date <= date('now')
        ORDER BY asess.session_date DESC
        """
        
        cursor.execute(query, [student_id, course_id, enrollment_date])
        rows = cursor.fetchall()
        attendance_records = [{'status': row[0], 'session_date': row[1]} for row in rows]
        conn.close()
        return attendance_records
    except Exception as e:
        print(f"Database error: {str(e)}", file=sys.stderr)
        return []


def calculate_consistency_analysis(attendance_records):
    """Calculate consistency using 5 features"""
    total_sessions = len(attendance_records)
    
    result = {
        'consistency_level': 'medium',
        'confidence': 'high',  # Always high
        'metrics': {},
        'message': '',
        'notes': [],
        'warnings': []
    }
    
    # CASE 1: No sessions
    if total_sessions == 0:
        result['consistency_level'] = 'no_data'
        result['metrics'] = {'total_sessions': 0}
        result['message'] = 'No attendance records yet'
        return result
    
    # CASE 2: One session
    if total_sessions == 1:
        status = attendance_records[0]['status']
        result['metrics']['total_sessions'] = 1
        if status in ['present', 'excused']:
            result['consistency_level'] = 'high'
            result['message'] = 'First session recorded: Student attended'
        else:
            result['consistency_level'] = 'low'
            result['message'] = 'First session recorded: Student was absent'
        return result

    
    # CASE 3: Two sessions
    if total_sessions == 2:
        present_count = sum(1 for r in attendance_records if r['status'] in ['present', 'excused'])
        result['metrics']['total_sessions'] = 2
        if present_count == 2:
            result['consistency_level'] = 'high'
            result['message'] = 'Both sessions attended: Consistent so far'
        elif present_count == 0:
            result['consistency_level'] = 'low'
            result['message'] = 'Both sessions missed: Not consistent'
        else:
            result['consistency_level'] = 'medium'
            result['message'] = 'Mixed attendance: 1 present, 1 absent'
        return result
    
    # CASE 4: 3-4 sessions
    if total_sessions <= 4:
        present_count = sum(1 for r in attendance_records if r['status'] in ['present', 'excused'])
        attendance_percentage = (present_count / total_sessions) * 100
        result['metrics']['total_sessions'] = total_sessions
        result['metrics']['attendance_percentage'] = round(attendance_percentage, 2)
        
        if attendance_percentage >= 75:
            result['consistency_level'] = 'high'
            result['message'] = f'Good start: {attendance_percentage:.0f}% attendance in first {total_sessions} sessions'
        elif attendance_percentage >= 50:
            result['consistency_level'] = 'medium'
            result['message'] = f'Moderate start: {attendance_percentage:.0f}% attendance in first {total_sessions} sessions'
        else:
            result['consistency_level'] = 'low'
            result['message'] = f'Poor start: {attendance_percentage:.0f}% attendance in first {total_sessions} sessions'
        return result

    
    # CASE 5: 5+ sessions - FULL ANALYSIS
    
    # Feature 1: Attendance Percentage
    present_count = sum(1 for r in attendance_records if r['status'] in ['present', 'excused'])
    absent_count = sum(1 for r in attendance_records if r['status'] == 'absent')
    attendance_percentage = (present_count / total_sessions) * 100
    result['metrics']['total_sessions'] = total_sessions
    result['metrics']['attendance_percentage'] = round(attendance_percentage, 2)
    result['metrics']['present_count'] = present_count
    result['metrics']['absent_count'] = absent_count
    
    # Feature 2: Volatility Score
    attendance_binary = [1 if r['status'] in ['present', 'excused'] else 0 for r in attendance_records]
    mean = sum(attendance_binary) / len(attendance_binary)
    variance = sum((x - mean) ** 2 for x in attendance_binary) / len(attendance_binary)
    volatility = variance ** 0.5
    result['metrics']['volatility_score'] = round(volatility, 4)
    
    # Feature 3: Longest Absence Gap
    max_absence_gap = 0
    current_gap = 0
    for record in attendance_records:
        if record['status'] == 'absent':
            current_gap += 1
            max_absence_gap = max(max_absence_gap, current_gap)
        else:
            current_gap = 0
    result['metrics']['longest_absence_gap'] = max_absence_gap

    
    # Feature 4: Attendance Stability (First Half vs Second Half)
    chronological_records = list(reversed(attendance_records))
    mid_point = len(chronological_records) // 2
    first_half = chronological_records[:mid_point]
    second_half = chronological_records[mid_point:]
    
    first_half_present = sum(1 for r in first_half if r['status'] in ['present', 'excused'])
    first_half_percentage = (first_half_present / len(first_half) * 100) if len(first_half) > 0 else 0
    result['metrics']['first_half_percentage'] = round(first_half_percentage, 2)
    
    second_half_present = sum(1 for r in second_half if r['status'] in ['present', 'excused'])
    second_half_percentage = (second_half_present / len(second_half) * 100) if len(second_half) > 0 else 0
    result['metrics']['second_half_percentage'] = round(second_half_percentage, 2)
    
    stability_difference = abs(second_half_percentage - first_half_percentage)
    result['metrics']['stability_difference'] = round(stability_difference, 2)
    
    # Feature 5: Excused Ratio
    excused_count = sum(1 for r in attendance_records if r['status'] == 'excused')
    excused_ratio = (excused_count / total_sessions) * 100
    result['metrics']['excused_count'] = excused_count
    result['metrics']['excused_ratio'] = round(excused_ratio, 2)

    
    # DECISION LOGIC (Priority Order)
    
    # PRIORITY 1: Check attendance percentage (baseline)
    if attendance_percentage < 50:
        result['consistency_level'] = 'low'
        result['message'] = f'Low consistency: Only {attendance_percentage:.1f}% attendance'
    
    # PRIORITY 2: Check if too many excused (> 30%)
    elif excused_ratio > 30:
        result['consistency_level'] = 'medium'
        result['message'] = f'Medium consistency: High excused ratio ({excused_ratio:.1f}%), not physically present enough'
        result['notes'].append('⚠️ Excused ratio above 30% threshold')
    
    # PRIORITY 3: Check longest absence gap (long disappearance)
    elif max_absence_gap >= 5:
        result['consistency_level'] = 'low'
        result['message'] = f'Low consistency: Had {max_absence_gap}-session absence streak'
    
    # PRIORITY 4: Check volatility + stability (ADJUSTED THRESHOLD)
    elif volatility < 0.35 and stability_difference < 20:  # Adjusted from 15 to 20
        result['consistency_level'] = 'high'
        result['message'] = f'High consistency: Stable pattern (volatility: {volatility:.2f}, stability: {stability_difference:.1f}%)'
    
    elif volatility >= 0.45 or stability_difference >= 25:
        result['consistency_level'] = 'low'
        result['message'] = f'Low consistency: Irregular pattern (volatility: {volatility:.2f}, stability: {stability_difference:.1f}%)'
    
    else:
        result['consistency_level'] = 'medium'
        result['message'] = f'Medium consistency: Somewhat regular pattern (volatility: {volatility:.2f}, stability: {stability_difference:.1f}%)'
    
    # Add contextual notes
    if volatility > 0.4:
        result['notes'].append('Pattern shows moderate volatility')
    
    return result



def main():
    """Main function to read input from stdin and output consistency analysis"""
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
        
        print(f"Model 3: Analyzing student {student_id}, course {course_id}", file=sys.stderr)
        
        # Fetch attendance records from database
        attendance_records = fetch_attendance_records(
            student_id, course_id, enrollment_date, completion_date, db_path
        )
        
        print(f"Model 3: Found {len(attendance_records)} attendance records", file=sys.stderr)
        
        # Calculate consistency analysis
        result = calculate_consistency_analysis(attendance_records)
        
        # Output result as JSON
        print(json.dumps(result, indent=2))
        
    except KeyError as e:
        error_result = {'error': 'Missing required field', 'message': f'Missing field: {str(e)}'}
        print(json.dumps(error_result, indent=2))
        sys.exit(1)
    except json.JSONDecodeError as e:
        error_result = {'error': 'Invalid JSON input', 'message': str(e)}
        print(json.dumps(error_result, indent=2))
        sys.exit(1)
    except Exception as e:
        error_result = {'error': 'Calculation failed', 'message': str(e)}
        print(json.dumps(error_result, indent=2))
        sys.exit(1)


if __name__ == '__main__':
    main()
