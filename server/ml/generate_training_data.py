"""
Generate Realistic Training Data for Model 2 (Risk Prediction)
Creates 10,000 student samples with realistic patterns based on real-world scenarios

REALISTIC PATTERNS:
- High attendance (>85%) → Usually pass (90% pass rate)
- Medium attendance (65-85%) → Mixed results (60% pass rate)
- Low attendance (<65%) → Usually fail (20% pass rate)
- Improving trend → Better outcomes
- High consistency + High attentiveness → Better outcomes
- Medical/Family reasons → Negative impact
- Academic/Sports/Internship reasons → Positive impact
"""

import pandas as pd
import numpy as np
import random

# Set random seed for reproducibility
np.random.seed(42)
random.seed(42)

def generate_realistic_student():
    """Generate one realistic student record"""
    
    # Total sessions (typically 40-50 for a semester)
    total_sessions = random.choice([40, 42, 45, 48, 50])
    
    # First, generate attendance percentage (independent of outcome)
    # This creates more realistic distribution
    attendance_pct = np.random.beta(5, 2) * 70 + 30  # 30-100% with realistic curve
    
    # Now decide outcome based on attendance AND other factors
    # This creates complex cases where other features matter
    
    # Base probability of passing based on attendance
    if attendance_pct >= 85:
        base_pass_prob = 0.95  # Very high chance, but not 100%
    elif attendance_pct >= 75:
        base_pass_prob = 0.85  # High chance
    elif attendance_pct >= 65:
        base_pass_prob = 0.50  # 50-50 (other features decide!)
    elif attendance_pct >= 55:
        base_pass_prob = 0.25  # Low chance, but possible if other factors good
    else:
        base_pass_prob = 0.05  # Very low, but not impossible
    
    # Decide outcome with some randomness
    will_pass = random.random() < base_pass_prob
    
    
    if will_pass:
        # PASSING STUDENT PATTERNS
        # Better trends, better engagement (but attendance already set)
        
        # Trend: More likely improving/stable (especially if attendance is borderline)
        if attendance_pct < 75:
            # Low attendance but passing - MUST have good trend
            trend = random.choices(
                ['improving', 'stable', 'declining'],
                weights=[0.70, 0.25, 0.05]  # 70% improving (compensating for low attendance)
            )[0]
        else:
            # Normal distribution for passing students
            trend = random.choices(
                ['improving', 'stable', 'declining'],
                weights=[0.50, 0.35, 0.15]
            )[0]
        
        # Consistency: More likely high/medium
        if attendance_pct < 75:
            # Low attendance but passing - MUST have high consistency
            consistency = random.choices(
                ['high', 'medium', 'low'],
                weights=[0.70, 0.25, 0.05]  # 70% high
            )[0]
        else:
            consistency = random.choices(
                ['high', 'medium', 'low'],
                weights=[0.50, 0.35, 0.15]
            )[0]
        
        # Attentiveness: More likely High/Medium
        if attendance_pct < 75:
            # Low attendance but passing - MUST have high attentiveness
            attentiveness = random.choices(
                ['High', 'Medium', 'Low'],
                weights=[0.75, 0.20, 0.05]  # 75% High
            )[0]
        else:
            attentiveness = random.choices(
                ['High', 'Medium', 'Low'],
                weights=[0.55, 0.35, 0.10]
            )[0]
        
        # Calculate present/absent based on attendance
        total_present = int((attendance_pct / 100) * total_sessions)
        total_absent = total_sessions - total_present
        
        # Recalculate attendance_pct to match exactly (fix rounding issues)
        attendance_pct = round((total_present / total_sessions) * 100, 1)
        
        # Reason distribution (passing students have more positive reasons)
        # Medical/Family: 0-3 (lower for passing students)
        reason_medical = random.choices([0, 1, 2, 3], weights=[0.40, 0.35, 0.20, 0.05])[0]
        reason_family = random.choices([0, 1, 2], weights=[0.50, 0.35, 0.15])[0]
        
        # Academic/Sports/Internship: 0-6 (higher for passing students)
        reason_academic = random.choices([0, 1, 2, 3, 4, 5], weights=[0.30, 0.25, 0.20, 0.15, 0.07, 0.03])[0]
        reason_sports = random.choices([0, 1, 2, 3, 4, 5, 6], weights=[0.25, 0.25, 0.20, 0.15, 0.10, 0.03, 0.02])[0]
        reason_internship = random.choices([0, 1, 2, 3, 4], weights=[0.35, 0.30, 0.20, 0.10, 0.05])[0]
        
        # Ensure total reasons don't exceed total_present
        total_reasons = reason_medical + reason_family + reason_academic + reason_sports + reason_internship
        if total_reasons > total_present:
            # Scale down proportionally
            scale = total_present / total_reasons
            reason_medical = int(reason_medical * scale)
            reason_family = int(reason_family * scale)
            reason_academic = int(reason_academic * scale)
            reason_sports = int(reason_sports * scale)
            reason_internship = int(reason_internship * scale)
        
    else:
        # FAILING STUDENT PATTERNS
        # Worse trends, poor engagement (but attendance already set)
        
        # Trend: More likely declining/stable
        if attendance_pct >= 75:
            # High attendance but failing - MUST have bad trend
            trend = random.choices(
                ['improving', 'stable', 'declining'],
                weights=[0.05, 0.25, 0.70]  # 70% declining (despite good attendance)
            )[0]
        else:
            # Normal distribution for failing students
            trend = random.choices(
                ['improving', 'stable', 'declining'],
                weights=[0.15, 0.30, 0.55]
            )[0]
        
        # Consistency: More likely low/medium
        if attendance_pct >= 75:
            # High attendance but failing - MUST have low consistency
            consistency = random.choices(
                ['high', 'medium', 'low'],
                weights=[0.05, 0.25, 0.70]  # 70% low
            )[0]
        else:
            consistency = random.choices(
                ['high', 'medium', 'low'],
                weights=[0.10, 0.35, 0.55]
            )[0]
        
        # Attentiveness: More likely Low/Medium
        if attendance_pct >= 75:
            # High attendance but failing - MUST have low attentiveness
            attentiveness = random.choices(
                ['High', 'Medium', 'Low'],
                weights=[0.05, 0.25, 0.70]  # 70% Low (physically present but not engaged)
            )[0]
        else:
            attentiveness = random.choices(
                ['High', 'Medium', 'Low'],
                weights=[0.10, 0.30, 0.60]
            )[0]
        
        # Calculate present/absent based on attendance
        total_present = int((attendance_pct / 100) * total_sessions)
        total_absent = total_sessions - total_present
        
        # Recalculate attendance_pct to match exactly (fix rounding issues)
        attendance_pct = round((total_present / total_sessions) * 100, 1)
        
        # Reason distribution (failing students have more negative reasons)
        # Medical/Family: 0-8 (higher for failing students)
        reason_medical = random.choices([0, 1, 2, 3, 4, 5, 6, 7, 8], 
                                       weights=[0.15, 0.20, 0.20, 0.15, 0.12, 0.08, 0.05, 0.03, 0.02])[0]
        reason_family = random.choices([0, 1, 2, 3, 4, 5], 
                                      weights=[0.25, 0.30, 0.20, 0.15, 0.07, 0.03])[0]
        
        # Academic/Sports/Internship: 0-2 (lower for failing students)
        reason_academic = random.choices([0, 1, 2], weights=[0.70, 0.20, 0.10])[0]
        reason_sports = random.choices([0, 1, 2], weights=[0.65, 0.25, 0.10])[0]
        reason_internship = random.choices([0, 1, 2], weights=[0.75, 0.20, 0.05])[0]
        
        # Ensure total reasons don't exceed total_present
        total_reasons = reason_medical + reason_family + reason_academic + reason_sports + reason_internship
        if total_reasons > total_present:
            # Scale down proportionally
            scale = total_present / total_reasons
            reason_medical = int(reason_medical * scale)
            reason_family = int(reason_family * scale)
            reason_academic = int(reason_academic * scale)
            reason_sports = int(reason_sports * scale)
            reason_internship = int(reason_internship * scale)
    
    # Ensure total_present + total_absent = total_sessions
    if total_present + total_absent != total_sessions:
        total_absent = total_sessions - total_present
    
    # Outcome
    outcome = 'passed' if will_pass else 'failed'
    
    return {
        'attendance_pct': attendance_pct,
        'trend': trend,
        'consistency': consistency,
        'attentiveness': attentiveness,
        'total_present': total_present,
        'total_sessions': total_sessions,
        'total_absent': total_absent,
        'reason_medical': reason_medical,
        'reason_family': reason_family,
        'reason_academic': reason_academic,
        'reason_sports': reason_sports,
        'reason_internship': reason_internship,
        'outcome': outcome
    }



