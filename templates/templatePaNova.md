## Sicoob {SINGULAR} - PA{NUM_PA} - {NOME_PA} - {VRF}

### Serviços

Link Ip Dedicado - {PARCEIRO}  
VCN Microset - VPN Concentrador Gary e Plankton para comunicação CCS x filial;

Roteador Mikrotik RB750GR3

Ether1 - WAN - Link Parceiro - {PARCEIRO}  
PPPoE - User={PPPOE_USER} Senha={PPPOE_PASS} - CGNAT  
Ether2 - Vago

Ether3 - Vago

Ether4 - Vago

Ether5 - {{IP_UNIDADE}}/30

L2TP - Gary  
IP Servidor.: 191.5.128.105  
Username.: {GARY_USER} / Senha.: {GARY_USER}  
IP.: {IP_GARY}  <===ALTERAR===>
L2TP - Plankton  
IP Servidor.: 45.160.230.105  
Username.: {PLANKTON_USER} / Senha.: {PLANKTON_USER}  
IP.: {IP_PLANKTON} <===ALTERAR===>

Router Cisco C1111

### interface GigabitEthernet0/0/0  
description WAN  
ip address {IP_UNIDADE_P1} 255.255.255.252  
negotiation auto  

### interface GigabitEthernet0/0/1  
description LAN  
ip address {IP_VALIDO} 255.255.255.254  
negotiation auto
