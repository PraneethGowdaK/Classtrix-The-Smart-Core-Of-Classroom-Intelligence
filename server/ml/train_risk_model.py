"""
Model 2: Risk Prediction - TRAINING PHASE
Trains XGBoost model on historical student data to predict attendance risk

NEW SCHEMA IMPLEMENTATION:
- Uses 12 features from attendance data
- Trains XGBoost classifier with optimized parameters
- Saves trained model to .pkl file for later use

Training Data Format (CSV):
- attendance_pct, trend, consistency, attentiveness
- total_present, total_sessions, total_absent
- reason_medical, reason_family, reason_academic, reason_sports, reason_internship
- outcome (passed/failed)

Expected Accuracy: 88-92%
Training Time: 20-40 seconds (for 1000 students)
"""

import pandas as pd
import numpy as np
import time
import pickle
import os
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from xgboost import XGBClassifier


def main():
    """Main training function"""
    
    print("=" * 60)
    print("MODEL 2: RISK PREDICTION - TRAINING PHASE")
    print("=" * 60)
    print()
    
    # ========================================================================
    # STEP 1: Load Training Data
    # ========================================================================
    print("📂 STEP 1: Loading training data...")
    print("-" * 60)
    
    csv_path = 'server/ml/training_data_risk_model.csv'
    
    if not os.path.exists(csv_path):
        print(f"❌ ERROR: Training data not found at {csv_path}")
        print("Please create training data CSV file first.")
        return
    
    df = pd.read_csv(csv_path)
    print(f"✅ Loaded {len(df)} student records")
    print(f"✅ Columns: {list(df.columns)}")
    print()
    
    # Show first few rows
    print("Sample data (first 3 rows):")
    print(df.head(3))
    print()
    
    # ========================================================================
    # STEP 2: Encode Text to Numbers
    # ========================================================================
    print("=" * 60)
    print("🔢 STEP 2: Encoding text columns to numbers...")
    print("-" * 60)
    
    # Encode trend: declining=0, stable=1, improving=2
    trend_mapping = {'declining': 0, 'stable': 1, 'improving': 2}
    df['trend'] = df['trend'].map(trend_mapping)
    print("✅ Encoded 'trend': declining=0, stable=1, improving=2")
    
    # Encode consistency: low=0, medium=1, high=2
    consistency_mapping = {'low': 0, 'medium': 1, 'high': 2}
    df['consistency'] = df['consistency'].map(consistency_mapping)
    print("✅ Encoded 'consistency': low=0, medium=1, high=2")
    
    # Encode attentiveness: Low=0, Medium=1, High=2
    attentiveness_mapping = {'Low': 0, 'Medium': 1, 'High': 2}
    df['attentiveness'] = df['attentiveness'].map(attentiveness_mapping)
    print("✅ Encoded 'attentiveness': Low=0, Medium=1, High=2")
    
    # Encode outcome: failed=0, passed=1
    outcome_mapping = {'failed': 0, 'passed': 1}
    df['outcome'] = df['outcome'].map(outcome_mapping)
    print("✅ Encoded 'outcome': failed=0, passed=1")
    print()
    
    # Check for any missing values after encoding
    if df.isnull().any().any():
        print("⚠️ WARNING: Found missing values after encoding!")
        print(df.isnull().sum())
        print()
    
    # ========================================================================
    # STEP 3: Separate Features (X) and Labels (y)
    # ========================================================================
    print("=" * 60)
    print("📊 STEP 3: Separating features and labels...")
    print("-" * 60)
    
    # Features (X) - 12 columns
    feature_columns = [
        'attendance_pct', 'trend', 'consistency', 'attentiveness',
        'total_present', 'total_sessions', 'total_absent',
        'reason_medical', 'reason_family', 'reason_academic',
        'reason_sports', 'reason_internship'
    ]
    
    X = df[feature_columns]
    y = df['outcome']
    
    print(f"✅ Features (X) shape: {X.shape}")
    print(f"✅ Labels (y) shape: {y.shape}")
    print(f"✅ Feature columns: {feature_columns}")
    print()
    
    # Show class distribution
    passed_count = (y == 1).sum()
    failed_count = (y == 0).sum()
    print(f"Class distribution:")
    print(f"  Passed: {passed_count} ({passed_count/len(y)*100:.1f}%)")
    print(f"  Failed: {failed_count} ({failed_count/len(y)*100:.1f}%)")
    print()
    
    # ========================================================================
    # STEP 4: Split Data (80% Training, 20% Testing)
    # ========================================================================
    print("=" * 60)
    print("✂️ STEP 4: Splitting data into training and testing sets...")
    print("-" * 60)
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.2,      # 20% for testing
        random_state=42,    # For reproducibility
        stratify=y          # Maintain class distribution
    )
    
    print(f"✅ Training set: {X_train.shape[0]} students ({X_train.shape[0]/len(X)*100:.0f}%)")
    print(f"✅ Testing set: {X_test.shape[0]} students ({X_test.shape[0]/len(X)*100:.0f}%)")
    print(f"✅ Features per student: {X_train.shape[1]}")
    print()
    
    # ========================================================================
    # STEP 5: Create XGBoost Model (Optimized Parameters)
    # ========================================================================
    print("=" * 60)
    print("🤖 STEP 5: Creating XGBoost model with optimized parameters...")
    print("-" * 60)
    
    model = XGBClassifier(
        # Core parameters
        n_estimators=200,              # Number of trees (more = better accuracy)
        learning_rate=0.05,            # Learning rate (slower = more accurate)
        max_depth=8,                   # Maximum tree depth (perfect for 12 features)
        
        # Regularization parameters (prevent overfitting)
        min_child_weight=3,            # Minimum samples in leaf
        gamma=0.1,                     # Minimum loss reduction for split
        subsample=0.8,                 # Use 80% of data per tree
        colsample_bytree=0.8,          # Use 80% of features per tree
        
        # Handle imbalanced data
        scale_pos_weight=1.5,          # Give more weight to minority class
        
        # Technical parameters
        random_state=42,               # For reproducibility
        eval_metric='logloss',         # Evaluation metric
        use_label_encoder=False,       # Avoid warning
        n_jobs=-1                      # Use all CPU cores (faster training)
    )
    
    print("✅ XGBoost model created!")
    print(f"   - Trees: {model.n_estimators}")
    print(f"   - Max depth: {model.max_depth}")
    print(f"   - Learning rate: {model.learning_rate}")
    print(f"   - Regularization: gamma={model.gamma}, min_child_weight={model.min_child_weight}")
    print()
    
    # ========================================================================
    # STEP 6: Train the Model
    # ========================================================================
    print("=" * 60)
    print("🚀 STEP 6: Training XGBoost model...")
    print("-" * 60)
    print(f"Training on {X_train.shape[0]} students with {X_train.shape[1]} features...")
    print("This may take 20-40 seconds...")
    print()
    
    start_time = time.time()
    
    # Train the model
    model.fit(X_train, y_train)
    
    end_time = time.time()
    training_time = end_time - start_time
    
    print("=" * 60)
    print("✅ TRAINING COMPLETE!")
    print("=" * 60)
    print(f"Training time: {training_time:.2f} seconds")
    print()
    
    # ========================================================================
    # STEP 7: Evaluate the Model
    # ========================================================================
    print("=" * 60)
    print("📊 STEP 7: Evaluating model on test set...")
    print("-" * 60)
    print(f"Testing on {X_test.shape[0]} students (never seen during training)")
    print()
    
    # Make predictions
    y_pred = model.predict(X_test)
    
    # Calculate accuracy
    accuracy = accuracy_score(y_test, y_pred)
    
    print("=" * 60)
    print(f"✅ ACCURACY: {accuracy * 100:.2f}%")
    print("=" * 60)
    print()
    
    # Detailed classification report
    print("📋 DETAILED CLASSIFICATION REPORT:")
    print("-" * 60)
    print(classification_report(y_test, y_pred, target_names=['Failed', 'Passed']))
    print()
    
    # Confusion matrix
    print("🔢 CONFUSION MATRIX:")
    print("-" * 60)
    cm = confusion_matrix(y_test, y_pred)
    print(f"                Predicted")
    print(f"                Failed  Passed")
    print(f"Actual Failed     {cm[0][0]:3d}     {cm[0][1]:3d}")
    print(f"Actual Passed     {cm[1][0]:3d}     {cm[1][1]:3d}")
    print()
    
    # Interpretation
    print("Interpretation:")
    print(f"  ✅ Correctly predicted Failed: {cm[0][0]} students")
    print(f"  ✅ Correctly predicted Passed: {cm[1][1]} students")
    print(f"  ❌ Missed risk (predicted Pass, actually Failed): {cm[0][1]} students")
    print(f"  ❌ False alarm (predicted Fail, actually Passed): {cm[1][0]} students")
    print()
    
    # Feature importance
    print("🎯 FEATURE IMPORTANCE (Top 5):")
    print("-" * 60)
    feature_importance = pd.DataFrame({
        'feature': feature_columns,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    for idx, row in feature_importance.head(5).iterrows():
        print(f"  {row['feature']:20s}: {row['importance']:.4f}")
    print()
    
    # ========================================================================
    # STEP 8: Save the Trained Model
    # ========================================================================
    print("=" * 60)
    print("💾 STEP 8: Saving trained model...")
    print("-" * 60)
    
    # Create directory if it doesn't exist
    model_dir = 'server/ml/models'
    os.makedirs(model_dir, exist_ok=True)
    
    # Save the model
    model_path = os.path.join(model_dir, 'risk_prediction_model.pkl')
    
    with open(model_path, 'wb') as file:
        pickle.dump(model, file)
    
    # Get file size
    file_size = os.path.getsize(model_path) / (1024 * 1024)  # Convert to MB
    
    print("✅ Model saved successfully!")
    print(f"   Location: {model_path}")
    print(f"   File size: {file_size:.2f} MB")
    print()
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    print("=" * 60)
    print("🎉 TRAINING PHASE COMPLETE!")
    print("=" * 60)
    print(f"✅ Trained on {len(X_train)} students")
    print(f"✅ Tested on {len(X_test)} students")
    print(f"✅ Accuracy: {accuracy * 100:.2f}%")
    print(f"✅ Training time: {training_time:.2f} seconds")
    print(f"✅ Model saved: {model_path}")
    print()
    print("Next steps:")
    print("  1. Use this model in model2_risk_prediction.py for predictions")
    print("  2. Model will predict risk level (high/medium/low) for current students")
    print("  3. Retrain periodically with new data to improve accuracy")
    print("=" * 60)


if __name__ == '__main__':
    main()
