import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCsrf } from "@/hooks/use-csrf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  CheckCircle, 
  Mail, 
  User, 
  Lock, 
  Eye, 
  EyeOff,
  Loader2,
  AlertTriangle,
  Building2,
  Calendar,
  Clock
} from "lucide-react";

const STAFF_ROLES = [
  { value: "HOSPITAL_A_ONLY", label: "Hospital A Only (Record Creation)", icon: Building2, color: "bg-blue-100 text-blue-700" },
  { value: "HOSPITAL_B_ONLY", label: "Hospital B Only (Record Access)", icon: Eye, color: "bg-green-100 text-green-700" },
  { value: "BOTH_A_B", label: "Both Hospitals (Full Access)", icon: Building2, color: "bg-purple-100 text-purple-700" },
  { value: "EMERGENCY_AUTHORIZER", label: "Emergency Authorizer", icon: AlertTriangle, color: "bg-red-100 text-red-700" }
];

interface InvitationData {
  email: string;
  role: string;
  department: string;
  hospitalName: string;
  expiresAt: string;
}

export default function AcceptInvitation(): JSX.Element {
  const { toast } = useToast();
  const { apiRequestWithCsrf } = useCsrf();
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const [showPassword, setShowPassword] = useState(false);
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    newPassword: "",
    confirmPassword: ""
  });

  const token = searchParams.get('token');

  // Fetch invitation details
  useEffect(() => {
    if (!token) {
      setError("No invitation token provided");
      setIsLoading(false);
      return;
    }

    const fetchInvitation = async () => {
      try {
        const response = await apiRequest("GET", `/api/staff/invitation/${token}`);
        const data = await response.json();
        
        if (data.success) {
          setInvitationData(data.invitation);
        } else {
          setError(data.error || "Failed to load invitation");
        }
      } catch (error: any) {
        setError(error.message || "Failed to load invitation");
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  // Accept invitation mutation
  const acceptInvitationMutation = useMutation({
    mutationFn: async (data: { invitationToken: string; newPassword: string; name: string }) => {
      console.debug('[CSRF] Using apiRequestWithCsrf for /api/staff/accept-invitation');
      const response = await apiRequestWithCsrf("POST", "/api/staff/accept-invitation", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Account Activated Successfully",
        description: "Your account has been activated. You can now log in with your new credentials.",
      });
      
      // Redirect to login page after a short delay
      setTimeout(() => {
        navigate('/auth');
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Activation Failed",
        description: error.message || "Failed to activate account.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      toast({
        title: "Invalid Invitation",
        description: "No invitation token provided.",
        variant: "destructive",
      });
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    if (formData.newPassword.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    acceptInvitationMutation.mutate({
      invitationToken: token,
      newPassword: formData.newPassword,
      name: formData.name
    });
  };

  const getRoleInfo = (role: string) => {
    return STAFF_ROLES.find(r => r.value === role) || STAFF_ROLES[0];
  };

  const getTimeUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading invitation details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitationData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Invitation</h2>
            <p className="text-gray-600 mb-6">{error || "This invitation is invalid or has expired."}</p>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const timeUntilExpiry = getTimeUntilExpiry(invitationData.expiresAt);
  const isExpired = timeUntilExpiry === "Expired";

  if (isExpired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Clock className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Invitation Expired</h2>
            <p className="text-gray-600 mb-6">
              This invitation has expired. Please contact your hospital administrator for a new invitation.
            </p>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 p-8 text-white relative overflow-hidden rounded-t-lg">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
          
          <div className="relative z-10 text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Welcome to MediBridge</h1>
                <p className="text-blue-100 text-lg mt-2">Activate Your Staff Account</p>
              </div>
            </div>
          </div>
        </div>

        <CardContent className="p-8">
          {/* Invitation Details */}
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{invitationData.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Hospital</p>
                    <p className="font-medium">{invitationData.hospitalName}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Role</p>
                    <Badge className={getRoleInfo(invitationData.role).color}>
                      {getRoleInfo(invitationData.role).label}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Department</p>
                    <p className="font-medium">{invitationData.department}</p>
                  </div>
                </div>
              </div>
            </div>

            <Alert className="mb-6">
              <Clock className="h-4 w-4" />
              <AlertDescription>
                This invitation expires in <strong>{timeUntilExpiry}</strong>. Please complete your account activation now.
              </AlertDescription>
            </Alert>
          </div>

          {/* Activation Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password *</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  placeholder="Create a secure password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-gray-500">Password must be at least 8 characters long</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Confirm your password"
                required
              />
            </div>

            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                By activating your account, you agree to comply with all hospital policies and data protection regulations.
              </AlertDescription>
            </Alert>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              disabled={acceptInvitationMutation.isPending}
            >
              {acceptInvitationMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Activating Account...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Activate Account
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/auth')}>
                Sign in here
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 