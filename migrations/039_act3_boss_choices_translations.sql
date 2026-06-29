-- Миграция: добавление переводов для восстановленных выборов Патриарха.

UPDATE public.choices
SET translations = '{
  "en": {
    "label": "🔥 [WEAPON] Incinerate the Patriarch with the Heavy Plasma Cutter",
    "narrative_override": "You activate the plasma cutter at full power. A blinding beam pierces the monster''s chitin and tissues through and through. The creature falls dead. From its skull you extract the surviving Royal Quantum Provider!"
  },
  "es": {
    "label": "🔥 [ARMA] Incinerar al Patriarca con la Sierra de Plasma Pesada",
    "narrative_override": "Activas la sierra de plasma a plena potencia. Un rayo cegador atraviesa el quitino y los tejidos del monstruo de parte a parte. La criatura cae muerta. ¡De su cráneo extraes el Proveedor Cuántico de la Colonia superviviente!"
  },
  "de": {
    "label": "🔥 [WAFFE] Patriarch mit dem schweren Plasmaschneider ausbrennen",
    "narrative_override": "Du aktivierst den Plasmaschneider mit voller Leistung. Ein blendender Strahl durchbohrt Chitin und Gewebe des Monsters. Das Wesen fällt tot um. Aus seinem Schädel extrahierst du den überlebenden Quanten-Provider des Schwarmes!"
  },
  "pt_br": {
    "label": "🔥 [ARMA] Incinerar o Patriarca com o Corte-plasma Pesado",
    "narrative_override": "Você ativa o corte-plasma em potência máxima. Um feixe ofuscante perfura o quitino e os tecidos do monstro de ponta a ponta. A criatura cai morta. De seu crânio você extrai o Provedor Quântico da Colônia sobrevivente!"
  }
}'::jsonb
WHERE id = 'ch_3_boss_annihilate';

UPDATE public.choices
SET translations = '{
  "en": {
    "label": "🍫 [ITEM] Throw a candy bar into the opposite corner of the lab",
    "narrative_override": "You pull out a chemical-soaked candy bar and hurl it with all your strength to the far end of the hall."
  },
  "es": {
    "label": "🍫 [OBJETO] Lanzar una barra de chocolate a la esquina opuesta del laboratorio",
    "narrative_override": "Sacas una barra de chocolate empapada en químicos y la arrojas con todas tus fuerzas al otro extremo de la sala."
  },
  "de": {
    "label": "🍫 [GEGENSTAND] Riegel in die gegenüberliegende Ecke des Labors werfen",
    "narrative_override": "Du ziehst einen chemiegetränkten Riegel hervor und schleuderst ihn mit aller Kraft ans andere Ende der Halle."
  },
  "pt_br": {
    "label": "🍫 [ITEM] Arremessar um chocolate no canto oposto do laboratório",
    "narrative_override": "Você pega uma barra de chocolate embebida em produtos químicos e a arremessa com toda a força para a outra ponta do salão."
  }
}'::jsonb
WHERE id = 'ch_3_boss_distract_bar';

UPDATE public.choices
SET translations = '{
  "en": { "label": "🔧 [TECH] Short the capsule power cables into the puddle beneath the monster" },
  "es": { "label": "🔧 [TÉCNICA] Cortocircuitar los cables de alimentación de las cápsulas en el charco bajo el monstruo" },
  "de": { "label": "🔧 [TECHNIK] Kapselstromkabel in die Pfütze unter dem Monster eintauchen" },
  "pt_br": { "label": "🔧 [TÉCNICA] Curto-circuitar os cabos de energia das cápsulas na poça sob o monstro" }
}'::jsonb
WHERE id = 'ch_3_boss_eng';

UPDATE public.choices
SET translations = '{
  "en": { "label": "🔥 [WEAPON] Use the Heavy Plasma Cutter against the Blind Patriarch" },
  "es": { "label": "🔥 [ARMA] Usar la Sierra de Plasma Pesada contra el Patriarca Ciego" },
  "de": { "label": "🔥 [WAFFE] Schweren Plasmaschneider gegen den Blinden Patriarchen einsetzen" },
  "pt_br": { "label": "🔥 [ARMA] Usar o Corte-plasma Pesado contra o Patriarca Cego" }
}'::jsonb
WHERE id = 'ch_3_boss_fight';

