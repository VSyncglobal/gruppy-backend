'use client';

import { useState } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import apiClient from '@/lib/api';

// --- Frontend Zod Schema (mirrors backend) ---
const formSchema = z.object({
  basePrice: z.coerce.number().positive({ message: "Must be a positive number." }),
  weightKg: z.coerce.number().positive({ message: "Must be a positive number." }),
  hsCode: z.string().min(4, { message: "HS Code is required." }),
  route: z.string().min(3, { message: "Route is required." }),
});

// --- Type for the API response data ---
interface PricingResult {
    finalPrice: number;
    totalTaxes: number;
    freightCost: number;
    commission: number;
}

interface ApiErrorResponse {
    error: string;
}

export default function CalculatorPage() {
  const [result, setResult] = useState<PricingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      basePrice: 100,
      weightKg: 2,
      hsCode: "8517.12.00", // Example for electronics
      route: "China-Mombasa Sea",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setApiError(null);
    setResult(null);

    try {
      const response = await apiClient.post<{ data: PricingResult }>('/api/pricing/calculate', {
          ...values,
          distanceKm: 0, // This is required by the backend schema but not used in the final calculation
      });
      setResult(response.data.data);
    } catch (err) {
        let errorMessage = 'An unexpected error occurred.';
        if (typeof err === 'object' && err !== null && 'response' in err) {
            const response = (err as { response?: { data?: ApiErrorResponse } }).response;
            if (response?.data?.error) {
                errorMessage = response.data.error;
            }
        }
        setApiError(errorMessage);
        console.error("Calculation Error:", err);
    } finally {
        setIsLoading(false);
    }
  }

  const formatKsh = (amount: number) => 
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KSH' }).format(amount);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Pricing Calculator</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader><CardTitle>Enter Shipment Details</CardTitle></CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField control={form.control} name="basePrice" render={({ field }) => (
                  <FormItem><FormLabel>Item Cost (USD)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="weightKg" render={({ field }) => (
                  <FormItem><FormLabel>Weight (kg)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="hsCode" render={({ field }) => (
                  <FormItem><FormLabel>HS Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="route" render={({ field }) => (
                  <FormItem><FormLabel>Shipping Route</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Calculating..." : "Calculate Landed Cost"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* --- Results Section --- */}
        <div className="space-y-4">
          {isLoading && <Card className="flex items-center justify-center p-8"><p>Loading results...</p></Card>}
          {apiError && <Card className="p-4 bg-red-50 border-red-200"><p className="text-red-600 font-medium">{apiError}</p></Card>}
          {result && (
            <Card className="bg-green-50 border-green-200 animate-in fade-in-0">
              <CardHeader><CardTitle className="text-green-800">Calculation Complete</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                    <p className="text-sm font-medium text-green-700">Final Landed Price</p>
                    <p className="text-4xl font-bold text-green-800">{formatKsh(result.finalPrice)}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm pt-4 border-t">
                    <p className="text-slate-600">Freight Cost:</p><p className="font-medium text-right">{formatKsh(result.freightCost)}</p>
                    <p className="text-slate-600">Total KRA Taxes:</p><p className="font-medium text-right">{formatKsh(result.totalTaxes)}</p>
                    <p className="text-slate-600">Affiliate Discount:</p><p className="font-medium text-right text-blue-600">-{formatKsh(result.commission)}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}