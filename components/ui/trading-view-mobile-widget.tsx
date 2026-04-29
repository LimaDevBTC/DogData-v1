"use client"

import React, { memo } from 'react';

// Symbol Overview via iframe srcdoc — única abordagem que garante que
// document.currentScript funciona corretamente (o widget lê o JSON via currentScript.textContent)
function TradingViewMobileWidget() {
  const config = {
    symbols: [["KRAKEN:DOGUSD|3M"]],
    chartOnly: false,
    width: "100%",
    height: "100%",
    locale: "pt_BR",
    colorTheme: "dark",
    autosize: true,
    showVolume: false,
    showMA: false,
    hideDateRanges: false,
    hideMarketStatus: true,
    hideSymbolLogo: false,
    scalePosition: "right",
    scaleMode: "Normal",
    fontSize: "10",
    noTimeScale: false,
    valuesTracking: "1",
    changeMode: "price-and-percent",
    chartType: "area",
    lineWidth: 2,
    lineColor: "#f7931a",
    topColor: "rgba(247, 147, 26, 0.25)",
    bottomColor: "rgba(247, 147, 26, 0.0)",
    backgroundColor: "rgba(0, 0, 0, 1)",
    gridLineColor: "rgba(26, 26, 26, 1)",
  };

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; width: 100%; background: #000; overflow: hidden; }
    .tradingview-widget-container { height: 100%; width: 100%; }
    .tradingview-widget-container__widget { height: 100%; width: 100%; }
  </style>
</head>
<body>
  <div class="tradingview-widget-container">
    <div class="tradingview-widget-container__widget"></div>
    <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js" async>
    ${JSON.stringify(config)}
    </script>
  </div>
</body>
</html>`;

  return (
    <iframe
      srcDoc={html}
      style={{ border: 'none', width: '100%', height: '100%', display: 'block' }}
      title="DOG Price Chart"
      loading="lazy"
    />
  );
}

export default memo(TradingViewMobileWidget);
