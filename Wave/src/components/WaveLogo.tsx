/*
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import waveLogo from '../assets/wavelogofinal.png';

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
      <img
        id="wave-logo-img"
        src={waveLogo}
        alt="Wave logo"
        width={size}
        height={size}
        className="shrink-0 object-contain"
      />
      {showText && (
        <span id="wave-branding-text" className={`font-display font-bold ${textColor} ${textSize} tracking-tight`}>
          Wave
        </span>
      )}
    </div>
  );
}
