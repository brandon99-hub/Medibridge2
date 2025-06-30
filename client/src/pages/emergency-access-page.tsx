import EmergencyConsentForm from "@/components/emergency-consent-form";
import NavigationHeader from "@/components/navigation-header"; // Optional: if standard header is desired
import { useAuth } from "@/hooks/use-auth"; // To pass user to header if used

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
        <EmergencyConsentForm />
      </div>
    </div>
  );
}
