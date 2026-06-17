"""
Model 2: Risk Prediction - PREDICTION PHASE
Predicts student attendance risk using trained XGBoost model

IMPORTANT: Model 2 receives 12 FEATURES from backend (NOT queries database itself)
Backend prepares all features and sends them to Model 2 via stdin

Input: 12 features + metadata
Output: risk_level, confidence, risk_score, prob_fail, prob_pass, prediction
"""

import json
import sys
import pickle
import os
import math
import numpy as np


def main():
    """Main function for Model 2 prediction"""
    
    try:
        # STEP 1: Read input from stdin
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        
        # Extract metadata
        student_id = data.get('student_id')
        course_id = data.get('course_id')
        enrollment_date = data.get('enrollment_date')
        completion_date = data.get('completion_date')
        db_path = data.get('db_path')
        
        # Extract 12 features (prepared by backend)
        attendance_pct = data.get('attendance_pct')
        trend = data.get('trend')
        consistency = data.get('consistency')
        attentiveness = data.get('attentiveness')
        total_present = data.get('total_present')
        total_sessions = data.get('total_sessions')
        total_absent = data.get('total_absent')
        reason_medical = data.get('reason_medical')
        reason_family = data.get('reason_family')
        reason_academic = data.get('reason_academic')
        reason_sports = data.get('reason_sports')
        reason_internship = data.get('reason_internship')
        
        print(f"Model 2: Received input for student {student_id}, course {course_id}", file=sys.stderr)
        print(f"  Attendance: {attendance_pct:.1f}%, Trend: {trend}, Consistency: {consistency}, Attentiveness: {attentiveness}", file=sys.stderr)
        
        # STEP 2: Check can_reach_75_percent (EARLY EXIT)
        sessions_held = total_present + total_absent
        sessions_left = total_sessions - sessions_held
        required_present_for_75 = math.ceil(0.75 * total_sessions)
        sessions_needed = required_present_for_75 - total_present
        can_reach_75_percent = sessions_needed <= sessions_left
        max_possible_attendance = (total_present + sessions_left) / total_sessions * 100 if total_sessions > 0 else 0
        
        print(f"Model 2: Early exit check - can_reach_75_percent: {can_reach_75_percent}", file=sys.stderr)
        
        # EARLY EXIT if impossible to reach 75%
        if not can_reach_75_percent:
            print(f"⚠️ IMPOSSIBLE to reach 75%! Returning HIGH RISK immediately.", file=sys.stderr)
            
            result = {
                'risk_level': 'high',
                'confidence': 'high',
                'risk_score': 100.0,
                'prob_fail': 1.0,
                'prob_pass': 0.0,
                'prediction': 'failed',
                'message': f'High risk: Cannot reach 75% attendance. Max possible: {max_possible_attendance:.1f}%',
                'metrics': {
                    'attendance_pct': round(attendance_pct, 2),
                    'trend': trend,
                    'consistency': consistency,
                    'attentiveness': attentiveness,
                    'total_present': total_present,
                    'total_sessions': total_sessions,
                    'total_absent': total_absent,
                    'sessions_held': sessions_held,
                    'sessions_left': sessions_left,
                    'sessions_needed': sessions_needed,
                    'max_possible_attendance': round(max_possible_attendance, 2),
                    'can_reach_75_percent': False,
                    'reason_medical': reason_medical,
                    'reason_family': reason_family,
                    'reason_academic': reason_academic,
                    'reason_sports': reason_sports,
                    'reason_internship': reason_internship
                },
                'notes': [
                    '⚠️ IMPOSSIBLE to reach 75% attendance',
                    f'⚠️ Needs {sessions_needed} more sessions, but only {sessions_left} left',
                    f'⚠️ Max possible attendance: {max_possible_attendance:.1f}%'
                ],
                'warnings': ['Student cannot meet minimum attendance requirement']
            }
            
            print(json.dumps(result, indent=2))
            sys.exit(0)
        
        # STEP 3: Load trained model
        model_path = 'server/ml/models/risk_prediction_model.pkl'
        
        if not os.path.exists(model_path):
            error_result = {
                'error': 'Model not found',
                'message': f'Trained model not found at {model_path}'
            }
            print(json.dumps(error_result, indent=2))
            sys.exit(1)
        
        print(f"Model 2: Loading trained model...", file=sys.stderr)
        
        with open(model_path, 'rb') as file:
            model = pickle.load(file)
        
        print(f"  Model loaded successfully!", file=sys.stderr)
        
        # STEP 4: Encode text features to numbers
        trend_mapping = {'declining': 0, 'stable': 1, 'improving': 2}
        consistency_mapping = {'low': 0, 'medium': 1, 'high': 2}
        attentiveness_mapping = {'Low': 0, 'Medium': 1, 'High': 2}
        
        trend_encoded = trend_mapping.get(trend, 1)
        consistency_encoded = consistency_mapping.get(consistency, 1)
        attentiveness_encoded = attentiveness_mapping.get(attentiveness, 1)
        
        print(f"Model 2: Encoding features...", file=sys.stderr)
        print(f"  trend: {trend} → {trend_encoded}", file=sys.stderr)
        print(f"  consistency: {consistency} → {consistency_encoded}", file=sys.stderr)
        print(f"  attentiveness: {attentiveness} → {attentiveness_encoded}", file=sys.stderr)
        
        # STEP 5: Prepare feature array (12 features in exact order)
        features = np.array([[
            attendance_pct,
            trend_encoded,
            consistency_encoded,
            attentiveness_encoded,
            total_present,
            total_sessions,
            total_absent,
            reason_medical,
            reason_family,
            reason_academic,
            reason_sports,
            reason_internship
        ]])
        
        print(f"Model 2: Feature array prepared: {features.shape}", file=sys.stderr)
        
        # STEP 6: Make prediction
        print(f"Model 2: Making prediction...", file=sys.stderr)
        
        prediction = int(model.predict(features)[0])
        probabilities = model.predict_proba(features)[0]
        prob_fail = float(probabilities[0])
        prob_pass = float(probabilities[1])
        
        print(f"  Prediction: {prediction} ({'passed' if prediction == 1 else 'failed'})", file=sys.stderr)
        print(f"  Prob fail: {prob_fail:.4f}, Prob pass: {prob_pass:.4f}", file=sys.stderr)
        
        # STEP 7: Determine risk level
        if prob_fail >= 0.60:
            risk_level = 'high'
            risk_score = prob_fail * 100
            message = f'High risk: {risk_score:.1f}% probability of failing'
        elif prob_fail >= 0.35:
            risk_level = 'medium'
            risk_score = prob_fail * 100
            message = f'Medium risk: {risk_score:.1f}% probability of failing'
        else:
            risk_level = 'low'
            risk_score = prob_fail * 100
            message = f'Low risk: {risk_score:.1f}% probability of failing'
        
        # Calculate confidence
        confidence_score = abs(prob_pass - 0.5) * 2
        if confidence_score >= 0.7:
            confidence = 'high'
        elif confidence_score >= 0.4:
            confidence = 'medium'
        else:
            confidence = 'low'
        
        print(f"Model 2: Risk level: {risk_level}, Confidence: {confidence}", file=sys.stderr)
        
        # STEP 8: Create result
        result = {
            'risk_level': risk_level,
            'confidence': confidence,
            'risk_score': round(risk_score, 2),
            'prob_fail': round(prob_fail, 4),
            'prob_pass': round(prob_pass, 4),
            'prediction': 'passed' if prediction == 1 else 'failed',
            'message': message,
            'metrics': {
                'attendance_pct': round(attendance_pct, 2),
                'trend': trend,
                'consistency': consistency,
                'attentiveness': attentiveness,
                'total_present': total_present,
                'total_sessions': total_sessions,
                'total_absent': total_absent,
                'sessions_held': sessions_held,
                'sessions_left': sessions_left,
                'sessions_needed': sessions_needed,
                'max_possible_attendance': round(max_possible_attendance, 2),
                'can_reach_75_percent': can_reach_75_percent,
                'reason_medical': reason_medical,
                'reason_family': reason_family,
                'reason_academic': reason_academic,
                'reason_sports': reason_sports,
                'reason_internship': reason_internship
            },
            'notes': [],
            'warnings': []
        }
        
        # Add notes
        if risk_level == 'high':
            result['notes'].append('⚠️ Immediate intervention recommended')
            if prob_fail >= 0.80:
                result['warnings'].append('Critical: Very high probability of failure')
        elif risk_level == 'medium':
            result['notes'].append('⚠️ Monitor student progress closely')
        else:
            result['notes'].append('✓ Student is on track')
        
        if attendance_pct < 75:
            result['notes'].append(f"⚠️ Current attendance ({attendance_pct:.1f}%) is below 75% threshold")
        
        # Output result
        print(json.dumps(result, indent=2))
        print("✅ Model 2 prediction complete", file=sys.stderr)
        
    except KeyError as e:
        error_result = {'error': 'Missing field', 'message': f'Missing: {str(e)}'}
        print(json.dumps(error_result, indent=2))
        sys.exit(1)
    except Exception as e:
        error_result = {'error': 'Prediction failed', 'message': str(e)}
        print(json.dumps(error_result, indent=2))
        sys.exit(1)


if __name__ == '__main__':
    main()
