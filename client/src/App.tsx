import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import TeacherSignup from "@/pages/TeacherSignup";
import Dashboard from "@/pages/Dashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import ManageStudents from "@/pages/ManageStudents";
import ManageSubjects from "@/pages/ManageSubjects";
import ManageTimetable from "@/pages/ManageTimetable";
import ManageMLModels from "@/pages/ManageMLModels";
import TakeAttendance from "@/pages/TakeAttendance";
import AttendanceRecords from "@/pages/AttendanceRecords";
import AttendanceAnalysis from "@/pages/AttendanceAnalysis";
import StudentAttendance from "@/pages/StudentAttendance";
import Timetable from "@/pages/Timetable";
import DbmsValues from "@/pages/DbmsValues";
import { useStore } from "@/lib/store";

function ProtectedRoute({ component: Component, teacherOnly = false, adminOnly = false }: any) {
  const { currentUser } = useStore();
  
  if (!currentUser) return <Redirect to="/" />;
  if (teacherOnly && currentUser.role !== 'teacher') return <Redirect to="/dashboard" />;
  if (adminOnly && currentUser.role !== 'admin') return <Redirect to="/dashboard" />;
  
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  const { currentUser } = useStore();

  return (
    <Switch>
      <Route path="/">
        <Login />
      </Route>
      
      <Route path="/teacher-signup">
        <TeacherSignup />
      </Route>
      
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>

      <Route path="/admin">
        {() => <ProtectedRoute component={AdminDashboard} adminOnly />}
      </Route>

      <Route path="/students">
        {() => <ProtectedRoute component={ManageStudents} adminOnly />}
      </Route>

      <Route path="/subjects">
        {() => <ProtectedRoute component={ManageSubjects} adminOnly />}
      </Route>

      <Route path="/timetable-manage">
        {() => <ProtectedRoute component={ManageTimetable} adminOnly />}
      </Route>

      <Route path="/ml-models">
        {() => <ProtectedRoute component={ManageMLModels} adminOnly />}
      </Route>
      
      <Route path="/attendance">
        {() => <ProtectedRoute component={TakeAttendance} />}
      </Route>
      
      <Route path="/attendance-records">
        {() => <ProtectedRoute component={AttendanceRecords} />}
      </Route>
      
      <Route path="/analysis">
        {() => <ProtectedRoute component={AttendanceAnalysis} />}
      </Route>

      <Route path="/student-attendance">
        {() => <ProtectedRoute component={StudentAttendance} />}
      </Route>

      <Route path="/timetable">
        {() => <ProtectedRoute component={Timetable} />}
      </Route>



      <Route path="/dbms-values">
        {() => <ProtectedRoute component={DbmsValues} adminOnly />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { initializeUser, logout } = useStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Initialize user from token on app load
  useEffect(() => {
    initializeUser();
  }, [initializeUser]);

  // Listen for token expiration event
  useEffect(() => {
    const handleTokenExpired = async () => {
      // Logout user
      await logout();
      
      // Show toast notification
      toast({
        title: "Session Expired",
        description: "Your session has expired. Please login again.",
        variant: "destructive"
      });
      
      // Redirect to login page
      setLocation("/");
    };

    window.addEventListener('tokenExpired', handleTokenExpired);
    return () => window.removeEventListener('tokenExpired', handleTokenExpired);
  }, [logout, setLocation, toast]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
