"use client"

import React, { useEffect, useRef, memo, useState } from 'react';

declare global {
  interface Window {
    TradingView: any;
  }
}

function TradingViewWidget() {
  const container = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !container.current) return;
    
    // Limpar container primeiro
    container.current.innerHTML = '';
    
    // Criar div para o widget
    const widgetDiv = document.createElement("div");
    widgetDiv.id = "tradingview_advanced_chart";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";
    container.current.appendChild(widgetDiv);
    
    // Carregar biblioteca do TradingView
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.type = "text/javascript";
    script.async = true;
    
    script.onload = () => {
      if (window.TradingView && !widgetRef.current) {
        widgetRef.current = new window.TradingView.widget({
          // 📍 Configurações Básicas
          "container_id": "tradingview_advanced_chart",
          "symbol": "GATEIO:DOGUSDT",
          "interval": "60",                    // 1 hora (pode mudar: 1, 5, 15, 60, 240, D, W)
          "timezone": "America/Sao_Paulo",
          "locale": "pt_BR",
          
          // 🎨 Aparência
          "theme": "dark",
          "style": "1",                        // 1 = Candlestick (Candles) ⭐
          "toolbar_bg": "#000000",
          "backgroundColor": "#000000",
          
          // 📐 Dimensões
          "width": "100%",
          "height": "100%",
          "autosize": true,
          
          // 🛠️ Ferramentas e Funcionalidades
          "enable_publishing": false,          // Não permitir publicar ideias
          "hide_top_toolbar": true,            // Ocultar toolbar superior completamente
          "hide_side_toolbar": false,          // Mostrar barra lateral (ferramentas de desenho) ⭐
          "hide_legend": false,                // Mostrar legenda
          "save_image": true,                  // Permitir salvar imagem
          "allow_symbol_change": true,         // Permitir trocar símbolo
          "withdateranges": true,              // Seletor de período
          "details": true,                     // Mostrar detalhes do ativo
          "hotlist": false,                    // Não mostrar hotlist
          "calendar": false,                   // Não mostrar calendário
          "show_volume": true,                 // Mostrar volume
          "show_volume_ma": false,             // Não mostrar média móvel do volume
          "show_volume_ma_volume": false,      // Não mostrar MA do volume
          
          // 📊 Indicadores Técnicos (opcionais)
          "studies": [
            "MASimple@tv-basicstudies",        // Média Móvel Simples
            "Volume@tv-basicstudies"           // Volume (usuário pode redimensionar)
          ],
          
          // 🎯 Configurações Avançadas
          "show_popup_button": true,           // Botão para abrir em popup
          "popup_width": "1000",
          "popup_height": "650",
          
          // 📈 Configurações do gráfico
          "studies_overrides": {
            // Ajustar cores do volume
            "volume.volume.color.0": "#ef5350",       // Vermelho para baixa
            "volume.volume.color.1": "#26a69a",       // Verde para alta
            "volume.volume.transparency": 50,
            "volume.volume ma.color": "#FF6D00",
            "volume.volume ma.transparency": 30,
            "volume.volume ma.linewidth": 2,
            "volume.show ma": false,
            // Altura inicial do painel de volume (~20% da altura total)
            "volume.pane.height": 0.2
          },
          
          "overrides": {
            // Cores dos candles
            "mainSeriesProperties.candleStyle.upColor": "#26a69a",
            "mainSeriesProperties.candleStyle.downColor": "#ef5350",
            "mainSeriesProperties.candleStyle.borderUpColor": "#26a69a",
            "mainSeriesProperties.candleStyle.borderDownColor": "#ef5350",
            "mainSeriesProperties.candleStyle.wickUpColor": "#26a69a",
            "mainSeriesProperties.candleStyle.wickDownColor": "#ef5350",
            
            // Fundo do gráfico
            "paneProperties.background": "#000000",
            "paneProperties.backgroundType": "solid",
            
            // Grid
            "paneProperties.vertGridProperties.color": "#1a1a1a",
            "paneProperties.horzGridProperties.color": "#1a1a1a",
          },
          
          // 🔧 Outras configurações
          "disabled_features": [
            "use_localstorage_for_settings"    // Evitar conflitos de cache
          ],
          "enabled_features": [
            "study_templates",                 // Templates de estudos
            "side_toolbar_in_fullscreen_mode", // Toolbar no fullscreen
            "header_in_fullscreen_mode",       // Header no fullscreen
            "header_widget",                   // Widget do header
            "timeframes_toolbar",              // Toolbar de timeframes
            "edit_buttons_in_legend",          // Botões de edição na legenda
            "context_menus",                   // Menus de contexto
            "control_bar",                     // Barra de controle
            "timeframes_toolbar"               // Toolbar de períodos
          ],
        });
      }
    };
    
    container.current.appendChild(script);
    
    // Cleanup
    return () => {
      widgetRef.current = null;
    };
    
  }, [isClient]);

  if (!isClient) {
    return (
      <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="text-gray-400 font-mono">Loading advanced chart...</div>
      </div>
    );
  }

  return (
    <div ref={container} style={{ height: "100%", width: "100%" }} />
  );
}

export default memo(TradingViewWidget)

