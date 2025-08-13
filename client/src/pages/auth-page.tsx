import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Stethoscope, Shield, Users, Lock } from "lucide-react";
import { Link } from "wouter";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [registerData, setRegisterData] = useState({ 
    username: "", 
    password: "", 
    hospitalName: "", 
    hospitalType: "",
    // Placeholder; backend assigns real hospital_id on registration
    hospital_id: 0
  });

  // Redirect if already logged in
  if (user) {
    setTimeout(() => setLocation("/"), 0);
    return null;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginData);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate(registerData);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Left side - Authentication forms */}
      <div className="w-full md:flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-6 sm:mb-8">
            <div className="flex items-center justify-center space-x-2 mb-3 sm:mb-4">
              <Stethoscope className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">MediBridge</h1>
            </div>
            <p className="text-slate-600 text-sm sm:text-base">Healthcare Record Interoperability System</p>
            <div className="mt-3 sm:mt-4 p-3 bg-purple-50 rounded-lg">
              <p className="text-xs sm:text-sm text-purple-800">
                <strong>Looking for patient access?</strong>{" "}
                <Link href="/patient-portal" className="underline hover:text-purple-600">
                  Visit the Patient Portal →
                </Link>
              </p>
            </div>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-lg">
              <TabsTrigger value="login" className="text-sm sm:text-base">Login</TabsTrigger>
              <TabsTrigger value="register" className="text-sm sm:text-base">Register</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg sm:text-xl">Login to MediBridge</CardTitle>
                  <CardDescription className="text-sm">
                    Access your hospital's record management system
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <Label htmlFor="login-username">Username</Label>
                      <Input
                        id="login-username"
                        type="text"
                        value={loginData.username}
                        onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                        placeholder="Enter your username"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="login-password">Password</Label>
                      <Input
                        id="login-password"
                        type="password"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        placeholder="Enter your password"
                        required
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg sm:text-xl">Register Hospital</CardTitle>
                  <CardDescription className="text-sm">
                    Create a new hospital account for MediBridge
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <Label htmlFor="register-username">Username</Label>
                      <Input
                        id="register-username"
                        type="text"
                        value={registerData.username}
                        onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                        placeholder="Enter username"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="register-password">Password</Label>
                      <Input
                        id="register-password"
                        type="password"
                        value={registerData.password}
                        onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                        placeholder="Enter password"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="register-hospital">Hospital Name</Label>
                      <Input
                        id="register-hospital"
                        type="text"
                        value={registerData.hospitalName}
                        onChange={(e) => setRegisterData({ ...registerData, hospitalName: e.target.value })}
                        placeholder="Enter hospital name"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="register-type">Hospital Type</Label>
                      <Select 
                        value={registerData.hospitalType} 
                        onValueChange={(value) => setRegisterData({ ...registerData, hospitalType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select hospital type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">Hospital A (Record Submission)</SelectItem>
                          <SelectItem value="B">Hospital B (Record Retrieval)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? "Creating Account..." : "Create Account"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Mobile feature card (compact) */}
      <div className="block md:hidden px-4 pb-6">
        <div className="bg-blue-600 text-white rounded-xl p-5">
          <div className="text-center mb-4">
            <Shield className="h-10 w-10 mx-auto mb-2 opacity-90" />
            <h2 className="text-xl font-semibold">Secure & Simple</h2>
            <p className="text-blue-100 text-sm mt-1">Built for hospitals and clinics</p>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center space-x-3">
              <Lock className="h-4 w-4" />
              <span>JWT-based secure authentication</span>
            </div>
            <div className="flex items-center space-x-3">
              <Users className="h-4 w-4" />
              <span>Patient consent management</span>
            </div>
            <div className="flex items-center space-x-3">
              <Stethoscope className="h-4 w-4" />
              <span>Healthcare record sharing</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Hero section (desktop/tablet) */}
      <div className="hidden md:flex md:flex-1 bg-blue-600 text-white p-8 items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mb-8">
            <Shield className="h-16 w-16 mx-auto mb-4 opacity-90" />
            <h2 className="text-3xl font-bold mb-4">Secure Healthcare Interoperability</h2>
            <p className="text-blue-100 mb-6">
              Connect hospitals seamlessly while maintaining patient privacy and data security through our advanced interoperability platform.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-3 text-blue-100">
              <Lock className="h-5 w-5" />
              <span>JWT-based secure authentication</span>
            </div>
            <div className="flex items-center space-x-3 text-blue-100">
              <Users className="h-5 w-5" />
              <span>Patient consent management</span>
            </div>
            <div className="flex items-center space-x-3 text-blue-100">
              <Stethoscope className="h-5 w-5" />
              <span>Healthcare record sharing</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