def validate_student_record(student):
    """Validate that a student record is logically correct"""
    errors = []
    
    # Check 1: total_present + total_absent = total_sessions
    if student['total_present'] + student['total_absent'] != student['total_sessions']:
        errors.append(f"Math error: {student['total_present']} + {student['total_absent']} ≠ {student['total_sessions']}")
    
    # Check 2: attendance_pct matches calculation
    expected_pct = (student['total_present'] / student['total_sessions']) * 100
    if abs(student['attendance_pct'] - expected_pct) > 2:  # Allow 2% tolerance
        errors.append(f"Attendance mismatch: {student['attendance_pct']}% vs calculated {expected_pct:.1f}%")
    
    # Check 3: Reason counts don't exceed total_present
    total_reasons = (student['reason_medical'] + student['reason_family'] + 
                    student['reason_academic'] + student['reason_sports'] + 
                    student['reason_internship'])
    if total_reasons > student['total_present']:
        errors.append(f"Reason count ({total_reasons}) exceeds total_present ({student['total_present']})")
    
    # Check 4: Values in valid ranges
    if not (0 <= student['attendance_pct'] <= 100):
        errors.append(f"Invalid attendance_pct: {student['attendance_pct']}")
    
    if student['trend'] not in ['improving', 'stable', 'declining']:
        errors.append(f"Invalid trend: {student['trend']}")
    
    if student['consistency'] not in ['high', 'medium', 'low']:
        errors.append(f"Invalid consistency: {student['consistency']}")
    
    if student['attentiveness'] not in ['High', 'Medium', 'Low']:
        errors.append(f"Invalid attentiveness: {student['attentiveness']}")
    
    if student['outcome'] not in ['passed', 'failed']:
        errors.append(f"Invalid outcome: {student['outcome']}")
    
    return errors


