# Atlas Arena — Stratégies autonomes

Globe 3D en HTML, CSS et JavaScript natifs avec Three.js et OrbitControls. Bibliothèques et géographie incluses dans `dist/` ; seules les polices Google sont facultativement chargées en ligne.

## Lancer

`npm start`, puis ouvrir http://localhost:4173. Node.js suffit : aucune installation npm. Servir en HTTP ; les modules ne peuvent pas être chargés en ouvrant le HTML en `file://`.

## Modes

- Duel : deux nations.
- Invasion : trois à huit nations alliées contre un vaisseau mère et une escadrille de dix chasseurs. Choisir la taille de la coalition dans « Nations ».
- Chacun pour soi : trois à huit nations, cibles choisies par les IA, alliances temporaires de 12 secondes et ruptures possibles.
- Équipes : quatre ou six nations, A/C/E contre B/D/F, sans tirs entre membres d’une équipe.
- Tournoi : quatre nations, deux demi-finales et une finale enchaînées automatiquement. Chaque manche réinitialise les ressources ; statistiques cumulées et tableau des résultats. Une égalité est départagée aux dégâts infligés.

Choisir un pays et un profil pour chaque emplacement (A à H pour huit nations). Cliquer sur une lettre puis dans la liste ou sur un marqueur est aussi possible. Sélectionner une nation déjà affectée échange les deux pays ; chaque profil reste attaché à son emplacement. La configuration est verrouillée pendant la partie. Réinitialiser pour la modifier.

### Flottes navales dans tous les modes

L’option « Déployer les flottes navales » active un bateau par nation, avec une route de patrouille dans l’Atlantique, le Pacifique ou l’océan Indien, choisie selon la proximité de la nation. Les routes sphériques restent en mer et sont vérifiées contre la géographie incluse. Les modèles 3D suivent la surface du globe, avec une coque aux couleurs de leur nation, une superstructure, un canon et un sillage. Les premiers tirs commencent après 12 s puis reviennent toutes les 14 s, sous réserve de 12 énergie disponible. Les missiles sont visibles au départ du bateau et peuvent être interceptés dans les modes entre nations. Ils infligent 8 dégâts de base (4 contre le vaisseau mère en Invasion). Les flottes respectent les équipes et les trêves lors du choix de leur cible ; une nation éliminée ne peut plus faire tirer son bateau. Pause, reset et tournoi s’appliquent aussi aux flottes. `naval.test.js` vérifie les routes en mer, les tirs périodiques, les alliances et les parties à huit nations.

## Stratégies et ressources

### Invasion : défense collective

L’option « Activer le bouclier planétaire au lancement » est réservée à l’Invasion et cochée dans l’interface. Elle déploie un véritable filet géodésique 3D de rayon 2,25 autour de la Terre (rayon 2) : fibres triangulaires, câbles de renfort, nœuds lumineux et membrane transparente. Un bouton « Terre · réserve/max » permet de couper ou réactiver le champ pendant une partie, y compris en pause, sans remplir gratuitement sa réserve. Les autres modes masquent cette option et le filet.

La réserve vaut 55 points par nation (165 à trois, 440 à huit). Elle absorbe les tirs ennemis avant les boucliers territoriaux ; seule la partie qui la dépasse atteint les défenses locales. Une impulsion ionique entièrement bloquée ne retire pas d’énergie à sa cible. Le filet émet des ondes au point d’impact, se teinte d’orange lorsqu’il faiblit et se dissipe quand sa réserve est épuisée. Il se recharge de 5 points/s après 10 s sans absorption, à raison d’un point d’énergie collective disponible par point restauré. Le rayon lourd et les faisceaux multiples s’arrêtent visuellement sur cette enveloppe lorsqu’ils sont bloqués. Pause et réinitialisation gèrent aussi les réserves et effets du filet ; les mouvements réduits suppriment la propagation des ondes. `planet-shield.test.js` vérifie l’absorption, les débordements, l’activation, l’énergie, la géométrie et des parties complètes à trois et huit nations.

