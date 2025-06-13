import AuthCheck from "@/components/auth/auth-check"
import AdminPanel from "@/components/admin/admin-panel"

export default function AdminPage() {
  return (
    <AuthCheck adminOnly>
      <AdminPanel />
    </AuthCheck>
  )
}
