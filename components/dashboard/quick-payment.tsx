"use client";

import { cn } from "@/lib/utils";
import { Check, CreditCard, Radio, Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const PaymentMethod = ({
    active,
    onClick,
    title,
    subtitle,
    type
}: {
    active: boolean;
    onClick: () => void;
    title: string;
    subtitle: string;
    type: "card" | "paypal";
}) => (
    <div
        onClick={onClick}
        className={cn(
            "relative p-4 rounded-2xl cursor-pointer transition-all border",
            active
                ? "bg-[#2d2d2d] border-transparent"
                : "bg-[#1f1f1f] border-transparent hover:bg-[#252525]"
        )}>
        <div className="flex items-start gap-4">
            <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center mt-1 border",
                active ? "border-blue-500 bg-blue-500" : "border-zinc-600"
            )}>
                {active && <div className="w-2 h-2 bg-white rounded-full" />}
            </div>
            <div>
                <h4 className="font-medium text-white mb-1">{title}</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">{subtitle}</p>
            </div>
        </div>
    </div>
);

export function QuickPayment() {
    const [method, setMethod] = useState<"card" | "paypal">("paypal");

    return (
        <div className="bg-[#181818] p-6 lg:p-8 rounded-[40px] h-full flex flex-col">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-medium text-white">Resumen Financiero</h3>
                <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-zinc-600"></div>
                    <div className="w-1 h-1 rounded-full bg-zinc-600"></div>
                    <div className="w-1 h-1 rounded-full bg-zinc-600"></div>
                </div>
            </div>

            <div className="space-y-4 mb-8">
                <PaymentMethod
                    active={method === "card"}
                    onClick={() => setMethod("card")}
                    title="Debit Card"
                    subtitle="Where a payment provider offers multiple types"
                    type="card"
                />
                <PaymentMethod
                    active={method === "paypal"}
                    onClick={() => setMethod("paypal")}
                    title="Paypal"
                    subtitle="Where a payment provider offers multiple types"
                    type="paypal"
                />
            </div>

            <div className="mt-4">
                <p className="text-sm font-medium text-zinc-400 mb-6">Details</p>

                <h2 className="text-3xl font-bold text-white mb-6">
                    $ 2,000 <span className="text-base font-normal text-zinc-500">/Mo</span>
                </h2>

                <div className="bg-[#1f1f1f] p-4 rounded-2xl mb-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#2d2d2d] flex items-center justify-center shrink-0">
                        <Zap className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                        <h4 className="font-medium text-white">Electricity</h4>
                        <p className="text-xs text-zinc-500">Where a payment provider offers multiple types</p>
                    </div>
                </div>

                <div className="space-y-4 mb-8">
                    <p className="text-sm font-medium text-white mb-4">Payment Includes :</p>
                    {[
                        "Safe from fine",
                        "More efficient use of electricity",
                        "Subsidies category 900 VA, IDR 1.352/kwh",
                        "More practical and efficient use"
                    ].map((item, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <div className="mt-1 w-4 h-4 rounded-full border border-zinc-500 flex items-center justify-center shrink-0">
                                <Check className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-xs text-zinc-400">{item}</span>
                        </div>
                    ))}
                </div>

                <div className="mt-auto">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-zinc-400">Total :</span>
                        <span className="text-xl font-bold text-white">$ 2,000</span>
                    </div>

                    <Button className="w-full h-14 rounded-2xl bg-[#333333] hover:bg-[#444] text-white font-medium text-base">
                        Continue for payment
                    </Button>
                </div>
            </div>
        </div>
    );
}