Sélectionner **Invasion · 3 à 8 nations**, choisir le nombre de pays, leurs identités et leurs profils, puis cliquer sur **Défendre la Terre**. À trois nations, le vaisseau possède 520 PV répartis entre un canon (160), des moteurs (130) et un réacteur (230), protégés par 180 points de bouclier. La résistance des systèmes, le bouclier et le seuil d’interruption sont proportionnels à la taille de la coalition : à huit nations, 1 387 PV, 480 points de bouclier et 240 dégâts requis pour interrompre le rayon. Les missiles alliés ne ciblent que le vaisseau. Le laser ionique des satellites coûte 40 énergie pour cinq secondes : 12 dégâts/s au bouclier, puis 3 dégâts/s au réacteur lorsque le bouclier est épuisé. Chaque nation dispose de son propre satellite et du partage des radars ; les satellites peuvent être désactivés comme dans les autres modes.

Le vaisseau accélère et décélère pendant ses déplacements orbitaux, parcourt des arcs de patrouille entre les attaques et oscille en altitude avec du roulis et du tangage. Sa queue, ses nageoires et ses propulseurs accompagnent les manœuvres ; des moteurs détruits réduisent ces mouvements. Les points de tir et les trajectoires alliées suivent sa position 3D réelle. Les oscillations décoratives respectent la réduction des animations et tous les mouvements sont figés en pause.

Son arsenal alterne des faisceaux multiples, un rayon lourd, une salve plasma, une impulsion ionique, un bombardement puis un second rayon. Les faisceaux multiples chargent 7 s et frappent simultanément deux installations par nation vivante (13,5 dégâts de base par installation). Jusqu’à seize arcs violets (deux par nation) restent visibles 3,2 s et suivent des courbes 3D au-dessus du globe, y compris vers l’autre hémisphère. Les lignes suivent les points de sortie du vaisseau et restent figées en pause. Le plasma charge 5 s et lance quatre projectiles espacés avec environ 2 s de vol et interception possible. L’impulsion ionique charge 6 s, inflige 22 dégâts de base et retire jusqu’à 30 énergie même sous bouclier. Le bombardement charge 4 s ; le rayon lourd charge **10 secondes de simulation**. Les dégâts augmentent avec la durée du combat. Les couleurs des cibles et des effets distinguent chaque arme ; le HUD et le journal annoncent les nations menacées. Au moins un radar allié opérationnel révèle l’attaque dès le début ; sans radars, l’alerte arrive 3 s avant un rayon ou 1,5 s avant les autres tirs. Les IA n’anticipent pas une alerte encore inconnue.

Une escadrille de **dix chasseurs maximum** sort progressivement du vaisseau à partir de 7 s (un départ toutes les 2 s pour la première vague). Chaque chasseur possède 24 PV, rejoint une nation en 6 s puis tire toutes les 0,55 s : projectiles visibles, 0,5 s de vol, 1,8 dégât de base par tir. Les chasseurs changent indépendamment de région après leur passe d’attaque. Avec un radar, de l’énergie et des munitions, une nation peut infliger 12 dégâts à un chasseur avec un intercepteur ; deux touches l’abattent. Les pertes peuvent être remplacées toutes les 24 s après la première vague, sans dépasser dix chasseurs actifs. La fin de partie et la réinitialisation retirent l’escadrille et ses tirs ; la pause fige leurs déplacements, leurs tirs et leurs délais.

Le rayon lourd sort du canon frontal. Dès l’annonce, le Léviathan prend de l’altitude et pivote progressivement pour aligner son nez avec la cible terrestre ; il maintient cette orientation pendant le tir, puis reprend sa patrouille. Le faisceau 3D reste visible 2,6 s : cœur blanc, enveloppes rouges additives, halo à la bouche et onde d’impact sur le globe. Le tir reste attaché au nez pendant les mouvements. Une interruption conserve un retour progressif à l’orientation de croisière. La réduction des animations conserve la visée fonctionnelle et retire les transitions et pulsations décoratives.

