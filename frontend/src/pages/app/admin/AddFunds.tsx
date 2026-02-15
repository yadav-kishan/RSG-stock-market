import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { PlusCircle, Loader2, Info } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

export default function AddFunds() {
    const [referralCodes, setReferralCodes] = useState('');
    const [amount, setAmount] = useState('');
    interface ManualDepositResponse {
        message: string;
        results: {
            success: Array<{ code: string; name: string; email: string }>;
            failed: Array<{ code: string; error: string }>;
        };
    }

    const [results, setResults] = useState<ManualDepositResponse['results'] | null>(null);

    const addFundsMutation = useMutation<ManualDepositResponse, Error, { referralCodes: string[], amount: number }>({
        mutationFn: (data) =>
            api('/api/admin/deposits/manual', {
                method: 'POST',
                body: data
            }),
        onSuccess: (data) => {
            if (data.results) {
                setResults(data.results);
                const successCount = data.results.success.length;
                const failCount = data.results.failed.length;

                if (successCount > 0) {
                    toast.success(`Successfully added funds to ${successCount} user(s)`);
                }
                if (failCount > 0) {
                    toast.error(`Failed to add funds to ${failCount} user(s)`);
                }

                // Reset form if all successful
                if (failCount === 0) {
                    setReferralCodes('');
                    setAmount('');
                }
            }
        },
        onError: (err) => {
            toast.error(err.message || 'Failed to add funds.');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!referralCodes.trim() || !amount) {
            toast.error('Please fill in all fields');
            return;
        }

        // Split by newlines or commas and clean up
        const codes = referralCodes
            .split(/[\n,]+/)
            .map(code => code.trim())
            .filter(code => code.length > 0);

        if (codes.length === 0) {
            toast.error('Please enter at least one referral code');
            return;
        }

        addFundsMutation.mutate({
            referralCodes: codes,
            amount: Number(amount)
        });
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <PlusCircle className="h-6 w-6 text-primary" />
                        Add Funds to Users
                    </CardTitle>
                    <CardDescription>
                        Manually add funds to user wallets using their referral codes.
                        You can add funds to multiple users at once.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="referralCodes">Referral Codes</Label>
                            <Textarea
                                id="referralCodes"
                                placeholder="Enter referral codes (one per line or comma separated)&#10;Example:&#10;RSG123456&#10;RSG789012"
                                value={referralCodes}
                                onChange={(e) => setReferralCodes(e.target.value)}
                                className="min-h-[120px] font-mono"
                            />
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Info className="h-3 w-3" />
                                You can paste multiple referral codes here.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount ($)</Label>
                            <Input
                                id="amount"
                                type="number"
                                min="1"
                                step="0.01"
                                placeholder="Enter amount to add"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={addFundsMutation.isPending}
                        >
                            {addFundsMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                'Add Funds'
                            )}
                        </Button>
                    </form>

                    {results && (
                        <div className="mt-8 space-y-4">
                            <h3 className="font-semibold text-lg border-b pb-2">Results</h3>

                            {results.success.length > 0 && (
                                <div className="bg-green-500/10 border border-green-500/20 rounded-md p-4">
                                    <h4 className="font-medium text-green-700 mb-2">✅ Success ({results.success.length})</h4>
                                    <ul className="space-y-1 text-sm">
                                        {results.success.map((item, idx) => (
                                            <li key={idx} className="flex justify-between">
                                                <span>{item.code} ({item.name})</span>
                                                <span className="text-green-600">Funds Added</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {results.failed.length > 0 && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-md p-4">
                                    <h4 className="font-medium text-red-700 mb-2">❌ Failed ({results.failed.length})</h4>
                                    <ul className="space-y-1 text-sm">
                                        {results.failed.map((item, idx) => (
                                            <li key={idx} className="flex justify-between">
                                                <span className="font-mono">{item.code}</span>
                                                <span className="text-red-600">{item.error}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
