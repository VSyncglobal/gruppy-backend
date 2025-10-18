import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-slate-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          Welcome to Gruppy Frontend
        </h1>
        <p className="mt-6 text-lg leading-8 text-slate-600">
          The frontend application is running. Ready to connect to the backend.
        </p>
        <div className="mt-10">
          <Button asChild>
            <Link href="/login">Go to Login Page</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}