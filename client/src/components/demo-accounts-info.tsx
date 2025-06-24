import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Stethoscope, Info } from "lucide-react";

export default function DemoAccountsInfo() {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Info className="h-5 w-5 text-blue-600" />
          <span>Demo Accounts</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Stethoscope className="h-4 w-4 text-blue-600" />
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">Hospital A</Badge>
            </div>
            <div className="text-sm space-y-1">
              <p><strong>Username:</strong> demo-hospital-a</p>
              <p><strong>Password:</strong> demo123</p>
              <p className="text-blue-700">Can submit patient records</p>
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Building2 className="h-4 w-4 text-green-600" />
              <Badge variant="secondary" className="bg-green-100 text-green-800">Hospital B</Badge>
            </div>
            <div className="text-sm space-y-1">
              <p><strong>Username:</strong> demo-hospital-b</p>
              <p><strong>Password:</strong> demo123</p>
              <p className="text-green-700">Can access patient records</p>
            </div>
          </div>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-3">
          <p className="text-sm text-purple-800">
            <strong>New:</strong> Try the Web3 Consent Demo tab to see phone-based patient authentication 
            with automatic DID generation and verifiable credential issuance.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}