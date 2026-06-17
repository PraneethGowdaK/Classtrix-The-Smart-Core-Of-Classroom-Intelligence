"""
ML Model 4: Attentiveness Analysis
NEW SCHEMA - Queries database itself
Uses ONLY attentiveness (High/Medium/Low), NOT emotion
"""

import json
import sys
import sqlite3
from typing import List, Dict, Any


def fetch_attendance_records(student_id, course_id, enrollment_date, completion_date, db_path):
    """Fetch ALL attendance records with attentiveness data"""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        query = """
        SELECT ar.status, ar.attentiveness, asess.session_date
        FROM attendance_records ar
        JOIN attendance_sessions asess ON ar.session_id = asess.id
        WHERE ar.student_id = ? AND asess.course_id = ?
          AND asess.session_date >= ? AND asess.session_date <= date('now')
        ORDER BY asess.session_date DESC
        """
        
        cursor.execute(query, [student_id, course_id, enrollment_date])
        rows = cursor.fetchall()
        attendance_records = [
            {'status': row[0], 'attentiveness': row[1], 'session_date': row[2]} 
            for row in rows
        ]
        conn.close()
        return attendance_records
    except Exception as e:
        print(f"Database error: {str(e)}", file=sys.stderr)
        return []



def calculate_attentiveness_analysis(attendance_records):
    """Calculate attentiveness using 3 features"""
    
    # Filter only 'present' sessions with attentiveness data
    present_records = [
        r for r in attendance_records 
        if r['status'] == 'present' and r['attentiveness'] is not None
    ]
    
    total_present_sessions = len(present_records)
    total_sessions = len(attendance_records)
    
    result = {
        'attentiveness_level': 'Medium',
        'confidence': 'high',  # Always high
        'metrics': {},
        'message': '',
        'notes': [],
        'warnings': []
    }
    
    # CASE 1: No face recognition data
    if total_present_sessions == 0:
        result['attentiveness_level'] = 'no_data'
        result['metrics'] = {
            'total_present_sessions': 0,
            'total_sessions': total_sessions
        }
        result['message'] = 'No face recognition data available yet'
        return result
    
    # CASE 2: One session
    if total_present_sessions == 1:
        attentiveness = present_records[0]['attentiveness']
        result['metrics']['total_present_sessions'] = 1
        result['metrics']['total_sessions'] = total_sessions
        result['attentiveness_level'] = attentiveness
        result['message'] = f'First session recorded: Student was {attentiveness.lower()}ly attentive'
        return result

    
    # CASE 3: 2-4 sessions - Simple logic
    if total_present_sessions <= 4:
        high_count = sum(1 for r in present_records if r['attentiveness'] == 'High')
        low_count = sum(1 for r in present_records if r['attentiveness'] == 'Low')
        
        high_ratio = high_count / total_present_sessions
        low_ratio = low_count / total_present_sessions
        
        result['metrics']['total_present_sessions'] = total_present_sessions
        result['metrics']['total_sessions'] = total_sessions
        result['metrics']['high_count'] = high_count
        result['metrics']['low_count'] = low_count
        
        # Simple logic (LENIENT)
        if high_ratio >= 0.50:  # 50% or more High
            result['attentiveness_level'] = 'High'
            result['message'] = f'Good start: {high_ratio*100:.0f}% highly attentive in first {total_present_sessions} sessions'
        elif low_ratio >= 0.50:  # 50% or more Low
            result['attentiveness_level'] = 'Low'
            result['message'] = f'Concerning start: {low_ratio*100:.0f}% low attentiveness in first {total_present_sessions} sessions'
        else:  # Mixed or mostly Medium
            result['attentiveness_level'] = 'Medium'
            result['message'] = f'Moderate start: Mixed attentiveness in first {total_present_sessions} sessions'
        
        return result

    
    # CASE 4: 5+ sessions - FULL ANALYSIS (VERY LENIENT)
    
    # Feature 1: Total Present Sessions
    result['metrics']['total_present_sessions'] = total_present_sessions
    result['metrics']['total_sessions'] = total_sessions
    
    # Feature 2: High Attentiveness Ratio
    high_count = sum(1 for r in present_records if r['attentiveness'] == 'High')
    high_ratio = high_count / total_present_sessions
    result['metrics']['high_count'] = high_count
    result['metrics']['high_attentiveness_ratio'] = round(high_ratio, 4)
    
    # Feature 3: Low Attentiveness Ratio
    low_count = sum(1 for r in present_records if r['attentiveness'] == 'Low')
    low_ratio = low_count / total_present_sessions
    result['metrics']['low_count'] = low_count
    result['metrics']['low_attentiveness_ratio'] = round(low_ratio, 4)
    
    # Medium is implicit
    medium_count = total_present_sessions - high_count - low_count
    medium_ratio = medium_count / total_present_sessions
    result['metrics']['medium_count'] = medium_count
    result['metrics']['medium_attentiveness_ratio'] = round(medium_ratio, 4)

    
    # DECISION LOGIC (VERY LENIENT - Priority Order)
    
    # PRIORITY 1: Check for clear High attentiveness
    if high_ratio >= 0.60:  # 60% or more High
        result['attentiveness_level'] = 'High'
        result['message'] = f'High attentiveness: Student is highly engaged {high_ratio*100:.0f}% of the time'
    
    # PRIORITY 2: Check for clear Low attentiveness (VERY LENIENT)
    elif low_ratio >= 0.55:  # 55% or more Low (need clear majority)
        result['attentiveness_level'] = 'Low'
        result['message'] = f'Low attentiveness: Student shows low engagement {low_ratio*100:.0f}% of the time'
    
    # PRIORITY 3: Borderline High (give benefit of doubt)
    elif high_ratio >= 0.45 and low_ratio < 0.25:  # 45-59% High, Low < 25%
        result['attentiveness_level'] = 'High'
        result['message'] = f'High attentiveness: Student is frequently engaged ({high_ratio*100:.0f}% high, {low_ratio*100:.0f}% low)'
    
    # PRIORITY 4: Borderline Low (need VERY clear evidence)
    elif low_ratio >= 0.45 and high_ratio < 0.25:  # 45-54% Low, High < 25%
        result['attentiveness_level'] = 'Low'
        result['message'] = f'Low attentiveness: Student shows frequent disengagement ({low_ratio*100:.0f}% low, {high_ratio*100:.0f}% high)'
    
    # PRIORITY 5: Everything else is Medium
    else:
        result['attentiveness_level'] = 'Medium'
        result['message'] = f'Medium attentiveness: Mixed engagement pattern ({high_ratio*100:.0f}% high, {medium_ratio*100:.0f}% medium, {low_ratio*100:.0f}% low)'
    
    return result



def main():
    """Main function to read input from stdin and output attentiveness analysis"""
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
        
        print(f"Model 4: Analyzing student {student_id}, course {course_id}", file=sys.stderr)
        
        # Fetch attendance records from database
        attendance_records = fetch_attendance_records(
            student_id, course_id, enrollment_date, completion_date, db_path
        )
        
        print(f"Model 4: Found {len(attendance_records)} attendance records", file=sys.stderr)
        
        # Calculate attentiveness analysis
        result = calculate_attentiveness_analysis(attendance_records)
        
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
