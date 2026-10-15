# Atlas Arena — Stratégies autonomes

Globe 3D en HTML, CSS et JavaScript natifs avec Three.js et OrbitControls. Bibliothèques et géographie incluses dans `dist/` ; seules les polices Google sont facultativement chargées en ligne.

## Lancer

`npm start`, puis ouvrir http://localhost:4173. Node.js suffit : aucune installation npm. Servir en HTTP ; les modules ne peuvent pas être chargés en ouvrant le HTML en `file://`.

## Modes

- Duel : deux nations.
- Chacun pour soi : trois à six nations, cibles choisies par les IA, alliances temporaires de 12 secondes et ruptures possibles.
- Équipes : quatre ou six nations, A/C/E contre B/D/F, sans tirs entre membres d’une équipe.
- Tournoi : quatre nations, deux demi-finales et une finale enchaînées automatiquement. Chaque manche réinitialise les ressources ; statistiques cumulées et tableau des résultats. Une égalité est départagée aux dégâts infligés.

Choisir un pays et un profil pour chaque emplacement. Cliquer sur une lettre puis dans la liste ou sur un marqueur est aussi possible. Sélectionner une nation déjà affectée échange les deux pays ; chaque profil reste attaché à son emplacement. La configuration est verrouillée pendant la partie. Réinitialiser pour la modifier.

## Stratégies et ressources

Chaque nation débute à 100 PV et 65 énergie. L’énergie remonte de 8 unités par seconde, jusqu’à 100. Les IA locales à règles et hasard choisissent entre armes, bouclier et réparations ; aucun modèle de langage ou service externe.

- Agressive : décisions plus rapides, privilégie les Titan quand l’énergie suffit.
- Défensive : privilégie les boucliers et les réparations lorsque menacée.
- Opportuniste : vise les cibles affaiblies ou à faible énergie, peut rompre une trêve en situation critique.

Toutes observent les interceptions et les boucliers pour adopter les Essaims. Une faible énergie adverse favorise les Titan. Les stratégies en cours sont visibles sur les cartes des nations.

| Action | Énergie | Effet de base |
|---|---:|---|
| Éclair | 22 | 12 dégâts, environ 2,7 secondes de trajet |
| Essaim | 55 | 20 missiles de 2 dégâts, quatre groupes de cinq espacés de 0,85 s |
| Titan | 62 | 38 dégâts, environ 5,8 secondes |
| Bouclier | 28 | Absorbe 32 dégâts, diminue progressivement |
| Réparation | 35 | Restaure 14 PV |
| Tentative d’interception | 8 | Consomme une munition même en cas d’échec, contre-missile visible |

Les dégâts varient de ±10 % ; la défense et le type de projectile influencent les interceptions. Les nations sous 30 PV reçoivent une seule fois 35 énergie et un bonus de dégâts. Une frappe Titan en dernière offensive coûte aussi 5 PV à son auteur, sans l’éliminer. Après 75 secondes, la mort subite suspend les nouvelles réparations et boucliers, augmente la régénération et les dégâts, et réduit les interceptions pour faire aboutir la partie.

Chaque nation possède six intercepteurs. Une munition se recharge toutes les huit secondes de simulation ; un tir impose aussi un délai de 0,45 seconde au radar. Stock, rechargement et énergie limitent les tentatives. Le bouclier et le profil influencent le taux de réussite. Le stock et les délais sont affichés sur les cartes. Pause, réinitialisation et nouvelle manche gèrent aussi ces ressources.

## Caméra et spectacle

Les trois armes ont des tailles et traînées distinctes. L’option « Favoriser les salves de 20 », activée par défaut, donne priorité à l’Essaim lorsque l’IA dispose de l’énergie nécessaire ; elle peut toujours choisir une défense ou une réparation. Chaque groupe lance cinq missiles simultanément. Les vagues suivantes ne sont comptées comme des tirs qu’à leur décollage et sont annulées si la nation est éliminée ou signe une trêve avec sa cible. Les projectiles déjà en vol poursuivent leur trajectoire. Les points d’impact sont prélevés dans les polygones du territoire ennemi (hors eau et trous des polygones) ; les départs, hauteurs, durées et courbures varient également. Les trajectoires restent au-dessus de la sphère. Boucliers, réparations, missiles intercepteurs, explosions et ondes de choc sont animés. Les impacts produisent un léger tremblement bref du rendu, plafonné même en cas d’impacts simultanés. Le tremblement respecte le réglage système de réduction des animations et ne déplace pas les commandes. Seuls les missiles **Titan avec au moins 30 dégâts** déclenchent la caméra cinématique. Les Éclairs et Essaims ne la déclenchent jamais, y compris en mort subite. Une seule séquence à la fois, puis retour à la vue globale. Décochez « Caméra Titan uniquement » pour désactiver ces séquences ; elles sont désactivées par défaut si le système demande de réduire les animations.

Glisser sur le globe désactive le cadrage automatique et les séquences ; cocher « Cadrage auto » recentre les nations. Pause, vitesse ×1/×2/×4, zoom, plein écran et journal disponibles. Masquer l’onglet suspend la simulation. Le bilan affiche les dégâts, le taux d’impact, les interceptions, la meilleure série d’impacts consécutifs (réinitialisée par une interception), les PV réparés et la frappe la plus forte. Les statistiques du tournoi se cumulent entre les manches.

## Vérifier

`npm test` : 300 parties réparties entre duel, chacun pour soi et équipes ; ressources valides, absence de tirs alliés, fin de partie, pause, armes, défenses, diplomatie, tournoi et critère strict de caméra. Les tests vérifient aussi les quatre vagues de cinq, la diversité des cibles, les limites et délais des intercepteurs, l’annulation des vagues non lancées et les points à l’intérieur des territoires. `npm run check` : syntaxe des modules.

## Données et licences

Simulation fictive, sans modélisation des capacités militaires réelles. Les capitales servent de points d’ancrage visuels. Le tracé simplifié Natural Earth contient 180 entités et peut omettre des micro-États.

- Three.js 0.170.0 (MIT, licence dans `dist/vendor/THREE-LICENSE.txt`) : https://github.com/mrdoob/three.js
- Géographie Natural Earth (domaine public) : https://github.com/johan/world.geo.json
- Polices DM Sans et Manrope : Google Fonts.

`dist/app.js` : pays et globe. `dist/battle-engine.js` : règles et tournoi. `dist/arena.js` : interface, effets et caméra. `dist/arena.css` : présentation du jeu. `dist/territory.js` : échantillonnage des points dans les pays.
