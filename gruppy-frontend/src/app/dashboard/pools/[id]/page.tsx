'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import apiClient from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from "sonner"; // Ensure this uses 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Define the detailed structure for a single pool
interface PoolDetails {
  id: string;
  title: string;
  description: string | null;
  pricePerUnit: number;
  currentQuantity: number;
  targetQuantity: number;
  deadline: string;
  status: string; // e.g., 'OPEN', 'FILLED'
  product: { name: string; hsCode: string; basePrice: number; };
  members: { quantity: number; user: { name: string; }; }[];
}

// Define the API response structures
interface PoolDetailsResponse { success: boolean; data: PoolDetails; }
interface JoinPoolResponse { success: boolean; message: string; data: { member: { id: string }, updatedPool: PoolDetails }; }
interface InitiatePaymentResponse { success: boolean; message: string; data: { payment: { id: string } }; }
interface ApiErrorResponse { error: string; }

export default function PoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;
  const { toast } = useToast();

  const [pool, setPool] = useState<PoolDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinQuantity, setJoinQuantity] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (typeof id === 'string') {
      const fetchPoolDetails = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await apiClient.get<PoolDetailsResponse>(`/api/pools/${id}`);
          if (response.data.success) {
            setPool(response.data.data);
          } else {
             setError('Could not retrieve pool details.');
          }
        } catch (err) {
          setError('Failed to fetch pool details.');
          console.error("Fetch Pool Error:", err);
        } finally {
          setIsLoading(false);
        }
      };
      fetchPoolDetails();
    }
  }, [id]);

  const handleJoinPool = async () => {
    if (!pool || joinQuantity <= 0) return;
    setIsJoining(true);
    setError(null);

    try {
      const joinResponse = await apiClient.post<JoinPoolResponse>('/api/pools/join', {
        poolId: pool.id,
        quantity: joinQuantity,
      });

      if (!joinResponse.data.success) {
         throw new Error(joinResponse.data.message || "Failed to join pool.");
      }

      toast({ title: "Successfully joined pool!", description: "Initiating payment..." });
      setIsDialogOpen(false);
      const poolMemberId = joinResponse.data.data.member.id;

      const paymentResponse = await apiClient.post<InitiatePaymentResponse>('/api/payments/pools/initiate', {
        poolMemberId: poolMemberId,
        method: "M-PESA",
        phone: "2547XXXXXXXX"
      });

      if (!paymentResponse.data.success) {
          throw new Error(paymentResponse.data.message || "Payment initiation failed.");
      }

      toast({ title: "Payment Initiated!", description: "Check your phone for M-Pesa prompt." });
      router.refresh();

    } catch (err) { // More robust error handling
      let errorMessage = 'An unexpected error occurred.';
      if (typeof err === 'object' && err !== null) {
          if ('response' in err) {
              const errResponse = (err as { response?: { data?: ApiErrorResponse } }).response;
              errorMessage = errResponse?.data?.error || (err as Error).message || errorMessage;
          } else if ('message' in err) {
              errorMessage = (err as Error).message;
          }
      }
      setError(errorMessage);
      toast({ variant: "destructive", title: "Error", description: errorMessage });
      console.error("Join/Payment Error:", err);
    } finally {
      setIsJoining(false);
    }
  };


  if (isLoading) return <p>Loading pool details...</p>;
  if (error && !pool) return <p className="text-red-500">{error}</p>;
  if (!pool) return <p>Pool not found.</p>;

  const canJoin = pool.status === 'OPEN';

  return (
    <div className="animate-in fade-in-0">
      <h1 className="text-3xl font-bold mb-2">{pool.title}</h1>
      <p className="text-slate-600 mb-8">Product: {pool.product.name}</p>
      {error && (
            <Card className="mb-6 p-4 bg-red-50 border-red-200">
                <p className="text-red-600 font-medium">{error}</p>
            </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Pool Status</CardTitle></CardHeader>
            <CardContent>
              <p>Status: <span className={`font-semibold ${pool.status === 'OPEN' ? 'text-green-600' : 'text-slate-500'}`}>{pool.status}</span></p>
              <p>Current Members: {pool.members.length}</p>
              <p>Items Claimed: {pool.currentQuantity} / {pool.targetQuantity}</p>
              <p>Deadline: {new Date(pool.deadline).toLocaleDateString()}</p>
            </CardContent>
          </Card>
           <Card>
            <CardHeader><CardTitle>Members in this Pool</CardTitle></CardHeader>
            <CardContent>
                <ul>
                    {pool.members.map((member, index) => (
                        <li key={index} className="flex justify-between py-2 border-b">
                            <span>{member.user.name || 'Anonymous User'}</span>
                            <span className="font-semibold">{member.quantity} unit(s)</span>
                        </li>
                    ))}
                    {pool.members.length === 0 && <p className="text-slate-500">No members have joined yet.</p>}
                </ul>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-8">
            <CardHeader>
                <CardTitle>Join this Pool</CardTitle>
                <CardDescription>Secure your spot in this shipment.</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
                 <p className="text-4xl font-bold text-blue-600">
                    {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KSH' }).format(pool.pricePerUnit)}
                  </p>
                  <p className="text-sm text-slate-500 mb-6">per unit</p>

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full animate-pulse-button" disabled={!canJoin || isJoining}>
                    {isJoining ? "Processing..." : (canJoin ? "Join Pool & Pay" : "Pool Closed")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Confirm Quantity</DialogTitle>
                    <DialogDescription>
                      How many units of &quot;{pool.product.name}&quot; would you like to add?
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="quantity" className="text-right">
                        Quantity
                      </Label>
                      <Input
                        id="quantity"
                        type="number"
                        value={joinQuantity}
                        onChange={(e) => setJoinQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="col-span-3"
                        min="1"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" onClick={handleJoinPool} disabled={isJoining}>
                      {isJoining ? "Processing..." : `Join ${joinQuantity} Unit(s)`}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
