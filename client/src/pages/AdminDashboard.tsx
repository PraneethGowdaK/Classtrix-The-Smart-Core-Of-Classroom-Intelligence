import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Users, BookOpen, Calendar, BarChart3, AlertCircle, Database, RefreshCw, Table as TableIcon, UserPlus, Hash, Lock, Eye, EyeOff, Mail, Phone, Info, GraduationCap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL, SEMESTERS, DEPARTMENTS, SECTIONS, getSubjectsByDepartments } from "@/lib/constants";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DashboardStats {
  approvedTeacherIds: number;
  registeredTeachers: number;
  totalStudents: number;
  totalSessions: number;
}

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

interface DbmsData {
  success: boolean;
  summary: {
    totalTables: number;
    totalRows: number;
    timestamp: string;
    user: string;
  };
  tables: Record<string, TableData>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dbmsData, setDbmsData] = useState<DbmsData | null>(null);
  const [teachersTableData, setTeachersTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbmsLoading, setDbmsLoading] = useState(false);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [selectedTab, setSelectedTab] = useState("teachers");
  
  // Filter state for View Teachers tab
  const [teacherFilters, setTeacherFilters] = useState({
    semester: "",
    department: "",
    section: "",
    enrollmentDate: ""
  });
  
  // Pagination state for View Teachers tab
  const [teacherPage, setTeacherPage] = useState(1);
  const teachersPerPage = 10;
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictData, setConflictData] = useState<any>(null);
  const [pendingAssignment, setPendingAssignment] = useState<any>(null);
  const { toast } = useToast();

  // Form state for editing teacher
  const [editTeacherForm, setEditTeacherForm] = useState({
    teacherId: "",
    name: "",
    email: "",
    phone_no: "",
    password: "",
    confirmPassword: ""
  });
  const [editTeacherData, setEditTeacherData] = useState<any>(null); // Original data from database (for display)
  const [teacherFetched, setTeacherFetched] = useState(false);
  const [fetchingTeacher, setFetchingTeacher] = useState(false);
  const [updatingTeacher, setUpdatingTeacher] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);

  // Form state for registering teacher
  const [teacherRegForm, setTeacherRegForm] = useState({
    name: "",
    teacherId: "",
    email: "",
    phone_no: "",
    password: "",
    confirmPassword: "",
    semesters: [] as string[],
    departments: [] as string[],
    sections: [] as string[],
    subjects: [] as string[],
    enrollmentYear: new Date().getFullYear().toString(),
    enrollmentMonth: "August"
  });

  // Form state for assigning courses to teachers
  const [assignCoursesForm, setAssignCoursesForm] = useState({
    teacherId: "",
    enrollmentYear: new Date().getFullYear().toString(),
    enrollmentMonth: "August",
    semesterType: "",
    selectedSemesters: [] as string[],
    selectedDepartments: [] as string[],
    selectedSections: [] as string[],
    selectedCourseIds: [] as number[]
  });

  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<any[]>([]);
  const [fetchingCourses, setFetchingCourses] = useState(false);

  // State for assign subjects to teachers
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [filteredSubjects, setFilteredSubjects] = useState<any[]>([]);
  const [fetchingSubjects, setFetchingSubjects] = useState(false);
  
  const [assignSubjectsForm, setAssignSubjectsForm] = useState({
    teacherId: "",
    enrollmentYear: new Date().getFullYear().toString(),
    enrollmentMonth: "August",
    selectedSemesters: [] as string[],
    selectedDepartments: [] as string[],
    selectedSections: [] as string[],
    selectedSubjectsByCombo: {} as Record<string, number[]> // Key: "sem-dept-sec", Value: subject IDs
  });

  // Calculate semester type and completion date based on enrollment month
  const teacherEnrollmentInfo = useMemo(() => {
    const semesterType = teacherRegForm.enrollmentMonth === "August" ? "Odd" : "Even";
    const completionMonth = teacherRegForm.enrollmentMonth === "August" ? "December" : "June";
    const completionYear = teacherRegForm.enrollmentYear;
    
    // Create completion date - last day of the month
    // December = month 12, June = month 6 (1-indexed for YYYY-MM-DD format)
    const monthNum = completionMonth === "December" ? "12" : "06";
    const lastDay = completionMonth === "December" ? "31" : "30";
    const completionDate = `${completionYear}-${monthNum}-${lastDay}`;
    
    return {
      semesterType,
      completionMonth,
      completionYear,
      completionDate
    };
  }, [teacherRegForm.enrollmentMonth, teacherRegForm.enrollmentYear]);

  // Generate year options (present -1 year to future +6 years)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 1; i <= currentYear + 6; i++) {
      years.push(i.toString());
    }
    return years;
  }, []);

  // Get subjects based on selected semesters and departments
  const filteredTeacherSubjects = useMemo(() => {
    if (teacherRegForm.semesters.length === 0 || teacherRegForm.departments.length === 0) {
      return {};
    }
    
    // Get subjects for ALL selected semesters
    const result: Record<string, Record<string, string[]>> = {};
    
    teacherRegForm.semesters.forEach(semester => {
      const subjectsByDept = getSubjectsByDepartments(semester, teacherRegForm.departments);
      result[semester] = subjectsByDept;
    });
    
    return result;
  }, [teacherRegForm.semesters, teacherRegForm.departments]);



  useEffect(() => {
    fetchData();
    // Fetch all courses on component mount
    const fetchAllCourses = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/courses/filtered`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setAvailableCourses(data.courses || []);
          }
        }
      } catch (err) {
        console.error('Error fetching courses:', err);
      }
    };
    fetchAllCourses();
    
    // Fetch all subjects for assign subjects tab
    fetchAllSubjects();
  }, []);

  useEffect(() => {
    // Refresh data and clear forms when tab changes
    if (selectedTab === "teachers") {
      fetchTeachersTableData();
    } else if (selectedTab === "register") {
      // Clear register form
      setTeacherRegForm({
        name: "",
        teacherId: "",
        email: "",
        phone_no: "",
        password: "",
        confirmPassword: "",
        semesters: [],
        departments: [],
        sections: [],
        subjects: [],
        enrollmentYear: new Date().getFullYear().toString(),
        enrollmentMonth: "August"
      });
      setShowPassword(false);
      setShowConfirmPassword(false);
    } else if (selectedTab === "assign") {
      fetchAllSubjects();
      // Clear assign subjects form
      setAssignSubjectsForm({
        teacherId: "",
        enrollmentYear: new Date().getFullYear().toString(),
        enrollmentMonth: "August",
        selectedSemesters: [],
        selectedDepartments: [],
        selectedSections: [],
        selectedSubjectsByCombo: {}
      });
    } else if (selectedTab === "edit") {
      // Clear edit form
      setEditTeacherForm({
        teacherId: "",
        name: "",
        email: "",
        phone_no: "",
        password: "",
        confirmPassword: ""
      });
      setEditTeacherData(null);
      setTeacherFetched(false);
      setShowEditPassword(false);
      setShowEditConfirmPassword(false);
    }
  }, [selectedTab]);

  const fetchAllSubjects = async () => {
    setFetchingSubjects(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/courses`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const subjects = data.subjects || [];
          setAllSubjects(subjects);
          
          // Extract unique semesters, departments, and sections
          const semesters = [...new Set(subjects.map((s: any) => s.semester.toString()))].sort();
          const departments = [...new Set(subjects.map((s: any) => s.department))].sort();
          const sections = [...new Set(subjects.map((s: any) => s.section))].sort();
          
          setAvailableSemesters(semesters);
          setAvailableDepartments(departments);
          setAvailableSections(sections);
        }
      }
    } catch (err) {
      console.error('Error fetching subjects:', err);
    } finally {
      setFetchingSubjects(false);
    }
  };

  const handleAssignSubjectsFilterChange = (field: 'selectedSemesters' | 'selectedDepartments' | 'selectedSections', value: string) => {
    setAssignSubjectsForm(prev => {
      const currentArray = prev[field];
      const newArray = currentArray.includes(value)
        ? currentArray.filter(v => v !== value)
        : [...currentArray, value];
      
      return {
        ...prev,
        [field]: newArray,
        selectedSubjectsByCombo: {} // Reset selected subjects when filters change
      };
    });
  };

  // Get all combinations organized hierarchically: Semester > Department > Section
  const getSubjectHierarchy = () => {
    const hierarchy: Record<string, Record<string, Record<string, any[]>>> = {};

    assignSubjectsForm.selectedSemesters.forEach(sem => {
      if (!hierarchy[sem]) hierarchy[sem] = {};
      
      assignSubjectsForm.selectedDepartments.forEach(dept => {
        if (!hierarchy[sem][dept]) hierarchy[sem][dept] = {};
        
        assignSubjectsForm.selectedSections.forEach(sec => {
          const subjects = allSubjects.filter(s =>
            s.semester.toString() === sem &&
            s.department === dept &&
            s.section === sec
          );
          
          if (subjects.length > 0) {
            hierarchy[sem][dept][sec] = subjects;
          }
        });
      });
    });

    return hierarchy;
  };

  const fetchTeachersTableData = async () => {
    setTeachersLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      // Fetch teachers data
      const response = await fetch(`${API_BASE_URL}/teachers`, {
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
        // Fetch teacher_enrollments to get enrollment dates
        const enrollmentsResponse = await fetch(`${API_BASE_URL}/dbms-values/table/teacher_enrollments`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const enrollmentsData = await enrollmentsResponse.json();

        // Fetch teachers table to get teacher IDs
        const teachersResponse = await fetch(`${API_BASE_URL}/dbms-values/table/teachers`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const teachersTableData = await teachersResponse.json();

        // Fetch courses to get course details
        const coursesResponse = await fetch(`${API_BASE_URL}/courses`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const coursesData = await coursesResponse.json();

        // Create lookup maps
        const teachersMap = new Map();
        if (teachersTableData.success && teachersTableData.data) {
          teachersTableData.data.forEach((t: any) => {
            teachersMap.set(t.id || t.ID, t.teacher_id || t.TEACHER_ID);
          });
        }

        const coursesMap = new Map();
        if (coursesData.success && coursesData.subjects) {
          coursesData.subjects.forEach((c: any) => {
            coursesMap.set(c.id, c);
          });
        }

        // Enrich teacher data with enrollment information
        const enrichedTeachers = data.data.map((teacher: any) => {
          // Find teacher's internal ID
          const teacherInternalId = Array.from(teachersMap.entries())
            .find(([_, tid]) => tid === teacher.teacher_id)?.[0];

          // Get all enrollments for this teacher
          const teacherEnrollments = enrollmentsData.success && enrollmentsData.data
            ? enrollmentsData.data.filter((e: any) => 
                (e.teacher_id || e.TEACHER_ID) === teacherInternalId
              )
            : [];

          // Get enrollment details with dates
          const enrollmentDetails = teacherEnrollments.map((enrollment: any) => {
            const courseId = enrollment.course_id || enrollment.COURSE_ID;
            const course = coursesMap.get(courseId);
            
            return {
              semester: course?.semester,
              department: course?.department,
              section: course?.section,
              course_code: course?.subject_code,
              course_name: course?.subject_name,
              enrollment_date: enrollment.enrollment_date || enrollment.ENROLLMENT_DATE,
              completion_date: enrollment.completion_date || enrollment.COMPLETION_DATE
            };
          }).filter((e: any) => e.semester); // Filter out invalid enrollments

          return {
            ...teacher,
            enrollmentDetails
          };
        });

        setTeachersTableData({
          ...data,
          data: enrichedTeachers
        });
      } else {
        throw new Error(data.message || 'Failed to fetch teachers');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setTeachersLoading(false);
    }
  };

  const fetchFilteredCourses = async (semesters: string[], departments: string[], sections: string[]) => {
    if (semesters.length === 0 && departments.length === 0 && sections.length === 0) {
      setAvailableCourses([]);
      return;
    }

    setFetchingCourses(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const params = new URLSearchParams();
      if (semesters.length > 0) params.append('semesters', semesters.join(','));
      if (departments.length > 0) params.append('departments', departments.join(','));
      if (sections.length > 0) params.append('sections', sections.join(','));

      const response = await fetch(`${API_BASE_URL}/courses/filtered?${params}`, {
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
        setAvailableCourses(data.courses || []);
      } else {
        throw new Error(data.message || 'Failed to fetch courses');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      setAvailableCourses([]);
    } finally {
      setFetchingCourses(false);
    }
  };

  const fetchDbmsData = async () => {
    setDbmsLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE_URL}/dbms-values`, {
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
        setDbmsData(data);
        const tableNames = Object.keys(data.tables);
        if (tableNames.length > 0 && !selectedTable) {
          setSelectedTable(tableNames[0]);
        }
      } else {
        throw new Error(data.message || 'Failed to fetch database values');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setDbmsLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      // Fetch dashboard stats
      const statsResponse = await fetch(`${API_BASE_URL}/admin/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherRegNextStep = () => {
    if (!teacherRegForm.name || !teacherRegForm.teacherId || !teacherRegForm.password || !teacherRegForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all personal information fields.",
        variant: "destructive"
      });
      return;
    }

    if (teacherRegForm.password !== teacherRegForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive"
      });
      return;
    }

    if (teacherRegForm.password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long.",
        variant: "destructive"
      });
      return;
    }
  };

  const handleTeacherRegMultiSelect = (field: keyof typeof teacherRegForm, value: string) => {
    setTeacherRegForm(prev => {
      const currentValue = prev[field];
      if (Array.isArray(currentValue)) {
        const newValue = currentValue.includes(value)
          ? currentValue.filter((item: string) => item !== value)
          : [...currentValue, value];
        
        // Reset subjects when departments change
        if (field === 'departments') {
          return {
            ...prev,
            [field]: newValue,
            subjects: []
          };
        }
        
        return {
          ...prev,
          [field]: newValue
        };
      }
      return prev;
    });
  };



  const handleFilterChange = (filterType: 'semesters' | 'departments' | 'sections', value: string) => {
    let newSemesters = assignCoursesForm.selectedSemesters;
    let newDepartments = assignCoursesForm.selectedDepartments;
    let newSections = assignCoursesForm.selectedSections;

    if (filterType === 'semesters') {
      newSemesters = newSemesters.includes(value)
        ? newSemesters.filter(v => v !== value)
        : [...newSemesters, value];
    } else if (filterType === 'departments') {
      newDepartments = newDepartments.includes(value)
        ? newDepartments.filter(v => v !== value)
        : [...newDepartments, value];
    } else {
      newSections = newSections.includes(value)
        ? newSections.filter(v => v !== value)
        : [...newSections, value];
    }

    setAssignCoursesForm(prev => ({
      ...prev,
      selectedSemesters: newSemesters,
      selectedDepartments: newDepartments,
      selectedSections: newSections
    }));

    // Fetch courses with updated filters
    fetchFilteredCourses(newSemesters, newDepartments, newSections);
  };

  const handleCourseToggle = (courseId: number) => {
    setAssignCoursesForm(prev => {
      const newIds = prev.selectedCourseIds.includes(courseId)
        ? prev.selectedCourseIds.filter(id => id !== courseId)
        : [...prev.selectedCourseIds, courseId];
      
      return {
        ...prev,
        selectedCourseIds: newIds
      };
    });

    // Update selected courses list
    const course = availableCourses.find(c => c.id === courseId);
    if (course) {
      setSelectedCourses(prev => {
        const exists = prev.find(c => c.id === courseId);
        if (exists) {
          return prev.filter(c => c.id !== courseId);
        } else {
          return [...prev, course];
        }
      });
    }
  };

  const handleRemoveCourse = (courseId: number) => {
    setAssignCoursesForm(prev => ({
      ...prev,
      selectedCourseIds: prev.selectedCourseIds.filter(id => id !== courseId)
    }));
    setSelectedCourses(prev => prev.filter(c => c.id !== courseId));
  };

  const handleAssignSubjects = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!assignSubjectsForm.teacherId.trim()) {
      toast({ title: "Error", description: "Teacher ID required", variant: "destructive" });
      return;
    }

    if (!assignSubjectsForm.enrollmentYear) {
      toast({ title: "Error", description: "Enrollment Year required", variant: "destructive" });
      return;
    }

    if (!assignSubjectsForm.enrollmentMonth) {
      toast({ title: "Error", description: "Enrollment Month required", variant: "destructive" });
      return;
    }

    if (assignSubjectsForm.selectedSemesters.length === 0) {
      toast({ title: "Error", description: "Select at least one semester", variant: "destructive" });
      return;
    }

    if (assignSubjectsForm.selectedDepartments.length === 0) {
      toast({ title: "Error", description: "Select at least one department", variant: "destructive" });
      return;
    }

    if (assignSubjectsForm.selectedSections.length === 0) {
      toast({ title: "Error", description: "Select at least one section", variant: "destructive" });
      return;
    }

    // Validate that at least one subject is selected for each combination
    const hierarchy = getSubjectHierarchy();
    const subjectCombinations: any[] = [];
    
    for (const semester in hierarchy) {
      for (const department in hierarchy[semester]) {
        for (const section in hierarchy[semester][department]) {
          const comboKey = `${semester}-${department}-${section}`;
          const selectedIds = assignSubjectsForm.selectedSubjectsByCombo[comboKey] || [];
          
          if (selectedIds.length === 0) {
            toast({
              title: "Error",
              description: `Select at least one subject for Semester ${semester}, ${department}, Section ${section}`,
              variant: "destructive"
            });
            return;
          }

          // Build subject combinations for backend
          const subjects = hierarchy[semester][department][section];
          for (const subjectId of selectedIds) {
            const subject = subjects.find((s: any) => s.id === subjectId);
            if (subject) {
              subjectCombinations.push({
                semester: semester,
                department: department,
                section: section,
                subject: subject.subject_code
              });
            }
          }
        }
      }
    }

    setRegistering(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      // Calculate enrollment and completion dates
      const enrollmentDate = `${assignSubjectsForm.enrollmentYear}-${assignSubjectsForm.enrollmentMonth === "August" ? "08" : "02"}-01`;
      const completionDate = `${assignSubjectsForm.enrollmentYear}-${assignSubjectsForm.enrollmentMonth === "August" ? "12" : "06"}-${assignSubjectsForm.enrollmentMonth === "August" ? "31" : "30"}`;

      const response = await fetch(`${API_BASE_URL}/teachers/assign-subjects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          teacherId: assignSubjectsForm.teacherId.trim(),
          subjectCombinations: subjectCombinations,
          enrollmentDate,
          completionDate
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast({ 
          title: "Success", 
          description: `${subjectCombinations.length} subject(s) assigned successfully to Teacher ${assignSubjectsForm.teacherId}` 
        });
        setAssignSubjectsForm({
          teacherId: "",
          enrollmentYear: new Date().getFullYear().toString(),
          enrollmentMonth: "August",
          selectedSemesters: [],
          selectedDepartments: [],
          selectedSections: [],
          selectedSubjectsByCombo: {}
        });
        setFilteredSubjects([]);
        fetchTeachersTableData();
      } else {
        toast({ title: "Error", description: data.message || "Failed to assign subjects", variant: "destructive" });
      }
    } catch (error) {
      console.error('Assign subjects error:', error);
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setRegistering(false);
    }
  };

  const handleAssignCourses = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!assignCoursesForm.teacherId.trim()) {
      toast({ title: "Error", description: "Teacher ID required", variant: "destructive" });
      return;
    }

    if (assignCoursesForm.teacherId.trim().length < 3) {
      toast({ title: "Error", description: "Teacher ID min 3 characters", variant: "destructive" });
      return;
    }

    if (!assignCoursesForm.enrollmentYear) {
      toast({ title: "Error", description: "Enrollment Year required", variant: "destructive" });
      return;
    }

    if (!assignCoursesForm.enrollmentMonth) {
      toast({ title: "Error", description: "Enrollment Month required", variant: "destructive" });
      return;
    }

    if (!assignCoursesForm.semesterType) {
      toast({ title: "Error", description: "Semester Type required", variant: "destructive" });
      return;
    }

    if (assignCoursesForm.selectedCourseIds.length === 0) {
      toast({ title: "Error", description: "Select at least one course", variant: "destructive" });
      return;
    }

    setRegistering(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const enrollmentDate = `${assignCoursesForm.enrollmentYear}-${assignCoursesForm.enrollmentMonth === "August" ? "08" : "02"}-01`;
      const completionDate = `${assignCoursesForm.enrollmentYear}-${assignCoursesForm.enrollmentMonth === "August" ? "12" : "06"}-${assignCoursesForm.enrollmentMonth === "August" ? "31" : "30"}`;

      const response = await fetch(`${API_BASE_URL}/teachers/assign-courses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          teacherId: assignCoursesForm.teacherId.trim(),
          courseIds: assignCoursesForm.selectedCourseIds,
          enrollmentDate,
          completionDate
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast({ title: "Success", description: `${data.enrollmentCount} courses assigned successfully` });
        setAssignCoursesForm({
          teacherId: "",
          enrollmentYear: new Date().getFullYear().toString(),
          enrollmentMonth: "August",
          semesterType: "",
          selectedSemesters: [],
          selectedDepartments: [],
          selectedSections: [],
          selectedCourseIds: []
        });
        setSelectedCourses([]);
        setAvailableCourses([]);
        fetchTeachersTableData();
      } else {
        toast({ title: "Error", description: data.message || "Failed to assign courses", variant: "destructive" });
      }
    } catch (error) {
      console.error('Assign courses error:', error);
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setRegistering(false);
    }
  };

  const fetchTeacherDetails = async () => {
    if (!editTeacherForm.teacherId.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a Teacher ID"
      });
      return;
    }

    setFetchingTeacher(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE_URL}/teachers/${editTeacherForm.teacherId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Set original data for display
        setEditTeacherData({
          teacherId: data.teacher.teacher_id,
          name: data.teacher.name,
          email: data.teacher.email,
          phone_no: data.teacher.phone_no
        });
        
        // Set form data for editing
        setEditTeacherForm({
          ...editTeacherForm,
          name: data.teacher.name,
          email: data.teacher.email,
          phone_no: data.teacher.phone_no,
          password: "",
          confirmPassword: ""
        });
        setTeacherFetched(true);
        toast({
          title: "Success",
          description: "Teacher details fetched successfully"
        });
      } else {
        throw new Error(data.message || 'Failed to fetch teacher details');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch teacher details';
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage
      });
      setTeacherFetched(false);
    } finally {
      setFetchingTeacher(false);
    }
  };

  const handleEditTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if teacher has been fetched first
    if (!teacherFetched) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fetch teacher details first"
      });
      return;
    }

    // Validation
    if (!editTeacherForm.name || !editTeacherForm.email || !editTeacherForm.phone_no) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Name, email, and phone number are required"
      });
      return;
    }

    // Name validation
    if (editTeacherForm.name.trim().length < 3) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Name must be at least 3 characters long"
      });
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editTeacherForm.email)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid email address"
      });
      return;
    }

    // Phone number validation (required)
    if (editTeacherForm.phone_no.length !== 10 || !/^\d{10}$/.test(editTeacherForm.phone_no)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Phone number must be exactly 10 digits"
      });
      return;
    }

    // Password validation (if provided)
    if (editTeacherForm.password) {
      if (editTeacherForm.password.length < 6) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Password must be at least 6 characters"
        });
        return;
      }

      if (editTeacherForm.password !== editTeacherForm.confirmPassword) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Passwords do not match"
        });
        return;
      }
    }

    setUpdatingTeacher(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE_URL}/teachers/${editTeacherForm.teacherId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editTeacherForm.name,
          email: editTeacherForm.email,
          phone_no: editTeacherForm.phone_no,
          password: editTeacherForm.password || undefined
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Success",
          description: data.message || "Teacher details updated successfully"
        });
        
        // Clear password fields and refresh teacher details
        setEditTeacherForm({
          ...editTeacherForm,
          password: "",
          confirmPassword: ""
        });
        
        // Refresh the teacher details to show updated info
        await fetchTeacherDetails();
      } else {
        throw new Error(data.message || 'Failed to update teacher details');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update teacher details';
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage
      });
    } finally {
      setUpdatingTeacher(false);
    }
  };

  const handleTeacherRegSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation 1: Check all fields not empty
    if (!teacherRegForm.name || !teacherRegForm.teacherId || !teacherRegForm.email || !teacherRegForm.phone_no || !teacherRegForm.password || !teacherRegForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all personal information fields.",
        variant: "destructive"
      });
      return;
    }

    // Validation 2: Name minimum 3 characters
    if (teacherRegForm.name.trim().length < 3) {
      toast({
        title: "Error",
        description: "Name must be at least 3 characters long.",
        variant: "destructive"
      });
      return;
    }

    // Validation 3: Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(teacherRegForm.email)) {
      toast({
        title: "Error",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    // Validation 4: Phone number validation (exactly 10 digits)
    if (teacherRegForm.phone_no.length !== 10 || !/^\d{10}$/.test(teacherRegForm.phone_no)) {
      toast({
        title: "Error",
        description: "Phone number must be exactly 10 digits.",
        variant: "destructive"
      });
      return;
    }

    // Validation 5: Teacher ID minimum 3 characters
    if (teacherRegForm.teacherId.trim().length < 3) {
      toast({
        title: "Error",
        description: "Teacher ID must be at least 3 characters long.",
        variant: "destructive"
      });
      return;
    }

    // Validation 6: Password match
    if (teacherRegForm.password !== teacherRegForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive"
      });
      return;
    }

    // Validation 7: Password length
    if (teacherRegForm.password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long.",
        variant: "destructive"
      });
      return;
    }

    setRegistering(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE_URL}/auth/register/teacher`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: teacherRegForm.name,
          teacherId: teacherRegForm.teacherId,
          email: teacherRegForm.email,
          phone_no: teacherRegForm.phone_no,
          password: teacherRegForm.password
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success!",
          description: "Teacher account created successfully.",
        });
        setTeacherRegForm({
          name: "",
          teacherId: "",
          email: "",
          phone_no: "",
          password: "",
          confirmPassword: "",
          semesters: [],
          departments: [],
          sections: [],
          subjects: [],
          enrollmentYear: new Date().getFullYear().toString(),
          enrollmentMonth: "August"
        });
        fetchData();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to create account. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: "Error",
        description: "Network error. Please check your connection and try again.",
        variant: "destructive"
      });
    } finally {
      setRegistering(false);
    }
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  const getTableIcon = (tableName: string) => {
    if (tableName.includes('user')) return <Users className="h-4 w-4" />;
    if (tableName.includes('student')) return <BookOpen className="h-4 w-4" />;
    if (tableName.includes('teacher')) return <Users className="h-4 w-4" />;
    if (tableName.includes('attendance')) return <Calendar className="h-4 w-4" />;
    if (tableName.includes('session')) return <Calendar className="h-4 w-4" />;
    return <TableIcon className="h-4 w-4" />;
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

  const getTypeColor = (type: string): string => {
    if (type.includes('INTEGER')) return 'bg-blue-100 text-blue-800';
    if (type.includes('TEXT') || type.includes('VARCHAR')) return 'bg-green-100 text-green-800';
    if (type.includes('DATETIME')) return 'bg-purple-100 text-purple-800';
    if (type.includes('BOOLEAN')) return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Manage Teachers</h1>
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="teachers" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">View Teachers</TabsTrigger>
          <TabsTrigger value="register">Register Teacher</TabsTrigger>
          <TabsTrigger value="assign">Assign Subjects to Teachers</TabsTrigger>
          <TabsTrigger value="edit">Edit Teacher</TabsTrigger>
        </TabsList>

        {/* View Teachers Tab */}
        <TabsContent value="teachers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Teachers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!teachersTableData ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground mb-4">Click to load teacher data</p>
                  <Button onClick={fetchTeachersTableData} disabled={teachersLoading}>
                    {teachersLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Load Teachers Data
                      </>
                    )}
                  </Button>
                </div>
              ) : teachersTableData.data.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No teachers found</p>
                  <Button onClick={() => setSelectedTab("register")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Teacher
                  </Button>
                </div>
              ) : (
                <>
                  {/* Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="space-y-2">
                      <Label>Semester</Label>
                      <Select
                        value={teacherFilters.semester || "all"}
                        onValueChange={(value) => setTeacherFilters(prev => ({ ...prev, semester: value === "all" ? "" : value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Semesters" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Semesters</SelectItem>
                          {[...new Set(teachersTableData.data.flatMap((t: any) => 
                            t.enrollmentDetails ? t.enrollmentDetails.map((e: any) => e.semester?.toString()).filter(Boolean) : []
                          ))].sort().map(sem => (
                            <SelectItem key={sem} value={sem}>Semester {sem}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Select
                        value={teacherFilters.department || "all"}
                        onValueChange={(value) => setTeacherFilters(prev => ({ ...prev, department: value === "all" ? "" : value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Departments" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Departments</SelectItem>
                          {[...new Set(teachersTableData.data.flatMap((t: any) => 
                            t.enrollmentDetails ? t.enrollmentDetails.map((e: any) => e.department).filter(Boolean) : []
                          ))].sort().map(dept => (
                            <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Section</Label>
                      <Select
                        value={teacherFilters.section || "all"}
                        onValueChange={(value) => setTeacherFilters(prev => ({ ...prev, section: value === "all" ? "" : value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Sections" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sections</SelectItem>
                          {[...new Set(teachersTableData.data.flatMap((t: any) => 
                            t.enrollmentDetails ? t.enrollmentDetails.map((e: any) => e.section).filter(Boolean) : []
                          ))].sort().map(sec => (
                            <SelectItem key={sec} value={sec}>Section {sec}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Enrollment Date</Label>
                      <Select
                        value={teacherFilters.enrollmentDate || "all"}
                        onValueChange={(value) => setTeacherFilters(prev => ({ ...prev, enrollmentDate: value === "all" ? "" : value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Dates" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Dates</SelectItem>
                          {[...new Set(teachersTableData.data.flatMap((t: any) => 
                            t.enrollmentDetails ? t.enrollmentDetails.map((e: any) => e.enrollment_date).filter(Boolean) : []
                          ))].sort().reverse().map(date => (
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
                        onClick={() => setTeacherFilters({ semester: "", department: "", section: "", enrollmentDate: "" })}
                      >
                        Clear Filters
                      </Button>
                    </div>
                  </div>

                  {/* Teachers Display */}
                  <div className="space-y-4">
                    {teachersTableData.data
                      .map((row: any) => {
                        // Filter enrollmentDetails based on filters
                        const filteredEnrollments = row.enrollmentDetails?.filter((enrollment: any) => {
                          if (teacherFilters.semester && enrollment.semester?.toString() !== teacherFilters.semester) {
                            return false;
                          }
                          if (teacherFilters.department && enrollment.department !== teacherFilters.department) {
                            return false;
                          }
                          if (teacherFilters.section && enrollment.section !== teacherFilters.section) {
                            return false;
                          }
                          if (teacherFilters.enrollmentDate && enrollment.enrollment_date !== teacherFilters.enrollmentDate) {
                            return false;
                          }
                          return true;
                        }) || [];

                        // Only show teacher if they have matching enrollments
                        if (filteredEnrollments.length === 0 && (teacherFilters.semester || teacherFilters.department || teacherFilters.section || teacherFilters.enrollmentDate)) {
                          return null;
                        }

                        return { ...row, filteredEnrollments };
                      })
                      .filter((row: any) => row !== null)
                      .map((row: any, index: number) => (
                        <Card key={index} className="overflow-hidden">
                          <CardContent className="p-5">
                            {/* Teacher Basic Info */}
                            <div className="flex items-start justify-between mb-4 pb-4 border-b">
                              <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                  <Badge className="font-mono bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-100 hover:bg-cyan-200 dark:hover:bg-cyan-800">{row.teacher_id || '-'}</Badge>
                                  <h3 className="text-lg font-semibold">{row.name || '-'}</h3>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {row.email || '-'}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {row.phone_no || '-'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Academic Assignments - Two Column Layout */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Left Column - Teacher Info */}
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-sm font-medium text-muted-foreground mb-2 block">Teacher ID</Label>
                                  <p className="text-sm font-mono">{row.teacher_id || '-'}</p>
                                </div>
                                <div>
                                  <Label className="text-sm font-medium text-muted-foreground mb-2 block">Name</Label>
                                  <p className="text-sm font-semibold">{row.name || '-'}</p>
                                </div>
                              </div>

                              {/* Right Column - Teaching Assignments */}
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground mb-2 block">Teaching Assignments</Label>
                                <div className="space-y-2">
                                  {/* Display filtered enrollment details with dates */}
                                  {row.filteredEnrollments && row.filteredEnrollments.length > 0 ? (
                                    row.filteredEnrollments.map((enrollment: any, idx: number) => (
                                      <div key={idx} className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                                        <div className="flex flex-wrap gap-2 mb-2">
                                          <Badge className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100">
                                            Sem {enrollment.semester}
                                          </Badge>
                                          <Badge className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100">
                                            {enrollment.department}
                                          </Badge>
                                          <Badge className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100">
                                            Sec {enrollment.section}
                                          </Badge>
                                        </div>
                                        <div className="mt-2">
                                          <div className="text-xs text-muted-foreground mb-1">Course:</div>
                                          <div className="text-xs bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded px-2 py-1">
                                            {enrollment.course_code} - {enrollment.course_name}
                                          </div>
                                        </div>
                                        {enrollment.enrollment_date && (
                                          <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                                            <span>
                                              📅 {new Date(enrollment.enrollment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                                              {enrollment.completion_date && (
                                                <span> → {new Date(enrollment.completion_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</span>
                                              )}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-sm text-muted-foreground">No assignments</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    
                    <div className="p-3 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
                      📊 Showing {teachersTableData.data.filter((row: any) => {
                        const filteredEnrollments = row.enrollmentDetails?.filter((enrollment: any) => {
                          if (teacherFilters.semester && enrollment.semester?.toString() !== teacherFilters.semester) return false;
                          if (teacherFilters.department && enrollment.department !== teacherFilters.department) return false;
                          if (teacherFilters.section && enrollment.section !== teacherFilters.section) return false;
                          if (teacherFilters.enrollmentDate && enrollment.enrollment_date !== teacherFilters.enrollmentDate) return false;
                          return true;
                        }) || [];
                        return filteredEnrollments.length > 0 || (!teacherFilters.semester && !teacherFilters.department && !teacherFilters.section && !teacherFilters.enrollmentDate);
                      }).length} of {teachersTableData.rowCount} teacher{teachersTableData.rowCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Register Teacher Tab */}
        <TabsContent value="register" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Register New Teacher</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTeacherRegSubmit} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground border-b pb-2">Personal Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="reg-name">Full Name <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <UserPlus className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reg-name"
                            placeholder="Enter full name"
                            className="pl-9"
                            value={teacherRegForm.name}
                            onChange={(e) => setTeacherRegForm(prev => ({ ...prev, name: e.target.value }))}
                            disabled={registering}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Minimum 3 characters</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reg-teacherId">Teacher ID <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reg-teacherId"
                            placeholder="Enter unique teacher ID"
                            className="pl-9"
                            value={teacherRegForm.teacherId}
                            onChange={(e) => setTeacherRegForm(prev => ({ ...prev, teacherId: e.target.value }))}
                            disabled={registering}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Minimum 3 characters</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="reg-email">Email <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reg-email"
                            type="email"
                            placeholder="teacher@college.edu"
                            className="pl-9"
                            value={teacherRegForm.email}
                            onChange={(e) => setTeacherRegForm(prev => ({ ...prev, email: e.target.value }))}
                            disabled={registering}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Valid email format required</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reg-phone">Phone Number <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reg-phone"
                            type="tel"
                            placeholder="9876543210"
                            maxLength={10}
                            className="pl-9"
                            value={teacherRegForm.phone_no}
                            onChange={(e) => setTeacherRegForm(prev => ({ ...prev, phone_no: e.target.value.replace(/\D/g, '') }))}
                            disabled={registering}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Exactly 10 digits</p>
                      </div>
                    </div>

                    {/* Security Note - Above Password Fields */}
                    <div className="flex items-start gap-2 text-sm text-muted-foreground bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-amber-700 dark:text-amber-300 font-medium">
                        <strong>Note:</strong> This password should be entered by the teacher themselves for security purposes. Keep your password secure, do not share it with anyone, and do not forget it.
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="reg-password">Password <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reg-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Create a strong password"
                            className="pl-9 pr-10"
                            value={teacherRegForm.password}
                            onChange={(e) => setTeacherRegForm(prev => ({ ...prev, password: e.target.value }))}
                            disabled={registering}
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="text-gray-400 hover:text-gray-600 focus:outline-none"
                              disabled={registering}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reg-confirmPassword">Confirm Password <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reg-confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm your password"
                            className="pl-9 pr-10"
                            value={teacherRegForm.confirmPassword}
                            onChange={(e) => setTeacherRegForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            disabled={registering}
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="text-gray-400 hover:text-gray-600 focus:outline-none"
                              disabled={registering}
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Must match password</p>
                      </div>
                    </div>

                    {/* Next Steps Note - At Bottom */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          <strong>Note:</strong> Teachers must be registered before the start of the semester enrollment date. After registration, use "Assign Courses to Teachers" tab to assign teaching duties.
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t">
                      <Button 
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setTeacherRegForm({
                            name: "",
                            teacherId: "",
                            email: "",
                            phone_no: "",
                            password: "",
                            confirmPassword: "",
                            semesters: [],
                            departments: [],
                            sections: [],
                            subjects: [],
                            enrollmentYear: new Date().getFullYear().toString(),
                            enrollmentMonth: "August"
                          });
                          setShowPassword(false);
                          setShowConfirmPassword(false);
                        }}
                        disabled={registering}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={registering}
                      >
                        {registering ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Teacher Account
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assign Subjects to Teachers Tab */}
        <TabsContent value="assign" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Assign Subjects to Teachers</CardTitle>
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
                          The teacher must be registered in the system before assigning subjects.
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
                          <li>Subjects must be assigned before the enrollment start date</li>
                          <li>Only registered courses will be available for selection</li>
                          <li>Ensure courses are registered in the system before attempting to assign them</li>
                          <li>Each course can only be assigned to one teacher per enrollment period</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Teacher ID */}
                <div className="space-y-2">
                  <Label htmlFor="assign-teacher-id">Teacher ID <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="assign-teacher-id"
                      placeholder="Enter teacher ID"
                      className="pl-9"
                      value={assignSubjectsForm.teacherId}
                      onChange={(e) => setAssignSubjectsForm(prev => ({ ...prev, teacherId: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Enrollment Year and Month */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="assign-enrollment-year">Enrollment Year <span className="text-red-500">*</span></Label>
                    <Select
                      value={assignSubjectsForm.enrollmentYear}
                      onValueChange={(value) => setAssignSubjectsForm(prev => ({ ...prev, enrollmentYear: value }))}
                    >
                      <SelectTrigger id="assign-enrollment-year">
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="assign-enrollment-month">Enrollment Month <span className="text-red-500">*</span></Label>
                    <Select
                      value={assignSubjectsForm.enrollmentMonth}
                      onValueChange={(value) => setAssignSubjectsForm(prev => ({ ...prev, enrollmentMonth: value }))}
                    >
                      <SelectTrigger id="assign-enrollment-month">
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="August">August (Odd Semester)</SelectItem>
                        <SelectItem value="February">February (Even Semester)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Display Calculated Info */}
                {assignSubjectsForm.enrollmentMonth && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Semester Type</p>
                        <p className="text-sm font-bold text-blue-900 dark:text-blue-100 mt-1">
                          {assignSubjectsForm.enrollmentMonth === "August" ? "Odd" : "Even"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Enrollment Date</p>
                        <p className="text-sm font-mono text-blue-900 dark:text-blue-100 mt-1">
                          {assignSubjectsForm.enrollmentYear}-{assignSubjectsForm.enrollmentMonth === "August" ? "08" : "02"}-01
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Completion Date</p>
                        <p className="text-sm font-mono text-blue-900 dark:text-blue-100 mt-1">
                          {assignSubjectsForm.enrollmentYear}-{assignSubjectsForm.enrollmentMonth === "August" ? "12" : "06"}-{assignSubjectsForm.enrollmentMonth === "August" ? "31" : "30"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Semesters Selection */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-semibold">Semesters</Label>
                    {assignSubjectsForm.selectedSemesters.length === 0 && (
                      <div className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                        <span className="text-xs font-medium text-red-700 dark:text-red-300">Required</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg border grid grid-cols-4 gap-4">
                    {availableSemesters.map((sem) => (
                      <div key={sem} className="flex items-center space-x-2">
                        <Checkbox
                          id={`sem-${sem}`}
                          checked={assignSubjectsForm.selectedSemesters.includes(sem)}
                          onCheckedChange={() => {
                            handleAssignSubjectsFilterChange('selectedSemesters', sem);
                          }}
                        />
                        <Label htmlFor={`sem-${sem}`} className="text-sm cursor-pointer">Sem {sem}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Departments Selection */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-semibold">Departments</Label>
                    {assignSubjectsForm.selectedDepartments.length === 0 && (
                      <div className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                        <span className="text-xs font-medium text-red-700 dark:text-red-300">Required</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg border space-y-2">
                    {availableDepartments.map((dept) => (
                      <div key={dept} className="flex items-center space-x-2">
                        <Checkbox
                          id={`dept-${dept}`}
                          checked={assignSubjectsForm.selectedDepartments.includes(dept)}
                          onCheckedChange={() => {
                            handleAssignSubjectsFilterChange('selectedDepartments', dept);
                          }}
                        />
                        <Label htmlFor={`dept-${dept}`} className="text-sm cursor-pointer font-medium">{dept}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sections Selection */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-semibold">Sections</Label>
                    {assignSubjectsForm.selectedSections.length === 0 && (
                      <div className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                        <span className="text-xs font-medium text-red-700 dark:text-red-300">Required</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg border grid grid-cols-4 gap-4">
                    {availableSections.map((sec) => (
                      <div key={sec} className="flex items-center space-x-2">
                        <Checkbox
                          id={`sec-${sec}`}
                          checked={assignSubjectsForm.selectedSections.includes(sec)}
                          onCheckedChange={() => {
                            handleAssignSubjectsFilterChange('selectedSections', sec);
                          }}
                        />
                        <Label htmlFor={`sec-${sec}`} className="text-sm cursor-pointer">Section {sec}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subjects by Hierarchy */}
                {assignSubjectsForm.selectedSemesters.length > 0 && assignSubjectsForm.selectedDepartments.length > 0 && assignSubjectsForm.selectedSections.length > 0 && (
                  <div className="space-y-6 border-t pt-4">
                    <h3 className="text-lg font-semibold text-foreground">Select Subjects</h3>
                    
                    {Object.keys(getSubjectHierarchy()).length === 0 ? (
                      <div className="text-center py-8 bg-muted/30 rounded-lg border">
                        <p className="text-muted-foreground">No subjects found for selected combinations</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Semester Level */}
                        {Object.entries(getSubjectHierarchy()).map(([semester, departments]) => (
                          <div key={semester} className="border rounded-lg overflow-hidden bg-white dark:bg-slate-950">
                            {/* Semester Header - Darkest Green */}
                            <div className="bg-gradient-to-r from-green-100 to-green-150 dark:from-green-900 dark:to-green-800 px-6 py-4 border-b-2 border-green-300 dark:border-green-700">
                              <h4 className="text-center text-lg font-bold text-green-800 dark:text-green-200">
                                Semester {semester}
                              </h4>
                            </div>

                            {/* Department Level */}
                            <div className="space-y-4 p-4">
                              {Object.entries(departments).map(([department, sections]) => (
                                <div key={`${semester}-${department}`} className="border rounded-lg bg-white dark:bg-slate-950 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                  {/* Department Header - Medium Green */}
                                  <div className="bg-green-50 dark:bg-green-950/40 px-4 py-2 border-b border-green-200 dark:border-green-800">
                                    <h5 className="text-sm font-semibold text-green-700 dark:text-green-300">
                                      Department: {department}
                                    </h5>
                                  </div>

                                  {/* Section Level */}
                                  <div className="space-y-3 p-3">
                                    {Object.entries(sections).map(([section, subjects]) => {
                                      const comboKey = `${semester}-${department}-${section}`;
                                      const selectedCount = (assignSubjectsForm.selectedSubjectsByCombo[comboKey] || []).length;
                                      
                                      return (
                                        <div key={`${semester}-${department}-${section}`} className="border rounded bg-white dark:bg-slate-950">
                                          {/* Section Header - Lightest Green */}
                                          <div className="flex items-center justify-between bg-green-25 dark:bg-green-950/20 px-3 py-2 border-b border-green-100 dark:border-green-900">
                                            <div className="flex items-center gap-3">
                                              <Badge variant="outline" className="text-xs bg-green-25 dark:bg-green-950/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800">Section {section}</Badge>
                                              {selectedCount === 0 && (
                                                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Select at least one</span>
                                              )}
                                              {selectedCount > 0 && (
                                                <span className="text-xs font-medium text-green-600 dark:text-green-400">✓ {selectedCount} selected</span>
                                              )}
                                            </div>
                                          </div>

                                          {/* Subjects Table */}
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                              <thead className="bg-green-25 dark:bg-green-950/20 border-b border-green-100 dark:border-green-900">
                                                <tr>
                                                  <th className="px-3 py-2 text-left font-semibold w-10 group">
                                                    <div className="transition-transform duration-200 group-hover:scale-125">
                                                      <Checkbox
                                                        checked={subjects.length > 0 && subjects.every(s => (assignSubjectsForm.selectedSubjectsByCombo[comboKey] || []).includes(s.id))}
                                                        onCheckedChange={(checked) => {
                                                          setAssignSubjectsForm(prev => {
                                                            const newSelected = checked ? subjects.map(s => s.id) : [];
                                                            return {
                                                              ...prev,
                                                              selectedSubjectsByCombo: {
                                                                ...prev.selectedSubjectsByCombo,
                                                                [comboKey]: newSelected
                                                              }
                                                            };
                                                          });
                                                        }}
                                                      />
                                                    </div>
                                                  </th>
                                                  <th className="px-3 py-2 text-left font-semibold text-green-700 dark:text-green-300">Code</th>
                                                  <th className="px-3 py-2 text-left font-semibold text-green-700 dark:text-green-300">Subject Name</th>
                                                  <th className="px-3 py-2 text-center font-semibold w-16 text-green-700 dark:text-green-300">Credits</th>
                                                  <th className="px-3 py-2 text-center font-semibold w-20 text-green-700 dark:text-green-300">Sessions</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {subjects.map((subject) => {
                                                  const isSelected = (assignSubjectsForm.selectedSubjectsByCombo[comboKey] || []).includes(subject.id);
                                                  return (
                                                    <tr
                                                      key={subject.id}
                                                      className={`border-b transition-colors group ${
                                                        isSelected 
                                                          ? 'bg-green-50 dark:bg-green-950/30' 
                                                          : ''
                                                      }`}
                                                      onClick={() => {
                                                        setAssignSubjectsForm(prev => {
                                                          const currentSelected = prev.selectedSubjectsByCombo[comboKey] || [];
                                                          const newSelected = isSelected
                                                            ? currentSelected.filter(id => id !== subject.id)
                                                            : [...currentSelected, subject.id];
                                                          
                                                          return {
                                                            ...prev,
                                                            selectedSubjectsByCombo: {
                                                              ...prev.selectedSubjectsByCombo,
                                                              [comboKey]: newSelected
                                                            }
                                                          };
                                                        });
                                                      }}
                                                    >
                                                      <td className="px-3 py-2">
                                                        <div className="transition-transform duration-200 group-hover:scale-125">
                                                          <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={() => {
                                                              setAssignSubjectsForm(prev => {
                                                                const currentSelected = prev.selectedSubjectsByCombo[comboKey] || [];
                                                                const newSelected = isSelected
                                                                  ? currentSelected.filter(id => id !== subject.id)
                                                                  : [...currentSelected, subject.id];
                                                                
                                                                return {
                                                                  ...prev,
                                                                  selectedSubjectsByCombo: {
                                                                    ...prev.selectedSubjectsByCombo,
                                                                    [comboKey]: newSelected
                                                                  }
                                                                };
                                                              });
                                                            }}
                                                          />
                                                        </div>
                                                      </td>
                                                      <td className="px-3 py-2 font-mono font-semibold text-slate-900 dark:text-slate-100">{subject.subject_code}</td>
                                                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{subject.subject_name}</td>
                                                      <td className="px-3 py-2 text-center text-slate-700 dark:text-slate-300">{subject.credits}</td>
                                                      <td className="px-3 py-2 text-center text-slate-700 dark:text-slate-300">{subject.total_sessions_planned}</td>
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
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}

                        {/* Selected Subjects Gallery */}
                        {Object.values(assignSubjectsForm.selectedSubjectsByCombo).flat().length > 0 && (
                          <div className="border-t pt-6 mt-6">
                            <h3 className="text-lg font-semibold text-foreground mb-4">
                              Selected Subjects ({Object.values(assignSubjectsForm.selectedSubjectsByCombo).flat().length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {Object.entries(getSubjectHierarchy()).map(([semester, departments]) =>
                                Object.entries(departments).map(([department, sections]) =>
                                  Object.entries(sections).map(([section, subjects]) => {
                                    const comboKey = `${semester}-${department}-${section}`;
                                    const selectedIds = assignSubjectsForm.selectedSubjectsByCombo[comboKey] || [];
                                    
                                    return selectedIds.map(subjectId => {
                                      const subject = subjects.find(s => s.id === subjectId);
                                      if (!subject) return null;
                                      
                                      return (
                                        <div
                                          key={`${comboKey}-${subjectId}`}
                                          className="border-2 border-green-400 dark:border-green-600 rounded-lg p-4 bg-green-50 dark:bg-green-950/30 hover:shadow-md transition-shadow"
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                              <div className="font-semibold text-sm text-green-900 dark:text-green-100">{subject.subject_code}</div>
                                              <div className="text-xs text-green-700 dark:text-green-300 mt-1">{subject.subject_name}</div>
                                              <div className="flex gap-2 mt-2">
                                                <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">Sem {semester}</Badge>
                                                <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">{department}</Badge>
                                                <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">Sec {section}</Badge>
                                              </div>
                                              <div className="text-xs text-green-600 dark:text-green-400 mt-2">
                                                {subject.credits} credits • {subject.total_sessions_planned} sessions
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => {
                                                setAssignSubjectsForm(prev => ({
                                                  ...prev,
                                                  selectedSubjectsByCombo: {
                                                    ...prev.selectedSubjectsByCombo,
                                                    [comboKey]: (prev.selectedSubjectsByCombo[comboKey] || []).filter(id => id !== subjectId)
                                                  }
                                                }));
                                              }}
                                              className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 rounded p-1 transition-colors"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    });
                                  })
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAssignSubjectsForm({
                        teacherId: "",
                        enrollmentYear: new Date().getFullYear().toString(),
                        enrollmentMonth: "August",
                        selectedSemesters: [],
                        selectedDepartments: [],
                        selectedSections: [],
                        selectedSubjectsByCombo: {}
                      });
                    }}
                  >
                    Clear All
                  </Button>
                  <Button
                    onClick={handleAssignSubjects}
                    disabled={registering}
                  >
                    {registering ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Assign Subjects to Teacher
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Edit Teacher Tab */}
        <TabsContent value="edit" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Edit Teacher Details
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
                      The teacher must be registered in the system to edit their details. Enter the Teacher ID and fetch their information first.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleEditTeacherSubmit} className="space-y-6">
              {/* Fetch Teacher Section */}
              <div className="space-y-4 pb-6 border-b">
                <div className="space-y-2">
                  <Label htmlFor="edit-teacher-id" className="flex items-center gap-2">
                    Teacher ID
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="edit-teacher-id"
                        placeholder="Enter registered teacher ID"
                        className="pl-9"
                        value={editTeacherForm.teacherId}
                        onChange={(e) => {
                          setEditTeacherForm({ ...editTeacherForm, teacherId: e.target.value });
                          setTeacherFetched(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (editTeacherForm.teacherId.trim()) {
                              fetchTeacherDetails();
                            }
                          }
                        }}
                        disabled={fetchingTeacher || teacherFetched}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={fetchTeacherDetails}
                      disabled={fetchingTeacher || !editTeacherForm.teacherId.trim()}
                    >
                      {fetchingTeacher ? (
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

              {/* Teacher Info Display - Only show after fetching */}
              {teacherFetched && (
                <>
                  {/* Current Teacher Information (Read-only) */}
                  <div className="space-y-4 pb-6 border-b">
                    <h3 className="text-lg font-semibold text-foreground">Current Teacher Information</h3>
                    <div className="bg-muted/30 p-4 rounded-lg border space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Teacher ID</Label>
                          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
                            <Hash className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono font-semibold">{editTeacherData.teacherId}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Full Name</Label>
                          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
                            <UserPlus className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{editTeacherData.name}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Email</Label>
                          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{editTeacherData.email}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Phone Number</Label>
                          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{editTeacherData.phone_no || 'Not provided'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Edit Form */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Update Information</h3>
                    
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
                      <p className="text-sm text-blue-900 dark:text-blue-100">
                        <strong>Note:</strong> Teacher ID cannot be changed. Modify the fields below to update teacher information.
                      </p>
                    </div>

                    {/* Name */}
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Full Name <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <UserPlus className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="edit-name"
                          placeholder="Enter full name"
                          className="pl-9"
                          value={editTeacherForm.name}
                          onChange={(e) => setEditTeacherForm({ ...editTeacherForm, name: e.target.value })}
                          required
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Minimum 3 characters</p>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <Label htmlFor="edit-email">Email <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="edit-email"
                          type="email"
                          placeholder="teacher@college.edu"
                          className="pl-9"
                          value={editTeacherForm.email}
                          onChange={(e) => setEditTeacherForm({ ...editTeacherForm, email: e.target.value })}
                          required
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Valid email format required</p>
                    </div>

                    {/* Phone Number */}
                    <div className="space-y-2">
                      <Label htmlFor="edit-phone">Phone Number <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="edit-phone"
                          type="tel"
                          placeholder="9876543210"
                          maxLength={10}
                          className="pl-9"
                          value={editTeacherForm.phone_no}
                          onChange={(e) => setEditTeacherForm({ ...editTeacherForm, phone_no: e.target.value.replace(/\D/g, '') })}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Exactly 10 digits</p>
                    </div>

                    {/* Security Note - Above Password Fields */}
                    <div className="flex items-start gap-2 text-sm text-muted-foreground bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-amber-700 dark:text-amber-300 font-medium">
                        <strong>Note:</strong> This password should be entered by the teacher themselves for security purposes. Keep your password secure, do not share it with anyone, and do not forget it.
                      </span>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                      <Label htmlFor="edit-password">New Password (Optional)</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="edit-password"
                          type={showEditPassword ? "text" : "password"}
                          placeholder="Leave blank to keep current password"
                          className="pl-9 pr-10"
                          value={editTeacherForm.password}
                          onChange={(e) => setEditTeacherForm({ ...editTeacherForm, password: e.target.value })}
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
                      <Label htmlFor="edit-confirm-password">Confirm New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="edit-confirm-password"
                          type={showEditConfirmPassword ? "text" : "password"}
                          placeholder="Re-enter new password"
                          className="pl-9 pr-10"
                          value={editTeacherForm.confirmPassword}
                          onChange={(e) => setEditTeacherForm({ ...editTeacherForm, confirmPassword: e.target.value })}
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
                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditTeacherForm({
                            teacherId: '',
                            name: '',
                            email: '',
                            phone_no: '',
                            password: '',
                            confirmPassword: ''
                          });
                          setEditTeacherData(null);
                          setTeacherFetched(false);
                          setShowEditPassword(false);
                          setShowEditConfirmPassword(false);
                        }}
                        disabled={updatingTeacher}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={updatingTeacher}
                      >
                        {updatingTeacher ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          "Update Teacher Details"
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* Show message if not fetched yet */}
              {!teacherFetched && !fetchingTeacher && (
                <div className="text-center py-8 text-muted-foreground">
                  <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Enter a Teacher ID and click "Fetch Details" to start editing</p>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

    </div>
  );
}