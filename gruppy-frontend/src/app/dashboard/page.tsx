'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api';
import { Button } from '@/components/ui/button';

// --- FIX: Define the expected User and API response structures ---
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface UserResponse {
  success: boolean;
  data: User;
}

export default function DashboardPage() {
  const { isAuthenticated, accessToken, clearTokens } = useAuthStore();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    const fetchUser = async () => {
      try {
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        // --- FIX: Tell Axios what response type to expect ---
        const response = await apiClient.get<UserResponse>('/api/user/me');
        if (response.data.success) {
          setUser(response.data.data);
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
        clearTokens();
        router.replace('/login');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [isAuthenticated, accessToken, router, clearTokens]);

  const handleLogout = () => {
    clearTokens();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-lg">Loading Dashboard...</p>
      </div>
    );
  }
  
  if (!user) {
    return (
       <div className="flex h-screen items-center justify-center">
        <p className="text-lg text-red-500">Could not load user data.</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl sm:text-3xl font-bold">Welcome, {user.name}!</h1>
      <p className="mt-2 text-slate-600">You are logged in as a {user.role}.</p>
      
      <div className="mt-6 p-4 border rounded-lg bg-slate-50">
        <h2 className="font-semibold text-slate-800">Your Profile Details:</h2>
        <pre className="mt-2 text-sm bg-slate-100 p-3 rounded-md overflow-x-auto">{JSON.stringify(user, null, 2)}</pre>
      </div>

      <Button onClick={handleLogout} variant="destructive" className="mt-6">
        Log Out
      </Button>
    </div>
  );
}