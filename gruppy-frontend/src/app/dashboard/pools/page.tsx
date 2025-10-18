'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// Define the structure of a Pool object from the API
interface Pool {
  id: string;
  title: string;
  description: string | null;
  pricePerUnit: number;
  currentQuantity: number;
  targetQuantity: number;
  deadline: string;
  status: string;
  product: {
    name: string;
  };
}

// Define the API response structure
interface PoolsResponse {
    success: boolean;
    data: Pool[];
}

export default function PoolsPage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPools = async () => {
      try {
        const response = await apiClient.get<PoolsResponse>('/api/pools');
        if (response.data.success) {
          setPools(response.data.data);
        }
      } catch (err) {
        setError('Failed to fetch pools. Please try again later.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPools();
  }, []);

  const getProgress = (current: number, target: number) => {
    if (target === 0) return 0;
    return (current / target) * 100;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Pools Hub</h1>
      <p className="text-slate-600 mb-8">Join a group shipment to save on costs. Here are the currently active pools.</p>

      {isLoading && <p>Loading available pools...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!isLoading && !error && pools.length === 0 && (
        <Card className="text-center p-8">
            <CardTitle>No Active Pools Found</CardTitle>
            <CardDescription className="mt-2">
                There are no active pools available to join at the moment. Check back soon!
            </CardDescription>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pools.map((pool) => (
          <Card key={pool.id} className="flex flex-col animate-in fade-in-0">
            <CardHeader>
              <CardTitle>{pool.title}</CardTitle>
              <CardDescription>Product: {pool.product.name}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
              <div className="flex-grow space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">
                    {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KSH' }).format(pool.pricePerUnit)}
                  </p>
                  <p className="text-xs text-slate-500">per unit</p>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1 text-sm">
                    <span>Progress</span>
                    <span className="font-semibold">{pool.currentQuantity} / {pool.targetQuantity}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2.5">
                    <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${getProgress(pool.currentQuantity, pool.targetQuantity)}%` }}></div>
                  </div>
                </div>
                <p className="text-sm text-slate-500">Deadline: {formatDate(pool.deadline)}</p>
              </div>
              <Button asChild className="mt-6 w-full">
                <Link href={`/dashboard/pools/${pool.id}`}>View & Join Pool</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}