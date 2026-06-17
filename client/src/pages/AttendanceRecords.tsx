import { useState, useEffect } from "react";
import { useStore, AttendanceStatus } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Calendar as CalendarIcon, FileText, AlertTriangle, Edit, Save, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
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

interface AttendanceRecord {
  id: string;
  name: string;
  status: AttendanceStatus | 'excused';
  emotion?: string | null;
  attentiveness?: string | null;
  reasonType?: string;
  confidence?: number | null;
  markedBy?: string;
  markedAt?: string;
}

interface SessionData {
  session: {
    id: number;
    date: string;
    time: string;
    totalStudents: number;
    presentCount: number;
    absentCount: number;
    capturedImagePath: string | null;
    capturedImagePaths: string[];
  };
  attendanceRecords: AttendanceRecord[];
}

export default function AttendanceRecords() {
  const { currentUser } = useStore();
  const { toast } = useToast();

  // Course selection state
  const [teacherCourses, setTeacherCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  
  // Dynamic filter options
  const [availableSemesters, setAvailableSemesters] = useState<number[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  
  // Filter selections
  const [filterSemester, setFilterSemester] = useState<string>("");
  const [filterDepartment, setFilterDepartment] = useState<string>("");
  const [filterSection, setFilterSection] = useState<string>("");
  const [date, setDate] = useState<Date>(new Date());
  
  // Data state
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filtersLocked, setFiltersLocked] = useState(false);
  
  // Edit state (per session)
  const [editingSessions, setEditingSessions] = useState<{[sessionId: number]: boolean}>({});
  const [editedRecords, setEditedRecords] = useState<{[sessionId: number]: AttendanceRecord[]}>({});
  const [hasChanges, setHasChanges] = useState<{[sessionId: number]: boolean}>({});
  const [changedStudents, setChangedStudents] = useState<{[sessionId: number]: Set<string>}>({});
  
  // Authorized leave modal state
  const [showAuthorizedLeaveModal, setShowAuthorizedLeaveModal] = useState(false);
  const [selectedStudentForLeave, setSelectedStudentForLeave] = useState<{sessionId: number; studentId: string} | null>(null);
  const [leaveReason, setLeaveReason] = useState<string>('');

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
          
          const courses = data.courses || [];
          const semesterSet = new Set<number>(courses.map((c: Course) => c.semester));
          const semesters = Array.from(semesterSet).sort((a, b) => a - b);
          setAvailableSemesters(semesters);
        }
      } catch (error) {
        console.error('Error fetching courses:', error);
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

  // Update available courses when section changes
  useEffect(() => {
    if (!filterSemester || !filterDepartment || !filterSection) {
      setAvailableCourses([]);
      setSelectedCourse(null);
      return;
    }

    const filtered = teacherCourses.filter(c => 
      c.semester === parseInt(filterSemester) && 
      c.department === filterDepartment &&
      c.section === filterSection
    );
    setAvailableCourses(filtered);
    
    if (selectedCourse && !filtered.find(c => c.id === selectedCourse.id)) {
      setSelectedCourse(null);
    }
  }, [filterSemester, filterDepartment, filterSection, teacherCourses]);

  // Load records when course or date changes
  const loadRecords = async () => {
    if (!selectedCourse || !date) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token');

      const dateStr = format(date, 'yyyy-MM-dd');
      const response = await fetch(
        `${API_BASE_URL}/attendance/records?courseId=${selectedCourse.id}&date=${dateStr}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
        setFiltersLocked(true);
      } else if (response.status === 404) {
        setSessions([]);
        toast({
          title: "No Records Found",
          description: "No attendance sessions found for the selected course and date",
          variant: "destructive"
        });
      } else {
        throw new Error('Failed to load records');
      }
    } catch (error: any) {
      console.error('Error loading records:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load attendance records",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle edit mode for a session
  const toggleEdit = (sessionId: number) => {
    const session = sessions.find(s => s.session.id === sessionId);
    if (!session) return;

    // Check if this is today's session
    const sessionDate = new Date(session.session.date);
    const today = new Date();
    const isToday = sessionDate.toDateString() === today.toDateString();

    if (!isToday) {
      toast({
        title: "Cannot Edit",
        description: "You can only edit today's attendance records",
        variant: "destructive"
      });
      return;
    }

    const isEditing = editingSessions[sessionId];
    
    if (!isEditing) {
      // Start editing - copy records
      setEditedRecords(prev => ({
        ...prev,
        [sessionId]: [...session.attendanceRecords]
      }));
      setEditingSessions(prev => ({ ...prev, [sessionId]: true }));
    } else {
      // Cancel editing
      setEditingSessions(prev => ({ ...prev, [sessionId]: false }));
      setEditedRecords(prev => {
        const newRecords = { ...prev };
        delete newRecords[sessionId];
        return newRecords;
      });
      setHasChanges(prev => ({ ...prev, [sessionId]: false }));
      setChangedStudents(prev => {
        const newChanged = { ...prev };
        delete newChanged[sessionId];
        return newChanged;
      });
    }
  };

  // Update student status in edit mode
  const updateStatus = (sessionId: number, studentId: string, newStatus: AttendanceStatus | 'excused') => {
    if (newStatus === 'excused') {
      // Open modal for authorized leave
      setSelectedStudentForLeave({ sessionId, studentId });
      setLeaveReason('');
      setShowAuthorizedLeaveModal(true);
    } else {
      // Direct status change (present or absent)
      setEditedRecords(prev => {
        const records = prev[sessionId] || [];
        const updated = records.map(r => 
          r.id === studentId ? { ...r, status: newStatus, reasonType: undefined, markedBy: 'manual' } : r
        );
        return { ...prev, [sessionId]: updated };
      });

      setHasChanges(prev => ({ ...prev, [sessionId]: true }));
      setChangedStudents(prev => {
        const changed = prev[sessionId] || new Set<string>();
        changed.add(studentId);
        return { ...prev, [sessionId]: changed };
      });
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

    const { sessionId, studentId } = selectedStudentForLeave;

    setEditedRecords(prev => {
      const records = prev[sessionId] || [];
      const updated = records.map(r => 
        r.id === studentId ? { ...r, status: 'excused' as const, reasonType: leaveReason, markedBy: 'manual' } : r
      );
      return { ...prev, [sessionId]: updated };
    });

    setHasChanges(prev => ({ ...prev, [sessionId]: true }));
    setChangedStudents(prev => {
      const changed = prev[sessionId] || new Set<string>();
      changed.add(studentId);
      return { ...prev, [sessionId]: changed };
    });

    setShowAuthorizedLeaveModal(false);
    setSelectedStudentForLeave(null);
    setLeaveReason('');
    
    toast({
      title: "Success",
      description: "Authorized leave recorded",
    });
  };

  // Submit changes for a session
  const submitChanges = async (sessionId: number) => {
    const records = editedRecords[sessionId];
    if (!records) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token');

      const response = await fetch(`${API_BASE_URL}/attendance/update/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          attendanceRecords: records.map(r => ({
            studentId: r.id,
            status: r.status,
            reasonType: r.reasonType || null,
            markedBy: r.markedBy || 'manual'
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update attendance');
      }

      toast({
        title: "Success",
        description: "Attendance records updated successfully"
      });

      // Reload records
      await loadRecords();
      
      // Exit edit mode
      setEditingSessions(prev => ({ ...prev, [sessionId]: false }));
      setEditedRecords(prev => {
        const newRecords = { ...prev };
        delete newRecords[sessionId];
        return newRecords;
      });
      setHasChanges(prev => ({ ...prev, [sessionId]: false }));
      setChangedStudents(prev => {
        const newChanged = { ...prev };
        delete newChanged[sessionId];
        return newChanged;
      });
    } catch (error: any) {
      console.error('Error updating attendance:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update attendance",
        variant: "destructive"
      });
    }
  };

  // Reset filters
  const resetFilters = () => {
    setFiltersLocked(false);
    setSessions([]);
    setSelectedCourse(null);
    setFilterSemester("");
    setFilterDepartment("");
    setFilterSection("");
    setDate(new Date());
    setEditingSessions({});
    setEditedRecords({});
    setHasChanges({});
    setChangedStudents({});
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
          <h1 className="text-3xl font-bold">View/Edit Attendance</h1>
          <p className="text-muted-foreground">View and edit attendance records</p>
        </div>
        {filtersLocked && (
          <Button variant="outline" onClick={resetFilters}>
            Change Filters
          </Button>
        )}
      </div>

      {/* Filter Selection */}
      {!filtersLocked && (
        <Card>
          <CardHeader>
            <CardTitle>Select Course and Date</CardTitle>
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
                <p className="text-muted-foreground">You don't have any courses assigned yet.</p>
              </div>
            ) : (
              <>
                {/* Date Selection */}
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={date}
                        onSelect={(newDate) => newDate && setDate(newDate)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
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

                {/* Course Selection */}
                {filterSection && availableCourses.length > 0 && (
                  <div className="space-y-2">
                    <Label>Course</Label>
                    <Select 
                      value={selectedCourse?.id.toString() || ""} 
                      onValueChange={(value) => {
                        const course = availableCourses.find(c => c.id === parseInt(value));
                        setSelectedCourse(course || null);
                      }}
                      disabled={!filterSection}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Course" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCourses.map(course => (
                          <SelectItem key={course.id} value={course.id.toString()}>
                            {course.course_code} - {course.course_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button 
                  onClick={loadRecords} 
                  disabled={!selectedCourse || !date || isLoading}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading Records...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Load Attendance Records
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Display Sessions */}
      {filtersLocked && sessions.length > 0 && (
        <div className="space-y-6">
          {/* Course Info */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  Semester {selectedCourse?.semester}
                </Badge>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {selectedCourse?.department}
                </Badge>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  Section {selectedCourse?.section}
                </Badge>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {selectedCourse?.course_code}
                </Badge>
                <Badge variant="outline">{selectedCourse?.course_name}</Badge>
                <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                  {format(date, 'PPP')}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Sessions */}
          {sessions.map((sessionData, sessionIndex) => {
            const session = sessionData.session;
            const records = editingSessions[session.id] 
              ? (editedRecords[session.id] || sessionData.attendanceRecords)
              : sessionData.attendanceRecords;
            
            const isEditing = editingSessions[session.id] || false;
            const sessionDate = new Date(session.date);
            const today = new Date();
            const isToday = sessionDate.toDateString() === today.toDateString();

            return (
              <Card key={session.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Session {sessionIndex + 1}</CardTitle>
                      <CardDescription>
                        {format(new Date(session.date), 'PPPP')} at {session.time}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {isToday && !isEditing && (
                        <Button onClick={() => toggleEdit(session.id)} variant="outline" size="sm">
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      )}
                      {isEditing && (
                        <>
                          <Button 
                            onClick={() => submitChanges(session.id)} 
                            disabled={!hasChanges[session.id]}
                            size="sm"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </Button>
                          <Button onClick={() => toggleEdit(session.id)} variant="outline" size="sm">
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Summary Statistics */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                        {session.totalStudents}
                      </p>
                      <p className="text-sm text-blue-600 dark:text-blue-400">Total</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                        {session.presentCount}
                      </p>
                      <p className="text-sm text-green-600 dark:text-green-400">Present</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-950 p-4 rounded-lg text-center">
                      <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                        {records.filter(r => r.status === 'excused').length}
                      </p>
                      <p className="text-sm text-orange-600 dark:text-orange-400">Authorized Leave</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg text-center">
                      <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                        {session.absentCount}
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-400">Absent</p>
                    </div>
                  </div>

                  {/* Captured Images */}
                  {session.capturedImagePaths && session.capturedImagePaths.length > 0 && (
                    <div>
                      <Label className="mb-2 block">Captured Images</Label>
                      <div className="grid grid-cols-2 gap-4">
                        {session.capturedImagePaths.map((path, idx) => (
                          <div key={idx} className="relative">
                            <img 
                              src={path} 
                              alt={`Capture ${idx + 1}`} 
                              className="rounded border w-full"
                              onError={(e) => {
                                console.error('Failed to load image:', path);
                                e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23f0f0f0"/><text x="50%" y="50%" text-anchor="middle" fill="%23999">Image not found</text></svg>';
                              }}
                            />
                            <div className="absolute top-2 left-2 bg-black/70 text-white px-3 py-1 rounded text-sm">
                              Image {idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Student Records Table */}
                  <div>
                    <Label className="mb-2 block">Attendance Records</Label>
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
                            {records
                              .sort((a, b) => a.id.localeCompare(b.id))
                              .map((student, index) => (
                              <tr 
                                key={student.id} 
                                className={cn(
                                  "border-b hover:bg-muted/30 transition-colors",
                                  index % 2 === 0 ? "bg-gray-50/50 dark:bg-gray-900/50" : "",
                                  isEditing && changedStudents[session.id]?.has(student.id) && "bg-yellow-50 dark:bg-yellow-950"
                                )}
                              >
                                <td className="p-3 text-center font-semibold text-muted-foreground">
                                  {index + 1}
                                </td>
                                <td className="p-3 font-mono text-xs">{student.id}</td>
                                <td className="p-3 font-medium">{student.name}</td>
                                <td className="p-3">
                                  {isEditing ? (
                                    <div className="flex gap-2 justify-center">
                                      <Button
                                        size="sm"
                                        variant={student.status === 'present' ? 'default' : 'outline'}
                                        className={cn(
                                          "text-xs px-3",
                                          student.status === 'present' && "bg-green-600 hover:bg-green-700 text-white"
                                        )}
                                        onClick={() => updateStatus(session.id, student.id, 'present')}
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
                                        onClick={() => updateStatus(session.id, student.id, 'excused')}
                                      >
                                        Authorized Leave
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant={student.status === 'absent' ? 'destructive' : 'outline'}
                                        className="text-xs px-3"
                                        onClick={() => updateStatus(session.id, student.id, 'absent')}
                                      >
                                        Absent
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex justify-center">
                                      <Badge 
                                        variant="outline"
                                        className={cn(
                                          student.status === 'present' && "bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-300",
                                          student.status === 'excused' && "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900 dark:text-orange-300",
                                          student.status === 'absent' && "bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-300"
                                        )}
                                      >
                                        {student.status === 'present' && 'Present'}
                                        {student.status === 'excused' && 'Authorized Leave'}
                                        {student.status === 'absent' && 'Absent'}
                                      </Badge>
                                    </div>
                                  )}
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
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* No Sessions Found */}
      {filtersLocked && sessions.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Attendance Records Found</h3>
            <p className="text-muted-foreground">
              No attendance sessions found for the selected course and date.
            </p>
          </CardContent>
        </Card>
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
    </div>
  );
}
