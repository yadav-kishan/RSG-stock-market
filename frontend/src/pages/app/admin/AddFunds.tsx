import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { PlusCircle, Loader2, Info, Package, TrendingUp } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export default function AddFunds() {
    const [referralCodes, setReferralCodes] = useState('');
    const [amount, setAmount] = useState('');
    const [walletType, setWalletType] = useState<'package' | 'investment'>('package');

    interface ManualDepositResponse {
        message: string;
        results: {
            success: Array<{ code: string; name: string; email: string }>;
            failed: Array<{ code: string; error: string }>;
        };
    }

    const [results, setResults] = useState<ManualDepositResponse['results'] | null>(null);

    const addFundsMutation = useMutation<ManualDepositResponse, Error, { referralCodes: string[]; amount: number; walletType: string }>({
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
            amount: Number(amount),
            walletType
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

                        {/* Wallet Type Selector */}
                        <div className="space-y-2">
                            <Label>Destination Wallet</Label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setWalletType('package')}
                                    className={cn(
                                        'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                                        walletType === 'package'
                                            ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500'
                                            : 'border-border bg-muted/30 text-muted-foreground hover:border-yellow-500/50'
                                    )}
                                >
                                    <Package className="h-6 w-6" />
                                    <span className="font-semibold text-sm">Package Wallet</span>
                                    <span className="text-xs opacity-70">For deposits & P2P</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setWalletType('investment')}
                                    className={cn(
                                        'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                                        walletType === 'investment'
                                            ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                                            : 'border-border bg-muted/30 text-muted-foreground hover:border-blue-500/50'
                                    )}
                                >
                                    <TrendingUp className="h-6 w-6" />
                                    <span className="font-semibold text-sm">Investment Wallet</span>
                                    <span className="text-xs opacity-70">Earns monthly profit</span>
                                </button>
                            </div>
                        </div>

                        {/* Referral Codes */}
                        <div className="space-y-2">
                            <Label htmlFor="referralCodes">Referral Codes</Label>
                            <Textarea
                                id="referralCodes"
                                placeholder={`Enter referral codes (one per line or comma separated)\nExample:\nRSG123456\nRSG789012`}
                                value={referralCodes}
                                onChange={(e) => setReferralCodes(e.target.value)}
                                className="min-h-[120px] font-mono"
                            />
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Info className="h-3 w-3" />
                                You can paste multiple referral codes here.
                            </p>
                        </div>

                        {/* Amount */}
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

                        {/* Summary */}
                        {amount && (
                            <div className={cn(
                                'text-sm p-3 rounded-lg border',
                                walletType === 'package'
                                    ? 'bg-yellow-500/5 border-yellow-500/20 text-yellow-600'
                                    : 'bg-blue-500/5 border-blue-500/20 text-blue-600'
                            )}>
                                ${Number(amount).toFixed(2)} will be added to each user's{' '}
                                <strong>{walletType === 'package' ? 'Package Wallet' : 'Investment Wallet'}</strong>.
                                No platform fee is applied for admin deposits.
                            </div>
                        )}

                        <Button
                            type="submit"
                            className={cn(
                                'w-full font-semibold',
                                walletType === 'package'
                                    ? 'bg-yellow-500 hover:bg-yellow-600 text-black'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                            )}
                            disabled={addFundsMutation.isPending}
                        >
                            {addFundsMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                `Add to ${walletType === 'package' ? 'Package Wallet' : 'Investment Wallet'}`
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
