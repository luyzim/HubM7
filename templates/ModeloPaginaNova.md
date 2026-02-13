<div style="border:1px solid #555; display:inline-block; padding:6px 10px; margin:10px 0;">
    <div style="margin-bottom:4px;">
        <strong>Índice</strong> <span style="font-size:10px;">[ocultar]</span>
    </div>
    <ul style="margin:0; padding-left:18px; font-size:15px;">
        <li><a href="#escopo-projeto">Escopo Projeto</a></li>
        <li><a href="#observacoes">Observações</a></li>
        <li><a href="#vrf-rede-interconexao">VRF + Rede de Interconexão</a></li>
        <li><a href="#sicoob-xxxxx-paxx-internet">Sicoob XXXX - PAXX - XXXXXX - Internet</a></li>
    </ul>
</div>

<h2 id="escopo-projeto"style="color: #4682B4; font-weight: bold;">Escopo Projeto</h2>

<div style="border:1px solid #555; padding:6px 10px; margin:10px 0;">
Interligar CCS + X unidades através da VCN Microset (Túneis L2TP) utilizando links dedicados e/ou banda larga e/ou MPLS, para comunicação entre as mesmas.
</div>

<div style="border:1px solid #555; padding:6px 10px; margin:10px 0;">
Unidades fecham túneis L2TP com os concentradores Gary e Plankton.
</div>

<div style="border:1px solid #555; padding:6px 10px; margin:10px 0;">
A navegação vai ser realizada via Ip valido /31 entregue para cliente no caso de PA com Internet
</div>

<div style="border:1px solid #555; padding:6px 10px; margin:10px 0;">
Nesse cliente em especifico, escopo é de ONU Parceiro - Mikrotik 750 Microset + Cisco C1111, conectado diretamente no Fortigate da CCS
</div>

<div style="border:1px solid #555; padding:6px 10px; margin:10px 0;">
No Cisco, temos configurações padrão como Banner, Ntp Snmp e Vty.
</div>

<div style="border:1px solid #555; padding:6px 10px; margin:10px 0;">
Como esse cliente topologia do VCN se atentar para NÃO ALTERAR O IDENTITY/HOSTNAME/NOME do roteador mikrotik pois dessa maneira em caso de quedas os túneis não sobem e o acesso e comunicação será 
perdido.
</div>


<h2 id="observacoes">Observações</h2>

<div style="border:1px solid #555; padding:6px 10px; margin:10px 0;">
Backup, via script no FTP e Oxidized configurado.
</div>

<h2 id="vrf-rede-interconexao">VRF + Rede de Interconexão</h2>

<div style="border:1px solid #555; padding:6px 10px; margin:10px 0;">
VRF.: SICOOB-XXXXX-CCS-INTERNET </br>
RD.: 41392:174 </br>
VRF.: SICOOB-XXXXX-CCS-MPLS </br>
RD.: 41392:175
</div>

<div style="border:1px solid #555; padding:6px 10px; margin:10px 0;">
Faixas de Rede.: </br>
</div>
