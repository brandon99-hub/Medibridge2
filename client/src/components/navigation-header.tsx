import { User } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Stethoscope, UserRound, Shield, LogOut, Globe, User as UserIcon, Settings, AlertTriangle as AlertTriangleIcon, ChevronDown } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface NavigationHeaderProps {
  currentHospital: "A" | "B";
  onHospitalSwitch: (hospital: "A" | "B") => void;
  user: User;
}

const dividerVariants = {
  initial: { width: 0, opacity: 0 },
  animate: { width: '2px', opacity: 0.15, transition: { duration: 0.3 } },
  exit: { width: 0, opacity: 0, transition: { duration: 0.2 } },
};

export default function NavigationHeader({ currentHospital, onHospitalSwitch, user }: NavigationHeaderProps) {
  const { logoutMutation } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <nav className="bg-white shadow-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left: Logo & Tagline */}
          <div className="flex items-center space-x-3 min-w-[220px]">
            <Stethoscope className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-semibold text-slate-900 leading-tight">MediBridge</h1>
              <span className="text-xs text-slate-500 block">Healthcare Record Interoperability</span>
            </div>
          </div>

          {/* Center: Hospital Toggle and Patient Portal */}
          <div className="flex items-center space-x-3">
            <div className="relative flex bg-slate-100 rounded-full p-1 w-64 overflow-hidden">
              <motion.div
                key={currentHospital}
                layout
                animate={{
                  x: currentHospital === "A" ? 0 : "100%",
                  background: currentHospital === "A" ? "#2563eb" : "#16a34a",
                }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="absolute top-1 left-1 h-8 w-[calc(50%-0.25rem)] rounded-full z-0"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onHospitalSwitch("A")}
                className={
                  "medibridge-tab relative z-10 w-1/2 transition-colors duration-300 " +
                  (currentHospital === "A"
                    ? "!text-white font-bold"
                    : "text-blue-700 font-medium")
                }
                style={{
                  transition: "color 0.3s, font-weight 0.3s",
                }}
              >
                <motion.span
                  animate={{
                    color: currentHospital === "A" ? "#fff" : "#1d4ed8",
                    opacity: currentHospital === "A" ? 1 : 0.85,
                    scale: currentHospital === "A" ? 1.08 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  style={{ display: "inline-block" }}
                >
                  Hospital A
                </motion.span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onHospitalSwitch("B")}
                className={
                  "medibridge-tab relative z-10 w-1/2 transition-colors duration-300 " +
                  (currentHospital === "B"
                    ? "!text-white font-bold"
                    : "text-green-700 font-medium")
                }
                style={{
                  transition: "color 0.3s, font-weight 0.3s",
                }}
              >
                <motion.span
                  animate={{
                    color: currentHospital === "B" ? "#fff" : "#16a34a",
                    opacity: currentHospital === "B" ? 1 : 0.85,
                    scale: currentHospital === "B" ? 1.08 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  style={{ display: "inline-block" }}
                >
                  Hospital B
                </motion.span>
              </Button>
            </div>
          </div>

          {/* Right: Emergency, Profile Dropdown */}
          <div className="flex items-center space-x-2">
            {/* Emergency Access */}
            {user && (
              <Link href="/emergency-access">
                <Button variant="destructive" size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                  <AlertTriangleIcon className="h-4 w-4 mr-2" />
                  Emergency
                </Button>
              </Link>
            )}
            {/* Profile Dropdown */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center space-x-2 px-2"
                onClick={() => setProfileOpen((v) => !v)}
              >
                <UserRound className="h-5 w-5 text-slate-700" />
                <span className="hidden sm:inline text-sm font-medium text-slate-900">{user.hospitalName || user.username}</span>
                <ChevronDown className="h-4 w-4 text-slate-400 ml-1" />
              </Button>
              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50"
                  >
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-medium text-slate-900">{user.hospitalName || user.username}</p>
                      <p className="text-xs text-slate-600">
                        Hospital {user.hospitalType} • {user.username}
                        {user.hospitalType && (
                          <span className="ml-2">
                            {user.hospitalType === "A" ? "Record Submitter" : "Record Accessor"}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="px-4 py-2 flex items-center space-x-2">
                      <Shield className="h-4 w-4 text-green-600" />
                      <Globe className="h-4 w-4 text-purple-600" />
                    </div>
                    <motion.div
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                      variants={{
                        hidden: { opacity: 0, y: 10 },
                        visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
                      }}
                      className="flex flex-col"
                    >
                      {user.isAdmin && (
                        <motion.div
                          variants={{ hidden: { opacity: 0, x: 20 }, visible: { opacity: 1, x: 0 } }}
                        >
                          <Link href="/admin">
                            <button className="w-full text-left px-4 py-2 text-sm text-orange-700 hover:bg-orange-50 flex items-center">
                              <Settings className="h-4 w-4 mr-2" /> Admin Dashboard
                            </button>
                          </Link>
                        </motion.div>
                      )}
                      <motion.div
                        variants={{ hidden: { opacity: 0, x: 20 }, visible: { opacity: 1, x: 0 } }}
                      >
                        <Link href="/patient-portal">
                          <button className="w-full text-left px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 flex items-center">
                            <UserIcon className="h-4 w-4 mr-2" /> Patient Portal
                          </button>
                        </Link>
                      </motion.div>
                      <motion.div
                        variants={{ hidden: { opacity: 0, x: 20 }, visible: { opacity: 1, x: 0 } }}
                      >
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center"
                          onClick={() => logoutMutation.mutate()}
                        >
                          <LogOut className="h-4 w-4 mr-2" /> Logout
                        </button>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
