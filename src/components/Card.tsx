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
        relative w-20 h-28 md:w-24 md:h-34
        bg-white rounded-lg shadow-md border-2
        flex flex-col p-2 cursor-pointer transition-all duration-200
        ${selected ? '-translate-y-4 border-yellow-400 shadow-xl' : 'border-slate-200 hover:border-blue-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
        >
            <div className={`text-lg font-bold ${colorClass} self-start`}>
                {rankLabels[card.rank]}
            </div>
            <div className={`text-xl ${colorClass} self-start -mt-1`}>
                {suitSymbols[card.suit]}
            </div>

            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl ${colorClass}`}>
                {suitSymbols[card.suit]}
            </div>

            <div className={`text-lg font-bold ${colorClass} self-end rotate-180 flex flex-col items-end`}>
                <span>{suitSymbols[card.suit]}</span>
                <span className="-mt-1">{rankLabels[card.rank]}</span>
            </div>
        </div>
    );
};

export default Card;