Pendant une alerte, un profil défensif peut dépenser 28 énergie pour restaurer jusqu’à 32 points de bouclier chez la nation visée. Les offensives connues concentrent les missiles sur le canon : **90 dégâts réels au canon pendant les 10 s de charge**, ou sa destruction, interrompent le rayon et étourdissent le vaisseau pendant 7 s. Le seuil est relevé depuis 34 pour éviter les annulations systématiques ; les dégâts absorbés par le bouclier ennemi ne comptent pas. Un test de régression simule 40 parties standard et vérifie que le rayon tire dans la majorité des parties tout en restant interruptible. Les intercepteurs avec radar et munitions peuvent réduire les bombardements, mais ne bloquent pas le rayon.

- Canon détruit : seul le bombardement de secours reste disponible ; une charge d’arme avancée en cours est annulée.
- Moteurs détruits : déplacement et intervalle entre attaques allongés.
- Réacteur détruit : recharge du bouclier ennemi arrêtée (sinon 5 points/s après 8 s sans impact), impulsions ioniques et faisceaux multiples désactivés, y compris pendant leur charge.

Les dégâts ennemis augmentent avec la durée de l’invasion. Les profils défensifs réparent leurs sites et les opportunistes visent le réacteur. La destruction de tous les systèmes apporte une victoire à toute la coalition, même aux alliés déjà éliminés ; la défaite survient uniquement à la perte de la dernière nation. Le bilan détaille aussi les interruptions, le bouclier ennemi retiré et le soutien allié. Pause, vitesse, rejouer et réinitialiser gèrent l’ensemble de cet état. Le cadrage automatique suit le vaisseau et reste en vue globale pendant les tirs Titan pour garder les alertes lisibles ; glisser sur le globe permet de reprendre la caméra.

`dist/invasion-engine.js` contient la simulation indépendante et le mouvement orbital partagé avec `dist/invasion-visuals.js` (vaisseau, systèmes, satellites ioniques, zone d’alerte et HUD). `invasion-engine.test.js` vérifie les issues collectives, les dix secondes de charge, les interruptions, les coûts, les radars, les sous-systèmes, les profils, le reset et 120 parties à hasard reproductible, en complément des tests des modes existants.

Le vaisseau « Léviathan » est une baleine biomécanique à coque pleine, construite en géométrie 3D dans `dist/whale-mothership.js` : tête arrondie, corps effilé, nageoires volumétriques et queue à deux lobes. Une grille discrète évoque le globe et des fibres lumineuses épousent la surface bleu pétrole. Il mesure environ 6,2 unités pour une Terre de diamètre 4 et son centre orbite à 4,8 unités. Son canon est intégré sous la mâchoire, le réacteur affleure sur le dos et les moteurs se trouvent dans la queue. Les impacts visent ces parties et les systèmes détruits s’assombrissent. Le cadrage prend en compte la Terre et le vaisseau entier ; le zoom manuel libère le suivi. Les mouvements de nage respectent la préférence de réduction des animations. `whale-mothership.test.js` contrôle la géométrie, la fermeture de la coque, les normales, les dégâts et la réduction des animations.

### Affrontements entre nations

Chaque nation débute à 100 PV, 65 énergie et un bouclier territorial de 40 points. L’énergie remonte de 8 unités par seconde, jusqu’à 100. Les IA locales à règles et hasard choisissent entre armes, bouclier et réparations ; aucun modèle de langage ou service externe.

- Agressive : décisions plus rapides, privilégie les Titan quand l’énergie suffit.
- Défensive : privilégie les boucliers et les réparations lorsque menacée.
- Opportuniste : vise les cibles affaiblies ou à faible énergie, peut rompre une trêve en situation critique.

