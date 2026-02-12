// registry.js
(function () {
    "use strict";
  
    const games = {};
  
    function register(gameId, gameFactory) {
      if (!gameId || typeof gameFactory !== "function") {
        console.error("[GameRegistry] Invalid registration:", gameId);
        return;
      }
  
      games[gameId] = gameFactory;
      console.log("[GameRegistry] Registered:", gameId);
    }
  
    function get(gameId) {
      return games[gameId] || null;
    }
  
    window.GameRegistry = {
      register,
      get,
    };
  })();
  