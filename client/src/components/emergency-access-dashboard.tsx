import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertTriangle, 
  Clock, 
  User, 
  FileText, 
  Shield, 
  X, 
  Globe, 
  Database,
  Timer,
  Activity,
  Stethoscope
} from "lucide-react";
import { useLocation } from "wouter";

interface EmergencyAccessData {
  temporaryCredential: string;
  patientId: string;
  consentId: string;
  expiresAt: string;
  limitations: string[];
}

interface PatientRecord {
  id: number;
  visitDate: string;
  visitType: string;
  diagnosis: string;
  prescription: string;
  physician: string;
  department: string;
  submittedAt: string;
  recordType: 'traditional' | 'web3';
  source: 'traditional' | 'web3';
}

interface PatientInfo {
  patientId: string;
  patientName: string;
  patientDID?: string;
  hasWeb3Profile: boolean;
  emergencyType: string;
  accessExpiresAt: string;
}

interface EmergencyAccess {
  accessLevel: string;
  limitations: string[];
  expiresAt: string;
  emergencyConsentRecordId: string;
}

interface EmergencyAccessResponse {
  success: boolean;
  message: string;
  patientInfo: PatientInfo;
  records: PatientRecord[];
  emergencyAccess: EmergencyAccess;
  accessedAt: string;
}