Toutes observent les interceptions et les boucliers pour adopter les Essaims. Une faible énergie adverse favorise les Titan. Les stratégies en cours sont visibles sur les cartes des nations.

| Action | Énergie | Effet de base |
|---|---:|---|
| Éclair | 22 | 12 dégâts, environ 2,7 secondes de trajet |
| Essaim | 55 | 20 missiles de 2 dégâts, quatre groupes de cinq espacés de 0,85 s |
| Titan | 62 | 38 dégâts, environ 5,8 secondes |
| Renforcement du bouclier | 28 | Restaure jusqu’à 32 points, sans dépasser 40 |
| Réparation | 35 | Restaure 14 PV |
| Tentative d’interception | 8 | Consomme une munition même en cas d’échec, contre-missile visible |

Les dégâts varient de ±10 % ; la défense et le type de projectile influencent les interceptions. Les nations sous 30 PV reçoivent une seule fois 35 énergie et un bonus de dégâts. Une frappe Titan en dernière offensive coûte aussi 5 PV à son auteur, sans l’éliminer. Après 75 secondes, la mort subite suspend les nouvelles réparations et boucliers, augmente la régénération et les dégâts, et réduit les interceptions pour faire aboutir la partie.

Chaque nation possède six intercepteurs. Une munition se recharge toutes les huit secondes de simulation ; un tir impose aussi un délai de 0,45 seconde au radar. Stock, rechargement et énergie limitent les tentatives. Le bouclier et le profil influencent le taux de réussite. Le stock et les délais sont affichés sur les cartes. Pause, réinitialisation et nouvelle manche gèrent aussi ces ressources.

## Satellites, boucliers et zones stratégiques

L’option « Satellites et lasers orbitaux », active par défaut, attribue un satellite 3D à chaque nation. Il part au-dessus de son pays, rejoint un ennemi sur une orbite, charge son laser puis tire un faisceau rouge pendant cinq secondes (4 dégâts/s), avant de poursuivre son orbite. Les alliés ne sont pas ciblés ; une trêve ou l’élimination arrête l’attaque. Pause et nouvelle manche gèrent les orbites et les lasers. La colonne Laser du bilan compte leurs dégâts réels aux PV.

Les satellites, les armes et le bouclier utilisent la même énergie. Le laser réserve **40 énergie** avant de commencer ; si nécessaire, l’IA économise ses tirs jusqu’à disposer de cette charge. Le bouclier absorbe d’abord les dégâts des missiles et lasers. Après six secondes sans impact, il recharge 2,5 points/s, en consommant une énergie par point ; sa vitesse est réduite en mort subite. Il est visible dès la préparation, à un rayon de **2,18 pour un globe de rayon 2**, avec une coque incurvée translucide, les contours exacts du jeu de données et des parois jusqu’au territoire. Sa luminosité suit sa charge ; il disparaît lorsqu’il est épuisé. Îles et trous des polygones sont respectés.

Au démarrage de la partie, trois sites apparaissent sur chaque pays participant, avec des bâtiments 3D, des étiquettes et leur état :

| Zone | PV | Conséquence de sa destruction |
|---|---:|---|
| ϟ Centrale | 32 | Production d’énergie divisée par deux |
| ◎ Radar | 28 | Intercepteurs bloqués |
| ▲ Base de missiles | 36 | Cadence ralentie de 70 %, Titan indisponible |

Les sites sont choisis à l’intérieur des territoires. Les trois premiers missiles d’un Essaim visent les trois sites ; les 17 autres restent répartis sur le territoire. Les armes unitaires ciblent une zone selon le profil de l’IA. Les satellites visent en priorité la centrale. Seuls les dégâts qui traversent le bouclier endommagent la zone touchée et les PV du pays. Une réparation IA restaure aussi 12 points à la zone la plus dégradée, et peut remettre un site en service.

