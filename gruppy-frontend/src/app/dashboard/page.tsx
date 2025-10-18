'use client';

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";

// This is a client component because it uses hooks (usePathname, useAuthStore)
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { clearTokens } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    // In a real app, you would also call the backend's /auth/logout endpoint
    clearTokens();
    router.push('/login');
  };

  const navItems = [
    { href: '/dashboard', label: 'Overview' },
    { href: '/dashboard/calculator', label: 'Pricing Calculator' },
    { href: '/dashboard/pools', label: 'Pools Hub' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar Navigation */}
      <nav className="w-64 flex-shrink-0 border-r border-slate-200 bg-white">
        <div className="p-4 border-b">
          <h1 className="text-2xl font-bold text-blue-600">Gruppy</h1>
        </div>
        <div className="p-4">
          <ul>
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block px-4 py-2 rounded-md font-medium transition-colors ${
                    pathname === item.href
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-4 mt-auto border-t">
            <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-red-500 hover:bg-red-50 hover:text-red-600">
                Log Out
            </Button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}