def validate_dataset_patterns(df):
    """Validate that dataset has realistic patterns"""
    print("🔍 VALIDATING DATASET PATTERNS:")
    print("-" * 60)
    
    issues = []
    
    # Pattern 1: High attendance should correlate with passing
    high_attendance = df[df['attendance_pct'] >= 85]
    high_att_pass_rate = (high_attendance['outcome'] == 'passed').sum() / len(high_attendance) * 100
    print(f"✓ High attendance (≥85%) pass rate: {high_att_pass_rate:.1f}% (expected: 85-95%)")
    if high_att_pass_rate < 80:
        issues.append(f"High attendance pass rate too low: {high_att_pass_rate:.1f}%")
    
    # Pattern 2: Low attendance should correlate with failing
    low_attendance = df[df['attendance_pct'] < 65]
    low_att_fail_rate = (low_attendance['outcome'] == 'failed').sum() / len(low_attendance) * 100
    print(f"✓ Low attendance (<65%) fail rate: {low_att_fail_rate:.1f}% (expected: 70-90%)")
    if low_att_fail_rate < 60:
        issues.append(f"Low attendance fail rate too low: {low_att_fail_rate:.1f}%")
    
    # Pattern 3: Improving trend should have better outcomes
    improving = df[df['trend'] == 'improving']
    improving_pass_rate = (improving['outcome'] == 'passed').sum() / len(improving) * 100
    declining = df[df['trend'] == 'declining']
    declining_pass_rate = (declining['outcome'] == 'passed').sum() / len(declining) * 100
    print(f"✓ Improving trend pass rate: {improving_pass_rate:.1f}%")
    print(f"✓ Declining trend pass rate: {declining_pass_rate:.1f}%")
    if improving_pass_rate <= declining_pass_rate:
        issues.append("Improving trend should have higher pass rate than declining")
    
    # Pattern 4: High attentiveness should correlate with passing
    high_att = df[df['attentiveness'] == 'High']
    high_att_pass = (high_att['outcome'] == 'passed').sum() / len(high_att) * 100
    low_att = df[df['attentiveness'] == 'Low']
    low_att_pass = (low_att['outcome'] == 'passed').sum() / len(low_att) * 100
    print(f"✓ High attentiveness pass rate: {high_att_pass:.1f}%")
    print(f"✓ Low attentiveness pass rate: {low_att_pass:.1f}%")
    if high_att_pass <= low_att_pass:
        issues.append("High attentiveness should have higher pass rate than low")
    
    print()
    
    if issues:
        print("⚠️ PATTERN VALIDATION ISSUES:")
        for issue in issues:
            print(f"  - {issue}")
        print()
        return False
    else:
        print("✅ ALL PATTERNS VALIDATED SUCCESSFULLY!")
        print()
        return True


