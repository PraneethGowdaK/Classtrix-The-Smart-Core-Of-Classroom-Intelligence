import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Edit, BookOpen, AlertCircle, RefreshCw, Hash, Award, Download, Search, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL, SEMESTERS, DEPARTMENTS } from "@/lib/constants";
import { getSemesterSubjects } from "@/lib/curriculumTemplates";


interface Subject {
  id: number;
  subject_code: string;
  subject_name: string;
  department: string;
  semester: number;
  credits: number;
  total_sessions_planned: number;
  created_at: string;
}

export default function ManageSubjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [selectedTab, setSelectedTab] = useState("view");
  const [searchCode, setSearchCode] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchedSubject, setSearchedSubject] = useState<Subject | null>(null);
  const [searching, setSearching] = useState(false);
  const { toast } = useToast();

  // Filter state for View Courses tab
  const [viewFilters, setViewFilters] = useState({
    semester: "",
    department: "",
    section: ""
  });

  // Form state for bulk import
  const [bulkImportForm, setBulkImportForm] = useState({
    department: "",
    semester: "",
    section: ""
  });
  const [previewSubjects, setPreviewSubjects] = useState<any[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<Set<number>>(new Set());
  const [subjectSessions, setSubjectSessions] = useState<Record<number, string>>({});

  // Form state for adding subject
  const [addForm, setAddForm] = useState({
    subject_code: "",
    subject_name: "",
    department: "",
    semester: "",
    section: "",
    credits: "4",
    total_sessions_planned: "50"
  });

  // Form state for editing subject
  const [editForm, setEditForm] = useState({
    subject_code: "",
    subject_name: "",
    department: "",
    semester: "",
    section: "",
    credits: "4",
    total_sessions_planned: "50"
  });

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    // Refresh data and clear forms when tab changes
    if (selectedTab === "view") {
      fetchSubjects();
    } else if (selectedTab === "add") {
      // Clear add form
      setAddForm({
        subject_code: "",
        subject_name: "",
        department: "",
        semester: "",
        section: "",
        credits: "4",
        total_sessions_planned: "50"
      });
    } else if (selectedTab === "bulk") {
      // Clear bulk import form
      setBulkImportForm({
        department: "",
        semester: "",
        section: ""
      });
      setPreviewSubjects([]);
      setSelectedSubjects(new Set());
      setSubjectSessions({});
      setTemplateLoaded(false);
    } else if (selectedTab === "edit") {
      // Clear edit form
      setEditForm({
        subject_code: "",
        subject_name: "",
        department: "",
        semester: "",
        section: "",
        credits: "4",
        total_sessions_planned: "50"
      });
      setSearchCode("");
      setSearchResults([]);
      setSearchedSubject(null);
    }
  }, [selectedTab]);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE_URL}/courses`, {
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
        setSubjects(data.subjects);
      } else {
        throw new Error(data.message || 'Failed to fetch subjects');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch subjects';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!addForm.subject_code || !addForm.subject_name || !addForm.department || !addForm.semester || !addForm.section || !addForm.credits || !addForm.total_sessions_planned) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (addForm.subject_code.length < 3) {
      toast({
        title: "Error",
        description: "Course code must be at least 3 characters",
        variant: "destructive"
      });
      return;
    }

    if (addForm.subject_name.length < 3) {
      toast({
        title: "Error",
        description: "Course name must be at least 3 characters",
        variant: "destructive"
      });
      return;
    }

    if (addForm.section.length < 1) {
      toast({
        title: "Error",
        description: "Section is required",
        variant: "destructive"
      });
      return;
    }

    // Validate credits
    const creditsNum = parseInt(addForm.credits);
    if (isNaN(creditsNum) || creditsNum < 0 || creditsNum > 10) {
      toast({
        title: "Error",
        description: "Credits must be between 0 and 10",
        variant: "destructive"
      });
      return;
    }

    // Validate total sessions
    const sessionsNum = parseInt(addForm.total_sessions_planned);
    if (isNaN(sessionsNum) || sessionsNum < 0 || sessionsNum > 200) {
      toast({
        title: "Error",
        description: "Total sessions must be between 0 and 200",
        variant: "destructive"
      });
      return;
    }

    // Validate department format (only letters)
    if (!/^[A-Za-z]+$/.test(addForm.department)) {
      toast({
        title: "Error",
        description: "Department must contain only letters (e.g., CS, IS)",
        variant: "destructive"
      });
      return;
    }

    // Validate section format (only letters and numbers)
    if (!/^[A-Za-z0-9]+$/.test(addForm.section)) {
      toast({
        title: "Error",
        description: "Section must contain only letters and numbers (e.g., A, B1, C2)",
        variant: "destructive"
      });
      return;
    }

    // Check for duplicate course (same code, department, semester, and section)
    const duplicateCourse = subjects.find(s =>
      s.subject_code.toUpperCase() === addForm.subject_code.toUpperCase() &&
      s.department.toUpperCase() === addForm.department.toUpperCase() &&
      s.semester === parseInt(addForm.semester) &&
      s.section.toUpperCase() === addForm.section.toUpperCase()
    );

    if (duplicateCourse) {
      toast({
        title: "Error",
        description: `Course "${addForm.subject_code}" already exists for ${addForm.department} Semester ${addForm.semester} Section ${addForm.section}`,
        variant: "destructive"
      });
      return;
    }

    setAdding(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE_URL}/courses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subject_code: addForm.subject_code.trim().toUpperCase(),
          subject_name: addForm.subject_name.trim(),
          department: addForm.department.toUpperCase(),
          semester: parseInt(addForm.semester),
          section: addForm.section.toUpperCase(),
          credits: creditsNum,
          total_sessions_planned: sessionsNum
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Success",
          description: "Course added successfully"
        });
        setAddForm({
          subject_code: "",
          subject_name: "",
          department: "",
          semester: "",
          section: "",
          credits: "4",
          total_sessions_planned: "50"
        });
        fetchSubjects();
        setSelectedTab("view");
      } else {
        throw new Error(data.message || 'Failed to add course');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add course';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setAdding(false);
    }
  };

  const handleSearchSubject = () => {
    if (!searchCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a course code",
        variant: "destructive"
      });
      return;
    }

    setSearching(true);
    // Find ALL courses with matching code
    const results = subjects.filter(
      s => s.subject_code.toUpperCase() === searchCode.trim().toUpperCase()
    );

    if (results.length > 0) {
      setSearchResults(results);
      setSearchedSubject(null); // Clear selected subject
      toast({
        title: "Success",
        description: `Found ${results.length} course(s) with code "${searchCode.toUpperCase()}"`
      });
    } else {
      setSearchResults([]);
      setSearchedSubject(null);
      toast({
        title: "Not Found",
        description: `No course found with code "${searchCode.toUpperCase()}"`,
        variant: "destructive"
      });
    }
    setSearching(false);
  };

  // Handle selecting a course from search results
  const handleSelectCourse = (course: any) => {
    setSearchedSubject(course);
    setEditForm({
      subject_code: course.subject_code,
      subject_name: course.subject_name,
      department: course.department,
      semester: course.semester.toString(),
      section: course.section,
      credits: course.credits.toString(),
      total_sessions_planned: course.total_sessions_planned.toString()
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchedSubject) {
      toast({
        title: "Error",
        description: "Please search for a course first",
        variant: "destructive"
      });
      return;
    }

    // Validation
    if (!editForm.subject_code || !editForm.subject_name || !editForm.department || !editForm.semester || !editForm.section) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (editForm.subject_code.length < 3) {
      toast({
        title: "Error",
        description: "Course code must be at least 3 characters",
        variant: "destructive"
      });
      return;
    }

    if (editForm.subject_name.length < 3) {
      toast({
        title: "Error",
        description: "Course name must be at least 3 characters",
        variant: "destructive"
      });
      return;
    }

    if (editForm.section.length < 1) {
      toast({
        title: "Error",
        description: "Section is required",
        variant: "destructive"
      });
      return;
    }

    // Validate credits
    const creditsNum = parseInt(editForm.credits);
    if (isNaN(creditsNum) || creditsNum < 0 || creditsNum > 10) {
      toast({
        title: "Error",
        description: "Credits must be between 0 and 10",
        variant: "destructive"
      });
      return;
    }

    // Validate total sessions
    const sessionsNum = parseInt(editForm.total_sessions_planned);
    if (isNaN(sessionsNum) || sessionsNum < 0 || sessionsNum > 200) {
      toast({
        title: "Error",
        description: "Total sessions must be between 0 and 200",
        variant: "destructive"
      });
      return;
    }

    // Validate department format (only letters)
    if (!/^[A-Za-z]+$/.test(editForm.department)) {
      toast({
        title: "Error",
        description: "Department must contain only letters (e.g., CS, IS)",
        variant: "destructive"
      });
      return;
    }

    // Validate section format (only letters and numbers)
    if (!/^[A-Za-z0-9]+$/.test(editForm.section)) {
      toast({
        title: "Error",
        description: "Section must contain only letters and numbers (e.g., A, B1, C2)",
        variant: "destructive"
      });
      return;
    }

    // Check for duplicate course (same code, department, semester, and section) - excluding current course
    const duplicateCourse = subjects.find(s =>
      s.id !== searchedSubject.id && // Exclude the current course being edited
      s.subject_code.toUpperCase() === editForm.subject_code.toUpperCase() &&
      s.department.toUpperCase() === editForm.department.toUpperCase() &&
      s.semester === parseInt(editForm.semester) &&
      s.section.toUpperCase() === editForm.section.toUpperCase()
    );

    if (duplicateCourse) {
      toast({
        title: "Error",
        description: `Course "${editForm.subject_code}" already exists for ${editForm.department} Semester ${editForm.semester} Section ${editForm.section}`,
        variant: "destructive"
      });
      return;
    }

    setEditing(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE_URL}/courses/${searchedSubject.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subject_code: editForm.subject_code.trim().toUpperCase(),
          subject_name: editForm.subject_name.trim(),
          department: editForm.department.toUpperCase(),
          semester: parseInt(editForm.semester),
          section: editForm.section.toUpperCase(),
          credits: creditsNum,
          total_sessions_planned: sessionsNum
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Success",
          description: "Course updated successfully"
        });
        setSearchedSubject(null);
        setEditForm({
          subject_code: "",
          subject_name: "",
          department: "",
          semester: "",
          section: "",
          credits: "4",
          total_sessions_planned: "50"
        });
        fetchSubjects();
        // Refresh search results with updated data
        const updatedResults = subjects.map(s => 
          s.id === searchedSubject.id ? { ...s, ...editForm } : s
        ).filter(s => s.subject_code.toUpperCase() === searchCode.trim().toUpperCase());
        setSearchResults(updatedResults);
      } else {
        throw new Error(data.message || 'Failed to update course');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update course';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setEditing(false);
    }
  };

  const handleBulkImportPreview = () => {
    if (!bulkImportForm.department || !bulkImportForm.semester || !bulkImportForm.section) {
      toast({
        title: "Error",
        description: "Please select department, semester, and section",
        variant: "destructive"
      });
      return;
    }

    const templateSubjects = getSemesterSubjects(bulkImportForm.department, parseInt(bulkImportForm.semester));
    setPreviewSubjects(templateSubjects);
    setSelectedSubjects(new Set());
    setTemplateLoaded(true);
    
    // Initialize session counts for all subjects with default value of 50
    const initialSessions: Record<number, string> = {};
    templateSubjects.forEach((_, index) => {
      initialSessions[index] = "50";
    });
    setSubjectSessions(initialSessions);
  };

  const handleSubjectToggle = (index: number) => {
    const newSelected = new Set(selectedSubjects);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSubjects(newSelected);
  };

  const handleBulkImport = async () => {
    if (selectedSubjects.size === 0) {
      toast({
        title: "Error",
        description: "Please select at least one subject",
        variant: "destructive"
      });
      return;
    }

    setBulkImporting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      let successCount = 0;
      let errorCount = 0;
      let duplicateCount = 0;
      const duplicateSubjects: string[] = [];

      const selectedIndices = Array.from(selectedSubjects);

      for (const subjectIndex of selectedIndices) {
        const subject = previewSubjects[subjectIndex];
        const sessionsPlanned = parseInt(subjectSessions[subjectIndex] || "50");
        
        // Check if course already exists with same code, department, semester, and section
        const existingCourse = subjects.find(s => 
          s.subject_code.toUpperCase() === subject.code.toUpperCase() &&
          s.department.toUpperCase() === bulkImportForm.department.toUpperCase() &&
          s.semester === parseInt(bulkImportForm.semester) &&
          s.section.toUpperCase() === bulkImportForm.section.toUpperCase()
        );

        if (existingCourse) {
          duplicateCount++;
          duplicateSubjects.push(`${subject.code} (${bulkImportForm.section})`);
          continue;
        }
        
        try {
          const response = await fetch(`${API_BASE_URL}/courses`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              subject_code: subject.code.toUpperCase(),
              subject_name: subject.name,
              department: bulkImportForm.department.toUpperCase(),
              semester: parseInt(bulkImportForm.semester),
              section: bulkImportForm.section.toUpperCase(),
              credits: subject.credits,
              total_sessions_planned: sessionsPlanned
            })
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }

      toast({
        title: "Import Complete",
        description: `Successfully added ${successCount} subjects. ${duplicateCount > 0 ? `Skipped ${duplicateCount} duplicate(s). ` : ''}${errorCount > 0 ? `Failed: ${errorCount}` : ''}`,
      });

      setBulkImportForm({ department: "", semester: "", section: "" });
      setPreviewSubjects([]);
      setSelectedSubjects(new Set());
      setSubjectSessions({});
      fetchSubjects();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import subjects';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setBulkImporting(false);
    }
  };

  const getDepartmentName = (code: string) => {
    switch (code) {
      case "CS": return "Computer Science";
      case "IS": return "Information Science";
      case "EC": return "Electronics & Communication";
      case "ME": return "Mechanical Engineering";
      case "CV": return "Civil Engineering";
      default: return code;
    }
  };

  // Filter subjects based on selected filters
  const filteredSubjects = subjects.filter(subject => {
    if (viewFilters.semester && subject.semester.toString() !== viewFilters.semester) {
      return false;
    }
    if (viewFilters.department && subject.department !== viewFilters.department) {
      return false;
    }
    if (viewFilters.section && subject.section !== viewFilters.section) {
      return false;
    }
    return true;
  });

  // Get unique values for filter dropdowns
  const uniqueSemesters = [...new Set(subjects.map(s => s.semester.toString()))].sort();
  const uniqueDepartments = [...new Set(subjects.map(s => s.department))].sort();
  const uniqueSections = [...new Set(subjects.map(s => s.section))].sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading subjects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Manage Courses</h1>
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="view">View Courses</TabsTrigger>
          <TabsTrigger value="add">Add Course</TabsTrigger>
          <TabsTrigger value="edit">Edit Course</TabsTrigger>
        </TabsList>

        {/* View Courses Tab */}
        <TabsContent value="view" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Courses</CardTitle>
                  <CardDescription>
                    {viewFilters.semester || viewFilters.department || viewFilters.section 
                      ? `Showing ${filteredSubjects.length} of ${subjects.length} courses`
                      : `Total: ${subjects.length} courses`
                    }
                  </CardDescription>
                </div>
                <Button onClick={fetchSubjects} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label>Semester</Label>
                  <Select
                    value={viewFilters.semester || "all"}
                    onValueChange={(value) => setViewFilters(prev => ({ ...prev, semester: value === "all" ? "" : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Semesters" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Semesters</SelectItem>
                      {uniqueSemesters.map(sem => (
                        <SelectItem key={sem} value={sem}>Semester {sem}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={viewFilters.department || "all"}
                    onValueChange={(value) => setViewFilters(prev => ({ ...prev, department: value === "all" ? "" : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {uniqueDepartments.map(dept => (
                        <SelectItem key={dept} value={dept}>{getDepartmentName(dept)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Section</Label>
                  <Select
                    value={viewFilters.section || "all"}
                    onValueChange={(value) => setViewFilters(prev => ({ ...prev, section: value === "all" ? "" : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Sections" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sections</SelectItem>
                      {uniqueSections.map(sec => (
                        <SelectItem key={sec} value={sec}>Section {sec}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setViewFilters({ semester: "", department: "", section: "" })}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>

              {/* Courses Display */}
              {filteredSubjects.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    {subjects.length === 0 ? "No courses found" : "No courses match the selected filters"}
                  </p>
                  {subjects.length === 0 ? (
                    <Button onClick={() => setSelectedTab("add")}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Course
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => setViewFilters({ semester: "", department: "", section: "" })}>
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Group courses by subject_code */}
                  {Object.entries(
                    filteredSubjects.reduce((acc, subject) => {
                      if (!acc[subject.subject_code]) {
                        acc[subject.subject_code] = [];
                      }
                      acc[subject.subject_code].push(subject);
                      return acc;
                    }, {} as Record<string, Subject[]>)
                  ).map(([code, courseList]) => {
                    const firstCourse = courseList[0];
                    return (
                      <Card key={code} className="overflow-hidden">
                        <CardContent className="p-5">
                          {/* Course Header */}
                          <div className="flex items-start justify-between mb-4 pb-4 border-b">
                            <div className="space-y-1">
                              <div className="flex items-center gap-3">
                                <Badge className="font-mono bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-100 hover:bg-cyan-200 dark:hover:bg-cyan-800">
                                  {code}
                                </Badge>
                                <h3 className="text-lg font-semibold">{firstCourse.subject_name}</h3>
                              </div>
                            </div>
                          </div>

                          {/* Course Details - Two Column Layout */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left Column - Course Basic Info */}
                            <div className="space-y-3">
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground mb-2 block">Course Code</Label>
                                <p className="text-sm font-mono">{code}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground mb-2 block">Course Name</Label>
                                <p className="text-sm font-semibold">{firstCourse.subject_name}</p>
                              </div>
                            </div>

                            {/* Right Column - All Combinations */}
                            <div>
                              <Label className="text-sm font-medium text-muted-foreground mb-2 block">Assigned To</Label>
                              <div className="space-y-2">
                                {courseList.map((course, idx) => (
                                  <div key={idx} className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                          <Badge className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100">
                                            Sem {course.semester}
                                          </Badge>
                                          <Badge className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100">
                                            {getDepartmentName(course.department)}
                                          </Badge>
                                          <Badge className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100">
                                            Sec {course.section}
                                          </Badge>
                                        </div>
                                      </div>
                                      <div className="flex gap-3 justify-end items-center">
                                        <div className="text-xs">
                                          <span className="text-muted-foreground">Credits:</span>
                                          <span className="font-semibold ml-1">{course.credits}</span>
                                        </div>
                                        <div className="text-xs">
                                          <span className="text-muted-foreground">Sessions:</span>
                                          <span className="font-semibold ml-1">{course.total_sessions_planned}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  <div className="p-3 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
                    📊 Showing {filteredSubjects.length} course assignment{filteredSubjects.length !== 1 ? 's' : ''} ({Object.keys(filteredSubjects.reduce((acc, s) => ({ ...acc, [s.subject_code]: true }), {})).length} unique course{Object.keys(filteredSubjects.reduce((acc, s) => ({ ...acc, [s.subject_code]: true }), {})).length !== 1 ? 's' : ''})
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Add Course Tab */}
        <TabsContent value="add" className="mt-4">
          <div className="space-y-6">
            {/* Info Note */}
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900 dark:text-blue-100">
                  <p className="font-semibold mb-1">Important</p>
                  <p>Each course must be unique for the combination of Course Code + Semester + Department + Section from previously registered courses. The same course code can be added to different sections.</p>
                </div>
              </div>
            </div>

            {/* Section 1: Manual Entry */}
            <Card>
              <CardHeader>
                <CardTitle>Add New Course Manually</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="add-code">Subject Code <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="add-code"
                          placeholder="e.g., CS501"
                          className="pl-9"
                          value={addForm.subject_code}
                          onChange={(e) => setAddForm(prev => ({ ...prev, subject_code: e.target.value }))}
                          disabled={adding}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Unique code (min 3 characters)</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="add-name">Subject Name <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <BookOpen className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="add-name"
                          placeholder="e.g., Machine Learning"
                          className="pl-9"
                          value={addForm.subject_name}
                          onChange={(e) => setAddForm(prev => ({ ...prev, subject_name: e.target.value }))}
                          disabled={adding}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Full subject name (min 3 characters)</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="add-department">Department <span className="text-red-500">*</span></Label>
                      <Input
                        id="add-department"
                        placeholder="e.g., CS"
                        value={addForm.department}
                        onChange={(e) => setAddForm(prev => ({ ...prev, department: e.target.value.toUpperCase() }))}
                        disabled={adding}
                      />
                      <p className="text-xs text-muted-foreground">Department code (e.g., CS, IS)</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="add-semester">Semester <span className="text-red-500">*</span></Label>
                      <Select
                        value={addForm.semester}
                        onValueChange={(value) => setAddForm(prev => ({ ...prev, semester: value }))}
                        disabled={adding}
                      >
                        <SelectTrigger id="add-semester">
                          <SelectValue placeholder="Select semester" />
                        </SelectTrigger>
                        <SelectContent>
                          {SEMESTERS.map((sem) => (
                            <SelectItem key={sem} value={sem}>
                              Semester {sem}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="add-section">Section <span className="text-red-500">*</span></Label>
                      <Input
                        id="add-section"
                        placeholder="e.g., A"
                        value={addForm.section || ""}
                        onChange={(e) => setAddForm(prev => ({ ...prev, section: e.target.value.toUpperCase() }))}
                        disabled={adding}
                      />
                      <p className="text-xs text-muted-foreground">Section (e.g., A, B, C)</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="add-credits">Credits <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <Award className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="add-credits"
                          type="number"
                          min="1"
                          max="10"
                          className="pl-9"
                          value={addForm.credits}
                          onChange={(e) => setAddForm(prev => ({ ...prev, credits: e.target.value }))}
                          disabled={adding}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Default: 4 credits</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="add-sessions">Total Sessions Planned <span className="text-red-500">*</span></Label>
                      <Input
                        id="add-sessions"
                        type="number"
                        min="1"
                        max="200"
                        value={addForm.total_sessions_planned}
                        onChange={(e) => setAddForm(prev => ({ ...prev, total_sessions_planned: e.target.value }))}
                        disabled={adding}
                      />
                      <p className="text-xs text-muted-foreground">Default: 50 sessions</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button type="submit" disabled={adding}>
                      {adding ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Course
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setAddForm({
                          subject_code: "",
                          subject_name: "",
                          department: "",
                          semester: "",
                          section: "",
                          credits: "4",
                          total_sessions_planned: "50"
                        });
                      }}
                      disabled={adding}
                    >
                      Clear
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Section 2: Fast Template */}
            <Card>
              <CardHeader>
                <CardTitle>Add from Template</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bulk-department">Department <span className="text-red-500">*</span></Label>
                      <Select
                        value={bulkImportForm.department}
                        onValueChange={(value) => {
                          setBulkImportForm(prev => ({ ...prev, department: value }));
                          setPreviewSubjects([]);
                          setSelectedSubjects(new Set());
                          setSubjectSessions({});
                          setTemplateLoaded(false);
                        }}
                        disabled={bulkImporting}
                      >
                        <SelectTrigger id="bulk-department">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CS">Computer Science (CS)</SelectItem>
                          <SelectItem value="IS">Information Science (IS)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bulk-semester">Semester <span className="text-red-500">*</span></Label>
                      <Select
                        value={bulkImportForm.semester}
                        onValueChange={(value) => {
                          setBulkImportForm(prev => ({ ...prev, semester: value }));
                          setPreviewSubjects([]);
                          setSelectedSubjects(new Set());
                          setSubjectSessions({});
                          setTemplateLoaded(false);
                        }}
                        disabled={bulkImporting}
                      >
                        <SelectTrigger id="bulk-semester">
                          <SelectValue placeholder="Select semester" />
                        </SelectTrigger>
                        <SelectContent>
                          {SEMESTERS.map((sem) => (
                            <SelectItem key={sem} value={sem}>
                              Semester {sem}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bulk-section">Section <span className="text-red-500">*</span></Label>
                      <Select
                        value={bulkImportForm.section}
                        onValueChange={(value) => {
                          setBulkImportForm(prev => ({ ...prev, section: value }));
                          setPreviewSubjects([]);
                          setSelectedSubjects(new Set());
                          setSubjectSessions({});
                          setTemplateLoaded(false);
                        }}
                        disabled={bulkImporting}
                      >
                        <SelectTrigger id="bulk-section">
                          <SelectValue placeholder="Select section" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">Section A</SelectItem>
                          <SelectItem value="B">Section B</SelectItem>
                          <SelectItem value="C">Section C</SelectItem>
                          <SelectItem value="D">Section D</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button 
                    type="button" 
                    onClick={handleBulkImportPreview}
                    disabled={!bulkImportForm.department || !bulkImportForm.semester || !bulkImportForm.section || bulkImporting}
                    variant="outline"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Load Template
                  </Button>

                  {previewSubjects.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Select Courses to Add</h3>
                        <Badge variant="secondary">
                          {selectedSubjects.size} of {previewSubjects.length} selected
                        </Badge>
                      </div>

                      <div className="border rounded-md overflow-hidden">
                        <div className="max-h-96 overflow-y-auto border-b">
                          <table className="w-full">
                            <thead className="bg-muted/50 sticky top-0">
                              <tr>
                                <th className="px-4 py-2 text-left text-sm font-semibold w-12">
                                  <Checkbox
                                    checked={selectedSubjects.size === previewSubjects.length && previewSubjects.length > 0}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedSubjects(new Set(previewSubjects.map((_, i) => i)));
                                      } else {
                                        setSelectedSubjects(new Set());
                                      }
                                    }}
                                  />
                                </th>
                                <th className="px-4 py-2 text-left text-sm font-semibold">Code</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold">Subject Name</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold">Semester</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold">Credits</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold w-32">Sessions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {previewSubjects.map((subject, index) => (
                                <tr key={index} className="border-b hover:bg-muted/30">
                                  <td className="px-4 py-2">
                                    <Checkbox
                                      checked={selectedSubjects.has(index)}
                                      onCheckedChange={() => {
                                        const newSelected = new Set(selectedSubjects);
                                        if (newSelected.has(index)) {
                                          newSelected.delete(index);
                                        } else {
                                          newSelected.add(index);
                                        }
                                        setSelectedSubjects(newSelected);
                                      }}
                                    />
                                  </td>
                                  <td className="px-4 py-2 font-mono text-sm">{subject.code}</td>
                                  <td className="px-4 py-2">{subject.name}</td>
                                  <td className="px-4 py-2">
                                    <Badge variant="secondary">Sem {bulkImportForm.semester}</Badge>
                                  </td>
                                  <td className="px-4 py-2">{subject.credits}</td>
                                  <td className="px-4 py-2">
                                    <Input
                                      type="number"
                                      min="1"
                                      max="200"
                                      value={subjectSessions[index] || "50"}
                                      onChange={(e) => {
                                        setSubjectSessions(prev => ({
                                          ...prev,
                                          [index]: e.target.value
                                        }));
                                      }}
                                      className="w-20"
                                      disabled={bulkImporting}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end pt-6">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setPreviewSubjects([]);
                            setSelectedSubjects(new Set());
                            setSubjectSessions({});
                            setBulkImportForm({ department: "", semester: "", section: "" });
                            setTemplateLoaded(false);
                          }}
                          disabled={bulkImporting}
                        >
                          Clear All
                        </Button>
                        <Button 
                          onClick={handleBulkImport}
                          disabled={bulkImporting || selectedSubjects.size === 0}
                        >
                          {bulkImporting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Selected ({selectedSubjects.size})
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {templateLoaded && previewSubjects.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                      <p>No template found for this combination</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Edit Course Tab */}
        <TabsContent value="edit" className="mt-4">
          <div className="space-y-6">
            {/* Info Notes */}
            <div className="space-y-3">
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900 dark:text-amber-100">
                    <p className="font-semibold mb-1">Note</p>
                    <p>The course must be registered in the system to edit. Search by course code to find and modify existing courses.</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900 dark:text-blue-100">
                    <p className="font-semibold mb-1">Important</p>
                    <p>Each course must be unique for the combination of Course Code + Semester + Department + Section from previously registered courses. The same course code can be added to different sections.</p>
                  </div>
                </div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Edit Course</CardTitle>
              </CardHeader>
              <CardContent>
              <div className="space-y-6">
                {/* Search Section */}
                <div className="space-y-2">
                  <Label htmlFor="search-code">Course Code <span className="text-red-500">*</span></Label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search-code"
                        placeholder="Enter subject code (e.g., CS501)"
                        className="pl-9"
                        value={searchCode}
                        onChange={(e) => setSearchCode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSearchSubject();
                          }
                        }}
                        disabled={searching}
                      />
                    </div>
                    <Button onClick={handleSearchSubject} disabled={searching}>
                      {searching ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4 mr-2" />
                          Search
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setSearchCode('');
                        setSearchResults([]);
                        setSearchedSubject(null);
                        setEditForm({
                          courseCode: '',
                          courseName: '',
                          semester: '',
                          department: '',
                          section: '',
                          credits: '',
                          totalSessionsPlanned: ''
                        });
                      }}
                      disabled={searching}
                    >
                      Clear
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Enter the subject code to find and edit</p>
                </div>

                {/* Search Results Table - Show all matching courses */}
                {searchResults.length > 0 && !searchedSubject && (
                  <div className="space-y-4 pt-4 border-t">
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Select a course to edit:</h3>
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-semibold">Code</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold">Department</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold">Semester</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold">Section</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold">Credits</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold">Sessions</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {searchResults.map((course) => (
                              <tr key={course.id} className="border-b hover:bg-muted/30">
                                <td className="px-4 py-3 font-mono text-sm">{course.subject_code}</td>
                                <td className="px-4 py-3">{course.subject_name}</td>
                                <td className="px-4 py-3">{course.department}</td>
                                <td className="px-4 py-3">Sem {course.semester}</td>
                                <td className="px-4 py-3">
                                  <Badge variant="secondary">{course.section}</Badge>
                                </td>
                                <td className="px-4 py-3">{course.credits}</td>
                                <td className="px-4 py-3">{course.total_sessions_planned}</td>
                                <td className="px-4 py-3">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSelectCourse(course)}
                                    disabled={editing}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Edit Form - Only shown when course is selected */}
                {searchedSubject && (
                  <form onSubmit={handleEditSubmit} className="space-y-4 pt-4 border-t">
                    <div className="bg-muted/50 p-4 rounded-md mb-4 flex items-center justify-between">
                      <p className="text-sm font-medium">Editing: {searchedSubject.subject_code} - {searchedSubject.subject_name} (Section {searchedSubject.section})</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearchedSubject(null);
                          setEditForm({
                            subject_code: "",
                            subject_name: "",
                            department: "",
                            semester: "",
                            section: "",
                            credits: "4",
                            total_sessions_planned: "50"
                          });
                        }}
                        disabled={editing}
                      >
                        ← Back to Results
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-code">Subject Code <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="edit-code"
                            placeholder="e.g., CS501"
                            className="pl-9"
                            value={editForm.subject_code}
                            onChange={(e) => setEditForm(prev => ({ ...prev, subject_code: e.target.value }))}
                            disabled={editing}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Unique code (min 3 characters)</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-name">Subject Name <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <BookOpen className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="edit-name"
                            placeholder="e.g., Machine Learning"
                            className="pl-9"
                            value={editForm.subject_name}
                            onChange={(e) => setEditForm(prev => ({ ...prev, subject_name: e.target.value }))}
                            disabled={editing}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Full subject name (min 3 characters)</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-department">Department <span className="text-red-500">*</span></Label>
                        <Input
                          id="edit-department"
                          placeholder="e.g., CS"
                          value={editForm.department}
                          onChange={(e) => setEditForm(prev => ({ ...prev, department: e.target.value.toUpperCase() }))}
                          disabled={editing}
                        />
                        <p className="text-xs text-muted-foreground">Department code (e.g., CS, IS)</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-semester">Semester <span className="text-red-500">*</span></Label>
                        <Select
                          value={editForm.semester}
                          onValueChange={(value) => setEditForm(prev => ({ ...prev, semester: value }))}
                          disabled={editing}
                        >
                          <SelectTrigger id="edit-semester">
                            <SelectValue placeholder="Select semester" />
                          </SelectTrigger>
                          <SelectContent>
                            {SEMESTERS.map((sem) => (
                              <SelectItem key={sem} value={sem}>
                                Semester {sem}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-section">Section <span className="text-red-500">*</span></Label>
                        <Input
                          id="edit-section"
                          placeholder="e.g., A"
                          value={editForm.section}
                          onChange={(e) => setEditForm(prev => ({ ...prev, section: e.target.value.toUpperCase() }))}
                          disabled={editing}
                        />
                        <p className="text-xs text-muted-foreground">Section (e.g., A, B, C)</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-credits">Credits <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <Award className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="edit-credits"
                            type="number"
                            min="0"
                            max="10"
                            className="pl-9"
                            value={editForm.credits}
                            onChange={(e) => setEditForm(prev => ({ ...prev, credits: e.target.value }))}
                            disabled={editing}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Default: 4 credits</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-sessions">Total Sessions Planned <span className="text-red-500">*</span></Label>
                        <Input
                          id="edit-sessions"
                          type="number"
                          min="0"
                          max="200"
                          value={editForm.total_sessions_planned}
                          onChange={(e) => setEditForm(prev => ({ ...prev, total_sessions_planned: e.target.value }))}
                          disabled={editing}
                        />
                        <p className="text-xs text-muted-foreground">Default: 50 sessions</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button type="submit" disabled={editing}>
                        {editing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <Edit className="h-4 w-4 mr-2" />
                            Update Subject
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSearchedSubject(null);
                          setSearchCode("");
                          setEditForm({
                            subject_code: "",
                            subject_name: "",
                            department: "",
                            semester: "",
                            section: "",
                            credits: "4",
                            total_sessions_planned: "50"
                          });
                        }}
                        disabled={editing}
                      >
                        Clear
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
