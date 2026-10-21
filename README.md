# Mario 3 — aventura para o navegador

Recriação independente inspirada em Super Mario Bros. 3, feita com Canvas 2D e Web Audio. Funciona como site estático no GitHub Pages, sem instalação, bibliotecas externas ou ROM.

## O que está incluído

- 48 fases próprias distribuídas em oito mundos, mapa e progresso salvo no navegador.
- Mario pequeno, Super Mario, flor de fogo e guaxinim, corrida, salto variável, voo e flutuação.
- Moedas, blocos, canos secretos, salas de bônus, inimigos, cascos carregáveis, chefes e cartas de fim de fase.
- Sete composições originais em estilo 8-bit, efeitos sintetizados e controles independentes de música, som e volume.
- Teclado, botões de toque, gamepad, pausa e tela cheia quando o navegador permite.

Esta é uma interpretação jogável, não uma cópia integral do cartucho: mapas, arte e composições foram produzidos para este projeto. Não inclui gravações, trilhas transcritas ou ROM da Nintendo. Recursos do original como dois jogadores, todas as roupas e todos os tipos de fase não estão implementados. Personagens e nomes pertencem aos respectivos titulares; projeto não oficial.

## Controles

| Ação | Teclado |
| --- | --- |
| Andar | Setas / A e D |
| Pular / nadar | Z / espaço |
| Correr / fogo / cauda / carregar casco | X / Shift |
| Abaixar / entrar em cano | ↓ / S |
| Entrar na fase pelo mapa | Enter / Z / espaço |
| Pausar | P / Esc |
| Som | M |
| Tela cheia | F |

Com a folha, corra até encher P, salte e pressione pular repetidamente para voar. Segure pular ao cair para planar. O som é habilitado após a primeira interação, conforme as regras dos navegadores. A Casa do Toad oferece um item por mundo; use-o no mapa. Gamepad: direcional, A, B e Start.

## Executar e publicar

Abra `index.html` ou sirva a pasta com qualquer servidor HTTP estático. Em GitHub → Settings → Pages, selecione **Deploy from a branch**, **main**, **/(root)** e salve. Nenhum build é necessário.

## Verificação

Com Node.js instalado:

```sh
node --test tests/*.test.cjs
```

Os testes verificam geração das 48 fases, colisões, salto variável, corrida, transformações, progressão, salvamento, renderização e agendamento/controle do áudio. A inspeção do navegador cobre início, mapa, entrada na fase e pausa; não equivale a uma campanha inteira concluída manualmente nem a uma comparação auditiva com o jogo original.

## Atualização visual e áudio local

A renderização usa uma superfície de 1536×1024 para o mesmo espaço de jogo de 384×256. Isso permite sprites do Mario com detalhes em meios pixels lógicos e texto mais nítido, sem alterar colisões, saltos ou progresso. Os cenários têm nuvens com rosto, colinas arredondadas, painéis com rebites, chão sem repetição de grama nas camadas inferiores e paisagens específicas por ambiente.

Em **Usar meu arquivo de música**, selecione MP3, OGG, WAV ou outro áudio compatível com seu navegador. A faixa substitui a música sintetizada durante a sessão e respeita pausa, volume e silêncio; os efeitos continuam funcionando. Não há upload nem armazenamento do arquivo no servidor. Reabra o arquivo após recarregar a página. A gravação original de Super Mario Bros. não está incluída; sua incorporação ao site depende de um arquivo fornecido com autorização de uso.
