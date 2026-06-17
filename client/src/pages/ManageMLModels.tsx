import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain, 
  Database, 
  TrendingUp, 
  BarChart3, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  Play,
  RefreshCw
} from "lucide-react";

function ManageMLModels() {
  const [activeTab, setActiveTab] = useState("train");
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [modelStatus, setModelStatus] = useState({
    model1: { trained: false, accuracy: 0 },
    model2: { trained: true, accuracy: 97.8 },
    model3: { trained: false, accuracy: 0 },
    model4: { trained: false, accuracy: 0 }
  });
  const { toast } = useToast();

  const handleTrainModels = async () => {
    setIsTraining(true);
    setTrainingProgress(0);
    
    try {
      // Simulate training progress
      const interval = setInterval(() => {
        setTrainingProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsTraining(false);
            toast({
              title: "Training Complete",
              description: "All ML models have been trained successfully!",
            });
            return 100;
          }
          return prev + 10;
        });
      }, 500);
      
    } catch (error) {
      setIsTraining(false);
      toast({
        title: "Training Failed",
        description: "Failed to train ML models. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Manage ML Models</h1>
        <p className="text-muted-foreground">Train and monitor machine learning models for attendance analysis</p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="train" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Brain className="h-4 w-4 mr-2" />
            Train Models
          </TabsTrigger>
          <TabsTrigger value="results" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
            <BarChart3 className="h-4 w-4 mr-2" />
            Model Performance
          </TabsTrigger>
        </TabsList>

        {/* Train Models Tab */}
        <TabsContent value="train" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Training Control Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Training Control Panel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Train ML models using your institution's historical attendance data to improve prediction accuracy.
                  </p>
                  
                  {isTraining && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Training Progress</span>
                        <span>{trainingProgress}%</span>
                      </div>
                      <Progress value={trainingProgress} className="h-2" />
                    </div>
                  )}
                </div>

                <Button 
                  onClick={handleTrainModels}
                  disabled={isTraining}
                  className="w-full"
                  size="lg"
                >
                  {isTraining ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Training Models...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start Training
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Data Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Training Data Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">1,247</div>
                    <div className="text-xs text-muted-foreground">Students</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">15,892</div>
                    <div className="text-xs text-muted-foreground">Attendance Records</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">342</div>
                    <div className="text-xs text-muted-foreground">Sessions</div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">8,456</div>
                    <div className="text-xs text-muted-foreground">Face Recognition Data</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        {/* Model Performance Tab */}
        <TabsContent value="results" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Model 1: Trend Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Model 1: Trend Analysis
                  </span>
                  <Badge variant={modelStatus.model1.trained ? "default" : "secondary"}>
                    {modelStatus.model1.trained ? "Trained" : "Not Trained"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Accuracy</span>
                    <span className="font-mono">{modelStatus.model1.accuracy}%</span>
                  </div>
                  <Progress value={modelStatus.model1.accuracy} className="h-2" />
                </div>
                <div className="text-sm text-muted-foreground">
                  Analyzes attendance trends over time to predict improving, stable, or declining patterns.
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {modelStatus.model1.trained ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                  )}
                  <span>
                    {modelStatus.model1.trained ? "Ready for predictions" : "Requires training"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Model 2: Risk Prediction */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    Model 2: Risk Prediction
                  </span>
                  <Badge variant={modelStatus.model2.trained ? "default" : "secondary"}>
                    {modelStatus.model2.trained ? "Trained" : "Not Trained"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Accuracy</span>
                    <span className="font-mono">{modelStatus.model2.accuracy}%</span>
                  </div>
                  <Progress value={modelStatus.model2.accuracy} className="h-2" />
                </div>
                <div className="text-sm text-muted-foreground">
                  Predicts students at risk of falling below attendance thresholds using XGBoost classifier.
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {modelStatus.model2.trained ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                  )}
                  <span>
                    {modelStatus.model2.trained ? "Ready for predictions" : "Requires training"}
                  </span>
                </div>
              </CardContent>
            </Card>
            {/* Model 3: Consistency Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Model 3: Consistency Analysis
                  </span>
                  <Badge variant={modelStatus.model3.trained ? "default" : "secondary"}>
                    {modelStatus.model3.trained ? "Trained" : "Not Trained"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Accuracy</span>
                    <span className="font-mono">{modelStatus.model3.accuracy}%</span>
                  </div>
                  <Progress value={modelStatus.model3.accuracy} className="h-2" />
                </div>
                <div className="text-sm text-muted-foreground">
                  Evaluates attendance consistency patterns to classify as high, medium, or low consistency.
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {modelStatus.model3.trained ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                  )}
                  <span>
                    {modelStatus.model3.trained ? "Ready for predictions" : "Requires training"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Model 4: Attentiveness Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-600" />
                    Model 4: Attentiveness Analysis
                  </span>
                  <Badge variant={modelStatus.model4.trained ? "default" : "secondary"}>
                    {modelStatus.model4.trained ? "Trained" : "Not Trained"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Accuracy</span>
                    <span className="font-mono">{modelStatus.model4.accuracy}%</span>
                  </div>
                  <Progress value={modelStatus.model4.accuracy} className="h-2" />
                </div>
                <div className="text-sm text-muted-foreground">
                  Analyzes student attentiveness levels using face recognition data during attendance sessions.
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {modelStatus.model4.trained ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                  )}
                  <span>
                    {modelStatus.model4.trained ? "Ready for predictions" : "Requires training"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Overall System Status */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Overall ML System Status</span>
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Status
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">1</div>
                  <div className="text-sm text-muted-foreground">Models Trained</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">3</div>
                  <div className="text-sm text-muted-foreground">Pending Training</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">97.8%</div>
                  <div className="text-sm text-muted-foreground">Best Accuracy</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">Active</div>
                  <div className="text-sm text-muted-foreground">System Status</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ManageMLModels;