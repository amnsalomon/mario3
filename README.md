# Mario 3 — aventura para o navegador

Recriação independente inspirada em Super Mario Bros. 3, feita com Canvas 2D e Web Audio. Funciona como site estático no GitHub Pages, sem instalação, bibliotecas externas ou ROM.

## O que está incluído

- **8 mundos com 48 fases próprias**, cada uma de um tipo do SMB3: planície, colinas com blocos coloridos, subterrâneo, deserto com areia movediça e pirâmides, ilhas, fases debaixo d'água, Terra Gigante (blocos e inimigos em dobro), céu com nuvens e plataformas móveis, gelo escorregadio, labirinto de canos com atalhos, Terra Sombria com lava, fortalezas, naves e tanques com rolagem automática, e o castelo final.
- **Mapa caminhável** por mundo, com painéis numerados, Casa do Toad, fortaleza e nave. Fase concluída vira um painel M e não se repete; é preciso concluir a fase para seguir adiante.
- **Física com os valores documentados do SMB3**: andar 1,5 px/quadro, correr 2,5 e 3,5 só com o medidor P cheio; pulo mais alto segurando o botão e mais alto ainda em velocidade; medidor P de 7 setas; voo do guaxinim por cerca de 4 segundos; queda freada pela cauda; nado; gelo escorregadio; areia movediça.
- **Regras do SMB3**:
  - dano devolve o Fogo/Guaxinim a Super Mario e o Super a pequeno;
  - pisões seguidos valem 100, 200, 400… 8000 e depois vidas;
  - o relógio anda 0,68 s por unidade e a música acelera abaixo de 100;
  - sobra de tempo vale 50 pontos por unidade;
  - começa com 4 vidas, e 100 moedas dão uma vida;
  - roleta de cartas no fim da fase, com 3 cartas valendo 1 vida e 3 iguais valendo 2, 3 ou 5;
  - Casa do Toad com 3 baús e inventário de até 28 itens;
  - morrer volta ao mapa;
  - game over recomeça o mundo, mantendo as fortalezas destruídas.
- **Chefes**: o das fortalezas, naves e tanques cai com 3 pisões e solta uma esfera que encerra a fase. No castelo final, o Bowser quebra o chão de tijolos ao cair com força.
- Canos secretos com sala bônus, blocos invisíveis, cascos carregáveis, canhões que atiram (e podem ser pisados), plantas que saem dos canos.
- Teclado, botões de toque (com layout próprio para celular deitado), controle de videogame, pausa e tela cheia.

As fases, os cenários e as trilhas sintetizadas foram produzidos para este projeto. Os desenhos de fase não copiam os mapas originais. Personagens e nomes pertencem aos respectivos titulares; projeto não oficial.

## Controles

| Ação | Teclado | Controle |
| --- | --- | --- |
| Andar / andar no mapa | Setas ou A e D | Direcional |
| Pular / nadar / entrar na fase | Z, espaço ou K | A |
| Correr / fogo / cauda / carregar casco / abrir itens no mapa | X, Shift ou J | B ou X |
| Abaixar / entrar em cano | ↓ ou S | Baixo |
| Entrar na fase / pausar na fase | Enter | Start |
| Pausar | P ou Esc | Start |
| Som | M | — |
| Tela cheia | F | — |

Com a Folha, corra até encher o P, pule e aperte pular repetidamente para voar. Na queda, toque pular várias vezes para planar.

## Música

A pasta `music/` contém `map.mp3`, que toca no mapa e na tela inicial; nas fases tocam as trilhas sintetizadas próprias. Dá para associar outros arquivos a outros momentos do jogo em `js/music-config.js` (veja `music/LEIA-ME.txt`). Se um arquivo faltar, o jogo volta sozinho à trilha sintetizada.

**Atenção aos direitos:** `map.mp3` é uma gravação comercial da trilha original. Publicar esse arquivo num repositório ou site público pode gerar pedido de remoção por direitos autorais. Para publicar sem ele, apague `music/map.mp3` e a linha `map` de `js/music-config.js`. Cada jogador também pode usar o próprio arquivo pelo menu **Usar meu arquivo de música**, que toca só no navegador dele.

## Executar e publicar

Abra `index.html` ou sirva a pasta com qualquer servidor HTTP estático. Para publicar pelo GitHub Desktop:

1. Copie o conteúdo desta pasta para a pasta do repositório.
2. Faça o commit e o push.
3. No GitHub, vá em **Settings → Pages**, escolha **Deploy from a branch**, **main**, **/(root)** e salve.

Nenhum build é necessário.

## Verificação

Com Node.js instalado:

```sh
node --test tests/*.test.cjs
```

São 46 testes. Eles cobrem:

- geração e validação das 48 fases;
- velocidades, pulo e medidor P;
- regras de dano, power-ups, pontuação em cadeia, relógio, cartas e Casa do Toad;
- mapa, save e game over;
- sala bônus, canos de atalho, areia movediça, água, rolagem automática e chefes;
- áudio, música em arquivo e renderização.

O teste `playability` usa um robô de busca com a física real do jogo para provar que as 48 fases podem ser completadas (leva cerca de 30 segundos). Para rodá-lo sozinho e ver o resultado de cada fase: `node tests/bot.cjs`.

## Estrutura

| Arquivo | Papel |
| --- | --- |
| `js/levels.js` | Gerador determinístico das fases e da sala bônus |
| `js/engine.js` | Física, regras, mapa, Casa do Toad, chefes e save |
| `js/sprites.js` | Desenhos em pixel art feitos por código, com cache de imagens |
| `js/scenery.js` | Cenários de fundo em camadas |
| `js/renderer.js` | Desenho da fase, do mapa, da Casa do Toad e do HUD |
| `js/audio.js` | Trilhas e efeitos sintetizados |
| `js/tracks.js` e `js/music-config.js` | Faixas em arquivo da pasta `music/` |
| `js/local-music.js` | Arquivo de música escolhido pelo jogador |
| `js/app.js` | Controles, interface e salvamento |
