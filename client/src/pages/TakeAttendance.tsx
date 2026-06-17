import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Webcam from "react-webcam";
import { useStore, Student, AttendanceStatus } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Camera, Loader2, CheckCircle2, Calendar as CalendarIcon, AlertTriangle, UserCheck, UserX, Clock, Edit, Upload, Trash2, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import TimetableDisplay from "@/components/TimetableDisplay";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Course {
  id: number;
  course_code: string;
  course_name: string;
  department: string;
  semester: number;
  section: string;
  credits: number;
}

interface EnrolledStudent {
  id: number;
  usn: string;
  name: string;
  face_embeddings: string | null;
}

export default function TakeAttendance() {
  const { currentUser } = useStore();
  const { toast } = useToast();
  const webcamRef = useRef<Webcam>(null);

  // Use today's date automatically (useMemo to prevent infinite re-renders)
  const date = useMemo(() => new Date(), []);

  // Course selection state
  const [teacherCourses, setTeacherCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  // Dynamic filter options (derived from teacher's courses)
  const [availableSemesters, setAvailableSemesters] = useState<number[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<Course[]>([]);

  // Filter selections
  const [filterSemester, setFilterSemester] = useState<string>("");
  const [filterDepartment, setFilterDepartment] = useState<string>("");
  const [filterSection, setFilterSection] = useState<string>("");

  // Timetable state
  const [teacherSchedule, setTeacherSchedule] = useState<any[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<any>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [timeWindowStatus, setTimeWindowStatus] = useState<{ 
    allowed: boolean; 
    message: string;
    details: {
      classPeriod: string;
      attendanceWindow: string;
      currentTime: string;
      windowOpens?: string;
      windowCloses?: string;
      timeUntilOpen?: string;
      windowClosedAt?: string;
    }
  } | null>(null);

  // Attendance state
  const [step, setStep] = useState<'filter' | 'capture' | 'review' | 'submitted'>('filter');
  const [processing, setProcessing] = useState(false);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [attendanceList, setAttendanceList] = useState<{
    id: string;
    name: string;
    status: AttendanceStatus | 'excused';
    confidence: number | null;
    emotion?: string | null;
    attentiveness?: string | null;
    reasonType?: string | null;
    markedBy?: 'system' | 'manual';
  }[]>([]);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [originalImages, setOriginalImages] = useState<string[]>([]); // Store original images for reset
  const [enhancementModes, setEnhancementModes] = useState<{ [key: number]: number }>({}); // Track enhancement mode per image
  const [annotatedImages, setAnnotatedImages] = useState<string[]>([]);
  const [savedImagePaths, setSavedImagePaths] = useState<string[]>([]);
  const [totalFacesDetected, setTotalFacesDetected] = useState<number>(0); // Total faces detected by ML
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showImportantNotes, setShowImportantNotes] = useState(false); // For collapsible notes
  const [showAuthorizedLeaveModal, setShowAuthorizedLeaveModal] = useState(false);
  const [selectedStudentForLeave, setSelectedStudentForLeave] = useState<string | null>(null);
  const [leaveReason, setLeaveReason] = useState<string>('');
  const [captureTime, setCaptureTime] = useState<Date | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch teacher's courses on mount
  useEffect(() => {
    const fetchTeacherCourses = async () => {
      if (!currentUser || currentUser.role !== 'teacher') return;

      setLoadingCourses(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/attendance/teacher/courses`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setTeacherCourses(data.courses || []);
          
          // Extract unique values for filters
          const courses = data.courses || [];
          const semesterSet = new Set<number>(courses.map((c: Course) => c.semester));
          const semesters = Array.from(semesterSet).sort((a, b) => a - b);
          setAvailableSemesters(semesters);
        } else {
          toast({
            title: "Error",
            description: "Failed to load your courses",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Error fetching courses:', error);
        toast({
          title: "Error",
          description: "Failed to load courses",
          variant: "destructive"
        });
      } finally {
        setLoadingCourses(false);
      }
    };

    fetchTeacherCourses();
  }, [currentUser]);

  // Update available departments when semester changes
  useEffect(() => {
    if (!filterSemester) {
      setAvailableDepartments([]);
      setFilterDepartment("");
      return;
    }

    const filtered = teacherCourses.filter(c => c.semester === parseInt(filterSemester));
    const depts = Array.from(new Set(filtered.map(c => c.department))).sort();
    setAvailableDepartments(depts);
    
    if (filterDepartment && !depts.includes(filterDepartment)) {
      setFilterDepartment("");
    }
  }, [filterSemester, teacherCourses]);

  // Update available sections when department changes
  useEffect(() => {
    if (!filterSemester || !filterDepartment) {
      setAvailableSections([]);
      setFilterSection("");
      return;
    }

    const filtered = teacherCourses.filter(c => 
      c.semester === parseInt(filterSemester) && 
      c.department === filterDepartment
    );
    const sections = Array.from(new Set(filtered.map(c => c.section))).sort();
    setAvailableSections(sections);
    
    if (filterSection && !sections.includes(filterSection)) {
      setFilterSection("");
    }
  }, [filterSemester, filterDepartment, teacherCourses]);

  // Update available subjects when section changes
  useEffect(() => {
    if (!filterSemester || !filterDepartment || !filterSection) {
      setAvailableSubjects([]);
      setSelectedCourse(null);
      return;
    }

    const filtered = teacherCourses.filter(c => 
      c.semester === parseInt(filterSemester) && 
      c.department === filterDepartment &&
      c.section === filterSection
    );
    setAvailableSubjects(filtered);
    
    if (selectedCourse && !filtered.find(c => c.id === selectedCourse.id)) {
      setSelectedCourse(null);
    }
  }, [filterSemester, filterDepartment, filterSection, teacherCourses]);

  // Fetch timetable when semester, department, section are selected
  useEffect(() => {
    const fetchTimetable = async () => {
      if (!filterSemester || !filterDepartment || !filterSection) {
        setTeacherSchedule([]);
        setCurrentPeriod(null);
        return;
      }

      if (!currentUser || currentUser.role !== 'teacher') return;

      setLoadingSchedule(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const dateStr = format(date, 'yyyy-MM-dd');
        const response = await fetch(
          `${API_BASE_URL}/timetable/class/schedule?date=${dateStr}&semester=${filterSemester}&department=${filterDepartment}&section=${filterSection}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          setTeacherSchedule(data.schedule || []);
          setCurrentPeriod(data.current_period);

          // Auto-select FIRST active course that the teacher teaches
          const schedule = data.schedule || [];
          const activePeriods = schedule.filter((s: any) => s.is_current);
          
          if (activePeriods.length > 0) {
            // Find the first active period that matches teacher's courses
            for (const period of activePeriods) {
              const matchingCourse = availableSubjects.find(c => c.id === period.course_id);
              if (matchingCourse) {
                setSelectedCourse(matchingCourse);
                break; // Select only the first one
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching timetable:', error);
      } finally {
        setLoadingSchedule(false);
      }
    };

    fetchTimetable();
  }, [currentUser, date, filterSemester, filterDepartment, filterSection, availableSubjects]);

  // Check time window when course is selected
  useEffect(() => {
    if (!selectedCourse) {
      setTimeWindowStatus(null);
      return;
    }

    // Find ALL occurrences of the selected course in today's timetable
    const coursePeriods = teacherSchedule.filter(s => s.course_id === selectedCourse.id);
    
    if (coursePeriods.length === 0) {
      // Course not in today's timetable
      setTimeWindowStatus(null);
      return;
    }

    // Categorize periods
    const activePeriods = coursePeriods.filter(p => p.is_current);
    const futurePeriods = coursePeriods.filter(p => p.is_upcoming);
    const pastPeriods = coursePeriods.filter(p => p.is_past);

    // Priority logic:
    // 1. Show FIRST active period (if any)
    // 2. Show FIRST future period (if no active)
    // 3. Show LAST past period (if all are past)
    
    let selectedPeriod;
    if (activePeriods.length > 0) {
      selectedPeriod = activePeriods[0]; // First active period
    } else if (futurePeriods.length > 0) {
      selectedPeriod = futurePeriods[0]; // First future period
    } else if (pastPeriods.length > 0) {
      selectedPeriod = pastPeriods[pastPeriods.length - 1]; // Last past period
    }

    if (selectedPeriod) {
      const status = isWithinAttendanceWindow(selectedPeriod.start_time, selectedPeriod.end_time);
      setTimeWindowStatus(status);
    } else {
      setTimeWindowStatus(null);
    }
  }, [selectedCourse, teacherSchedule]);

  // Helper function to check if current time is within allowed attendance window
  const isWithinAttendanceWindow = (startTime: string, endTime: string): { 
    allowed: boolean; 
    message: string;
    details: {
      classPeriod: string;
      attendanceWindow: string;
      currentTime: string;
      windowOpens?: string;
      windowCloses?: string;
      timeUntilOpen?: string;
      windowClosedAt?: string;
    }
  } => {
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;

    const [startHour, startMin] = startTime.split(':').map(Number);
    const startTimeInMinutes = startHour * 60 + startMin;
    const windowStartInMinutes = startTimeInMinutes - 15;

    const [endHour, endMin] = endTime.split(':').map(Number);
    const endTimeInMinutes = endHour * 60 + endMin;
    const windowEndInMinutes = endTimeInMinutes + 15;

    // Format time helper
    const formatTime = (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      const period = h >= 12 ? 'PM' : 'AM';
      const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;
    };

    const currentTimeFormatted = formatTime(currentTimeInMinutes);
    const windowOpenTime = formatTime(windowStartInMinutes);
    const windowCloseTime = formatTime(windowEndInMinutes);
    const classPeriodFormatted = `${formatTime(startTimeInMinutes)} - ${formatTime(endTimeInMinutes)}`;

    if (currentTimeInMinutes < windowStartInMinutes) {
      // Future class - not yet started
      const minutesUntilStart = windowStartInMinutes - currentTimeInMinutes;
      const hoursUntil = Math.floor(minutesUntilStart / 60);
      const minsUntil = minutesUntilStart % 60;
      
      let timeMessage = '';
      if (hoursUntil > 0) {
        timeMessage = `${hoursUntil} hour${hoursUntil > 1 ? 's' : ''} and ${minsUntil} minute${minsUntil !== 1 ? 's' : ''}`;
      } else {
        timeMessage = `${minsUntil} minute${minsUntil !== 1 ? 's' : ''}`;
      }
      
      return {
        allowed: false,
        message: `The class period has not started yet. You can take attendance ${timeMessage} before the class begins (at ${formatTime(startTimeInMinutes)}).`,
        details: {
          classPeriod: classPeriodFormatted,
          attendanceWindow: `${windowOpenTime} to ${windowCloseTime}`,
          currentTime: currentTimeFormatted,
          windowOpens: windowOpenTime,
          windowCloses: windowCloseTime,
          timeUntilOpen: timeMessage
        }
      };
    } else if (currentTimeInMinutes > windowEndInMinutes) {
      // Past class - window closed
      return {
        allowed: false,
        message: `The attendance window has closed. Attendance must be taken within 15 minutes after the class ends (${formatTime(endTimeInMinutes)}).`,
        details: {
          classPeriod: classPeriodFormatted,
          attendanceWindow: `${windowOpenTime} to ${windowCloseTime}`,
          currentTime: currentTimeFormatted,
          windowClosedAt: windowCloseTime
        }
      };
    } else {
      // Active window
      return {
        allowed: true,
        message: 'You are within the attendance window for this class. You can proceed to take attendance.',
        details: {
          classPeriod: classPeriodFormatted,
          attendanceWindow: `${windowOpenTime} (15 min before) to ${windowCloseTime} (15 min after)`,
          currentTime: currentTimeFormatted
        }
      };
    }
  };

  // Handle course selection
  const handleCourseSelect = (courseId: string) => {
    const course = availableSubjects.find(c => c.id === parseInt(courseId));
    setSelectedCourse(course || null);
  };

  // Proceed to capture step
  const handleProceedToCapture = async () => {
    if (!selectedCourse) {
      toast({
        title: "Error",
        description: "Please select a course first",
        variant: "destructive"
      });
      return;
    }

    // Check if attendance is allowed (must be within active time window)
    if (timeWindowStatus && !timeWindowStatus.allowed) {
      toast({
        title: "Attendance Not Allowed",
        description: timeWindowStatus.message,
        variant: "destructive"
      });
      return;
    }

    // If no time window status, it means course doesn't match current period
    if (!timeWindowStatus) {
      toast({
        title: "Attendance Not Allowed",
        description: "You can only take attendance during the active class period for this course.",
        variant: "destructive"
      });
      return;
    }

    // Fetch enrolled students before proceeding
    await fetchEnrolledStudents();

    // Simply transition to capture step
    setStep('capture');
    toast({
      title: "Ready to Capture",
      description: `Proceed to capture attendance for ${selectedCourse.course_name}`,
    });
  };

  // Fetch enrolled students for the selected course
  const fetchEnrolledStudents = async () => {
    if (!selectedCourse) {
      console.log('⚠️ fetchEnrolledStudents: No course selected');
      return;
    }

    console.log('📚 Fetching enrolled students for course:', selectedCourse.id, selectedCourse.course_name);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token');

      const response = await fetch(
        `${API_BASE_URL}/students/enrolled?courseId=${selectedCourse.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('📚 Fetched enrolled students:', data.students?.length || 0);
        console.log('📚 Student list:', data.students?.map((s: any) => s.usn).join(', '));
        setEnrolledStudents(data.students || []);
        
        // Initialize attendance list with all students as absent
        const initialList = (data.students || []).map((student: EnrolledStudent) => ({
          id: student.usn,
          name: student.name,
          status: 'absent' as AttendanceStatus,
          confidence: null,
          markedBy: 'system' as const
        }));
        setAttendanceList(initialList);
        console.log('✅ Initialized attendance list with', initialList.length, 'students');
      } else {
        console.error('❌ Failed to fetch enrolled students:', response.status);
      }
    } catch (error) {
      console.error('Error fetching enrolled students:', error);
    }
  };

  // Capture image from webcam
  const captureImage = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedImages(prev => [...prev, imageSrc]);
      setOriginalImages(prev => [...prev, imageSrc]); // Store original
      toast({
        title: "Image Captured",
        description: `Captured ${capturedImages.length + 1} image(s)`,
      });
    }
  }, [capturedImages.length]);

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File",
          description: "Please upload only image files",
          variant: "destructive"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setCapturedImages(prev => [...prev, base64]);
        setOriginalImages(prev => [...prev, base64]); // Store original
      };
      reader.readAsDataURL(file);
    });

    toast({
      title: "Images Uploaded",
      description: `Added ${files.length} image(s)`,
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove image from gallery
  const removeImage = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
    setOriginalImages(prev => prev.filter((_, i) => i !== index));
    setEnhancementModes(prev => {
      const newModes = { ...prev };
      delete newModes[index];
      // Shift down indices for images after the removed one
      const shifted: { [key: number]: number } = {};
      Object.keys(newModes).forEach(key => {
        const idx = parseInt(key);
        if (idx > index) {
          shifted[idx - 1] = newModes[idx];
        } else {
          shifted[idx] = newModes[idx];
        }
      });
      return shifted;
    });
    toast({
      title: "Image Removed",
      description: `Removed image ${index + 1}`,
    });
  };

  // Handle enhance for capture gallery
  const handleEnhanceImage = async (index: number) => {
    const currentMode = enhancementModes[index] ?? -1;
    const nextMode = (currentMode + 1) % 4;
    
    const originalImage = originalImages[index];
    if (!originalImage) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Enable image smoothing for better quality
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      }
      
      ctx?.drawImage(img, 0, 0);
      
      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      if (!imageData) return;
      
      const data = imageData.data;
      
      // Apply enhancement based on mode with sharpening
      for (let i = 0; i < data.length; i += 4) {
        if (nextMode === 0) { // Bright - moderate brightness + contrast (renamed from Balanced)
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Increase brightness and contrast
          data[i] = Math.min(255, Math.max(0, (r - 128) * 1.3 + 128 + 25));
          data[i + 1] = Math.min(255, Math.max(0, (g - 128) * 1.3 + 128 + 25));
          data[i + 2] = Math.min(255, Math.max(0, (b - 128) * 1.3 + 128 + 25));
        } else if (nextMode === 1) { // Low Light - extra strong brightness for dark images
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Very strong brightness boost with enhanced contrast for face visibility
          // Apply gamma correction for better face detail in shadows
          const gamma = 0.6; // Lower gamma brightens shadows more
          const rNorm = r / 255;
          const gNorm = g / 255;
          const bNorm = b / 255;
          
          const rGamma = Math.pow(rNorm, gamma);
          const gGamma = Math.pow(gNorm, gamma);
          const bGamma = Math.pow(bNorm, gamma);
          
          // Strong brightness and contrast
          data[i] = Math.min(255, Math.max(0, (rGamma * 255 - 128) * 1.5 + 128 + 40));
          data[i + 1] = Math.min(255, Math.max(0, (gGamma * 255 - 128) * 1.5 + 128 + 40));
          data[i + 2] = Math.min(255, Math.max(0, (bGamma * 255 - 128) * 1.5 + 128 + 40));
        } else if (nextMode === 2) { // Warm - warm tone with clarity
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          data[i] = Math.min(255, Math.max(0, (r - 128) * 1.2 + 128 + 15));
          data[i + 1] = Math.min(255, Math.max(0, (g - 128) * 1.1 + 128 + 8));
          data[i + 2] = Math.min(255, Math.max(0, (b - 128) * 1.05 + 128));
        } else if (nextMode === 3) { // Vibrant - color saturation + sharpness
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          data[i] = Math.min(255, Math.max(0, (r - 128) * 1.25 + 128 + 10));
          data[i + 1] = Math.min(255, Math.max(0, (g - 128) * 1.25 + 128 + 10));
          data[i + 2] = Math.min(255, Math.max(0, (b - 128) * 1.25 + 128 + 10));
        }
      }
      
      ctx?.putImageData(imageData, 0, 0);
      
      // Use higher quality JPEG encoding
      const enhancedImage = canvas.toDataURL('image/jpeg', 0.98);
      
      setCapturedImages(prev => {
        const newImages = [...prev];
        newImages[index] = enhancedImage;
        return newImages;
      });
      
      setEnhancementModes(prev => ({ ...prev, [index]: nextMode }));
    };
    
    img.src = originalImage;
  };

  // Handle reset for capture gallery
  const handleResetImage = (index: number) => {
    if (originalImages[index]) {
      setCapturedImages(prev => {
        const newImages = [...prev];
        newImages[index] = originalImages[index];
        return newImages;
      });
      setEnhancementModes(prev => {
        const newModes = { ...prev };
        delete newModes[index];
        return newModes;
      });
      toast({
        title: "Image Reset",
        description: "Restored to original image",
      });
    }
  };

  // Helper function to get image size in KB/MB
  const getImageSize = (base64String: string): string => {
    const stringLength = base64String.length - 'data:image/jpeg;base64,'.length;
    const sizeInBytes = 4 * Math.ceil(stringLength / 3) * 0.5624896334383812;
    const sizeInKB = sizeInBytes / 1024;
    
    if (sizeInKB > 1024) {
      return `${(sizeInKB / 1024).toFixed(2)} MB`;
    }
    return `${sizeInKB.toFixed(2)} KB`;
  };

  // Process captured images with face recognition
  const handleProcessCapture = async () => {
    if (!selectedCourse) {
      toast({
        title: "Error",
        description: "No course selected",
        variant: "destructive"
      });
      return;
    }

    if (capturedImages.length === 0) {
      toast({
        title: "Error",
        description: "Please capture at least one image",
        variant: "destructive"
      });
      return;
    }

    // Store capture time
    setCaptureTime(new Date());

    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token');

      console.log('📤 Sending capture request with', capturedImages.length, 'images');

      // Ensure images are in correct base64 format (with data URL prefix)
      const formattedImages = capturedImages.map(img => {
        // If image doesn't have data URL prefix, add it
        if (!img.startsWith('data:image')) {
          return `data:image/jpeg;base64,${img}`;
        }
        return img;
      });

      console.log('📷 First image format check:', formattedImages[0].substring(0, 50));

      const response = await fetch(`${API_BASE_URL}/attendance/capture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          courseId: selectedCourse.id,
          images: formattedImages
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Capture failed:', error);
        throw new Error(error.message || 'Capture failed');
      }

      const data = await response.json();
      console.log('✅ Capture response:', data);
      console.log('📊 Response details:', {
        success: data.success,
        recognizedCount: data.total_students_recognized,
        facesDetected: data.total_faces_detected,
        hasProcessedImages: !!data.processedImages,
        processedImagesCount: data.processedImages?.length || 0,
        mlError: data.mlError,
        fallbackMode: data.fallbackMode
      });
      
      // Check if ML service failed
      if (data.fallbackMode || data.mlError) {
        throw new Error(data.message || 'Face recognition service is unavailable. Please ensure the Python ML server is running on port 8000.');
      }
      
      // Store total faces detected and recognized count for attendance accuracy calculation
      setTotalFacesDetected(data.total_faces_detected || 0);
      
      // Calculate unique faces: total_faces / number_of_images (approximate)
      // This handles duplicate images better than using raw total
      const uniqueFacesEstimate = capturedImages.length > 0 
        ? Math.round(data.total_faces_detected / capturedImages.length)
        : data.total_faces_detected;
      
      // Check if no faces were detected
      if (data.total_faces_detected === 0) {
        toast({
          title: "No Faces Detected",
          description: "The ML service couldn't detect any faces in the images. Please ensure the images are clear and contain visible faces.",
          variant: "destructive"
        });
      }
      
      // Set annotated images
      if (data.processedImages && data.processedImages.length > 0) {
        console.log('📸 Setting', data.processedImages.length, 'annotated images');
        setAnnotatedImages(data.processedImages);
      } else {
        console.warn('⚠️ No processed images in response');
        toast({
          title: "Warning",
          description: "No annotated images received. The ML service may have encountered an error processing the images.",
          variant: "destructive"
        });
      }

      // Set saved image paths
      if (data.savedImagePath) {
        try {
          const paths = JSON.parse(data.savedImagePath);
          console.log('💾 Saved image paths:', paths);
          setSavedImagePaths(paths);
        } catch (e) {
          console.error('Failed to parse saved image paths');
        }
      }

      // Update attendance list with recognized students
      const recognizedStudents = data.recognizedStudents || [];
      console.log('👥 Recognized students:', recognizedStudents.length);
      console.log('📚 Enrolled students in state:', enrolledStudents.length);
      console.log('📋 Current attendance list length:', attendanceList.length);
      
      // If we have enrolled students, use them as the base
      if (enrolledStudents.length > 0) {
        console.log('✅ Using enrolled students as base');
        // Create attendance list from ALL enrolled students
        const fullList = enrolledStudents.map(student => {
          const recognized = recognizedStudents.find((r: any) => r.usn === student.usn);
          
          if (recognized) {
            // Student was recognized by ML
            return {
              id: student.usn,
              name: student.name,
              status: 'present' as AttendanceStatus,
              confidence: recognized.confidence || null,
              emotion: recognized.emotion || null,
              attentiveness: recognized.attentiveness || null,
              markedBy: 'system' as const
            };
          } else {
            // Student not recognized - mark as absent
            return {
              id: student.usn,
              name: student.name,
              status: 'absent' as AttendanceStatus,
              confidence: null,
              emotion: null,
              attentiveness: null,
              markedBy: 'system' as const
            };
          }
        });
        
        console.log('📊 Created full attendance list with', fullList.length, 'students');
        console.log('📊 Present:', fullList.filter(s => s.status === 'present').length);
        console.log('📊 Absent:', fullList.filter(s => s.status === 'absent').length);
        setAttendanceList(fullList);
      } else if (attendanceList.length > 0) {
        console.log('⚠️ No enrolled students, updating existing attendance list');
        // Update existing attendance list
        setAttendanceList(prev => prev.map(student => {
          const recognized = recognizedStudents.find((r: any) => r.usn === student.id || r.student_id === student.id);
          if (recognized) {
            return {
              ...student,
              status: 'present' as AttendanceStatus,
              confidence: recognized.confidence || null,
              emotion: recognized.emotion || null,
              attentiveness: recognized.attentiveness || null,
              markedBy: 'system' as const
            };
          }
          return student;
        }));
      } else {
        // Fallback: create list from recognized students only
        const initialList = recognizedStudents.map((r: any) => ({
          id: r.usn || r.student_id,
          name: r.name,
          status: 'present' as AttendanceStatus,
          confidence: r.confidence || null,
          emotion: r.emotion || null,
          attentiveness: r.attentiveness || null,
          markedBy: 'system' as const
        }));
        
        setAttendanceList(initialList);
      }

      toast({
        title: "Success",
        description: `Recognized ${data.total_students_recognized || 0} students`,
      });

      console.log('✅ Moving to review step');
      setStep('review');
    } catch (error: any) {
      console.error('❌ Capture error:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to process attendance',
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  // Toggle student attendance status manually
  const toggleStudentStatus = (studentId: string, newStatus: AttendanceStatus | 'excused') => {
    if (newStatus === 'excused') {
      // Open modal for authorized leave
      setSelectedStudentForLeave(studentId);
      setLeaveReason('');
      setShowAuthorizedLeaveModal(true);
    } else {
      // Direct status change (present or absent)
      setAttendanceList(prev => prev.map(student => {
        if (student.id === studentId) {
          return {
            ...student,
            status: newStatus,
            reasonType: null, // Clear reason if changing from excused
            markedBy: 'manual' as const
          };
        }
        return student;
      }));
    }
  };

  // Confirm authorized leave with reason
  const confirmAuthorizedLeave = () => {
    if (!selectedStudentForLeave || !leaveReason) {
      toast({
        title: "Error",
        description: "Please select a reason for authorized leave",
        variant: "destructive"
      });
      return;
    }

    setAttendanceList(prev => prev.map(student => {
      if (student.id === selectedStudentForLeave) {
        return {
          ...student,
          status: 'excused' as const,
          reasonType: leaveReason,
          markedBy: 'manual' as const
        };
      }
      return student;
    }));

    setShowAuthorizedLeaveModal(false);
    setSelectedStudentForLeave(null);
    setLeaveReason('');
    
    toast({
      title: "Success",
      description: "Authorized leave recorded",
    });
  };

  // Handle retake photos
  const handleRetakePhotos = () => {
    setStep('capture');
    // Keep existing images - don't clear them
  };

  // Handle cancel session
  const handleCancelSession = () => {
    if (confirm('Are you sure you want to cancel this session? All data will be lost.')) {
      handleReset();
    }
  };

  // Submit attendance
  const handleSubmit = async () => {
    if (!selectedCourse) return;

    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token');

      const presentCount = attendanceList.filter(a => a.status === 'present').length;
      const absentCount = attendanceList.filter(a => a.status === 'absent').length;
      
      // Calculate MODEL ACCURACY: Average confidence score of all recognized students
      // This measures how confident the ML model was in its predictions
      const recognizedStudents = attendanceList.filter(a => a.confidence !== null && a.confidence > 0);
      const totalConfidence = recognizedStudents.reduce((sum, student) => sum + (student.confidence || 0), 0);
      const modelAccuracy = recognizedStudents.length > 0 ? totalConfidence / recognizedStudents.length : 0;

      const response = await fetch(`${API_BASE_URL}/attendance/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          courseId: selectedCourse.id,
          sessionDate: format(date, 'yyyy-MM-dd'),
          sessionTime: format(new Date(), 'HH:mm'),
          capturedImagePath: savedImagePaths.length > 0 ? JSON.stringify(savedImagePaths) : null,
          totalStudents: attendanceList.length,
          presentCount,
          absentCount,
          recognitionAccuracy: modelAccuracy, // Store model accuracy (average confidence)
          attendanceRecords: attendanceList.map(a => ({
            studentId: a.id,
            status: a.status,
            confidence: a.confidence,
            markedBy: a.markedBy || 'system',
            emotion: a.emotion,
            attentiveness: a.attentiveness,
            reasonType: a.reasonType || null
          }))
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Submit failed');
      }

      toast({
        title: "Success",
        description: "Attendance submitted successfully",
      });

      // Show ML calculation notification
      setTimeout(() => {
        toast({
          title: "ML Analysis Running",
          description: "Student analytics are being calculated in the background. This may take a few moments.",
          duration: 5000,
        });
      }, 1000);

      setStep('submitted');
      setShowSubmitConfirm(false);
    } catch (error: any) {
      console.error('Submit error:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to submit attendance',
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  // Reset and start over
  const handleReset = () => {
    setStep('filter');
    setCapturedImages([]);
    setAnnotatedImages([]);
    setSavedImagePaths([]);
    setAttendanceList([]);
    setEnrolledStudents([]);
    setSelectedCourse(null);
    setFilterSemester("");
    setFilterDepartment("");
    setFilterSection("");
    setSessionId(null);
    setIsCameraOpen(false);
  };

  if (!currentUser || currentUser.role !== 'teacher') {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              Only teachers can access this page
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Take Attendance</h1>
          <p className="text-muted-foreground">Capture and submit attendance with face recognition</p>
        </div>
        {step !== 'filter' && (
          <Button variant="outline" onClick={handleReset}>
            Start Over
          </Button>
        )}
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-4">
        <div className={cn("flex items-center gap-2", step === 'filter' && "text-primary font-semibold")}>
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", 
            step === 'filter' ? "bg-primary text-primary-foreground" : "bg-muted")}>
            1
          </div>
          <span>Select Course</span>
        </div>
        <div className="w-12 h-0.5 bg-muted" />
        <div className={cn("flex items-center gap-2", step === 'capture' && "text-primary font-semibold")}>
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", 
            step === 'capture' ? "bg-primary text-primary-foreground" : "bg-muted")}>
            2
          </div>
          <span>Capture</span>
        </div>
        <div className="w-12 h-0.5 bg-muted" />
        <div className={cn("flex items-center gap-2", step === 'review' && "text-primary font-semibold")}>
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", 
            step === 'review' ? "bg-primary text-primary-foreground" : "bg-muted")}>
            3
          </div>
          <span>Review</span>
        </div>
      </div>

      {/* Step 1: Filter Selection */}
      {step === 'filter' && (
        <Card>
          <CardHeader>
            <CardTitle>Select Course</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loadingCourses ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : teacherCourses.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
                <p className="text-lg font-semibold">No Courses Assigned</p>
                <p className="text-muted-foreground">You don't have any courses assigned yet. Please contact the admin.</p>
              </div>
            ) : (
              <>
                {/* Today's Date Display */}
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="font-semibold text-blue-900 dark:text-blue-100">Today's Date</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">{format(date, 'PPPP')}</p>
                    </div>
                  </div>
                </div>

                {/* Semester Filter */}
                <div className="space-y-2">
                  <Label>Semester</Label>
                  <Select value={filterSemester} onValueChange={setFilterSemester}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Semester" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSemesters.map(sem => (
                        <SelectItem key={sem} value={sem.toString()}>Semester {sem}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Department Filter */}
                {filterSemester && (
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select value={filterDepartment} onValueChange={setFilterDepartment} disabled={!filterSemester}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Department" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDepartments.map(dept => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Section Filter */}
                {filterDepartment && (
                  <div className="space-y-2">
                    <Label>Section</Label>
                    <Select value={filterSection} onValueChange={setFilterSection} disabled={!filterDepartment}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Section" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSections.map(sec => (
                          <SelectItem key={sec} value={sec}>Section {sec}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Timetable Display - Full width breakout */}
                {filterSection && teacherSchedule.length > 0 && (
                  <div className="-mx-6 px-0">
                    <div className="px-6 mb-2">
                      <Label>Today's Schedule</Label>
                    </div>
                    <TimetableDisplay 
                      schedule={teacherSchedule}
                      currentDate={format(date, 'yyyy-MM-dd')}
                    />
                  </div>
                )}

                {/* Subject/Course Selection */}
                {filterSection && availableSubjects.length > 0 && (
                  <div className="space-y-2">
                    <Label>Course</Label>
                    <Select 
                      value={selectedCourse?.id.toString() || ""} 
                      onValueChange={handleCourseSelect}
                      disabled={!filterSection}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Course" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSubjects.map(course => (
                          <SelectItem key={course.id} value={course.id.toString()}>
                            {course.course_code} - {course.course_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Time Window Warning - RED for Past, AMBER for Future */}
                {selectedCourse && timeWindowStatus && !timeWindowStatus.allowed && (
                  <div className={`border-2 rounded-lg p-4 ${
                    timeWindowStatus.details.windowClosedAt 
                      ? 'bg-red-50 dark:bg-red-950 border-red-500 dark:border-red-700' 
                      : 'bg-amber-50 dark:bg-amber-950 border-amber-500 dark:border-amber-700'
                  }`}>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`h-6 w-6 mt-0.5 flex-shrink-0 ${
                        timeWindowStatus.details.windowClosedAt 
                          ? 'text-red-600 dark:text-red-400' 
                          : 'text-amber-600 dark:text-amber-400'
                      }`} />
                      <div className="flex-1">
                        <p className={`font-bold text-lg ${
                          timeWindowStatus.details.windowClosedAt 
                            ? 'text-red-900 dark:text-red-100' 
                            : 'text-amber-900 dark:text-amber-100'
                        }`}>
                          {timeWindowStatus.details.windowClosedAt ? 'Attendance Not Allowed' : 'Not Yet Started'}
                        </p>
                        <p className={`text-sm mt-2 ${
                          timeWindowStatus.details.windowClosedAt 
                            ? 'text-red-700 dark:text-red-300' 
                            : 'text-amber-700 dark:text-amber-300'
                        }`}>
                          {timeWindowStatus.message}
                        </p>
                        
                        {/* Detailed Info - Compact */}
                        <div className={`mt-3 p-3 rounded border text-xs space-y-1 ${
                          timeWindowStatus.details.windowClosedAt 
                            ? 'bg-red-100 dark:bg-red-900 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200' 
                            : 'bg-amber-100 dark:bg-amber-900 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                        }`}>
                          <div><strong>Class:</strong> {timeWindowStatus.details.classPeriod}</div>
                          <div><strong>Window:</strong> {timeWindowStatus.details.attendanceWindow}</div>
                          <div><strong>Now:</strong> {timeWindowStatus.details.currentTime}</div>
                          {timeWindowStatus.details.timeUntilOpen && (
                            <div><strong>Opens in:</strong> {timeWindowStatus.details.timeUntilOpen}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* No Current Period Warning - Course not in timetable */}
                {selectedCourse && !timeWindowStatus && (
                  <div className="bg-amber-50 dark:bg-amber-950 border-2 border-amber-500 dark:border-amber-700 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-bold text-amber-900 dark:text-amber-100 text-lg">Not Scheduled Today</p>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
                          This course is not scheduled for today. Attendance can only be taken during scheduled class times.
                        </p>
                        
                        {/* Detailed Info - Compact */}
                        <div className="mt-3 p-3 rounded border bg-amber-100 dark:bg-amber-900 border-amber-300 dark:border-amber-700 text-xs space-y-1 text-amber-800 dark:text-amber-200">
                          <div><strong>Course:</strong> {selectedCourse.course_code} - {selectedCourse.course_name}</div>
                          <div><strong>Date:</strong> {format(date, 'EEEE, MMM d, yyyy')}</div>
                          <div className="text-amber-700 dark:text-amber-300 pt-1">Check the timetable above for scheduled classes.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Active Time Window - Green */}
                {selectedCourse && timeWindowStatus && timeWindowStatus.allowed && (
                  <div className="bg-green-50 dark:bg-green-950 border-2 border-green-500 dark:border-green-700 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-bold text-green-900 dark:text-green-100 text-lg">✓ Attendance Allowed</p>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                          You are within the attendance window. Proceed to take attendance.
                        </p>
                        
                        {/* Detailed Info - Compact */}
                        <div className="mt-3 p-3 rounded border bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700 text-xs space-y-1 text-green-800 dark:text-green-200">
                          <div><strong>Class:</strong> {timeWindowStatus.details.classPeriod}</div>
                          <div><strong>Window:</strong> {timeWindowStatus.details.attendanceWindow}</div>
                          <div><strong>Now:</strong> {timeWindowStatus.details.currentTime} ✓</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Selected Course Info */}
                {selectedCourse && (
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <p className="font-semibold">Selected Course:</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                        Semester {selectedCourse.semester}
                      </Badge>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {selectedCourse.department}
                      </Badge>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        Section {selectedCourse.section}
                      </Badge>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {selectedCourse.course_code}
                      </Badge>
                      <Badge variant="outline">{selectedCourse.course_name}</Badge>
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleProceedToCapture} 
                  disabled={!selectedCourse || (timeWindowStatus && !timeWindowStatus.allowed) || !timeWindowStatus}
                  className="w-full"
                  size="lg"
                >
                  Continue to Capture
                </Button>
                
                {selectedCourse && (!timeWindowStatus || !timeWindowStatus.allowed) && (
                  <p className="text-sm text-center text-muted-foreground">
                    Button will be enabled when you are within the attendance window
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Capture */}
      {step === 'capture' && (
        <Card>
          <CardHeader>
            <CardTitle>Capture Attendance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Date:</span>
                  <span className="ml-2 font-medium">{format(date, 'PPPP')}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Course:</span>
                  <span className="ml-2 font-medium">{selectedCourse?.course_code} - {selectedCourse?.course_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Semester:</span>
                  <span className="ml-2 font-medium">{selectedCourse?.semester}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Department:</span>
                  <span className="ml-2 font-medium">{selectedCourse?.department}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Section:</span>
                  <span className="ml-2 font-medium">{selectedCourse?.section}</span>
                </div>
                {currentPeriod && (
                  <div>
                    <span className="text-muted-foreground">Class Time:</span>
                    <span className="ml-2 font-medium">{currentPeriod.start_time} - {currentPeriod.end_time}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Important Notes - Collapsible */}
            <div className="border-2 border-blue-500 rounded-lg overflow-hidden">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="font-bold text-blue-900 dark:text-blue-100">Important Notes - Please Read Before Capturing</span>
                </div>
                <Button
                  onClick={() => setShowImportantNotes(!showImportantNotes)}
                  variant="outline"
                  size="sm"
                  className="border-blue-500 text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900"
                >
                  {showImportantNotes ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Hide
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Show
                    </>
                  )}
                </Button>
              </div>
              
              {showImportantNotes && (
                <div className="bg-blue-50/50 dark:bg-blue-950/50 p-4 space-y-3 text-sm border-t-2 border-blue-500">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <span className="font-bold text-blue-900 dark:text-blue-100 min-w-[20px]">1.</span>
                      <div>
                        <span className="font-semibold text-blue-900 dark:text-blue-100">Group Size:</span>
                        <span className="text-blue-800 dark:text-blue-200"> Take photos with 15-18 students per photo</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <span className="font-bold text-blue-900 dark:text-blue-100 min-w-[20px]">2.</span>
                      <div>
                        <span className="font-semibold text-blue-900 dark:text-blue-100">Face Visibility:</span>
                        <span className="text-blue-800 dark:text-blue-200"> Ensure all students' full faces are visible in the photo</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <span className="font-bold text-blue-900 dark:text-blue-100 min-w-[20px]">3.</span>
                      <div>
                        <span className="font-semibold text-blue-900 dark:text-blue-100">Camera Direction:</span>
                        <span className="text-blue-800 dark:text-blue-200"> All students should face and look directly at the camera</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <span className="font-bold text-blue-900 dark:text-blue-100 min-w-[20px]">4.</span>
                      <div>
                        <span className="font-semibold text-blue-900 dark:text-blue-100">Remove Obstructions:</span>
                        <span className="text-blue-800 dark:text-blue-200"> Ask students to remove hats, masks, or anything covering their faces</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <span className="font-bold text-blue-900 dark:text-blue-100 min-w-[20px]">5.</span>
                      <div>
                        <span className="font-semibold text-blue-900 dark:text-blue-100">Photo Clarity:</span>
                        <span className="text-blue-800 dark:text-blue-200"> Ensure the photo is clear and bright. Retake if image is blurry or dark</span>
                        <div className="mt-2 ml-4 space-y-1 text-xs bg-white/50 dark:bg-black/20 p-2 rounded border border-blue-200 dark:border-blue-800">
                          <div className="font-semibold text-blue-900 dark:text-blue-100">Enhancement Modes Available:</div>
                          <div className="flex items-start gap-1">
                            <span>✨</span>
                            <div><span className="font-medium">Bright:</span> Use for normal lighting - adds moderate brightness and contrast</div>
                          </div>
                          <div className="flex items-start gap-1">
                            <span>🌙</span>
                            <div><span className="font-medium">Low Light:</span> Use for dark/dim photos - significantly brightens shadows and enhances face visibility</div>
                          </div>
                          <div className="flex items-start gap-1">
                            <span>🔥</span>
                            <div><span className="font-medium">Warm:</span> Use for cool-toned photos - adds warmth and improves skin tones</div>
                          </div>
                          <div className="flex items-start gap-1">
                            <span>🎨</span>
                            <div><span className="font-medium">Vibrant:</span> Use for dull photos - boosts colors and sharpness</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <span className="font-bold text-blue-900 dark:text-blue-100 min-w-[20px]">6.</span>
                      <div>
                        <span className="font-semibold text-blue-900 dark:text-blue-100">Face Detection:</span>
                        <div className="mt-1 space-y-1 ml-4">
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 font-bold">●</span>
                            <span className="text-blue-800 dark:text-blue-200"><span className="font-medium">Green Box:</span> Student face detected correctly. No action needed</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-red-600 dark:text-red-400 font-bold">●</span>
                            <span className="text-blue-800 dark:text-blue-200"><span className="font-medium">Red Box:</span> Student face not detected or unclear. Please recheck and retake</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-gray-600 dark:text-gray-400 font-bold">●</span>
                            <span className="text-blue-800 dark:text-blue-200"><span className="font-medium">No Box:</span> Student not detected in photo. Please retake ensuring all students are visible</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <span className="font-bold text-blue-900 dark:text-blue-100 min-w-[20px]">7.</span>
                      <div>
                        <span className="font-semibold text-blue-900 dark:text-blue-100">Verification:</span>
                        <span className="text-blue-800 dark:text-blue-200"> Only if you see Red Boxes or students with No Box - Review and retake the photo with better positioning before confirming attendance</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Camera and Upload Options */}
            <div className="grid grid-cols-2 gap-3">
              {!isCameraOpen ? (
                <Button onClick={() => setIsCameraOpen(true)} className="w-full" size="lg" variant="default">
                  <Camera className="mr-2 h-4 w-4" />
                  Open Camera
                </Button>
              ) : (
                <Button onClick={() => setIsCameraOpen(false)} className="w-full" variant="outline" size="lg">
                  Close Camera
                </Button>
              )}
              
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                className="w-full" 
                size="lg"
                variant="outline"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Images
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Camera View */}
            {isCameraOpen && (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden border">
                  <Webcam
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="w-full"
                    videoConstraints={{
                      facingMode: "user",
                      width: 1280,
                      height: 720
                    }}
                  />
                </div>
                <Button onClick={captureImage} className="w-full" size="lg">
                  <Camera className="mr-2 h-4 w-4" />
                  Capture Image ({capturedImages.length})
                </Button>
              </div>
            )}

            {/* Captured Images Gallery */}
            {capturedImages.length > 0 && (
              <div>
                <Label className="mb-2 block">Captured Images ({capturedImages.length})</Label>
                <div className="grid grid-cols-1 gap-4">
                  {capturedImages.map((img, idx) => (
                    <div key={idx} className="flex flex-col gap-2">
                      {/* Image container - Larger and flexible */}
                      <div className="relative rounded-md border bg-gray-100 min-h-[400px] max-h-[800px] h-auto">
                        <img src={img} className="w-full h-auto max-h-[750px] object-contain rounded-md" alt={`Capture ${idx + 1}`} />
                        
                        {/* Image size badge - top-left */}
                        <div className="absolute top-3 left-3 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
                          {getImageSize(img)}
                        </div>
                        
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
                          <span>{enhancementModes[idx] === -1 || enhancementModes[idx] === undefined ? 'Enhance' : enhancementModes[idx] === 0 ? 'Bright' : enhancementModes[idx] === 1 ? 'Low Light' : enhancementModes[idx] === 2 ? 'Warm' : 'Vibrant'}</span>
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
              </div>
            )}

            <Button 
              onClick={handleProcessCapture} 
              disabled={capturedImages.length === 0 || processing}
              className="w-full"
              size="lg"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing with Face Recognition...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Process Attendance
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review */}
      {step === 'review' && (
        <div className="space-y-6">
          {/* Course Information */}
          <Card>
            <CardHeader>
              <CardTitle>Review Attendance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Course</Label>
                  <p className="font-medium">{selectedCourse?.course_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Course Code</Label>
                  <p className="font-medium">{selectedCourse?.course_code}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Semester</Label>
                  <p className="font-medium">Semester {selectedCourse?.semester}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Department</Label>
                  <p className="font-medium">{selectedCourse?.department}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Section</Label>
                  <p className="font-medium">{selectedCourse?.section}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date & Time</Label>
                  <p className="font-medium">
                    {captureTime ? format(captureTime, 'MMMM d, yyyy \'at\' h:mm a') : format(date, 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Annotated Images */}
          {annotatedImages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Captured Images</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {annotatedImages.map((img, idx) => (
                    <div key={idx} className="relative">
                      <img src={`data:image/jpeg;base64,${img}`} alt={`Annotated ${idx + 1}`} className="rounded border w-full" />
                      <div className="absolute top-2 left-2 bg-black/70 text-white px-3 py-1 rounded text-sm">
                        Image {idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Attendance Records */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance Records</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Summary Statistics */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {attendanceList.length}
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">Total</p>
                </div>
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {attendanceList.filter(a => a.status === 'present').length}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">Present</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-950 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                    {attendanceList.filter(a => a.status === 'excused').length}
                  </p>
                  <p className="text-sm text-orange-600 dark:text-orange-400">Authorized Leave</p>
                </div>
                <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                    {attendanceList.filter(a => a.status === 'absent').length}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400">Absent</p>
                </div>
              </div>

              {/* Accuracy Metrics */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg border-2 border-purple-200 dark:border-purple-800">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                      {(() => {
                        const recognizedStudents = attendanceList.filter(a => a.confidence !== null && a.confidence > 0);
                        if (recognizedStudents.length === 0) return '0';
                        const totalConfidence = recognizedStudents.reduce((sum, student) => sum + (student.confidence || 0), 0);
                        const avgConfidence = totalConfidence / recognizedStudents.length;
                        return (avgConfidence * 100).toFixed(1);
                      })()}%
                    </p>
                    <p className="text-sm font-semibold text-purple-600 dark:text-purple-400 mt-1">Model Accuracy</p>
                    <p className="text-xs text-purple-500 dark:text-purple-500 mt-1">Average confidence score</p>
                  </div>
                </div>
                <div className="bg-teal-50 dark:bg-teal-950 p-4 rounded-lg border-2 border-teal-200 dark:border-teal-800">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-teal-700 dark:text-teal-300">
                      {(() => {
                        const systemRecognized = attendanceList.filter(a => a.markedBy === 'system' && a.status === 'present').length;
                        const manuallyMarked = attendanceList.filter(a => a.markedBy === 'manual' && a.status === 'present').length;
                        const totalPresent = systemRecognized + manuallyMarked;
                        
                        // If teacher manually marked students, include them in denominator
                        // This accounts for unknown faces (red boxes) that teacher identified
                        const denominator = totalPresent > 0 ? totalPresent : 1;
                        
                        if (systemRecognized === 0 && totalPresent === 0) return '0';
                        return ((systemRecognized / denominator) * 100).toFixed(1);
                      })()}%
                    </p>
                    <p className="text-sm font-semibold text-teal-600 dark:text-teal-400 mt-1">Attendance Accuracy</p>
                    <p className="text-xs text-teal-500 dark:text-teal-500 mt-1">Auto-recognized / Total present</p>
                  </div>
                </div>
              </div>

              {/* Student List - Table Format */}
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/80 sticky top-0 z-10">
                      <tr className="border-b-2">
                        <th className="text-center p-3 font-bold w-16">#</th>
                        <th className="text-left p-3 font-bold w-32">USN</th>
                        <th className="text-left p-3 font-bold">Name</th>
                        <th className="text-center p-3 font-bold">Status</th>
                        <th className="text-center p-3 font-bold">Reason</th>
                        <th className="text-center p-3 font-bold">Marked By</th>
                        <th className="text-center p-3 font-bold">Confidence</th>
                        <th className="text-center p-3 font-bold">Emotion</th>
                        <th className="text-center p-3 font-bold">Attentiveness</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-950">
                      {attendanceList
                        .sort((a, b) => a.id.localeCompare(b.id))
                        .map((student, index) => (
                        <tr 
                          key={student.id} 
                          className={cn(
                            "border-b hover:bg-muted/30 transition-colors",
                            index % 2 === 0 ? "bg-gray-50/50 dark:bg-gray-900/50" : ""
                          )}
                        >
                          <td className="p-3 text-center font-semibold text-muted-foreground">
                            {index + 1}
                          </td>
                          <td className="p-3 font-mono text-xs">{student.id}</td>
                          <td className="p-3 font-medium">{student.name}</td>
                          <td className="p-3">
                            <div className="flex gap-2 justify-center">
                              <Button
                                size="sm"
                                variant={student.status === 'present' ? 'default' : 'outline'}
                                className={cn(
                                  "text-xs px-3",
                                  student.status === 'present' && "bg-green-600 hover:bg-green-700 text-white"
                                )}
                                onClick={() => toggleStudentStatus(student.id, 'present')}
                              >
                                Present
                              </Button>
                              <Button
                                size="sm"
                                variant={student.status === 'excused' ? 'default' : 'outline'}
                                className={cn(
                                  "text-xs px-3",
                                  student.status === 'excused' && "bg-orange-600 hover:bg-orange-700 text-white"
                                )}
                                onClick={() => toggleStudentStatus(student.id, 'excused')}
                              >
                                Authorized Leave
                              </Button>
                              <Button
                                size="sm"
                                variant={student.status === 'absent' ? 'destructive' : 'outline'}
                                className="text-xs px-3"
                                onClick={() => toggleStudentStatus(student.id, 'absent')}
                              >
                                Absent
                              </Button>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            {student.status === 'excused' && student.reasonType ? (
                              <span className="px-2 py-1 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 rounded text-xs font-semibold inline-block">
                                {student.reasonType === 'medical' && 'Medical Emergency'}
                                {student.reasonType === 'family' && 'Family Emergency'}
                                {student.reasonType === 'academic' && 'Academic Activity'}
                                {student.reasonType === 'sports' && 'Sports/NCC/NSS'}
                                {student.reasonType === 'internship' && 'Internship/Interview/Hackathon/Workshop'}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className={cn(
                              "px-2 py-1 rounded text-xs font-semibold inline-block",
                              student.markedBy === 'manual' 
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" 
                                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            )}>
                              {student.markedBy === 'manual' ? 'Manual' : 'System'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {student.confidence ? (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded text-xs font-semibold">
                                {Math.round(student.confidence * 100)}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {student.emotion ? (
                              <span className={cn(
                                "px-2 py-1 rounded text-xs font-semibold capitalize inline-block",
                                student.emotion === 'happy' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
                                student.emotion === 'neutral' && "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
                                student.emotion === 'sad' && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                                !['happy', 'neutral', 'sad'].includes(student.emotion) && "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                              )}>
                                {student.emotion}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {student.attentiveness ? (
                              <span className={cn(
                                "px-2 py-1 rounded text-xs font-semibold inline-block",
                                student.attentiveness === 'High' && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                                student.attentiveness === 'Medium' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
                                student.attentiveness === 'Low' && "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                              )}>
                                {student.attentiveness}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 mt-6">
                <Button 
                  onClick={handleRetakePhotos}
                  variant="outline"
                  className="flex-1"
                >
                  Retake Photos
                </Button>
                <Button 
                  onClick={handleCancelSession}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => setShowSubmitConfirm(true)} 
                  disabled={processing}
                  className="flex-1"
                >
                  Submit Attendance
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Authorized Leave Modal */}
      <AlertDialog open={showAuthorizedLeaveModal} onOpenChange={setShowAuthorizedLeaveModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Select Reason for Authorized Leave</AlertDialogTitle>
            <AlertDialogDescription>
              Please select a reason for the authorized leave. This is required.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <Select value={leaveReason} onValueChange={setLeaveReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="medical">Medical Emergency</SelectItem>
                <SelectItem value="family">Family Emergency</SelectItem>
                <SelectItem value="academic">Academic Activity</SelectItem>
                <SelectItem value="sports">Sports/NCC/NSS</SelectItem>
                <SelectItem value="internship">Internship/Interview/Hackathon/Workshop</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowAuthorizedLeaveModal(false);
              setSelectedStudentForLeave(null);
              setLeaveReason('');
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmAuthorizedLeave} disabled={!leaveReason}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Step 4: Submitted */}
      {step === 'submitted' && (
        <Card>
          <CardContent className="p-12 text-center space-y-6">
            <CheckCircle2 className="h-20 w-20 mx-auto text-green-500" />
            <div>
              <h2 className="text-3xl font-bold">Attendance Submitted Successfully!</h2>
              <p className="text-muted-foreground mt-2">
                Attendance has been recorded for {selectedCourse?.course_name}
              </p>
            </div>

            {/* Session Summary */}
            <div className="bg-muted/30 p-6 rounded-lg space-y-3 max-w-md mx-auto">
              <h3 className="font-semibold text-lg">Session Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-left">
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{captureTime ? format(captureTime, 'MMMM d, yyyy') : format(date, 'MMMM d, yyyy')}</p>
                </div>
                <div className="text-left">
                  <p className="text-muted-foreground">Time</p>
                  <p className="font-medium">{captureTime ? format(captureTime, 'h:mm a') : format(new Date(), 'h:mm a')}</p>
                </div>
                <div className="text-left">
                  <p className="text-muted-foreground">Course</p>
                  <p className="font-medium">{selectedCourse?.course_name}</p>
                </div>
                <div className="text-left">
                  <p className="text-muted-foreground">Semester</p>
                  <p className="font-medium">Semester {selectedCourse?.semester}</p>
                </div>
                <div className="text-left">
                  <p className="text-muted-foreground">Department</p>
                  <p className="font-medium">{selectedCourse?.department}</p>
                </div>
                <div className="text-left">
                  <p className="text-muted-foreground">Section</p>
                  <p className="font-medium">{selectedCourse?.section}</p>
                </div>
              </div>
            </div>

            {/* Attendance Summary */}
            <div className="bg-muted/30 p-6 rounded-lg space-y-3 max-w-md mx-auto">
              <h3 className="font-semibold text-lg">Attendance Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded">
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {attendanceList.length}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Total Students</p>
                </div>
                <div className="bg-green-50 dark:bg-green-950 p-3 rounded">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {attendanceList.filter(a => a.status === 'present').length}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">Present</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-950 p-3 rounded">
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                    {attendanceList.filter(a => a.status === 'excused').length}
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-400">Authorized Leave</p>
                </div>
                <div className="bg-red-50 dark:bg-red-950 p-3 rounded">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                    {attendanceList.filter(a => a.status === 'absent').length}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">Absent</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-sm text-muted-foreground">Model Accuracy</p>
                  <p className="text-2xl font-bold">
                    {(() => {
                      const recognizedStudents = attendanceList.filter(a => a.confidence !== null && a.confidence > 0);
                      if (recognizedStudents.length === 0) return '0';
                      const totalConfidence = recognizedStudents.reduce((sum, student) => sum + (student.confidence || 0), 0);
                      const avgConfidence = totalConfidence / recognizedStudents.length;
                      return (avgConfidence * 100).toFixed(1);
                    })()}%
                  </p>
                  <p className="text-xs text-muted-foreground">Avg confidence score</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Attendance Accuracy</p>
                  <p className="text-2xl font-bold">
                    {(() => {
                      const systemRecognized = attendanceList.filter(a => a.markedBy === 'system' && a.status === 'present').length;
                      const manuallyMarked = attendanceList.filter(a => a.markedBy === 'manual' && a.status === 'present').length;
                      const totalPresent = systemRecognized + manuallyMarked;
                      
                      // If teacher manually marked students, include them in denominator
                      // This accounts for unknown faces (red boxes) that teacher identified
                      const denominator = totalPresent > 0 ? totalPresent : 1;
                      
                      if (systemRecognized === 0 && totalPresent === 0) return '0';
                      return ((systemRecognized / denominator) * 100).toFixed(1);
                    })()}%
                  </p>
                  <p className="text-xs text-muted-foreground">Auto-recognized / Total present</p>
                </div>
              </div>
            </div>

            <Button onClick={handleReset} size="lg" className="mt-6">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Attendance Submission</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                You are about to submit attendance for {selectedCourse?.course_name}.
                <div className="mt-4 space-y-2">
                  <p><strong>Present:</strong> {attendanceList.filter(a => a.status === 'present').length} students</p>
                  <p><strong>Authorized Leave:</strong> {attendanceList.filter(a => a.status === 'excused').length} students</p>
                  <p><strong>Absent:</strong> {attendanceList.filter(a => a.status === 'absent').length} students</p>
                  <p className="text-sm text-muted-foreground mt-4">
                    This action cannot be undone. Make sure all attendance records are correct.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Confirm & Submit'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
