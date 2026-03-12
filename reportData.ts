export const reportData = {
  "kpis": {
    "totalRequests": 573,
    "distinctUsers": 1,
    "productiveActions": 106,
    "navigationActions": 175,
    "totalEconomyMin": 2255,
    "totalEconomyHours": 37.58
  },
  "summary": {
    "totalRequests": 573,
    "totalUsers": 1,
    "productiveActions": 106,
    "navigationActions": 175,
    "totalEconomyHours": 37.58,
    "totalEconomyMin": 2255,
    "pythonLogs": 0,
    "bridgeLogs": 0
  },
  "statusDistribution": {
    "302": 63,
    "200": 252,
    "304": 183,
    "404": 15,
    "401": 3,
    "400": 39,
    "500": 18
  },
  "endpointEconomy": [
    {
      "endpoint": "POST /api/mkt",
      "frequency": 21,
      "economyMin": 1071,
      "economyHours": 17.85,
      "timePerCallMin": 51
    },
    {
      "endpoint": "POST /api/wiki",
      "frequency": 35,
      "economyMin": 595,
      "economyHours": 9.92,
      "timePerCallMin": 17
    },
    {
      "endpoint": "POST /api/comandos-oxidized/run",
      "frequency": 21,
      "economyMin": 357,
      "economyHours": 5.95,
      "timePerCallMin": 17
    },
    {
      "endpoint": "POST /api/mkt/mensagem",
      "frequency": 29,
      "economyMin": 232,
      "economyHours": 3.87,
      "timePerCallMin": 8
    }
  ],
  "userActivityEndpoints": [
    {
      "user": "aloysio@microset.com.br",
      "totalRequests": 864,
      "economyHours": 37.58,
      "topEndpoints": [
        {
          "endpoint": "/home",
          "requests": 150
        },
        {
          "endpoint": "/api/login",
          "requests": 104
        },
        {
          "endpoint": "/api/mkt",
          "requests": 96
        },
        {
          "endpoint": "/host-ccs",
          "requests": 86
        },
        {
          "endpoint": "/result.js",
          "requests": 62
        }
      ]
    },
    {
      "user": "guest",
      "totalRequests": 141,
      "economyHours": 0.0,
      "topEndpoints": [
        {
          "endpoint": "/login",
          "requests": 51
        },
        {
          "endpoint": "/guest",
          "requests": 17
        },
        {
          "endpoint": "/api/mkt",
          "requests": 16
        },
        {
          "endpoint": "/host-ccs",
          "requests": 14
        },
        {
          "endpoint": "/",
          "requests": 11
        }
      ]
    }
  ],
  "userProductivity": [
    {
      "user": "aloysio@microset.com.br",
      "productiveActions": 106,
      "economyMin": 2255,
      "economyHours": 37.58
    },
    {
      "user": "guest",
      "productiveActions": 0,
      "economyMin": 0,
      "economyHours": 0.0
    }
  ],
  "productiveEndpoints": [
    {
      "endpoint": "POST /api/mkt",
      "frequency": 21,
      "economyMin": 1071,
      "economyHours": 17.85,
      "timePerCallMin": 51
    },
    {
      "endpoint": "POST /api/wiki",
      "frequency": 35,
      "economyMin": 595,
      "economyHours": 9.92,
      "timePerCallMin": 17
    },
    {
      "endpoint": "POST /api/comandos-oxidized/run",
      "frequency": 21,
      "economyMin": 357,
      "economyHours": 5.95,
      "timePerCallMin": 17
    },
    {
      "endpoint": "POST /api/mkt/mensagem",
      "frequency": 29,
      "economyMin": 232,
      "economyHours": 3.87,
      "timePerCallMin": 8
    }
  ],
  "dailyActivity": [
    {
      "date": "2026-02-02",
      "requests": 174
    },
    {
      "date": "2026-02-03",
      "requests": 21
    },
    {
      "date": "2026-02-04",
      "requests": 84
    },
    {
      "date": "2026-02-05",
      "requests": 103
    },
    {
      "date": "2026-02-06",
      "requests": 191
    }
  ]
};
