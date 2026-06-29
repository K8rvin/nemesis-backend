-- Миграция: создание недостающих целевых нод для выборов Патриарха.
-- Ноды-заглушки, чтобы миграция 038 могла пройти. Контент можно доработать позже.

INSERT INTO public.nodes (
  id,
  act,
  location_name,
  title,
  narrative,
  thought,
  image_prompt,
  is_start_node,
  is_ending,
  ending_type,
  translations
)
VALUES
  (
    'trans_ch_3_boss_annihilate',
    3,
    'Лаборатория Патриарха',
    'Победа над Слепым Патриархом',
    'Ты активируешь плазморез на полную мощность. Ослепительный луч прожигает хитин и ткани монстра насквозь. Тварь падает замертво. Из ее черепа ты извлекаешь уцелевший Квантовый Провайдер Роя!',
    'Провайдер Роя у меня в руках.',
    'sci-fi horror dark laboratory dead alien patriarch monster plasma cutter',
    false,
    false,
    NULL,
    '{
      "en": {
        "location_name": "Patriarch Laboratory",
        "title": "Victory over the Blind Patriarch",
        "narrative": "You activate the plasma cutter at full power. A blinding beam pierces the monster''s chitin and tissues through and through. The creature falls dead. From its skull you extract the surviving Royal Quantum Provider!",
        "thought": "The Royal Provider is in my hands."
      },
      "es": {
        "location_name": "Laboratorio del Patriarca",
        "title": "Victoria sobre el Patriarca Ciego",
        "narrative": "Activas la sierra de plasma a plena potencia. Un rayo cegador atraviesa el quitino y los tejidos del monstruo de parte a parte. La criatura cae muerta. ¡De su cráneo extraes el Proveedor Cuántico de la Colonia superviviente!",
        "thought": "El Proveedor de la Colonia está en mis manos."
      },
      "de": {
        "location_name": "Labor des Patriarchen",
        "title": "Sieg über den Blinden Patriarchen",
        "narrative": "Du aktivierst den Plasmaschneider mit voller Leistung. Ein blendender Strahl durchbohrt Chitin und Gewebe des Monsters. Das Wesen fällt tot um. Aus seinem Schädel extrahierst du den überlebenden Quanten-Provider des Schwarmes!",
        "thought": "Der Quanten-Provider des Schwarmes liegt in meinen Händen."
      },
      "pt_br": {
        "location_name": "Laboratório do Patriarca",
        "title": "Vitória sobre o Patriarca Cego",
        "narrative": "Você ativa o corte-plasma em potência máxima. Um feixe ofuscante perfura o quitino e os tecidos do monstro de ponta a ponta. A criatura cai morta. De seu crânio você extrai o Provedor Quântico da Colônia sobrevivente!",
        "thought": "O Provedor da Colônia está em minhas mãos."
      }
    }'::jsonb
  ),
  (
    'act3_boss_distract_result',
    3,
    'Лаборатория Патриарха',
    'Патриарх отвлечён',
    'Батончик улетел в дальний угол зала. Слепой Патриарх рванул туда, оставляя тебе дорогу.',
    'Нужно воспользоваться моментом.',
    'sci-fi horror dark laboratory distracted blind alien monster chasing candy bar',
    false,
    false,
    NULL,
    '{
      "en": {
        "location_name": "Patriarch Laboratory",
        "title": "Patriarch Distracted",
        "narrative": "The candy bar flew into the far corner of the hall. The Blind Patriarch lunged toward it, leaving the path open for you.",
        "thought": "I need to seize the moment."
      },
      "es": {
        "location_name": "Laboratorio del Patriarca",
        "title": "Patriarca Distraído",
        "narrative": "La barra de chocolate voló a la esquina lejana de la sala. El Patriarca Ciego se abalanzó hacia ella, dejándote el camino libre.",
        "thought": "Debo aprovechar el momento."
      },
      "de": {
        "location_name": "Labor des Patriarchen",
        "title": "Patriarch abgelenkt",
        "narrative": "Der Riegel flog in die entfernte Ecke der Halle. Der Blinde Patriarch stürzte darauf zu und ließ dir den Weg frei.",
        "thought": "Ich muss den Moment nutzen."
      },
      "pt_br": {
        "location_name": "Laboratório do Patriarca",
        "title": "Patriarca Distraído",
        "narrative": "O chocolate voou para o canto distante do salão. O Patriarca Cego se lançou em sua direção, deixando o caminho livre para você.",
        "thought": "Preciso aproveitar o momento."
      }
    }'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
