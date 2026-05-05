import { useEffect } from "react";

/**
 * Глобальные клавиатурные шорткаты приложения.
 * - Ctrl/Cmd+K — переключить режим поиска задач
 * - Escape    — выйти из режима поиска
 *
 * Поиск завязан на items.task — потому что бэкенд-эндпоинт `task/search`
 * единственный (см. Этап 1 плана). Если поиск переедет в отдельный SearchStore,
 * передавайте его сюда вместо items.
 */
export function useGlobalShortcuts(items) {
	useEffect(() => {
		const handleKeyDown = (event) => {
			const isToggleShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';

			if (isToggleShortcut) {
				event.preventDefault();
				if (items.task.searchMode) {
					items.task.clearSearch();
				} else {
					items.task.setSearchMode(true);
				}
				return;
			}

			if (event.key === 'Escape' && items.task.searchMode) {
				items.task.clearSearch();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [items]);
}
