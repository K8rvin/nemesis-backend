-- 036_death_node.sql
-- Нода смерти при обнулении HP.

BEGIN;

ALTER TABLE public.nodes
  ADD COLUMN IF NOT EXISTS type text;

INSERT INTO public.nodes (
  id, act, location_name, title, narrative, thought,
  is_start_node, is_ending, ending_type, type, image_prompt, translations
) VALUES (
  'death_hp_zero',
  0,
  'КРИТИЧЕСКИЙ СЕКТОР',
  'ПРОТОКОЛ ЗАВЕРШЕН',
  'Био-сигналы оператора потеряны. Скафандр разгерметизирован, а системы жизнеобеспечения остановлены. Станция «Немезида» остаётся безмолвной свидетельницей ещё одной смерти в её чёрных коридорах.',
  'Смерть не прощает ошибок.',
  false,
  true,
  'death',
  'death',
  'dark damaged spacesuit floating in zero gravity with red warning lights',
  $JSON${
    "en": {
      "title": "PROTOCOL TERMINATED",
      "location_name": "CRITICAL SECTOR",
      "narrative": "The operator's bio-signals are lost. The suit is depressurized and life support systems have stopped. The station Nemesis remains a silent witness to yet another death in its dark corridors.",
      "thought": "Death does not forgive mistakes."
    },
    "es": {
      "title": "PROTOCOLO TERMINADO",
      "location_name": "SECTOR CRÍTICO",
      "narrative": "Las señales biológicas del operador se pierden. El traje está despresurizado y los sistemas de soporte vital se han detenido. La estación Némesis sigue siendo testigo silencioso de otra muerte más en sus oscuros corredores.",
      "thought": "La muerte no perdona los errores."
    },
    "pt_br": {
      "title": "PROTOCOLO ENCERRADO",
      "location_name": "SETOR CRÍTICO",
      "narrative": "Os sinais biológicos do operador são perdidos. O traje está despressurizado e os sistemas de suporte de vida pararam. A estação Nemesis permanece como testemunha silenciosa de mais uma morte em seus corredores escuros.",
      "thought": "A morte não perdoa erros."
    },
    "de": {
      "title": "PROTOKOLL BEENDET",
      "location_name": "KRITISCHER SEKTOR",
      "narrative": "Die Biosignale des Operators sind verloren. Der Anzug ist drucklos und die Lebenserhaltungssysteme haben sich abgeschaltet. Die Station Nemesis bleibt stummer Zeuge eines weiteren Todes in ihren dunklen Korridoren.",
      "thought": "Der Tod verzeiht keine Fehler."
    }
  }$JSON$::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  act = EXCLUDED.act,
  location_name = EXCLUDED.location_name,
  title = EXCLUDED.title,
  narrative = EXCLUDED.narrative,
  thought = EXCLUDED.thought,
  is_start_node = EXCLUDED.is_start_node,
  is_ending = EXCLUDED.is_ending,
  ending_type = EXCLUDED.ending_type,
  type = EXCLUDED.type,
  image_prompt = EXCLUDED.image_prompt,
  translations = EXCLUDED.translations;

COMMIT;