def main():
    """Generate 10,000 realistic student records"""
    
    print("=" * 60)
    print("GENERATING REALISTIC TRAINING DATA")
    print("=" * 60)
    print()
    print("Creating 10,000 student records with realistic patterns...")
    print("Including EASY, MEDIUM, and HARD prediction cases...")
    print()
    
    # Generate 10,000 students
    students = []
    validation_errors = []
    
    for i in range(10000):
        student = generate_realistic_student()
        
        # Validate each student record
        errors = validate_student_record(student)
        if errors:
            validation_errors.append((i, errors))
        
        students.append(student)
        
        # Progress indicator
        if (i + 1) % 1000 == 0:
            print(f"Generated {i + 1}/10,000 students...")
    
    print()
    
    # Report validation errors
    if validation_errors:
        print(f"⚠️ Found {len(validation_errors)} records with validation errors!")
        print("Showing first 5 errors:")
        for idx, (student_idx, errors) in enumerate(validation_errors[:5]):
            print(f"  Student {student_idx}: {errors}")
        print()
        return
    else:
        print("✅ All 10,000 records passed individual validation!")
        print()
    
    # Create DataFrame
    df = pd.DataFrame(students)
    
    print()
    print("=" * 60)
    print("DATA GENERATION COMPLETE!")
    print("=" * 60)
    print()
    
    # Validate dataset patterns
    patterns_valid = validate_dataset_patterns(df)
    
    if not patterns_valid:
        print("❌ Dataset failed pattern validation!")
        return
    
    # Show statistics
    print("📊 DATASET STATISTICS:")
    print("-" * 60)
    print(f"Total students: {len(df)}")
    print()
    
    print("Outcome distribution:")
    outcome_counts = df['outcome'].value_counts()
    for outcome, count in outcome_counts.items():
        print(f"  {outcome}: {count} ({count/len(df)*100:.1f}%)")
    print()
    
    print("Attendance distribution:")
    print(f"  Mean: {df['attendance_pct'].mean():.1f}%")
    print(f"  Min: {df['attendance_pct'].min():.1f}%")
    print(f"  Max: {df['attendance_pct'].max():.1f}%")
    print()
    
    print("Trend distribution:")
    for trend, count in df['trend'].value_counts().items():
        print(f"  {trend}: {count} ({count/len(df)*100:.1f}%)")
    print()
    
    print("Consistency distribution:")
    for consistency, count in df['consistency'].value_counts().items():
        print(f"  {consistency}: {count} ({count/len(df)*100:.1f}%)")
    print()
    
    print("Attentiveness distribution:")
    for attentiveness, count in df['attentiveness'].value_counts().items():
        print(f"  {attentiveness}: {count} ({count/len(df)*100:.1f}%)")
    print()
    
    # Show sample data
    print("Sample data (first 5 rows):")
    print(df.head())
    print()
    
    # Save to CSV
    output_path = 'server/ml/training_data_risk_model.csv'
    df.to_csv(output_path, index=False)
    
    print("=" * 60)
    print("✅ TRAINING DATA SAVED!")
    print("=" * 60)
    print(f"Location: {output_path}")
    print(f"Size: {len(df)} rows × {len(df.columns)} columns")
    print()
    print("Next step: Run train_risk_model.py to train the model")
    print("=" * 60)


if __name__ == '__main__':
    main()
