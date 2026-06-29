-- Исправление: вариант "Отступить к терминалу" на мостике был безусловным
-- и вёл напрямую к финальному терминалу, что ослабляло сцену.
-- Теперь он требует Квантовый Носитель (ключевой предмет, получаемый при сделке с Хартом)
-- и переписан без упоминания Тобиаса.

UPDATE public.choices
SET
  label = '⚡ [ПРЕДМЕТ] Использовать Квантовый Носитель для импульса защитного поля и отступить к терминалу',
  narrative_override = 'Ты вставляешь Квантовый Носитель в разъём скафандра. На долю секунды вокруг тебя вспыхивает сфера искажённого пространства, рассеивающая лазерные лучи турелей. Используя эту паузу, ты отступаешь к главному терминалу мостика.',
  conditions = '{"item_required":"Квантовый Носитель"}'::jsonb,
  translations = '{
    "de": {
      "label": "⚡ [GEGENSTAND] Quantenträger für einen Schildimpuls verwenden und zum Terminal zurückziehen",
      "narrative_override": "Du steckst den Quantenträger in die Anzugbuchse. Einen Bruchteil einer Sekunde flackert eine Sphäre aus verzerrtem Raum um dich herum und streut die Laserstrahlen der Türme. Du nutzt diese Pause, um dich zum Hauptterminal der Brücke zurückzuziehen."
    },
    "en": {
      "label": "⚡ [ITEM] Use the Quantum Carrier for a shield pulse and retreat to the terminal",
      "narrative_override": "You insert the Quantum Carrier into the suit socket. For a fraction of a second, a sphere of distorted space flares around you, scattering the turrets'' laser beams. Using this pause, you retreat to the bridge''s main terminal."
    },
    "es": {
      "label": "⚡ [ARTÍCULO] Usar el Portador Cuántico para un pulso de escudo y retirarte a la terminal",
      "narrative_override": "Insertas el Portador Cuántico en la ranura del traje. Durante una fracción de segundo, una esfera de espacio distorsionado estalla a tu alrededor, dispersando los rayos láser de las torretas. Aprovechando esta pausa, retrocedes hasta la terminal principal del puente."
    },
    "pt_br": {
      "label": "⚡ [ITEM] Use o Portador Quântico para um pulso de escudo e recue para o terminal",
      "narrative_override": "Você insere o Portador Quântico na tomada do traje. Por uma fração de segundo, uma esfera de espaço distorcido irrompe ao seu redor, espalhando os raios laser das torres. Usando essa pausa, você recua para o terminal principal da ponte."
    }
  }'::jsonb
WHERE id = 'ch_5_showdown_tobias_safe';
