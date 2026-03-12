export const reportData = {
  "kpis": {
    "totalRequests": 2311,
    "distinctUsers": 19,
    "productiveActions": 607,
    "navigationActions": 635,
    "totalEconomyMin": 21957,
    "totalEconomyHours": 365.95
  },
  "summary": {
    "totalRequests": 2311,
    "totalUsers": 19,
    "productiveActions": 607,
    "navigationActions": 635,
    "totalEconomyHours": 365.95,
    "totalEconomyMin": 21957,
    "pythonLogs": 0,
    "bridgeLogs": 0
  },
  "statusDistribution": {
    "302": 171,
    "200": 1142,
    "304": 678,
    "404": 69,
    "401": 205,
    "500": 31,
    "403": 11,
    "400": 1,
    "202": 3
  },
  "endpointEconomy": [
    {
      "endpoint": "/api/mkt",
      "frequency": 300,
      "economyMin": 15300,
      "economyHours": 255.0,
      "timePerCallMin": 51
    },
    {
      "endpoint": "/api/ccsFortgate",
      "frequency": 124,
      "economyMin": 2852,
      "economyHours": 47.53,
      "timePerCallMin": 23
    },
    {
      "endpoint": "/api/comandos-mkt/scan-super",
      "frequency": 61,
      "economyMin": 1525,
      "economyHours": 25.42,
      "timePerCallMin": 25
    },
    {
      "endpoint": "/api/comandos-oxidized/run",
      "frequency": 85,
      "economyMin": 1445,
      "economyHours": 24.08,
      "timePerCallMin": 17
    },
    {
      "endpoint": "/api/4g",
      "frequency": 25,
      "economyMin": 625,
      "economyHours": 10.42,
      "timePerCallMin": 25
    },
    {
      "endpoint": "/api/unimed",
      "frequency": 10,
      "economyMin": 150,
      "economyHours": 2.5,
      "timePerCallMin": 15
    },
    {
      "endpoint": "/api/bkpMkt",
      "frequency": 2,
      "economyMin": 60,
      "economyHours": 1.0,
      "timePerCallMin": 30
    }
  ],
  "userActivityEndpoints": [
    {
      "user": "deiver@microset.com",
      "totalRequests": 232,
      "economyHours": 85.95,
      "topEndpoints": [
        {
          "endpoint": "/api/mkt",
          "requests": 94
        },
        {
          "endpoint": "/home",
          "requests": 42
        },
        {
          "endpoint": "/api/login",
          "requests": 21
        },
        {
          "endpoint": "/api/cisco",
          "requests": 21
        },
        {
          "endpoint": "/result.js",
          "requests": 16
        }
      ]
    },
    {
      "user": "nando@microset.com",
      "totalRequests": 283,
      "economyHours": 78.32,
      "topEndpoints": [
        {
          "endpoint": "/api/mkt",
          "requests": 75
        },
        {
          "endpoint": "/home",
          "requests": 50
        },
        {
          "endpoint": "/result.js",
          "requests": 48
        },
        {
          "endpoint": "/api/ccsFortgate",
          "requests": 38
        },
        {
          "endpoint": "/api/tabela/ips",
          "requests": 19
        }
      ]
    },
    {
      "user": "aloysio@microset.com",
      "totalRequests": 512,
      "economyHours": 61.48,
      "topEndpoints": [
        {
          "endpoint": "/api/oxidized/generate",
          "requests": 87
        },
        {
          "endpoint": "/api/comandos-oxidized/run",
          "requests": 82
        },
        {
          "endpoint": "/home",
          "requests": 64
        },
        {
          "endpoint": "/api/ccsFortgate",
          "requests": 37
        },
        {
          "endpoint": "/api/login",
          "requests": 28
        }
      ]
    },
    {
      "user": "n2",
      "totalRequests": 145,
      "economyHours": 46.3,
      "topEndpoints": [
        {
          "endpoint": "/api/mkt",
          "requests": 48
        },
        {
          "endpoint": "/home",
          "requests": 26
        },
        {
          "endpoint": "/api/login",
          "requests": 20
        },
        {
          "endpoint": "/api/4g",
          "requests": 12
        },
        {
          "endpoint": "/api/cisco",
          "requests": 10
        }
      ]
    },
    {
      "user": "saba@microset.com",
      "totalRequests": 120,
      "economyHours": 27.63,
      "topEndpoints": [
        {
          "endpoint": "/api/mkt",
          "requests": 28
        },
        {
          "endpoint": "/home",
          "requests": 16
        },
        {
          "endpoint": "/api/login",
          "requests": 14
        },
        {
          "endpoint": "/api/cisco",
          "requests": 12
        },
        {
          "endpoint": "/result.js",
          "requests": 11
        }
      ]
    }
  ],
  "userProductivity": [
    {
      "user": "deiver@microset.com",
      "productiveActions": 111,
      "economyMin": 5157,
      "economyHours": 85.95
    },
    {
      "user": "nando@microset.com",
      "productiveActions": 113,
      "economyMin": 4699,
      "economyHours": 78.32
    },
    {
      "user": "aloysio@microset.com",
      "productiveActions": 164,
      "economyMin": 3689,
      "economyHours": 61.48
    },
    {
      "user": "n2",
      "productiveActions": 61,
      "economyMin": 2778,
      "economyHours": 46.3
    },
    {
      "user": "saba@microset.com",
      "productiveActions": 38,
      "economyMin": 1658,
      "economyHours": 27.63
    },
    {
      "user": "matheus@microset.com",
      "productiveActions": 40,
      "economyMin": 1620,
      "economyHours": 27.0
    },
    {
      "user": "luan.tonetto@microset.com.br",
      "productiveActions": 13,
      "economyMin": 523,
      "economyHours": 8.72
    },
    {
      "user": "n1",
      "productiveActions": 20,
      "economyMin": 500,
      "economyHours": 8.33
    },
    {
      "user": "guest",
      "productiveActions": 12,
      "economyMin": 416,
      "economyHours": 6.93
    },
    {
      "user": "ana.costa@microset.net.br",
      "productiveActions": 12,
      "economyMin": 300,
      "economyHours": 5.0
    }
  ],
  "productiveEndpoints": [
    {
      "endpoint": "/api/mkt",
      "frequency": 300,
      "economyMin": 15300,
      "economyHours": 255.0,
      "timePerCallMin": 51
    },
    {
      "endpoint": "/api/ccsFortgate",
      "frequency": 124,
      "economyMin": 2852,
      "economyHours": 47.53,
      "timePerCallMin": 23
    },
    {
      "endpoint": "/api/comandos-mkt/scan-super",
      "frequency": 61,
      "economyMin": 1525,
      "economyHours": 25.42,
      "timePerCallMin": 25
    },
    {
      "endpoint": "/api/comandos-oxidized/run",
      "frequency": 85,
      "economyMin": 1445,
      "economyHours": 24.08,
      "timePerCallMin": 17
    },
    {
      "endpoint": "/api/4g",
      "frequency": 25,
      "economyMin": 625,
      "economyHours": 10.42,
      "timePerCallMin": 25
    },
    {
      "endpoint": "/api/unimed",
      "frequency": 10,
      "economyMin": 150,
      "economyHours": 2.5,
      "timePerCallMin": 15
    },
    {
      "endpoint": "/api/bkpMkt",
      "frequency": 2,
      "economyMin": 60,
      "economyHours": 1.0,
      "timePerCallMin": 30
    }
  ],
  "dailyActivity": [
    {
      "date": "2026-01-01",
      "requests": 18
    },
    {
      "date": "2026-01-02",
      "requests": 21
    },
    {
      "date": "2026-01-03",
      "requests": 28
    },
    {
      "date": "2026-01-04",
      "requests": 12
    },
    {
      "date": "2026-01-05",
      "requests": 10
    },
    {
      "date": "2026-01-06",
      "requests": 67
    },
    {
      "date": "2026-01-07",
      "requests": 66
    },
    {
      "date": "2026-01-08",
      "requests": 45
    },
    {
      "date": "2026-01-09",
      "requests": 63
    },
    {
      "date": "2026-01-10",
      "requests": 2
    },
    {
      "date": "2026-01-11",
      "requests": 18
    },
    {
      "date": "2026-01-12",
      "requests": 217
    },
    {
      "date": "2026-01-13",
      "requests": 149
    },
    {
      "date": "2026-01-14",
      "requests": 146
    },
    {
      "date": "2026-01-15",
      "requests": 112
    },
    {
      "date": "2026-01-16",
      "requests": 76
    },
    {
      "date": "2026-01-18",
      "requests": 2
    },
    {
      "date": "2026-01-19",
      "requests": 61
    },
    {
      "date": "2026-01-20",
      "requests": 44
    },
    {
      "date": "2026-01-21",
      "requests": 109
    },
    {
      "date": "2026-01-22",
      "requests": 58
    },
    {
      "date": "2026-01-23",
      "requests": 89
    },
    {
      "date": "2026-01-24",
      "requests": 1
    },
    {
      "date": "2026-01-25",
      "requests": 23
    },
    {
      "date": "2026-01-26",
      "requests": 170
    },
    {
      "date": "2026-01-27",
      "requests": 216
    },
    {
      "date": "2026-01-28",
      "requests": 127
    },
    {
      "date": "2026-01-29",
      "requests": 205
    },
    {
      "date": "2026-01-30",
      "requests": 127
    },
    {
      "date": "2026-01-31",
      "requests": 29
    }
  ]
};
