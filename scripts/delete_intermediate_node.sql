-- Удаление промежуточной ноды (1 входящий выбор, 1 исходящий выбор).
-- Перед выполнением заменить '<TITLE>' на title ноды, которую нужно удалить.

BEGIN;

DO $$
DECLARE
    v_node_id TEXT;
    v_target_node_id TEXT;
    v_incoming_choice_id TEXT;
    v_node_title TEXT := '<TITLE>';
BEGIN
    -- 1. Находим ID ноды по заголовку
    SELECT id INTO v_node_id FROM nodes WHERE title = v_node_title LIMIT 1;
    
    IF v_node_id IS NULL THEN
        RAISE NOTICE 'Нода с title="%" не найдена.', v_node_title;
        RETURN;
    END IF;

    -- 2. Находим ID ноды, КУДА ведет исходящий выбор из удаляемой ноды
    SELECT target_node_id INTO v_target_node_id 
    FROM choices 
    WHERE node_id = v_node_id 
    LIMIT 1;

    -- 3. Находим ID выбора, который ведет В удаляемую ноду
    SELECT id INTO v_incoming_choice_id 
    FROM choices 
    WHERE target_node_id = v_node_id 
    LIMIT 1;

    -- 4. Перенаправляем входящий выбор сразу на целевую ноду
    IF v_incoming_choice_id IS NOT NULL AND v_target_node_id IS NOT NULL THEN
        UPDATE choices 
        SET target_node_id = v_target_node_id 
        WHERE id = v_incoming_choice_id;
        
        RAISE NOTICE 'УСПЕХ: Выбор "%" перенаправлен напрямую в ноду "%"', v_incoming_choice_id, v_target_node_id;
    ELSE
        RAISE WARNING 'Не удалось найти входящий или исходящий выбор для ноды "%"', v_node_id;
        RETURN;
    END IF;

    -- 5. Удаляем саму ноду.
    -- Благодаря "ON DELETE CASCADE" на node_id, исходящий выбор удалится автоматически.
    DELETE FROM nodes WHERE id = v_node_id;
    
    RAISE NOTICE 'Нода "%" (title: "%") успешно удалена из базы.', v_node_id, v_node_title;
END $$;

COMMIT;