export default function EmergencyAccessDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [patientData, setPatientData] = useState<EmergencyAccessResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get emergency access data from URL params or localStorage
  const getEmergencyData = (): EmergencyAccessData | null => {
    const params = new URLSearchParams(window.location.search);
    const data = params.get('emergencyData');
    if (data) {
      try {
        return JSON.parse(decodeURIComponent(data));
      } catch (error) {
        console.error('Failed to parse emergency data:', error);
        return null;
      }
    }
    return null;
  };

  // Access records with emergency credential
  const accessRecordsMutation = useMutation({
    mutationFn: async (emergencyData: EmergencyAccessData) => {
      const response = await apiRequest("POST", "/api/emergency/access-records", {
        temporaryCredential: emergencyData.temporaryCredential,
        patientId: emergencyData.patientId,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to access patient records");
      }
      
      return response.json();
    },
    onSuccess: (data: EmergencyAccessResponse) => {
      setPatientData(data);
      setIsLoading(false);
      
      // Calculate time left
      const expiresAt = new Date(data.emergencyAccess.expiresAt);
      const now = new Date();
      const timeLeftMs = expiresAt.getTime() - now.getTime();
      setTimeLeft(Math.max(0, Math.floor(timeLeftMs / 1000)));
      
      toast({
        title: "Emergency Access Granted",
        description: `Access to ${data.records.length} patient records granted until ${new Date(data.emergencyAccess.expiresAt).toLocaleTimeString()}`,
      });
    },
    onError: (error: Error) => {
      setIsLoading(false);
      toast({
        title: "Emergency Access Failed",
        description: error.message,
        variant: "destructive",
      });
      // Redirect back to emergency form after error
      setTimeout(() => setLocation("/emergency-access"), 3000);
    },
  });

  // Initialize emergency access
  useEffect(() => {
    const emergencyData = getEmergencyData();
    if (!emergencyData) {
      toast({
        title: "No Emergency Data",
        description: "No emergency access data found. Redirecting to emergency form.",
        variant: "destructive",
      });
      setLocation("/emergency-access");
      return;
    }

    // Access patient records immediately
    accessRecordsMutation.mutate(emergencyData);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Auto-close when timer expires
          toast({
            title: "Emergency Access Expired",
            description: "Emergency access has expired. Access denied.",
            variant: "destructive",
          });
          setTimeout(() => setLocation("/"), 2000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, setLocation, toast]);

  // Format time left
  const formatTimeLeft = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Close emergency access
  const handleCloseAccess = () => {
    toast({
      title: "Emergency Access Closed",
      description: "Emergency access has been manually closed.",
    });
    setLocation("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Card className="w-full max-w-4xl mx-4">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-2">
              <Activity className="h-6 w-6 animate-spin text-red-600" />
              <span className="text-lg font-medium">Loading Emergency Access...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!patientData) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Card className="w-full max-w-4xl mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Emergency Access Failed</h2>
              <p className="text-slate-600 mb-4">Unable to load patient records.</p>
              <Button onClick={() => setLocation("/emergency-access")}>
                Return to Emergency Form
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { patientInfo, records, emergencyAccess } = patientData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Emergency Header */}
      <div className="bg-gradient-to-r from-red-600 via-red-700 to-red-800 shadow-lg border-b border-red-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-500 rounded-lg">
                  <AlertTriangle className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Emergency Access Dashboard</h1>
                  <p className="text-red-100 text-sm">Critical patient record access</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="bg-red-500/20 backdrop-blur-sm rounded-lg px-4 py-2 border border-red-400/30">
                  <div className="flex items-center space-x-2">
                    <Timer className="h-5 w-5 text-red-200" />
                    <span className="text-red-100 font-mono text-lg font-semibold">
                      {formatTimeLeft(timeLeft)}
                    </span>
                  </div>
                  <p className="text-red-200 text-xs mt-1">Access expires</p>
                </div>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={handleCloseAccess}
              className="border-red-300 text-red-100 hover:bg-red-500 hover:text-white transition-colors"
            >
              <X className="h-4 w-4 mr-2" />
              Close Access
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Patient Information */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
            <CardTitle className="flex items-center space-x-3 text-blue-900">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="h-6 w-6 text-blue-600" />
              </div>
              <span className="text-xl">Patient Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-600 uppercase tracking-wide">Patient Name</p>
                <p className="text-lg font-bold text-slate-900">{patientInfo.patientName}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-600 uppercase tracking-wide">Patient ID</p>
                <p className="text-lg font-mono font-semibold text-slate-900 bg-slate-50 px-3 py-1 rounded">
                  {patientInfo.patientId}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-600 uppercase tracking-wide">Access Level</p>
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  {emergencyAccess.accessLevel.replace(/_/g, ' ')}
                </Badge>
              </div>
            </div>
            {patientInfo.hasWeb3Profile && (
              <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Globe className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-purple-800">Web3 Profile Available</span>
                    <p className="text-xs text-purple-600 mt-1">Patient has encrypted Web3 records accessible</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Access Limitations */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
            <CardTitle className="flex items-center space-x-3 text-amber-900">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Shield className="h-6 w-6 text-amber-600" />
              </div>
              <span className="text-xl">Access Limitations & Restrictions</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {emergencyAccess.limitations.length > 0 ? (
                <ul className="space-y-3">
                  {emergencyAccess.limitations.map((limitation, index) => (
                    <li key={index} className="flex items-start space-x-3 p-3 bg-amber-50/50 rounded-lg border border-amber-200/50">
                      <div className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0" />
                      <span className="text-sm text-amber-800 font-medium">{limitation}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-6 text-amber-600">
                  <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No specific limitations applied to this emergency access</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Patient Records */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
            <CardTitle className="flex items-center space-x-3 text-green-900">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <span className="text-xl">Patient Medical Records</span>
                <p className="text-sm text-green-700 font-normal">
                  {records.length} record{records.length !== 1 ? 's' : ''} accessible under emergency authorization
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {records.length === 0 ? (
              <div className="text-center py-12">
                <div className="p-4 bg-slate-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <FileText className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">No Records Found</h3>
                <p className="text-slate-600 max-w-md mx-auto">
                  No medical records were found for this patient in the system.
                </p>
              </div>
            ) : (
              <Tabs defaultValue="all" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1 rounded-lg">
                  <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    All Records ({records.length})
                  </TabsTrigger>
                  <TabsTrigger value="traditional" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    Traditional ({records.filter(r => r.source === 'traditional').length})
                  </TabsTrigger>
                  <TabsTrigger value="web3" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    Web3 ({records.filter(r => r.source === 'web3').length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="space-y-4">
                  {records.map((record) => (
                    <RecordCard key={record.id} record={record} />
                  ))}
                </TabsContent>

                <TabsContent value="traditional" className="space-y-4">
                  {records
                    .filter(record => record.source === 'traditional')
                    .map((record) => (
                      <RecordCard key={record.id} record={record} />
                    ))}
                </TabsContent>

                <TabsContent value="web3" className="space-y-4">
                  {records
                    .filter(record => record.source === 'web3')
                    .map((record) => (
                      <RecordCard key={record.id} record={record} />
                    ))}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Record Card Component
function RecordCard({ record }: { record: PatientRecord }) {
  const isWeb3 = record.source === 'web3';
  
  return (
    <Card className={`border-l-4 ${isWeb3 ? 'border-l-purple-500' : 'border-l-blue-500'} shadow-md hover:shadow-lg transition-shadow duration-200 bg-white/90 backdrop-blur-sm`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h4 className="text-lg font-bold text-slate-900">
                {record.visitType || 'Medical Visit'}
              </h4>
              <Badge 
                variant={isWeb3 ? 'default' : 'secondary'} 
                className={`${isWeb3 ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-blue-100 text-blue-800 border-blue-200'}`}
              >
                {isWeb3 ? (
                  <>
                    <Globe className="h-3 w-3 mr-1" />
                    Web3 Encrypted
                  </>
                ) : (
                  <>
                    <Database className="h-3 w-3 mr-1" />
                    Traditional
                  </>
                )}
              </Badge>
            </div>
            <div className="flex items-center space-x-4 text-sm text-slate-600">
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>{new Date(record.visitDate).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Stethoscope className="h-3 w-3" />
                <span>{record.department || 'General'}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Diagnosis</p>
              <p className="text-sm font-medium text-slate-900 bg-slate-50 px-3 py-2 rounded-lg">
                {record.diagnosis}
              </p>
            </div>
            {record.prescription && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Prescription</p>
                <p className="text-sm font-medium text-slate-900 bg-slate-50 px-3 py-2 rounded-lg">
                  {record.prescription}
                </p>
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            {record.physician && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Attending Physician</p>
                <p className="text-sm font-medium text-slate-900 bg-slate-50 px-3 py-2 rounded-lg">
                  {record.physician}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Record Submitted</p>
              <p className="text-sm font-medium text-slate-900 bg-slate-50 px-3 py-2 rounded-lg">
                {new Date(record.submittedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 