import { User } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Stethoscope, UserRound, Shield, LogOut, Globe } from "lucide-react";

interface NavigationHeaderProps {
  currentHospital: "A" | "B";
  onHospitalSwitch: (hospital: "A" | "B") => void;
  user: User;
}

export default function NavigationHeader({ currentHospital, onHospitalSwitch, user }: NavigationHeaderProps) {
  const { logoutMutation } = useAuth();

  return (
    <nav className="bg-white shadow-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Stethoscope className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-semibold text-slate-900">MediBridge</h1>
            </div>
            <span className="text-sm text-slate-500">Healthcare Record Interoperability</span>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Hospital Toggle - only show if user can access both */}
            {user.hospitalType === "A" && (
              <div className="flex bg-slate-100 rounded-lg p-1">
                <Button
                  variant={currentHospital === "A" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onHospitalSwitch("A")}
                  className={currentHospital === "A" ? "bg-blue-600 hover:bg-blue-700" : ""}
                >
                  Hospital A
                </Button>
                <Button
                  variant={currentHospital === "B" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onHospitalSwitch("B")}
                  className={currentHospital === "B" ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  Hospital B
                </Button>
              </div>
            )}

            {/* Web3 Patient Dashboard Link */}
            <Link href="/web3-patient">
              <Button variant="outline" size="sm" className="text-purple-600 border-purple-200 hover:bg-purple-50">
                <Globe className="h-4 w-4 mr-2" />
                Web3 Patient
              </Button>
            </Link>
            
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              <UserRound className="h-4 w-4" />
              <span>{user.hospitalName}</span>
              <Shield className="h-4 w-4 text-green-600 ml-2" />
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              className="text-slate-400 hover:text-slate-600"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
