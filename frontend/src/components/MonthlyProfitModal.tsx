import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Calendar, DollarSign, Percent } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface MonthlyProfitModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const MonthlyProfitModal: React.FC<MonthlyProfitModalProps> = ({ isOpen, onClose }) => {
    const { data, isLoading } = useQuery({
        queryKey: ['profit-summary'],
        queryFn: () => api<any>('/api/user/profit-summary'),
        enabled: isOpen,
    });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg w-full">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-green-500">
                        <TrendingUp className="h-5 w-5" />
                        Monthly Profit Summary
                    </DialogTitle>
                    <DialogDescription>
                        2% monthly return on your Investment Wallet balance, paid on the 1st of each month.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
                    </div>
                ) : data ? (
                    <div className="space-y-4">
                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                                    <DollarSign className="h-3 w-3" />
                                    Investment Balance
                                </div>
                                <div className="text-xl font-bold text-green-500">
                                    ${Number(data.investment_wallet_balance).toLocaleString()}
                                </div>
                            </div>

                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center">
                                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                                    <Percent className="h-3 w-3" />
                                    Next Payout (2%)
                                </div>
                                <div className="text-xl font-bold text-yellow-500">
                                    +${Number(data.projected_monthly_profit).toFixed(2)}
                                </div>
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                                    <TrendingUp className="h-3 w-3" />
                                    Total Earned
                                </div>
                                <div className="text-xl font-bold text-blue-500">
                                    ${Number(data.total_profit_earned).toFixed(2)}
                                </div>
                            </div>

                            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-center">
                                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                                    <DollarSign className="h-3 w-3" />
                                    Income Wallet
                                </div>
                                <div className="text-xl font-bold text-purple-500">
                                    ${Number(data.income_wallet_balance).toLocaleString()}
                                </div>
                            </div>
                        </div>

                        {/* Payout Schedule */}
                        <div className="bg-muted/30 rounded-lg p-3 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <Calendar className="h-4 w-4" />
                                <span className="font-medium">Payout Schedule</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Profits are distributed automatically on the <strong>1st of every month</strong>.
                                The payout is 2% of your Investment Wallet balance on that date.
                            </p>
                        </div>

                        {/* Profit History */}
                        {data.profit_history?.length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    Profit History
                                </h4>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {data.profit_history.map((entry: any, idx: number) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2 text-sm"
                                        >
                                            <div>
                                                <div className="text-xs text-muted-foreground">
                                                    {new Date(entry.date).toLocaleDateString('en-US', {
                                                        year: 'numeric', month: 'short', day: 'numeric'
                                                    })}
                                                </div>
                                                <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                                                    {entry.description}
                                                </div>
                                            </div>
                                            <Badge className="bg-green-600/20 text-green-400 border-green-500/30 text-xs font-bold">
                                                +${Number(entry.amount).toFixed(2)}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {data.profit_history?.length === 0 && (
                            <div className="text-center text-muted-foreground text-sm py-4">
                                No profit payouts yet. The first payout will arrive on the 1st of next month.
                            </div>
                        )}
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
};

export default MonthlyProfitModal;
