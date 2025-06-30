import EmergencyConsentForm from "@/components/emergency-consent-form";
import NavigationHeader from "@/components/navigation-header"; // Optional: if standard header is desired
import { useAuth } from "@/hooks/use-auth"; // To pass user to header if used
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function EmergencyAccessPage() {
  const { user } = useAuth(); // Needed if NavigationHeader is used and expects a user

  // A simple container for the form, could be enhanced with more page-specific layout or info
  return (
    <div className="min-h-screen bg-slate-100">
      {/*
        Optional: Include NavigationHeader if appropriate for this page.
        It might need adjustment if currentHospital/onHospitalSwitch aren't relevant here.
        For simplicity, omitting it if it requires significant prop drilling not related to this form.
        Alternatively, a simpler, specific header for this page could be used.
      */}
      {/* {user && <NavigationHeader currentHospital={"A"} onHospitalSwitch={() => {}} user={user} />} */}

      <div className="py-8 px-4">
        {/* Back Button */}
        <div className="max-w-3xl mx-auto mb-6">
          <Link href="/">
            <Button variant="ghost" className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </Button>
          </Link>
        </div>
        
        <EmergencyConsentForm />
      </div>
    </div>
  );
}
