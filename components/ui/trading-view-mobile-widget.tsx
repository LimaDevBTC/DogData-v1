"use client"

import React, { useEffect, useRef, memo, useState } from 'react';

function TradingViewMobileWidget() {
  const container = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !container.current) return;

    container.current.innerHTML = '';

    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container__widget";
    widgetContainer.style.height = "100%";
    widgetContainer.style.width = "100%";
    container.current.appendChild(widgetContainer);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      "symbols": [["KRAKEN:DOGUSD|1D"]],
      "chartOnly": true,
      "width": "100%",
      "height": "100%",
      "locale": "pt_BR",
      "colorTheme": "dark",
      "autosize": true,
      "showVolume": true,
      "showMA": false,
      "hideDateRanges": false,
      "hideMarketStatus": true,
      "hideSymbolLogo": true,
      "scalePosition": "right",
      "scaleMode": "Normal",
      "fontSize": "10",
      "noTimeScale": false,
      "valuesTracking": "1",
      "chartType": "area",
      "lineColor": "#f7931a",
      "bottomColor": "rgba(247, 147, 26, 0.05)",
      "topColor": "rgba(247, 147, 26, 0.25)",
      "lineWidth": 2,
      "backgroundColor": "#000000",
      "gridLineColor": "#1a1a1a",
    });

    container.current.appendChild(script);

    return () => {
      if (container.current) {
        container.current.innerHTML = '';
      }
    };
  }, [isClient]);

  if (!isClient) {
    return (
      <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="text-gray-400 font-mono text-sm">Loading chart...</div>
      </div>
    );
  }

  return (
    <div
      ref={container}
      className="tradingview-widget-container"
      style={{ height: "100%", width: "100%" }}
    />
  );
}

export default memo(TradingViewMobileWidget);
