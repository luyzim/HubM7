## Caiponia - Loja

### NETWORKS

### Tunnel Core
- 10.24.60.184 - Network
- 10.24.60.185 - Tunnel Core 1
- 10.24.60.186 - Tunnel MKT - Graneleiro

### STARLINK - WAN
- 10.24.60.180 - Network
- 10.24.60.181 - Sonicwall - STARLINK
- 10.24.60.182 - MKT - STARLINK

### MPLS - M7 / Parceiro - Fibra/Rádio
#### Sonicwall X2
- 10.22.254.76 - Network
- 10.22.254.78 - MTK - Graneleiro
- 10.22.254.77 - Sonicwall - MPLS - X2

### MPLS - STARLINK
#### Sonicwall X4
- 10.24.60.188 - Network
- 10.24.60.189 - MKT - STARLINK
- 10.24.60.190 - Sonicwall - MPLS - X4




No dia de ontem foi feito a criação de grupos de templates de backbone para inserção automatica no oxidized.
Feito grupos genericos para servirem para todos os cassos de bbone.
Feito a troca de permição do grupo de monitoramento oara que o mesmo consiga acessar e interagir com as rotas protegidas pelo ensureN2.
feito a correção no script de MKT onde o ip de gary e plankton estam indo ja calculados no address e tinha que ser final 1.
Refeito a função que calculava e açterava o status da variavel.
