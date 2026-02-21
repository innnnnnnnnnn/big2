"use client";

import React from 'react';
import { Card as CardType, Suit, Rank } from '../logic/types';

interface CardProps {
    card: CardType;
    selected?: boolean;
    onClick?: () => void;
    className?: string;
    disabled?: boolean;
}

const suitSymbols = {
    [Suit.Club]: '♣',
    [Suit.Diamond]: '♦',
    [Suit.Heart]: '♥',
    [Suit.Spade]: '♠',
};

const rankLabels: Record<number, string> = {
    [Rank.Three]: '3',
    [Rank.Four]: '4',
    [Rank.Five]: '5',
    [Rank.Six]: '6',
    [Rank.Seven]: '7',
    [Rank.Eight]: '8',
    [Rank.Nine]: '9',
    [Rank.Ten]: '10',
    [Rank.Jack]: 'J',
    [Rank.Queen]: 'Q',
    [Rank.King]: 'K',
    [Rank.Ace]: 'A',
    [Rank.Two]: '2',
};

const Card: React.FC<CardProps> = ({ card, selected, onClick, className = '', disabled }) => {
    const isRed = card.suit === Suit.Diamond || card.suit === Suit.Heart;
    const colorClass = isRed ? 'text-red-600' : 'text-slate-900';

    return (
        <div
            onClick={!disabled ? onClick : undefined}
            className={`
                relative w-20 h-28 md:w-24 md:h-[136px]
                rounded-xl border-[1px] bg-gradient-to-br from-white to-slate-200
                flex flex-col p-1.5 md:p-2 cursor-pointer transition-all duration-300 ease-out transform-gpu
                ${selected
                    ? '-translate-y-4 md:-translate-y-6 border-yellow-300 shadow-[0_0_30px_rgba(250,204,21,0.8),0_15px_30px_rgba(0,0,0,0.5)] ring-2 ring-yellow-400 z-[100]'
                    : 'border-white/60 shadow-[2px_8px_20px_rgba(0,0,0,0.5),inset_1px_1px_2px_rgba(255,255,255,1)] hover:-translate-y-2'}
                ${disabled ? 'cursor-default opacity-90 brightness-[0.95]' : ''}
                ${className}
            `}
        >
            {/* Top-left rank & suit */}
            <div className={`text-base md:text-xl font-black ${colorClass} self-start leading-none tracking-tighter`}>
                {rankLabels[card.rank]}
            </div>
            <div className={`text-lg md:text-2xl ${colorClass} self-start -mt-0.5 md:-mt-1`}>
                {suitSymbols[card.suit]}
            </div>

            {/* Center large suit */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[3rem] md:text-[4rem] ${colorClass} drop-shadow-sm opacity-80`}>
                {suitSymbols[card.suit]}
            </div>

            {/* Bottom-right rank & suit (upside down) */}
            <div className={`text-base md:text-xl font-black ${colorClass} self-end rotate-180 flex flex-col items-end leading-none tracking-tighter absolute bottom-1.5 md:bottom-2 right-1.5 md:right-2`}>
                <span className="text-lg md:text-2xl">{suitSymbols[card.suit]}</span>
                <span className="-mt-0.5 md:-mt-1">{rankLabels[card.rank]}</span>
            </div>
        </div>
    );
};

export default Card;
