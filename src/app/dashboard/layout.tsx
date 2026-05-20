import { getSession } from "@/app/actions/auth";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { XboxMonitor } from "@/components/xbox/XboxMonitor";
import { ToastProvider } from "@/components/ui/Toast";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <ToastProvider>
      <XboxMonitor />
      <div className="flex h-screen bg-gray-950 overflow-hidden">
        <Sidebar rol={session.rol} />
        <div className="flex flex-col flex-1 min-w-0">
          <Header rol={session.rol} />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
