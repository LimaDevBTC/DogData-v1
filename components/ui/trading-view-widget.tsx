"use client"

import React, { useEffect, useRef, memo, useState } from 'react';

function TradingViewWidget() {
  const container = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !container.current) return;
    
    // Limpar container primeiro
    container.current.innerHTML = '';
    
    // Usar widget de mini-chart (mais simples, sem iframe)
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = `
      {
        "symbol": "GATEIO:DOGUSDT",
        "width": "100%",
        "height": "100%",
        "locale": "en",
        "dateRange": "12M",
        "colorTheme": "dark",
        "isTransparent": false,
        "autosize": true,
        "largeChartUrl": "https://www.tradingview.com/symbols/DOGUSDT/?exchange=GATEIO"
      }`;
    
    container.current.appendChild(script);
    
  }, [isClient]);

  if (!isClient) {
    return (
      <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="text-gray-400 font-mono">Loading chart...</div>
      </div>
    );
  }

  return (
    <div ref={container} style={{ height: "100%", width: "100%" }} />
  );
}

export default memo(TradingViewWidget)

