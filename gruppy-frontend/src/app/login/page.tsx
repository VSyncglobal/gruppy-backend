'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import apiClient from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// Note: We no longer need to import anything extra from 'axios'
interface LoginResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
  };
}

export default function LoginPage() {
  const [email, setEmail] = useState('consumer@gruppy.co.ke');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const setTokens = useAuthStore((state) => state.setTokens);
  const router = useRouter();

 const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<LoginResponse>('/auth/login', {
        email: email.toLowerCase(),
        password,
      });

      if (response.data.success) {
        setTokens(response.data.data);
        router.push('/dashboard');
      }
    } catch (err) {
      // --- FINAL, ESLINT-COMPLIANT FIX ---
      let errorMessage = 'An unexpected error occurred.';
      // Check if the error is an object with the expected properties
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const response = (err as { response?: { data?: { error?: string } } }).response;
        if (response && response.data && response.data.error) {
          errorMessage = response.data.error;
        }
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // ... JSX is unchanged ...
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <Card className="mx-auto max-w-sm w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>
            Enter your credentials to access your Gruppy account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            {error && (
              <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{' '}
            <a href="/register" className="underline font-medium">
              Sign up
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}