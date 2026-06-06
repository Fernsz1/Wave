/*
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface WaveLogoProps {
  className?: string;
  size?: number | string;
  showText?: boolean;
  textColor?: string;
  textSize?: string;
}

export default function WaveLogo({ 
  className = '', 
  size = 40, 
  showText = false, 
  textColor = 'text-slate-850',
  textSize = 'text-xl'
}: WaveLogoProps) {
  return (
    <div id="wave-branding-wrapper" className={`flex items-center gap-2.5 ${className}`}>
      <svg
        id="wave-logo-svg"
        width={size}
        height={size}
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2500/svg"
        className="shrink-0 transition-transform duration-200"
      >
        {/* 1. Concentric Wave Arcs (Slightly curved, concentric signal loops in deep navy blue) */}
        <path
          id="wave-arc-inner"
          d="M 210,165 A 50,51 0 0,1 290,165"
          stroke="#004A9E"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          id="wave-arc-middle"
          d="M 180,135 A 86,86 0 0,1 320,135"
          stroke="#004A9E"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          id="wave-arc-outer"
          d="M 150,105 A 122,122 0 0,1 350,105"
          stroke="#004A9E"
          strokeWidth="18"
          strokeLinecap="round"
        />

        {/* 2. Open Book Crest formed by swooping wing guides */}
        {/* Left Book Crest */}
        <path
          id="book-crest-left"
          d="M 250,205 C 182,183 113,151 52,120 C 110,138 180,172 250,215 Z"
          fill="#004A9E"
        />
        {/* Right Book Crest */}
        <path
          id="book-crest-right"
          d="M 250,205 C 318,183 387,151 448,120 C 390,138 320,172 250,215 Z"
          fill="#004A9E"
		    />

        {/* 3. The Mosaic Stylized "W" Body */}
        {/* Leftmost Outer Leg (Cerulean Gradient Blue) */}
        <path
          id="w-leg-left-outer"
          d="M 15,142 L 222,142 L 195,425 L 120,425 Z"
          fill="url(#sky-blue-grad)"
        />

        {/* Inner Left Corner (Rich Royal/Navy Contrast) */}
        <path
          id="w-inner-left-chevron"
          d="M 221,142 L 250,195 L 195,425 Z"
          fill="#043275"
        />

        {/* Inner Right Corner (Deep Solid Indigo) */}
        <path
          id="w-inner-right-chevron"
          d="M 250,195 L 279,142 L 305,425 Z"
          fill="#002154"
        />

        {/* Rightmost Outer Leg (Lush Mint Emerald) */}
        <path
          id="w-leg-right-outer"
          d="M 278,142 L 485,142 L 380,425 L 305,425 Z"
          fill="#00B48A"
        />

        {/* Gradient Definition */}
        <defs>
          <linearGradient id="sky-blue-grad" x1="15" y1="142" x2="222" y2="425" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00A2E2" />
            <stop offset="1" stopColor="#005CA9" />
          </linearGradient>
        </defs>
      </svg>
      {showText && (
        <span id="wave-branding-text" className={`font-display font-bold ${textColor} ${textSize} tracking-tight`}>
          Wave
        </span>
      )}
    </div>
  );
}
