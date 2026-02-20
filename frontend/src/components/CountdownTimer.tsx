import React, { useState, useEffect } from 'react';

interface TimeLeft {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

interface CountdownTimerProps {
    joinDate?: string | null;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ joinDate }) => {
    // Calculate target date: 365 days from join date
    const [targetDate] = useState(() => {
        if (joinDate) {
            const date = new Date(joinDate);
            date.setFullYear(date.getFullYear() + 1);
            return date.getTime();
        }
        // Fallback: 365 days from now
        const date = new Date();
        date.setDate(date.getDate() + 365);
        return date.getTime();
    });

    const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    const [expired, setExpired] = useState(false);

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
                setExpired(false);
            } else {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
                setExpired(true);
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
                    {expired ? (
                        <span className="text-red-500 border-l-4 border-red-500 pl-2">ID Validity Expired</span>
                    ) : (
                        <span className="border-l-4 border-yellow-500 pl-2">ID Validity</span>
                    )}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                    {expired ? 'Unlock Investment to continue using the platform' : 'Unlock Investment to remove this timer'}
                </p>
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
