"use client"

import React, { useEffect, memo } from 'react';

function TradingViewMobileWidget() {
  useEffect(() => {
    const scriptId = 'tv-mini-chart-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.type = 'module';
      script.src = 'https://widgets.tradingview-widget.com/w/en/tv-mini-chart.js';
      document.head.appendChild(script);
    }
  }, []);

  return (
    // @ts-ignore — custom element registrado pelo script do TradingView
    <tv-mini-chart
      symbol="KRAKEN:DOGUSD"
      show-time-scale
      color-theme="dark"
      is-transparent
      locale="pt_BR"
      date-range="3M"
      trend-line-color="#f7931a"
      under-line-color="rgba(247,147,26,0.15)"
      under-line-bottom-color="rgba(247,147,26,0)"
      style={{ width: '100%', height: '100%', display: 'block', background: 'transparent' }}
    />
  );
}

export default memo(TradingViewMobileWidget);
