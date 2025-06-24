import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWeb3 } from "@/hooks/use-web3";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  nationalId: string;
  recordCount: number;
  records: PatientRecord[];
}

interface HospitalBInterfaceProps {
  onShowConsentModal: (data: PatientData) => void;
}

export default function HospitalBInterface({ onShowConsentModal }: HospitalBInterfaceProps) {
  const { toast } = useToast();
  const { requestRecordAccess } = useWeb3();
  const [searchData, setSearchData] = useState<SearchFormData>({
    nationalId: "",
    dateFrom: "",
    dateTo: "",
  });
  
  const [web3SearchData, setWeb3SearchData] = useState({
    patientDID: "",
    requesterDID: "",
  });
  
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [web3PatientData, setWeb3PatientData] = useState<any>(null);
  const [showRecords, setShowRecords] = useState(false);
  const [showWeb3Records, setShowWeb3Records] = useState(false);

  const searchMutation = useMutation({
    mutationFn: async (data: { nationalId: string }) => {
      const response = await apiRequest("POST", "/api/get_records", data);
      return await response.json();
    },
    onSuccess: (data: PatientData) => {
      setPatientData(data);
      onShowConsentModal(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const web3SearchMutation = useMutation({
    mutationFn: async (patientDID: string) => {
      return await requestRecordAccess(patientDID);
    },
    onSuccess: (data) => {
      setWeb3PatientData(data);
      toast({
        title: "Web3 Records Found",
        description: `Found ${data.recordCount} records for patient DID`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Web3 Search Failed",
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
    if (!web3SearchData.patientDID.trim()) {
      toast({
        title: "Search Error",
        description: "Please enter a patient DID",
        variant: "destructive",
      });
      return;
    }
    web3SearchMutation.mutate(web3SearchData.patientDID);
  };

  const handleConsentGranted = (records: PatientRecord[]) => {
    setShowRecords(true);
    if (patientData) {
      setPatientData({ ...patientData, records });
    }
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
        <p className="text-slate-600">Search and retrieve patient records from the MediBridge interoperability system</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Search Interface */}
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
              
              {/* Quick Stats */}
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
        
        {/* Results Dashboard */}
        <div className="lg:col-span-2">
          {/* Search Results Header */}
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
          
          {/* Patient Information Card */}
          {patientData && showRecords && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900">{patientData.patientName}</h4>
                    <p className="text-slate-600">ID: {patientData.nationalId}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                    <Users className="h-3 w-3 mr-1" />
                    Consent Verified
                  </Badge>
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
          
          {/* Records List */}
          <div className="space-y-4">
            {patientData && showRecords && patientData.records.map((record) => (
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
            
            {/* Empty State */}
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
        </TabsContent>

        <TabsContent value="web3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Web3 Search Interface */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Key className="h-5 w-5 text-purple-600" />
                    <span>Web3 DID Search</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleWeb3Search} className="space-y-4">
                    <div>
                      <Label htmlFor="patientDID">Patient DID *</Label>
                      <Input
                        id="patientDID"
                        value={web3SearchData.patientDID}
                        onChange={(e) => setWeb3SearchData({ ...web3SearchData, patientDID: e.target.value })}
                        placeholder="did:key:z..."
                        required
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Patient's decentralized identifier
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="requesterDID">Your Hospital DID</Label>
                      <Input
                        id="requesterDID"
                        value={web3SearchData.requesterDID}
                        onChange={(e) => setWeb3SearchData({ ...web3SearchData, requesterDID: e.target.value })}
                        placeholder="did:ethr:0x..."
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Your hospital's DID for access request
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
                  
                  {/* Web3 Features */}
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
            
            {/* Web3 Results Dashboard */}
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
              
              {web3PatientData ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-lg font-semibold text-slate-900">Patient DID Found</h4>
                          <p className="text-slate-600 font-mono text-sm">{web3PatientData.patientDID}</p>
                          {web3PatientData.patientIdentity?.walletAddress && (
                            <p className="text-slate-500 text-xs">
                              Wallet: {web3PatientData.patientIdentity.walletAddress}
                            </p>
                          )}
                        </div>
                        <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
                          <Key className="h-3 w-3 mr-1" />
                          Web3 Identity
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500">Total Records</p>
                          <p className="font-semibold text-slate-900">{web3PatientData.recordCount}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Storage</p>
                          <p className="font-semibold text-slate-900">IPFS Decentralized</p>
                        </div>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <Shield className="h-4 w-4 text-amber-600" />
                          <p className="text-sm font-medium text-amber-800">Patient Consent Required</p>
                        </div>
                        <p className="text-sm text-amber-700">
                          {web3PatientData.message} Patient must grant verifiable credential consent to access their encrypted medical records.
                        </p>
                      </div>

                      {web3PatientData.recordMetadata && (
                        <div>
                          <h5 className="font-medium text-slate-900 mb-2">Available Record Metadata</h5>
                          <div className="space-y-2">
                            {web3PatientData.recordMetadata.map((record: any, index: number) => (
                              <div key={index} className="bg-slate-50 rounded p-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">IPFS Hash:</span>
                                  <code className="text-xs bg-white px-2 py-1 rounded">
                                    {record.contentHash.substring(0, 20)}...
                                  </code>
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-xs text-slate-600">Type: {record.contentType}</span>
                                  <span className="text-xs text-slate-600">Size: {record.size} bytes</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-12 pb-12 text-center">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Globe className="h-6 w-6 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No Web3 Records Found</h3>
                    <p className="text-slate-600 mb-4">Enter a patient DID to search for decentralized medical records</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        {/* Search Interface */}
        <div className="lg:col-span-1">
          {/* Empty space for layout consistency */}
        </div>
        
        {/* Results Dashboard */}
        <div className="lg:col-span-2">
          {/* Traditional records display continues here */}
          {patientData && showRecords && (
            <div className="space-y-4">
              {patientData.records.map((record) => (
                <Card key={record.id}>
                  <CardContent className="pt-6">
                    {/* Existing record display logic */}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
