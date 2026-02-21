import React, { useState, useEffect, useMemo } from 'react';

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
    const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    const [expired, setExpired] = useState(false);

    // Recalculate target whenever joinDate changes
    const targetDate = useMemo(() => {
        if (joinDate) {
            const d = new Date(joinDate);
            d.setFullYear(d.getFullYear() + 1); // 1 year from join date
            return d.getTime();
        }
        // Fallback: 365 days from now
        const d = new Date();
        d.setDate(d.getDate() + 365);
        return d.getTime();
    }, [joinDate]);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = Date.now();
            const diff = targetDate - now;

            if (diff > 0) {
                setExpired(false);
                setTimeLeft({
                    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
                    minutes: Math.floor((diff / (1000 * 60)) % 60),
                    seconds: Math.floor((diff / 1000) % 60),
                });
            } else {
                setExpired(true);
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
                {String(value).padStart(2, '0')}
            </div>
            <div className="text-[10px] sm:text-xs font-bold text-black/70 uppercase tracking-widest">
                {label}
            </div>
        </div>
    );

    return (
        <div className="w-full mb-6">
            <div className="text-center mb-4">
                {expired ? (
                    <>
                        <h3 className="text-xl font-bold text-red-500 uppercase tracking-widest">
                            <span className="border-l-4 border-red-500 pl-2">ID Validity Expired</span>
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            Unlock Investment to continue using the platform
                        </p>
                    </>
                ) : (
                    <>
                        <h3 className="text-xl font-bold text-yellow-500 uppercase tracking-widest">
                            <span className="border-l-4 border-yellow-500 pl-2">ID Validity</span>
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            Unlock Investment to remove this timer
                        </p>
                    </>
                )}
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
