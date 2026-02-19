import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface TimeLeft {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

const CountdownTimer: React.FC = () => {
    // Set target date to 365 days from now (simulated launch countdown)
    // In a real app, this might come from an API or config
    const [targetDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() + 365);
        return date.getTime();
    });

    const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const difference = targetDate - now;

            if (difference > 0) {
                setTimeLeft({
                    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                    minutes: Math.floor((difference / 1000 / 60) % 60),
                    seconds: Math.floor((difference / 1000) % 60),
                });
            } else {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
            }
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(timer);
    }, [targetDate]);

    const TimeBlock = ({ value, label }: { value: number; label: string }) => (
        <div className="bg-[#fbbf24] rounded-lg p-3 sm:p-4 text-center min-w-[70px] sm:min-w-[90px] w-full shadow-lg">
            <div className="text-2xl sm:text-4xl font-bold text-black border-b-2 border-black/20 pb-1 mb-1">
                {value.toString().padStart(2, '0')}
            </div>
            <div className="text-[10px] sm:text-xs font-bold text-black/70 uppercase tracking-widest">
                {label}
            </div>
        </div>
    );

    return (
        <div className="w-full mb-6">
            <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-yellow-500 uppercase tracking-widest">
                    <span className="border-l-4 border-yellow-500 pl-2">Get Tokens</span> Before Time Up
                </h3>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-3xl mx-auto">
                <TimeBlock value={timeLeft.days} label="Days" />
                <TimeBlock value={timeLeft.hours} label="Hours" />
                <TimeBlock value={timeLeft.minutes} label="Minutes" />
                <TimeBlock value={timeLeft.seconds} label="Seconds" />
            </div>
        </div>
    );
};

export default CountdownTimer;
