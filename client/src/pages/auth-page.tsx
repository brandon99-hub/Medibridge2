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

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [registerData, setRegisterData] = useState({ 
    username: "", 
    password: "", 
    hospitalName: "", 
    hospitalType: "" 
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
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left side - Authentication forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Stethoscope className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900">MediBridge</h1>
            </div>
            <p className="text-slate-600">Healthcare Record Interoperability System</p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>Login to MediBridge</CardTitle>
                  <CardDescription>
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
                  <CardTitle>Register Hospital</CardTitle>
                  <CardDescription>
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

      {/* Right side - Hero section */}
      <div className="flex-1 bg-blue-600 text-white p-8 flex items-center justify-center">
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