UPDATE public.choices
SET translations = '{
  "en": {
    "label": "🎲 [LUCK] Freeze and hope the creature steps on an exposed power cable",
    "narrative_override": "Incredible luck! The creature takes a blind step sideways, and its clawed paw lands right on a sparking high-voltage cable. A terrifying discharge throws the Blind Patriarch back into the darkness, giving you precious time to slip toward the nest."
  },
  "es": {
    "label": "🎲 [SUERTE] Quedarse quieto y esperar que la criatura pise un cable de energía expuesto",
    "narrative_override": "¡Increíble suerte! La criatura da un paso ciego hacia un lado y su pata garruda cae justo sobre un cable de alta tensión chispeante. Una descarga aterradora arroja al Patriarca Ciego de vuelta a la oscuridad, dándote tiempo precioso para deslizarte hacia el nido."
  },
  "de": {
    "label": "🎲 [GLÜCK] Erstarren und hoffen, dass das Wesen auf ein freiliegendes Stromkabel tritt",
    "narrative_override": "Unglaubliches Glück! Das Wesen macht einen blinden Schritt zur Seite und seine krallenbewehrte Pfote landet direkt auf einem funkelnden Hochspannungskabel. Ein furchterregender Stromstoß schleudert den Blinden Patriarchen zurück in die Dunkelheit und gibt dir kostbare Zeit, zum Nest vorzurutschen."
  },
  "pt_br": {
    "label": "🎲 [SORTE] Ficar imóvel e torcer para a criatura pisar em um cabo de energia exposto",
    "narrative_override": "Sorte incrível! A criatura dá um passo cego para o lado e sua pata garruda cai bem em cima de um cabo de alta tensão crepitante. Uma descarga aterradora joga o Patriarca Cego de volta à escuridão, dando a você tempo precioso para chegar ao ninho."
  }
}'::jsonb
WHERE id = 'ch_3_boss_luck';

UPDATE public.choices
SET translations = '{
  "en": { "label": "⚡ [REFLEXES] Slice the creature''s auditory membranes with a plasma cutter" },
  "es": { "label": "⚡ [REFLEJOS] Cortar las membranas auditivas de la criatura con una sierra de plasma" },
  "de": { "label": "⚡ [REFLEXE] Hörmembranen des Wesens mit dem Plasmaschneider durchtrennen" },
  "pt_br": { "label": "⚡ [REFLEXOS] Cortar as membranas auditivas da criatura com o corte-plasma" }
}'::jsonb
WHERE id = 'ch_3_boss_ref';

UPDATE public.choices
SET translations = '{
  "en": {
    "label": "🌿 [SURVIVAL] Use pheromones from the bio-waste container to mask your scent",
    "narrative_override": "You quickly smash an emergency container and smear the caustic slime of a dead Swarm specimen across your suit. The Patriarch waves its blind snout just centimeters from your helmet, noisily inhaling, but then lets out a guttural growl, turns, and slithers into the ventilation. The path is clear."
  },
  "es": {
    "label": "🌿 [SUPERVIVENCIA] Usar feromonas del contenedor de desechos biológicos para enmascarar el olor",
    "narrative_override": "Rápidamente rompes un contenedor de emergencia y untas por tu traje la baba cáustica de un espécimen muerto del Enjambre. El Patriarca mueve su hocico ciego a pocos centímetros de tu casco, inhalando ruidosamente, pero luego emite un gruñido gutural, se da vuelta y se desliza hacia la ventilación. El camino está despejado."
  },
  "de": {
    "label": "🌿 [ÜBERLEBEN] Pheromone aus dem Biomüllcontainer benutzen, um den Geruch zu maskieren",
    "narrative_override": "Du zerschmetterst rasch einen Notfallcontainer und streichst den ätzenden Schleim einer toten Schwarm-Kreatur über deinen Anzug. Der Patriarch wackelt mit seiner blinden Schnauze nur wenige Zentimeter vor deinem Helm und schnüffelt laut, stößt dann aber ein kehliges Knurren aus, dreht sich um und gleitet in die Lüftung. Der Weg ist frei."
  },
  "pt_br": {
    "label": "🌿 [SOBREVIVÊNCIA] Usar feromônios do contêiner de resíduos biológicos para mascarar o cheiro",
    "narrative_override": "Você rapidamente quebra um contêiner de emergência e espalha pelo traje a baba cáustica de um espécime morto do Enxame. O Patriarca move o focinho cego a poucos centímetros do seu capacete, inalando ruidosamente, mas então solta um rosnado gutural, vira-se e desliza para a ventilação. O caminho está livre."
  }
}'::jsonb
WHERE id = 'ch_3_boss_srv';

UPDATE public.choices
SET translations = '{
  "en": { "label": "👤 [STEALTH] Silently distract the Patriarch by throwing a metal pipe" },
  "es": { "label": "👤 [SIGILO] Distraer silenciosamente al Patriarca lanzando un tubo metálico" },
  "de": { "label": "👤 [HEIMLICHKEIT] Patriarchen lautlos durch Wurf eines Metallrohrs ablenken" },
  "pt_br": { "label": "👤 [FURTIVIDADE] Distrair silenciosamente o Patriarca arremessando um cano de metal" }
}'::jsonb
WHERE id = 'ch_3_boss_stl';

UPDATE public.choices
SET translations = '{
  "en": { "label": "🏃 Try to rush straight through (No skills)" },
  "es": { "label": "🏃 Intentar pasar de frente (Sin habilidades)" },
  "de": { "label": "🏃 Versuchen, direkt durchzubrechen (Keine Fähigkeiten)" },
  "pt_br": { "label": "🏃 Tentar passar correndo (Sem habilidades)" }
}'::jsonb
WHERE id = 'ch_3_boss_yolo';
