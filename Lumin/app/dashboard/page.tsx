import AuthCheck from "@/components/auth/auth-check"
import LuminariasMonitoring from "@/components/luminarias-monitoring"

export default function DashboardPage() {
  return (
    <AuthCheck>
      <LuminariasMonitoring />
    </AuthCheck>
  )
}
