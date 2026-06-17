import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/constants";
import { 
  Search, 
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Loader2,
  BarChart,
  Eye,
  CheckCircle2,
  XCircle,
  Activity,
  HelpCircle
} from "lucide-react";
import { 
  Bar, 
  BarChart as RechartsBarChart, 
  Line, 
  LineChart, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { cn } from "@/lib/utils";

// Helper functions for ML display
const getMLTrendIcon = (trend: string | null) => {
  if (!trend) return <span className="text-xs text-muted-foreground">N/A</span>;
  switch (trend) {
    case 'improving': 
      return (
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="h-4 w-4" />
          <span className="text-xs font-medium">Improving</span>
        </div>
      );
    case 'stable': 
      return (
        <div className="flex items-center gap-1 text-blue-600">
          <Minus className="h-4 w-4" />
          <span className="text-xs font-medium">Stable</span>
        </div>
      );
    case 'declining': 
      return (
        <div className="flex items-center gap-1 text-red-600">
          <TrendingDown className="h-4 w-4" />
          <span className="text-xs font-medium">Declining</span>
        </div>
      );
    default: return <span className="text-xs text-muted-foreground">N/A</span>;
  }
};

const getMLRiskIcon = (risk: string | null) => {
  if (!risk) return <span className="text-2xl text-muted-foreground">-</span>;
  switch (risk) {
    case 'low': return <span className="text-4xl" style={{ filter: 'grayscale(0%) contrast(100%)' }}>😊</span>;
    case 'moderate': return <span className="text-4xl" style={{ filter: 'grayscale(0%) contrast(100%)' }}>😐</span>;
    case 'high': return <span className="text-4xl" style={{ filter: 'grayscale(0%) contrast(100%)' }}>😟</span>;
    default: return <span className="text-2xl text-muted-foreground">-</span>;
  }
};

const getMLConsistencyIcon = (consistency: string | null) => {
  if (!consistency || consistency === 'no_data') return <span className="text-muted-foreground">-</span>;
  switch (consistency) {
    case 'high': return <span className="text-green-600">●●●</span>;
    case 'medium': return <span className="text-yellow-600">●●○</span>;
    case 'low': return <span className="text-red-600">●○○</span>;
    default: return <span className="text-muted-foreground">-</span>;
  }
};

const getMLAttentivenessIcon = (attentiveness: string | null) => {
  if (!attentiveness || attentiveness === 'no_data') return <span className="text-muted-foreground text-xs">-</span>;
  switch (attentiveness) {
    case 'High': 
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-lg">⚡</span>
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border border-green-300 text-xs font-semibold">
            High
          </Badge>
        </div>
      );
    case 'Medium': 
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-lg">🔋</span>
          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border border-yellow-300 text-xs font-semibold">
            Medium
          </Badge>
        </div>
      );
    case 'Low': 
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-lg">🪫</span>
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border border-red-300 text-xs font-semibold">
            Low
          </Badge>
        </div>
      );
    default: return <span className="text-muted-foreground text-xs">-</span>;
  }
};

