-- Migration 010: new achievements for rarely visited nodes

-- 1. Create achievements
INSERT INTO "public"."achievements" ("id", "title", "description", "medal_tier", "translations") VALUES
('ach_trap_clean', 'Акробат', 'Пройти заклинивший шлюз в Акте 1 без ранений.', 'SILVER',
 '{"en":{"title":"Acrobat","description":"Pass the jammed airlock in Act 1 without injury."}}'),
('ach_lore_historian', 'Архивариус Немезиды', 'Найти и прочитать все три лорные записи: планшет Блейка, обрывок газеты и архивный терминал.', 'SILVER',
 '{"en":{"title":"Nemesis Archivist","description":"Find and read all three lore entries: Blake''s tablet, the newspaper scrap, and the archive terminal."}}'),
('ach_clean_bill', 'Чистый билл', 'Снять все травмы нейро-регенератором в лабораторном мед-шкафу.', 'BRONZE',
 '{"en":{"title":"Clean Bill","description":"Remove all injuries with the neuro-regenerator in the lab med-bay."}}'),
('ach_hart_dossier', 'Досье на Харт', 'Обыскать архив Службы Безопасности и забрать документы.', 'BRONZE',
 '{"en":{"title":"Hart Dossier","description":"Search the Security Service archive and take the documents."}}')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  medal_tier = EXCLUDED.medal_tier,
  translations = EXCLUDED.translations;

-- 2. Unlock achievements on clean trap choices
UPDATE choices SET effects = '{"unlock_achievement":"ach_trap_clean"}' WHERE id IN (
  'ch_1_trap_eng_clean', 'ch_1_trap_luck_clean', 'ch_1_trap_stl_clean'
);

-- 3. Unlock Hart dossier when searching security archive
UPDATE choices SET effects = '{"unlock_achievement":"ach_hart_dossier"}' WHERE id = 'ch_2_security_take_items';

-- 4. Add flag for reading the Act 3 archive terminal
UPDATE choices SET effects = '{"add_flag":"visited_core_terminal"}' WHERE id = 'ch_3_lore_back';
