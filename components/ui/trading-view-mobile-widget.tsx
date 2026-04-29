"use client"

import React, { useEffect, useRef, memo, useState } from 'react';

declare global {
  interface Window {
    TradingView: any;
  }
}

function TradingViewMobileWidget() {
  const container = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !container.current) return;

    container.current.innerHTML = '';

    const widgetDiv = document.createElement("div");
    widgetDiv.id = "tradingview_mobile_chart";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";
    container.current.appendChild(widgetDiv);

    const initWidget = () => {
      if (window.TradingView && !widgetRef.current) {
        widgetRef.current = new window.TradingView.widget({
          "container_id": "tradingview_mobile_chart",
          "symbol": "KRAKEN:DOGUSD",
          "interval": "D",
          "timezone": "America/Sao_Paulo",
          "locale": "pt_BR",
          "theme": "dark",
          "style": "3",              // Area chart
          "toolbar_bg": "#000000",
          "backgroundColor": "#000000",
          "width": "100%",
          "height": "100%",
          "autosize": true,
          "enable_publishing": false,
          "hide_top_toolbar": true,
          "hide_side_toolbar": true,
          "hide_legend": true,
          "withdateranges": true,
          "details": false,
          "hotlist": false,
          "calendar": false,
          "show_volume": false,
          "overrides": {
            "paneProperties.background": "#000000",
            "paneProperties.backgroundType": "solid",
            "paneProperties.vertGridProperties.color": "#1a1a1a",
            "paneProperties.horzGridProperties.color": "#1a1a1a",
            "mainSeriesProperties.areaStyle.color1": "rgba(247, 147, 26, 0.25)",
            "mainSeriesProperties.areaStyle.color2": "rgba(247, 147, 26, 0.05)",
            "mainSeriesProperties.areaStyle.linecolor": "#f7931a",
            "mainSeriesProperties.areaStyle.linewidth": 2,
          },
          "disabled_features": [
            "use_localstorage_for_settings",
            "header_widget",
            "left_toolbar",
            "context_menus",
            "control_bar",
          ],
          "enabled_features": [],
        });
      }
    };

    // tv.js pode já estar carregado pelo widget desktop
    if (window.TradingView) {
      initWidget();
    } else {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/tv.js";
      script.type = "text/javascript";
      script.async = true;
      script.onload = initWidget;
      container.current.appendChild(script);
    }

    return () => {
      widgetRef.current = null;
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
    <div ref={container} style={{ height: "100%", width: "100%" }} />
  );
}

export default memo(TradingViewMobileWidget);
