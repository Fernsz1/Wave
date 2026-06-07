/*
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import logoSrc from '../wavelogofinal.png';

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
  textColor = 'text-slate-855',
  textSize = 'text-xl'
}: WaveLogoProps) {
  return (
    <div id="wave-branding-wrapper" className={`flex items-center gap-2.5 ${className}`}>
      <img
        id="wave-logo-img"
        src={logoSrc}
        alt="Wave Logo"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 object-contain transition-transform duration-200"
      />
      {showText && (
        <span id="wave-branding-text" className={`font-lexend font-bold ${textColor} ${textSize} tracking-tight`}>
          Wave
        </span>
      )}
    </div>
  );
}
