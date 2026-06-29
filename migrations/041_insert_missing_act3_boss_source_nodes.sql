-- Миграция: создание недостающих нод act3_boss_combat и act3_boss_stealth.
-- Ноды-заглушки для веток боя и скрытности против Слепого Патриарха.

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
    'act3_boss_combat',
    3,
    'Лаборатория Патриарха',
    'Бой со Слепым Патриархом',
    'Ты решаешь атаковать Слепого Патриарха в лоб. Монстр уже чует тебя — нужно действовать быстро.',
    'Только один из нас выйдет живым.',
    'sci-fi horror dark laboratory combat blind alien monster charging',
    false,
    false,
    NULL,
    '{
      "en": {
        "location_name": "Patriarch Laboratory",
        "title": "Fight the Blind Patriarch",
        "narrative": "You decide to attack the Blind Patriarch head-on. The monster already senses you — you must act fast.",
        "thought": "Only one of us will leave alive."
      },
      "es": {
        "location_name": "Laboratorio del Patriarca",
        "title": "Pelea contra el Patriarca Ciego",
        "narrative": "Decides atacar al Patriarca Ciego de frente. El monstruo ya te siente — debes actuar rápido.",
        "thought": "Solo uno de nosotros saldrá vivo."
      },
      "de": {
        "location_name": "Labor des Patriarchen",
        "title": "Kampf gegen den Blinden Patriarchen",
        "narrative": "Du beschließt, den Blinden Patriarchen frontal anzugreifen. Das Monster spürt dich bereits — du musst schnell handeln.",
        "thought": "Nur einer von uns wird lebend herauskommen."
      },
      "pt_br": {
        "location_name": "Laboratório do Patriarca",
        "title": "Lutar contra o Patriarca Cego",
        "narrative": "Você decide atacar o Patriarca Cego de frente. O monstro já sente você — precisa agir rápido.",
        "thought": "Apenas um de nós sairá vivo."
      }
    }'::jsonb
  ),
  (
    'act3_boss_stealth',
    3,
    'Лаборатория Патриарха',
    'Скрытный подход к Патриарху',
    'Ты замираешь в тени, пытаясь проскользнуть мимо Слепого Патриарха незамеченным.',
    'Он слепой, но обоняние у него отменное.',
    'sci-fi horror dark laboratory stealth hiding from blind alien monster',
    false,
    false,
    NULL,
    '{
      "en": {
        "location_name": "Patriarch Laboratory",
        "title": "Stealth Approach to the Patriarch",
        "narrative": "You freeze in the shadows, trying to slip past the Blind Patriarch unnoticed.",
        "thought": "It is blind, but its sense of smell is excellent."
      },
      "es": {
        "location_name": "Laboratorio del Patriarca",
        "title": "Aproximación Sigilosa al Patriarca",
        "narrative": "Te quedas inmóvil en las sombras, intentando pasar desapercibido junto al Patriarca Ciego.",
        "thought": "Está ciego, pero su sentido del olfato es excelente."
      },
      "de": {
        "location_name": "Labor des Patriarchen",
        "title": "Schleichansatz zum Patriarchen",
        "narrative": "Du erstarst im Schatten und versuchst, am Blinden Patriarchen unbemerkt vorbeizuschleichen.",
        "thought": "Er ist blind, aber sein Geruchssinn ist ausgezeichnet."
      },
      "pt_br": {
        "location_name": "Laboratório do Patriarca",
        "title": "Aproximação Furtiva do Patriarca",
        "narrative": "Você fica imóvel nas sombras, tentando passar despercebido pelo Patriarca Cego.",
        "thought": "Ele é cego, mas seu olfato é excelente."
      }
    }'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
