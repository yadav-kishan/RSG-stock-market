import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface P2PTransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    currentBalance: number;
}

const P2PTransferModal: React.FC<P2PTransferModalProps> = ({ isOpen, onClose, onSuccess, currentBalance }) => {
    const [recipientCode, setRecipientCode] = useState('');
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);

    const handleTransfer = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!recipientCode.trim()) {
            toast.error('Please enter a recipient referral code');
            return;
        }

        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        if (Number(amount) > currentBalance) {
            toast.error('Insufficient balance in Package Wallet');
            return;
        }

        try {
            setLoading(true);
            await api('/api/wallet/p2p-transfer', {
                method: 'POST',
                body: {
                    recipientReferralCode: recipientCode.trim(),
                    amount: Number(amount)
                }
            });

            toast.success('Funds transferred successfully!');
            setRecipientCode('');
            setAmount('');
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(error.message || 'Transfer failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] bg-[#1a1b1e] border-yellow-500/20 text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-yellow-500">
                        <Send size={20} />
                        P2P Transfer
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Transfer funds from your Package Wallet to another user using their referral code.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleTransfer} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="balance" className="text-gray-400">Available Balance</Label>
                        <div className="text-2xl font-bold text-yellow-500">${currentBalance.toLocaleString()}</div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="recipient">Recipient Referral Code</Label>
                        <Input
                            id="recipient"
                            placeholder="Enter referral code"
                            value={recipientCode}
                            onChange={(e) => setRecipientCode(e.target.value)}
                            className="bg-black/20 border-gray-700 focus:border-yellow-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount ($)</Label>
                        <Input
                            id="amount"
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="bg-black/20 border-gray-700 focus:border-yellow-500"
                            min="1"
                        />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading} className="hover:bg-white/10 hover:text-white">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold">
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                'Transfer Funds'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default P2PTransferModal;
