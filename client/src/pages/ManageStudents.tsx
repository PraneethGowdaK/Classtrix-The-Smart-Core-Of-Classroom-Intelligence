import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Webcam from "react-webcam";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, RefreshCw, Camera, Save, Trash2, AlertCircle, Eye, EyeOff, Info, Calendar, UserPlus, User, Hash, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL, SEMESTERS, DEPARTMENTS, SECTIONS, getSubjectsByDepartments } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface TableStructure {
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: string | null;
  primaryKey: boolean;
}

interface TableData {
  structure: TableStructure[];
  data: any[];
  rowCount: number;
  error?: string;
}

interface StudentRegForm {
  name: string;
  usn: string;
  department: string;
  semester: string;
  subjects: string[];
  password: string;
  confirmPassword: string;
  email: string;
  phone_no: string;
}

export default function ManageStudents() {
  const [studentsTableData, setStudentsTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(false);
  const [studentRegistering, setStudentRegistering] = useState(false);
  const [checkingStudent, setCheckingStudent] = useState(false);
  const [studentVerified, setStudentVerified] = useState(false);
  const [selectedTab, setSelectedTab] = useState("view");
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [fetchingDepartments, setFetchingDepartments] = useState(false);
  
  // Filter state for View Students tab
  const [studentFilters, setStudentFilters] = useState({
    semester: "",
    department: "",
    section: "",
    enrollmentDate: ""
  });
  
  const { toast } = useToast();

  // Student registration form state
  const [studentRegForm, setStudentRegForm] = useState<StudentRegForm>({
    name: "",
    usn: "",
    department: "",
    semester: "",
    subjects: [],
    password: "",
    confirmPassword: "",
    email: "",
    phone_no: ""
  });

  // Form state for assigning students to semester
  const [assignStudentForm, setAssignStudentForm] = useState({
    usn: "",
    sectionId: [] as string[], // Changed to array for multiple sections
    semester: "",
    department: "",
    courseIds: [] as string[], // Store course IDs instead of subject names
    enrollmentYear: new Date().getFullYear().toString(),
    enrollmentMonth: "August"
  });

  // Dynamic options for assign semester tab
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [fetchingOptions, setFetchingOptions] = useState(false);

  // Edit student state
  const [editStudentUSN, setEditStudentUSN] = useState("");
  const [editStudentData, setEditStudentData] = useState<any>(null); // Original data from database
  const [editStudentFormData, setEditStudentFormData] = useState<any>(null); // Form data being edited
  const [searchingStudent, setSearchingStudent] = useState(false);
  const [updatingStudent, setUpdatingStudent] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);
  const [editCapturedImages, setEditCapturedImages] = useState<string[]>([]);
  const [editOriginalImages, setEditOriginalImages] = useState<string[]>([]);
  const [editImageSizes, setEditImageSizes] = useState<number[]>([]);
  const [editEnhancementModes, setEditEnhancementModes] = useState<number[]>([]);
  const [isEditCameraOpen, setIsEditCameraOpen] = useState(false);
  const [updatingImage, setUpdatingImage] = useState(false);
  const editWebcamRef = useRef<Webcam>(null);

  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [originalImages, setOriginalImages] = useState<string[]>([]);
  const [imageSizes, setImageSizes] = useState<number[]>([]);
  const [enhancementModes, setEnhancementModes] = useState<number[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [showStudentConfirmPassword, setShowStudentConfirmPassword] = useState(false);
  const webcamRef = useRef<Webcam>(null);

  // Get subjects based on selected semester and department
  const filteredSubjects = useMemo(() => {
    if (!studentRegForm.semester || !studentRegForm.department) {
      return [];
    }
    const subjectsByDept = getSubjectsByDepartments(studentRegForm.semester, [studentRegForm.department]);
    return subjectsByDept[studentRegForm.department] || [];
  }, [studentRegForm.semester, studentRegForm.department]);

  // Auto-populate subjects when semester/department changes
  const autoSelectedSubjects = useMemo(() => {
    return filteredSubjects;
  }, [filteredSubjects]);

  // Calculate semester type and completion date for assign student form
  const assignStudentEnrollmentInfo = useMemo(() => {
    const semesterType = assignStudentForm.enrollmentMonth === "August" ? "Odd" : "Even";
    const completionMonth = assignStudentForm.enrollmentMonth === "August" ? "December" : "June";
    const completionYear = assignStudentForm.enrollmentYear;
    
    // Create completion date in YYYY-MM-DD format (direct string, no Date object)
    // August enrollment → December 31st
    // February enrollment → June 30th
    const completionDate = assignStudentForm.enrollmentMonth === "August" 
      ? `${completionYear}-12-31`
      : `${completionYear}-06-30`;
    
    return {
      semesterType,
      completionMonth,
      completionYear,
      completionDate
    };
  }, [assignStudentForm.enrollmentMonth, assignStudentForm.enrollmentYear]);

  // Generate year options (present -1 year to future +6 years)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 1; i <= currentYear + 6; i++) {
      years.push(i.toString());
    }
    return years;
  }, []);

  // Fetch semesters when department changes
  useEffect(() => {
    if (assignStudentForm.department && studentVerified) {
      fetchAvailableSemesters(assignStudentForm.department);
      setAssignStudentForm(prev => ({ ...prev, semester: "", sectionId: [], courseIds: [] }));
      setAvailableSections([]);
      setAvailableCourses([]);
    }
  }, [assignStudentForm.department, studentVerified]);

  // Fetch sections when semester changes
  useEffect(() => {
    if (assignStudentForm.department && assignStudentForm.semester && studentVerified) {
      fetchAvailableSections(assignStudentForm.department, assignStudentForm.semester);
      setAssignStudentForm(prev => ({ ...prev, sectionId: [], courseIds: [] }));
      setAvailableCourses([]);
    }
  }, [assignStudentForm.department, assignStudentForm.semester, studentVerified]);

  // Fetch courses when section changes
  useEffect(() => {
    if (assignStudentForm.department && assignStudentForm.semester && assignStudentForm.sectionId.length > 0 && studentVerified) {
      fetchAvailableCourses(assignStudentForm.department, assignStudentForm.semester, assignStudentForm.sectionId);
      setAssignStudentForm(prev => ({ ...prev, courseIds: [] }));
    }
  }, [assignStudentForm.department, assignStudentForm.semester, assignStudentForm.sectionId, studentVerified]);

  useEffect(() => {
    // Refresh data and clear forms when tab changes
    if (selectedTab === "view") {
      fetchStudentsTableData();
    } else if (selectedTab === "register") {
      // Fetch departments for dropdown
      fetchAvailableDepartments();
      // Clear register form
      setStudentRegForm({
        name: "",
        usn: "",
        department: "",
        semester: "",
        subjects: [],
        password: "",
        confirmPassword: "",
        email: "",
        phone_no: ""
      });
      setCapturedImages([]);
      setOriginalImages([]);
      setImageSizes([]);
      setEnhancementModes([]);
      setIsCameraOpen(false);
      setShowStudentPassword(false);
      setShowStudentConfirmPassword(false);
    } else if (selectedTab === "assign") {
      // Clear assign student form
      setAssignStudentForm({
        usn: "",
        sectionId: [],
        semester: "",
        department: "",
        courseIds: [],
        enrollmentYear: new Date().getFullYear().toString(),
        enrollmentMonth: "August"
      });
      setStudentVerified(false);
      setAvailableSemesters([]);
      setAvailableSections([]);
      setAvailableCourses([]);
    } else if (selectedTab === "edit") {
      // Clear edit form
      setEditStudentUSN("");
      setEditStudentData(null);
      setEditStudentFormData(null);
      setEditCapturedImages([]);
      setEditOriginalImages([]);
      setEditImageSizes([]);
      setEditEnhancementModes([]);
      setIsEditCameraOpen(false);
      setShowEditPassword(false);
      setShowEditConfirmPassword(false);
    }
  }, [selectedTab]);

  const fetchStudentsTableData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      // Fetch student_enrollments table which has the enrollment data
      const response = await fetch(`${API_BASE_URL}/dbms-values/table/student_enrollments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const enrollmentData = await response.json();
      
      if (!enrollmentData.success) {
        throw new Error(enrollmentData.message || 'Failed to fetch enrollments');
      }

      // Now fetch students data to get names, emails, etc.
      const studentsResponse = await fetch(`${API_BASE_URL}/dbms-values/table/students`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const studentsData = await studentsResponse.json();

      // Fetch courses data to get course details
      const coursesResponse = await fetch(`${API_BASE_URL}/courses`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const coursesData = await coursesResponse.json();

      // Create lookup maps
      const studentsMap = new Map();
      if (studentsData.success && studentsData.data) {
        studentsData.data.forEach((s: any) => {
          studentsMap.set(s.id || s.ID, s);
        });
      }

      const coursesMap = new Map();
      if (coursesData.success && coursesData.subjects) {
        coursesData.subjects.forEach((c: any) => {
          coursesMap.set(c.id, c);
        });
      }

      // Join the data - filter out enrollments without valid student or course data
      const enrichedEnrollments = enrollmentData.data
        .map((enrollment: any) => {
          const studentId = enrollment.student_id || enrollment.STUDENT_ID;
          const courseId = enrollment.course_id || enrollment.COURSE_ID;
          
          const student = studentsMap.get(studentId);
          const course = coursesMap.get(courseId);

          // Skip if student or course not found
          if (!student || !course) {
            return null;
          }

          return {
            ...enrollment,
            usn: student.usn || student.USN,
            name: student.name || student.NAME,
            email: student.email || student.EMAIL,
            phone_no: student.phone_no || student.PHONE_NO,
            face_embeddings: student.face_embeddings || student.FACE_EMBEDDINGS,
            semester: course.semester,
            department: course.department,
            section: course.section,
            course_code: course.subject_code,
            course_name: course.subject_name
          };
        })
        .filter((enrollment: any) => enrollment !== null); // Remove null entries

      // Find students who are registered but not enrolled
      const enrolledStudentIds = new Set(enrichedEnrollments.map((e: any) => e.usn || e.USN));
      const registeredOnlyStudents = studentsData.success && studentsData.data 
        ? studentsData.data
            .filter((s: any) => !enrolledStudentIds.has(s.usn || s.USN))
            .map((s: any) => ({
              usn: s.usn || s.USN,
              name: s.name || s.NAME,
              email: s.email || s.EMAIL,
              phone_no: s.phone_no || s.PHONE_NO,
              department: s.department || s.DEPARTMENT,
              face_embeddings: s.face_embeddings || s.FACE_EMBEDDINGS,
              isRegisteredOnly: true
            }))
        : [];

      setStudentsTableData({
        structure: [],
        data: enrichedEnrollments,
        rowCount: enrichedEnrollments.length,
        registeredOnly: registeredOnlyStudents
      } as any);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      setStudentsTableData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableDepartments = async () => {
    setFetchingDepartments(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE_URL}/courses/departments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setAvailableDepartments(data.departments || []);
      } else {
        throw new Error(data.message || 'Failed to fetch departments');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setFetchingDepartments(false);
    }
  };

  // Fetch available semesters from courses table
  const fetchAvailableSemesters = async (department: string) => {
    setFetchingOptions(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE_URL}/courses/semesters?department=${department}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setAvailableSemesters(data.semesters || []);
      } else {
        throw new Error(data.message || 'Failed to fetch semesters');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setFetchingOptions(false);
    }
  };

  // Fetch available sections from courses table based on department and semester
  const fetchAvailableSections = async (department: string, semester: string) => {
    setFetchingOptions(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE_URL}/courses/sections?department=${department}&semester=${semester}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setAvailableSections(data.sections || []);
      } else {
        throw new Error(data.message || 'Failed to fetch sections');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setFetchingOptions(false);
    }
  };

  // Fetch available courses from courses table based on department, semester, and section(s)
  const fetchAvailableCourses = async (department: string, semester: string, sections: string[]) => {
    setFetchingOptions(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      // Fetch courses for all selected sections
      const allCourses: any[] = [];
      for (const section of sections) {
        const response = await fetch(`${API_BASE_URL}/courses/filtered?department=${department}&semester=${semester}&section=${section}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        if (data.success && data.courses) {
          allCourses.push(...data.courses);
        }
      }

      // Remove duplicates based on course id
      const uniqueCourses = allCourses.filter((course, index, self) =>
        index === self.findIndex((c) => c.id === course.id)
      );

      setAvailableCourses(uniqueCourses);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setFetchingOptions(false);
    }
  };

  // Group courses by section for display
  const getCoursesGroupedBySection = useMemo(() => {
    const grouped: { [section: string]: any[] } = {};
    
    availableCourses.forEach(course => {
      const section = course.section;
      if (!grouped[section]) {
        grouped[section] = [];
      }
      grouped[section].push(course);
    });
    
    return grouped;
  }, [availableCourses]);

  // Check if student exists and fetch department
  const handleCheckStudent = async () => {
    if (!assignStudentForm.usn.trim()) {
      toast({ title: "Error", description: "Please enter Student ID", variant: "destructive" });
      return;
    }

    setCheckingStudent(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast({ title: "Authentication Error", description: "Please login again.", variant: "destructive" });
        return;
      }

      const response = await fetch(`${API_BASE_URL}/students/get-by-usn/${assignStudentForm.usn}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success && data.student && data.student.department) {
        setAssignStudentForm(prev => ({ ...prev, department: data.student.department }));
        setStudentVerified(true);
        toast({
          title: "Success",
          description: `Student found. Department: ${data.student.department}`,
          className: "bg-success text-success-foreground"
        });
      } else {
        setStudentVerified(false);
        setAssignStudentForm(prev => ({ ...prev, department: "" }));
        toast({
          title: "Not Found",
          description: data.message || "Student ID not present in the student table",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error checking student:', error);
      setStudentVerified(false);
      setAssignStudentForm(prev => ({ ...prev, department: "" }));
      toast({
        title: "Error",
        description: "Failed to check student",
        variant: "destructive"
      });
    } finally {
      setCheckingStudent(false);
    }
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      // Always replace with the new image (limit to 1)
      setCapturedImages([imageSrc]);
    }
  }, [webcamRef]);

  const removeImage = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
    setOriginalImages(prev => prev.filter((_, i) => i !== index));
    setImageSizes(prev => prev.filter((_, i) => i !== index));
    setEnhancementModes(prev => prev.filter((_, i) => i !== index));
  };

  // Edit mode capture functions
  const editCapture = useCallback(() => {
    const imageSrc = editWebcamRef.current?.getScreenshot();
    if (imageSrc) {
      // Always replace with the new image (limit to 1)
      setEditCapturedImages([imageSrc]);
    }
  }, [editWebcamRef]);

  const removeEditImage = (index: number) => {
    setEditCapturedImages(prev => prev.filter((_, i) => i !== index));
    setEditOriginalImages(prev => prev.filter((_, i) => i !== index));
    setEditImageSizes(prev => prev.filter((_, i) => i !== index));
    setEditEnhancementModes(prev => prev.filter((_, i) => i !== index));
  };

  // ========== IMAGE ENHANCEMENT FUNCTIONS (copied from TakeAttendance) ==========
  
  // Helper to get image size
  const getImageSize = (base64: string): number => {
    const base64Length = base64.length - (base64.indexOf(',') + 1);
    const padding = (base64.charAt(base64.length - 2) === '=' ? 2 : (base64.charAt(base64.length - 1) === '=' ? 1 : 0));
    return (base64Length * 0.75) - padding;
  };

  // Helper to detect skin tone
  const detectSkinTone = (r: number, g: number, b: number): boolean => {
    const rgbCondition = (r > 60 && g > 30 && b > 15 && r > g && r > b && (r - g) > 10 && (r - b) > 10);
    const sum = r + g + b;
    if (sum === 0) return false;
    const rNorm = r / sum;
    const gNorm = g / sum;
    const normalizedCondition = (rNorm > 0.33 && rNorm < 0.50 && gNorm > 0.25 && gNorm < 0.40);
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    const ycbcrCondition = (y > 40 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173);
    return rgbCondition || normalizedCondition || ycbcrCondition;
  };

  // Mode 1: Balanced Enhancement
  const applyBalancedEnhancement = (imageData: ImageData, width: number, height: number): ImageData => {
    const output = new ImageData(width, height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      let r = imageData.data[i] + 15;
      let g = imageData.data[i + 1] + 15;
      let b = imageData.data[i + 2] + 15;
      r = (r - 128) * 1.1 + 128;
      g = (g - 128) * 1.1 + 128;
      b = (b - 128) * 1.1 + 128;
      output.data[i] = Math.min(255, Math.max(0, r));
      output.data[i + 1] = Math.min(255, Math.max(0, g));
      output.data[i + 2] = Math.min(255, Math.max(0, b));
      output.data[i + 3] = imageData.data[i + 3];
    }
    return output;
  };

  // Mode 2: Low Light Boost
  const applyLowLightBoost = (imageData: ImageData, width: number, height: number): ImageData => {
    const output = new ImageData(width, height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      let r = imageData.data[i] * 2.5 + 50;
      let g = imageData.data[i + 1] * 2.5 + 50;
      let b = imageData.data[i + 2] * 2.5 + 50;
      output.data[i] = Math.min(255, Math.max(0, r));
      output.data[i + 1] = Math.min(255, Math.max(0, g));
      output.data[i + 2] = Math.min(255, Math.max(0, b));
      output.data[i + 3] = imageData.data[i + 3];
    }
    return output;
  };

  // Mode 3: Warm & Natural
  const applyClaritySharpness = (imageData: ImageData, width: number, height: number): ImageData => {
    const output = new ImageData(width, height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      let r = (imageData.data[i] + 20) * 1.08;
      let g = (imageData.data[i + 1] + 20) * 1.04;
      let b = (imageData.data[i + 2] + 20) * 0.92;
      r = (r - 128) * 1.12 + 128;
      g = (g - 128) * 1.12 + 128;
      b = (b - 128) * 1.12 + 128;
      output.data[i] = Math.min(255, Math.max(0, r));
      output.data[i + 1] = Math.min(255, Math.max(0, g));
      output.data[i + 2] = Math.min(255, Math.max(0, b));
      output.data[i + 3] = imageData.data[i + 3];
    }
    return output;
  };

  // Mode 4: Color & Vibrance
  const applyColorVibrance = (imageData: ImageData, width: number, height: number): ImageData => {
    const output = new ImageData(width, height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      let r = imageData.data[i] - 8;
      let g = imageData.data[i + 1] - 8;
      let b = imageData.data[i + 2] - 8;
      r = (r - 128) * 1.12 + 128;
      g = (g - 128) * 1.12 + 128;
      b = (b - 128) * 1.12 + 128;
      const avg = (r + g + b) / 3;
      r = avg + (r - avg) * 1.3;
      g = avg + (g - avg) * 1.3;
      b = avg + (b - avg) * 1.3;
      output.data[i] = Math.min(255, Math.max(0, r));
      output.data[i + 1] = Math.min(255, Math.max(0, g));
      output.data[i + 2] = Math.min(255, Math.max(0, b));
      output.data[i + 3] = imageData.data[i + 3];
    }
    return output;
  };

  // Apply enhancement to image
  const applyEnhancement = (base64Image: string, mode: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64Image);
        
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        let enhanced;
        if (mode === 0) enhanced = applyBalancedEnhancement(imageData, canvas.width, canvas.height);
        else if (mode === 1) enhanced = applyLowLightBoost(imageData, canvas.width, canvas.height);
        else if (mode === 2) enhanced = applyClaritySharpness(imageData, canvas.width, canvas.height);
        else enhanced = applyColorVibrance(imageData, canvas.width, canvas.height);
        
        ctx.putImageData(enhanced, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.src = base64Image;
    });
  };

  // Handle enhance for Register Student gallery
  const handleEnhanceImage = async (index: number) => {
    const currentMode = enhancementModes[index] ?? -1;
    const nextMode = (currentMode + 1) % 4;
    const modeNames = ['✨ Balanced', '🌙 Low Light', '🔥 Warm & Natural', '🎨 Vibrant'];
    
    const originalImage = originalImages[index] || capturedImages[index];
    const enhanced = await applyEnhancement(originalImage, nextMode);
    
    setCapturedImages(prev => {
      const newImages = [...prev];
      newImages[index] = enhanced;
      return newImages;
    });
    
    if (!originalImages[index]) {
      setOriginalImages(prev => {
        const newOriginals = [...prev];
        newOriginals[index] = capturedImages[index];
        return newOriginals;
      });
    }
    
    setImageSizes(prev => {
      const newSizes = [...prev];
      newSizes[index] = getImageSize(enhanced);
      return newSizes;
    });
    
    setEnhancementModes(prev => {
      const newModes = [...prev];
      newModes[index] = nextMode;
      return newModes;
    });
    
    toast({
      title: `${modeNames[nextMode]} Applied`,
      description: `Mode ${nextMode + 1} of 4`
    });
  };

  // Handle reset for Register Student gallery
  const handleResetImage = (index: number) => {
    if (originalImages[index]) {
      setCapturedImages(prev => {
        const newImages = [...prev];
        newImages[index] = originalImages[index];
        return newImages;
      });
      setImageSizes(prev => {
        const newSizes = [...prev];
        newSizes[index] = getImageSize(originalImages[index]);
        return newSizes;
      });
      setEnhancementModes(prev => {
        const newModes = [...prev];
        newModes[index] = -1;
        return newModes;
      });
      toast({ title: "Image Reset", description: "Restored to original" });
    }
  };

  // Handle enhance for Edit Student gallery
  const handleEditEnhanceImage = async (index: number) => {
    const currentMode = editEnhancementModes[index] ?? -1;
    const nextMode = (currentMode + 1) % 4;
    const modeNames = ['✨ Balanced', '🌙 Low Light', '🔥 Warm & Natural', '🎨 Vibrant'];
    
    const originalImage = editOriginalImages[index] || editCapturedImages[index];
    const enhanced = await applyEnhancement(originalImage, nextMode);
    
    setEditCapturedImages(prev => {
      const newImages = [...prev];
      newImages[index] = enhanced;
      return newImages;
    });
    
    if (!editOriginalImages[index]) {
      setEditOriginalImages(prev => {
        const newOriginals = [...prev];
        newOriginals[index] = editCapturedImages[index];
        return newOriginals;
      });
    }
    
    setEditImageSizes(prev => {
      const newSizes = [...prev];
      newSizes[index] = getImageSize(enhanced);
      return newSizes;
    });
    
    setEditEnhancementModes(prev => {
      const newModes = [...prev];
      newModes[index] = nextMode;
      return newModes;
    });
    
    toast({
      title: `${modeNames[nextMode]} Applied`,
      description: `Mode ${nextMode + 1} of 4`
    });
  };

  // Handle reset for Edit Student gallery
  const handleEditResetImage = (index: number) => {
    if (editOriginalImages[index]) {
      setEditCapturedImages(prev => {
        const newImages = [...prev];
        newImages[index] = editOriginalImages[index];
        return newImages;
      });
      setEditImageSizes(prev => {
        const newSizes = [...prev];
        newSizes[index] = getImageSize(editOriginalImages[index]);
        return newSizes;
      });
      setEditEnhancementModes(prev => {
        const newModes = [...prev];
        newModes[index] = -1;
        return newModes;
      });
      toast({ title: "Image Reset", description: "Restored to original" });
    }
  };

  // ========== END OF ENHANCEMENT FUNCTIONS ==========

  // Handle image update
  const handleUpdateImage = async () => {
    if (editCapturedImages.length === 0) {
      toast({
        title: "Error",
        description: "Please capture an image first",
        variant: "destructive"
      });
      return;
    }

    setUpdatingImage(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast({ title: "Authentication Error", description: "Please login again.", variant: "destructive" });
        return;
      }

      // Get the captured image as base64
      const imageBase64 = editCapturedImages[0].split(',')[1]; // Remove data:image/jpeg;base64, prefix

      const response = await fetch(`${API_BASE_URL}/students/${editStudentData.usn}/update-image`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_base64: imageBase64,
          filename: 'face.jpg'
        })
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "Student image updated successfully"
        });
        
        // Refresh student data to show new image
        await handleSearchStudent(editStudentData.usn);
        
        // Clear edit capture state
        setEditCapturedImages([]);
        setIsEditCameraOpen(false);
      } else {
        toast({
          title: "Update Failed",
          description: result.message || "Failed to update image",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Image update error:', error);
      toast({
        title: "Network Error",
        description: "Failed to connect to server. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUpdatingImage(false);
    }
  };

  const handleCancelImageUpdate = () => {
    setEditCapturedImages([]);
    setIsEditCameraOpen(false);
  };

  const handleStudentRegSubmit = async () => {
    // Trim whitespace for validation
    const name = studentRegForm.name.trim();
    const usn = studentRegForm.usn.trim();
    const password = studentRegForm.password.trim();
    const confirmPassword = studentRegForm.confirmPassword.trim();
    const department = studentRegForm.department.trim();
    const email = studentRegForm.email.trim();
    const phone_no = studentRegForm.phone_no.trim();

    if (!name || !usn || !password || !confirmPassword || !department || !email || !phone_no) {
      const missingFields = [];
      if (!name) missingFields.push("Full Name");
      if (!usn) missingFields.push("Student ID");
      if (!password) missingFields.push("Password");
      if (!confirmPassword) missingFields.push("Confirm Password");
      if (!department) missingFields.push("Department");
      if (!email) missingFields.push("Email");
      if (!phone_no) missingFields.push("Phone Number");
      
      toast({ 
        title: "Error", 
        description: `Please fill in: ${missingFields.join(", ")}`, 
        variant: "destructive" 
      });
      return;
    }

    // Validate name length
    if (name.length < 3) {
      toast({ 
        title: "Invalid Name", 
        description: "Full Name must be at least 3 characters long", 
        variant: "destructive" 
      });
      return;
    }

    // Validate USN length
    if (usn.length < 3) {
      toast({ 
        title: "Invalid Student ID", 
        description: "Student ID (USN) must be at least 3 characters long", 
        variant: "destructive" 
      });
      return;
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      toast({ 
        title: "Password Mismatch", 
        description: "Passwords do not match. Please try again.", 
        variant: "destructive" 
      });
      return;
    }

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ 
        title: "Invalid Email", 
        description: "Please enter a valid email address", 
        variant: "destructive" 
      });
      return;
    }

    // Validate phone number
    if (!/^\d{10}$/.test(phone_no)) {
      toast({ 
        title: "Invalid Phone Number", 
        description: "Phone number must be exactly 10 digits", 
        variant: "destructive" 
      });
      return;
    }
    
    if (password.length < 6) {
      toast({ title: "Password Error", description: "Password must be at least 6 characters long.", variant: "destructive" });
      return;
    }

    if (capturedImages.length < 1) {
      toast({ title: "Photos Required", description: "Please capture at least 1 image.", variant: "destructive" });
      return;
    }

    setStudentRegistering(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast({ title: "Authentication Error", description: "Please login again.", variant: "destructive" });
        return;
      }

      // Get the first captured image as base64
      const imageBase64 = capturedImages[0].split(',')[1]; // Remove data:image/jpeg;base64, prefix

      const apiResponse = await fetch(`${API_BASE_URL}/students/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: studentRegForm.name,
          usn: studentRegForm.usn,
          department: studentRegForm.department,
          password: studentRegForm.password,
          email: studentRegForm.email,
          phone_no: studentRegForm.phone_no,
          image_base64: imageBase64,
          filename: 'face.jpg'
        })
      });

      const result = await apiResponse.json();

      if (apiResponse.ok) {
        toast({
          title: "Registration Successful",
          description: `${studentRegForm.name} has been registered successfully. Admin will assign semester and section.`,
          className: "bg-success text-success-foreground"
        });

        setStudentRegForm({ name: "", usn: "", department: "", semester: "", subjects: [], password: "", confirmPassword: "", email: "", phone_no: "" });
        setCapturedImages([]);
        setIsCameraOpen(false);
        
        // Refresh students table if it's loaded
        if (studentsTableData) {
          fetchStudentsTableData();
        }
      } else {
        toast({
          title: "Registration Failed",
          description: result.message || "Failed to register student.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: "Network Error",
        description: "Failed to connect to server. Please try again.",
        variant: "destructive"
      });
    } finally {
      setStudentRegistering(false);
    }
  };

  const handleAssignStudentSubmit = async () => {
    if (!assignStudentForm.usn || assignStudentForm.sectionId.length === 0 || !assignStudentForm.semester || !assignStudentForm.department) {
      toast({ title: "Error", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    if (assignStudentForm.courseIds.length === 0) {
      toast({ title: "Error", description: "Please select at least one course.", variant: "destructive" });
      return;
    }

    setStudentRegistering(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast({ title: "Authentication Error", description: "Please login again.", variant: "destructive" });
        setStudentRegistering(false);
        return;
      }

      // Pre-check: Verify if student already has enrollment for this date or semester
      const enrollmentDate = `${assignStudentForm.enrollmentYear}-${assignStudentForm.enrollmentMonth === "August" ? "08" : "02"}-01`;
      const enrollmentYearMonth = enrollmentDate.substring(0, 7); // Gets YYYY-MM

      // Check existing enrollments for this student
      const checkResponse = await fetch(`${API_BASE_URL}/students/${assignStudentForm.usn}/enrollments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (checkResponse.ok) {
        const checkResult = await checkResponse.json();
        const existingEnrollments = checkResult.enrollments || [];

        // Check 1: Same enrollment date (year-month)
        const duplicateDate = existingEnrollments.find((e: any) => 
          e.enrollment_date && e.enrollment_date.substring(0, 7) === enrollmentYearMonth
        );

        if (duplicateDate) {
          toast({
            title: "Enrollment Date Conflict",
            description: `Student is already enrolled for ${assignStudentForm.enrollmentMonth} ${assignStudentForm.enrollmentYear}. A student cannot have two semester enrollments at the same date.`,
            variant: "destructive"
          });
          setStudentRegistering(false);
          return;
        }

        // Check 2: Same semester
        const duplicateSemester = existingEnrollments.find((e: any) => 
          e.semester === parseInt(assignStudentForm.semester)
        );

        if (duplicateSemester) {
          toast({
            title: "Semester Already Enrolled",
            description: `Student is already enrolled in Semester ${assignStudentForm.semester}. A student cannot enroll in the same semester twice.`,
            variant: "destructive"
          });
          setStudentRegistering(false);
          return;
        }
      }

      const apiResponse = await fetch(`${API_BASE_URL}/students/assign-semester`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          usn: assignStudentForm.usn,
          semester: assignStudentForm.semester,
          department: assignStudentForm.department,
          courseIds: assignStudentForm.courseIds,
          enrollmentDate: enrollmentDate,
          completionDate: assignStudentEnrollmentInfo.completionDate
        })
      });

      const result = await apiResponse.json();

      if (apiResponse.ok) {
        toast({
          title: "Success",
          description: `Student enrolled in ${assignStudentForm.courseIds.length} course(s) successfully.`,
          className: "bg-success text-success-foreground"
        });

        setAssignStudentForm({ usn: "", sectionId: [], semester: "", department: "", courseIds: [], enrollmentYear: new Date().getFullYear().toString(), enrollmentMonth: "August" });
        setStudentVerified(false);
        
        // Refresh students table if it's loaded
        if (studentsTableData) {
          fetchStudentsTableData();
        }
      } else {
        toast({
          title: "Assignment Failed",
          description: result.message || "Failed to assign semester to student.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Assignment error:', error);
      toast({
        title: "Network Error",
        description: "Failed to connect to server. Please try again.",
        variant: "destructive"
      });
    } finally {
      setStudentRegistering(false);
    }
  };

  // Search student for editing
  const handleSearchStudent = async (usnToSearch?: string) => {
    const searchUSN = usnToSearch || editStudentUSN.trim();
    
    if (!searchUSN) {
      toast({
        title: "Error",
        description: "Please enter a USN to search",
        variant: "destructive"
      });
      return;
    }

    setSearchingStudent(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/students/${searchUSN}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (response.ok && result.student) {
        // Set original data (for display)
        setEditStudentData(result.student);
        // Set form data (for editing)
        setEditStudentFormData({
          ...result.student,
          password: '',
          confirmPassword: ''
        });
        // Only show toast if it's a manual search (not a refresh)
        if (!usnToSearch) {
          toast({
            title: "Student Found",
            description: `Found ${result.student.name}`
          });
        }
      } else {
        setEditStudentData(null);
        setEditStudentFormData(null);
        toast({
          title: "Not Found",
          description: result.message || "Student not found",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Error",
        description: "Failed to search student",
        variant: "destructive"
      });
    } finally {
      setSearchingStudent(false);
    }
  };

  // Update student information
  const handleUpdateStudent = async () => {
    if (!editStudentFormData) return;

    // Validation 1: Check required fields are not empty
    const name = editStudentFormData.name?.trim();
    const email = editStudentFormData.email?.trim();
    const phone_no = editStudentFormData.phone_no?.trim();

    if (!name || name.length < 3) {
      toast({
        title: "Invalid Name",
        description: "Full Name must be at least 3 characters long.",
        variant: "destructive"
      });
      return;
    }

    // Validation 2: Email format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    // Validation 3: Phone number (exactly 10 digits)
    if (!phone_no || !/^\d{10}$/.test(phone_no)) {
      toast({
        title: "Invalid Phone Number",
        description: "Phone number must be exactly 10 digits.",
        variant: "destructive"
      });
      return;
    }

    // Validation 4: Check if passwords match when password is being changed
    if (editStudentFormData.password && editStudentFormData.password.trim()) {
      if (editStudentFormData.password !== editStudentFormData.confirmPassword) {
        toast({
          title: "Password Mismatch",
          description: "Passwords do not match. Please try again.",
          variant: "destructive"
        });
        return;
      }

      if (editStudentFormData.password.length < 6) {
        toast({
          title: "Invalid Password",
          description: "Password must be at least 6 characters long.",
          variant: "destructive"
        });
        return;
      }
    }

    setUpdatingStudent(true);
    try {
      const token = localStorage.getItem('token');
      
      const updateData: any = {
        name: name,
        email: email,
        phone_no: phone_no
      };

      // Only include password if it's been changed
      if (editStudentFormData.password && editStudentFormData.password.trim()) {
        updateData.password = editStudentFormData.password;
      }

      const response = await fetch(`${API_BASE_URL}/students/${editStudentData.usn}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "Student information updated successfully"
        });
        
        // Refresh student data to show updated information
        await handleSearchStudent(editStudentData.usn);
        
        // Refresh students table if it's loaded
        if (studentsTableData) {
          fetchStudentsTableData();
        }
      } else {
        toast({
          title: "Update Failed",
          description: result.message || "Failed to update student",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Update error:', error);
      toast({
        title: "Error",
        description: "Failed to update student",
        variant: "destructive"
      });
    } finally {
      setUpdatingStudent(false);
    }
  };

  const formatValue = (value: any): string => {
    if (value === null) return 'NULL';
    if (value === undefined) return 'UNDEFINED';
    if (typeof value === 'string') {
      if (value.length > 100) {
        return value.substring(0, 100) + '...';
      }
      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed) && parsed.length > 3) {
            return `[${parsed.slice(0, 3).join(', ')}...] (${parsed.length} items)`;
          }
        } catch (e) {
          // Not valid JSON
        }
      }
    }
    return String(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Manage Students</h1>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="view">View Students</TabsTrigger>
          <TabsTrigger value="register">Register Student</TabsTrigger>
          <TabsTrigger value="assign">Assign Semester to Student</TabsTrigger>
          <TabsTrigger value="edit">Edit Students</TabsTrigger>
        </TabsList>

        {/* View Students Tab */}
        <TabsContent value="view" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Students</CardTitle>
            </CardHeader>
            <CardContent>
              {!studentsTableData ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground mb-4">Click to load student data</p>
                  <Button onClick={fetchStudentsTableData} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Load Students Data
                      </>
                    )}
                  </Button>
                </div>
              ) : studentsTableData.data.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No students in database</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="space-y-2">
                      <Label>Semester</Label>
                      <Select
                        value={studentFilters.semester || "all"}
                        onValueChange={(value) => setStudentFilters(prev => ({ ...prev, semester: value === "all" ? "" : value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Semesters" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Semesters</SelectItem>
                          {Array.from(new Set(studentsTableData.data.map((e: any) => 
                            (e.semester || e.SEMESTER)?.toString()
                          ).filter(Boolean))).sort().map(sem => (
                            <SelectItem key={sem} value={sem}>Semester {sem}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Select
                        value={studentFilters.department || "all"}
                        onValueChange={(value) => setStudentFilters(prev => ({ ...prev, department: value === "all" ? "" : value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Departments" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Departments</SelectItem>
                          {Array.from(new Set(studentsTableData.data.map((e: any) => 
                            e.department || e.DEPARTMENT
                          ).filter(Boolean))).sort().map(dept => (
                            <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Section</Label>
                      <Select
                        value={studentFilters.section || "all"}
                        onValueChange={(value) => setStudentFilters(prev => ({ ...prev, section: value === "all" ? "" : value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Sections" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sections</SelectItem>
                          {Array.from(new Set(studentsTableData.data.map((e: any) => 
                            e.section || e.SECTION
                          ).filter(Boolean))).sort().map(sec => (
                            <SelectItem key={sec} value={sec}>Section {sec}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Enrollment Date</Label>
                      <Select
                        value={studentFilters.enrollmentDate || "all"}
                        onValueChange={(value) => setStudentFilters(prev => ({ ...prev, enrollmentDate: value === "all" ? "" : value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Dates" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Dates</SelectItem>
                          {Array.from(new Set(studentsTableData.data.map((e: any) => 
                            e.enrollment_date || e.ENROLLMENT_DATE
                          ).filter(Boolean))).sort().reverse().map(date => (
                            <SelectItem key={date} value={date}>
                              {new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setStudentFilters({ semester: "", department: "", section: "", enrollmentDate: "" })}
                      >
                        Clear Filters
                      </Button>
                    </div>
                  </div>

                  {studentsTableData.data && studentsTableData.data.length > 0 ? (
                    // Group students by USN and filter enrollments
                    (Object.entries(
                      studentsTableData.data.reduce((acc, enrollment) => {
                        const usn = enrollment.usn || enrollment.USN || 'unknown';
                        if (!acc[usn]) {
                          acc[usn] = [];
                        }
                        acc[usn].push(enrollment);
                        return acc;
                      }, {} as Record<string, any[]>)
                    ) as [string, any[]][])
                    .map(([usn, enrollments]) => {
                      // Filter enrollments based on filters
                      const filteredEnrollments = enrollments.filter((enrollment: any) => {
                        if (studentFilters.semester && (enrollment.semester || enrollment.SEMESTER)?.toString() !== studentFilters.semester) {
                          return false;
                        }
                        if (studentFilters.department && (enrollment.department || enrollment.DEPARTMENT) !== studentFilters.department) {
                          return false;
                        }
                        if (studentFilters.section && (enrollment.section || enrollment.SECTION) !== studentFilters.section) {
                          return false;
                        }
                        if (studentFilters.enrollmentDate && (enrollment.enrollment_date || enrollment.ENROLLMENT_DATE) !== studentFilters.enrollmentDate) {
                          return false;
                        }
                        return true;
                      });

                      // Only show student if they have matching enrollments
                      if (filteredEnrollments.length === 0 && (studentFilters.semester || studentFilters.department || studentFilters.section || studentFilters.enrollmentDate)) {
                        return null;
                      }

                      const firstEnrollment = filteredEnrollments[0] || enrollments[0];
                      const name = firstEnrollment.name || firstEnrollment.NAME || '-';
                      const email = firstEnrollment.email || firstEnrollment.EMAIL || '-';
                      const phone = firstEnrollment.phone_no || firstEnrollment.PHONE_NO || '-';
                      const faceEmbeddings = firstEnrollment.face_embeddings || firstEnrollment.FACE_EMBEDDINGS;
                      
                      return (
                        <Card key={usn} className="overflow-hidden">
                          <CardContent className="p-5">
                            {/* Student Header */}
                            <div className="flex items-start justify-between mb-4 pb-4 border-b">
                              <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                  <Badge className="font-mono bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-100 hover:bg-cyan-200 dark:hover:bg-cyan-800">
                                    {usn}
                                  </Badge>
                                  <h3 className="text-lg font-semibold">{name}</h3>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground ml-1">
                                  <span>{email}</span>
                                  <span>{phone}</span>
                                </div>
                              </div>
                            </div>

                            {/* Student Details - Two Column Layout */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Left Column - Basic Info */}
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-sm font-medium text-muted-foreground mb-2 block">Student ID (USN)</Label>
                                  <p className="text-sm font-mono">{usn}</p>
                                </div>
                                <div>
                                  <Label className="text-sm font-medium text-muted-foreground mb-2 block">Name</Label>
                                  <p className="text-sm font-semibold">{name}</p>
                                </div>
                                {faceEmbeddings && (
                                  <div>
                                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">Face Recognition</Label>
                                    <Badge className="text-sm px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100">
                                      ✓ Enrolled
                                    </Badge>
                                  </div>
                                )}
                              </div>

                              {/* Right Column - Enrollments */}
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground mb-2 block">Enrollments</Label>
                                <div className="space-y-2">
                                  {filteredEnrollments.map((enrollment: any, idx: number) => (
                                    <div key={idx} className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                                      <div className="flex flex-wrap gap-2 mb-2">
                                        <Badge className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100">
                                          Sem {enrollment.semester || enrollment.SEMESTER || '-'}
                                        </Badge>
                                        <Badge className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100">
                                          {enrollment.department || enrollment.DEPARTMENT || '-'}
                                        </Badge>
                                        <Badge className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100">
                                          Sec {enrollment.section || enrollment.SECTION || '-'}
                                        </Badge>
                                      </div>
                                      <div className="mt-2">
                                        <div className="text-xs text-muted-foreground mb-1">Course:</div>
                                        <div className="text-xs bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded px-2 py-1">
                                          {enrollment.course_code || enrollment.COURSE_CODE || '-'} - {enrollment.course_name || enrollment.COURSE_NAME || '-'}
                                        </div>
                                      </div>
                                      <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                                        {(enrollment.enrollment_date || enrollment.ENROLLMENT_DATE) && (
                                          <span>
                                            📅 {new Date(enrollment.enrollment_date || enrollment.ENROLLMENT_DATE).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                                          </span>
                                        )}
                                        {(enrollment.completion_date || enrollment.COMPLETION_DATE) && (
                                          <span>
                                            → {new Date(enrollment.completion_date || enrollment.COMPLETION_DATE).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                    .filter((card: any) => card !== null)
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No student enrollments found</p>
                    </div>
                  )}

                  <div className="p-3 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
                    📊 Showing {(() => {
                      const filteredData = studentsTableData.data.filter((enrollment: any) => {
                        if (studentFilters.semester && (enrollment.semester || enrollment.SEMESTER)?.toString() !== studentFilters.semester) return false;
                        if (studentFilters.department && (enrollment.department || enrollment.DEPARTMENT) !== studentFilters.department) return false;
                        if (studentFilters.section && (enrollment.section || enrollment.SECTION) !== studentFilters.section) return false;
                        if (studentFilters.enrollmentDate && (enrollment.enrollment_date || enrollment.ENROLLMENT_DATE) !== studentFilters.enrollmentDate) return false;
                        return true;
                      });
                      const uniqueStudents = Object.keys(filteredData.reduce((acc: any, s: any) => ({ ...acc, [(s.usn || s.USN)]: true }), {})).length;
                      return `${filteredData.length} enrollment${filteredData.length !== 1 ? 's' : ''} (${uniqueStudents} unique student${uniqueStudents !== 1 ? 's' : ''})`;
                    })()}
                  </div>

                  {/* Registered Only Students Section */}
                  {(studentsTableData as any).registeredOnly && (studentsTableData as any).registeredOnly.length > 0 && (
                    <div className="mt-8 space-y-4">
                      <div className="flex items-center gap-2 border-t pt-6">
                        <h3 className="text-lg font-semibold">Registered Students (Not Yet Enrolled)</h3>
                        <Badge variant="secondary">{(studentsTableData as any).registeredOnly.length}</Badge>
                      </div>
                      
                      <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                          <p className="text-sm text-amber-700 dark:text-amber-300">
                            <strong>Note:</strong> These students are registered but have not been assigned to any semester yet. Use "Assign Semester to Student" tab to enroll them.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {(studentsTableData as any).registeredOnly.map((student: any, index: number) => (
                          <Card key={index} className="overflow-hidden">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <Badge className="font-mono bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-100">
                                    {student.usn}
                                  </Badge>
                                  <div>
                                    <p className="font-semibold">{student.name}</p>
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                      <span>{student.email || '-'}</span>
                                      <span>{student.phone_no || '-'}</span>
                                      {student.department && (
                                        <Badge className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100">
                                          {student.department}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {student.face_embeddings && (
                                    <Badge className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100">
                                      ✓ Face Enrolled
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs px-2 py-1 border-amber-300 text-amber-700 dark:text-amber-300">
                                    Not Enrolled
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Register Student Tab */}
        <TabsContent value="register" className="mt-4">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-primary">Student Registration</h2>
            </div>

            {/* Prerequisite Note */}
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Prerequisites</p>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Department courses must be registered through "Manage Courses" before students can be registered.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Student Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="student-name" className="text-sm font-medium">Full Name <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="student-name"
                        value={studentRegForm.name} 
                        onChange={e => setStudentRegForm({...studentRegForm, name: e.target.value})} 
                        placeholder="Enter student's full name"
                        className="pl-9 h-10"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Minimum 3 characters</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-usn" className="text-sm font-medium">Student ID (USN) <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="student-usn"
                        value={studentRegForm.usn} 
                        onChange={e => setStudentRegForm({...studentRegForm, usn: e.target.value})} 
                        placeholder="e.g. 1KT23CS001"
                        className="pl-9 h-10"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Minimum 3 characters</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-email" className="text-sm font-medium">Email <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <Input 
                        id="student-email"
                        type="email"
                        value={studentRegForm.email} 
                        onChange={e => setStudentRegForm({...studentRegForm, email: e.target.value})} 
                        placeholder="student@example.com"
                        className="pl-9 h-10"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Valid email format required</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-phone" className="text-sm font-medium">Phone Number <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <Input 
                        id="student-phone"
                        type="tel"
                        value={studentRegForm.phone_no} 
                        onChange={e => setStudentRegForm({...studentRegForm, phone_no: e.target.value.replace(/\D/g, '')})} 
                        placeholder="9876543210"
                        maxLength={10}
                        className="pl-9 h-10"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Enter 10-digit mobile number</p>
                  </div>
                  
                  {/* Security Note - Above Password Fields */}
                  <div className="flex items-start gap-2 text-sm text-muted-foreground bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <span className="text-amber-700 dark:text-amber-300 font-medium">
                      <strong>Note:</strong> This password should be entered by the student themselves for security purposes. Keep your password secure, do not share it with anyone, and do not forget it.
                    </span>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="student-password" className="text-sm font-medium">Password <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="student-password"
                        type={showStudentPassword ? "text" : "password"} 
                        value={studentRegForm.password} 
                        onChange={e => setStudentRegForm({...studentRegForm, password: e.target.value})} 
                        placeholder="Create a strong password"
                        className="pl-9 pr-10 h-10"
                        required
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                        <button
                          type="button"
                          onClick={() => setShowStudentPassword(!showStudentPassword)}
                          className="text-gray-400 hover:text-gray-600 focus:outline-none"
                        >
                          {showStudentPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Minimum 6 characters required</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-confirm-password" className="text-sm font-medium">Confirm Password <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="student-confirm-password"
                        type={showStudentConfirmPassword ? "text" : "password"} 
                        value={studentRegForm.confirmPassword} 
                        onChange={e => setStudentRegForm({...studentRegForm, confirmPassword: e.target.value})} 
                        placeholder="Confirm your password"
                        className="pl-9 pr-10 h-10"
                        required
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                        <button
                          type="button"
                          onClick={() => setShowStudentConfirmPassword(!showStudentConfirmPassword)}
                          className="text-gray-400 hover:text-gray-600 focus:outline-none"
                        >
                          {showStudentConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Must match password</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-department" className="text-sm font-medium">Department <span className="text-destructive">*</span></Label>
                    <Select value={studentRegForm.department} onValueChange={v => setStudentRegForm({...studentRegForm, department: v})} disabled={fetchingDepartments}>
                      <SelectTrigger id="student-department" className="h-10">
                        <SelectValue placeholder={fetchingDepartments ? "Loading departments..." : "Select Department"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDepartments && availableDepartments.length > 0 ? (
                          availableDepartments.map(dept => (
                            <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>No departments available - Register courses first</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Important Note - Below Department */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        <strong>Note:</strong> Students must be registered before the enrollment date. Semester and Section will be assigned later through "Assign Semester to Student" tab.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" variant={isCameraOpen ? "outline" : "default"} onClick={() => {
                      setIsCameraOpen(!isCameraOpen);
                      if (!isCameraOpen) {
                        setCapturedImages([]);
                      }
                    }}>
                      {isCameraOpen ? "Close Camera" : "Open Camera"}
                    </Button>
                    <Button 
                      className="flex-1" 
                      variant="outline"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const imageData = event.target?.result as string;
                              setCapturedImages([imageData]);
                              setIsCameraOpen(false);
                            };
                            reader.readAsDataURL(file);
                          }
                        };
                        input.click();
                      }}
                    >
                      Upload Image
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Face Capture</CardTitle>
                  <CardDescription className="flex items-start gap-2 font-medium bg-primary/5 p-3 rounded-md">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-green-700" />
                    <span className="text-foreground">
                      📸 <strong>Capture Requirements:</strong><br/>
                      • <strong>One high-quality image</strong> is required<br/>
                      • <strong>Face the camera directly</strong> with <strong>good lighting</strong><br/>
                      • Ensure <strong>clear visibility of facial features</strong><br/>
                      • Remove <strong>sunglasses/dark glasses, cap, hat, or mask</strong><br/>
                      • Avoid <strong>reflective glare</strong> on regular glasses<br/>
                      • Maintain <strong>neutral expression</strong><br/>
                      • Use camera for live capture or upload existing photo
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isCameraOpen && (
                    <div className="relative rounded-lg overflow-hidden bg-black aspect-video border-2 border-primary">
                      <Webcam 
                        ref={webcamRef}
                        className="w-full h-full object-cover"
                        audio={false}
                        screenshotFormat="image/jpeg"
                      />
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                        <Button 
                          onClick={capture} 
                          size="icon" 
                          className="h-12 w-12 rounded-full border-4 border-white shadow-lg bg-green-500 hover:bg-green-600 transition-all"
                        >
                          <Camera className="h-6 w-6 text-white" />
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4">
                    {capturedImages.map((img, idx) => (
                      <div key={idx} className="flex flex-col gap-2">
                        {/* Image container - Larger and flexible */}
                        <div className="relative rounded-md border bg-gray-100 min-h-[400px] max-h-[800px] h-auto">
                          <img src={img} className="w-full h-auto max-h-[750px] object-contain rounded-md" alt={`Captured face ${idx + 1}`} />
                          
                          {/* Delete button - top-right */}
                          <button 
                            onClick={() => removeImage(idx)} 
                            className="absolute bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors shadow-lg"
                            style={{ 
                              top: '12px', 
                              right: '12px',
                              padding: '6px',
                              zIndex: 10,
                              position: 'absolute'
                            }}
                            title="Delete Image"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        
                        {/* Action buttons - always visible below image */}
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEnhanceImage(idx)}
                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 shadow-sm"
                            title="Enhance Image"
                          >
                            <span>{enhancementModes[idx] === 0 ? '✨' : enhancementModes[idx] === 1 ? '🌙' : enhancementModes[idx] === 2 ? '🔥' : enhancementModes[idx] === 3 ? '🎨' : '✨'}</span>
                            <span>{enhancementModes[idx] === -1 || enhancementModes[idx] === undefined ? 'Enhance' : enhancementModes[idx] === 0 ? 'Balanced' : enhancementModes[idx] === 1 ? 'Low Light' : enhancementModes[idx] === 2 ? 'Warm' : 'Vibrant'}</span>
                          </button>
                          <button
                            onClick={() => handleResetImage(idx)}
                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 shadow-sm"
                            title="Reset to Original"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Reset
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="flex justify-end pt-6 border-t">
              <Button size="lg" className="w-full md:w-auto gap-2" onClick={handleStudentRegSubmit} disabled={studentRegistering}>
                {studentRegistering ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Save Student Record
                  </>
                )}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Assign Semester to Student Tab */}
        <TabsContent value="assign" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Assign Semester to Student</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Important Notes */}
                <div className="space-y-3">
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="flex gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Prerequisites</p>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          The student must be registered in the system before assigning semester.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex gap-3">
                      <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Important Notes</p>
                        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                          <li>Students must be assigned before the enrollment start date</li>
                          <li>Only registered courses for the selected department/semester/section will be available</li>
                          <li>Ensure courses are registered in the system before attempting to assign them</li>
                          <li>Each student can only be enrolled once per semester and enrollment period</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground border-b pb-2">Student Assignment</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="assign-usn">Student ID (USN) <span className="text-red-500">*</span></Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="assign-usn"
                          placeholder="Enter registered student ID"
                          className="pl-9"
                          value={assignStudentForm.usn}
                          onChange={(e) => setAssignStudentForm(prev => ({ ...prev, usn: e.target.value }))}
                          disabled={studentRegistering || checkingStudent || studentVerified}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleCheckStudent}
                        disabled={checkingStudent || !assignStudentForm.usn.trim()}
                        className="px-4"
                      >
                        {checkingStudent ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Check"
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Minimum 3 characters</p>
                  </div>
                  
                  {/* Show rest of form only after student is verified */}
                  {studentVerified && (
                  <>
                  {/* Enrollment Information */}
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Enrollment Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="assign-enrollment-year" className="text-sm font-medium">Enrollment Year <span className="text-red-500">*</span></Label>
                        <Select onValueChange={v => setAssignStudentForm(prev => ({ ...prev, enrollmentYear: v }))} value={assignStudentForm.enrollmentYear}>
                          <SelectTrigger id="assign-enrollment-year" className="h-10">
                            <SelectValue placeholder="Select Year" />
                          </SelectTrigger>
                          <SelectContent>
                            {yearOptions.map(year => (
                              <SelectItem key={year} value={year}>{year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="assign-enrollment-month" className="text-sm font-medium">Enrollment Month <span className="text-red-500">*</span></Label>
                        <Select onValueChange={v => setAssignStudentForm(prev => ({ ...prev, enrollmentMonth: v }))} value={assignStudentForm.enrollmentMonth}>
                          <SelectTrigger id="assign-enrollment-month" className="h-10">
                            <SelectValue placeholder="Select Month" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="August">August</SelectItem>
                            <SelectItem value="February">February</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {/* Summary Box */}
                    <div className="mt-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">Semester Type</p>
                          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{assignStudentEnrollmentInfo.semesterType}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">Enrollment Date</p>
                          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{assignStudentEnrollmentInfo.completionDate.substring(0, 7) === `${assignStudentForm.enrollmentYear}-08` ? `${assignStudentForm.enrollmentYear}-08-01` : `${assignStudentForm.enrollmentYear}-02-01`}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">Completion Date</p>
                          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{assignStudentEnrollmentInfo.completionDate}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="assign-semester" className="text-sm font-medium">Semester <span className="text-red-500">*</span></Label>
                      <Select onValueChange={v => setAssignStudentForm(prev => ({ ...prev, semester: v }))} value={assignStudentForm.semester} disabled={!assignStudentForm.department || fetchingOptions}>
                        <SelectTrigger id="assign-semester" className="h-10">
                          <SelectValue placeholder={fetchingOptions ? "Loading..." : (assignStudentForm.department ? "Select Semester" : "Select Department First")} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSemesters.length > 0 ? (
                            availableSemesters.map(s => (
                              <SelectItem key={s} value={s}>Semester {s}</SelectItem>
                            ))
                          ) : (
                            <SelectItem value="none" disabled>No semesters available for {assignStudentForm.department}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Sections Selection */}
                    <div className="space-y-3 border-t pt-4">
                      <div className="flex items-center gap-2">
                        <Label className="text-base font-semibold">Section(s)</Label>
                        {assignStudentForm.sectionId.length === 0 && (
                          <div className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                            <span className="text-xs font-medium text-red-700 dark:text-red-300">Required</span>
                          </div>
                        )}
                      </div>
                      <div className="bg-muted/30 p-4 rounded-lg border">
                        {availableSections.length > 0 ? (
                          <div className="grid grid-cols-4 gap-4">
                            {availableSections.map(sec => (
                              <div key={sec} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`section-${sec}`}
                                  checked={assignStudentForm.sectionId.includes(sec)}
                                  onCheckedChange={(checked) => {
                                    setAssignStudentForm(prev => ({
                                      ...prev,
                                      sectionId: checked
                                        ? [...prev.sectionId, sec]
                                        : prev.sectionId.filter(s => s !== sec)
                                    }));
                                  }}
                                  disabled={!assignStudentForm.semester || fetchingOptions}
                                />
                                <Label htmlFor={`section-${sec}`} className="text-sm font-normal cursor-pointer">
                                  Section {sec}
                                </Label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            {assignStudentForm.semester ? "No sections available for Semester " + assignStudentForm.semester : "Select semester first"}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Select one or more sections (e.g., B1, B2 in B section)</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="assign-department" className="text-sm font-medium">Department (Locked) <span className="text-red-500">*</span></Label>
                    <Select value={assignStudentForm.department}>
                      <SelectTrigger id="assign-department" className="h-10" disabled>
                        <SelectValue placeholder={assignStudentForm.department || "Department will auto-fill after checking student"} />
                      </SelectTrigger>
                      <SelectContent>
                        {assignStudentForm.department ? (
                          <SelectItem value={assignStudentForm.department}>{assignStudentForm.department}</SelectItem>
                        ) : (
                          <SelectItem value="none" disabled>No department selected</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Department is locked and auto-assigned based on student record</p>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Select Courses <span className="text-red-500">*</span></Label>
                    {availableCourses.length === 0 ? (
                      <div className="text-center py-8 bg-muted/30 rounded-lg border">
                        <p className="text-sm text-muted-foreground">
                          {assignStudentForm.sectionId.length > 0 ? "No courses available for selected semester and section(s)" : "Select semester and section(s) first"}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {Object.entries(getCoursesGroupedBySection).map(([section, courses]) => {
                          const sectionCourseIds = courses.map(c => c.id.toString());
                          const selectedCount = sectionCourseIds.filter(id => assignStudentForm.courseIds.includes(id)).length;
                          
                          return (
                            <div key={section} className="border rounded bg-white dark:bg-slate-950 overflow-hidden">
                              {/* Section Header */}
                              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 px-3 py-2 border-b border-blue-200 dark:border-blue-800">
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                                    Section {section}
                                  </Badge>
                                  {selectedCount === 0 && (
                                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Select at least one</span>
                                  )}
                                  {selectedCount > 0 && (
                                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">✓ {selectedCount} selected</span>
                                  )}
                                </div>
                              </div>

                              {/* Courses Table */}
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-blue-25 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-semibold w-10 group">
                                        <div className="transition-transform duration-200 group-hover:scale-125">
                                          <Checkbox
                                            checked={courses.length > 0 && courses.every(c => assignStudentForm.courseIds.includes(c.id.toString()))}
                                            onCheckedChange={(checked) => {
                                              if (checked) {
                                                setAssignStudentForm(prev => ({
                                                  ...prev,
                                                  courseIds: [...new Set([...prev.courseIds, ...sectionCourseIds])]
                                                }));
                                              } else {
                                                setAssignStudentForm(prev => ({
                                                  ...prev,
                                                  courseIds: prev.courseIds.filter(id => !sectionCourseIds.includes(id))
                                                }));
                                              }
                                            }}
                                          />
                                        </div>
                                      </th>
                                      <th className="px-3 py-2 text-left font-semibold text-blue-700 dark:text-blue-300">Code</th>
                                      <th className="px-3 py-2 text-left font-semibold text-blue-700 dark:text-blue-300">Course Name</th>
                                      <th className="px-3 py-2 text-center font-semibold w-16 text-blue-700 dark:text-blue-300">Credits</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {courses.map((course) => {
                                      const isSelected = assignStudentForm.courseIds.includes(course.id.toString());
                                      return (
                                        <tr
                                          key={course.id}
                                          className={`border-b transition-colors group ${
                                            isSelected 
                                              ? 'bg-blue-50 dark:bg-blue-950/30' 
                                              : ''
                                          }`}
                                          onClick={() => {
                                            if (isSelected) {
                                              setAssignStudentForm(prev => ({
                                                ...prev,
                                                courseIds: prev.courseIds.filter(id => id !== course.id.toString())
                                              }));
                                            } else {
                                              setAssignStudentForm(prev => ({
                                                ...prev,
                                                courseIds: [...prev.courseIds, course.id.toString()]
                                              }));
                                            }
                                          }}
                                        >
                                          <td className="px-3 py-2">
                                            <div className="transition-transform duration-200 group-hover:scale-125">
                                              <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => {}}
                                              />
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 font-mono font-semibold text-slate-900 dark:text-slate-100">{course.course_code}</td>
                                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{course.course_name}</td>
                                          <td className="px-3 py-2 text-center text-slate-700 dark:text-slate-300">{course.credits}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">Select courses for the student to enroll in. Courses are grouped by section.</p>
                  </div>
                  </>
                  )}

                  {/* Show message if not verified yet */}
                  {!studentVerified && !checkingStudent && (
                    <div className="text-center py-8 text-muted-foreground">
                      <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Enter a Student ID and click "Check" to verify and continue</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-6 border-t">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setAssignStudentForm({
                          usn: "",
                          sectionId: [],
                          semester: "",
                          department: "",
                          courseIds: [],
                          enrollmentYear: new Date().getFullYear().toString(),
                          enrollmentMonth: "August"
                        });
                        setStudentVerified(false);
                      }}
                      disabled={studentRegistering}
                    >
                      Cancel
                    </Button>
                    <Button size="lg" className="gap-2" onClick={handleAssignStudentSubmit} disabled={studentRegistering}>
                      {studentRegistering ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Assigning...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" /> Assign Semester to Student
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Edit Students Tab */}
        <TabsContent value="edit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Edit Student Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Informational Note at Top */}
              <div className="mb-6">
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                        Prerequisites
                      </p>
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        The student must be registered in the system to edit their details. Enter the Student USN and fetch their information first.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Fetch Student Section */}
                <div className="space-y-4 pb-6 border-b">
                  <div className="space-y-2">
                    <Label htmlFor="edit-usn">Student USN</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="edit-usn"
                          placeholder="Enter registered student USN"
                          className="pl-9"
                          value={editStudentUSN}
                          onChange={(e) => {
                            setEditStudentUSN(e.target.value);
                            setEditStudentData(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (editStudentUSN.trim()) {
                                handleSearchStudent();
                              }
                            }
                          }}
                          disabled={searchingStudent || editStudentData !== null}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={() => handleSearchStudent()}
                        disabled={searchingStudent || !editStudentUSN.trim()}
                      >
                        {searchingStudent ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Fetching...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Fetch Details
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Student Info Display - Only show after fetching */}
                {editStudentData && (
                  <>
                    {/* Current Student Information (Read-only) */}
                    <div className="space-y-4 pb-6 border-b">
                      <h3 className="text-lg font-semibold text-foreground">Current Student Information</h3>
                      <div className="bg-muted/30 p-4 rounded-lg border">
                        <div className="flex flex-col md:flex-row gap-6">
                          {/* Left Side - Student Image */}
                          <div className="flex-shrink-0">
                            <Label className="text-xs text-muted-foreground mb-2 block">Current Photo</Label>
                            <div className="relative w-64 h-64 rounded-lg overflow-hidden border-2 border-primary/20 bg-gray-100">
                              {editStudentData.captured_image_path ? (
                                <img 
                                  src={`/uploads/students/${editStudentData.captured_image_path.split(/[/\\]/).pop()}`}
                                  alt={editStudentData.name}
                                  className="w-full h-full object-contain p-1"
                                  onLoad={() => console.log('✅ Image loaded successfully:', editStudentData.captured_image_path.split(/[/\\]/).pop())}
                                  onError={(e) => {
                                    const filename = editStudentData.captured_image_path.split(/[/\\]/).pop();
                                    console.error('❌ Image load error');
                                    console.error('Attempted URL:', `/uploads/students/${filename}`);
                                    console.error('Filename:', filename);
                                    console.error('Full path from DB:', editStudentData.captured_image_path);
                                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-muted">
                                  <span className="text-muted-foreground text-sm">No photo</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right Side - Student Details */}
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">USN</Label>
                              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
                                <Info className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono font-semibold">{editStudentData.usn}</span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Full Name</Label>
                              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
                                <UserPlus className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{editStudentData.name}</span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Department</Label>
                              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
                                <Info className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{editStudentData.department}</span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Email</Label>
                              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
                                <Info className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{editStudentData.email || 'Not provided'}</span>
                              </div>
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <Label className="text-xs text-muted-foreground">Phone Number</Label>
                              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
                                <Info className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{editStudentData.phone_no || 'Not provided'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Update Information Section */}
                    <div className="space-y-4 pb-6 border-b">
                      <h3 className="text-lg font-semibold text-foreground">Update Information</h3>
                      
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
                        <p className="text-sm text-blue-900 dark:text-blue-100">
                          <strong>Note:</strong> USN cannot be changed. Modify the fields below to update student information.
                        </p>
                      </div>

                      {/* Name */}
                      <div className="space-y-2">
                        <Label htmlFor="edit-student-name">Full Name <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <UserPlus className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="edit-student-name"
                            placeholder="Enter full name"
                            className="pl-9"
                            value={editStudentFormData.name}
                            onChange={(e) => setEditStudentFormData({ ...editStudentFormData, name: e.target.value })}
                            required
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Minimum 3 characters</p>
                      </div>

                      {/* Email */}
                      <div className="space-y-2">
                        <Label htmlFor="edit-student-email">Email <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <Input
                            id="edit-student-email"
                            type="email"
                            placeholder="student@example.com"
                            className="pl-9"
                            value={editStudentFormData.email || ''}
                            onChange={(e) => setEditStudentFormData({ ...editStudentFormData, email: e.target.value })}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Valid email format required</p>
                      </div>

                      {/* Phone Number */}
                      <div className="space-y-2">
                        <Label htmlFor="edit-student-phone">Phone Number <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <Input
                            id="edit-student-phone"
                            type="tel"
                            placeholder="9876543210"
                            maxLength={10}
                            className="pl-9"
                            value={editStudentFormData.phone_no || ''}
                            onChange={(e) => setEditStudentFormData({ ...editStudentFormData, phone_no: e.target.value.replace(/\D/g, '') })}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Exactly 10 digits</p>
                      </div>

                      {/* Security Note - Above Password Fields */}
                      <div className="flex items-start gap-2 text-sm text-muted-foreground bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <span className="text-amber-700 dark:text-amber-300 font-medium">
                          <strong>Note:</strong> This password should be entered by the student themselves for security purposes. Keep your password secure, do not share it with anyone, and do not forget it.
                        </span>
                      </div>

                      {/* Password */}
                      <div className="space-y-2">
                        <Label htmlFor="edit-student-password">New Password (Optional)</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="edit-student-password"
                            type={showEditPassword ? "text" : "password"}
                            placeholder="Leave blank to keep current password"
                            className="pl-9 pr-10"
                            value={editStudentFormData.password || ''}
                            onChange={(e) => setEditStudentFormData({ ...editStudentFormData, password: e.target.value })}
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            <button
                              type="button"
                              onClick={() => setShowEditPassword(!showEditPassword)}
                              className="text-gray-400 hover:text-gray-600 focus:outline-none"
                            >
                              {showEditPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Minimum 6 characters. Leave blank to keep current password.</p>
                      </div>

                      {/* Confirm Password */}
                      <div className="space-y-2">
                        <Label htmlFor="edit-student-confirm-password">Confirm New Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="edit-student-confirm-password"
                            type={showEditConfirmPassword ? "text" : "password"}
                            placeholder="Re-enter new password"
                            className="pl-9 pr-10"
                            value={editStudentFormData.confirmPassword || ''}
                            onChange={(e) => setEditStudentFormData({ ...editStudentFormData, confirmPassword: e.target.value })}
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            <button
                              type="button"
                              onClick={() => setShowEditConfirmPassword(!showEditConfirmPassword)}
                              className="text-gray-400 hover:text-gray-600 focus:outline-none"
                            >
                              {showEditConfirmPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Must match password</p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-end gap-2 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditStudentData(null);
                            setEditStudentFormData(null);
                            setEditStudentUSN("");
                            setShowEditPassword(false);
                            setShowEditConfirmPassword(false);
                            setEditCapturedImages([]);
                            setIsEditCameraOpen(false);
                          }}
                          disabled={updatingStudent}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={handleUpdateStudent}
                          disabled={updatingStudent}
                        >
                          {updatingStudent ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Update Student
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Update Student Photo Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground">Update Student Photo</h3>
                      
                      <Card>
                        <CardHeader>
                          <CardTitle>Face Capture</CardTitle>
                          <CardDescription className="flex items-start gap-2 font-medium bg-primary/5 p-3 rounded-md">
                            <Info className="h-4 w-4 shrink-0 mt-0.5 text-green-700" />
                            <span className="text-foreground">
                              📸 <strong>Capture Requirements:</strong><br/>
                              • <strong>One high-quality image</strong> is required<br/>
                              • <strong>Face the camera directly</strong> with <strong>good lighting</strong><br/>
                              • Ensure <strong>clear visibility of facial features</strong><br/>
                              • Remove <strong>sunglasses/dark glasses, cap, hat, or mask</strong><br/>
                              • Avoid <strong>reflective glare</strong> on regular glasses<br/>
                              • Maintain <strong>neutral expression</strong><br/>
                              • Use camera for live capture or upload existing photo
                            </span>
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {isEditCameraOpen && (
                            <div className="relative rounded-lg overflow-hidden bg-black aspect-video border-2 border-primary">
                              <Webcam 
                                ref={editWebcamRef}
                                className="w-full h-full object-cover"
                                audio={false}
                                screenshotFormat="image/jpeg"
                              />
                              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                                <Button 
                                  onClick={editCapture} 
                                  size="icon" 
                                  className="h-12 w-12 rounded-full border-4 border-white shadow-lg bg-green-500 hover:bg-green-600 transition-all"
                                >
                                  <Camera className="h-6 w-6 text-white" />
                                </Button>
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-1 gap-4">
                            {editCapturedImages.map((img, idx) => (
                              <div key={idx} className="flex flex-col gap-2">
                                {/* Image container - Larger and flexible */}
                                <div className="relative rounded-md border bg-gray-100 min-h-[400px] max-h-[800px] h-auto">
                                  <img src={img} className="w-full h-auto max-h-[750px] object-contain rounded-md" alt={`Captured face ${idx + 1}`} />
                                  
                                  {/* Delete button - top-right */}
                                  <button 
                                    onClick={() => removeEditImage(idx)} 
                                    className="absolute bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors shadow-lg"
                                    style={{ 
                                      top: '12px', 
                                      right: '12px',
                                      padding: '6px',
                                      zIndex: 10,
                                      position: 'absolute'
                                    }}
                                    title="Delete Image"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                                
                                {/* Action buttons - always visible below image */}
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleEditEnhanceImage(idx)}
                                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 shadow-sm"
                                    title="Enhance Image"
                                  >
                                    <span>{editEnhancementModes[idx] === 0 ? '✨' : editEnhancementModes[idx] === 1 ? '🌙' : editEnhancementModes[idx] === 2 ? '🔥' : editEnhancementModes[idx] === 3 ? '🎨' : '✨'}</span>
                                    <span>{editEnhancementModes[idx] === -1 || editEnhancementModes[idx] === undefined ? 'Enhance' : editEnhancementModes[idx] === 0 ? 'Balanced' : editEnhancementModes[idx] === 1 ? 'Low Light' : editEnhancementModes[idx] === 2 ? 'Warm' : 'Vibrant'}</span>
                                  </button>
                                  <button
                                    onClick={() => handleEditResetImage(idx)}
                                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 shadow-sm"
                                    title="Reset to Original"
                                  >
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Reset
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setIsEditCameraOpen(!isEditCameraOpen)}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <Camera className="h-3.5 w-3.5 mr-1.5" />
                              {isEditCameraOpen ? "Close Camera" : "Open Camera"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => document.getElementById('edit-image-upload')?.click()}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Upload Photo
                            </Button>
                            <input
                              id="edit-image-upload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setEditCapturedImages([reader.result as string]);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </div>

                          <div className="flex justify-end pt-4 border-t">
                            <Button
                              type="button"
                              onClick={handleUpdateImage}
                              disabled={updatingImage || editCapturedImages.length === 0}
                            >
                              {updatingImage ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Updating...
                                </>
                              ) : (
                                <>
                                  <Save className="h-4 w-4 mr-2" />
                                  Submit New Photo
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}

                {/* Empty State - Show when no student is fetched */}
                {!editStudentData && !searchingStudent && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Info className="h-8 w-8 mx-auto mb-2" />
                    <p>Search for a student to edit their information</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
