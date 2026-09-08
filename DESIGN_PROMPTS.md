# Net Scraper — Prompts de geração visual (estética cyberpunk anime)

Direção de arte: anime cyberpunk noturno estilo Studio Trigger/Cyberpunk
Edgerunners — paleta preto/azul-escuro com neon ciano, magenta e amarelo
sinalizador, linework dinâmico, glitch digital, HUD holográfico. Os prompts
abaixo descrevem **estilo e composição genéricos** (não personagens
protegidos por direito autoral) — pra gerar em Midjourney/SDXL/Runway/etc.
sem reproduzir IP de terceiro.

## Paleta de referência (usar em todo prompt)
`neon cyan #05D9E8, hot magenta #FF2A6D, signal yellow #F9F002, near-black background #0D0F14, cool blue shadow tones`

---

## 1. Logo / ícone do app

> Minimalist cyberpunk hacker glyph logo, a stylized eye merged with a
> network/graph node structure, neon cyan linework on near-black
> background, thin glowing outline, flat vector anime style, no text,
> centered, high contrast, transparent background

## 2. Favicon (versão simplificada do logo, 1 cor só)

> Ultra-minimal single-color glyph icon, angular geometric eye/node hybrid
> shape, neon cyan on transparent background, readable at 16x16px, flat
> vector, no gradients, no text

## 3. Hero / imagem de fundo da tela inicial

> Wide cinematic shot of a dense neon-lit megacity at night, anime
> cyberpunk art style, dynamic cel-shaded linework, rain-slicked streets
> reflecting neon signs in cyan/magenta/yellow, holographic billboards
> with glitch distortion, low camera angle looking up at towering
> skyscrapers, moody atmospheric fog, Studio Trigger-inspired dynamic
> composition, no characters, no readable logos or brand names

## 4. Tela de "boot"/carregamento do sistema

> Anime-style hacker terminal interface close-up, glitching holographic
> UI panels with scan lines, cascading code fragments in neon green and
> cyan, glowing progress bar, angular HUD frame elements, dark background,
> high-tech minimalist composition, no readable text/logos

## 5. Ícones de seção (Username / Email / Telefone / Domínio / Cripto / Grafo / Casos)

Prompt base (repetir trocando o `[ÍCONE]`):

> Single flat-vector cyberpunk HUD icon of [ÍCONE], neon cyan glowing
> outline on transparent background, angular sci-fi style, thin geometric
> linework, minimalist, no text, consistent icon set style

- `[ÍCONE]` = "a fingerprint merged with a circuit trace" (Username)
- `[ÍCONE]` = "an envelope with a digital signal wave" (Email)
- `[ÍCONE]` = "a phone handset with radiating signal arcs" (Telefone)
- `[ÍCONE]` = "a globe wireframe with a targeting reticle" (Domínio/IP)
- `[ÍCONE]` = "a hexagonal coin with a blockchain link chain" (Cripto)
- `[ÍCONE]` = "interconnected nodes forming a neural network" (Grafo)
- `[ÍCONE]` = "a case file folder with a holographic lock" (Casos)

## 6. Textura de fundo (scanline / glitch overlay, opcional — dá pra fazer só em CSS também)

> Seamless tileable texture of subtle CRT scan lines with faint chromatic
> aberration noise, very dark near-black base, barely visible neon cyan
> tint, high resolution, for UI background overlay use

## 7. Animação de vídeo — transição entre telas (loop curto, 2-3s)

> Short seamless loop animation: a glitch/digital distortion wipe
> transition, neon cyan and magenta scan lines sweeping across frame,
> quick chromatic aberration flicker, cyberpunk anime aesthetic, dark
> background, no characters, no text, 2-3 second loop, vertical and
> horizontal versions

## 8. Animação de vídeo — fundo ambiente da tela de login/splash (loop longo)

> Looping ambient animation: slow parallax pan across a neon cyberpunk
> city skyline at night, anime cel-shaded style, drifting rain and neon
> reflections, holographic ad panels flickering intermittently, subtle
> fog movement, seamless loop, no characters, moody atmosphere,
> 10-15 second loop

---

## Onde usar cada asset no app

| Asset | Local no código |
|---|---|
| Logo/favicon | `frontend/app/icon.png` (App Router favicon convention), header do `page.tsx` |
| Hero/background | Fundo da página (`body`/`main`), com overlay escuro pra não atrapalhar leitura |
| Ícones de seção | Ao lado do label de cada aba em `Tabs.tsx` |
| Scanline overlay | Camada CSS `::before` fixa sobre o app inteiro (baixa opacidade) |
| Vídeo de transição | Entre troca de aba (Framer Motion / CSS view-transition) |
| Vídeo de fundo splash | `<video autoplay muted loop>` atrás do header, se quiser ir além do CSS puro |

## Nota sobre estilo vs. IP

Os prompts acima descrevem **gênero e técnica de arte** (anime cyberpunk,
cel-shading, paleta neon, HUD holográfico) — isso é estilo, não propriedade
intelectual de ninguém. Evite incluir nomes de personagens/obras
específicas (ex: "David Martinez", "Lucy", "estilo Cyberpunk Edgerunners
exato") nos prompts de geração pra não sair pedindo reprodução de design
protegido por direito autoral.