const getMLLabel = (value: string | null, defaultLabel: string = "Not Available") => {
  if (!value) return defaultLabel;
  return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export default function AttendanceAnalysis() {
  const { currentUser } = useStore();
  const { toast } = useToast();
  
  const isTeacher = currentUser?.role === 'teacher';
  const isStudent = currentUser?.role === 'student';

  // Render student view or teacher view based on role
  if (isStudent) {
    return <StudentAnalysisView />;
  }

  if (isTeacher) {
    return <TeacherAnalysisView />;
  }

  // Default fallback
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card className="shadow-md border border-border/50">
        <CardContent className="p-12 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
              <BarChart className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-muted-foreground">Access Denied</h3>
              <p className="text-sm text-muted-foreground mt-2">
                You don't have permission to view this page.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Teacher Analysis View Component
function TeacherAnalysisView() {
  const { currentUser } = useStore();
  const { toast } = useToast();
  
  const [filterSemester, setFilterSemester] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [thresholdFilter, setThresholdFilter] = useState<'all' | 'above' | 'below'>('all');
  
  // API data state
  const [apiData, setApiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasValidFilters, setHasValidFilters] = useState(false);
  
  // Available subjects based on selected filters
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);

  // Teacher's all subjects overview
  const [overviewData, setOverviewData] = useState<any>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);

  const isTeacher = currentUser?.role === 'teacher';

  // Fetch teacher's all subjects overview on mount
  useEffect(() => {
    const fetchOverview = async () => {
      setIsLoadingOverview(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/analytics/teacher-subjects-overview`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();
        if (response.ok) {
          setOverviewData(data);
        }
      } catch (error) {
        console.error('Error fetching overview:', error);
      } finally {
        setIsLoadingOverview(false);
      }
    };

    if (isTeacher) {
      fetchOverview();
    }
  }, [isTeacher]);

  // Teacher's courses state (like TakeAttendance)
  const [teacherCourses, setTeacherCourses] = useState<any[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // Dynamic filter options (derived from teacher's courses)
  const [availableSemesters, setAvailableSemesters] = useState<number[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [availableSections, setAvailableSections] = useState<string[]>([]);

  // Fetch teacher's courses on mount (same as TakeAttendance)
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
          const semesterSet = new Set<number>(courses.map((c: any) => c.semester));
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
      setFilterDept("");
      return;
    }

    const filtered = teacherCourses.filter(c => c.semester === parseInt(filterSemester));
    const depts = Array.from(new Set(filtered.map(c => c.department))).sort();
    setAvailableDepartments(depts);
    
    if (filterDept && !depts.includes(filterDept)) {
      setFilterDept("");
    }
  }, [filterSemester, teacherCourses]);

  // Update available sections when department changes
  useEffect(() => {
    if (!filterSemester || !filterDept) {
      setAvailableSections([]);
      setFilterSection("");
      return;
    }

    const filtered = teacherCourses.filter(c => 
      c.semester === parseInt(filterSemester) && 
      c.department === filterDept
    );
    const sections = Array.from(new Set(filtered.map(c => c.section))).sort();
    setAvailableSections(sections);
    
    if (filterSection && !sections.includes(filterSection)) {
      setFilterSection("");
    }
  }, [filterSemester, filterDept, teacherCourses]);

  // Update available subjects when section changes
  useEffect(() => {
    if (!filterSemester || !filterDept || !filterSection) {
      setAvailableSubjects([]);
      setFilterSubject("");
      return;
    }

    const filtered = teacherCourses.filter(c => 
      c.semester === parseInt(filterSemester) && 
      c.department === filterDept &&
      c.section === filterSection
    );
    
    // Extract course names as subjects
    const subjects = filtered.map(c => c.course_name);
    setAvailableSubjects(subjects);
    
    if (filterSubject && !subjects.includes(filterSubject)) {
      setFilterSubject("");
    }
  }, [filterSemester, filterDept, filterSection, teacherCourses]);

  // Check if required filters are selected
  useEffect(() => {
    const valid = filterSemester && filterDept && filterSection;
    setHasValidFilters(!!valid);
    
    if (!valid) {
      setError("Please select Semester, Department, and Section");
      setApiData(null);
    } else {
      setError("");
    }
  }, [filterSemester, filterDept, filterSection]);

  // API call function
  const fetchAnalyticsData = async () => {
    if (!hasValidFilters) {
      toast({
        title: "Missing Filters",
        description: "Please select Semester, Department, and Section",
        variant: "destructive"
      });
      return;
    }

    if (!filterSubject) {
      toast({
        title: "Subject Required",
        description: "Please select a subject to view analytics",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Construct the correct API endpoint with current schema
      const params = new URLSearchParams({
        classId: filterDept,
        sectionId: filterSection,
        semester: filterSemester,
        subject: filterSubject
      });

      const endpoint = `/analytics/class-stats?${params}`;

      console.log('Fetching analytics data from:', endpoint);

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      console.log('Analytics API response:', data);

      if (response.ok) {
        if (!data.students || data.students.length === 0) {
          setError("No students found for the selected filters. Students may not be registered for this subject.");
          setApiData(null);
        } else {
          setApiData(data);
          setError("");
          toast({
            title: "Data Loaded",
            description: `Found ${data.students.length} students for ${filterSubject}`,
          });
        }
      } else {
        if (data.message === "No students available for the selected filters") {
          setError("No students are registered for this subject in the selected class and section.");
          setApiData(null);
        } else {
          throw new Error(data.message || 'Failed to fetch analytics data');
        }
      }
    } catch (error: any) {
      console.error('Analytics fetch error:', error);
      setError(error.message || 'Failed to fetch analytics data');
      setApiData(null);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch analytics data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch when subject is selected (and other filters are valid)
  useEffect(() => {
    if (hasValidFilters && filterSubject) {
      fetchAnalyticsData();
    } else {
      setApiData(null);
      if (hasValidFilters && !filterSubject) {
        setError("Please select a Subject to view analytics");
      }
    }
  }, [filterSubject, hasValidFilters, filterSemester, filterDept, filterSection]);

  // Handle filter changes
  const handleFilterChange = (filterType: string, value: string) => {
    switch (filterType) {
      case 'semester':
        setFilterSemester(value);
        break;
      case 'department':
        setFilterDept(value);
        break;
      case 'section':
        setFilterSection(value);
        break;
      case 'subject':
        setFilterSubject(value);
        break;
    }
  };

  // Dynamic tooltip styles for dark mode
  const getTooltipStyle = (borderColor: string) => {
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return {
        backgroundColor: 'hsl(142 25% 10%)',
        border: `2px solid hsl(142 30% 20%)`,
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3)',
        color: 'hsl(0 0% 100%)'
      };
    }
    return {
      backgroundColor: '#fff',
      border: `2px solid ${borderColor}`,
      borderRadius: '12px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.1)',
      color: '#374151'
    };
  };

  const getAxisColor = () => {
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'hsl(0 0% 100%)';
    }
    return '#6b7280';
  };

  const getGridColor = () => {
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'hsl(142 30% 20%)';
    }
    return '#e5e7eb';
  };

  const getStrokeColor = () => {
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'hsl(142 30% 20%)';
    }
    return '#fff';
  };

  const getActiveDotFill = () => {
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'hsl(142 25% 10%)';
    }
    return '#fff';
  };

  // Student Login Page Only (As per request)
  if (!isTeacher) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-bold text-primary mb-2">Student Analytics</h1>
          <p className="text-sm text-muted-foreground uppercase tracking-wider">Your personal attendance insights</p>
        </div>
        
        <Card className="shadow-md border border-border/50">
          <CardContent className="p-12 text-center">
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                <BarChart className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-muted-foreground">Student Analytics</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Student analytics view is available. Please check your attendance records.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Teacher View
  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-primary mb-2">Attendance Analysis</h1>
        <p className="text-sm text-muted-foreground uppercase tracking-wider">Comprehensive attendance insights and analytics</p>
      </div>

      {/* OVERVIEW GRAPH - All Subjects Attendance Variance */}
      {overviewData && overviewData.subjects && overviewData.subjects.length > 0 && (
        <Card className="border-0 shadow-2xl bg-gradient-to-br from-background via-background to-primary/5">
          <CardHeader className="pb-4 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-serif font-bold text-primary mb-1">Teaching Overview</CardTitle>
                <CardDescription className="text-sm font-medium">Attendance performance across all your assigned subjects</CardDescription>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <BarChart className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8 pb-6">
            <div style={{ height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart 
                  data={overviewData.subjects}
                  margin={{ top: 30, right: 40, left: 50, bottom: 120 }}
                  barGap={8}
                  barCategoryGap="20%"
                >
                  <defs>
                    <linearGradient id="colorGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.6}/>
                    </linearGradient>
                    <linearGradient id="colorYellow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.6}/>
                    </linearGradient>
                    <linearGradient id="colorRed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0.6}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke={getGridColor()} 
                    vertical={false}
                    strokeOpacity={0.3}
                  />
                  <XAxis 
                    dataKey="label" 
                    angle={-35}
                    textAnchor="end"
                    height={110}
                    interval={0}
                    tick={{ 
                      fill: getAxisColor(), 
                      fontSize: 12,
                      fontWeight: 500,
                      fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}
                    tickLine={{ stroke: getAxisColor(), strokeWidth: 1 }}
                    axisLine={{ stroke: getAxisColor(), strokeWidth: 2 }}
                  />
                  <YAxis 
                    label={{ 
                      value: 'Attendance Percentage (%)', 
                      angle: -90, 
                      position: 'insideLeft',
                      offset: 10,
                      style: { 
                        fill: getAxisColor(),
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }
                    }}
                    tick={{ 
                      fill: getAxisColor(),
                      fontSize: 12,
                      fontWeight: 500
                    }}
                    tickLine={{ stroke: getAxisColor(), strokeWidth: 1 }}
                    axisLine={{ stroke: getAxisColor(), strokeWidth: 2 }}
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                  />
                  <RechartsTooltip 
                    contentStyle={{
                      ...getTooltipStyle('#10b981'),
                      padding: '12px 16px',
                      fontSize: '14px',
                      fontWeight: 500
                    }}
                    formatter={(value: any) => [`${value}%`, 'Attendance']}
                    labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
                    cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                  />
                  <Bar 
                    dataKey="averageAttendance" 
                    radius={[10, 10, 0, 0]}
                    maxBarSize={60}
                  >
                    {overviewData.subjects.map((entry: any, index: number) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={
                          entry.averageAttendance >= 75 
                            ? 'url(#colorGreen)' 
                            : entry.averageAttendance >= 60 
                            ? 'url(#colorYellow)' 
                            : 'url(#colorRed)'
                        }
                        stroke={
                          entry.averageAttendance >= 75 
                            ? '#10b981' 
                            : entry.averageAttendance >= 60 
                            ? '#f59e0b' 
                            : '#ef4444'
                        }
                        strokeWidth={2}
                      />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 pt-4 border-t border-border/50">
              <div className="flex items-center justify-center gap-8 text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-green-500 to-green-600 shadow-sm border-2 border-green-500"></div>
                  <span className="font-medium text-foreground">Excellent (≥75%)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-sm border-2 border-yellow-500"></div>
                  <span className="font-medium text-foreground">Moderate (60-74%)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-red-500 to-red-600 shadow-sm border-2 border-red-500"></div>
                  <span className="font-medium text-foreground">At Risk (&lt;60%)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FILTER SECTION - Always show this first */}
      <Card className="shadow-md border border-border/50">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-4">
          <CardTitle className="text-base font-bold uppercase text-muted-foreground">Filters & Controls</CardTitle>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Semester</label>
            <Select value={filterSemester} onValueChange={(value) => handleFilterChange('semester', value)} disabled={loadingCourses}>
              <SelectTrigger className="h-10 border-primary/20 hover:border-primary/50 transition-colors">
                <SelectValue placeholder={loadingCourses ? "Loading..." : "Select Semester"} />
              </SelectTrigger>
              <SelectContent>
                {availableSemesters.map(s => (
                  <SelectItem key={s} value={s.toString()}>Sem {s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Dept</label>
            <Select value={filterDept} onValueChange={(value) => handleFilterChange('department', value)} disabled={!filterSemester || loadingCourses}>
              <SelectTrigger className="h-10 border-primary/20 hover:border-primary/50 transition-colors">
                <SelectValue placeholder="Select Dept"/>
              </SelectTrigger>
              <SelectContent>
                {availableDepartments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Section</label>
            <Select value={filterSection} onValueChange={(value) => handleFilterChange('section', value)} disabled={!filterDept || loadingCourses}>
              <SelectTrigger className="h-10 border-primary/20 hover:border-primary/50 transition-colors">
                <SelectValue placeholder="Select Section"/>
              </SelectTrigger>
              <SelectContent>
                {availableSections.map(sec => (
                  <SelectItem key={sec} value={sec}>Section {sec}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subject</label>
            <Select 
              value={filterSubject} 
              onValueChange={(value) => handleFilterChange('subject', value)}
              disabled={!filterSection || loadingCourses}
            >
              <SelectTrigger className={cn(
                "h-10 border-primary/20 hover:border-primary/50 transition-colors",
                (!filterSection || loadingCourses) && "opacity-50 cursor-not-allowed"
              )}>
                <SelectValue placeholder={
                  loadingCourses 
                    ? "Loading subjects..." 
                    : availableSubjects.length === 0 && filterSection
                    ? "No subjects available"
                    : "Select Subject"
                } />
              </SelectTrigger>
              <SelectContent>
                {availableSubjects.length === 0 ? (
                  <SelectItem value="no-subjects" disabled>
                    {filterSection ? "No subjects found for this class" : "Select filters first"}
                  </SelectItem>
                ) : (
                  availableSubjects.map((subject: string, index: number) => (
                    <SelectItem key={`${subject}-${index}`} value={subject}>{subject}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {filterSection && availableSubjects.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {availableSubjects.length} subject{availableSubjects.length !== 1 ? 's' : ''} available
              </p>
            )}
          </div>
          
          {/* Validation Message */}
          {error && (
            <div className="col-span-full">
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            </div>
          )}
          
          {/* Loading Indicator */}
          {isLoading && (
            <div className="col-span-full">
              <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 p-3 rounded-md border border-primary/20">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading analytics data...
              </div>
            </div>
          )}

          {/* Manual Refresh Button */}
          {hasValidFilters && filterSubject && !isLoading && (
            <div className="col-span-full">
              <Button 
                onClick={fetchAnalyticsData}
                variant="outline"
                className="w-full"
              >
                <BarChart className="h-4 w-4 mr-2" />
                Refresh Analytics Data
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Only show analytics content when we have valid data */}
      {apiData && !error && !isLoading ? (
        <AnalyticsContent apiData={apiData} />
      ) : (
        /* Show placeholder when no data */
        <Card className="shadow-md border border-border/50">
          <CardContent className="p-12 text-center">
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                <BarChart className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-muted-foreground">No Analytics Data</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {!hasValidFilters 
                    ? "Please select Semester, Department, and Section to continue"
                    : !filterSubject 
                    ? "Please select a Subject to view analytics"
                    : "No data available for the selected filters"
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Analytics Content Component (to be rendered when data is available)
  function AnalyticsContent({ apiData }: { apiData: any }) {
    // Filter students based on search and threshold
    const filteredStudents = (apiData.students || []).filter((student: any) => {
      const matchesSearch = searchQuery === "" || 
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.usn.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesThreshold = thresholdFilter === 'all' ||
        (thresholdFilter === 'above' && student.percentage >= 75) ||
        (thresholdFilter === 'below' && student.percentage < 75);
      
      return matchesSearch && matchesThreshold;
    });

    return (
      <>
        {/* Two graphs side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Graph 1: Attendance Trend */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold">Attendance Trend</CardTitle>
              <CardDescription className="text-sm">Weekly attendance pattern analysis</CardDescription>
            </CardHeader>
            <CardContent className="pt-6" style={{ height: '320px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={apiData.trendData || []} 
                  margin={{ top: 25, right: 35, left: 25, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridColor()} />
                  <XAxis dataKey="name" stroke={getAxisColor()} fontSize={12} fontWeight="500" />
                  <YAxis stroke={getAxisColor()} fontSize={12} fontWeight="500" />
                  <RechartsTooltip 
                    contentStyle={{
                      ...getTooltipStyle('#3b82f6'),
                      boxShadow: '0 10px 25px rgba(59, 130, 246, 0.2)'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="avg" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ fill: getActiveDotFill(), stroke: '#3b82f6', strokeWidth: 2, r: 5 }}
                    activeDot={{ r: 7, stroke: '#3b82f6', strokeWidth: 3, fill: getActiveDotFill() }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Graph 2: Attendance Risk Distribution */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold">Attendance Risk Distribution</CardTitle>
              <CardDescription className="text-sm">Student count by risk category</CardDescription>
            </CardHeader>
            <CardContent className="pt-6" style={{ height: '320px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={apiData.riskDistribution || []}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="count"
                    label={({ name, value }: any) => `${name}: ${value}`}
                  >
                    {(apiData.riskDistribution || []).map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={['#10b981', '#f59e0b', '#ef4444'][index % 3]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* ML Model Legend */}
        <Card className="shadow-md border border-border/50 bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase">ML Model Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="font-semibold mb-2">Trend:</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-600" /> Improving</div>
                  <div className="flex items-center gap-2"><Minus className="h-4 w-4 text-blue-600" /> Stable</div>
                  <div className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-600" /> Declining</div>
                </div>
              </div>
              <div>
                <p className="font-semibold mb-2">Risk:</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2"><span className="text-2xl" style={{ filter: 'grayscale(0%) contrast(100%)' }}>😊</span> Low Risk (Above 75%)</div>
                  <div className="flex items-center gap-2"><span className="text-2xl" style={{ filter: 'grayscale(0%) contrast(100%)' }}>😐</span> Moderate Risk (Around 75%)</div>
                  <div className="flex items-center gap-2"><span className="text-2xl" style={{ filter: 'grayscale(0%) contrast(100%)' }}>😟</span> High Risk (Below 75%)</div>
                </div>
              </div>
              <div>
                <p className="font-semibold mb-2">Consistency:</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2"><span className="text-green-600">●●●</span> High</div>
                  <div className="flex items-center gap-2"><span className="text-yellow-600">●●○</span> Medium</div>
                  <div className="flex items-center gap-2"><span className="text-red-600">●○○</span> Low</div>
                </div>
              </div>
              <div>
                <p className="font-semibold mb-2">Attentiveness:</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2"><span className="text-lg">⚡</span> High Attentiveness</div>
                  <div className="flex items-center gap-2"><span className="text-lg">🔋</span> Medium Attentiveness</div>
                  <div className="flex items-center gap-2"><span className="text-lg">🪫</span> Low Attentiveness</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Student Table */}
        {apiData.students && apiData.students.length > 0 && (
          <Card className="shadow-md border border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Student Attendance Records</CardTitle>
              <CardDescription>
                Total Classes: {apiData.overallStats?.totalClasses || 0} | 
                Average Attendance: {apiData.overallStats?.averageAttendance?.toFixed(1) || 0}%
              </CardDescription>
              
              {/* Search and Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or USN..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={thresholdFilter === 'above' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setThresholdFilter('above')}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Above 75%
                  </Button>
                  <Button
                    variant={thresholdFilter === 'below' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setThresholdFilter('below')}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Below 75%
                  </Button>
                  {thresholdFilter !== 'all' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setThresholdFilter('all')}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>USN</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-center">Attended</TableHead>
                      <TableHead className="text-center">Absent</TableHead>
                      <TableHead>Attendance %</TableHead>
                      <TableHead className="text-center">Trend</TableHead>
                      <TableHead className="text-center">Risk</TableHead>
                      <TableHead className="text-center">Consistency</TableHead>
                      <TableHead className="text-center">Attentiveness</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          No students found matching your criteria
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStudents.map((student: any) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-mono text-sm">{student.usn}</TableCell>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell className="text-center">{student.present || 0}</TableCell>
                          <TableCell className="text-center">{student.absent || 0}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{student.percentage}%</span>
                                <Badge 
                                  variant={student.percentage >= 75 ? "default" : "destructive"}
                                  className="text-xs"
                                >
                                  {student.percentage >= 75 ? "Good" : "At Risk"}
                                </Badge>
                              </div>
                              <Progress 
                                value={student.percentage} 
                                className={cn(
                                  "h-2",
                                  student.percentage >= 75 ? "bg-green-200" : "bg-red-200"
                                )}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {getMLTrendIcon(student.trend || null)}
                          </TableCell>
                          <TableCell className="text-center">
                            {getMLRiskIcon(student.risk || null)}
                          </TableCell>
                          <TableCell className="text-center">
                            {getMLConsistencyIcon(student.consistency || null)}
                          </TableCell>
                          <TableCell className="text-center">
                            {getMLAttentivenessIcon(student.attentiveness || null)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {/* Summary Stats */}
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Showing {filteredStudents.length} of {apiData.students.length} students
                </span>
                <span>
                  Below 75%: {apiData.students.filter((s: any) => s.percentage < 75).length} students
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </>
    );
  }
}


// Student Analysis View Component
function StudentAnalysisView() {
  const { currentUser } = useStore();
  const { toast } = useToast();
  
  // Student's actual enrollments approach - 4 filters
  const [filterSemester, setFilterSemester] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  
  // Dynamic options based on student's actual enrollments
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  
  const [studentEnrollments, setStudentEnrollments] = useState<any[]>([]);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingEnrollments, setIsLoadingEnrollments] = useState(false);
  const [error, setError] = useState("");

  // Fetch student's actual enrollments on mount
  useEffect(() => {
    const fetchStudentEnrollments = async () => {
      setIsLoadingEnrollments(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/analytics/student-enrollments`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setStudentEnrollments(data.enrollments || []);
          
          // Extract unique semesters
          const enrollments = data.enrollments as Array<{semester: number, department: string, section: string, course_name: string}>;
          const semesterNumbers = enrollments.map(e => e.semester.toString());
          const semesters: string[] = Array.from(new Set(semesterNumbers)).sort();
          setAvailableSemesters(semesters);
        }
      } catch (error) {
        console.error('Error fetching student enrollments:', error);
      } finally {
        setIsLoadingEnrollments(false);
      }
    };

    fetchStudentEnrollments();
  }, []);

  // Update available departments when semester changes
  useEffect(() => {
    if (!filterSemester) {
      setAvailableDepartments([]);
      setFilterDepartment("");
      return;
    }

    const filtered = studentEnrollments.filter(e => e.semester.toString() === filterSemester);
    const departments: string[] = Array.from(new Set(filtered.map((e: any) => e.department))).sort();
    setAvailableDepartments(departments);
    
    if (filterDepartment && !departments.includes(filterDepartment)) {
      setFilterDepartment("");
    }
  }, [filterSemester, studentEnrollments]);

  // Update available sections when department changes
  useEffect(() => {
    if (!filterSemester || !filterDepartment) {
      setAvailableSections([]);
      setFilterSection("");
      return;
    }

    const filtered = studentEnrollments.filter(e => 
      e.semester.toString() === filterSemester && 
      e.department === filterDepartment
    );
    const sections: string[] = Array.from(new Set(filtered.map((e: any) => e.section))).sort();
    setAvailableSections(sections);
    
    if (filterSection && !sections.includes(filterSection)) {
      setFilterSection("");
    }
  }, [filterSemester, filterDepartment, studentEnrollments]);

  // Update available subjects when section changes
  useEffect(() => {
    if (!filterSemester || !filterDepartment || !filterSection) {
      setAvailableSubjects([]);
      setFilterSubject("");
      return;
    }

    const filtered = studentEnrollments.filter(e => 
      e.semester.toString() === filterSemester && 
      e.department === filterDepartment &&
      e.section === filterSection
    );
    const subjects: string[] = filtered.map((e: any) => e.course_name);
    setAvailableSubjects(subjects);
    
    if (filterSubject && !subjects.includes(filterSubject)) {
      setFilterSubject("");
    }
  }, [filterSemester, filterDepartment, filterSection, studentEnrollments]);

  // Fetch student analysis data
  useEffect(() => {
    const fetchAnalysisData = async () => {
      if (!filterSemester || !filterDepartment || !filterSection || !filterSubject) {
        setAnalysisData(null);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Authentication required');
        }

        const params = new URLSearchParams({
          semester: filterSemester,
          department: filterDepartment,
          section: filterSection,
          subject: filterSubject
        });

        const response = await fetch(`${API_BASE_URL}/analytics/student-analysis?${params}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();

        if (response.ok) {
          setAnalysisData(data);
          setError("");
        } else {
          setError(data.message || 'Failed to fetch analysis data');
          setAnalysisData(null);
        }
      } catch (error: any) {
        console.error('Error fetching analysis data:', error);
        setError(error.message || 'Failed to fetch analysis data');
        setAnalysisData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalysisData();
  }, [filterSemester, filterDepartment, filterSection, filterSubject]);

  // Dynamic tooltip styles for dark mode
  const getTooltipStyle = (borderColor: string) => {
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return {
        backgroundColor: 'hsl(142 25% 10%)',
        border: `2px solid hsl(142 30% 20%)`,
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3)',
        color: 'hsl(0 0% 100%)'
      };
    }
    return {
      backgroundColor: '#fff',
      border: `2px solid ${borderColor}`,
      borderRadius: '12px',
      boxShadow: `0 10px 25px ${borderColor}20`
    };
  };

  const getAxisColor = () => {
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'hsl(0 0% 100%)';
    }
    return '#6b7280';
  };

  const getGridColor = () => {
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'hsl(142 30% 20%)';
    }
    return '#e5e7eb';
  };

  const getStrokeColor = () => {
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'hsl(142 30% 20%)';
    }
    return '#fff';
  };

  const getActiveDotFill = () => {
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'hsl(142 25% 10%)';
    }
    return '#fff';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-primary mb-2">My Attendance Analysis</h1>
        <p className="text-sm text-muted-foreground uppercase tracking-wider">Personal attendance insights and ML predictions</p>
      </div>

      {/* Academic Info Card */}
      {analysisData?.studentInfo && (
        <Card className="mb-6 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Academic Info</h2>
                <div className="flex gap-12">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Department</p>
                    <p className="text-xl font-bold">{analysisData.studentInfo.department}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Class</p>
                    <p className="text-xl font-bold">{analysisData.studentInfo.department} - {analysisData.studentInfo.section} Section</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Semester</p>
                    <p className="text-xl font-bold">{analysisData.studentInfo.semester}th Semester</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Section */}
      <Card className="shadow-md border border-border/50">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-4">
          <CardTitle className="text-base font-bold uppercase text-muted-foreground">Select Filters</CardTitle>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Semester</label>
            <Select value={filterSemester} onValueChange={setFilterSemester} disabled={isLoadingEnrollments}>
              <SelectTrigger className="h-10 border-primary/20 hover:border-primary/50 transition-colors">
                <SelectValue placeholder={isLoadingEnrollments ? "Loading..." : "Select Semester"} />
              </SelectTrigger>
              <SelectContent>
                {availableSemesters.map(s => (
                  <SelectItem key={s} value={s}>Sem {s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Department</label>
            <Select value={filterDepartment} onValueChange={setFilterDepartment} disabled={!filterSemester || isLoadingEnrollments}>
              <SelectTrigger className="h-10 border-primary/20 hover:border-primary/50 transition-colors">
                <SelectValue placeholder="Select Department" />
              </SelectTrigger>
              <SelectContent>
                {availableDepartments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Section</label>
            <Select value={filterSection} onValueChange={setFilterSection} disabled={!filterDepartment || isLoadingEnrollments}>
              <SelectTrigger className="h-10 border-primary/20 hover:border-primary/50 transition-colors">
                <SelectValue placeholder="Select Section" />
              </SelectTrigger>
              <SelectContent>
                {availableSections.map(section => (
                  <SelectItem key={section} value={section}>Section {section}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subject</label>
            <Select 
              value={filterSubject} 
              onValueChange={setFilterSubject}
              disabled={!filterSection || isLoadingEnrollments}
            >
              <SelectTrigger className={cn(
                "h-10 border-primary/20 hover:border-primary/50 transition-colors",
                (!filterSection || isLoadingEnrollments) && "opacity-50 cursor-not-allowed"
              )}>
                <SelectValue placeholder={
                  isLoadingEnrollments
                    ? "Loading subjects..."
                    : availableSubjects.length === 0 && filterSection
                    ? "No subjects available"
                    : "Select Subject"
                } />
              </SelectTrigger>
              <SelectContent>
                {availableSubjects.length === 0 ? (
                  <SelectItem value="no-subjects" disabled>
                    {!filterSemester || !filterDepartment || !filterSection ? "Select all filters first" : "No subjects found"}
                  </SelectItem>
                ) : (
                  availableSubjects.map((subject: string, index: number) => (
                    <SelectItem key={`${subject}-${index}`} value={subject}>{subject}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {filterSection && availableSubjects.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {availableSubjects.length} subject{availableSubjects.length !== 1 ? 's' : ''} available
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="col-span-full">
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="col-span-full">
              <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 p-3 rounded-md border border-primary/20">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading analysis data...
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Show analysis data when available */}
      {analysisData && !error && !isLoading ? (
        <>
          {/* Attendance Summary */}
          <Card className="shadow-none border-l-4 border-l-success mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase text-muted-foreground">
                Attendance Summary - {analysisData.studentInfo?.subject}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end mb-2">
                <div>
                  <p className="text-2xl font-bold">{analysisData.attendanceStats?.percentage || 0}%</p>
                  <p className="text-[10px] text-muted-foreground">Overall Attendance</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold">
                    {analysisData.attendanceStats?.present || 0} / {analysisData.attendanceStats?.total || 0} Classes
                  </p>
                </div>
              </div>
              <Progress value={analysisData.attendanceStats?.percentage || 0} className="h-1.5" />
            </CardContent>
          </Card>

          {/* ML Analysis Cards */}
          <div className="mb-8">
            <h2 className="text-sm font-bold text-muted-foreground uppercase mb-4 px-1">Student Analysis</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: ML - Trend Analysis */}
              <Card className="border-l-4 border-l-success shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300">
                <CardHeader className="pb-2 bg-gradient-to-br from-success/10 to-transparent">
                  <CardTitle className="text-sm font-bold text-foreground">1) ML – Trend Analysis</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 flex flex-col items-center justify-center text-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center text-success">
                    {analysisData.mlAnalysis?.trend ? (
                      analysisData.mlAnalysis.trend === 'improving' ? <TrendingUp className="h-6 w-6" /> :
                      analysisData.mlAnalysis.trend === 'declining' ? <TrendingDown className="h-6 w-6" /> :
                      <Minus className="h-6 w-6" />
                    ) : <HelpCircle className="h-6 w-6" />}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-success">
                      {getMLLabel(analysisData.mlAnalysis?.trend)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {analysisData.mlAnalysis?.trend ? 'Your attendance trend' : 'ML model not trained yet'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: ML - Risk Prediction */}
              <Card className="border-l-4 border-l-primary shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300">
                <CardHeader className="pb-2 bg-gradient-to-br from-primary/10 to-transparent">
                  <CardTitle className="text-sm font-bold text-foreground">2) ML – Risk Prediction</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 flex flex-col items-center justify-center text-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl">
                    {getMLRiskIcon(analysisData.mlAnalysis?.risk)}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-primary">
                      {getMLLabel(analysisData.mlAnalysis?.risk)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {analysisData.mlAnalysis?.risk ? 'Risk assessment' : 'ML model not trained yet'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: ML - Consistency Analysis */}
              <Card className="border-l-4 border-l-warning shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300">
                <CardHeader className="pb-2 bg-gradient-to-br from-warning/10 to-transparent">
                  <CardTitle className="text-sm font-bold text-foreground">3) ML – Consistency Analysis</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 flex flex-col items-center justify-center text-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500 text-xl">
                    {getMLConsistencyIcon(analysisData.mlAnalysis?.consistency)}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-orange-500">
                      {getMLLabel(analysisData.mlAnalysis?.consistency)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {analysisData.mlAnalysis?.consistency ? 'Attendance pattern' : 'ML model not trained yet'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Card 4: Attentiveness Level */}
              <Card className="border-l-4 border-l-blue-500 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300">
                <CardHeader className="pb-2 bg-gradient-to-br from-blue-50 to-transparent">
                  <CardTitle className="text-sm font-bold text-foreground">4) Attentiveness Level</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 flex flex-col items-center justify-center text-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center text-2xl">
                    {getMLAttentivenessIcon(analysisData.mlAnalysis?.attentiveness)}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-blue-600">
                      {getMLLabel(analysisData.mlAnalysis?.attentiveness)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {analysisData.mlAnalysis?.attentiveness ? 'Classroom participation' : 'ML model not trained yet'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Detailed Analysis Graphs */}
          <div className="space-y-6 mb-8">
            <h2 className="text-lg font-bold mb-6 px-1">Detailed Analysis Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Graph 1: Attendance Trend Over Time */}
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold">1) Attendance Trend Over Time</CardTitle>
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider text-green-600">
                    ML – TREND ANALYSIS GRAPH
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6" style={{ height: '280px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analysisData.chartData?.trendData || []} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridColor()}/>
                      <XAxis dataKey="name" fontSize={12} stroke={getAxisColor()} fontWeight="500"/>
                      <YAxis fontSize={12} stroke={getAxisColor()} fontWeight="500"/>
                      <RechartsTooltip contentStyle={getTooltipStyle('#10b981')} />
                      <Line 
                        type="monotone" 
                        dataKey="attendance" 
                        stroke="#10b981" 
                        strokeWidth={3} 
                        dot={{fill: '#10b981', r: 5, strokeWidth: 2, stroke: getStrokeColor()}} 
                        activeDot={{r: 7, stroke: '#10b981', strokeWidth: 3, fill: getActiveDotFill()}}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Graph 2: Attendance Risk Category Distribution */}
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold">2) ML Risk Prediction Analysis</CardTitle>
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    ML – RISK PREDICTION RESULT
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6" style={{ height: '280px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart 
                      data={[
                        {
                          name: 'Low Risk',
                          value: analysisData.mlAnalysis?.risk === 'low' ? 100 : 0,
                          fill: '#10b981'
                        },
                        {
                          name: 'Moderate Risk',
                          value: analysisData.mlAnalysis?.risk === 'moderate' ? 100 : 0,
                          fill: '#f59e0b'
                        },
                        {
                          name: 'High Risk',
                          value: analysisData.mlAnalysis?.risk === 'high' ? 100 : 0,
                          fill: '#ef4444'
                        }
                      ]}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={getGridColor()} />
                      <XAxis dataKey="name" stroke={getAxisColor()} fontSize={11} />
                      <YAxis stroke={getAxisColor()} fontSize={12} domain={[0, 100]} />
                      <RechartsTooltip 
                        contentStyle={getTooltipStyle('#3b82f6')}
                        formatter={(value: any) => [`${value}%`, 'Risk Level']}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Graph 3: Attendance Consistency Distribution */}
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold">3) ML Consistency Analysis</CardTitle>
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider text-teal-600">
                    ML – CONSISTENCY ANALYSIS RESULT
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6" style={{ height: '280px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: analysisData.mlAnalysis?.consistency === 'high' ? 'HIGH CONSISTENCY' : 
                                  analysisData.mlAnalysis?.consistency === 'medium' ? 'MEDIUM CONSISTENCY' : 
                                  analysisData.mlAnalysis?.consistency === 'low' ? 'LOW CONSISTENCY' :
                                  'NO DATA',
                            value: 100, // Always show 100% for the actual result
                            fill: analysisData.mlAnalysis?.consistency === 'high' ? '#10b981' :
                                  analysisData.mlAnalysis?.consistency === 'medium' ? '#f59e0b' :
                                  analysisData.mlAnalysis?.consistency === 'low' ? '#ef4444' :
                                  '#6b7280'
                          }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={0}
                        dataKey="value"
                        label={({ name }) => name}
                      >
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={getTooltipStyle('#10b981')} 
                        formatter={(value: any, name: any) => [`${analysisData.mlAnalysis?.consistency || 'no_data'}`, 'Consistency Level']}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        iconType="circle"
                        formatter={(value) => <span className="text-xs font-medium">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Graph 4: Student Attentiveness Level Analysis */}
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold">4) ML Attentiveness Analysis</CardTitle>
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider text-cyan-600">
                    ML – ATTENTIVENESS ANALYSIS RESULT
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6" style={{ height: '280px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart 
                      data={[
                        {
                          name: 'High Attentiveness',
                          value: analysisData.mlAnalysis?.attentiveness === 'High' ? 100 : 0,
                          fill: '#06b6d4'
                        },
                        {
                          name: 'Medium Attentiveness',
                          value: analysisData.mlAnalysis?.attentiveness === 'Medium' ? 100 : 0,
                          fill: '#0891b2'
                        },
                        {
                          name: 'Low Attentiveness',
                          value: analysisData.mlAnalysis?.attentiveness === 'Low' ? 100 : 0,
                          fill: '#0e7490'
                        }
                      ]}
                      layout="vertical"
                      margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={getGridColor()} />
                      <XAxis type="number" stroke={getAxisColor()} fontSize={12} domain={[0, 100]} />
                      <YAxis type="category" dataKey="name" stroke={getAxisColor()} fontSize={11} width={90} />
                      <RechartsTooltip 
                        contentStyle={getTooltipStyle('#06b6d4')}
                        formatter={(value: any) => [`${analysisData.mlAnalysis?.attentiveness || 'no_data'}`, 'Attentiveness Level']}
                      />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]} />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : (
        /* Show placeholder when no data */
        !isLoading && !error && (
          <Card className="shadow-md border border-border/50">
            <CardContent className="p-12 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                  <BarChart className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-muted-foreground">No Analysis Data</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {!filterSemester 
                      ? "Please select a semester to continue"
                      : !filterDepartment 
                      ? "Please select a department to continue"
                      : !filterSection
                      ? "Please select a section to continue"
                      : !filterSubject 
                      ? "Please select a subject to view your analysis"
                      : "No data available for the selected filters"
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