Contre-mesures locales décidées par les IA lorsque l’orbite ennemie approche : brouillage (22 énergie, bloque les nouveaux verrouillages pendant 7 s, délai de réutilisation 22 s), et leurre (18 énergie, actif 9 s, délai 24 s). Un laser qui verrouille un leurre brûle ses 40 énergie et tire cinq secondes sans dégâts. Un brouilleur ne coupe pas rétroactivement un laser déjà engagé. Les temps de réutilisation sont affichés sur les cartes des nations. Les sites qui passent derrière le globe masquent leurs étiquettes pour éviter de les voir à travers la Terre.

## Caméra et spectacle

Les trois armes ont des tailles et traînées distinctes. L’option « Favoriser les salves de 20 », activée par défaut, donne priorité à l’Essaim lorsque l’IA dispose de l’énergie nécessaire ; elle peut toujours choisir une défense ou une réparation. Chaque groupe lance cinq missiles simultanément. Les vagues suivantes ne sont comptées comme des tirs qu’à leur décollage et sont annulées si la nation est éliminée ou signe une trêve avec sa cible. Les projectiles déjà en vol poursuivent leur trajectoire. Les points d’impact sont prélevés dans les polygones du territoire ennemi (hors eau et trous des polygones) ; les départs, hauteurs, durées et courbures varient également. Les trajectoires restent au-dessus de la sphère. Boucliers, réparations, missiles intercepteurs, explosions et ondes de choc sont animés. Les impacts produisent un léger tremblement bref du rendu, plafonné même en cas d’impacts simultanés. Le tremblement respecte le réglage système de réduction des animations et ne déplace pas les commandes. Seuls les missiles **Titan avec au moins 30 dégâts** déclenchent la caméra cinématique. Les Éclairs et Essaims ne la déclenchent jamais, y compris en mort subite. Une seule séquence à la fois, puis retour à la vue globale. Décochez « Caméra Titan uniquement » pour désactiver ces séquences ; elles sont désactivées par défaut si le système demande de réduire les animations.

Glisser sur le globe désactive le cadrage automatique et les séquences ; cocher « Cadrage auto » recentre les nations. Pause, vitesse ×1/×2/×4, zoom, plein écran et journal disponibles. Masquer l’onglet suspend la simulation. Le bilan affiche les dégâts, le taux d’impact, les interceptions, la meilleure série d’impacts consécutifs (réinitialisée par une interception), les PV réparés et la frappe la plus forte. Les statistiques du tournoi se cumulent entre les manches.

## Vérifier

`npm test` : 300 parties réparties entre duel, chacun pour soi et équipes ; ressources valides, absence de tirs alliés, fin de partie, pause, armes, défenses, diplomatie, tournoi et critère strict de caméra. Les tests vérifient aussi les quatre vagues de cinq, la diversité des cibles, les lasers de cinq secondes, la recharge du bouclier, les zones et contre-mesures, les limites et délais des intercepteurs, l’annulation des vagues non lancées et les points à l’intérieur des territoires. `npm run check` : syntaxe des modules.

## Données et licences

Simulation fictive, sans modélisation des capacités militaires réelles. Les capitales servent de points d’ancrage visuels. Le tracé simplifié Natural Earth contient 180 entités et peut omettre des micro-États.

- Three.js 0.170.0 (MIT, licence dans `dist/vendor/THREE-LICENSE.txt`) : https://github.com/mrdoob/three.js
- Géographie Natural Earth (domaine public) : https://github.com/johan/world.geo.json
- Polices DM Sans et Manrope : Google Fonts.

`dist/app.js` : pays et globe. `dist/battle-engine.js` : règles et tournoi. `dist/arena.js` : interface, effets et caméra. `dist/arena.css` : présentation du jeu. `dist/territory.js` : échantillonnage des points dans les pays. `dist/orbital.js` : mouvement orbital. `dist/orbital-visuals.js` : satellites, lasers et boucliers. `dist/shield-geometry.js` : coque territoriale surélevée. `dist/zone-visuals.js` : sites stratégiques et étiquettes.
