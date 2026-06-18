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
 '{"en":{"title":"Hart Dossier","description":"Search the Security Service archive and take the documents."}}'),
('ach_botanist', 'Ботаник', 'Открыть заржавевший грузовой люк в плотоядном саду с помощью масла «Крио-Шилд».', 'BRONZE',
 '{"en":{"title":"Botanist","description":"Open the rusted cargo hatch in the carnivorous garden using Cryo-Shield oil."}}'),
('ach_self_doctor', 'Сам себе доктор', 'Использовать инженерную крио-капсулу для экстренной консервации в Акте 4.', 'BRONZE',
 '{"en":{"title":"Self-Doctor","description":"Use the engineering cryo-pod for emergency stasis in Act 4."}}'),
('ach_reboot', 'Перезагрузка', 'Провести чистую программную экстракцию штамма в Гнезде Реактора.', 'BRONZE',
 '{"en":{"title":"Reboot","description":"Perform a clean program extraction of the strain in the Reactor Nest."}}')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  medal_tier = EXCLUDED.medal_tier,
  translations = EXCLUDED.translations;

-- 2. Unlock achievements on clean trap choices
UPDATE choices SET effects = effects || '{"unlock_achievement":"ach_trap_clean"}' WHERE id IN (
  'ch_1_trap_eng_clean', 'ch_1_trap_luck_clean', 'ch_1_trap_stl_clean'
);

-- 3. Unlock Hart dossier when searching security archive
UPDATE choices SET effects = effects || '{"unlock_achievement":"ach_hart_dossier"}' WHERE id = 'ch_2_security_take_items';

-- 4. Add flag for reading the Act 3 archive terminal
UPDATE choices SET effects = effects || '{"add_flag":"visited_core_terminal"}' WHERE id = 'ch_3_lore_back';

-- 5. Unlock Botanist on successful oil bypass in hydroponics
UPDATE choices SET effects = effects || '{"unlock_achievement":"ach_botanist"}' WHERE id = 'ch_2_hydro_bypass_oil';

-- 6. Unlock Self-Doctor on entering cryo-stasis in Act 4
UPDATE choices SET effects = effects || '{"unlock_achievement":"ach_self_doctor"}' WHERE id = 'ch_4_to_cryo_stasis';

-- 7. Unlock Reboot on clean hack extraction in the Reactor Nest
UPDATE choices SET effects = effects || '{"unlock_achievement":"ach_reboot"}' WHERE id = 'ch_3_nest_hck';
