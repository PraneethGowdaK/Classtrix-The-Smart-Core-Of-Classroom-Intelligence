# Classtrix-The-Smart-Core-Of-Classroom-Intelligence
AI-powered classroom intelligence platform that automates attendance using facial recognition and provides ML-driven risk prediction, trend analysis, consistency evaluation, and attentiveness monitoring.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Key Features](#key-features)
- [Screenshots](#screenshots)
  - [1. Portal Login System](#1-portal-login-system)
  - [2. Administrator Dashboard](#2-administrator-dashboard)
  - [3. Add Course Module](#3-add-course-module)
  - [4. Teacher Registration Module](#4-teacher-registration-module)
  - [5. Student Registration Module](#5-student-registration-module)
  - [6. Timetable Creation Module](#6-timetable-creation-module)
  - [7. Student Login Portal](#7-student-login-portal)
  - [8. Student Dashboard](#8-student-dashboard)
  - [9. Student Attendance Viewer](#9-student-attendance-viewer)
  - [10. Student Attendance Analytics](#10-student-attendance-analytics)
  - [11. Attendance Trend & ML Insights](#11-attendance-trend--ml-insights)
  - [12. Teacher Dashboard](#12-teacher-dashboard)
  - [13. Attendance Session Selection](#13-attendance-session-selection)
  - [14. Attendance Validation System](#14-attendance-validation-system)
  - [15. Face Recognition Attendance Capture](#15-face-recognition-attendance-capture)
  - [16. Attendance Review & Verification](#16-attendance-review--verification)
  - [17. Attendance Record Management](#17-attendance-record-management)
  - [18. Faculty Attendance Analytics Dashboard](#18-faculty-attendance-analytics-dashboard)
  - [19. Attendance Risk Distribution Analysis](#19-attendance-risk-distribution-analysis)
  - [20. Machine Learning Academic Intelligence](#20-machine-learning-academic-intelligence)
  - [21. Student Attendance Analytics Report](#21-student-attendance-analytics-report)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [ML Models](#ml-models)
- [License](#license)

---

## Overview

Classtix is a full-stack academic intelligence platform built for modern educational institutions. It replaces manual attendance with AI-based facial recognition and enriches that data with machine learning models that track trends, predict risk, evaluate consistency, and measure attentiveness — giving teachers and administrators actionable insights at a glance.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | SQLite |
| ML / AI | Python, TensorFlow, DeepFace, OpenCV, XGBoost |
| Auth | JWT-based role authentication |
| UI Library | Radix UI, shadcn/ui, Recharts, Framer Motion |

---

## Key Features

- **Role-based authentication** — Separate portals for Admin, Teacher, and Student
- **Face recognition attendance** — Captures classroom images and identifies students automatically
- **Timetable-aware validation** — Attendance can only be taken during active scheduled class time
- **ML-powered analytics** — Trend analysis, risk prediction, consistency scoring, attentiveness evaluation
- **Admin control panel** — Manage courses, teachers, students, timetables, and system data
- **Student self-service** — Students view their own attendance, analytics, and ML insights
- **Teacher dashboard** — Faculty manage attendance sessions, review captures, and analyze class performance

---

## Screenshots

### 1. Portal Login System
Role-based authentication portal providing secure access for Administrators, Teachers, and Students.

![Portal Login System](screenshots/Classtrix/1.png)

---

### 2. Administrator Dashboard
Centralized control panel for managing academic resources, users, schedules, and system operations.

![Administrator Dashboard](screenshots/Classtrix/2.png)

---

### 3. Add Course Module
Create and register courses by defining subject details, department, semester, section, and credits.

![Add Course Module](screenshots/Classtrix/3.png)

---

### 4. Teacher Registration Module
Register faculty members and create teacher accounts for academic and attendance management.

![Teacher Registration Module](screenshots/Classtrix/4.png)

---

### 5. Student Registration Module
Enroll students and capture facial data required for automated attendance recognition.

![Student Registration Module](screenshots/Classtrix/5.png)

---

### 6. Timetable Creation Module
Generate conflict-free class schedules for departments, semesters, and sections.

![Timetable Creation Module](screenshots/Classtrix/6.png)

---

### 7. Student Login Portal
Dedicated student authentication interface for accessing attendance records and academic insights.

![Student Login Portal](screenshots/Classtrix/7.png)

---

### 8. Student Dashboard
Personalized student workspace providing quick access to timetable, attendance, and analytics.

![Student Dashboard](screenshots/Classtrix/8.png)

---

### 9. Student Attendance Viewer
View daily attendance records and subject-wise attendance status for selected dates.

![Student Attendance Viewer](screenshots/Classtrix/9.png)

---

### 10. Student Attendance Analytics
AI-powered analysis of attendance performance, risk level, consistency, and attentiveness.

![Student Attendance Analytics](screenshots/Classtrix/10.png)

---

### 11. Attendance Trend & ML Insights
Visual dashboards presenting attendance trends, risk prediction, consistency analysis, and attentiveness metrics.

![Attendance Trend & ML Insights](screenshots/Classtrix/11.png)

---

### 12. Teacher Dashboard
Faculty dashboard providing access to attendance capture, attendance management, timetable, and analytics.

![Teacher Dashboard](screenshots/Classtrix/12.png)

---

### 13. Attendance Session Selection
Select department, semester, section, and active course before initiating attendance capture.

![Attendance Session Selection](screenshots/Classtrix/13.png)

---

### 14. Attendance Validation System
Automatically verifies timetable schedules and attendance eligibility based on active class timings.

![Attendance Validation System](screenshots/Classtrix/14.png)

---

### 15. Face Recognition Attendance Capture
Capture classroom images and process attendance using AI-based facial recognition technology.

![Face Recognition Attendance Capture](screenshots/Classtrix/15.png)

---

### 16. Attendance Review & Verification
Review detected students, attendance statistics, confidence scores, and attendance results before submission.

![Attendance Review & Verification](screenshots/Classtrix/16.png)

---

### 17. Attendance Record Management
View and modify attendance records with manual verification and correction capabilities.

![Attendance Record Management](screenshots/Classtrix/17.png)

---

### 18. Faculty Attendance Analytics Dashboard
Analyze attendance statistics across courses and identify academic performance trends.

![Faculty Attendance Analytics Dashboard](screenshots/Classtrix/18.png)

---

### 19. Attendance Risk Distribution Analysis
Visualize student attendance distribution and identify students at risk of attendance shortages.

![Attendance Risk Distribution Analysis](screenshots/Classtrix/19.png)

---

### 20. Machine Learning Academic Intelligence
Comprehensive analytics combining attendance trends, risk prediction, consistency analysis, and classroom engagement insights.

![Machine Learning Academic Intelligence](screenshots/Classtrix/20.png)

---

### 21. Student Attendance Analytics Report
Comprehensive student-wise attendance analysis displaying attendance percentage, ML-based risk prediction, trend analysis, consistency evaluation, and attentiveness insights across the selected course.

![Student Attendance Analytics Report](screenshots/Classtrix/21.png)

---

## Project Structure

```
Classtix/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Application pages
│   │   ├── hooks/           # Custom React hooks
│   │   └── lib/             # Utilities and store
├── server/                  # Node.js backend
│   ├── routes/              # API route handlers
│   ├── middleware/          # Auth middleware
│   ├── database/            # SQLite connection and schema
│   └── ml/                  # Python ML models
│       ├── main.py          # ML entry point
│       ├── model1_trend_analysis.py
│       ├── model2_risk_prediction.py
│       ├── model3_consistency_analysis.py
│       └── model4_attentiveness_analysis.py
├── package.json
└── vite.config.ts
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- Python 3.9+
- pip

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/classtix.git
cd classtix

# 2. Install Node.js dependencies
npm install

# 3. Set up Python environment
python -m venv myenv
myenv\Scripts\activate        # Windows
pip install tensorflow deepface opencv-python xgboost scikit-learn pandas numpy

# 4. Run the application
npm run dev
```

---

## ML Models

| Model | Purpose |
|---|---|
| Trend Analysis | Tracks attendance patterns over time |
| Risk Prediction | Identifies students at risk of low attendance |
| Consistency Analysis | Measures regularity of attendance behavior |
| Attentiveness Analysis | Evaluates classroom engagement levels |

---

## License

MIT License — free to use, modify, and distribute.

---

<p align="center">Built with ❤️ for smarter classrooms</p>

