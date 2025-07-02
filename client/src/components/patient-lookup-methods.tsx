import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, CreditCard, QrCode, Key, Info, CheckCircle } from "lucide-react";

interface PatientLookupMethodsProps {
  onSearch: (query: string, type: string) => void;
  isLoading: boolean;
}

export default function PatientLookupMethods({ onSearch, isLoading }: PatientLookupMethodsProps) {
  const [activeMethod, setActiveMethod] = useState<"phone" | "nationalId" | "qr">("phone");
  const [searchQuery, setSearchQuery] = useState("");

  const searchMethods = [
    {
      id: "phone",
      icon: Phone,
      title: "Phone Number",
      subtitle: "Primary Method",
      description: "Ask patient for their registered phone number",
      placeholder: "Enter phone number (e.g., +254700123456)",
      example: "+254700123456 or 0700123456",
      priority: "high",
      usage: "95% of searches - most reliable",
    },
    {
      id: "nationalId",
      icon: CreditCard,
      title: "National ID",
      subtitle: "Traditional Method",
      description: "Search using government-issued ID number",
      placeholder: "Enter national ID number",
      example: "12345678",
      priority: "medium",
      usage: "For patients without mobile registration",
    },
    {
      id: "qr",
      icon: QrCode,
      title: "QR Code Scan",
      subtitle: "Instant Lookup",
      description: "Patient shows QR code from their mobile app",
      placeholder: "Scan QR code or enter QR data",
      example: "Patient-generated QR code",
      priority: "high",
      usage: "Fastest when patient has mobile app",
    },
  ];

  const currentMethod = searchMethods.find(method => method.id === activeMethod);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    onSearch(searchQuery, activeMethod);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "border-green-200 bg-green-50";
      case "medium": return "border-orange-200 bg-orange-50";
      case "low": return "border-blue-200 bg-blue-50";
      default: return "border-gray-200 bg-gray-50";
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high": return <Badge className="bg-green-100 text-green-800">Recommended</Badge>;
      case "medium": return <Badge variant="secondary">Standard</Badge>;
      case "low": return <Badge variant="outline">Advanced</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Method Selection */}
      <div className="grid grid-cols-3 gap-3">
        {searchMethods.map((method) => {
          const Icon = method.icon;
          const isActive = activeMethod === method.id;
          
          return (
            <Card 
              key={method.id}
              className={`cursor-pointer transition-all ${
                isActive 
                  ? "ring-2 ring-blue-500 border-blue-500" 
                  : "hover:border-gray-300"
              } ${getPriorityColor(method.priority)}`}
              onClick={() => {
                setActiveMethod(method.id as any);
                setSearchQuery("");
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <Icon className={`h-5 w-5 mt-1 ${
                    isActive ? "text-blue-600" : "text-gray-600"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-sm">{method.title}</h3>
                      {getPriorityBadge(method.priority)}
                    </div>
                    <p className="text-xs text-gray-600">{method.subtitle}</p>
                    <p className="text-xs text-gray-500 mt-1">{method.usage}</p>
                  </div>
                </div>
                {isActive && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <CheckCircle className="h-4 w-4 text-green-600 inline mr-2" />
                    <span className="text-xs text-green-700">Active method</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Current Method Details */}
      {currentMethod && (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">{currentMethod.title} Search</p>
              <p className="text-sm">{currentMethod.description}</p>
              <p className="text-xs text-gray-600">
                <strong>Example:</strong> {currentMethod.example}
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Search Input */}
      <div className="space-y-3">
        <Label htmlFor="search-input">
          <div className="flex items-center space-x-2">
            {currentMethod && <currentMethod.icon className="h-4 w-4" />}
            <span>{currentMethod?.title} Search</span>
          </div>
        </Label>
        <Input
          id="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={currentMethod?.placeholder}
          className="w-full"
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        
        <Button 
          onClick={handleSearch} 
          disabled={isLoading || !searchQuery.trim()}
          className="w-full"
        >
          {isLoading ? (
            <>
              {currentMethod && <currentMethod.icon className="h-4 w-4 mr-2 animate-spin" />}
              Searching...
            </>
          ) : (
            <>
              {currentMethod && <currentMethod.icon className="h-4 w-4 mr-2" />}
              Search Patient
            </>
          )}
        </Button>
      </div>

      {/* Usage Instructions */}
      <Card className="bg-slate-50">
        <CardHeader>
          <CardTitle className="text-lg">How Patient Lookup Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-2">
            <div className="flex items-start space-x-2">
              <Phone className="h-4 w-4 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">Phone Number (Recommended)</p>
                <p className="text-gray-600">Patient provides phone number used during registration. System automatically finds their Web3 identity.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-2">
              <QrCode className="h-4 w-4 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium">QR Code (Fastest)</p>
                <p className="text-gray-600">Patient shows QR code from mobile app. Contains encrypted lookup data for instant access.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-2">
              <CreditCard className="h-4 w-4 text-orange-600 mt-0.5" />
              <div>
                <p className="font-medium">National ID (Traditional)</p>
                <p className="text-gray-600">Traditional search for patients who haven't registered via mobile yet.</p>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-800 mb-1">How it works behind the scenes:</p>
              <p className="text-xs text-blue-700">
                When you search by phone number, the system automatically finds the patient's Web3 identity and encrypted records. 
                Patients never need to know about DIDs or blockchain - it's all handled automatically.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}