import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWeb3 } from "@/hooks/use-web3";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileText, Clock, Users, Stethoscope, AlertTriangle, Globe, Key, Shield } from "lucide-react";

interface SearchFormData {
  nationalId: string;
  dateFrom: string;
  dateTo: string;
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
}

interface PatientData {
  patientName: string;
  patientDID: string;
  nationalId?: string;
  recordCount: number;
  records: PatientRecord[];
  hasConsent: boolean;
  requiresConsent?: boolean;
  consentMessage?: string;
}

interface HospitalBInterfaceProps {
  onShowConsentModal: (data: PatientData) => void;
}

export default function HospitalBInterface({ onShowConsentModal }: HospitalBInterfaceProps) {
  const { toast } = useToast();
  const { requestRecordAccess } = useWeb3();
  const { user } = useAuth();
  const [searchData, setSearchData] = useState<SearchFormData>({
    nationalId: "",
    dateFrom: "",
    dateTo: "",
  });
  
  const [web3SearchData, setWeb3SearchData] = useState({
    phoneNumber: "",
  });
  
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [web3PatientData, setWeb3PatientData] = useState<any>(null);
  const [showRecords, setShowRecords] = useState(false);
  const [showWeb3Records, setShowWeb3Records] = useState(false);
  const [authenticatedPatient, setAuthenticatedPatient] = useState<any>(null);
  const [web3ConsentData, setWeb3ConsentData] = useState<any>(null);

  const searchMutation = useMutation({
    mutationFn: async (data: { nationalId: string }) => {
      const response = await apiRequest("POST", "/api/get_records", data);
      return await response.json();
    },
    onSuccess: (data: PatientData) => {
      setPatientData(data);
      if (!data.hasConsent) {
        onShowConsentModal(data);
      } else {
        setShowRecords(true);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const requestConsentMutation = useMutation({
    mutationFn: async (data: { nationalId: string; reason?: string }) => {
      const response = await apiRequest("POST", "/api/request-consent", data);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Consent Requested",
        description: "Patient consent request has been submitted",
      });
      if (patientData) {
        onShowConsentModal(patientData);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Request Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const revokeConsentMutation = useMutation({
    mutationFn: async (data: { nationalId: string }) => {
      const response = await apiRequest("POST", "/api/revoke-consent", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Consent Revoked",
        description: "Access to patient records has been revoked",
      });
      setShowRecords(false);
      setPatientData(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Revocation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Web3 consent issuance mutation
  const issueWeb3ConsentMutation = useMutation({
    mutationFn: async () => {
      if (!authenticatedPatient || !patientData) {
        throw new Error("Patient not authenticated or no records found");
      }
      
      const response = await apiRequest("POST", "/api/issue-consent/", {
        patientId: authenticatedPatient.phoneNumber,
        hospitalId: user?.hospital_id || 2, // fallback to 2 if not available
        recordId: patientData.records[0]?.id,
        validForHours: 24,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setWeb3ConsentData(data);
      toast({
        title: "Verifiable Credential Issued",
        description: "Patient has granted cryptographic consent via Web3",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Consent Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Access record with verifiable credential
  const accessRecordMutation = useMutation({
    mutationFn: async () => {
      if (!web3ConsentData?.verifiableCredential) {
        throw new Error("No verifiable credential available");
      }
      
      const response = await apiRequest("POST", "/api/get-record/", {
        verifiableCredential: web3ConsentData.verifiableCredential,
        hospitalDID: "did:medbridge:hospital:brandon",
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Web3 Record Access Successful",
        description: "Medical record retrieved using verifiable credential",
      });
      console.log("Decrypted Web3 record:", data.record);
    },
    onError: (error: Error) => {
      toast({
        title: "Web3 Access Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const web3SearchMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const response = await apiRequest("POST", "/api/patient-lookup/phone", {
        phoneNumber: phoneNumber
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setWeb3PatientData({
        ...data,
        patientDID: data.patientDID,
        recordCount: data.recordsSummary?.totalRecords || 0,
      });
      if (data.found) {
        toast({
          title: "Patient Found",
          description: `Found patient with ${data.recordsSummary?.totalRecords || 0} records`,
        });
      } else {
        toast({
          title: "No Patient Found",
          description: data.message || "No patient found with this phone number",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch full Web3 records after consent
  const fetchWeb3RecordsMutation = useMutation({
    mutationFn: async (patientDID: string) => {
      try {
        const response = await apiRequest("POST", "/api/web3/get-records", {
          patientDID: patientDID
        });
        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 403 && errorData.requiresConsent) {
            return {
              patientDID,
              recordCount: errorData.recordCount || 0,
              hasConsent: false,
              records: [],
              requiresConsent: true,
              message: errorData.message || "Patient consent required to access Web3 records."
            };
          }
          throw new Error(errorData.message || "Failed to fetch Web3 records");
        }
        return await response.json();
      } catch (error: any) {
        throw new Error(error.message || "Failed to fetch Web3 records");
      }
    },
    onSuccess: (data) => {
      setWeb3PatientData((prev: any) => ({
        ...prev,
        fullRecords: data.records || [],
        hasFullRecords: true,
        hasConsent: data.hasConsent,
        recordCount: data.recordCount,
        requiresConsent: data.requiresConsent || false,
        consentMessage: data.message || undefined
      }));
      setShowWeb3Records(true);
      if (data.hasConsent) {
        toast({
          title: "Web3 Records Retrieved",
          description: `Successfully retrieved ${data.recordCount} medical records`,
        });
      } else if (data.requiresConsent) {
        toast({
          title: "Consent Required",
          description: data.message || "Patient consent required to access Web3 records.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Retrieve Records",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchData.nationalId.trim()) {
      toast({
        title: "Search Error",
        description: "Please enter a patient ID",
        variant: "destructive",
      });
      return;
    }
    searchMutation.mutate({ nationalId: searchData.nationalId });
  };

  const handleWeb3Search = (e: React.FormEvent) => {
    e.preventDefault();
    if (!web3SearchData.phoneNumber.trim()) {
      toast({
        title: "Search Error",
        description: "Please enter a patient phone number",
        variant: "destructive",
      });
      return;
    }
    web3SearchMutation.mutate(web3SearchData.phoneNumber);
  };

  const handleConsentGranted = (records: PatientRecord[]) => {
    setShowRecords(true);
    if (patientData) {
      setPatientData({ ...patientData, records });
    }
  };

  // When showing the consent modal for Web3, use backend values only
  const handleShowWeb3ConsentModal = () => {
    if (!web3PatientData) return;
    // Always use the actual National ID, not DID
    const nationalId = web3PatientData.patientInfo?.nationalId || web3PatientData.fullRecords?.[0]?.nationalId;
    if (!nationalId) {
      toast({
        title: "Consent Request Failed",
        description: "Could not determine patient's National ID.",
        variant: "destructive",
      });
      return;
    }
    // Create a pending consent request for the Web3 patient
    requestConsentMutation.mutate({ 
      nationalId,
      reason: "Web3 medical record access request"
    });
    // Also show the consent modal
    onShowConsentModal({
      patientName: web3PatientData.patientInfo?.name || 'Patient',
      patientDID: web3PatientData.patientDID || '',
      recordCount: web3PatientData.recordCount || 0,
      records: web3PatientData.fullRecords || [],
      hasConsent: !!web3PatientData.hasConsent,
      requiresConsent: !!web3PatientData.requiresConsent,
      consentMessage: web3PatientData.consentMessage || undefined
    });
  };

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-sm">B</span>
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">Hospital B - Record Retrieval</h2>
        </div>
        <p className="text-slate-600">Search and retrieve patient records using traditional ID or patient phone number</p>
      </div>

      <Tabs defaultValue="traditional" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="traditional" className="flex items-center space-x-2">
            <Search className="h-4 w-4" />
            <span>Traditional Search</span>
          </TabsTrigger>
          <TabsTrigger value="web3" className="flex items-center space-x-2">
            <Globe className="h-4 w-4" />
            <span>Web3 DID Search</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="traditional">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Search className="h-5 w-5 text-green-600" />
                    <span>Patient Search</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSearch} className="space-y-4">
                    <div>
                      <Label htmlFor="nationalId">NHIF/National ID *</Label>
                      <Input
                        id="nationalId"
                        value={searchData.nationalId}
                        onChange={(e) => setSearchData({ ...searchData, nationalId: e.target.value })}
                        placeholder="Enter patient ID"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label>Date Range (Optional)</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="date"
                          value={searchData.dateFrom}
                          onChange={(e) => setSearchData({ ...searchData, dateFrom: e.target.value })}
                        />
                        <Input
                          type="date"
                          value={searchData.dateTo}
                          onChange={(e) => setSearchData({ ...searchData, dateTo: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full bg-green-600 hover:bg-green-700"
                      disabled={searchMutation.isPending}
                    >
                      <Search className="h-4 w-4 mr-2" />
                      {searchMutation.isPending ? "Searching..." : "Search Records"}
                    </Button>
                  </form>
                  
                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">Today's Activity</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 bg-slate-50 rounded-lg">
                        <div className="text-lg font-semibold text-slate-900">0</div>
                        <div className="text-xs text-slate-600">Searches</div>
                      </div>
                      <div className="text-center p-3 bg-slate-50 rounded-lg">
                        <div className="text-lg font-semibold text-slate-900">0</div>
                        <div className="text-xs text-slate-600">Retrieved</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="lg:col-span-2">
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-5 w-5 text-green-600" />
                      <h3 className="text-lg font-semibold text-slate-900">Patient Records</h3>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-slate-600">
                      <Clock className="h-4 w-4" />
                      <span>Last updated: Just now</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {patientData && showRecords && (
                <Card className="mb-6">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-slate-900">{patientData.patientName}</h4>
                        <p className="text-slate-600">ID: {patientData.patientDID}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          <Users className="h-3 w-3 mr-1" />
                          Consent Verified
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => revokeConsentMutation.mutate({ nationalId: patientData.nationalId || patientData.patientDID })}
                          disabled={revokeConsentMutation.isPending}
                        >
                          {revokeConsentMutation.isPending ? "Revoking..." : "Revoke Access"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => searchMutation.mutate({ nationalId: patientData.nationalId || patientData.patientDID })}
                          disabled={searchMutation.isPending}
                        >
                          {searchMutation.isPending ? "Fetching..." : "Fetch All Records"}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Total Records</p>
                        <p className="font-semibold text-slate-900">{patientData.recordCount}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Date Range</p>
                        <p className="font-semibold text-slate-900">
                          {patientData.records.length > 0 ? 
                            `${patientData.records[0].visitDate} - ${patientData.records[patientData.records.length - 1].visitDate}` : 
                            "N/A"
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Last Visit</p>
                        <p className="font-semibold text-slate-900">
                          {patientData.records.length > 0 ? patientData.records[patientData.records.length - 1].visitDate : "N/A"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {patientData && !showRecords && (
                <Card className="mb-6">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-slate-900">Patient Found</h4>
                        <p className="text-slate-600">ID: {patientData.patientDID}</p>
                        <p className="text-slate-600">{patientData.recordCount} medical records available</p>
                      </div>
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                        <Shield className="h-3 w-3 mr-1" />
                        Consent Required
                      </Badge>
                    </div>
                    
                    <div className="bg-amber-50 rounded-lg p-4 mb-4">
                      <div className="flex items-start space-x-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div>
                          <h5 className="font-medium text-amber-900">Patient Consent Required</h5>
                          <p className="text-sm text-amber-700 mt-1">
                            To access this patient's medical records, you must obtain proper consent. 
                            This ensures patient privacy and compliance with healthcare regulations.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      <Button 
                        onClick={() => requestConsentMutation.mutate({ 
                          nationalId: patientData.nationalId || patientData.patientDID,
                          reason: "Medical care coordination and treatment planning"
                        })}
                        className="bg-blue-600 hover:bg-blue-700"
                        disabled={requestConsentMutation.isPending}
                      >
                        {requestConsentMutation.isPending ? "Requesting..." : "Request Consent"}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setPatientData(null);
                          setShowRecords(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-4">
                {patientData && showRecords && patientData.records
                  .filter(record => record.recordType === "traditional")
                  .map((record) => (
                    <Card key={record.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                              {record.visitType === "emergency" ? (
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                              ) : (
                                <Stethoscope className="h-5 w-5 text-blue-600" />
                              )}
                            </div>
                            <div>
                              <h5 className="font-semibold text-slate-900">{record.visitType || "Medical Visit"}</h5>
                              <p className="text-sm text-slate-600">{record.visitDate}</p>
                              <p className="text-sm text-slate-500">
                                Hospital A - {record.physician || "Unknown Physician"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {record.department && (
                              <Badge variant="secondary">{record.department}</Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <h6 className="text-sm font-medium text-slate-700 mb-1">Diagnosis</h6>
                            <p className="text-sm text-slate-600">{record.diagnosis}</p>
                          </div>
                          
                          {record.prescription && (
                            <div>
                              <h6 className="text-sm font-medium text-slate-700 mb-1">Prescription & Treatment</h6>
                              <p className="text-sm text-slate-600">{record.prescription}</p>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                          <div className="flex items-center space-x-4 text-xs text-slate-500">
                            <span>Record ID: REC-{record.id}</span>
                            <span>•</span>
                            <span>Submitted: {new Date(record.submittedAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                
                {!patientData && (
                  <Card>
                    <CardContent className="pt-12 pb-12 text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Search className="h-6 w-6 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-900 mb-2">No Records Found</h3>
                      <p className="text-slate-600 mb-4">Enter a patient ID to search for medical records</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="web3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Key className="h-5 w-5 text-purple-600" />
                    <span>Web3 Phone Search</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleWeb3Search} className="space-y-4">
                    <div>
                      <Label htmlFor="phoneNumber">Patient Phone Number *</Label>
                      <Input
                        id="phoneNumber"
                        value={web3SearchData.phoneNumber}
                        onChange={(e) => setWeb3SearchData({ ...web3SearchData, phoneNumber: e.target.value })}
                        placeholder="+254 700 123 456"
                        required
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Patient provides phone number for secure lookup
                      </p>
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      disabled={web3SearchMutation.isPending}
                    >
                      <Globe className="h-4 w-4 mr-2" />
                      {web3SearchMutation.isPending ? "Searching IPFS..." : "Search Web3 Records"}
                    </Button>
                  </form>
                  
                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">Web3 Features</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-xs text-slate-600">
                        <Shield className="h-3 w-3 text-purple-600" />
                        <span>Verifiable Credentials</span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-slate-600">
                        <Globe className="h-3 w-3 text-green-600" />
                        <span>IPFS Decentralized Storage</span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-slate-600">
                        <Key className="h-3 w-3 text-blue-600" />
                        <span>Patient-Controlled Access</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="lg:col-span-2">
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Globe className="h-5 w-5 text-purple-600" />
                      <h3 className="text-lg font-semibold text-slate-900">Web3 Patient Records</h3>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-slate-600">
                      <Clock className="h-4 w-4" />
                      <span>Decentralized Access</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {web3PatientData && web3PatientData.found && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-slate-900">{web3PatientData.patientInfo?.name || 'Patient'}</h4>
                        <p className="text-slate-600">Phone: {web3PatientData.patientInfo?.phoneNumber}</p>
                        <p className="text-slate-600 text-xs">DID: {web3PatientData.patientDID}</p>
                      </div>
                      <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
                        <Globe className="h-3 w-3 mr-1" />
                        Web3 Verified
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-6">
                      <div>
                        <p className="text-slate-500">Total Records</p>
                        <p className="font-semibold text-slate-900">{web3PatientData.recordsSummary?.totalRecords || 0}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Encrypted on IPFS</p>
                        <p className="font-semibold text-slate-900">Yes</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Search Method</p>
                        <p className="font-semibold text-slate-900 capitalize">{web3PatientData.searchMethod}</p>
                      </div>
                    </div>

                    <div className="bg-amber-50 rounded-lg p-4 mb-4">
                      <div className="flex items-start space-x-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div>
                          <h5 className="font-medium text-amber-900">Patient Consent Required</h5>
                          <p className="text-sm text-amber-700 mt-1">
                            This patient's records are encrypted and stored on IPFS. Patient must provide consent via phone authentication to access the data.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      <Button 
                        onClick={handleShowWeb3ConsentModal}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Request Patient Consent
                      </Button>
                      
                      {web3PatientData.patientDID && (
                        <Button 
                          onClick={() => fetchWeb3RecordsMutation.mutate(web3PatientData.patientDID)}
                          disabled={fetchWeb3RecordsMutation.isPending}
                          variant="outline"
                          className="border-purple-200 text-purple-700 hover:bg-purple-50"
                        >
                          <Globe className="h-4 w-4 mr-2" />
                          {fetchWeb3RecordsMutation.isPending ? "Fetching..." : "Fetch Full Records"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {web3PatientData && !web3PatientData.found && (
                <Card>
                  <CardContent className="pt-12 pb-12 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="h-6 w-6 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No Web3 Patient Found</h3>
                    <p className="text-slate-600 mb-4">{web3PatientData.message || 'No patient found with this phone number'}</p>
                    <p className="text-xs text-slate-500">Patient may not have registered for Web3 healthcare identity</p>
                  </CardContent>
                </Card>
              )}

              {!web3PatientData && (
                <Card>
                  <CardContent className="pt-12 pb-12 text-center">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Globe className="h-6 w-6 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No Web3 Records Found</h3>
                    <p className="text-slate-600 mb-4">Enter a patient phone number to search for decentralized medical records</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Display Web3 Records */}
      {showWeb3Records && web3PatientData && (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="h-5 w-5 text-purple-600" />
                <span>Web3 Medical Records</span>
              </CardTitle>
              <CardDescription>
                Decentralized medical records retrieved from IPFS
              </CardDescription>
            </CardHeader>
            <CardContent>
              {web3PatientData.hasConsent ? (
                <div className="space-y-4">
                  {web3PatientData.fullRecords && web3PatientData.fullRecords.length > 0 ? (
                    web3PatientData.fullRecords
                      .filter(record => record.recordType === "web3")
                      .map((record: any) => (
                        <div key={record.id} className="border rounded-lg p-4 bg-slate-50">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-slate-900">
                                {record.visitType || 'Medical Visit'}
                              </h4>
                              <p className="text-sm text-slate-600">
                                {new Date(record.visitDate).toLocaleDateString()} • {record.department || 'General'}
                              </p>
                            </div>
                            <Badge className="bg-purple-100 text-purple-800">
                              <Globe className="h-3 w-3 mr-1" />
                              Web3
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-slate-500">Diagnosis</p>
                              <p className="font-medium text-slate-900">{record.diagnosis}</p>
                            </div>
                            {record.prescription && (
                              <div>
                                <p className="text-slate-500">Prescription</p>
                                <p className="font-medium text-slate-900">{record.prescription}</p>
                              </div>
                            )}
                            {record.physician && (
                              <div>
                                <p className="text-slate-500">Physician</p>
                                <p className="font-medium text-slate-900">{record.physician}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-slate-500">IPFS Hash</p>
                              <p className="font-mono text-xs text-slate-600 break-all">{record.ipfsHash}</p>
                            </div>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-center text-slate-500">No medical records found.</div>
                  )}
                </div>
              ) : web3PatientData.requiresConsent ? (
                <div className="text-center text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-6">
                  <AlertTriangle className="h-6 w-6 mb-2 mx-auto text-amber-600" />
                  <div className="font-medium mb-1">Waiting for patient consent approval</div>
                  <div className="text-sm">You will be able to view records once consent is granted.</div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}